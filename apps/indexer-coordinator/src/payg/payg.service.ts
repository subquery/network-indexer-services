// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { StateChannel } from '@subql/network-query';
import { BigNumber } from 'ethers';
import { MoreThan, Repository } from 'typeorm';

import { AccountService } from '../core/account.service';
import { NetworkService } from '../core/network.service';
import { PaygEntity } from '../project/project.model';
import { SubscriptionService } from '../subscription/subscription.service';
import { getLogger } from '../utils/logger';
import { PaygEvent } from '../utils/subscription';

import { Channel, ChannelLabor, ChannelStatus } from './payg.model';
import { PaygQueryService } from './payg.query.service';

const logger = getLogger('payg');

@Injectable()
export class PaygService {
  constructor(
    @InjectRepository(Channel) private channelRepo: Repository<Channel>,
    @InjectRepository(PaygEntity) private paygRepo: Repository<PaygEntity>,
    @InjectRepository(ChannelLabor) private laborRepo: Repository<ChannelLabor>,
    private pubSub: SubscriptionService,
    private network: NetworkService,
    private account: AccountService,
    private paygQuery: PaygQueryService
  ) { }

  channel(id: string): Promise<Channel> {
    return this.channelRepo.findOneBy({ id });
  }

  async channels(): Promise<Channel[]> {
    return this.channelRepo.find();
  }

  async getAliveChannels(): Promise<Channel[]> {
    const now = Math.floor(Date.now() / 1000);

    return this.channelRepo.find({
      where: [{ lastFinal: false }, { expiredAt: MoreThan(now) }],
    });
  }

  async update(
    id: string,
    spent: string,
    isFinal: boolean,
    indexerSign: string,
    consumerSign: string
  ): Promise<Channel> {
    try {
      let channel = await this.channel(id);
      if (!channel) {
        const stateChannel = await this.paygQuery.getStateChannel(id);
        channel = await this.syncChannel(stateChannel);
      }

      if (!channel) {
        throw new Error(`channel not exist: ${id}`);
      }

      const projectPayg = await this.paygRepo.findOneBy({ id: channel.deploymentId });
      if (!projectPayg) {
        throw new Error(`project payg not exist: ${channel.deploymentId}`);
      }

      const threshold = BigInt(projectPayg.threshold);
      const currentRemote = BigInt(spent);
      const prevSpent = BigInt(channel.spent);
      const prevRemote = BigInt(channel.remote);
      const price = BigInt(channel.price);

      // add a price every time
      channel.spent = (prevSpent + price).toString();

      // if remote is less than own, just add spent
      if (prevRemote < currentRemote) {
        channel.remote = spent;
        channel.lastFinal = isFinal;
        channel.lastIndexerSign = indexerSign;
        channel.lastConsumerSign = consumerSign;
      }

      // threshold value for checkpoint and spawn to other promise.
      if ((currentRemote - BigInt(channel.onchain)) / price > threshold) {
        // send to blockchain.
        const tx = await this.network.getSdk().stateChannel.checkpoint({
          channelId: id,
          isFinal: isFinal,
          spent: channel.remote,
          indexerSign: indexerSign,
          consumerSign: consumerSign,
        });
        await tx.wait(1);
        channel.onchain = channel.remote;
        channel.spent = channel.remote;
      }

      logger.debug(`Updated state channel ${id}`);

      return this.savePub(channel, PaygEvent.State);
    } catch (e) {
      logger.error(`Failed to update state channel ${id} with error: ${e}`);
    }
  }

  async checkpoint(id: string): Promise<Channel> {
    const channel = await this.channel(id);
    if (channel.onchain === channel.remote) {
      return channel;
    }

    // checkpoint
    const tx = await this.network.getSdk().stateChannel.checkpoint({
      channelId: channel.id,
      isFinal: channel.lastFinal,
      spent: channel.remote,
      indexerSign: channel.lastIndexerSign,
      consumerSign: channel.lastConsumerSign,
    });
    await tx.wait(1);

    channel.onchain = channel.remote;
    channel.spent = channel.remote;

    logger.debug(`Checkpointed state channel ${id}`);

    return this.savePub(channel, PaygEvent.State);
  }

