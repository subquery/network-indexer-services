// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { useAccount } from 'wagmi';

import { useCoordinatorIndexer } from 'containers/coordinatorIndexer';
import { GET_CONTROLLERS } from 'utils/queries';

import { useController } from './indexerHook';

export const useHasController = () => {
  const { isConnected } = useAccount();
  const { error, loading } = useCoordinatorIndexer();
  const { controller, loading: controllerLoading } = useController();

  const hasController = useQuery<{
    controllers: { address: string; id: string }[];
  }>(GET_CONTROLLERS, {
    fetchPolicy: 'network-only',
  });

  useEffect(() => {
    hasController.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller]);

  return useMemo(() => {
    if (isConnected) {
      if (
        !error &&
        !loading &&
        !controllerLoading &&
        !hasController.loading &&
        !hasController.error
      ) {
        if (!hasController.data?.controllers?.length) {
          return false;
        }

        if (!controller) return false;

        if (controller && !hasController.data?.controllers?.find((i) => i.address)) {
          return false;
        }
      }
    }

    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isConnected, error, hasController, controller, controllerLoading]);
};
