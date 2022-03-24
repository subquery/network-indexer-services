// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { isEmpty } from 'lodash';

import { ProjectService } from './project.service';
import { getLogger } from 'src/utils/logger';
import { ContractService } from './contract.service';
import { IndexingStatus } from './types';
import { cidToBytes32 } from 'src/utils/contractSDK';
import { ContractSDK } from '@subql/contract-sdk';
import { ContractTransaction, Wallet } from 'ethers';
import { AccountService } from 'src/account/account.service';
import { QueryService } from './query.service';

@Injectable()
export class NetworkService {
  private wallet: Wallet;
  private sdk: ContractSDK;

  constructor(
    private projectService: ProjectService,
    private contractService: ContractService,
    private accountService: AccountService,
    private queryService: QueryService,
  ) {
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

    await this.sendTransaction(
      `report status for project ${id} ${metadata.lastProcessedHeight}`,
      async () => {
        const tx = await this.sdk.queryRegistry.reportIndexingStatus(
          cidToBytes32(id),
          metadata.lastProcessedHeight,
          mmrRoot,
          Date.now() - 1000,
          {
            gasLimit: '10000000',
          },
        );
        return tx;
      },
    );
  }

  async syncContractConfig(): Promise<boolean> {
    try {
      await this.contractService.updateContractSDK();
      this.sdk = await this.contractService.getSdk().isReady;
      this.wallet = this.contractService.getWallet();

      return this.wallet && !!this.sdk;
    } catch {
      return false;
    }
  }

  async sendTransaction(actionName: string, txFun: () => Promise<ContractTransaction>) {
    try {
      getLogger('netwrok').info(`Sending Transaction: ${actionName}`);
      const tx = await txFun();
      await tx.wait(5);
      getLogger('netwrok').info(`Transaction Succeed: ${actionName}`);
      return;
    } catch (e) {
      getLogger('netwrok').warn(`Transaction Failed: ${actionName}`);

      if (actionName.includes('report status for projec')) {
        getLogger('netwrok').error(`Transaction Failed: ${actionName}`, e);
      }
    }
  }

  async reportIndexingServiceActions() {
    const isContractReady = await this.syncContractConfig();
    if (!isContractReady) return [];

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
    const isContractReady = await this.syncContractConfig();
    if (!isContractReady) return [];

    const updateEraNumber = () =>
      this.sendTransaction('update era number', () => this.sdk.eraManager.safeUpdateAndGetEra());

    // collect and distribute rewards
    const indexer = await this.accountService.getIndexer();
    const collectAndDistributeRewards = () =>
      this.sendTransaction('collect and distribute rewards', () =>
        this.sdk.rewardsDistributor.collectAndDistributeRewards(indexer),
      );

    // apply ICR change
    const applyICRChange = () =>
      this.sendTransaction('apply ICR changes', async () =>
        this.sdk.rewardsDistributor.applyICRChange(indexer),
      );

    // apply stake changes
    const stakers = await this.sdk.rewardsDistributor.getPendingStakers(indexer);
    const applyStakeChanges = () =>
      this.sendTransaction('apply stake changes', async () =>
        this.sdk.rewardsDistributor.applyStakeChanges(indexer, stakers),
      );

    return [updateEraNumber, collectAndDistributeRewards, applyICRChange, applyStakeChanges];
  }

  async getInterval() {
    const isContractReady = await this.syncContractConfig();
    if (!isContractReady) return 1000 * 60;

    const eraPeriod = await this.sdk.eraManager.eraPeriod();
    return Number(eraPeriod.toString());
  }

  periodicUpdateNetwrok() {
    const interval = 1000 * 60 * 20;
    setInterval(async () => {
      // const reportIndexingServiceActions = await this.reportIndexingServiceActions();
      const networkActions = await this.networkActions();
      const actions = [...networkActions];

      for (let i = 0; i < actions.length; i++) {
        await actions[i]();
      }
    }, interval);
  }
}
