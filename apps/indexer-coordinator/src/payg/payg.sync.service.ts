// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ChannelStatus, StateChannel } from '@subql/network-query';
import { BigNumber, utils } from 'ethers';
import { chunk } from 'lodash';

import { InjectRepository } from '@nestjs/typeorm';
import { AccountService } from 'src/core/account.service';
import { PaygEvent } from 'src/utils/subscription';
import { Repository } from 'typeorm';
import { ContractService } from '../core/contract.service';
import { getLogger } from '../utils/logger';
import { Channel, ChannelLabor } from './payg.model';
import { PaygQueryService } from './payg.query.service';
import { PaygService } from './payg.service';

const logger = getLogger('payg');

@Injectable()
export class PaygSyncService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(Channel) private channelRepo: Repository<Channel>,
    @InjectRepository(ChannelLabor) private laborRepo: Repository<ChannelLabor>,
    private contractService: ContractService,
    private paygQueryService: PaygQueryService,
    private paygService: PaygService,
    private account: AccountService,
  ) { }

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
        await Promise.all(batch.map((channel) => this.syncChannel(channel)));
      }
    } catch (e) {
      logger.error(`Failed to sync state channels from Subquery Project: ${e}`);
    }
  }

  async syncChannel(channel: StateChannel): Promise<void> {
    if (!channel) return;

    try {
      const id = BigNumber.from(channel.id).toString().toLowerCase();
      const _channel = await this.channelRepo.findOneBy({ id });

      // update channel price and agent
      if (_channel && _channel.price === '0') {
        _channel.agent = channel.agent;
        _channel.price = channel.price.toString();
        await this.channelRepo.save(_channel);
        return;
      };

      const {
        deployment,
        indexer,
        consumer,
        agent,
        total,
        spent,
        price,
        expiredAt,
        terminatedAt,
        terminateByIndexer,
        isFinal,
      } = channel;

      const channelObj = {
        id,
        deploymentId: deployment.id,
        indexer,
        consumer,
        agent,
        spent: spent.toString(),
        total: total.toString(),
        price: price.toString(),
        lastIndexerSign: '',
        lastConsumerSign: '',
        onchain: '0',
        remote: '0',
        status: ChannelStatus.OPEN,
        expiredAt: new Date(expiredAt).valueOf() / 1000,
        terminatedAt: new Date(terminatedAt).valueOf() / 1000,
        terminateByIndexer,
        lastFinal: isFinal,
      };

      const channelEntity = this.channelRepo.create(channelObj);
      await this.channelRepo.save(channelEntity);
      logger.debug(`Synced state channel ${id}`);
    } catch (e) {
      logger.error(`Failed to sync state channel ${channel.id} with error: ${e}`);
    }
  }

  subscribeStateChannelEvents(): void {
    const contractSDK = this.contractService.getSdk();
    const stateChannel = contractSDK.stateChannel;

    stateChannel.on(
      'ChannelOpen',
      async (channelId, indexer, consumer, total, price, expiredAt, deploymentId, callback) => {
        const hostIndexer = await this.account.getIndexer();
        if (indexer !== hostIndexer) return;

        let agent = '';
        let user = consumer;
        try {
          const consumerAddress = utils.defaultAbiCoder.decode(['address'], callback)[0] as string;
          user = consumerAddress;
          agent = consumer;
        } catch {
          logger.debug(`Channel created by user: ${consumer}`);
        }

        void this.syncOpen(
          channelId.toString(),
          agent,
          price.toString(),
          agent,
          {

          }
        );
      }
    );

    stateChannel.on('ChannelExtend', (channelId, expiredAt) => {
      void this.syncExtend(channelId.toString(), expiredAt.toNumber());
    });

    stateChannel.on('ChannelFund', (channelId, total) => {
      void this.syncFund(channelId.toString(), total.toString());
    });

    stateChannel.on('ChannelCheckpoint', (channelId, spent) => {
      void this.syncCheckpoint(channelId.toString(), spent.toString());
    });

    stateChannel.on('ChannelTerminate', (channelId, spent, terminatedAt, terminateByIndexer) => {
      void this.syncTerminate(
        channelId.toString(),
        spent.toString(),
        terminatedAt.toNumber(),
        terminateByIndexer
      );
    });

    stateChannel.on('ChannelFinalize', (channelId, total, remain) => {
      void this.syncFinalize(
        channelId.toString(),
        total,
        remain
      );
    });

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    stateChannel.on('ChannelLabor', async (deploymentId, indexer, amount) => {
      const chainLastBlock = await this.contractService.getLastBlockNumber();
      await this.syncLabor(deploymentId, indexer, amount.toString(), chainLastBlock);
    });
  }


  /// functions called by contract event listener
  async syncOpen(
    id: string,
    agent: string,
    price: string,
  ) {
    const channel = await this.paygService.channel(id);
    if (channel) return;

    channel.agent = agent;
    channel.price = price;
    await this.paygService.savePub(channel, PaygEvent.Opened);
  }

  async syncExtend(id: string, expiredAt: number) {
    const channel = await this.paygService.channel(id);
    if (!channel) return;

    channel.expiredAt = expiredAt;
    channel.terminatedAt = expiredAt;
    await this.paygService.savePub(channel, PaygEvent.State);
  }

  async syncFund(id: string, total: string) {
    const channel = await this.paygService.channel(id);
    if (!channel) return;

    channel.total = total;
    await this.paygService.savePub(channel, PaygEvent.State);
  }

  async syncCheckpoint(id: string, onchain: string) {
    const channel = await this.paygService.channel(id);
    if (!channel) return;

    channel.onchain = onchain;
    await this.paygService.savePub(channel, PaygEvent.State);
  }

  async syncTerminate(id: string, onchain: string, terminatedAt: number, byIndexer: boolean) {
    const channel = await this.paygService.channel(id);
    if (!channel) return;

    channel.onchain = onchain;
    channel.status = ChannelStatus.TERMINATING;
    channel.terminatedAt = terminatedAt;
    channel.terminateByIndexer = byIndexer;
    channel.lastFinal = true;

    await this.paygService.savePub(channel, PaygEvent.State);
  }

  async syncFinalize(id: string, total: BigNumber, remain: BigNumber) {
    const channel = await this.paygService.channel(id);
    if (!channel) return;

    channel.onchain = total.sub(remain).toString();
    channel.status = ChannelStatus.FINALIZED;
    channel.lastFinal = true;

    await this.paygService.savePub(channel, PaygEvent.Stopped);
  }

  async syncLabor(deploymentId: string, indexer: string, total: string, createdAt: number) {
    const labor = this.laborRepo.create({
      deploymentId: deploymentId,
      indexer: indexer,
      total: total,
      createdAt: createdAt,
    });
    await this.laborRepo.save(labor);
  }

}
