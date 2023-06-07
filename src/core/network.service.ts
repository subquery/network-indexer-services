// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import {Injectable, OnApplicationBootstrap} from '@nestjs/common';
import {Cron, CronExpression} from '@nestjs/schedule';
import {ContractSDK} from '@subql/contract-sdk';
import {cidToBytes32, GraphqlQueryClient, NETWORK_CONFIGS} from '@subql/network-clients';
import {
  GetIndexerUnfinalisedPlans,
  GetIndexerUnfinalisedPlansQuery,
  GetIndexerUnfinalisedPlansQueryVariables,
} from '@subql/network-query';
import {BigNumber} from 'ethers';
import {isEmpty} from 'lodash';
import {Connection, Repository} from 'typeorm';

import {Config} from '../configure/configure.module';
import {Project, ProjectEntity} from '../project/project.model';
import {colorText, debugLogger, getLogger, TextColor} from '../utils/logger';
import {ZERO_BYTES32} from '../utils/project';

import {mutexPromise} from "../utils/promise";
import {AccountService} from "./account.service";
import {ContractService} from './contract.service';
import {QueryService} from './query.service';
import {IndexingStatus, TxFun} from './types';

const MAX_RETRY = 3;

const logger = getLogger('transaction');

@Injectable()
export class NetworkService implements OnApplicationBootstrap {
  private sdk: ContractSDK;
  private client: GraphqlQueryClient;
  private expiredAgreements: { [key: number]: BigNumber };

  private batchSize = 20;

  private projectRepo: Repository<ProjectEntity>;

  constructor(
    private connection: Connection,
    private contractService: ContractService,
    private accountService: AccountService,
    private queryService: QueryService,
    private readonly config: Config,
  ) {
    this.expiredAgreements = {};
    this.client = new GraphqlQueryClient(NETWORK_CONFIGS[config.network]);
    this.projectRepo = connection.getRepository(ProjectEntity);
  }

  onApplicationBootstrap() {
    void (async () => {
      await this.doNetworkActions();
      await this.removeExpiredAgreements();
      await this.reportIndexingServiceActions();
    })();
  }

  getSdk() {
    return this.sdk;
  }

  async getIndexingProjects() {
    const indexer = await this.accountService.getIndexer();
    const projects = await this.projectRepo.find();
    const indexingProjects = await Promise.all(
      projects.map(async (project) => {
        const {status} = await this.contractService.deploymentStatusByIndexer(project.id, indexer);
        project.status = status;
        return await this.projectRepo.save(project);
      }),
    );

    return indexingProjects.filter(
      ({queryEndpoint, status}) =>
        !isEmpty(queryEndpoint) && [IndexingStatus.INDEXING, IndexingStatus.READY].includes(status),
    );
  }

  private async updateExpiredAgreements() {
    const indexer = await this.accountService.getIndexer();
    const agreementCount = await this.sdk.serviceAgreementRegistry.indexerCsaLength(indexer);
    for (let i = 0; i < agreementCount.toNumber(); i++) {
      const agreementId = await this.sdk.serviceAgreementRegistry.closedServiceAgreementIds(indexer, i);
      const agreementExpired = await this.sdk.serviceAgreementRegistry.closedServiceAgreementExpired(
        agreementId,
      );

      if (agreementExpired) {
        const id = agreementId.toNumber();
        Object.assign(this.expiredAgreements, {[id]: agreementId});
      }
    }
  }

  async syncContractConfig(): Promise<boolean> {
    try {
      const indexer = await this.accountService.getIndexer();
      if (!indexer) {
        logger.error('No indexer configured');
        return false;
      }
      this.sdk = await this.contractService.updateContractSDK(indexer);
      return !!this.sdk;
    } catch (e) {
      logger.error(e, 'syncContractConfig')
      return false;
    }
  }

