// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { providers } from 'ethers';
import { argv } from '../yargs';

let ethProvider: providers.StaticJsonRpcProvider;

export function getEthProvider(): providers.StaticJsonRpcProvider {
  if (!ethProvider) {
    const ethJsonRpcUrl = argv['eth-endpoint'];
    ethProvider = new providers.StaticJsonRpcProvider(ethJsonRpcUrl);
  }
  return ethProvider;
}
