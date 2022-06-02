// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ContractSDK, SubqueryNetwork, SdkOptions } from '@subql/contract-sdk';
import testnetDeployment from '@subql/contract-sdk/publish/testnet.json';
import { EvmRpcProvider, calcEthereumTransactionParams } from '@acala-network/eth-providers';
import { Signer, utils } from 'ethers';

const deployments = {
  local: testnetDeployment,
  testnet: testnetDeployment,
  mainnet: testnetDeployment,
};

export enum ChainID {
  local = 1281,
  testnet = 595,
  mainnet = 1285,
}

function createContractOptions(network: SubqueryNetwork): SdkOptions {
  return {
    deploymentDetails: deployments[network],
    network,
  };
}

export const chainIds: Record<string, number> = {
  local: ChainID.local,
  testnet: ChainID.testnet,
  mainnet: ChainID.mainnet,
};

const options = {
  [ChainID.local]: createContractOptions('local'),
  [ChainID.testnet]: createContractOptions('testnet'),
  [ChainID.mainnet]: createContractOptions('mainnet'),
};

export async function initContractSDK(provider: Signer, chainID: ChainID): Promise<ContractSDK> {
  const sdk = await ContractSDK.create(provider, options[chainID]);
  return sdk;
}

export function cidToBytes32(cid: string): string {
  return `0x${Buffer.from(utils.base58.decode(cid)).slice(2).toString('hex')}`;
}

// TODO: move to config file
export const substrateUrl =
  'wss://node-6870830370282213376.rz.onfinality.io/ws?apikey=0f273197-e4d5-45e2-b23e-03b015cb7000';

export async function getOverrides() {
  const provider = EvmRpcProvider.from(substrateUrl);
  const txFeePerGas = '199999946752';
  const storageByteDeposit = '100000000000000';
  const blockNumber = await provider.getBlockNumber();

  const ethParams = calcEthereumTransactionParams({
    gasLimit: '31000000',
    validUntil: (blockNumber + 100).toString(),
    storageLimit: '64001',
    txFeePerGas,
    storageByteDeposit,
  });

  const overrides = {
    gasLimit: ethParams.txGasLimit,
    gasPrice: ethParams.txGasPrice,
    type: 0,
  };

  return overrides;
}
