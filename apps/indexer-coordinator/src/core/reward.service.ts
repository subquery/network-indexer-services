// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NetworkService } from 'src/network/network.service';
import { AccountService } from './account.service';
import { ContractService } from './contract.service';

@Injectable()
export class RewardService implements OnModuleInit {
  constructor(
    private contractService: ContractService,
    private accountService: AccountService,
    private networkService: NetworkService
  ) {}

  onModuleInit() {
    // FIXME test only
    this.autoClaimAllocationRewards();
  }

  @Cron('0 0 1 * * *')
  async autoClaimAllocationRewards() {
    const deployments = await this.networkService.getDeploymentsWithAllocation();
    const indexerId = await this.accountService.getIndexer();
    for (const deployment of deployments) {
      const rewards = await this.contractService.getAllocationRewards(deployment.id, indexerId);
      if (rewards.eq(0)) {
        continue;
      }
      await this.contractService.claimAllocationRewards(deployment.id, indexerId);
    }
  }
}
