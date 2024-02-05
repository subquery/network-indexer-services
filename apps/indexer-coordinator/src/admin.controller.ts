// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Controller, Get, Header } from '@nestjs/common';
import { NETWORK_CONFIGS, SQNetworks } from '@subql/network-config';
import { argv } from './yargs';

@Controller()
export class AdminController {
  @Get('env.js')
  @Header('content-type', 'text/javascript; charset=utf-8')
  getEnv() {
    const config = {
      NETWORK: argv.network, //  mainnet| kepler | testnet
      COORDINATOR_SERVICE_PORT: argv.port,
      IPFS_GATEWAY: argv.ipfs,
      RPC_ENDPOINT: argv['network-endpoint'],
      REGISTRY_PROJECT: NETWORK_CONFIGS[argv.network as SQNetworks].gql.network,
    };

    return `window.env = ${JSON.stringify(config)};`;
  }
}
