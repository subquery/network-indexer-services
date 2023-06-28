// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useState } from 'react';
import { JsonRpcSigner } from '@ethersproject/providers';
import { useWeb3React } from '@web3-react/core';
import { Web3ReactContextInterface } from '@web3-react/core/dist/types';
import { providers } from 'ethers';
import { isEmpty } from 'lodash';

import { useAccount } from 'containers/account';
import { useCoordinatorIndexer } from 'containers/coordinatorIndexer';
import { useLoading } from 'containers/loadingContext';

export function useIsMetaMaskInstalled(): boolean {
  return useMemo(() => window.ethereum?.isMetaMask, []);
}

export const useWeb3 = (): Web3ReactContextInterface<providers.Web3Provider> => useWeb3React();

export function useWeb3Provider(): providers.Web3Provider | undefined {
  const { library } = useWeb3();
  return library;
}

export type Signer = JsonRpcSigner | undefined;

export function useSigner(): Signer {
  const { library } = useWeb3();
  return useMemo(() => library?.getSigner(), [library]);
}

export function useIsMetaMask(): boolean | undefined {
  const { library } = useWeb3();
  return useMemo(() => library?.provider?.isMetaMask, [library?.provider?.isMetaMask]);
}

export function useShowMetaMask(): boolean | undefined {
  const { account } = useWeb3();
  const { pageLoading, setPageLoading } = useLoading();
  const { indexer, load } = useCoordinatorIndexer();
  const isMetaMaskInstalled = useIsMetaMaskInstalled();
  const isMetaMask = useIsMetaMask();

  const { account: _account, updateAccount } = useAccount();

  useEffect(() => {
    if (account && _account !== account) updateAccount(account);
  }, [_account, account, updateAccount]);

  const isIndexer = useMemo(
    () => !!account && account?.toLowerCase() === indexer?.toLowerCase(),
    [account, indexer]
  );

  const [showMetaMask, setShowMetaMask] = useState<boolean>();

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const metamaskAvailable = isMetaMaskInstalled && isMetaMask;
    if (!metamaskAvailable) {
      setPageLoading(false);
    }

    const enable = (!pageLoading && !isIndexer && !isEmpty(indexer)) || !metamaskAvailable;
    setShowMetaMask(enable);
  }, [account, indexer, isIndexer, isMetaMask, isMetaMaskInstalled, pageLoading, setPageLoading]);

  return showMetaMask;
}
