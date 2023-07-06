// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ContractSDK } from '@subql/contract-sdk';
import { cidToBytes32, GraphqlQueryClient, NETWORK_CONFIGS } from '@subql/network-clients';
import {
  GetIndexerUnfinalisedPlans,
  GetIndexerUnfinalisedPlansQuery,
  GetIndexerUnfinalisedPlansQueryVariables,
} from '@subql/network-query';
import { BigNumber } from 'ethers';
import { isEmpty } from 'lodash';
import { Connection, Repository } from 'typeorm';

import { Config } from '../configure/configure.module';
import { Project, ProjectEntity } from '../project/project.model';
import { colorText, debugLogger, getLogger, TextColor } from '../utils/logger';
import { ZERO_BYTES32 } from '../utils/project';

import { mutexPromise } from '../utils/promise';
import { AccountService } from './account.service';
import { ContractService } from './contract.service';
import { QueryService } from './query.service';
import { IndexingStatus, TxFun } from './types';

const MAX_RETRY = 3;

const logger = getLogger('transaction');

function wrapAndIgnoreError<T>(promiseFunc: () => Promise<T>, desc: string): () => Promise<T | void> {
  return () => {
    logger.debug(`${desc}: start`);
    return promiseFunc().then(
      (res: T) => {
        logger.debug(`${desc}: done`);
        return res;
      },
      (e) => {
        logger.error(e, `${desc}: failed`);
        return;
      },
    );
  };
}

@Injectable()
export class NetworkService implements OnApplicationBootstrap {
  private sdk: ContractSDK;
  private client: GraphqlQueryClient;
  private expiredAgreements: Set<string> = new Set();

  private batchSize = 20;

  private projectRepo: Repository<ProjectEntity>;

