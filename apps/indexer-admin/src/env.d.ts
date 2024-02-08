// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Buffer } from 'buffer';

import 'vite/client';

declare global {
  interface Window {
    ethereum?: any;
    Buffer: typeof Buffer;
    env: Record<string, string>;
  }
}
