// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Repository, Connection } from 'typeorm';
import { isEmpty } from 'lodash';
import { BigNumber } from 'ethers';
import { ContractSDK } from '@subql/contract-sdk';
import { cidToBytes32, GraphqlQueryClient, NETWORK_CONFIGS } from '@subql/network-clients';

import { colorText, getLogger, TextColor } from 'src/utils/logger';
import { AccountService } from 'src/account/account.service';
import { ZERO_BYTES32 } from 'src/utils/project';
import { Project, ProjectEntity } from 'src/project/project.model';

import { ContractService } from './contract.service';
import { IndexingStatus, Transaction, TxFun } from './types';
import { QueryService } from './query.service';
import { debugLogger } from '../utils/logger';
import {
  GetIndexerUnfinalisedPlans,
  GetIndexerUnfinalisedPlansQuery,
  GetIndexerUnfinalisedPlansQueryVariables,
} from '@subql/network-query';
import { Config } from 'src/configure/configure.module';

@Injectable()
export class NetworkService implements OnApplicationBootstrap {
  private sdk: ContractSDK;
  private client: GraphqlQueryClient;
  private retryCount: number;
  private interval: number;
  private intervalTimer: NodeJS.Timer;
  private failedTransactions: Transaction[];
  private expiredAgreements: { [key: number]: BigNumber };

  private defaultInterval = 1000 * 300;
  private defaultRetryCount = 5;
  private batchSize = 20;

  private projectRepo: Repository<ProjectEntity>;

  constructor(
    private connection: Connection,
    private contractService: ContractService,
    private accountService: AccountService,
    private queryService: QueryService,
    private readonly config: Config,
  ) {
    this.failedTransactions = [];
    this.expiredAgreements = {};
    this.client = new GraphqlQueryClient(NETWORK_CONFIGS[config.network]);
    this.projectRepo = connection.getRepository(ProjectEntity);
  }

  getSdk() {
    return this.sdk;
  }

  onApplicationBootstrap() {
    this.periodicUpdateNetwork();
  }

  async getIndexingProjects() {
    const projects = await this.projectRepo.find();
    const indexingProjects = await Promise.all(
      projects.map(async (project) => {
        const { status } = await this.contractService.deploymentStatusByIndexer(project.id);
        project.status = status;
        return await this.projectRepo.save(project);
      }),
    );

    return indexingProjects.filter(
      ({ queryEndpoint, status }) =>
        !isEmpty(queryEndpoint) && [IndexingStatus.INDEXING, IndexingStatus.READY].includes(status),
    );
  }

  async updateExpiredAgreements() {
    try {
      const indexer = await this.accountService.getIndexer();
      const agreementCount = await this.sdk.serviceAgreementRegistry.indexerCsaLength(indexer);
      for (let i = 0; i < agreementCount.toNumber(); i++) {
        const agreementId = await this.sdk.serviceAgreementRegistry.closedServiceAgreementIds(indexer, i);
        const agreementExpired = await this.sdk.serviceAgreementRegistry.closedServiceAgreementExpired(
          agreementId,
        );

        if (agreementExpired) {
          const id = agreementId.toNumber();
          Object.assign(this.expiredAgreements, { [id]: agreementId });
        }
      }
    } catch {
      getLogger('network').info('failed to update expired service agreements');
    }
  }

  async syncContractConfig(): Promise<boolean> {
    try {
      this.sdk = await this.contractService.updateContractSDK();
      return !!this.sdk;
    } catch {
      return false;
    }
  }

  async sendTransaction(actionName: string, txFun: TxFun, desc = '') {
    try {
      getLogger('transaction').info(
        `${colorText(actionName)}: ${colorText('PROCESSING', TextColor.YELLOW)} ${desc}`,
      );

      const tx = await txFun();
      await tx.wait(10);

      getLogger('transaction').info(`${colorText(actionName)}: ${colorText('SUCCEED', TextColor.GREEN)}`);

      return;
    } catch (e) {
      this.failedTransactions.push({ name: actionName, txFun, desc });
      getLogger('transaction').warn(`${colorText(actionName)}: ${colorText('FAILED', TextColor.RED)} : ${e}`);
    }
  }

  async removeExpiredAgreements() {
    if (Object.keys(this.expiredAgreements).length === 0) return;

    try {
      const indexer = await this.accountService.getIndexer();
      const agreementCount = await this.sdk.serviceAgreementRegistry.indexerCsaLength(indexer);
      for (let i = 0; i < agreementCount.toNumber(); i++) {
        const agreementId = await this.sdk.serviceAgreementRegistry
          .closedServiceAgreementIds(indexer, i)
          .then((id) => id.toNumber());

        if (this.expiredAgreements[agreementId]) {
          await this.sendTransaction(
            'remove expired service agreement',
            () => this.sdk.serviceAgreementRegistry.clearEndedAgreement(indexer, i),
            `service agreement: ${agreementId}`,
          );

          delete this.expiredAgreements[agreementId];
          break;
        }
      }
    } catch {
      getLogger('network').info('failed to remove expired service agreements');
    }

    await this.removeExpiredAgreements();
  }

