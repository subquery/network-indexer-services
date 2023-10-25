// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { StateChannel, bytes32ToCid } from '@subql/network-clients';
import { ZERO_ADDRESS } from 'src/utils/project';
import { MoreThan, Repository } from 'typeorm';

import { NetworkService } from '../core/network.service';
import { PaygEntity } from '../project/project.model';
import { SubscriptionService } from '../subscription/subscription.service';
import { getLogger } from '../utils/logger';
import { PaygEvent } from '../utils/subscription';
import { AccountService } from './../core/account.service';

import { Channel, ChannelStatus } from './payg.model';

export type ChannelState = StateChannel.ChannelStateStructOutput;

const logger = getLogger('payg');

@Injectable()
export class PaygService {
  constructor(
    @InjectRepository(Channel) private channelRepo: Repository<Channel>,
    @InjectRepository(PaygEntity) private paygRepo: Repository<PaygEntity>,
    private pubSub: SubscriptionService,
    private network: NetworkService,
    private account: AccountService
  ) {}

  async channelFromContract(id: string): Promise<ChannelState> {
    const channel = await this.network.getSdk().stateChannel.channel(id);
    return channel?.indexer !== ZERO_ADDRESS ? channel : undefined;
  }

  async saveChannel(
    id: string,
    channelState: StateChannel.ChannelStateStructOutput,
    price: string,
    agent: string
  ): Promise<Channel> {
    const hostIndexer = await this.account.getIndexer();
    if (channelState?.indexer !== hostIndexer) return;

    const {
      status,
      indexer,
      consumer,
      total,
      spent,
      expiredAt,
      terminatedAt,
      deploymentId,
      terminateByIndexer,
    } = channelState;

    const channelEntity = this.channelRepo.create({
      id,
      status,
      indexer,
      consumer,
      agent,
      price,
      deploymentId: bytes32ToCid(deploymentId),
      total: total.toString(),
      spent: spent.toString(),
      lastIndexerSign: '',
      lastConsumerSign: '',
      onchain: '0',
      remote: '0',
      expiredAt: expiredAt.toNumber(),
      terminatedAt: terminatedAt.toNumber(),
      terminateByIndexer,
      lastFinal: false,
    });

    const channel = await this.channelRepo.save(channelEntity);
    logger.debug(`Saved state channel ${id}`);

    return channel;
  }

  async channel(channelId: string): Promise<Channel | undefined> {
    const id = channelId.toLowerCase();
    const channel = await this.channelRepo.findOneBy({ id });

    // if (!channel) {
    //   const channelState = await this.channelFromContract(id);
    //   channel = await this.saveChannel(id, channelState, '0', '');
    // }

    return channel;
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
      const channel = await this.channel(id);
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
    if (!channel) {
      throw new Error(`channel not exist: ${id}`);
    }
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
    if (!channel) {
      throw new Error(`channel not exist: ${id}`);
    }
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
    if (!channel) {
      throw new Error(`channel not exist: ${id}`);
    }
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

  async savePub(channel: Channel, event: PaygEvent): Promise<Channel> {
    const new_channel = await this.channelRepo.save(channel);
    await this.pubSub.publish(event, { channelChanged: new_channel });
    return new_channel;
  }
}
