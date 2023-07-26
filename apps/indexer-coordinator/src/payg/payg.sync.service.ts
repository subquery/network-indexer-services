// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { utils } from 'ethers';
import { chunk } from 'lodash';

import { ContractService } from '../core/contract.service';
import { getLogger } from '../utils/logger';
import { PaygQueryService } from './payg.query.service';
import { PaygService } from './payg.service';

const logger = getLogger('payg');

@Injectable()
export class PaygSyncService implements OnApplicationBootstrap {
  constructor(
    private contractService: ContractService,
    private paygQueryService: PaygQueryService,
    private paygServicee: PaygService
  ) {}

  onApplicationBootstrap() {
    void (() => {
      this.subscribeStateChannelEvents();
    })();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async syncStateChannelsPeriodically() {
    try {
      logger.debug(`load from Subquery Project...`);
      const channels = await this.paygQueryService.getStateChannels();

      for (const batch of chunk(channels, 10)) {
        await Promise.all(batch.map((channel) => this.paygServicee.syncChannel(channel)));
      }
    } catch (e) {
      logger.error(`Failed to sync state channels from Subquery Project: ${e}`);
    }
  }

  subscribeStateChannelEvents(): void {
    const contractSDK = this.contractService.getSdk();
    const stateChannel = contractSDK.stateChannel;

    stateChannel.on(
      'ChannelOpen',
      (channelId, indexer, consumer, total, price, expiredAt, deploymentId, callback) => {
        let agent = '';
        let user = consumer;
        try {
          const consumerAddress = utils.defaultAbiCoder.decode(['address'], callback)[0] as string;
          user = consumerAddress;
          agent = consumer;
        } catch {
          logger.debug(`Channel created by user: ${consumer}`);
        }

        void this.paygServicee.syncOpen(
          channelId.toString(),
          indexer,
          user,
          agent,
          total.toString(),
          price.toString(),
          expiredAt.toNumber(),
          deploymentId
        );
      }
    );

    stateChannel.on('ChannelExtend', (channelId, expiredAt) => {
      void this.paygServicee.syncExtend(channelId.toString(), expiredAt.toNumber());
    });

    stateChannel.on('ChannelFund', (channelId, total) => {
      void this.paygServicee.syncFund(channelId.toString(), total.toString());
    });

    stateChannel.on('ChannelCheckpoint', (channelId, spent) => {
      void this.paygServicee.syncCheckpoint(channelId.toString(), spent.toString());
    });

    stateChannel.on('ChannelTerminate', (channelId, spent, terminatedAt, terminateByIndexer) => {
      void this.paygServicee.syncTerminate(
        channelId.toString(),
        spent.toString(),
        terminatedAt.toNumber(),
        terminateByIndexer
      );
    });

    stateChannel.on('ChannelFinalize', (channelId, total, remain) => {
      void this.paygServicee.syncFinalize(
        channelId.toString(),
        total,
        remain
      );
    });

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    stateChannel.on('ChannelLabor', async (deploymentId, indexer, amount) => {
      const chainLastBlock = await this.contractService.getLastBlockNumber();
      await this.paygServicee.syncLabor(deploymentId, indexer, amount.toString(), chainLastBlock);
    });
  }
}
