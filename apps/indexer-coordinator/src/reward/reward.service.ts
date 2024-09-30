// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import assert from 'assert';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BigNumber } from 'ethers';
import { ConfigService, ConfigType } from 'src/config/config.service';
import { NetworkService } from 'src/network/network.service';
import { getLogger } from 'src/utils/logger';
import { AccountService } from '../core/account.service';
import { OnChainService } from '../core/onchain.service';
import { TxType } from '../core/types';
import { PaygService } from '../payg/payg.service';

enum Status {
  Pending = 'Pending',
  Success = 'Success',
  Failed = 'Failed',
}

export type DeploymentReduce = {
  deploymentId: string;
  toReduce: BigNumber;
  status: string;
};

@Injectable()
export class RewardService implements OnModuleInit {
  private readonly rewardThreshold = BigNumber.from('2000000000000000000000');
  private readonly oneDay = 24 * 60 * 60 * 1000;
  private readonly allocationBypassTimeLimit = 3 * this.oneDay;
  private readonly allocationStartTimes: Map<string, number> = new Map();
  private readonly channelRewardsStartTimes: Map<string, number> = new Map();

  private readonly logger = getLogger('RewardService');

  private txOngoingMap: Record<string, boolean> = {
    [this.collectAllocationRewards.name]: false,
    [this.reduceAllocation.name]: false,
    [this.collectStateChannelRewards.name]: false,
  };

  private lastSingleReduce: DeploymentReduce[] = [];
  private lastTotalReduce: BigNumber = BigNumber.from(0);

  constructor(
    private accountService: AccountService,
    private networkService: NetworkService,
    private onChainService: OnChainService,
    private paygService: PaygService,
    private configService: ConfigService
  ) {}

  onModuleInit() {
    // FIXME test only
    // (async () => {
    //   await this.collectAllocationRewards(TxType.check);
    //   await this.reduceAllocation(TxType.check);
    //   await this.collectStateChannelRewards(TxType.check);
    // })();
  }

  @Cron('1 1 1 * * *')
  async autoRunTasks() {
    await this.collectAllocationRewards(TxType.check);
    await this.collectStateChannelRewards(TxType.check);
  }

