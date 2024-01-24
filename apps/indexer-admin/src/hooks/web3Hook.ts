// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { JsonRpcSigner } from '@ethersproject/providers';
import { providers } from 'ethers';

import { useEthersProviderWithPublic, useEthersSigner } from './useEthersProvider';

export const useSignerOrProvider = () => {
  const { signer } = useEthersSigner();
  const provider = useEthersProviderWithPublic();

  return signer || provider;
};

export type Signer =
  | JsonRpcSigner
  | providers.JsonRpcProvider
  | providers.FallbackProvider
  | undefined;
