// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';

import { NetworkService } from 'src/services/network.service';
import { SubscriptionService } from 'src/subscription/subscription.service';
import { getLogger } from 'src/utils/logger';
import { PaygEvent } from 'src/utils/subscription';
import { Config } from 'src/configure/configure.module';
import { PaygEntity } from 'src/project/project.model';
import { AccountService } from 'src/account/account.service';

import { Channel, ChannelStatus, ChannelLabor } from './payg.model';

@Injectable()
export class PaygService {
  constructor(
    @InjectRepository(Channel) private channelRepo: Repository<Channel>,
    @InjectRepository(PaygEntity) private paygRepo: Repository<PaygEntity>,
    @InjectRepository(ChannelLabor) private laborRepo: Repository<ChannelLabor>,
    private pubSub: SubscriptionService,
    private config: Config,
    private network: NetworkService,
    private account: AccountService,
  ) {}

  async channel(id: string): Promise<Channel> {
    return this.channelRepo.findOne({ id });
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

  async open(
    id: string,
    indexer: string,
    consumer: string,
    total: string,
    deploymentId: string,
    price: string,
  ): Promise<Channel> {
    const channel = this.channelRepo.create({
      id,
      deploymentId,
      indexer,
      consumer,
      total,
      expiredAt: 0,
      lastIndexerSign: '',
      lastConsumerSign: '',
      status: ChannelStatus.OPEN,
      spent: '0',
      onchain: '0',
      remote: '0',
      terminatedAt: 0,
      terminateByIndexer: false,
      lastFinal: true, // until receive open event.
      price,
    });

    return this.channelRepo.save(channel);
  }

  async update(
    id: string,
    spent: string,
    isFinal: boolean,
    indexerSign: string,
    consumerSign: string,
  ): Promise<Channel> {
    const channel = await this.channelRepo.findOne({ id });
    const projectPayg = await this.paygRepo.findOne({ id: channel.deploymentId });
    if (!channel || !projectPayg) {
      getLogger('channel or project').error(`channel or project not exist: ${id}`);
      return;
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
      this.network
        .getSdk()
        .stateChannel.checkpoint({
          channelId: id,
          isFinal: isFinal,
          spent: channel.remote,
          indexerSign: indexerSign,
          consumerSign: consumerSign,
        })
        .then(function (tx) {
          console.log(tx);
        });
      channel.onchain = channel.remote;
      channel.spent = channel.remote;
    }

    return this.save_pub(channel, PaygEvent.State);
  }

  async checkpoint(id: string): Promise<Channel> {
    const channel = await this.channelRepo.findOne({ id });
    if (channel.onchain == channel.remote) {
      return;
    }

    // checkpoint
    const tx = await this.network.getSdk().stateChannel.checkpoint({
      channelId: channel.id,
      isFinal: channel.lastFinal,
      spent: channel.remote,
      indexerSign: channel.lastIndexerSign,
      consumerSign: channel.lastConsumerSign,
    });
    console.log(tx);

    channel.onchain = channel.remote;
    channel.spent = channel.remote;

    return this.save_pub(channel, PaygEvent.State);
  }

  async terminate(id: string): Promise<Channel> {
    const channel = await this.channelRepo.findOne({ id });
    if (channel.onchain == channel.remote) {
      return;
    }

    // terminate
    const tx = await this.network.getSdk().stateChannel.terminate({
      channelId: channel.id,
      isFinal: channel.lastFinal,
      spent: channel.remote,
      indexerSign: channel.lastIndexerSign,
      consumerSign: channel.lastConsumerSign,
    });
    console.log(tx);

    channel.status = ChannelStatus.TERMINATING;
    channel.onchain = channel.remote;
    channel.spent = channel.remote;
    channel.lastFinal = true;

    return this.save_pub(channel, PaygEvent.State);
  }

  async respond(id: string): Promise<Channel> {
    const channel = await this.channelRepo.findOne({ id });
    if (channel.onchain == channel.remote) {
      return;
    }

    // respond to chain
    const tx = await this.network.getSdk().stateChannel.respond({
      channelId: channel.id,
      isFinal: channel.lastFinal,
      spent: channel.spent,
      indexerSign: channel.lastIndexerSign,
      consumerSign: channel.lastConsumerSign,
    });
    console.log(tx);

    channel.onchain = channel.spent;
    channel.spent = channel.remote;
    channel.lastFinal = true;

    return this.save_pub(channel, PaygEvent.State);
  }

  async sync_channel(
    id: string,
    deploymentId: string,
    indexer: string,
    consumer: string,
    total: string,
    spent: string,
    price: string,
    expiredAt: number,
    terminatedAt: number,
    terminateByIndexer: boolean,
    lastFinal: boolean,
  ) {
    const channel = await this.channelRepo.findOne({ id });
    if (!channel) {
      const channel = this.channelRepo.create({
        id,
        deploymentId,
        indexer,
        consumer,
        total,
        price,
        expiredAt,
        lastIndexerSign: '',
        lastConsumerSign: '',
        status: ChannelStatus.OPEN,
        spent,
        onchain: '0',
        remote: '0',
        terminatedAt,
        terminateByIndexer,
        lastFinal,
      });

      this.channelRepo.save(channel);
    }
  }

  async sync_open(
    id: string,
    indexer: string,
    consumer: string,
    total: string,
    price: string,
    expiredAt: number,
    deploymentId: string,
  ) {
    // update the channel.
    const channel = await this.channelRepo.findOne({ id });
    if (!channel) {
      // check if self.
      const myIndexer = await this.account.getIndexer();
      if (indexer != myIndexer) {
        return;
      }
      const channel = this.channelRepo.create({
        id,
        deploymentId,
        indexer,
        consumer,
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

      this.save_pub(channel, PaygEvent.Opened);
    } else {
      // update information (NOT CHANGE price and isFinal)
      channel.indexer = indexer;
      channel.consumer = consumer;
      channel.total = total;
      channel.expiredAt = expiredAt;
      channel.terminatedAt = expiredAt;
      channel.deploymentId = deploymentId;
      channel.lastFinal = false;

      this.save_pub(channel, PaygEvent.State);
    }
  }

  async sync_extend(id: string, expiredAt: number) {
    const channel = await this.channelRepo.findOne({ id });
    channel.expiredAt = expiredAt;
    channel.terminatedAt = expiredAt;
    this.channelRepo.save(channel);
  }

  async sync_fund(id: string, total: string) {
    const channel = await this.channelRepo.findOne({ id });
    channel.total = total;

    this.save_pub(channel, PaygEvent.State);
  }

  async sync_checkpoint(id: string, onchain: string) {
    const channel = await this.channelRepo.findOne({ id });
    channel.onchain = onchain;
    this.channelRepo.save(channel);
  }

  async sync_terminate(id: string, onchain: string, terminatedAt: number, byIndexer: boolean) {
    const channel = await this.channelRepo.findOne({ id });
    channel.onchain = onchain;
    channel.status = ChannelStatus.TERMINATING;
    channel.terminatedAt = terminatedAt;
    channel.terminateByIndexer = byIndexer;
    channel.lastFinal = true;

    this.save_pub(channel, PaygEvent.State);
  }

  async sync_finalize(id: string, total: number, remain: number) {
    const channel = await this.channelRepo.findOne({ id });
    channel.onchain = (total - remain).toString();
    channel.status = ChannelStatus.FINALIZED;
    channel.lastFinal = true;

    this.save_pub(channel, PaygEvent.Stopped);
  }

  async sync_labor(deploymentId: string, indexer: string, total: string, createdAt: number) {
    const labor = this.laborRepo.create({
      deploymentId: deploymentId,
      indexer: indexer,
      total: total,
      createdAt: createdAt,
    });
    this.laborRepo.save(labor);
  }

  async save_pub(channel: Channel, event: PaygEvent): Promise<Channel> {
    const new_channel = await this.channelRepo.save(channel);
    this.pubSub.publish(event, { channelChanged: new_channel });
    return new_channel;
  }
}
