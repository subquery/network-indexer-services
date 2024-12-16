// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ContractSDK, SdkOptions, SubqueryNetwork } from '@subql/contract-sdk';
// import keplerDeployment from '@subql/contract-sdk/publish/kepler.json';
// import mainnetDeployment from '@subql/contract-sdk/publish/mainnet.json';
// import testnetDeployment from '@subql/contract-sdk/publish/testnet.json';
import { Signer, providers } from 'ethers';
import { MultipleEndpointProvider } from './provider';

// const deployments = {
//   testnet: testnetDeployment,
//   kepler: keplerDeployment,
//   mainnet: mainnetDeployment,
// };

export enum ChainID {
  testnet = '0x14a34',
  'testnet-mumbai' = '0x13881',
  local = '0x7A69',
  mainnet = '0x2105',
}

export const ChainIDs = [
  ChainID.testnet,
  ChainID.local,
  ChainID.mainnet,
  ChainID['testnet-mumbai'],
];

function createContractOptions(network: SubqueryNetwork): SdkOptions {
  return {
    network,
    // deploymentDetails: deployments[network],
  };
}

export const networkToChainID: Record<SubqueryNetwork, ChainID> = {
  testnet: ChainID.testnet,
  'testnet-mumbai': ChainID['testnet-mumbai'],
  local: ChainID.local,
  mainnet: ChainID.mainnet,
};

export const sdkOptions = {
  [ChainID.testnet]: createContractOptions('testnet'),
  [ChainID['testnet-mumbai']]: createContractOptions('testnet-mumbai'),
  [ChainID.local]: createContractOptions('local'),
  [ChainID.mainnet]: createContractOptions('mainnet'),
};

export function initProvider(endpoint: string, chainID: string, logger?: any) {
  // return new providers.StaticJsonRpcProvider(endpoint, parseInt(chainID, 16));

  const endpoints = endpoint.split(',');
  return new MultipleEndpointProvider({
    endpoints,
    chainID,
    logger,
  });
}

export function initContractSDK(
  provider: providers.StaticJsonRpcProvider | Signer,
  chainID: ChainID
): ContractSDK {
  return ContractSDK.create(provider, sdkOptions[chainID]);
}
