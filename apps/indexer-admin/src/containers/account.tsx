// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react';

import { createContainer } from './unstated';

type TAccountContext = {
  isRegisterIndexer: boolean | undefined;
  updateIsRegisterIndexer: (isIndexer: boolean) => void;

  account: string | undefined;
  updateAccount: (account: string) => void;
};

function useAccountImpl(): TAccountContext {
  const [account, updateAccount] = useState<string>();
  const [isRegisterIndexer, updateIsRegisterIndexer] = useState<boolean>();

  return {
    account,
    updateAccount,
    isRegisterIndexer,
    updateIsRegisterIndexer,
  };
}

export const { useContainer: useAccount, Provider: AccountProvider } = createContainer(
  useAccountImpl,
  { displayName: 'Global Account' }
);