  @Cron('0 */5 * * * *)
  async triggerReduceAllocation() {
    const reduceEnabled = await this.configService.get(ConfigType.AUTO_REDUCE_ALLOCATION_ENABLED);
    if (reduceEnabled) {
      await this.reduceAllocation(TxType.check);
    }
  }

  @Cron('0 */30 * * * *')
  async checkTasks() {
    if (this.txOngoingMap[this.collectAllocationRewards.name]) {
      await this.collectAllocationRewards(TxType.postponed);
    }
    if (this.txOngoingMap[this.collectStateChannelRewards.name]) {
      await this.collectStateChannelRewards(TxType.postponed);
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
      const thresholdConfig = await this.configService.get(ConfigType.ALLOCATION_REWARD_THRESHOLD);
      const threshold = BigNumber.from(thresholdConfig);
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

    const expectTotalReduce = allocation.used.sub(allocation.total);

    let refetch = true;
    if (expectTotalReduce.eq(this.lastTotalReduce)) {
      refetch = false;
    }

    if (expectTotalReduce.gt(0)) {
      let calSingleReduce: DeploymentReduce[] = this.lastSingleReduce;

      if (refetch) {
        this.logger.debug(`==== refetch ====`);
        const deploymentAllocations = await this.networkService.getIndexerAllocationSummaries(
          indexerId
        );
        deploymentAllocations.sort((a, b) => {
          return a.totalAmount < b.totalAmount ? -1 : 1;
        });

        let calcTotalReduce = BigNumber.from(0);
        calSingleReduce = [];
        for (const d of deploymentAllocations) {
          const toReduce = expectTotalReduce.mul(d.totalAmount).div(allocation.used);
          calcTotalReduce = calcTotalReduce.add(toReduce);
          this.logger.debug(
            `take from d: ${d.deploymentId} totalAmount: ${
              d.totalAmount
            } toReduce: ${toReduce.toString()}`
          );
          calSingleReduce.push({
            deploymentId: d.deploymentId,
            toReduce,
            status: Status.Pending,
          });
        }
        let rest = expectTotalReduce.sub(calcTotalReduce);

        this.logger.debug(
          `expectTotalReduce: ${expectTotalReduce} calcTotalReduce: ${calcTotalReduce.toString()} rest: ${rest.toString()}`
        );
        this.logger.debug(`before adjust: ${calSingleReduce.map((v) => v.toReduce.toString())}`);
        for (let i = deploymentAllocations.length - 1; i >= 0; i--) {
          if (rest.eq(BigNumber.from(0))) {
            break;
          }
          const d = deploymentAllocations[i];
          if (BigNumber.from(d.totalAmount).gte(calSingleReduce[i].toReduce.add(rest))) {
            calSingleReduce[i].toReduce = calSingleReduce[i].toReduce.add(rest);
            break;
          }
          const diff = BigNumber.from(d.totalAmount).sub(calSingleReduce[i].toReduce);
          calSingleReduce[i].toReduce = calSingleReduce[i].toReduce.add(diff);
          rest = rest.sub(diff);
        }
        this.logger.debug(`after adjust: ${calSingleReduce.map((v) => v.toReduce.toString())}`);
        const adjustedTotalReduce = calSingleReduce.reduce(
          (acc, cur) => acc.add(cur.toReduce),
          BigNumber.from(0)
        );
        assert(expectTotalReduce.eq(adjustedTotalReduce));
      }

      this.lastSingleReduce = calSingleReduce;
      this.lastTotalReduce = expectTotalReduce;

      this.logger.debug(
        `before call: this.lastSingleReduce: ${calSingleReduce
          .map((v) => [v.deploymentId, v.toReduce.toString(), v.status].join(':'))
          .join(', ')}`
      );
      this.logger.debug(`before call: this.lastTotalReduce: ${this.lastTotalReduce.toString()}`);

      for (let i = 0; i < calSingleReduce.length; i++) {
        const d = calSingleReduce[i];
        if (d.status === Status.Success) continue;
        const success = await this.onChainService.removeAllocation(
          d.deploymentId,
          indexerId,
          d.toReduce,
          txType
        );
        if (!success) {
          d.status = Status.Failed;
          this.txOngoingMap[this.reduceAllocation.name] = true;
          break;
        }
        d.status = Status.Success;
        this.lastTotalReduce = this.lastTotalReduce.sub(d.toReduce);
      }

      this.logger.debug(
        `after call: this.lastSingleReduce: ${calSingleReduce
          .map((v) => [v.deploymentId, v.toReduce.toString(), v.status].join(':'))
          .join(', ')}`
      );
      this.logger.debug(`after call: this.lastTotalReduce: ${this.lastTotalReduce.toString()}`);
    }
  }

  async collectStateChannelRewards(txType: TxType) {
    this.txOngoingMap[this.collectStateChannelRewards.name] = false;

    const thresholdConfig = await this.configService.get(ConfigType.STATE_CHANNEL_REWARD_THRESHOLD);
    const threshold = BigNumber.from(thresholdConfig);

    const timeLimit = this.allocationBypassTimeLimit;
    const openChannels = await this.paygService.getOpenChannels();
    for (const channel of openChannels) {
      const unclaimed = BigNumber.from(channel.remote).sub(channel.onchain);
      if (unclaimed.lte(0)) continue;

      let startTime = this.channelRewardsStartTimes.get(channel.id);
      if (!startTime) {
        startTime = Date.now();
        this.channelRewardsStartTimes.set(channel.id, startTime);
      }

      if (unclaimed.lte(threshold) && Date.now() - startTime < timeLimit) {
        this.logger.debug(
          `Bypassed channel rewards [${unclaimed.toString()}] for channel ${channel.id} ${(
            (Date.now() - startTime) /
            this.oneDay
          ).toFixed(2)}/${timeLimit / this.oneDay} days`
        );
        continue;
      }

      try {
        await this.paygService.checkpoint(channel.id, txType);
        this.channelRewardsStartTimes.delete(channel.id);
      } catch (e) {
        this.logger.error(`Failed to checkpoint for channel ${channel.id}: ${e}`);
        this.txOngoingMap[this.collectStateChannelRewards.name] = true;
      }
    }
  }
}