  @mutexPromise()
  async sendTransaction(actionName: string, txFun: TxFun, desc = '', retries = 0) {
    try {
      logger.info(`${colorText(actionName)}: ${colorText('PROCESSING', TextColor.YELLOW)} ${desc}`);

      const overrides = await this.contractService.getOverrides();
      const tx = await txFun(overrides);
      await tx.wait(10);

      logger.info(`${colorText(actionName)}: ${colorText('SUCCEED', TextColor.GREEN)}`);

      return;
    } catch (e) {
      if (retries < MAX_RETRY) {
        logger.warn(`${colorText(actionName)}: ${colorText('RETRY', TextColor.YELLOW)} ${desc}`);
        await this.sendTransaction(actionName, txFun, desc, retries + 1);
      } else {
        logger.warn(e, `${colorText(actionName)}: ${colorText('FAILED', TextColor.RED)}`);
        throw e;
      }
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async removeExpiredAgreements() {
    await this.checkControllerReady();
    try {
      await this.updateExpiredAgreements();
    } catch {
      getLogger('network').info('failed to update expired service agreements');
    }
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
            (overrides) => this.sdk.serviceAgreementRegistry.clearEndedAgreement(indexer, i, overrides),
            `service agreement: ${agreementId}`,
          );

          delete this.expiredAgreements[agreementId];
          break;
        }
      }
    } catch {
      getLogger('network').info('failed to remove expired service agreements');
    }
  }

  async reportIndexingService(project: Project) {
    const {id} = project;
    const poi = await this.queryService.getReportPoi(project);
    if (poi.blockHeight === 0) return;

    const {blockHeight, mmrRoot} = poi;
    const mmrRootLog = mmrRoot !== ZERO_BYTES32 ? `| mmrRoot: ${mmrRoot}` : '';
    const desc = `| project ${id.substring(0, 15)} | block height: ${blockHeight} ${mmrRootLog}`;

    const timestamp = await this.contractService.getBlockTime();
    const indexer = await this.accountService.getIndexer();
    await this.sendTransaction(
      `report project status`,
      async (overrides) => {
        return await this.sdk.queryRegistry.reportIndexingStatus(
          indexer,
          cidToBytes32(id.trim()),
          blockHeight,
          mmrRoot,
          timestamp,
          overrides,
        );
      },
      desc,
    );
  }

  @Cron(CronExpression.EVERY_2_HOURS)
  async reportIndexingServiceActions() {
    await this.checkControllerReady();
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

    return {currentEra, lastClaimedEra, lastSettledEra};
  }

  async canCollectRewards(): Promise<boolean> {
    const {currentEra, lastClaimedEra, lastSettledEra} = await this.geEraConfig();
    return lastClaimedEra.gt(0) && lastClaimedEra.lt(currentEra.sub(1)) && lastClaimedEra.lte(lastSettledEra);
  }

  async collectAndDistributeReward(indexer: string) {
    await this.sendTransaction('collect and distribute rewards', (overrides) =>
      this.sdk.rewardsDistributor.collectAndDistributeRewards(indexer, overrides),
    );
  }

  async batchCollectAndDistributeRewards(indexer: string, currentEra: BigNumber, lastClaimedEra: BigNumber) {
    const count = currentEra.sub(lastClaimedEra.add(1)).div(this.batchSize).toNumber() + 1;
    for (let i = 0; i < count; i++) {
      const canCollectRewards = await this.canCollectRewards();
      if (!canCollectRewards) return;

      await this.sendTransaction('batch collect and distribute rewards', (overrides) =>
        this.sdk.rewardsHelper.batchCollectAndDistributeRewards(indexer, this.batchSize, overrides),
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
      variables: {indexer, now},
    });

    return result.data.stateChannels.nodes;
  }

  collectAndDistributeRewardsAction() {
    return async () => {
      const canCollectRewards = await this.canCollectRewards();
      if (!canCollectRewards) return;

      const {currentEra, lastClaimedEra, lastSettledEra} = await this.geEraConfig();
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
      const {lastClaimedEra, lastSettledEra} = await this.geEraConfig();

      if (stakers.length === 0 || lastSettledEra.gte(lastClaimedEra)) return;

      getLogger('network').info(`new stakers ${stakers.join(',')}`);
      await this.sendTransaction('apply stake changes', async (overrides) =>
        this.sdk.rewardsHelper.batchApplyStakeChange(indexer, stakers, overrides),
      );
    };
  }

  applyICRChangeAction() {
    return async () => {
      const indexer = await this.accountService.getIndexer();
      const {currentEra, lastClaimedEra, lastSettledEra} = await this.geEraConfig();
      const icrChangEra = await this.sdk.rewardsStaking.getCommissionRateChangedEra(indexer);

      if (!icrChangEra.eq(0) && icrChangEra.lte(currentEra) && lastSettledEra.lt(lastClaimedEra)) {
        await this.sendTransaction('apply ICR changes', async (overrides) =>
          this.sdk.rewardsStaking.applyICRChange(indexer, overrides),
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
        await this.sendTransaction('update era number', async (overrides) =>
          this.sdk.eraManager.safeUpdateAndGetEra(overrides),
        );
      }
    };
  }

  closeExpiredStateChannelsAction() {
    return async () => {
      const unfinalisedPlans = await this.getExpiredStateChannels();

      for (const node of unfinalisedPlans) {
        await this.sendTransaction(`claim unfinalized plan for ${node.consumer}`, async (overrides) =>
          this.sdk.stateChannel.claim(node.id, overrides),
        );
      }
    };
  }

  private networkActions() {
    return [
      this.updateEraNumberAction(),
      this.collectAndDistributeRewardsAction(),
      this.applyICRChangeAction(),
      this.applyStakeChangesAction(),
      this.closeExpiredStateChannelsAction(),
    ];
  }

  private async checkControllerReady(): Promise<boolean> {
    const isContractReady = await this.syncContractConfig();
    if (!isContractReady) return false;

    const isBalanceSufficient = await this.contractService.hasSufficientBalance();
    if (!isBalanceSufficient) {
      getLogger('contract').warn(
        'insufficient balance for the controller account, please top up your controller account ASAP.',
      );
      return;
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async doNetworkActions() {
    const isReady = await this.checkControllerReady();
    if (!isReady) return;

    try {
      for (const action of this.networkActions()) {
        await action();
      }
    } catch (e) {
      debugLogger('network', `failed to update network: ${String(e)}`);
    }
  }
}
