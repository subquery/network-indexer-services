// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ContractSDK, SdkOptions, SubqueryNetwork } from '@subql/contract-sdk';
// import keplerDeployment from '@subql/contract-sdk/publish/kepler.json';
// import mainnetDeployment from '@subql/contract-sdk/publish/mainnet.json';
// import testnetDeployment from '@subql/contract-sdk/publish/testnet.json';
import { Signer, providers } from 'ethers';

// const deployments = {
//   testnet: testnetDeployment,
//   kepler: keplerDeployment,
//   mainnet: mainnetDeployment,
// };

export enum ChainID {
  testnet = '0x13881',
  local = '0x7A69',
  mainnet = '0x89',
}

export const ChainIDs = [ChainID.testnet, ChainID.local, ChainID.mainnet];

function createContractOptions(network: SubqueryNetwork): SdkOptions {
  return {
    network,
    // deploymentDetails: deployments[network],
  };
}

export const networkToChainID: Record<SubqueryNetwork, ChainID> = {
  testnet: ChainID.testnet,
  local: ChainID.local,
  mainnet: ChainID.mainnet,
};

export const sdkOptions = {
  [ChainID.testnet]: createContractOptions('testnet'),
  [ChainID.local]: createContractOptions('local'),
  [ChainID.mainnet]: createContractOptions('mainnet'),
};

export function initProvider(endpoint: string, chainID: string) {
  return new providers.StaticJsonRpcProvider(endpoint, parseInt(chainID, 16));
}

export function initContractSDK(
  provider: providers.StaticJsonRpcProvider | Signer,
  chainID: ChainID
): ContractSDK {
  return ContractSDK.create(provider, sdkOptions[chainID]);
}
