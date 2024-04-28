// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { DynamicModule, Global, Module } from '@nestjs/common';
import { argv, PostgresKeys } from '../yargs';

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
  readonly networkEndpoint: string;
  readonly port: number;
  readonly postgres: Postgres;
  readonly debug: boolean;
  readonly secret: string;
  readonly startPort: number;
  readonly dockerNetwork: string;
}

export class Config implements IConfig {
  static fromArgs(): Config {
    const postgres = {
      user: argv[PostgresKeys.username],
      host: argv[PostgresKeys.host],
      port: argv[PostgresKeys.port],
      pass: argv[PostgresKeys.password],
      db: argv[PostgresKeys.database],
    };

    return new Config({
      network: argv['network'] as Network,
      networkEndpoint: argv['network-endpoint'],
      port: argv['port'],
      debug: argv['debug'],
      secret: argv['secret-key'],
      startPort: argv['start-port'],
      dockerNetwork: argv['docker-network'],
      postgres,
    });
  }

  constructor(private readonly _config: IConfig) {}

  get network(): Network {
    return this._config.network;
  }

  get networkEndpoint(): string {
    return this._config.networkEndpoint;
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

  get secret(): string {
    return this._config.secret;
  }

  get startPort(): number {
    return this._config.startPort;
  }

  get dockerNetwork(): string {
    return this._config.dockerNetwork;
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
