// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

// @ts-nocheck
/* eslint-disable */
import { networks } from '@subql/contract-sdk';

import { connect } from 'containers/web3';
import { ChainID, network, NetworkToChainID } from 'utils/web3';

export const NetworkError = {
  unSupportedNetworkError: 'UnsupportedChainIdError',
};

const ethMethods = {
  requestAccount: 'eth_requestAccounts',
  switchChain: 'wallet_switchEthereumChain',
  addChain: 'wallet_addEthereumChain',
};

export const NETWORK_CONFIGS = {
  [ChainID.testnet]: networks.testnet,
  [ChainID.mainnet]: networks.mainnet,
};

export async function connectWithMetaMask(activate: Function) {
  if (!window.ethereum) return 'MetaMask is not installed';
  try {
    await window.ethereum.request({ method: ethMethods.requestAccount });
    await connect(activate);
    return '';
  } catch (e) {
    return e.message;
  }
}

export async function switchNetwork() {
  const chainId = NetworkToChainID[network];
  if (!window?.ethereum || !network) return;

  try {
    await window.ethereum.request({
      method: ethMethods.switchChain,
      params: [{ chainId }],
    });
  } catch (e) {
    console.log('e:', e);
    if (e.code === 4902) {
      await ethereum.request({
        method: ethMethods.addChain,
        params: [NETWORK_CONFIGS[chainId]],
      });
    } else {
      console.log('Switch Ethereum network failed', e);
    }
  }
}
