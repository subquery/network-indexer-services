// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { PropsWithChildren, useCallback, useEffect, VFC } from 'react';
import { networks } from '@subql/contract-sdk';
import { Web3ReactProvider } from '@web3-react/core';
import { Web3ReactManagerFunctions } from '@web3-react/core/dist/types';
import { InjectedConnector } from '@web3-react/injected-connector';
import { NetworkConnector } from '@web3-react/network-connector';
import { providers } from 'ethers';

import { useWeb3 } from 'hooks/web3Hook';
import { ChainID, hexToInt, NetworkToChainID, RPC_URLS } from 'utils/web3';

export const SUPPORTED_NETWORK = (import.meta.env.VITE_APP_NETWORK ||
  window.env.NETWORK) as keyof typeof NetworkToChainID;

export const STABLE_COIN_ADDRESS =
  SUPPORTED_NETWORK === 'testnet'
    ? '0x7E65A71046170A5b1AaB5C5cC64242EDF95CaBEA'
    : '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';

export const defaultChainId = parseInt(networks[SUPPORTED_NETWORK].chainId, 16);

const injectedConntector = new InjectedConnector({
  supportedChainIds: [defaultChainId],
});

const injectNetwork = (import.meta.env.VITE_APP_NETWORK ||
  window.env.NETWORK) as keyof typeof NetworkToChainID;

const networkConnector = new NetworkConnector({
  urls: RPC_URLS,
  defaultChainId: hexToInt(NetworkToChainID[injectNetwork] ?? ChainID.testnet),
});

const getLibrary = (provider: any): providers.Web3Provider => {
  return new providers.Web3Provider(provider);
};

export async function connect(activate: Web3ReactManagerFunctions['activate']): Promise<void> {
  if (await injectedConntector.isAuthorized()) {
    return activate(injectedConntector);
  }

  return activate(networkConnector);
}

const InitProvider: VFC = () => {
  const { activate } = useWeb3();
  const activateInitialConnector = useCallback(
    async (): Promise<void> => connect(activate),
    [activate]
  );

  useEffect(() => {
    activateInitialConnector();
  }, [activateInitialConnector]);

  return null;
};

export const Web3Provider: React.FC<PropsWithChildren> = ({ children }) => {
  return (
    <Web3ReactProvider getLibrary={getLibrary}>
      <InitProvider />
      {children}
    </Web3ReactProvider>
  );
};
