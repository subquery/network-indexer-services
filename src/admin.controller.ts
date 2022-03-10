// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Controller, Get, Header } from '@nestjs/common';
import { argv } from './yargs';

// TODO: config for `mainnet` | `testnet`
@Controller()
export class AdminController {
  getProxyServiceUrl() {
    const port = !!process.env.PROXY_PORT ? `:${process.env.PROXY_PORT}` : '';
    return `http://${argv('host')}${port}`;
  }

  @Get('env.js')
  @Header('content-type', 'text/javascript; charset=utf-8')
  getEnv() {
    const config = {
      NETWORK: `${argv('network')}`, // local | mainnet | testnet
      COORDINATOR_HOST: `http://${argv('host')}`,
      PROXY_SERVICE_URL: this.getProxyServiceUrl(),
      COORDINATOR_GRAPHQL: `http://${argv('host')}:${argv('port')}/graphql`,
      IPFS_GATEWAY: 'https://ipfs.thechainhub.com/api/v0',
      REGISTRY_PROJECT: 'https://api.subquery.network/sq/subquery/subquery-network-query-registry',
    };

    return `window.env = ${JSON.stringify(config)};`;
  }
}
