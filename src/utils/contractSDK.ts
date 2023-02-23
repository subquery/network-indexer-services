// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ContractSDK, SubqueryNetwork, SdkOptions } from '@subql/contract-sdk';
import mainnetDeployment from '@subql/contract-sdk/publish/mainnet.json';
import keplerDeployment from '@subql/contract-sdk/publish/kepler.json';
import testnetDeployment from '@subql/contract-sdk/publish/testnet.json';
import { Signer } from 'ethers';

const deployments = {
  mainnet: mainnetDeployment,
  kepler: keplerDeployment,
  testnet: testnetDeployment,
};

export enum ChainID {
  mainnet = 0, // TODO when launch
  kepler = 0, // TODO when launch
  testnet = 1287,
}

function createContractOptions(network: SubqueryNetwork): SdkOptions {
  return {
    deploymentDetails: deployments[network],
    network,
  };
}

export const chainIds: Record<string, number> = {
  mainnet: ChainID.mainnet,
  kepler: ChainID.kepler,
  testnet: ChainID.testnet,
};

const options = {
  [ChainID.mainnet]: createContractOptions('mainnet'),
  [ChainID.kepler]: createContractOptions('kepler'),
  [ChainID.testnet]: createContractOptions('testnet'),
};

export async function initContractSDK(provider: Signer, chainID: ChainID): Promise<ContractSDK> {
  const sdk = await ContractSDK.create(provider, options[chainID]);
  return sdk;
}
