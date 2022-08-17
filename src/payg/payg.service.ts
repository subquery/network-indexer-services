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
    total: number,
    expirationAt: number,
    deploymentId: string,
    callback: string,
    lastIndexerSign: string,
    lastConsumerSign: string,
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
      status: 0,
      spent: 0,
      onchain: 0,
      remote: 0,
      challengeAt: 0,
      lastFinal: false,
      price: 10, // TODO add price to project.
    });

    // send to blockchain.
    let tx = await this.network.getSdk().stateChannel.open(
      id,
      indexer,
      consumer,
      total,
      expirationAt,
      deploymentId,
      callback,
      lastIndexerSign,
      lastConsumerSign
    );
    console.log(tx);

    return this.channelRepo.save(channel);
  }

  async update(
    id: string,
    spent: number,
    isFinal: boolean,
    indexerSign: string,
    consumerSign: string
  ): Promise<Channel> {
    const channel = await this.channelRepo.findOne({ id });
    if (channel.spent + channel.price < spent) {
      // invalid count TODO more.
    }
    channel.spent = spent;
    channel.remote = spent;
    channel.lastFinal = isFinal;
    channel.lastIndexerSign = indexerSign;
    channel.lastConsumerSign = consumerSign;

    // TODO threshold value for checkpoint and spawn to other promise.
    if ((channel.spent - channel.onchain) / channel.price > 5) {
      // send to blockchain.
      let tx = await this.network.getSdk().stateChannel.checkpoint({
        channelId: id,
        isFinal: isFinal,
        spent: spent,
        indexerSign: indexerSign,
        consumerSign: consumerSign
      });
      console.log(tx);
      channel.onchain = channel.spent;
    }

    return this.channelRepo.save(channel);
  }

  async checkpoint(id: string): Promise<Channel> {
    const channel = await this.channelRepo.findOne({ id });

    // checkpoint
    let tx = await this.network.getSdk().stateChannel.checkpoint({
      channelId: channel.id,
      isFinal: channel.lastFinal,
      spent: channel.spent,
      indexerSign: channel.lastIndexerSign,
      consumerSign: channel.lastConsumerSign
    });
    console.log(tx);

    channel.onchain = channel.spent;
    return this.channelRepo.save(channel);
  }

  async challenge(id: string): Promise<Channel> {
    const channel = await this.channelRepo.findOne({ id });

    // challenge
    let tx = await this.network.getSdk().stateChannel.challenge({
      channelId: channel.id,
      isFinal: channel.lastFinal,
      spent: channel.spent,
      indexerSign: channel.lastIndexerSign,
      consumerSign: channel.lastConsumerSign
    });
    console.log(tx);

    channel.onchain = channel.spent;
    return this.channelRepo.save(channel);
  }

  async respond(id: string): Promise<Channel> {
    const channel = await this.channelRepo.findOne({ id });

    // challenge
    let tx = await this.network.getSdk().stateChannel.respond({
      channelId: channel.id,
      isFinal: channel.lastFinal,
      spent: channel.spent,
      indexerSign: channel.lastIndexerSign,
      consumerSign: channel.lastConsumerSign
    });
    console.log(tx);

    channel.onchain = channel.spent;
    return this.channelRepo.save(channel);
  }
}
