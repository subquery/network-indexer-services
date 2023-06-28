// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react';

import { createContainer } from './unstated';

type LoadingContext = {
  pageLoading: boolean;
  setPageLoading: (loading: boolean) => void;
};

function useLoadingImpl(): LoadingContext {
  const [pageLoading, setPageLoading] = useState<boolean>(false);
  return { pageLoading, setPageLoading };
}

export const { useContainer: useLoading, Provider: LoadingProvider } = createContainer(
  useLoadingImpl,
  { displayName: 'Global Loading' }
);
