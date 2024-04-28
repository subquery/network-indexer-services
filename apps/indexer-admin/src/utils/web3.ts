// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { SQNetworks } from '@subql/network-config';

export const network = (import.meta.env.VITE_APP_NETWORK ?? window.env.NETWORK) as SQNetworks;

export const SUPPORTED_NETWORK = (network ?? 'testnet') as SQNetworks;

export const PRODUCTION_NETWORK = SQNetworks.MAINNET;

export const tokenSymbols = {
  testnet: 'SQT',
  local: 'SQT',
  mainnet: 'SQT',
};

export const TOKEN_SYMBOL = tokenSymbols[network as keyof typeof tokenSymbols];

export enum ChainID {
  testnet = '0x14a34',
  mainnet = '0x2105',
  local = '0x14a34',
}

export const ChainIDs = [ChainID.testnet, ChainID.mainnet];

export const NetworkToChainID: Record<SQNetworks, ChainID> = {
  testnet: ChainID.testnet,
  mainnet: ChainID.mainnet,
  local: ChainID.local,
};

export const isSupportNetwork = (chaiId: ChainID) => ChainIDs.includes(chaiId);

export const RPC_URLS: Record<number, string> = {
  84532: 'https://sepolia.base.org',
  8453: import.meta.env.VITE_APP_RPC_ENDPOINT ?? 'https://mainnet.base.org',
};

export function hexToInt(hex: string) {
  return parseInt(hex, 16);
}

export const SUPPORTED_NETWORK_PROJECTS_EXPLORER =
  network === PRODUCTION_NETWORK
    ? 'https://app.subquery.network/'
    : 'https://dev.thechaindata.com/';
