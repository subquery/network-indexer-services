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
      this.sdk = await this.contractService.getSdk().isReady;

      return !!this.sdk;
    } catch {
      return false;
    }
  }

  async sendTransaction(actionName: string, txFun: () => Promise<ContractTransaction>) {
    try {
      getLogger('netwrok').info(`Sending Transaction: ${actionName}`);
      const tx = await txFun();
      await tx.wait(2);
      getLogger('netwrok').info(`Transaction Succeed: ${actionName}`);
      return;
    } catch (e) {
      getLogger('netwrok').warn(`Transaction Failed: ${actionName}`);
    }
  }

  async reportIndexingServiceActions() {
    const indexingProjects = await this.getIndexingProjects();
    if (isEmpty(indexingProjects)) return [];

    return indexingProjects.map(
      ({ id }) =>
        async () =>
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
      getLogger('tx').info(
        `try update era number: eraStartTime ${eraStartTime.toNumber()} | eraPeriod: ${eraPeriod.toNumber()}`,
      );
      if (new Date().getTime() / 1000 - eraStartTime.toNumber() > eraPeriod.toNumber()) {
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
      getLogger('tx').info(
        `collectAndDistributeRewards: currentEra: ${currentEra.toNumber()} | lastClaimedEra: ${lastClaimedEra.toNumber()} | lastSettledEra: ${lastSettledEra.toNumber()}`,
      );
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
      getLogger('tx').info(`try apply stake change: stakers ${stakers}`);
      if (stakers.length > 0 && lastSettledEra.lt(lastClaimedEra)) {
        return this.sendTransaction('apply stake changes', async () =>
          this.sdk.rewardsDistributor.applyStakeChanges(indexer, stakers),
        );
      }
    };

    return [updateEraNumber, collectAndDistributeRewards, applyICRChange, applyStakeChanges];
  }

  async getInterval() {
    const isContractReady = await this.syncContractConfig();
    if (!isContractReady) return 1000 * 3600;

    const eraPeriod = await this.sdk.eraManager.eraPeriod();
    return eraPeriod.toNumber() / 2;
  }

  periodicUpdateNetwrok() {
    const interval = 1000 * 60 * (Number(process.env.TRANSACTION_INTERVAL) ?? 2);
    setInterval(async () => {
      const isContractReady = await this.syncContractConfig();
      getLogger('tx').info(`contract ready: ${isContractReady}`);
      if (!isContractReady) return;

      const reportIndexingServiceActions = await this.reportIndexingServiceActions();
      const networkActions = await this.networkActions();
      const actions = [...networkActions, ...reportIndexingServiceActions];

      for (let i = 0; i < actions.length; i++) {
        await actions[i]();
      }
    }, interval);
  }
}