  constructor(
    private connection: Connection,
    private contractService: ContractService,
    private accountService: AccountService,
    private queryService: QueryService,
    private readonly config: Config,
  ) {
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
        const { status } = await this.contractService.deploymentStatusByIndexer(project.id, indexer);
        project.status = status;
        return await this.projectRepo.save(project);
      }),
    );

    return indexingProjects.filter(
      ({ queryEndpoint, status }) =>
        !isEmpty(queryEndpoint) && [IndexingStatus.INDEXING, IndexingStatus.READY].includes(status),
    );
  }

  private async updateExpiredAgreements() {
    logger.debug(`updateExpiredAgreements start`);
    const indexer = await this.accountService.getIndexer();
    const agreementCount = await this.sdk.serviceAgreementRegistry.indexerCsaLength(indexer);
    for (let i = 0; i < agreementCount.toNumber(); i++) {
      const agreementId = await this.sdk.serviceAgreementRegistry.closedServiceAgreementIds(indexer, i);
      const agreementExpired = await this.sdk.serviceAgreementRegistry.closedServiceAgreementExpired(
        agreementId,
      );

      if (agreementExpired) {
        this.expiredAgreements.add(agreementId.toString());
      }
    }
    logger.debug(
      `updateExpiredAgreements end. expiredAgreements: ${Array.from(this.expiredAgreements).join(',')}`,
    );
  }

  async syncContractConfig(): Promise<boolean> {
    try {
      this.sdk = await this.contractService.updateContractSDK();
      return !!this.sdk;
    } catch (e) {
      logger.error(e, 'syncContractConfig');
      return false;
    }
  }

  @mutexPromise()
  async sendTransaction(actionName: string, txFun: TxFun, desc = '') {
    await this._sendTransaction(actionName, txFun, desc);
  }

  private async _sendTransaction(actionName: string, txFun: TxFun, desc = '', retries = 0) {
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
        await this._sendTransaction(actionName, txFun, desc, retries + 1);
      } else {
        logger.warn(e, `${colorText(actionName)}: ${colorText('FAILED', TextColor.RED)}`);
        throw e;
      }
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async removeExpiredAgreements() {
    logger.debug(`removeExpiredAgreements start`);
    if (!(await this.checkControllerReady())) return;
    try {
      await this.updateExpiredAgreements();
    } catch {
      getLogger('network').error('failed to update expired service agreements');
    }
    if (this.expiredAgreements.size === 0) return;

    try {
      const indexer = await this.accountService.getIndexer();
      const agreementCount = await this.sdk.serviceAgreementRegistry.indexerCsaLength(indexer);
      for (let i = 0; i < agreementCount.toNumber(); i++) {
        const agreementId = await this.sdk.serviceAgreementRegistry
          .closedServiceAgreementIds(indexer, i)
          .then((id) => id.toNumber());

        if (this.expiredAgreements.has(agreementId.toString())) {
          await this.sendTransaction(
            'remove expired service agreement',
            (overrides) => this.sdk.serviceAgreementRegistry.clearEndedAgreement(indexer, i, overrides),
            `service agreement: ${agreementId}`,
          );

          this.expiredAgreements.delete(agreementId.toString());
          break;
        }
      }
    } catch {
      getLogger('network').info('failed to remove expired service agreements');
    }
    logger.debug(`removeExpiredAgreements end`);
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
    logger.debug(`reportIndexingServiceActions start`);
    if (!(await this.checkControllerReady())) return;
    const indexingProjects = await this.getIndexingProjects();
    logger.debug(`indexingProjects ${indexingProjects.length}`);
    if (isEmpty(indexingProjects)) return [];
    try {
      await Promise.all(indexingProjects.map((project) => this.reportIndexingService(project)));
    } catch (e) {
      logger.error(e, `reportIndexingServiceActions failed`);
    }
    logger.debug(`reportIndexingServiceActions end`);
  }

  async hasPendingChanges(indexer: string) {
    const icrChangEra = await this.sdk.rewardsStaking.getCommissionRateChangedEra(indexer);
    const stakers = await this.sdk.rewardsHelper.getPendingStakers(indexer);
    return !isEmpty(stakers) || !icrChangEra.eq(0);
  }

  async getEraConfig() {
    const indexer = await this.accountService.getIndexer();
    const [currentEra, rewardInfo, lastSettledEra] = await Promise.all([
      this.sdk.eraManager.eraNumber(),
      this.sdk.rewardsDistributor.getRewardInfo(indexer),
      this.sdk.rewardsStaking.getLastSettledEra(indexer),
    ]);

    return { currentEra, lastClaimedEra: rewardInfo.lastClaimEra, lastSettledEra };
  }

  canCollectRewards(currentEra: BigNumber, lastClaimedEra: BigNumber, lastSettledEra: BigNumber): boolean {
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
      variables: { indexer, now },
    });

    return result.data.stateChannels.nodes;
  }

  collectAndDistributeRewardsAction() {
    return async () => {
      const { currentEra, lastClaimedEra, lastSettledEra } = await this.getEraConfig();
      const canCollectRewards = this.canCollectRewards(currentEra, lastClaimedEra, lastSettledEra);
      if (!canCollectRewards) return;

      getLogger('network').info(
        `currentEra: ${currentEra.toNumber()} | lastClaimedEra: ${lastClaimedEra.toNumber()} | lastSettledEra: ${lastSettledEra.toNumber()}`,
      );

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
      const { lastClaimedEra, lastSettledEra } = await this.getEraConfig();

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
      const { currentEra, lastClaimedEra, lastSettledEra } = await this.getEraConfig();
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
      wrapAndIgnoreError(this.updateEraNumberAction(), 'updateEraNumberAction'),
      wrapAndIgnoreError(this.collectAndDistributeRewardsAction(), 'collectAndDistributeRewardsAction'),
      wrapAndIgnoreError(this.applyICRChangeAction(), 'applyICRChangeAction'),
      wrapAndIgnoreError(this.applyStakeChangesAction(), 'applyStakeChangesAction'),
      wrapAndIgnoreError(this.closeExpiredStateChannelsAction(), 'closeExpiredStateChannelsAction'),
    ];
  }

  private async checkControllerReady(): Promise<boolean> {
    const isContractReady = await this.syncContractConfig();
    logger.debug(`syncContractConfig: ${String(isContractReady)}`);
    if (!isContractReady) return false;

    const maintenance = await this.sdk.eraManager.maintenance();
    if (maintenance) return false;

    const isBalanceSufficient = await this.contractService.hasSufficientBalance();
    if (!isBalanceSufficient) {
      getLogger('contract').warn(
        'insufficient balance for the controller account, please top up your controller account ASAP.',
      );
      return false;
    }
    logger.debug(`checkControllerReady: ready`);
    return true;
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async doNetworkActions() {
    if (!(await this.checkControllerReady())) return;

    try {
      for (const action of this.networkActions()) {
        await action();
      }
    } catch (e) {
      debugLogger('network', `failed to update network: ${String(e)}`);
    }
  }
}
