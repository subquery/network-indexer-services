// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { networks } from '@subql/contract-sdk';

import { SUPPORTED_NETWORK } from './web3';

export function balanceSufficient(balance: string): boolean {
  return parseFloat(balance) > parseFloat('0.05');
}

export function openAccountExporer(account: string) {
  const { blockExplorerUrls } = networks[SUPPORTED_NETWORK];
  const blockExplorerUrl = blockExplorerUrls[0];
  const url = blockExplorerUrl.endsWith('/')
    ? `${blockExplorerUrl}address/${account}`
    : `${blockExplorerUrl}/address/${account}`;

  window.open(url, '_blank', 'noopener,noreferrer');
}