  async terminate(id: string): Promise<Channel> {
    const channel = await this.channel(id);
    if (channel.onchain === channel.remote) {
      return channel;
    }

    // terminate
    const tx = await this.network.getSdk().stateChannel.terminate({
      channelId: channel.id,
      isFinal: channel.lastFinal,
      spent: channel.remote,
      indexerSign: channel.lastIndexerSign,
      consumerSign: channel.lastConsumerSign,
    });
    await tx.wait(1);

    channel.status = ChannelStatus.TERMINATING;
    channel.onchain = channel.remote;
    channel.spent = channel.remote;
    channel.lastFinal = true;
    await tx.wait(1);

    logger.debug(`Terminated state channel ${id}`);

    return this.savePub(channel, PaygEvent.State);
  }

  async respond(id: string): Promise<Channel> {
    const channel = await this.channel(id);
    if (channel.onchain === channel.remote) {
      return channel;
    }

    // respond to chain
    const tx = await this.network.getSdk().stateChannel.respond({
      channelId: channel.id,
      isFinal: channel.lastFinal,
      spent: channel.spent,
      indexerSign: channel.lastIndexerSign,
      consumerSign: channel.lastConsumerSign,
    });
    await tx.wait(1);

    channel.onchain = channel.spent;
    channel.spent = channel.remote;
    channel.lastFinal = true;

    logger.debug(`Responded state channel ${id}`);

    return this.savePub(channel, PaygEvent.State);
  }

  async syncChannel(channel: StateChannel): Promise<Channel | undefined> {
    if (!channel) return;

    try {
      const id = BigNumber.from(channel.id).toString();
      const _channel = await this.channel(id);
      if (_channel) return;

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

      return channelEntity;
    } catch (e) {
      logger.error(`Failed to sync state channel ${channel.id} with error: ${e}`);
    }
  }

  async syncOpen(
    id: string,
    indexer: string,
    consumer: string,
    agent: string,
    total: string,
    price: string,
    expiredAt: number,
    deploymentId: string
  ) {
    // update the channel.
    const channel = await this.channel(id);
    if (!channel) {
      // check if self.
      const myIndexer = await this.account.getIndexer();
      if (indexer !== myIndexer) return;

      const channel = this.channelRepo.create({
        id,
        deploymentId,
        indexer,
        consumer,
        agent,
        total,
        price,
        expiredAt,
        lastIndexerSign: '',
        lastConsumerSign: '',
        status: ChannelStatus.OPEN,
        spent: '0',
        onchain: '0',
        remote: '0',
        terminatedAt: expiredAt,
        terminateByIndexer: false,
        lastFinal: false,
      });

      await this.savePub(channel, PaygEvent.Opened);
    } else {
      // update information (NOT CHANGE price and isFinal)
      channel.indexer = indexer;
      channel.consumer = consumer;
      channel.agent = agent;
      channel.total = total;
      channel.expiredAt = expiredAt;
      channel.terminatedAt = expiredAt;
      channel.deploymentId = deploymentId;
      channel.lastFinal = false;

      await this.savePub(channel, PaygEvent.State);
    }
  }

  async syncExtend(id: string, expiredAt: number) {
    const channel = await this.channel(id);
    if (!channel) return;

    channel.expiredAt = expiredAt;
    channel.terminatedAt = expiredAt;
    await this.channelRepo.save(channel);
  }

  async syncFund(id: string, total: string) {
    const channel = await this.channel(id);
    if (!channel) return;

    channel.total = total;
    await this.savePub(channel, PaygEvent.State);
  }

  async syncCheckpoint(id: string, onchain: string) {
    const channel = await this.channel(id);
    if (!channel) return;

    channel.onchain = onchain;
    await this.channelRepo.save(channel);
  }

  async syncTerminate(id: string, onchain: string, terminatedAt: number, byIndexer: boolean) {
    const channel = await this.channel(id);
    if (!channel) return;

    channel.onchain = onchain;
    channel.status = ChannelStatus.TERMINATING;
    channel.terminatedAt = terminatedAt;
    channel.terminateByIndexer = byIndexer;
    channel.lastFinal = true;

    await this.savePub(channel, PaygEvent.State);
  }

  async syncFinalize(id: string, total: BigNumber, remain: BigNumber) {
    const channel = await this.channel(id);
    if (!channel) return;

    channel.onchain = total.sub(remain).toString();
    channel.status = ChannelStatus.FINALIZED;
    channel.lastFinal = true;

    await this.savePub(channel, PaygEvent.Stopped);
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

  async savePub(channel: Channel, event: PaygEvent): Promise<Channel> {
    const new_channel = await this.channelRepo.save(channel);
    await this.pubSub.publish(event, { channelChanged: new_channel });
    return new_channel;
  }
}