  async reportIndexingService(project: Project) {
    const { id } = project;
    const poi = await this.queryService.getReportPoi(project);
    if (poi.blockHeight === 0) return;

    const { blockHeight, mmrRoot } = poi;
    const mmrRootLog = mmrRoot !== ZERO_BYTES32 ? `| mmrRoot: ${mmrRoot}` : '';
    const desc = `| project ${id.substring(0, 15)} | block height: ${blockHeight} ${mmrRootLog}`;

    const timestamp = await this.contractService.getBlockTime();
    const indexer = await this.accountService.getIndexer();
    await this.sendTransaction(
      `report project status`,
      async () => {
        const tx = await this.sdk.queryRegistry.reportIndexingStatus(
          indexer,
          cidToBytes32(id.trim()),
          blockHeight,
          mmrRoot,
          timestamp,
        );
        return tx;
      },
      desc,
    );
  }

  async reportIndexingServiceActions() {
    const indexingProjects = await this.getIndexingProjects();
    if (isEmpty(indexingProjects)) return [];

    return indexingProjects.map((project) => () => this.reportIndexingService(project));
  }

  async hasPendingChanges(indexer: string) {
    const icrChangEra = await this.sdk.rewardsStaking.getCommissionRateChangedEra(indexer);
    const stakers = await this.sdk.rewardsHelper.getPendingStakers(indexer);
    return !isEmpty(stakers) || !icrChangEra.eq(0);
  }

  async geEraConfig() {
    const indexer = await this.accountService.getIndexer();
    const [currentEra, lastClaimedEra, lastSettledEra] = await Promise.all([
      this.sdk.eraManager.eraNumber(),
      (await this.sdk.rewardsDistributor.getRewardInfo(indexer)).lastClaimEra,
      this.sdk.rewardsStaking.getLastSettledEra(indexer),
    ]);

    return { currentEra, lastClaimedEra, lastSettledEra };
  }

  async canCollectRewards(): Promise<boolean> {
    const { currentEra, lastClaimedEra, lastSettledEra } = await this.geEraConfig();
    return lastClaimedEra.gt(0) && lastClaimedEra.lt(currentEra.sub(1)) && lastClaimedEra.lte(lastSettledEra);
  }

  async collectAndDistributeReward(indexer: string) {
    await this.sendTransaction('collect and distribute rewards', () =>
      this.sdk.rewardsDistributor.collectAndDistributeRewards(indexer),
    );
  }

  async batchCollectAndDistributeRewards(indexer: string, currentEra: BigNumber, lastClaimedEra: BigNumber) {
    const count = currentEra.sub(lastClaimedEra.add(1)).div(this.batchSize).toNumber() + 1;
    for (let i = 0; i < count; i++) {
      const canCollectRewards = await this.canCollectRewards();
      if (!canCollectRewards) return;

      await this.sendTransaction('batch collect and distribute rewards', () =>
        this.sdk.rewardsHelper.batchCollectAndDistributeRewards(indexer, this.batchSize),
      );
    }
  }

  async getExpiredStateChannels(): Promise<GetIndexerUnfinalisedPlansQuery['stateChannels']['nodes']> {
    const apolloClient = this.client.networkClient;
    const now = new Date();
    const indexer = await this.accountService.getIndexer();
    const result = await apolloClient.query<
      GetIndexerUnfinalisedPlansQuery,
      GetIndexerUnfinalisedPlansQueryVariables
    >({
      query: GetIndexerUnfinalisedPlans,
      variables: { indexer, now },
    });

    return result.data.stateChannels.nodes;
  }

  collectAndDistributeRewardsAction() {
    return async () => {
      const canCollectRewards = await this.canCollectRewards();
      if (!canCollectRewards) return;

      const { currentEra, lastClaimedEra, lastSettledEra } = await this.geEraConfig();
      const values = `currentEra: ${currentEra.toNumber()} | lastClaimedEra: ${lastClaimedEra.toNumber()} | lastSettledEra: ${lastSettledEra.toNumber()}`;
      getLogger('network').info(`${values}`);

      const indexer = await this.accountService.getIndexer();
      const hasPendingChanges = await this.hasPendingChanges(indexer);
      if (hasPendingChanges) {
        await this.collectAndDistributeReward(indexer);
        return;
      }

      await this.batchCollectAndDistributeRewards(indexer, currentEra, lastClaimedEra);
    };
  }

