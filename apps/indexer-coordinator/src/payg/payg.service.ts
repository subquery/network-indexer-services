// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { StateChannel as StateChannelOnChain, bytes32ToCid } from '@subql/network-clients';
import { StateChannel as StateChannelOnNetwork } from '@subql/network-query';
import { BigNumber } from 'ethers';
import lodash from 'lodash';
import { ZERO_ADDRESS } from 'src/utils/project';
import { MoreThan, Repository } from 'typeorm';

import { NetworkService } from '../core/network.service';
import { PaygEntity } from '../project/project.model';
import { SubscriptionService } from '../subscription/subscription.service';
import { getLogger } from '../utils/logger';
import { PaygEvent } from '../utils/subscription';
import { AccountService } from './../core/account.service';

import { Channel, ChannelStatus } from './payg.model';
import { PaygQueryService } from './payg.query.service';

export type ChannelState = StateChannelOnChain.ChannelStateStructOutput;

const logger = getLogger('payg');

@Injectable()
export class PaygService {
  constructor(
    @InjectRepository(Channel) private channelRepo: Repository<Channel>,
    @InjectRepository(PaygEntity) private paygRepo: Repository<PaygEntity>,
    private paygQueryService: PaygQueryService,
    private pubSub: SubscriptionService,
    private network: NetworkService,
    private account: AccountService
  ) {}

  async channelFromContract(id: BigNumber): Promise<ChannelState> {
    const channel = await this.network.getSdk().stateChannel.channel(id);
    return channel?.indexer !== ZERO_ADDRESS ? channel : undefined;
  }

  async channelPriceFromContract(id: BigNumber): Promise<BigNumber> {
    return this.network.getSdk().stateChannel.channelPrice(id);
  }

  async channelPriceFromNetwork(id: BigNumber): Promise<BigNumber> {
    const channel = await this.paygQueryService.getStateChannel(id.toHexString());
    return channel?.price ? BigNumber.from(channel.price) : undefined;
  }

  async updateChannelFromContract(
    id: string,
    channelState: StateChannelOnChain.ChannelStateStructOutput,
    price: string,
    agent: string
  ): Promise<Channel | undefined> {
    const hostIndexer = await this.account.getIndexer();
    if (!channelState) {
      return;
    }
    if (channelState.indexer !== hostIndexer) {
      logger.debug(`State channel indexer is not host indexer, remove from db: ${id}`);
      await this.channelRepo.delete({ id });
      return;
    }
    if (lodash.isEmpty(price) || lodash.isNaN(price) || price === '0') {
      logger.debug(`State channel price cannot be zero: ${id}`);
      return;
    }

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

    let channelEntity = await this.channelRepo.findOneBy({ id });

    if (!channelEntity) {
      channelEntity = this.channelRepo.create({
        id,
        price: '0',
        lastIndexerSign: '',
        lastConsumerSign: '',
        onchain: '0',
        remote: '0',
        lastFinal: false,
      });
    }

    channelEntity.status = status;
    channelEntity.indexer = indexer;
    channelEntity.consumer = consumer;
    channelEntity.agent = agent ? agent : channelEntity.agent;
    channelEntity.price = price;
    channelEntity.deploymentId = bytes32ToCid(deploymentId);
    channelEntity.total = total.toString();
    channelEntity.spent = spent.toString();
    channelEntity.expiredAt = expiredAt.toNumber();
    channelEntity.terminatedAt = terminatedAt.toNumber();
    channelEntity.terminateByIndexer = terminateByIndexer;

    const channel = await this.channelRepo.save(channelEntity);
    logger.debug(`Updated state channel from contract: ${id}`);

    return channel;
  }

  async updateChannelFromNetwork(
    stateChannel: StateChannelOnNetwork,
    isFinal?: boolean
  ): Promise<Channel | undefined> {
    const id = BigNumber.from(stateChannel.id).toString();
    let channelEntity = await this.channelRepo.findOneBy({ id });

    if (!channelEntity) {
      channelEntity = this.channelRepo.create({
        id,
        price: '0',
        lastIndexerSign: '',
        lastConsumerSign: '',
        onchain: '0',
        remote: '0',
        lastFinal: false,
      });
    }

    const {
      status,
      indexer,
      consumer,
      agent,
      price,
      total,
      spent,
      expiredAt,
      terminatedAt,
      deployment,
      terminateByIndexer,
      isFinal: _isFinal,
    } = stateChannel;

    if (isFinal && terminatedAt < new Date()) {
      channelEntity.status = ChannelStatus.FINALIZED;
      channelEntity.lastFinal = true;
    } else {
      channelEntity.status = ChannelStatus[status];
      channelEntity.lastFinal = _isFinal;
    }
    channelEntity.indexer = indexer;
    channelEntity.consumer = consumer;
    channelEntity.agent = agent;
    channelEntity.price = price.toString();
    channelEntity.deploymentId = deployment.id;
    channelEntity.total = total.toString();
    channelEntity.spent = spent.toString();
    channelEntity.expiredAt = new Date(expiredAt).getTime() / 1000;
    channelEntity.terminatedAt = new Date(terminatedAt).getTime() / 1000;
    channelEntity.terminateByIndexer = terminateByIndexer;

    const channel = await this.channelRepo.save(channelEntity);
    logger.debug(`Updated state channel from network: ${id}`);

    return channel;
  }

  async channel(channelId: string): Promise<Channel | undefined> {
    const id = channelId.toLowerCase();
    let channel = await this.channelRepo.findOneBy({ id });

    if (!channel) {
      channel = await this.syncChannel(id);
    }

    return channel;
  }

  async syncChannel(
    channelId: string,
    altPrice?: BigNumber,
    altChannelData?: StateChannelOnNetwork
  ): Promise<Channel | undefined> {
    if (!this.network.getSdk()) {
      return;
    }

    const id = channelId.toLowerCase();

    const channelState = await this.channelFromContract(BigNumber.from(id));
    if (!channelState) {
      if (altChannelData) {
        return this.updateChannelFromNetwork(altChannelData, true);
      } else {
        logger.debug(`State channel not exist on chain, remove from db: ${id}`);
        await this.channelRepo.delete({ id });
        return;
      }
    }

    let channelPrice: BigNumber;
    try {
      channelPrice = await this.channelPriceFromContract(BigNumber.from(id));
    } catch (e) {
      logger.debug(`State channel sync price failed: ${id}`);
    }
    if (!channelPrice || channelPrice.isZero()) {
      if (altPrice && !altPrice.isZero()) {
        channelPrice = altPrice;
      } else {
        channelPrice = await this.channelPriceFromNetwork(BigNumber.from(id));
      }
    }
    if (!channelPrice || channelPrice.isZero()) {
      logger.debug(`State channel update price failed: [${channelPrice}] ${id}`);
      return;
    }

    const channel = await this.updateChannelFromContract(
      id,
      channelState,
      channelPrice.toString(),
      ''
    );
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
