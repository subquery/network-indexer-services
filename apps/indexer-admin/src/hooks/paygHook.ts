// Copyright 2020-2025 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApolloQueryResult, useMutation } from '@apollo/client';
import { formatEther, formatUnits, parseEther, parseUnits } from '@ethersproject/units';
import { openNotification } from '@subql/components';
import { GraphqlQueryClient } from '@subql/network-clients';
import { NETWORK_CONFIGS, STABLE_COIN_DECIMAL } from '@subql/network-config';
import { GetIndexerClosedFlexPlans, GetIndexerOngoingFlexPlans } from '@subql/network-query';
import { BigNumber } from 'ethers';

import { useContractSDK } from 'containers/contractSdk';
import { useCoordinatorIndexer } from 'containers/coordinatorIndexer';
import { PAYG_PRICE } from 'utils/queries';
import { network } from 'utils/web3';

import { useProjectDetails } from './projectHook';

export enum FlexPlanStatus {
  ONGOING,
  CLOSED,
}

const daySeconds = 3600 * 24;

// hook for PAYG configuration
export function usePAYGConfig(deploymentId: string) {
  const [paygPriceRequest, { loading }] = useMutation(PAYG_PRICE);
  const projectQuery = useProjectDetails(deploymentId);
  const sdk = useContractSDK();

  const paygConfig = useMemo(() => {
    const payg = projectQuery.data?.project.payg;
    if (!payg || !payg.price) {
      return {
        paygPrice: '',
        paygMinPrice: '',
        paygRatio: 80,
        paygExpiration: 0,
        token: sdk?.sqToken.address,
        useDefault: true,
      };
    }

    return {
      paygPrice:
        payg.token === sdk?.sqToken.address
          ? formatEther(BigNumber.from(payg.price).mul(1000))
          : formatUnits(BigNumber.from(payg.price).mul(1000), +STABLE_COIN_DECIMAL),
      paygRatio: payg.priceRatio || 80,
      paygMinPrice:
        payg.token === sdk?.sqToken.address
          ? formatEther(BigNumber.from(payg.minPrice).mul(1000))
          : formatUnits(BigNumber.from(payg.minPrice).mul(1000), +STABLE_COIN_DECIMAL),
      paygExpiration: (payg.expiration ?? 0) / daySeconds,
      token: payg.token,
      useDefault: payg.useDefault,
    };
  }, [projectQuery, sdk]);

  const changePAYGCofnig = useCallback(
    async (values: {
      priceRatio: number;
      minPrice: string;
      price: string;
      token: string;
      validity: string;
      useDefault: boolean;
    }) => {
      try {
        const { priceRatio, minPrice, validity, token, useDefault } = values;
        const paygPrice =
          token === sdk?.sqToken.address
            ? parseEther(minPrice)
            : parseUnits(minPrice, +import.meta.env.VITE_STABLE_TOKEN_DECIMAL);

        await paygPriceRequest({
          variables: {
            useDefault,
            paygPrice: paygPrice.div(1000).toString(),
            paygToken: token,
            paygExpiration: Number(+validity * daySeconds),
            paygRatio: priceRatio,
            // TODO: remove these 2 param on coordinator service side
            paygThreshold: 10,
            paygOverflow: 10,
            id: deploymentId,
          },
        });

        await projectQuery.refetch();

        return true;
      } catch (e) {
        return { status: false, msg: `Invalid PAYG: ${e}` };
      }
    },
    [deploymentId, paygPriceRequest, projectQuery, sdk]
  );

  useEffect(() => {
    if (projectQuery.error) {
      openNotification({
        type: 'error',
        title: 'Fetch error',
        description: projectQuery.error.message,
      });
    }
  }, [projectQuery.error]);

  return {
    paygConfig,
    changePAYGCofnig,
    loading,
    initializeLoading: projectQuery.loading,
    dominantPrice: projectQuery.data?.project.dominantPrice,
  };
}

// hook for PAYG plans
export enum ChannelStatus {
  FINALIZED = 'FINALIZED',
  OPEN = 'OPEN',
  TERMINATED = 'TERMINATED',
}

export type Plan = {
  id: string;
  indexer: string;
  consumer: string;
  status: ChannelStatus;
  price: string;
  total: string; // deposit SQT amount
  spent: string;
  isFinal: boolean;
  expiredAt: string;
  terminatedAt: string;
};

const config = NETWORK_CONFIGS[network];
const client = new GraphqlQueryClient(config);
const { networkClient } = client;

function queryFromStatus(status: FlexPlanStatus) {
  return status === FlexPlanStatus.ONGOING ? GetIndexerOngoingFlexPlans : GetIndexerClosedFlexPlans;
}

export function usePAYGPlans(deploymentId: string) {
  const [data, setData] = useState<ApolloQueryResult<{ stateChannels: { nodes: Plan[] } }>>();

  const plans = useMemo((): Plan[] | undefined => data?.data.stateChannels.nodes, [data]);
  const { indexer } = useCoordinatorIndexer();

  const getPlans = useCallback(
    async (id: string, status: FlexPlanStatus) => {
      if (!indexer) return;
      const response = await networkClient.query({
        query: queryFromStatus(status),
        variables: {
          indexer,
          deploymentId: id,
          now: new Date(),
        },
      });
      setData(response);
    },
    [indexer]
  );

  useEffect(() => {
    indexer && getPlans(deploymentId, FlexPlanStatus.ONGOING);
  }, [deploymentId, getPlans, indexer]);

  return { getPlans, plans };
}
