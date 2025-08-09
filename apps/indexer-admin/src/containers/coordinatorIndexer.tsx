// Copyright 2020-2025 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import * as React from 'react';
import { useLazyQuery, useMutation } from '@apollo/client';

import { ADD_INDEXER, GET_COORDINATOR_INDEXER } from '../utils/queries';
import { notificationMsg } from './notificationContext';
import { createContainer } from './unstated';

type CoordinatorIndexerContext = {
  indexer: string | undefined;
  updateIndexer: (indexer: string) => Promise<void>;
  load: () => void;
  loading: boolean;
  error?: Error;
  setIndexer: (indexer?: string) => void;
};

function useCoordinatorIndexerImpl(): CoordinatorIndexerContext {
  const [fetchCoordinatorIndexer, { error }] = useLazyQuery(GET_COORDINATOR_INDEXER);

  const [addIndexer] = useMutation(ADD_INDEXER);

  const [indexer, setIndexer] = React.useState<string>();
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (error) {
      notificationMsg({
        title: 'Error',
        message: 'Failed to get coordinator indexer information',
        type: 'danger',
        dismiss: {
          duration: 15000,
        },
      });
      console.error(error);
    }
  }, [error]);

  const updateIndexer = React.useCallback(
    async (indexer: string) => {
      await addIndexer({ variables: { indexer } });
      setIndexer(indexer);
    },
    [addIndexer]
  );

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchCoordinatorIndexer();
      setIndexer(res.data?.accountMetadata?.indexer || undefined);
    } finally {
      setLoading(false);
    }
  }, [fetchCoordinatorIndexer]);

  return {
    indexer,
    updateIndexer,
    load,
    loading,
    error,
    setIndexer,
  };
}

export const { useContainer: useCoordinatorIndexer, Provider: CoordinatorIndexerProvider } =
  createContainer(useCoordinatorIndexerImpl, {
    displayName: 'Coordinator Indexer',
  });
