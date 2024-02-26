// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ApolloClient, gql, InMemoryCache } from '@apollo/client';
import { LEADERBOARD_SUBQL_ENDPOINTS, SQNetworks } from '@subql/network-config';

const COORDINATOR_SERVICE_URL =
  import.meta.env.VITE_APP_COORDINATOR_SERVICE_URL || window.env.COORDINATOR_SERVICE_URL;

export const NETWORK = (import.meta.env.VITE_APP_NETWORK || window.env.NETWORK) as SQNetworks;

const defaultCoordinatorUrl = '/graphql';

export const coordinatorServiceUrl = import.meta.env.DEV
  ? COORDINATOR_SERVICE_URL
  : defaultCoordinatorUrl;

export const excellencyServiceUrl = LEADERBOARD_SUBQL_ENDPOINTS[NETWORK];

export const proxyServiceUrl = `${window.location.protocol}//${window.location.hostname}`;

export function createApolloClient(uri: string) {
  return new ApolloClient({
    uri,
    cache: new InMemoryCache(),
    defaultOptions: {
      query: {
        fetchPolicy: 'network-only',
      },
      watchQuery: {
        fetchPolicy: 'network-only',
      },
    },
  });
}

// TODO: update report
const excellencyClient = createApolloClient(excellencyServiceUrl);

export const excellencyQuery = async <T = any>(
  query: string
): Promise<{ data: T; status: number }> => {
  const { data, networkStatus } = await excellencyClient.query({
    query: gql`
      ${query}
    `,
  });

  return {
    data,
    status: networkStatus,
  };
};
