// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ApolloClient } from '@apollo/client/core';
import { Injectable } from '@nestjs/common';
import { GraphqlQueryClient, NETWORK_CONFIGS } from '@subql/network-clients';
import {
  GetStateChannels,
  GetStateChannelsQuery,
  StateChannel,
  GetFlexPlan,
  GetFlexPlanQuery,
} from '@subql/network-query';

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

  async getStateChannels(): Promise<StateChannel[]> {
    try {
      const result = await this.client.query<GetStateChannelsQuery>({
        query: GetStateChannels,
        variables: { status: 'OPEN' },
      });

      const channels = result.data.stateChannels.nodes;
      return channels;
    } catch (e) {
      logger.error(`Failed to get state channels from Subquery Project: ${e}`);
      return [];
    }
  }

  async getStateChannel(id: string): Promise<StateChannel | undefined> {
    try {
      const result = await this.client.query<GetFlexPlanQuery>({
        query: GetFlexPlan,
        variables: { id },
      });

      const channel = result.data.stateChannel;
      return channel;
    } catch (e) {
      logger.error(`Failed to get channel ${id} from Subquery Project: ${e}`);
      return;
    }
  }
}
