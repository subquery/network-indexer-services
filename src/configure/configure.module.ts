// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { DynamicModule, Global, Module } from '@nestjs/common';
import { getYargsOption, PostgresKeys } from '../yargs';

type Network = 'local' | 'dev' | 'prod';

export type Postgres = {
  user: string;
  pass: string;
  host: string;
  port: number;
  db: string;
};

export interface IConfig {
  readonly network: Network;
  readonly wsEndpoint: string;
  readonly port: number;
  readonly postgres: Postgres;
  readonly debug: boolean;
  readonly dev: boolean;
  readonly secret: string;
}

// const default_pushgateway = 'https://pushgateway-kong-dev.onfinality.me';

export class Config implements IConfig {
  public static fromArgs(): Config {
    const { argv } = getYargsOption();

    const postgres = {
      user: argv[PostgresKeys.username],
      host: argv[PostgresKeys.host],
      port: argv[PostgresKeys.port],
      pass: argv[PostgresKeys.password],
      db: argv[PostgresKeys.database],
    };

    return new Config({
      network: argv['network'] as Network,
      wsEndpoint: argv['ws-endpoint'],
      port: argv['port'] as number,
      debug: argv['debug'] as boolean,
      dev: argv['dev'] as boolean,
      secret: argv['secret'],
      postgres,
    });
  }

  constructor(private readonly _config: IConfig) {}

  get network(): Network {
    return this._config.network;
  }

  get wsEndpoint(): string {
    return this._config.wsEndpoint;
  }

  get port(): number {
    return this._config.port;
  }

  get postgres(): Postgres {
    return this._config.postgres;
  }

  get debug(): boolean {
    return this._config.debug;
  }

  get dev(): boolean {
    return this._config.dev;
  }

  get secret(): string {
    return this._config.secret;
  }
}

@Global()
@Module({})
export class ConfigureModule {
  static register(): DynamicModule {
    const config = Config.fromArgs();

    return {
      module: ConfigureModule,
      providers: [
        {
          provide: Config,
          useValue: config,
        },
      ],
      exports: [Config],
    };
  }
}
