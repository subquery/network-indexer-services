// Copyright 2020-2021 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';

export function getYargsOption() {
  return yargs(hideBin(process.argv)).options({
    network: {
      alias: 'n',
      demandOption: false,
      describe: 'Network type for the service',
      type: 'string',
      choices: ['local', 'dev', 'prod'],
      default: 'local'
    },
    'ws-endpoint': {
      alias: 'ws',
      type: 'string',
      describe: 'Specify wss endpoint for this network',
    },
    port: {
      alias: 'p',
      type: 'number',
      describe: 'Port the service will listen on',
      default: 3001,
    }
  });
}

export function argv(arg: string): unknown {
  return getYargsOption().argv[arg];
}
