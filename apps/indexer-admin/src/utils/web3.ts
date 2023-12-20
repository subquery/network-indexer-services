// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { SQNetworks } from '@subql/network-config';

export const network = (import.meta.env.VITE_APP_NETWORK ?? window.env.NETWORK) as SQNetworks;

export const SUPPORTED_NETWORK = (network ?? 'testnet') as SQNetworks;

export const PRODUCTION_NETWORK = SQNetworks.MAINNET;

export const tokenSymbols = {
  testnet: 'SQT',
  kepler: 'kSQT',
  mainnet: 'SQT',
};

export const TOKEN_SYMBOL = tokenSymbols[network as keyof typeof tokenSymbols];

export enum ChainID {
  testnet = '0x13881',
  mainnet = '0x89',
  local = '0x13881',
}

export const ChainIDs = [ChainID.testnet, ChainID.mainnet];

export const NetworkToChainID: Record<SQNetworks, ChainID> = {
  testnet: ChainID.testnet,
  mainnet: ChainID.mainnet,
  local: ChainID.local,
};

export const isSupportNetwork = (chaiId: ChainID) => ChainIDs.includes(chaiId);

export const RPC_URLS: Record<number, string> = {
  80001: 'https://polygon-mumbai.infura.io/v3/4458cf4d1689497b9a38b1d6bbf05e78',
  137: import.meta.env.VITE_APP_RPC_ENDPOINT ?? 'https://polygon-rpc.com/',
};

export function hexToInt(hex: string) {
  return parseInt(hex, 16);
}

export const SUPPORTED_NETWORK_PROJECTS_EXPLORER =
  network === PRODUCTION_NETWORK
    ? 'https://kepler.subquery.network/'
    : 'https://kepler.thechaindata.com/';
