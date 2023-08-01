// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { defineConfig } from 'vite';
import path from 'path';
import EnvironmentPlugin from 'vite-plugin-environment';

const { resolve } = path;

export default defineConfig({
  resolve: {
    alias: {
      src: resolve(__dirname, 'src/'),
      components: resolve(__dirname, 'src/components/'),
      hooks: resolve(__dirname, 'src/hooks/'),
      containers: resolve(__dirname, 'src/containers/'),
      pages: resolve(__dirname, 'src/pages/'),
      types: resolve(__dirname, 'src/types/'),
      utils: resolve(__dirname, 'src/utils/'),
      resources: resolve(__dirname, 'src/resources/'),
      contract: resolve(__dirname, 'src/contract/'),
    },
  },
  plugins: [EnvironmentPlugin('all')],
  define: {
    // By default, Vite doesn't include shims for NodeJS/
    // necessary for segment analytics lib to work
    global: {},
  },
});
