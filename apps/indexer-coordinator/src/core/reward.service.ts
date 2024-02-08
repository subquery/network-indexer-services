// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BigNumber } from 'ethers';
import { NetworkService } from 'src/network/network.service';
import { getLogger } from 'src/utils/logger';
import { AccountService } from './account.service';
import { OnChainService } from './onchain.service';

@Injectable()
export class RewardService implements OnModuleInit {
  private readonly rewardThreshold = BigNumber.from('1000000000000000000000');
  private readonly allocationBypassTimesLimit = 3;
  private readonly allocationBypassTimes: Map<string, number> = new Map();

  private readonly logger = getLogger('RewardService');

  constructor(
    private accountService: AccountService,
    private networkService: NetworkService,
    private onChainService: OnChainService
  ) {}

  onModuleInit() {
    // FIXME test only
    this.autoCollectAllocationRewards();
  }

  @Cron('0 0 1 * * *')
  async autoCollectAllocationRewards() {
    const indexerId = await this.accountService.getIndexer();
    const deploymentAllocations = await this.networkService.getIndexerAllocationSummaries(
      indexerId
    );
    for (const allocation of deploymentAllocations) {
      const rewards = await this.onChainService.getAllocationRewards(
        allocation.deploymentId,
        indexerId
      );
      if (rewards.eq(0)) {
        continue;
      }
      const threshold = this.rewardThreshold;
      const limit = this.allocationBypassTimesLimit;
      const bypassTimes = this.allocationBypassTimes.get(allocation.deploymentId) || 0;
      if (rewards.lt(threshold) && bypassTimes < limit) {
        this.allocationBypassTimes.set(allocation.deploymentId, bypassTimes + 1);
        this.logger.debug(
          `Bypassed reward for deployment ${allocation.deploymentId} ${bypassTimes + 1}/${limit}`
        );
        continue;
      }
      await this.onChainService.collectAllocationReward(allocation.deploymentId, indexerId);
      this.allocationBypassTimes.delete(allocation.deploymentId);
      this.logger.debug(
        `Collected reward for deployment ${allocation.deploymentId} ${rewards.toString()}`
      );
    }
  }
}
