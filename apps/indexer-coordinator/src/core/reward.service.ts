// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BigNumber } from 'ethers';
import { NetworkService } from 'src/network/network.service';
import { getLogger } from 'src/utils/logger';
import { AccountService } from './account.service';
import { OnChainService } from './onchain.service';
import { TxType } from './types';

@Injectable()
export class RewardService implements OnModuleInit {
  private readonly rewardThreshold = BigNumber.from('1000000000000000000000');
  private readonly oneDay = 24 * 60 * 60 * 1000;
  private readonly allocationBypassTimeLimit = 3 * this.oneDay;
  private readonly allocationStartTimes: Map<string, number> = new Map();

  private readonly logger = getLogger('RewardService');

  private txOngoing = false;

  constructor(
    private accountService: AccountService,
    private networkService: NetworkService,
    private onChainService: OnChainService
  ) {}

  onModuleInit() {
    // FIXME test only
    // this.collectAllocationRewards();
  }

  @Cron('1 1 1 * * *')
  async autoCollectAllocationRewards() {
    await this.collectAllocationRewards(TxType.check);
  }

  @Cron('0 */30 * * * *')
  async checkCollectAllocationRewards() {
    if (this.txOngoing) {
      await this.collectAllocationRewards(TxType.postponed);
    }
  }

  async collectAllocationRewards(txType: TxType) {
    const indexerId = await this.accountService.getIndexer();
    if (!indexerId) {
      return;
    }
    const deploymentAllocations = await this.networkService.getIndexerAllocationSummaries(
      indexerId
    );
    this.txOngoing = false;
    for (const allocation of deploymentAllocations) {
      const rewards = await this.onChainService.getAllocationRewards(
        allocation.deploymentId,
        indexerId
      );
      if (rewards.eq(0)) {
        continue;
      }
      const threshold = this.rewardThreshold;
      const timeLimit = this.allocationBypassTimeLimit;
      let startTime = this.allocationStartTimes.get(allocation.deploymentId);
      if (!startTime) {
        startTime = Date.now();
        this.allocationStartTimes.set(allocation.deploymentId, startTime);
      }
      if (rewards.lt(threshold) && Date.now() - startTime < timeLimit) {
        this.logger.debug(
          `Bypassed reward [${rewards.toString()}] for deployment ${allocation.deploymentId} ${(
            (Date.now() - startTime) /
            this.oneDay
          ).toFixed(2)}/${timeLimit / this.oneDay} days`
        );
        continue;
      }
      const success = await this.onChainService.collectAllocationReward(
        allocation.deploymentId,
        indexerId,
        txType
      );
      if (!success) {
        this.txOngoing = true;
        continue;
      }
      this.allocationStartTimes.delete(allocation.deploymentId);
      this.logger.debug(
        `Collected reward [${rewards.toString()}] for deployment ${
          allocation.deploymentId
        } ${rewards.toString()}`
      );
    }
  }
}
