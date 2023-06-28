// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Spinner } from '@subql/components';

// TODO: remove this and use hooks from subql-hooks lib
export const asyncRender = (ready: boolean, component: any) => {
  return ready ? component : <Spinner />;
};
