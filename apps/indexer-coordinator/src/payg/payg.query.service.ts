// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ApolloClient } from '@apollo/client/core';
import { Injectable } from '@nestjs/common';
import { GraphqlQueryClient, NETWORK_CONFIGS } from '@subql/network-clients';
import {
  StateChannelFields,
  GetStateChannelsQuery,
  StateChannel,
  GetFlexPlan,
  GetFlexPlanQuery,
} from '@subql/network-query';

import { gql } from 'apollo-server-core';
import { timeoutPromiseCatched } from 'src/utils/promise';
import { Config } from '../configure/configure.module';
import { getLogger } from '../utils/logger';

const logger = getLogger('payg');

@Injectable()
export class PaygQueryService {
  private client: ApolloClient<unknown>;

  constructor(private readonly config: Config) {
    const queryClient = new GraphqlQueryClient(NETWORK_CONFIGS[config.network]);
    this.client = queryClient.networkClient;
  }

  @timeoutPromiseCatched(20000, [])
  async getStateChannels(indexer: string): Promise<StateChannel[]> {
    try {
      const result = await this.client.query<GetStateChannelsQuery>({
        // @ts-ignore TODO: fix type
        query: gql`
          query GetStateChannelsByIndexer($indexer: String!, $status: [ChannelStatus!]) {
            stateChannels(filter: { indexer: { equalTo: $indexer }, status: { in: $status } }) {
              totalCount
              nodes {
                ...StateChannelFields
              }
            }
          }
          ${StateChannelFields}
        `,
        variables: { indexer, status: ['OPEN', 'TERMINATING'] },
      });

      const channels = result.data.stateChannels.nodes;
      // @ts-ignore TODO: fix type
      return channels;
    } catch (e) {
      logger.error(`Failed to get state channels from Subquery Project: ${e}`);
      return [];
    }
  }

  @timeoutPromiseCatched(20000, undefined)
  async getStateChannel(id: string): Promise<StateChannel | undefined> {
    try {
      const result = await this.client.query<GetFlexPlanQuery>({
        // @ts-ignore TODO: fix type
        query: GetFlexPlan,
        variables: { id },
      });

      const channel = result.data.stateChannel;
      // @ts-ignore TODO: fix type
      return channel;
    } catch (e) {
      logger.error(`Failed to get channel ${id} from Subquery Project: ${e}`);
      return;
    }
  }
}
