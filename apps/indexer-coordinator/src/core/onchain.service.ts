// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ContractSDK } from '@subql/contract-sdk';
import { cidToBytes32 } from '@subql/network-clients';
import { BigNumber } from 'ethers';
import { isEmpty } from 'lodash';
import { NetworkService } from 'src/network/network.service';
import { ChannelStatus } from '../payg/payg.model';
import { debugLogger, getLogger } from '../utils/logger';
import { AccountService } from './account.service';
import { ContractService } from './contract.service';
import { TxType } from './types';

const logger = getLogger('transaction');

function wrapAndIgnoreError<T>(
  promiseFunc: () => Promise<T>,
  desc: string
): () => Promise<T | void> {
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
      }
    );
  };
}

@Injectable()
export class OnChainService implements OnApplicationBootstrap {
  private sdk: ContractSDK;

  private batchSize = 20;

  constructor(
    private contractService: ContractService,
    private accountService: AccountService,
    private networkService: NetworkService
  ) {}

  onApplicationBootstrap() {
    void (async () => {
      await this.doNetworkActions();
    })();
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

  // async getIndexingProjects() {
  //   const indexer = await this.accountService.getIndexer();
  //   const projects = await this.projectRepo.find();
  //   const indexingProjects = await Promise.all(
  //     projects.map(async (project) => {
  //       const status = await this.contractService.deploymentStatusByIndexer(
  //         project.id,
  //         indexer
  //       );
  //       project.status = status;
  //       return await this.projectRepo.save(project);
  //     })
  //   );

  //   return indexingProjects.filter(
  //     ({ queryEndpoint, status }) =>
  //       !isEmpty(queryEndpoint) && [DesiredStatus.RUNNING].includes(status)
  //   );
  // }

  async syncContractConfig(): Promise<boolean> {
    try {
      this.sdk = await this.contractService.updateContractSDK();
      return !!this.sdk;
    } catch (e) {
      logger.error(e, 'syncContractConfig');
      return false;
    }
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

  canCollectRewards(
    currentEra: BigNumber,
    lastClaimedEra: BigNumber,
    lastSettledEra: BigNumber
  ): boolean {
    return (
      lastClaimedEra.gt(0) &&
      lastClaimedEra.lt(currentEra.sub(1)) &&
      lastClaimedEra.lte(lastSettledEra)
    );
  }

  async collectAndDistributeReward(indexer: string) {
    await this.contractService.sendTransaction({
      action: `collect and distribute rewards for ${indexer}`,
      type: TxType.check,
      txFun: (overrides) =>
        this.sdk.rewardsDistributor.collectAndDistributeRewards(indexer, overrides),
      gasFun: (overrides) =>
        this.sdk.rewardsDistributor.estimateGas.collectAndDistributeRewards(indexer, overrides),
    });
  }

  async batchCollectAndDistributeRewards(
    indexer: string,
    currentEra: BigNumber,
    lastClaimedEra: BigNumber
  ) {
    const count = currentEra.sub(lastClaimedEra.add(1)).div(this.batchSize).toNumber() + 1;
    for (let i = 0; i < count; i++) {
      await this.contractService.sendTransaction({
        action: `batch collect and distribute rewards for ${indexer}`,
        type: TxType.check,
        txFun: (overrides) =>
          this.sdk.rewardsHelper.batchCollectAndDistributeRewards(
            indexer,
            this.batchSize,
            overrides
          ),
        gasFun: (overrides) =>
          this.sdk.rewardsHelper.estimateGas.batchCollectAndDistributeRewards(
            indexer,
            this.batchSize,
            overrides
          ),
      });
    }
  }

  collectAndDistributeRewardsAction() {
    return async () => {
      const { currentEra, lastClaimedEra, lastSettledEra } = await this.getEraConfig();
      const canCollectRewards = this.canCollectRewards(currentEra, lastClaimedEra, lastSettledEra);
      if (!canCollectRewards) return;

      getLogger('network').info(
        `currentEra: ${currentEra.toNumber()} | lastClaimedEra: ${lastClaimedEra.toNumber()} | lastSettledEra: ${lastSettledEra.toNumber()}`
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
      await this.contractService.sendTransaction({
        action: `apply stake changes for ${indexer}`,
        type: TxType.check,
        txFun: (overrides) =>
          this.sdk.rewardsHelper.batchApplyStakeChange(indexer, stakers, overrides),
        gasFun: (overrides) =>
          this.sdk.rewardsHelper.estimateGas.batchApplyStakeChange(indexer, stakers, overrides),
      });
    };
  }

  applyICRChangeAction() {
    return async () => {
      const indexer = await this.accountService.getIndexer();
      const { currentEra, lastClaimedEra, lastSettledEra } = await this.getEraConfig();
      const icrChangEra = await this.sdk.rewardsStaking.getCommissionRateChangedEra(indexer);

      if (!icrChangEra.eq(0) && icrChangEra.lte(currentEra) && lastSettledEra.lt(lastClaimedEra)) {
        await this.contractService.sendTransaction({
          action: `apply ICR change for ${indexer}`,
          type: TxType.check,
          txFun: (overrides) => this.sdk.rewardsStaking.applyICRChange(indexer, overrides),
          gasFun: (overrides) =>
            this.sdk.rewardsStaking.estimateGas.applyICRChange(indexer, overrides),
        });
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
        await this.contractService.sendTransaction({
          action: 'update era number',
          type: TxType.go,
          txFun: (overrides) => this.sdk.eraManager.safeUpdateAndGetEra(overrides),
        });
      }
    };
  }

  closeExpiredStateChannelsAction() {
    return async () => {
      const unfinalisedPlans = await this.networkService.getExpiredStateChannels(
        await this.accountService.getIndexer()
      );

      for (const node of unfinalisedPlans) {
        const channel = await this.sdk.stateChannel.channel(node.id);
        const { status, terminatedAt } = channel;
        const now = Math.floor(Date.now() / 1000);

        // TODO terminate
        // const isOpenChannelClaimable = status === ChannelStatus.OPEN && expiredAt.lt(now);
        const isTerminateChannelClaimable =
          status === ChannelStatus.TERMINATING && terminatedAt.lt(now);
        if (!isTerminateChannelClaimable) continue;
        await this.contractService.sendTransaction({
          action: `claim unfinalized plan for ${node.consumer} ${node.id}`,
          type: TxType.check,
          txFun: (overrides) => this.sdk.stateChannel.claim(node.id, overrides),
          gasFun: (overrides) => this.sdk.stateChannel.estimateGas.claim(node.id, overrides),
        });
      }
    };
  }

  private networkActions() {
    return [
      wrapAndIgnoreError(this.updateEraNumberAction(), 'updateEraNumberAction'),
      wrapAndIgnoreError(
        this.collectAndDistributeRewardsAction(),
        'collectAndDistributeRewardsAction'
      ),
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
        'insufficient balance for the controller account, please top up your controller account ASAP.'
      );
      return false;
    }
    logger.debug(`checkControllerReady: ready`);
    return true;
  }

  async getAllocationRewards(deploymentId: string, runner: string): Promise<BigNumber> {
    if (!(await this.checkControllerReady())) return BigNumber.from(0);
    try {
      const [rewards, burnt] = await this.sdk.rewardsBooster.getAllocationRewards(
        cidToBytes32(deploymentId),
        runner
      );
      logger.debug(
        `allocation rewards for deployment: ${deploymentId} is ${rewards}, burnt: ${burnt}`
      );
      return rewards;
    } catch (e) {
      logger.warn(e, `Fail to get allocation rewards for deployment: ${deploymentId}`);
      return BigNumber.from(0);
    }
  }

  async collectAllocationReward(
    deploymentId: string,
    runner: string,
    txType: TxType
  ): Promise<boolean> {
    if (!(await this.checkControllerReady())) return;
    try {
      await this.contractService.sendTransaction({
        action: `collect allocation rewards for deployment: ${deploymentId}`,
        type: txType,
        txFun: (overrides) =>
          this.sdk.rewardsBooster.collectAllocationReward(
            cidToBytes32(deploymentId),
            runner,
            overrides
          ),
        gasFun: (overrides) =>
          this.sdk.rewardsBooster.estimateGas.collectAllocationReward(
            cidToBytes32(deploymentId),
            runner,
            overrides
          ),
      });
      return true;
    } catch (e) {
      logger.warn(e, `Fail to claim allocation rewards for deployment: ${deploymentId}`);
      return false;
    }
  }

  async startProject(projectId: string, runner: string): Promise<void> {
    if (!(await this.checkControllerReady())) throw new Error('Controller not ready');
    try {
      await this.contractService.sendTransaction({
        action: `start project: ${projectId}`,
        type: TxType.go,
        wait: 5,
        txFun: (overrides) =>
          this.sdk.projectRegistry.startService2(cidToBytes32(projectId), runner, overrides),
      });
    } catch (e) {
      logger.warn(e, `Fail to start project: ${projectId}`);
      throw new Error(`Fail to start project: ${projectId}`);
    }
  }

  async stopProject(projectId: string, runner: string): Promise<void> {
    if (!(await this.checkControllerReady())) throw new Error('Controller not ready');
    try {
      await this.contractService.sendTransaction({
        action: `stop project: ${projectId}`,
        type: TxType.go,
        wait: 5,
        txFun: (overrides) =>
          this.sdk.projectRegistry.stopService2(cidToBytes32(projectId), runner, overrides),
      });
    } catch (e) {
      logger.warn(e, `Fail to stop project: ${projectId}`);
      throw new Error(`Fail to stop project: ${projectId}`);
    }
  }
}
