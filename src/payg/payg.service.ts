// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';

import { NetworkService } from 'src/services/network.service';
import { getLogger } from 'src/utils/logger';
import { Config } from 'src/configure/configure.module';

import { Channel } from './payg.model';

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
    balance: number,
    expirationAt: number,
    lastIndexerSign: string,
    lastConsumerSign: string,
  ): Promise<Channel> {
    const channel = this.channelRepo.create({
      id,
      indexer,
      consumer,
      balance,
      expirationAt,
      lastIndexerSign,
      lastConsumerSign,
      status: 0,
      currentCount: 0,
      onchainCount: 0,
      remoteCount: 0,
      challengeAt: 0,
      lastFinal: false,
      lastPrice: 10, // TODO add price to project.
    });

    // send to blockchain.
    let tx = await this.network.getSdk().stateChannel.open(
      id,
      indexer,
      consumer,
      balance,
      expirationAt,
      lastIndexerSign,
      lastConsumerSign
    );
    console.log(tx);

    return this.channelRepo.save(channel);
  }

  async update(
    id: string,
    count: number,
    isFinal: boolean,
    price: number,
    indexerSign: string,
    consumerSign: string
  ): Promise<Channel> {
    const channel = await this.channelRepo.findOne({ id });
    if (channel.currentCount != count - 1 || channel.lastPrice != price) {
      // invalid count TODO more.
    }
    channel.currentCount = count;
    channel.lastFinal = isFinal;
    channel.lastPrice = price;
    channel.lastIndexerSign = indexerSign;
    channel.lastConsumerSign = consumerSign;

    // TODO threshold value for checkpoint and spawn to other promise.
    if (count % 5 == 0) {
      // send to blockchain.
      let tx = await this.network.getSdk().stateChannel.checkpoint({
        channelId: id,
        isFinal: isFinal,
        count: count,
        price: price,
        indexerSign: indexerSign,
        consumerSign: consumerSign
      });
      console.log(tx);
    }

    return this.channelRepo.save(channel);
  }

  async checkpoint(id: string): Promise<Channel> {
    const channel = await this.channelRepo.findOne({ id });

    // checkpoint
    let tx = await this.network.getSdk().stateChannel.checkpoint({
      channelId: channel.id,
      isFinal: channel.lastFinal,
      count: channel.currentCount,
      price: channel.lastPrice,
      indexerSign: channel.lastIndexerSign,
      consumerSign: channel.lastConsumerSign
    });
    console.log(tx);

    channel.onchainCount = channel.currentCount;
    return this.channelRepo.save(channel);
  }

  async challenge(id: string): Promise<Channel> {
    const channel = await this.channelRepo.findOne({ id });

    // challenge
    let tx = await this.network.getSdk().stateChannel.challenge({
      channelId: channel.id,
      isFinal: channel.lastFinal,
      count: channel.currentCount,
      price: channel.lastPrice,
      indexerSign: channel.lastIndexerSign,
      consumerSign: channel.lastConsumerSign
    });
    console.log(tx);

    channel.onchainCount = channel.currentCount;
    return this.channelRepo.save(channel);
  }

  async respond(id: string): Promise<Channel> {
    const channel = await this.channelRepo.findOne({ id });

    // challenge
    let tx = await this.network.getSdk().stateChannel.respond({
      channelId: channel.id,
      isFinal: channel.lastFinal,
      count: channel.currentCount,
      price: channel.lastPrice,
      indexerSign: channel.lastIndexerSign,
      consumerSign: channel.lastConsumerSign
    });
    console.log(tx);

    channel.onchainCount = channel.currentCount;
    return this.channelRepo.save(channel);
  }
}
