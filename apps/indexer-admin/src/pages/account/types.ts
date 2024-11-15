// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
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
  description?: string;
  url: string;
};
