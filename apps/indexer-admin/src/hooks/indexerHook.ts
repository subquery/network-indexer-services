// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatUnits } from '@ethersproject/units';

import { useContractSDK } from 'containers/contractSdk';
import { useCoordinatorIndexer } from 'containers/coordinatorIndexer';
import { notificationMsg } from 'containers/notificationContext';
import { Account, IndexerMetadata } from 'pages/account/types';
import { HookDependency } from 'types/types';
import { emptyControllerAccount } from 'utils/indexerActions';
import { bytes32ToCid, cat } from 'utils/ipfs';

export const useIsRegistedIndexer = (
  account: string
): {
  loading: boolean;
  isRegisterIndexer: boolean | undefined;
} => {
  const sdk = useContractSDK();
  const [loading, setLoading] = useState(true);
  const [isRegisterIndexer, updateIsRegisterIndexer] = useState<boolean | undefined>(undefined);
  const getIsIndexer = useCallback(async () => {
    try {
      if (!account || !sdk) return;
      setLoading(true);
      const status = await sdk.indexerRegistry.isIndexer(account);
      updateIsRegisterIndexer(status);
    } catch (e) {
      notificationMsg({
        title: 'Error',
        message: 'Failed to get indexer information from contract',
        type: 'danger',
        dismiss: {
          duration: 15000,
        },
      });
      console.error('Failed to get isIndexer', e);
    } finally {
      setLoading(false);
    }
  }, [account, sdk, updateIsRegisterIndexer]);

  useEffect(() => {
    getIsIndexer();
  }, [getIsIndexer, account]);

  return {
    loading,
    isRegisterIndexer,
  };
};

export const useIsIndexer = () => {
  const { indexer, loading } = useCoordinatorIndexer();
  const { isRegisterIndexer, loading: isRegisterIndexerLoading } = useIsRegistedIndexer(
    indexer || ''
  );

  return {
    loading: loading || isRegisterIndexerLoading,
    data: useMemo(() => indexer && isRegisterIndexer, [indexer, isRegisterIndexer]),
  };
};

export const useController = () => {
  const [controller, setController] = useState<string>();
  const sdk = useContractSDK();
  const { indexer, loading: coordinatorLoading } = useCoordinatorIndexer();
  const [loading, setLoading] = useState(true);

  const getController = useCallback(
    async (address?: string) => {
      try {
        if (!address) {
          if (coordinatorLoading) return undefined;
          if (!indexer) return undefined;
        }
        setLoading(true);
        const controller = await sdk?.indexerRegistry.getController(address ?? indexer ?? '');
        setController(controller === emptyControllerAccount ? '' : controller);
        return controller === emptyControllerAccount ? '' : controller;
      } catch {
        setController(undefined);
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    [sdk, indexer, coordinatorLoading]
  );

  useEffect(() => {
    getController();
  }, [getController]);

  return { controller, getController, loading };
};

export const useTokenBalance = (account: Account, deps?: HookDependency) => {
  const [tokenBalance, setBalance] = useState('0.00');
  const sdk = useContractSDK();

  const getTokenBalance = useCallback(async () => {
    if (!sdk || !account) return;
    try {
      const value = await sdk.sqToken.balanceOf(account);
      const balance = Number(formatUnits(value, 18)).toFixed(2);
      setBalance(balance);
    } catch (e) {
      console.error('Get token balance failed for:', account);
    }
  }, [account, sdk]);

  useEffect(() => {
    getTokenBalance();
  }, [getTokenBalance, deps]);

  return { tokenBalance, getTokenBalance };
};

export const useIndexerMetadata = (account: string) => {
  const sdk = useContractSDK();
  const [metadata, setMetadata] = useState<IndexerMetadata>();
  const [loading, setLoading] = useState(false);
  const fetchMetadata = useCallback(async () => {
    if (!account) return;
    try {
      setLoading(true);
      const metadataHash = await sdk?.indexerRegistry.metadata(account);
      if (!metadataHash) return;

      const metadata = await cat(bytes32ToCid(metadataHash));
      setMetadata(metadata);
    } catch {
      console.error('Failed to get indexer metadata');
    } finally {
      setLoading(false);
    }
  }, [sdk, account]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  return { loading, metadata, fetchMetadata };
};
