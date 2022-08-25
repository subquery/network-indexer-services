// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';

import { NetworkService } from 'src/services/network.service';
import { getLogger } from 'src/utils/logger';
import { Config } from 'src/configure/configure.module';

import { Channel, ChannelStatus } from './payg.model';

const MAX = BigInt(5);
const THRESHOLD = BigInt(1000);

@Injectable()
export class PaygService {
  constructor(
    @InjectRepository(Channel) private channelRepo: Repository<Channel>,
    private config: Config,
    private network: NetworkService,
  ) {}

  async channel(id: string): Promise<Channel> {
    return this.channelRepo.findOne({ id });
  }

  async channels(): Promise<Channel[]> {
    return this.channelRepo.find();
  }

  async open(
    id: string,
    indexer: string,
    consumer: string,
    total: string,
    expirationAt: number,
    deploymentId: string,
    callback: string,
    lastIndexerSign: string,
    lastConsumerSign: string,
    price: string,
  ): Promise<Channel> {
    const channel = this.channelRepo.create({
      id,
      deploymentId,
      indexer,
      consumer,
      total,
      expirationAt,
      lastIndexerSign,
      lastConsumerSign,
      status: ChannelStatus.OPEN,
      spent: '0',
      onchain: '0',
      remote: '0',
      challengeAt: 0,
      lastFinal: false,
      price,
    });

    // send to blockchain.
    const tx = await this.network
      .getSdk()
      .stateChannel.open(
        id,
        indexer,
        consumer,
        total,
        expirationAt,
        deploymentId,
        callback,
        lastIndexerSign,
        lastConsumerSign,
      );
    console.log(tx);

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
    const current_remote = BigInt(spent);
    const prev_spent = BigInt(channel.spent);
    const prev_remote = BigInt(channel.remote);
    const price = BigInt(channel.price);
    if (prev_remote + price < current_remote) {
      return null;
    }
    if (prev_spent > prev_remote + price * MAX) {
      return null;
    }

    channel.spent = (prev_spent + (current_remote - prev_remote)).toString();
    channel.remote = spent;
    channel.lastFinal = isFinal;
    channel.lastIndexerSign = indexerSign;
    channel.lastConsumerSign = consumerSign;

    // TODO  threshold value for checkpoint and spawn to other promise.
    if ((current_remote - BigInt(channel.onchain)) / price > THRESHOLD) {
      // send to blockchain.
      const tx = await this.network.getSdk().stateChannel.checkpoint({
        channelId: id,
        isFinal: isFinal,
        spent: channel.remote,
        indexerSign: indexerSign,
        consumerSign: consumerSign,
      });
      console.log(tx);
      channel.onchain = channel.remote;
      channel.spent = channel.remote;
    }

    return this.channelRepo.save(channel);
  }

  async checkpoint(id: string): Promise<Channel> {
    const channel = await this.channelRepo.findOne({ id });

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
    return this.channelRepo.save(channel);
  }

  async challenge(id: string): Promise<Channel> {
    const channel = await this.channelRepo.findOne({ id });

    // challenge
    const tx = await this.network.getSdk().stateChannel.challenge({
      channelId: channel.id,
      isFinal: channel.lastFinal,
      spent: channel.remote,
      indexerSign: channel.lastIndexerSign,
      consumerSign: channel.lastConsumerSign,
    });
    console.log(tx);

    channel.onchain = channel.remote;
    channel.spent = channel.remote;
    return this.channelRepo.save(channel);
  }

  async respond(id: string): Promise<Channel> {
    const channel = await this.channelRepo.findOne({ id });

    // challenge
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
    return this.channelRepo.save(channel);
  }
}
