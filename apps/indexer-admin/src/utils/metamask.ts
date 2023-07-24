// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable */
// @ts-nocheck

import { NetworkToChainID, NETWORK_CONFIGS } from 'utils/web3';
import { intToHex } from 'ethereumjs-util';
import { connect } from 'containers/web3';

export const NetworkError = {
  unSupportedNetworkError: 'UnsupportedChainIdError',
};

const ethMethods = {
  requestAccount: 'eth_requestAccounts',
  switchChain: 'wallet_switchEthereumChain',
  addChain: 'wallet_addEthereumChain',
}

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
  const network = process.env.REACT_APP_NETWORK || window.env.NETWORK;
  const chainId = NetworkToChainID[network];
  if (!window?.ethereum || !network) return;

  try {
    await window.ethereum.request({
      method: ethMethods.switchChain,
      params: [{ chainId: chainId }],
    })
  } catch (e) {
    console.log('e:', e);
    if (e.code === 4902) {
      await ethereum.request({
        method: ethMethods.addChain,
        params: [NETWORK_CONFIGS[chainId]],
      })
    } else {
      console.log('Switch Ethereum network failed', e);
    }
  }
}
