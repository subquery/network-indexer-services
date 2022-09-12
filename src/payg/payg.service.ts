// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { cidToBytes32 } from '@subql/network-clients';

import { NetworkService } from 'src/services/network.service';
import { getLogger } from 'src/utils/logger';
import { Config } from 'src/configure/configure.module';
import { Project } from 'src/project/project.model';

import { Channel, ChannelStatus } from './payg.model';

@Injectable()
export class PaygService {
  constructor(
    @InjectRepository(Channel) private channelRepo: Repository<Channel>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
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
    const rawDeployment = cidToBytes32(deploymentId);
    const tx = await this.network
      .getSdk()
      .stateChannel.open(
        id,
        indexer,
        consumer,
        total,
        expirationAt,
        rawDeployment,
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
    const project = await this.projectRepo.findOne({ id: channel.deploymentId });
    if (!channel || !project) {
      getLogger('channel or project').error(`channel or project not exist: ${id}`);
      return;
    }

    const current_remote = BigInt(spent);
    const prev_spent = BigInt(channel.spent);
    const prev_remote = BigInt(channel.remote);
    const price = BigInt(channel.price);
    const max = BigInt(project.paygOverflow);
    const threshold = BigInt(project.paygThreshold);
    if (prev_remote + price > current_remote) {
      getLogger('StateChannel').warn('Price invalid');
      return null;
    }
    if (prev_spent > prev_remote + price * max) {
      getLogger('StateChannel').warn('overflow the conflict');
      return null;
    }
    if (current_remote >= BigInt(channel.total) + price) {
      getLogger('StateChannel').warn('overflow the total');
      return null;
    }

    channel.spent = (prev_spent + (current_remote - prev_remote)).toString();
    channel.remote = spent;
    channel.lastFinal = isFinal;
    channel.lastIndexerSign = indexerSign;
    channel.lastConsumerSign = consumerSign;

    // threshold value for checkpoint and spawn to other promise.
    if ((current_remote - BigInt(channel.onchain)) / price > threshold) {
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
    if (channel.onchain == channel.remote) {
      return null;
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
    return this.channelRepo.save(channel);
  }

  async challenge(id: string): Promise<Channel> {
    const channel = await this.channelRepo.findOne({ id });
    if (channel.onchain == channel.remote) {
      return null;
    }

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
    if (channel.onchain == channel.remote) {
      return null;
    }

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
