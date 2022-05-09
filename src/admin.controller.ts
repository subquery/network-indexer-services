// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Controller, Get, Header } from '@nestjs/common';
import { argv } from './yargs';

// TODO: config for `mainnet` | `testnet`
@Controller()
export class AdminController {
  @Get('env.js')
  @Header('content-type', 'text/javascript; charset=utf-8')
  getEnv() {
    const config = {
      NETWORK: `${argv('network')}`, // local | mainnet | testnet
      COORDINATOR_SERVICE_PORT: argv('port'),
      IPFS_GATEWAY: argv('ipfs'),
      REGISTRY_PROJECT: 'https://api.subquery.network/sq/subquery/subquery-network-query-registry',
    };

    return `window.env = ${JSON.stringify(config)};`;
  }
}
