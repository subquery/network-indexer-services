// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { StateChannel as StateChannelOnChain } from '@subql/network-clients';
import { StateChannel as StateChannelOnNetwork } from '@subql/network-query';
import { BigNumber, utils } from 'ethers';

import { AccountService } from 'src/core/account.service';
import { PaygEvent } from 'src/utils/subscription';
import { Repository } from 'typeorm';
import { ContractService } from '../core/contract.service';
import { getLogger } from '../utils/logger';
import { Channel, ChannelLabor, ChannelStatus } from './payg.model';
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
    private account: AccountService
  ) {}

  private syncingStateChannels = false;

  onApplicationBootstrap() {
    void (() => {
      this.subscribeStateChannelEvents();
    })();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async syncStateChannelsPeriodically() {
    if (this.syncingStateChannels) {
      logger.debug(`Bypass syncing state channels...`);
      return;
    }
    this.syncingStateChannels = true;

    syncing: {
      try {
        logger.debug(`Syncing state channels from Subquery Project...`);
        const hostIndexer = await this.account.getIndexer();
        if (!hostIndexer) {
          logger.debug(`Indexer not found, will sync state channel later...`);
          break syncing;
        }
        const stateChannels = await this.paygQueryService.getStateChannels(hostIndexer);
        const localAliveChannels = await this.paygService.getChannelsForSync();

        const stateChannelIds = stateChannels.map((stateChannel) => stateChannel.id);
        const localAliveChannelIds = localAliveChannels.map((channel) => channel.id);

        const mappedLocalAliveChannels: Record<string, Channel> = {};
        for (const channel of localAliveChannels) {
          mappedLocalAliveChannels[channel.id] = channel;
        }

        const closedChannelIds = localAliveChannelIds.filter((id) => !stateChannelIds.includes(id));
        for (const id of closedChannelIds) {
          if (BigNumber.from(id).toHexString().toLowerCase() !== id) {
            await this.channelRepo.delete(id);
            continue;
          }
          if (mappedLocalAliveChannels[id].status === ChannelStatus.FINALIZED) {
            continue;
          }
          await this.paygService.syncChannel(
            id,
            BigNumber.from(mappedLocalAliveChannels[id].price)
          );
        }

        for (const stateChannel of stateChannels) {
          const id = stateChannel.id;
          if (this.compareChannel(mappedLocalAliveChannels[id], stateChannel)) {
            logger.debug(`State channel is up to date: ${id}`);
            continue;
          }
          await this.paygService.syncChannel(id, BigNumber.from(stateChannel.price), stateChannel);
        }

        logger.debug(`Synced state channels from Subquery Project`);
      } catch (e) {
        logger.error(`Failed to sync state channels from Subquery Project: ${e}`);
      }
    }

    this.syncingStateChannels = false;
  }

  compareChannel(channel: Channel, channelState: StateChannelOnNetwork): boolean {
    if (!channel || !channelState) return false;

    const { status, agent, total, spent, price } = channelState;

    return (
      channel.status === ChannelStatus[status] &&
      channel.agent === agent &&
      channel.total === total.toString() &&
      channel.onchain === spent.toString() &&
      channel.price === price.toString()
    );
  }

  subscribeStateChannelEvents(): void {
    const contractSDK = this.contractService.getSdk();
    const stateChannel = contractSDK.stateChannel;

    stateChannel.on(
      'ChannelOpen',
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      async (
        channelId: BigNumber,
        indexer: string,
        _consumer: string,
        total: BigNumber,
        price: BigNumber,
        expiredAt: BigNumber,
        deploymentId: string,
        callback: string
      ) => {
        const hostIndexer = await this.account.getIndexer();
        if (indexer !== hostIndexer) return;

        let [agent, consumer] = ['', _consumer];
        try {
          consumer = utils.defaultAbiCoder.decode(['address'], callback)[0] as string;
          agent = _consumer;
        } catch {
          logger.debug(`Channel created by user: ${consumer}`);
        }

        const channelState: StateChannelOnChain.ChannelStateStructOutput = {
          status: ChannelStatus.OPEN,
          indexer: indexer,
          consumer: _consumer,
          total: total,
          spent: BigNumber.from(0),
          expiredAt: expiredAt,
          terminatedAt: expiredAt,
          deploymentId: deploymentId,
          terminateByIndexer: false,
        } as StateChannelOnChain.ChannelStateStructOutput;

        void this.syncOpen(
          channelId.toHexString().toLowerCase(),
          channelState,
          price.toString(),
          consumer
        );
      }
    );

    stateChannel.on('ChannelExtend', (channelId, expiredAt) => {
      void this.syncExtend(channelId.toHexString().toLowerCase(), expiredAt.toNumber());
    });

    stateChannel.on('ChannelFund', (channelId, total) => {
      void this.syncFund(channelId.toHexString().toLowerCase(), total.toString());
    });

    stateChannel.on('ChannelCheckpoint', (channelId, spent) => {
      void this.syncCheckpoint(channelId.toHexString().toLowerCase(), spent.toString());
    });

    stateChannel.on('ChannelTerminate', (channelId, spent, terminatedAt, terminateByIndexer) => {
      void this.syncTerminate(
        channelId.toHexString().toLowerCase(),
        spent.toString(),
        terminatedAt.toNumber(),
        terminateByIndexer
      );
    });

    stateChannel.on('ChannelFinalize', (channelId, total, remain) => {
      void this.syncFinalize(channelId.toHexString().toLowerCase(), total, remain);
    });

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    stateChannel.on('ChannelLabor', async (deploymentId, indexer, amount) => {
      const chainLastBlock = await this.contractService.getLastBlockNumber();
      await this.syncLabor(deploymentId, indexer, amount.toString(), chainLastBlock);
    });
  }

  async syncOpen(
    id: string,
    channelState: StateChannelOnChain.ChannelStateStructOutput,
    price: string,
    consumer: string
  ) {
    const channel = await this.paygService.updateChannelFromContract(
      id,
      channelState,
      price,
      consumer
    );
    if (!channel) return;

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
