// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ContractSDK, SdkOptions } from '@subql/contract-sdk';
import keplerDeployment from '@subql/contract-sdk/publish/kepler.json';
import mainnetDeployment from '@subql/contract-sdk/publish/mainnet.json';
import testnetDeployment from '@subql/contract-sdk/publish/testnet.json';
import { providers, Signer } from 'ethers';

const deployments = {
  testnet: testnetDeployment,
  kepler: keplerDeployment,
  mainnet: mainnetDeployment,
};

export enum ChainID {
  testnet = '0x13881',
  kepler = '0x89',
  mainnet = '0x89',
}

export const ChainIDs = [ChainID.testnet, ChainID.kepler, ChainID.mainnet];

type SubqueryNetwork = 'mainnet' | 'kepler' | 'testnet';

function createContractOptions(network: SubqueryNetwork): SdkOptions {
  return {
    deploymentDetails: deployments[network],
    network,
  };
}

export const networkToChainID: Record<SubqueryNetwork, ChainID> = {
  testnet: ChainID.testnet,
  kepler: ChainID.kepler,
  mainnet: ChainID.mainnet,
};

export const sdkOptions = {
  [ChainID.testnet]: createContractOptions('testnet'),
  [ChainID.kepler]: createContractOptions('kepler'),
};

export function initProvider(endpoint: string, chainID: string) {
  return new providers.StaticJsonRpcProvider(endpoint, parseInt(chainID, 16));
}

export function initContractSDK(
  provider: providers.StaticJsonRpcProvider | Signer,
  chainID: ChainID,
): ContractSDK {
  return new ContractSDK(provider, sdkOptions[chainID]);
}
