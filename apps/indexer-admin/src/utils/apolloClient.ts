// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ApolloClient, gql, InMemoryCache } from '@apollo/client';

import { PRODUCTION_NETWORK } from './web3';

const COORDINATOR_SERVICE_PORT =
  process.env.REACT_APP_COORDINATOR_SERVICE_PORT || window.env.COORDINATOR_SERVICE_PORT;

const COORDINATOR_SERVICE_URL =
  process.env.REACT_APP_COORDINATOR_SERVICE_URL || window.env.COORDINATOR_SERVICE_URL;

const NETWORK = process.env.REACT_APP_NETWORK || window.env.NETWORK;

const defaultCoordinatorUrl = `${window.location.protocol}//${window.location.hostname}:${COORDINATOR_SERVICE_PORT}/graphql`;

export const coordinatorServiceUrl =
  process?.env?.NODE_ENV !== 'production' ? COORDINATOR_SERVICE_URL : defaultCoordinatorUrl;

export const excellencyServiceUrl =
  NETWORK === PRODUCTION_NETWORK
    ? 'https://leaderboard-api.subquery.network/graphql'
    : 'https://leaderboard-api.thechaindata.com/graphql';

export const proxyServiceUrl = `${window.location.protocol}//${window.location.hostname}`;

export function createApolloClient(uri: string) {
  return new ApolloClient({
    uri,
    cache: new InMemoryCache(),
    defaultOptions: {
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
