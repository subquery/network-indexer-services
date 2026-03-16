// Copyright 2020-2025 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { defineConfig } from 'vite';
import path from 'path';
import EnvironmentPlugin from 'vite-plugin-environment';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

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
      styles: resolve(__dirname, 'src/styles/'),
      conf: resolve(__dirname, 'src/conf/'),
    },
  },
  plugins: [
    EnvironmentPlugin('all'),
    react(),
    nodePolyfills({
      exclude: ['buffer'],
    }),
  ],
  build: {
    outDir: 'build',
  },
});
