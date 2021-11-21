import { Injectable } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import { getLogger } from 'src/utils/logger';

type Network =  'local' | 'dev' | 'prod';
const networks = ['local', 'dev', 'prod'];

interface BasicCommandOptions {
  network?: Network;
  wss?: string;
}

@Command({ name: 'basic', description: 'Basic config parameters', options: { isDefault: true } })
export class BasicCommand implements CommandRunner {
  private _options: BasicCommandOptions;

  async run(
    passedParam: string[],
    options?: BasicCommandOptions
  ): Promise<void> {
    console.log('>>>>set options:', options);
    this._options = options;
  }

  @Option({
    flags: "-n, --network ['local', 'dev', 'prod']",
    description: 'Network type for the service',
    defaultValue: 'local'
  })
  parseNetwork(val: Network) {
    if (!networks.includes(val)) {
      console.error(`Invalid network type: ${val}`);
      process.exit(1);
    }
    return val;
  }

  @Option({
    flags: '-wss, --wss-endpoint [string]',
    description: 'Specify wss endpoint for this network',
    required: false
  })
  parseString(val: string) {
    return val;
  }

  // getters
  get network(): Network {
    console.log('>>>>get options:', this._options);
    return this._options.network;
  }

  get wss(): string {
    return this._options.wss;
  }
}