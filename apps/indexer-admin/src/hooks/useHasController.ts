// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react';
import { useQuery } from '@apollo/client';

import { useCoordinatorIndexer } from 'containers/coordinatorIndexer';
import { createContainer } from 'containers/unstated';
import { GET_CONTROLLERS } from 'utils/queries';

import { useController } from './indexerHook';

export const useHasControllerImpl = () => {
  const [hasControllerLoading, setHasControllerLoading] = useState(true);
  const { indexer } = useCoordinatorIndexer();
  const { getController } = useController();
  const [hasController, setHasController] = useState(false);
  const controllerQuery = useQuery<{
    controllers: { address: string; id: string }[];
  }>(GET_CONTROLLERS, {
    fetchPolicy: 'network-only',
  });

  const refetch = async () => {
    try {
      setHasControllerLoading(true);
      const controller = await getController(indexer);
      const result = await controllerQuery.refetch();
      if (result.data?.controllers?.find((i) => i.address === controller)) {
        setHasController(true);
      } else {
        setHasController(false);
      }
    } finally {
      setTimeout(() => {
        setHasControllerLoading(false);
      });
    }
  };

  return {
    data: hasController,
    loading: hasControllerLoading,
    refetch,
  };
};

export const { useContainer: useHasController, Provider: HasControllerProvider } = createContainer(
  useHasControllerImpl,
  {
    displayName: 'Has Controller',
  }
);
