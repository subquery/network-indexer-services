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
  private readonly rewardThreshold = BigNumber.from('2000000000000000000000');
  private readonly oneDay = 24 * 60 * 60 * 1000;
  private readonly allocationBypassTimeLimit = 3 * this.oneDay;
  private readonly allocationStartTimes: Map<string, number> = new Map();

  private readonly logger = getLogger('RewardService');

  private txOngoingMap: Record<string, boolean> = {
    [this.collectAllocationRewards.name]: false,
    [this.reduceAllocation.name]: false,
  };

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
  async autoRunTasks() {
    await this.collectAllocationRewards(TxType.check);
    await this.reduceAllocation(TxType.check);
  }

  @Cron('0 */30 * * * *')
  async checkTasks() {
    if (this.txOngoingMap[this.collectAllocationRewards.name]) {
      await this.collectAllocationRewards(TxType.postponed);
    }
    if (this.txOngoingMap[this.reduceAllocation.name]) {
      await this.reduceAllocation(TxType.postponed);
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
    this.txOngoingMap[this.collectAllocationRewards.name] = false;
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
        this.txOngoingMap[this.collectAllocationRewards.name] = true;
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

  async reduceAllocation(txType: TxType) {
    const indexerId = await this.accountService.getIndexer();
    if (!indexerId) {
      return;
    }
    const allocation = await this.onChainService.getRunnerAllocation(indexerId);
    this.txOngoingMap[this.reduceAllocation.name] = false;

    if (allocation?.total.lt(allocation.used)) {
      const deploymentAllocations = await this.networkService.getIndexerAllocationSummaries(
        indexerId
      );
      deploymentAllocations.sort((a, b) => {
        return a.totalAmount < b.totalAmount ? -1 : 1;
      });

      const denominator = allocation.used;
      const denominatorLength = allocation.used.toString().length;

      const expectTotalReduce = allocation.used.sub(allocation.total);

      let calcTotalReduce = BigNumber.from(0);
      const calSingleReduce = [];
      for (const d of deploymentAllocations) {
        let calc = BigNumber.from(d.totalAmount)
          .mul(BigNumber.from(10).pow(denominatorLength + 4))
          .div(denominator);

        calc = expectTotalReduce.mul(calc).div(BigNumber.from(10).pow(denominatorLength + 4));
        calcTotalReduce = calcTotalReduce.add(calc);

        this.logger.debug(
          `take from d: ${d.deploymentId} totalAmount: ${d.totalAmount} calc: ${calc.toString()}`
        );
        calSingleReduce.push(calc);
      }
      let rest = expectTotalReduce.sub(calcTotalReduce);

      this.logger.debug(
        `expectTotalReduce: ${expectTotalReduce} calcTotalReduce: ${calcTotalReduce.toString()} rest: ${rest.toString()}`
      );
      this.logger.debug(`before adjust: ${calSingleReduce.map((v) => v.toString())}`);
      for (let i = deploymentAllocations.length - 1; i >= 0; i--) {
        if (rest.eq(BigNumber.from(0))) {
          break;
        }
        const d = deploymentAllocations[i];
        if (BigNumber.from(d.totalAmount).gte(calSingleReduce[i].add(rest))) {
          calSingleReduce[i] = calSingleReduce[i].add(rest);
          break;
        }
        const diff = BigNumber.from(d.totalAmount).sub(calSingleReduce[i]);
        calSingleReduce[i] = calSingleReduce[i].add(diff);
        rest = rest.sub(diff);
      }
      this.logger.debug(
        'after adjust:',
        calSingleReduce.map((v) => v.toString())
      );

      for (let i = 0; i < deploymentAllocations.length; i++) {
        const d = deploymentAllocations[i];
        const success = await this.onChainService.removeAllocation(
          d.deploymentId,
          indexerId,
          calSingleReduce[i],
          txType
        );
        if (!success) {
          this.txOngoingMap[this.reduceAllocation.name] = true;
          break;
        }
      }
    }
  }
}