  applyStakeChangesAction() {
    return async () => {
      const indexer = await this.accountService.getIndexer();
      const stakers = await this.sdk.rewardsHelper.getPendingStakers(indexer);
      const { lastClaimedEra, lastSettledEra } = await this.geEraConfig();

      if (stakers.length === 0 || lastSettledEra.gte(lastClaimedEra)) return;

      getLogger('network').info(`new stakers ${stakers}`);
      await this.sendTransaction('apply stake changes', async () =>
        this.sdk.rewardsHelper.batchApplyStakeChange(indexer, stakers),
      );
    };
  }

  applyICRChangeAction() {
    return async () => {
      const indexer = await this.accountService.getIndexer();
      const { currentEra, lastClaimedEra, lastSettledEra } = await this.geEraConfig();
      const icrChangEra = await this.sdk.rewardsStaking.getCommissionRateChangedEra(indexer);

      if (!icrChangEra.eq(0) && icrChangEra.lte(currentEra) && lastSettledEra.lt(lastClaimedEra)) {
        await this.sendTransaction('apply ICR changes', async () =>
          this.sdk.rewardsStaking.applyICRChange(indexer),
        );
      }
    };
  }

  updateEraNumberAction() {
    return async () => {
      const eraStartTime = await this.sdk.eraManager.eraStartTime();
      const eraPeriod = await this.sdk.eraManager.eraPeriod();
      const blockTime = await this.contractService.getBlockTime();

      const canUpdateEra = blockTime - eraStartTime.toNumber() > eraPeriod.toNumber();
      if (canUpdateEra) {
        await this.sendTransaction('update era number', async () =>
          this.sdk.eraManager.safeUpdateAndGetEra(),
        );
      }
    };
  }

  closeExpiredStateChannelsAction() {
    return async () => {
      const unfinalisedPlans = await this.getExpiredStateChannels();

      for (const node of unfinalisedPlans) {
        await this.sendTransaction(`claim unfinalized plan for ${node.consumer}`, async () =>
          this.sdk.stateChannel.claim(node.id),
        );
      }
    };
  }

  networkActions() {
    return [
      this.updateEraNumberAction(),
      this.collectAndDistributeRewardsAction(),
      this.applyICRChangeAction(),
      this.applyStakeChangesAction(),
      this.closeExpiredStateChannelsAction(),
    ];
  }

  async sendTxs() {
    try {
      const isContractReady = await this.syncContractConfig();
      if (!isContractReady) return;

      const isBalanceSufficient = await this.contractService.hasSufficientBalance();
      if (!isBalanceSufficient) {
        getLogger('contract').warn(
          'insufficient balance for the controller account, please top up your controller account ASAP.',
        );
      }

      const reportIndexingServiceActions = await this.reportIndexingServiceActions();
      const networkActions = this.networkActions();
      const actions = [...networkActions, ...reportIndexingServiceActions];

      for (let i = 0; i < actions.length; i++) {
        await actions[i]();
      }

      await this.updateExpiredAgreements();
      await this.removeExpiredAgreements();

      const txCount = this.failedTransactions.length;
      if (txCount > 0) {
        getLogger('network').info('resend failed transactions');
      }

      for (let i = 0; i < txCount; i++) {
        const { name, txFun, desc } = this.failedTransactions[i];
        await this.sendTransaction(name, txFun, desc);
      }

      this.failedTransactions = [];
    } catch (e) {
      debugLogger('network', `failed to update network: ${e}`);
      getLogger('network').info(`retry to send transactions`);

      this.failedTransactions = [];

      if (this.retryCount !== 0) {
        this.retryCount--;
        await this.sendTxs();
      }
    }
  }

  async getInterval() {
    try {
      const isContractReady = await this.syncContractConfig();
      if (!isContractReady) return this.interval ?? this.defaultInterval;

      const eraPeriod = await this.sdk.eraManager.eraPeriod();
      return Math.min((eraPeriod.toNumber() * 1000) / 6, this.defaultInterval);
    } catch {
      return this.defaultInterval;
    }
  }

  async updateInterval() {
    const interval = await this.getInterval();
    if (interval !== this.interval && this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = undefined;

      getLogger('network').info(`transactions interval change from ${this.interval} to ${interval}`);

      this.interval = interval;
      await this.periodicUpdateNetwork();
    }
  }

  async periodicUpdateNetwork() {
    if (!this.interval) {
      this.interval = await this.getInterval();
    }

    getLogger('network').info(`transaction interval: ${this.interval}`);

    await this.sendTxs();

    this.intervalTimer = setInterval(async () => {
      this.retryCount = this.defaultRetryCount;
      await this.updateInterval();
      await this.sendTxs();
    }, this.interval);
  }
}
