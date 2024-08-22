// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { StateChannel as StateChannelOnChain } from '@subql/contract-sdk';
import { bytes32ToCid } from '@subql/network-clients';
import { StateChannel as StateChannelOnNetwork } from '@subql/network-query';
import { BigNumber } from 'ethers';
import lodash from 'lodash';
import { ConfigService } from 'src/config/config.service';
import { ContractService } from 'src/core/contract.service';
import { OnChainService } from 'src/core/onchain.service';
import { TxType } from 'src/core/types';
import { ZERO_ADDRESS } from 'src/utils/project';
import { MoreThan, Repository } from 'typeorm';
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
export class PaygService implements OnModuleInit {
  constructor(
    @InjectRepository(Channel) private channelRepo: Repository<Channel>,
    @InjectRepository(PaygEntity) private paygRepo: Repository<PaygEntity>,
    private paygQueryService: PaygQueryService,
    private pubSub: SubscriptionService,
    private contract: ContractService,
    private onChain: OnChainService,
    private account: AccountService,
    private configService: ConfigService
  ) {}

  async onModuleInit() {
    await this.patchDefaultFlexPlan();
  }

  async patchDefaultFlexPlan() {
    const flexConfig = await this.configService.getFlexConfig();
    if (flexConfig.flex_enabled === 'true') {
      // project not modified since
      const pays = await this.paygRepo.find({
        where: {
          price: '',
          token: '',
        },
      });
      for (const p of pays) {
        p.price = flexConfig.flex_price;
        p.expiration = Number(flexConfig.flex_valid_period) || 0;
        p.threshold = 10;
        p.overflow = 10;
        p.token = this.contract.getSdk().sqToken.address;
        await this.paygRepo.save(p);
      }
    }
  }

  async channelFromContract(id: BigNumber): Promise<ChannelState> {
    const channel = await this.contract.getSdk().stateChannel.channel(id);
    return channel?.indexer !== ZERO_ADDRESS ? channel : undefined;
  }

  async channelPriceFromContract(id: BigNumber): Promise<BigNumber> {
    // FIXME
    return this.contract.getSdk().stateChannel.channelPrice(id);
    // return BigNumber.from('0');
  }

  async channelConsumerFromContract(id: BigNumber): Promise<string> {
    try {
      return this.contract.getSdk().consumerHost.channelConsumer(id);
    } catch (e) {
      console.debug(`Failed to get consumer of channel ${id}: ${e}`);
      return undefined;
    }
  }

  async channelPriceFromNetwork(id: BigNumber): Promise<BigNumber> {
    const channel = await this.paygQueryService.getStateChannel(id.toHexString());
    return channel?.price ? BigNumber.from(channel.price) : undefined;
  }

  async updateChannelFromContract(
    id: string,
    channelState: StateChannelOnChain.ChannelStateStructOutput,
    price: string,
    consumer: string
  ): Promise<Channel | undefined> {
    id = BigNumber.from(id).toHexString().toLowerCase();

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
      total,
      spent,
      expiredAt,
      terminatedAt,
      deploymentId,
      terminateByIndexer,
    } = channelState;

    let agent: string;

