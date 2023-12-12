// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatUnits } from '@ethersproject/units';

import { useAccount } from 'containers/account';
import { useContractSDK } from 'containers/contractSdk';
import { useCoordinatorIndexer } from 'containers/coordinatorIndexer';
import { notificationMsg } from 'containers/notificationContext';
import { useWeb3 } from 'hooks/web3Hook';
import { Account, IndexerMetadata } from 'pages/account/types';
import { HookDependency } from 'types/types';
import { emptyControllerAccount } from 'utils/indexerActions';
import { bytes32ToCid, cat } from 'utils/ipfs';

// indexer save inside coordinator service
const useIsCoordinatorIndexer = (): boolean => {
  const { indexer } = useCoordinatorIndexer();
  const { account } = useAccount();

  return useMemo(() => !!account && !!indexer && account === indexer, [account, indexer]);
};

export const useIsRegistedIndexer = (): boolean | undefined => {
  const sdk = useContractSDK();
  const { isRegisterIndexer, updateIsRegisterIndexer, account } = useAccount();

  const getIsIndexer = useCallback(async () => {
    if (!account || !sdk) return;

    try {
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
    }
  }, [account, sdk, updateIsRegisterIndexer]);

  useEffect(() => {
    getIsIndexer();
  }, [getIsIndexer, account]);

  return isRegisterIndexer;
};

export const useIsIndexer = (): boolean | undefined => {
  const isRegisteredIndexer = useIsRegistedIndexer();
  const isCoordinatorIndexer = useIsCoordinatorIndexer();

  return useMemo(
    () => isCoordinatorIndexer && isRegisteredIndexer,
    [isCoordinatorIndexer, isRegisteredIndexer]
  );
};

// TODO: refactor these hooks
// 1. using `useMemo` | `useCallback` to replace custome useState
// 2. using try catch | async await other than promise
/* eslint-disable */
export const useIsController = (account: Account) => {
  const [isController, setIsController] = useState(false);
  // TODO: get controller from subquery project
  return isController;
};
/* eslint-enable */

export const useController = () => {
  const [controller, setController] = useState<string>();
  const { account } = useAccount();
  const sdk = useContractSDK();

  const getController = useCallback(async () => {
    try {
      const controller = await sdk?.indexerRegistry.getController(account ?? '');
      setController(controller === emptyControllerAccount ? '' : controller);
    } catch {
      setController(undefined);
    }
  }, [account, sdk]);

  useEffect(() => {
    getController();
  }, [getController]);

  return { controller, getController };
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

export const useBalance = (account: Account) => {
  const [balance, setBalance] = useState<string>();
  const { library } = useWeb3();

  const getBalance = useCallback(async () => {
    if (!account || !library) return;
    try {
      const value = await library?.getBalance(account);
      const fixedValue = Number(formatUnits(value, 18)).toFixed(4);
      setBalance(fixedValue);
    } catch (e) {
      console.error('Get balance failed for:', account);
    }
  }, [account, library]);

  useEffect(() => {
    getBalance();
  }, [getBalance]);

  return balance;
};

export const useIndexerMetadata = () => {
  const { account } = useAccount();
  const sdk = useContractSDK();
  const [metadata, setMetadata] = useState<IndexerMetadata>();

  const fetchMetadata = useCallback(async () => {
    if (!account) return;
    try {
      const metadataHash = await sdk?.indexerRegistry.metadata(account);
      if (!metadataHash) return;

      const metadata = await cat(bytes32ToCid(metadataHash));
      setMetadata(metadata);
    } catch {
      console.error('Failed to get indexer metadata');
    }
  }, [sdk, account]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  return { metadata, fetchMetadata };
};
