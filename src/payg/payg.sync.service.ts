// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ApolloClient } from '@apollo/client/core';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { GraphqlQueryClient, NETWORK_CONFIGS } from '@subql/network-clients';
import { GetStateChannels, GetStateChannelsQuery } from '@subql/network-query';

import { BigNumber } from 'ethers';

import { Config } from '../configure/configure.module';
import { ContractService } from '../core/contract.service';
import { getLogger, LogCategory } from '../utils/logger';
import { PaygService } from './payg.service';

@Injectable()
export class PaygSyncService implements OnApplicationBootstrap {
  private client: ApolloClient<unknown>;

  constructor(
    private contractService: ContractService,
    private paygServicee: PaygService,
    private readonly config: Config,
  ) {
    const queryClient = new GraphqlQueryClient(NETWORK_CONFIGS[config.network]);
    this.client = queryClient.networkClient;
  }

  onApplicationBootstrap() {
    void (() => {
      console.log('try sync pagy');
      //this.syncStateChannelsPeriodically();
      // this.subscribeStateChannelEvents();
    })();
  }

  syncStateChannelsPeriodically() {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    setInterval(async (): Promise<void> => {
      try {
        getLogger(LogCategory.coordinator).debug(`load from Subquery Project...`);
        const result = await this.client.query<GetStateChannelsQuery>({
          // @ts-ignore
          query: GetStateChannels,
          variables: { status: 'OPEN' },
        });

        await Promise.all(
          result.data.stateChannels.nodes.map((stateChannel) =>
            this.paygServicee.syncChannel(
              BigNumber.from(stateChannel.id).toString(),
              stateChannel.deployment.id,
              stateChannel.indexer,
              stateChannel.consumer,
              stateChannel.total.toString(),
              stateChannel.spent.toString(),
              stateChannel.price.toString(),
              new Date(stateChannel.expiredAt).valueOf() / 1000,
              new Date(stateChannel.terminatedAt).valueOf() / 1000,
              stateChannel.terminateByIndexer,
              stateChannel.isFinal,
            ),
          ),
        );
      } catch (e) {
        getLogger(LogCategory.coordinator).error(e);
      }
    }, 10000);
  }

  subscribeStateChannelEvents(): void {
    const contract = this.contractService.getSdk().stateChannel;
    contract.on('ChannelOpen', (channelId, indexer, consumer, total, price, expiredAt, deploymentId) => {
      void this.paygServicee.syncOpen(
        channelId.toString(),
        indexer,
        consumer,
        total.toString(),
        price.toString(),
        expiredAt.toNumber(),
        deploymentId,
      );
    });
    contract.on('ChannelExtend', (channelId, expiredAt) => {
      void this.paygServicee.syncExtend(channelId.toString(), expiredAt.toNumber());
    });
    contract.on('ChannelFund', (channelId, total) => {
      void this.paygServicee.syncFund(channelId.toString(), total.toString());
    });
    contract.on('ChannelCheckpoint', (channelId, spent) => {
      void this.paygServicee.syncCheckpoint(channelId.toString(), spent.toString());
    });
    contract.on('ChannelTerminate', (channelId, spent, terminatedAt, terminateByIndexer) => {
      void this.paygServicee.syncTerminate(
        channelId.toString(),
        spent.toString(),
        terminatedAt.toNumber(),
        terminateByIndexer,
      );
    });
    contract.on('ChannelFinalize', (channelId, total, remain) => {
      void this.paygServicee.syncFinalize(channelId.toString(), total.toNumber(), remain.toNumber());
    });
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    contract.on('ChannelLabor', async (deploymentId, indexer, amount) => {
      const chainLastBlock = await this.contractService.getLastBlockNumber();
      await this.paygServicee.syncLabor(deploymentId, indexer, amount.toString(), chainLastBlock);
    });
  }
}
