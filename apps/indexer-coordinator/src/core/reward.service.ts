// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NetworkService } from 'src/network/network.service';
import { AccountService } from './account.service';
import { OnChainService } from './onchain.service';

@Injectable()
export class RewardService implements OnModuleInit {
  constructor(
    private accountService: AccountService,
    private networkService: NetworkService,
    private onChainService: OnChainService
  ) {}

  onModuleInit() {
    // FIXME test only
    this.autoClaimAllocationRewards();
  }

  @Cron('0 0 1 * * *')
  async autoClaimAllocationRewards() {
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
      await this.onChainService.claimAllocationRewards(allocation.deploymentId, indexerId);
    }
  }
}
