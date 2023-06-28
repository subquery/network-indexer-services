// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-var-requires */

const { resolve } = require('path');

module.exports = {
  webpack: {
    alias: {
      src: resolve(__dirname, 'src/'),
      components: resolve(__dirname, 'src/components'),
      hooks: resolve(__dirname, 'src/hooks'),
      container: resolve(__dirname, 'src/container'),
      pages: resolve(__dirname, 'src/pages'),
      types: resolve(__dirname, 'src/types'),
      utils: resolve(__dirname, 'src/utils'),
      resources: resolve(__dirname, 'src/resources'),
      contract: resolve(__dirname, 'src/contract'),
    },
  },
};
