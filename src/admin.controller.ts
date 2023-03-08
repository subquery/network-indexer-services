// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Controller, Get, Header } from '@nestjs/common';
import { NETWORK_CONFIGS, SQNetworks } from '@subql/network-clients';
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
      REGISTRY_PROJECT: NETWORK_CONFIGS[argv('network') as SQNetworks].gql.explorer,
    };

    return `window.env = ${JSON.stringify(config)};`;
  }
}
