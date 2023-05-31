// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ContractSDK, SdkOptions } from '@subql/contract-sdk';
import testnetDeployment from '@subql/contract-sdk/publish/testnet.json';
import keplerDeployment from '@subql/contract-sdk/publish/kepler.json';
import mainnetDeployment from '@subql/contract-sdk/publish/mainnet.json';
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

export function initContractSDK(
  provider: providers.StaticJsonRpcProvider | Signer,
  chainID: ChainID,
): ContractSDK {
  const sdk = new ContractSDK(provider, sdkOptions[chainID]);
  return sdk;
}
