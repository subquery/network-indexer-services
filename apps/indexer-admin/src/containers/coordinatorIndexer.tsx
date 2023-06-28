// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import * as React from 'react';
import { useLazyQuery, useMutation } from '@apollo/client';

import { ADD_INDEXER, GET_COORDINATOR_INDEXER } from '../utils/queries';
import { createContainer } from './unstated';

type CoordinatorIndexerContext = {
  indexer: string | undefined;
  updateIndexer: (indexer: string) => Promise<void>;
  load: () => void;
  loading: boolean;
  error?: Error;
};

function useCoordinatorIndexerImpl(): CoordinatorIndexerContext {
  const [load, { data, loading, error }] = useLazyQuery(GET_COORDINATOR_INDEXER);
  const [addIndexer] = useMutation(ADD_INDEXER);

  const [indexer, setIndexer] = React.useState<string>();

  React.useEffect(() => {
    setIndexer(data?.accountMetadata?.indexer);
  }, [data]);

  const updateIndexer = React.useCallback(
    async (indexer: string) => {
      await addIndexer({ variables: { indexer } });
      setIndexer(indexer);
    },
    [addIndexer]
  );

  return {
    indexer,
    updateIndexer,
    load,
    loading,
    error,
  };
}

export const { useContainer: useCoordinatorIndexer, Provider: CoordinatorIndexerProvider } =
  createContainer(useCoordinatorIndexerImpl, {
    displayName: 'Coordinator Indexer',
  });