    if (consumer) {
      agent = channelState.consumer;
    } else {
      consumer = channelState.consumer;
      agent = '';
    }

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
        spent: spent.toString(),
        expiredAt: 0,
      });
    }

    channelEntity.status = status;
    channelEntity.indexer = indexer;
    channelEntity.consumer = consumer;
    channelEntity.agent = agent;
    channelEntity.price = channelEntity.price === '0' ? price : channelEntity.price;
    channelEntity.deploymentId = bytes32ToCid(deploymentId);
    channelEntity.total = total.toString();
    channelEntity.onchain = spent.toString();
    const newExpiredAt = expiredAt.toNumber();
    if (channelEntity.expiredAt < newExpiredAt) {
      channelEntity.expiredAt = newExpiredAt;
    }
    channelEntity.terminatedAt = terminatedAt.toNumber();
    channelEntity.terminateByIndexer = terminateByIndexer;

    const channel = await this.channelRepo.save(channelEntity);
    logger.debug(`Updated state channel from contract: ${id}`);

    return channel;
  }

  async updateChannelFromNetwork(
    id: string,
    altChannelData?: StateChannelOnNetwork,
    isFinal?: boolean
  ): Promise<Channel | undefined> {
    id = BigNumber.from(id).toHexString().toLowerCase();

    if (!altChannelData) {
      altChannelData = await this.paygQueryService.getStateChannel(id);
    }
    if (!altChannelData) {
      logger.debug(`State channel not exist on network, remove from db: ${id}`);
      await this.channelRepo.delete({ id });
      return;
    }

    const hostIndexer = await this.account.getIndexer();
    if (altChannelData.indexer !== hostIndexer) {
      logger.debug(`State channel indexer is not host indexer, remove from db: ${id}`);
      await this.channelRepo.delete({ id });
      return;
    }

    let channelEntity = await this.channelRepo.findOneBy({ id });

    if (!channelEntity) {
      channelEntity = this.channelRepo.create({
        id,
        price: '0',
        lastIndexerSign: '',
        lastConsumerSign: '',
        spent: '0',
        remote: '0',
        lastFinal: false,
        expiredAt: 0,
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
    } = altChannelData;

    if (isFinal) {
      channelEntity.status = ChannelStatus.FINALIZED;
      channelEntity.lastFinal = true;
    } else {
      channelEntity.status = ChannelStatus[status];
      channelEntity.lastFinal = _isFinal;
    }
    channelEntity.indexer = indexer;
    channelEntity.consumer = consumer;
    channelEntity.agent = agent;
    channelEntity.price = channelEntity.price === '0' ? price.toString() : channelEntity.price;
    channelEntity.deploymentId = deployment.id;
    channelEntity.total = total.toString();
    channelEntity.onchain = spent.toString();
    const newExpiredAt = new Date(expiredAt).getTime() / 1000;
    if (channelEntity.expiredAt < newExpiredAt) {
      channelEntity.expiredAt = newExpiredAt;
    }
    channelEntity.terminatedAt = new Date(terminatedAt).getTime() / 1000;
    channelEntity.terminateByIndexer = terminateByIndexer;

    const channel = await this.channelRepo.save(channelEntity);
    logger.debug(`Updated state channel from network: ${id}`);

    return channel;
  }

  async channel(channelId: string): Promise<Channel | undefined> {
    const id = BigNumber.from(channelId).toHexString().toLowerCase();
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
    if (!this.contract.getSdk()) {
      return;
    }

    const id = BigNumber.from(channelId).toHexString().toLowerCase();

    const channelState = await this.channelFromContract(BigNumber.from(id));
    if (!channelState) {
      return this.updateChannelFromNetwork(id, altChannelData, true);
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

    const consumer = await this.channelConsumerFromContract(BigNumber.from(id));

    const channel = await this.updateChannelFromContract(
      id,
      channelState,
      channelPrice.toString(),
      consumer
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

  async getChannelsForSync(): Promise<Channel[]> {
    const now = Math.floor(Date.now() / 1000);

    return this.channelRepo
      .createQueryBuilder('channel')
      .where('channel.expiredAt > :now', { now })
      .orWhere('channel.lastFinal = false')
      .getMany();
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

      // const projectPayg = await this.paygRepo.findOneBy({ id: channel.deploymentId });
      // if (!projectPayg) {
      //   throw new Error(`project payg not exist: ${channel.deploymentId}`);
      // }

      // const threshold = BigInt(projectPayg.threshold);
      const currentRemote = BigInt(spent);
      const prevSpent = BigInt(channel.spent);
      const prevRemote = BigInt(channel.remote);
      const price = BigInt(channel.price);

      // add a price every time
      channel.spent = (prevSpent + price).toString();

      logger.debug(`channel.spent: ${channel.spent}, spent: ${spent}, price: ${price}`);

      // if remote is less than own, just add spent
      if (prevRemote < currentRemote) {
        channel.remote = spent;
        channel.lastFinal = isFinal;
        channel.lastIndexerSign = indexerSign;
        channel.lastConsumerSign = consumerSign;
      }

      // // threshold value for checkpoint and spawn to other promise.
      // if ((currentRemote - BigInt(channel.onchain)) / price > threshold) {
      //   // send to blockchain.
      //   await this.network.sendTransaction('state channel checkpoint', async (overrides) =>
      //     this.network.getSdk().stateChannel.checkpoint(
      //       {
      //         channelId: id,
      //         isFinal: isFinal,
      //         spent: channel.remote,
      //         indexerSign: indexerSign,
      //         consumerSign: consumerSign,
      //       },
      //       overrides
      //     )
      //   );
      //   channel.onchain = channel.remote;
      //   channel.spent = channel.remote;
      // }

      logger.debug(`Updated state channel ${id}`);

      return this.saveAndPublish(channel, PaygEvent.State);
    } catch (e) {
      logger.error(`Failed to update state channel ${id} with error: ${e}`);
    }
  }

  async extend(id: string, expiration: number, price?: string): Promise<Channel> {
    const channel = await this.channel(id);
    if (!channel) {
      throw new Error(`channel not exist: ${id}`);
    }

    let modified = false;

    if (channel.expiredAt < expiration) {
      channel.expiredAt = expiration;
      modified = true;
    }

    // TIPS: if delete db and restore from chain, it will be wrong
    if (price && price !== '0') {
      channel.price = BigInt(price).toString();
      modified = true;
    }

    if (!modified) {
      return channel;
    }

    logger.debug(`Extend state channel ${id}`);

    return this.saveAndPublish(channel, PaygEvent.State);
  }

  async checkpoint(id: string, txType: TxType = TxType.check): Promise<Channel> {
    const channel = await this.channel(id);
    if (!channel) {
      throw new Error(`channel not exist: ${id}`);
    }
    if (channel.onchain === channel.remote) {
      return channel;
    }

    // checkpoint
    await this.contract.sendTransaction({
      action: `state channel checkpoint ${id}`,
      type: txType,
      txFun: (overrides) =>
        this.contract.getSdk().stateChannel.checkpoint(
          {
            channelId: channel.id,
            isFinal: channel.lastFinal,
            spent: channel.remote,
            indexerSign: channel.lastIndexerSign,
            consumerSign: channel.lastConsumerSign,
          },
          overrides
        ),
      gasFun: (overrides) =>
        this.contract.getSdk().stateChannel.estimateGas.checkpoint(
          {
            channelId: channel.id,
            isFinal: channel.lastFinal,
            spent: channel.remote,
            indexerSign: channel.lastIndexerSign,
            consumerSign: channel.lastConsumerSign,
          },
          overrides
        ),
    });

    channel.onchain = channel.remote;
    channel.spent = channel.remote;

    logger.debug(`Checkpointed state channel ${id}`);

    return this.saveAndPublish(channel, PaygEvent.State);
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
    await this.contract.sendTransaction({
      action: `state channel terminate ${id}`,
      type: TxType.check,
      txFun: (overrides) =>
        this.contract.getSdk().stateChannel.terminate(
          {
            channelId: channel.id,
            isFinal: channel.lastFinal,
            spent: channel.remote,
            indexerSign: channel.lastIndexerSign,
            consumerSign: channel.lastConsumerSign,
          },
          overrides
        ),
      gasFun: (overrides) =>
        this.contract.getSdk().stateChannel.estimateGas.terminate(
          {
            channelId: channel.id,
            isFinal: channel.lastFinal,
            spent: channel.remote,
            indexerSign: channel.lastIndexerSign,
            consumerSign: channel.lastConsumerSign,
          },
          overrides
        ),
    });

    channel.status = ChannelStatus.TERMINATING;
    channel.onchain = channel.remote;
    channel.spent = channel.remote;
    channel.lastFinal = true;

    logger.debug(`Terminated state channel ${id}`);

    return this.saveAndPublish(channel, PaygEvent.State);
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
    await this.contract.sendTransaction({
      action: `state channel respond ${id}`,
      type: TxType.check,
      txFun: (overrides) =>
        this.contract.getSdk().stateChannel.respond(
          {
            channelId: channel.id,
            isFinal: channel.lastFinal,
            spent: channel.spent,
            indexerSign: channel.lastIndexerSign,
            consumerSign: channel.lastConsumerSign,
          },
          overrides
        ),
      gasFun: (overrides) =>
        this.contract.getSdk().stateChannel.estimateGas.respond(
          {
            channelId: channel.id,
            isFinal: channel.lastFinal,
            spent: channel.spent,
            indexerSign: channel.lastIndexerSign,
            consumerSign: channel.lastConsumerSign,
          },
          overrides
        ),
    });

    channel.onchain = channel.spent;
    channel.spent = channel.remote;
    channel.lastFinal = true;

    logger.debug(`Responded state channel ${id}`);

    return this.saveAndPublish(channel, PaygEvent.State);
  }

  async saveAndPublish(channel: Channel, event: PaygEvent): Promise<Channel> {
    const new_channel = await this.channelRepo.save(channel);
    await this.pubSub.publish(event, { channelChanged: new_channel });
    return new_channel;
  }

  async getOpenChannels() {
    return await this.channelRepo.find({ where: { status: ChannelStatus.OPEN } });
  }
}
