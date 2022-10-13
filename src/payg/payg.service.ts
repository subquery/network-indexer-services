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
import { AccountService } from 'src/account/account.service';

import { Channel, ChannelStatus, ChannelLabor } from './payg.model';

@Injectable()
export class PaygService {
  constructor(
    @InjectRepository(Channel) private channelRepo: Repository<Channel>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(ChannelLabor) private laborRepo: Repository<ChannelLabor>,
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

  async open(
    id: string,
    indexer: string,
    consumer: string,
    total: string,
    expiration: number,
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
      expiredAt: expiration,
      lastIndexerSign,
      lastConsumerSign,
      status: ChannelStatus.OPEN,
      spent: '0',
      onchain: '0',
      remote: '0',
      terminatedAt: 0,
      terminateByIndexer: false,
      lastFinal: true, // until receive open event.
      price,
    });
    // send to blockchain.
    const rawDeployment = cidToBytes32(deploymentId);
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

    if (channel.lastFinal) {
      return null;
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
      this.network.getSdk().stateChannel.checkpoint({
          channelId: id,
          isFinal: isFinal,
          spent: channel.remote,
          indexerSign: indexerSign,
          consumerSign: consumerSign,
      }).then(function (tx) {
        console.log(tx);
      });
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

  async terminate(id: string): Promise<Channel> {
    const channel = await this.channelRepo.findOne({ id });
    if (channel.onchain == channel.remote) {
      return null;
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

    channel.onchain = channel.remote;
    channel.spent = channel.remote;
    channel.lastFinal = true;
    return this.channelRepo.save(channel);
  }

  async respond(id: string): Promise<Channel> {
    const channel = await this.channelRepo.findOne({ id });
    if (channel.onchain == channel.remote) {
      return null;
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
    return this.channelRepo.save(channel);
  }

  async sync_open(
    id: string,
    indexer: string,
    consumer: string,
    total: string,
    expiredAt: number,
    deploymentId: string,
  ){
    // update the channel.
    const channel = await this.channelRepo.findOne({ id });
    if (!channel) {
      // check if self.
      const myIndexer = await this.account.getIndexer();
      if (indexer != myIndexer) {
        return;
      }
      const project = await this.projectRepo.findOne({ id: deploymentId });
      if (!project || project.paygPrice == '' || project.paygPrice == '0') {
        return;
      }
      const channel = this.channelRepo.create({
        id,
        deploymentId,
        indexer,
        consumer,
        total,
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
        price: project.paygPrice,
      });
      this.channelRepo.save(channel);
    } else {
      // update information (NOT CHANGE price and isFinal)
      channel.indexer = indexer;
      channel.consumer = consumer;
      channel.total = total;
      channel.expiredAt = expiredAt;
      channel.terminatedAt = expiredAt;
      channel.deploymentId = deploymentId;

      this.channelRepo.save(channel);
    }
  }

  async sync_extend(id: string,  expiredAt: number){
    const channel = await this.channelRepo.findOne({ id });
    channel.expiredAt = expiredAt;
    channel.terminatedAt = expiredAt;
    this.channelRepo.save(channel);
  }

  async sync_fund(id: string,  total: string){
    const channel = await this.channelRepo.findOne({ id });
    channel.total = total;
    this.channelRepo.save(channel);
  }

  async sync_checkpoint(id: string, onchain: string){
    const channel = await this.channelRepo.findOne({ id });
    channel.onchain = onchain;
    this.channelRepo.save(channel);
  }

  async sync_terminate(id: string, onchain: string, terminatedAt: number, byIndexer: boolean){
    const channel = await this.channelRepo.findOne({ id });
    channel.onchain = onchain;
    channel.status = ChannelStatus.TERMINATING;
    channel.terminatedAt = terminatedAt;
    channel.terminateByIndexer = byIndexer;
    this.channelRepo.save(channel);
  }

  async sync_finalize(id: string, total: number, remain: number){
    const channel = await this.channelRepo.findOne({ id });
    channel.onchain = (total - remain).toString();
    channel.status = ChannelStatus.FINALIZED;
    this.channelRepo.save(channel);
  }

  async sync_labor(
    deploymentId: string,
    indexer: string,
    total: string,
    createdAt: number
  ){
    const labor = this.laborRepo.create({
      deploymentId: deploymentId,
      indexer: indexer,
      total: total,
      createdAt: createdAt,
    })
    this.laborRepo.save(labor);
  }
}
