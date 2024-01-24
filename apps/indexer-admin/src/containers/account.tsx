// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react';
import { useAccount as useAccountWagmi } from 'wagmi';

import { createContainer } from './unstated';

type TAccountContext = {
  isRegisterIndexer: boolean | undefined;
  updateIsRegisterIndexer: (isIndexer: boolean) => void;

  account: string | undefined;
};

function useAccountImpl(): TAccountContext {
  const { address: account } = useAccountWagmi();
  const [isRegisterIndexer, updateIsRegisterIndexer] = useState<boolean>();

  return {
    account,
    isRegisterIndexer,
    updateIsRegisterIndexer,
  };
}

export const { useContainer: useAccount, Provider: AccountProvider } = createContainer(
  useAccountImpl,
  { displayName: 'Global Account' }
);
