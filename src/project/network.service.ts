// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { isEmpty } from 'lodash';

import { ProjectService } from './project.service';
import { getLogger } from 'src/utils/logger';
import { ContractService } from './contract.service';
import { IndexingStatus } from './types';
import { cidToBytes32 } from 'src/utils/contractSDK';
import { ContractSDK } from '@subql/contract-sdk';
import { ContractTransaction } from 'ethers';
import { AccountService } from 'src/account/account.service';
import { QueryService } from './query.service';

@Injectable()
export class NetworkService implements OnApplicationBootstrap {
  private sdk: ContractSDK;
  private retryCount: number;
  private interval: number;
  private intervalTimer: NodeJS.Timer;

  constructor(
    private projectService: ProjectService,
    private contractService: ContractService,
    private accountService: AccountService,
    private queryService: QueryService,
  ) { }

  onApplicationBootstrap() {
    this.periodicUpdateNetwrok();
  }

  async getIndexingProjects() {
    const projects = await this.projectService.getProjects();
    const indexingProjects = await Promise.all(
      projects.map(async ({ id }) => {
        const status = await this.contractService.deploymentStatusByIndexer(id);
        const project = await this.projectService.updateProjectStatus(id, status);
        return project;
      }),
    );

    return indexingProjects.filter(
      ({ queryEndpoint, status }) =>
        !isEmpty(queryEndpoint) && [IndexingStatus.INDEXING, IndexingStatus.READY].includes(status),
    );
  }

  async reportIndexingService(id: string) {
    // TODO: extract `mmrRoot` should get from query endpoint `_por`;
    const mmrRoot = '0xab3921276c8067fe0c82def3e5ecfd8447f1961bc85768c2a56e6bd26d3c0c55';
    const metadata = await this.queryService.getQueryMetaData(id);
    if (!metadata) return;

    const timestamp = await this.contractService.getBlockTime();

    await this.sendTransaction(
      `report status for project ${id} | time: ${timestamp} | block height: ${metadata.lastProcessedHeight}`,
      async () => {
        const tx = await this.sdk.queryRegistry.reportIndexingStatus(
          cidToBytes32(id),
          metadata.lastProcessedHeight,
          mmrRoot,
          timestamp,
        );
        return tx;
      },
    );
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

  async sendTransaction(actionName: string, txFun: () => Promise<ContractTransaction>) {
    try {
      getLogger('transaction').info(`Sending Transaction: ${actionName}`);
      const tx = await txFun();
      await tx.wait(2);
      getLogger('transaction').info(`Transaction Succeed: ${actionName}`);
      return;
    } catch (e) {
      getLogger('transaction').warn(`Transaction Failed: ${actionName}`);
    }
  }

  async reportIndexingServiceActions() {
    const indexingProjects = await this.getIndexingProjects();
    if (isEmpty(indexingProjects)) return [];

    return indexingProjects.map(
      ({ id }) =>
        () =>
          this.reportIndexingService(id),
    );
  }

  // TODO: check wallet balances before sending the transaction
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
        return this.sendTransaction('update era number', () =>
          this.sdk.eraManager.safeUpdateAndGetEra(),
        );
      }
    };

    // collect and distribute rewards
    const indexer = await this.accountService.getIndexer();
    const [lastClaimedEra, lastSettledEra, icrChangEra] = await Promise.all([
      this.sdk.rewardsDistributor.getLastClaimEra(indexer),
      this.sdk.rewardsDistributor.getLastSettledEra(indexer),
      this.sdk.rewardsDistributor.getCommissionRateChangedEra(indexer),
    ]);
    const collectAndDistributeRewards = async () => {
      const values = `${currentEra.toNumber()} | lastClaimedEra: ${lastClaimedEra.toNumber()} lastSettledEra: ${lastSettledEra.toNumber()}`;
      getLogger('transaction').info(`try to collectAndDistributeRewards: currentEra: ${values}`);
      if (currentEra.gt(lastClaimedEra.add(1)) && lastSettledEra.gte(lastClaimedEra)) {
        return this.sendTransaction('collect and distribute rewards', () =>
          this.sdk.rewardsDistributor.collectAndDistributeRewards(indexer),
        );
      }
    };

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
      getLogger('transaction').info(`try to apply stake change: stakers ${stakers}`);
      if (stakers.length > 0 && lastSettledEra.lt(lastClaimedEra)) {
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
      getLogger('contract').info(`contract sdk ready: ${isContractReady}`);
      if (!isContractReady) return;

      const reportIndexingServiceActions = await this.reportIndexingServiceActions();
      const networkActions = await this.networkActions();
      const actions = [...networkActions, ...reportIndexingServiceActions];

      for (let i = 0; i < actions.length; i++) {
        await actions[i]();
      }
    } catch (e) {
      getLogger('contract').error(`failed to update network: ${e}`);
      getLogger('transaction').info(`retry to send transactions`);

      if (this.retryCount !== 0) {
        await this.sendTxs();
        this.retryCount--;
      }
    }
  }

  async getInterval() {
    if (process.env.TRANSACTION_INTERVAL) {
      return 1000 * Number(process.env.TRANSACTION_INTERVAL);
    }

    const defaultInterval = 1000 * 1800;
    try {
      const isContractReady = await this.syncContractConfig();
      if (!isContractReady) return defaultInterval;

      const eraPeriod = await this.sdk.eraManager.eraPeriod();
      return (eraPeriod.toNumber() * 1000) / 30;
    } catch {
      return defaultInterval;
    }
  }

  async updateInterval() {
    const interval = await this.getInterval();
    if (interval !== this.interval && this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = undefined;

      getLogger('transaction').info(
        `transactions interval change from ${this.interval} to ${interval}`,
      );

      this.interval = interval;
      await this.periodicUpdateNetwrok();
    }
  }

  async periodicUpdateNetwrok() {
    if (!this.interval) {
      this.interval = await this.getInterval();
      getLogger('transaction').info(`transaction interval: ${this.interval}`);
    }

    this.intervalTimer = setInterval(async () => {
      this.retryCount = 5;
      await this.updateInterval();
      await this.sendTxs();
    }, this.interval);
  }
}
