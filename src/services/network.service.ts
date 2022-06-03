// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Repository, Connection } from 'typeorm';
import { isEmpty } from 'lodash';
import { BigNumber } from 'ethers';
import { ContractSDK } from '@subql/contract-sdk';

import { colorText, getLogger, TextColor } from 'src/utils/logger';
import { cidToBytes32 } from 'src/utils/contractSDK';
import { AccountService } from 'src/account/account.service';
import { ZERO_BYTES32 } from 'src/utils/project';
import { Project } from 'src/project/project.model';

import { ContractService } from './contract.service';
import { IndexingStatus, Transaction, TxFun } from './types';
import { QueryService } from './query.service';
import { debugLogger } from '../utils/logger';

@Injectable()
export class NetworkService implements OnApplicationBootstrap {
  private sdk: ContractSDK;
  private retryCount: number;
  private interval: number;
  private intervalTimer: NodeJS.Timer;
  private failedTransactions: Transaction[];
  private expiredAgreements: { [key: string]: string };

  private defaultInterval = 1000 * 300;
  private defaultRetryCount = 5;
  private batchSize = 20;

  private projectRepo: Repository<Project>;

  constructor(
    private connection: Connection,
    private contractService: ContractService,
    private accountService: AccountService,
    private queryService: QueryService,
  ) {
    this.failedTransactions = [];
    this.expiredAgreements = {};

    this.projectRepo = connection.getRepository(Project);
  }

  getSdk() {
    return this.sdk;
  }

  onApplicationBootstrap() {
    this.periodicUpdateNetwrok();
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
      const agreementCount = await this.sdk.serviceAgreementRegistry.indexerSaLength(indexer);
      for (let i = 0; i < agreementCount.toNumber(); i++) {
        const agreement = await this.sdk.serviceAgreementRegistry.getServiceAgreement(indexer, i);
        const agreementExpired = await this.sdk.serviceAgreementRegistry.serviceAgreementExpired(agreement);
        if (agreementExpired) {
          Object.assign(this.expiredAgreements, { [agreement]: agreement });
        }
      }
    } catch {
      getLogger('network').info('failed to update expired service agreements');
    }
  }

  async syncContractConfig(): Promise<boolean> {
    try {
      await this.contractService.updateContractSDK();
      this.sdk = this.contractService.getSdk();

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
      await tx.wait(2);

      getLogger('transaction').info(`${colorText(actionName)}: ${colorText('SUCCEED', TextColor.GREEN)}`);

      return;
    } catch (e) {
      this.failedTransactions.push({ name: actionName, txFun, desc });
      getLogger('transaction').warn(`${colorText(actionName)}: ${colorText('FAILED', TextColor.RED)} : ${e}`);
    }
  }

  // TODO: remove expired ca with batch transaction
  async removeExpiredAgreements() {
    if (Object.keys(this.expiredAgreements).length === 0) return;

    try {
      const indexer = await this.accountService.getIndexer();
      const agreementCount = await this.sdk.serviceAgreementRegistry.indexerSaLength(indexer);
      for (let i = 0; i < agreementCount.toNumber(); i++) {
        const agreementContract = await this.sdk.serviceAgreementRegistry.getServiceAgreement(indexer, i);

        if (this.expiredAgreements[agreementContract]) {
          await this.sendTransaction(
            'remove expired service agreement',
            () => this.sdk.serviceAgreementRegistry.clearEndedAgreement(indexer, i),
            `service agreement: ${agreementContract}`,
          );

          delete this.expiredAgreements[agreementContract];
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
    await this.sendTransaction(
      `report project status`,
      async () => {
        const tx = await this.sdk.queryRegistry.reportIndexingStatus(
          cidToBytes32(id),
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

    return indexingProjects.map(
      (project) =>
        () =>
          this.reportIndexingService(project),
    );
  }

  collectAndDistributeRewards(currentEra: BigNumber, lastClaimedEra: BigNumber, lastSettledEra: BigNumber) {
    return async () => {
      if (currentEra.eq(lastClaimedEra.add(1)) && lastSettledEra.eq(lastClaimedEra)) return;

      const values = `currentEra: ${currentEra.toNumber()} | lastClaimedEra: ${lastClaimedEra.toNumber()} | lastSettledEra: ${lastSettledEra.toNumber()}`;
      getLogger('network').info(`${values}`);

      const indexer = await this.accountService.getIndexer();
      const count = currentEra.sub(lastClaimedEra.add(1)).div(this.batchSize).toNumber() + 1;

      for (let i = 0; i < count; i++) {
        await this.sendTransaction('collect and distribute rewards', () =>
          this.sdk.rewardsDistributor.batchCollectAndDistributeRewards(indexer, this.batchSize),
        );
      }
    };
  }

  async networkActions() {
    const [eraStartTime, eraPeriod, currentEra] = await Promise.all([
      this.sdk.eraManager.eraStartTime(),
      this.sdk.eraManager.eraPeriod(),
      this.sdk.eraManager.eraNumber(),
    ]);
    const updateEraNumber = async () => {
      const blockTime = await this.contractService.getBlockTime();
      const canUpdateEra = blockTime - eraStartTime.toNumber() > eraPeriod.toNumber();
      if (canUpdateEra) {
        return this.sendTransaction('update era number', () => this.sdk.eraManager.safeUpdateAndGetEra());
      }
    };

    // collect and distribute rewards
    const indexer = await this.accountService.getIndexer();
    const [lastClaimedEra, lastSettledEra, icrChangEra] = await Promise.all([
      this.sdk.rewardsDistributor.getLastClaimEra(indexer),
      this.sdk.rewardsDistributor.getLastSettledEra(indexer),
      this.sdk.rewardsDistributor.getCommissionRateChangedEra(indexer),
    ]);

    // collect and distribute rewards
    const collectAndDistributeRewards = this.collectAndDistributeRewards(
      currentEra,
      lastClaimedEra,
      lastSettledEra,
    );

    // apply ICR change
    const applyICRChange = async () => {
      if (!icrChangEra.eq(0) && icrChangEra.lte(currentEra) && lastSettledEra.lt(lastClaimedEra)) {
        return this.sendTransaction('apply ICR changes', async () =>
          this.sdk.rewardsDistributor.applyICRChange(indexer),
        );
      }
    };

    // apply stake changes
    const applyStakeChanges = async () => {
      const stakers = await this.sdk.rewardsDistributor.getPendingStakers(indexer);
      if (stakers.length > 0 && lastSettledEra.lt(lastClaimedEra)) {
        getLogger('network').info(`new stakers ${stakers}`);
        return this.sendTransaction('apply stake changes', async () =>
          this.sdk.rewardsDistributor.applyStakeChanges(indexer, stakers),
        );
      }
    };

    return [updateEraNumber, collectAndDistributeRewards, applyICRChange, applyStakeChanges];
  }

  async sendTxs() {
    try {
      const isContractReady = await this.syncContractConfig();
      debugLogger('contract', `contract sdk ready: ${isContractReady}`);
      if (!isContractReady) return;

      const isBalanceSufficient = await this.contractService.hasSufficientBalance();
      if (!isBalanceSufficient) {
        getLogger('contract').warn('insufficient balance for the controller account');
        return;
      }

      const reportIndexingServiceActions = await this.reportIndexingServiceActions();
      const networkActions = await this.networkActions();
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
      await this.periodicUpdateNetwrok();
    }
  }

  async periodicUpdateNetwrok() {
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
