// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { AccountAction } from 'pages/project-details/types';

export type Account = string | null | undefined;

export type AccountButtonItem = {
  title: string;
  type?: AccountAction;
  loading?: boolean;
  disabled?: boolean;
  onClick: (type?: AccountAction) => void;
};

export type IndexerMetadata = {
  name: string;
  url: string;
};
