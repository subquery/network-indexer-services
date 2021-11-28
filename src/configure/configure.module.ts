
import { DynamicModule, Global, Module } from '@nestjs/common';
import { getYargsOption } from '../yargs';

type Network = 'local' | 'dev' | 'prod';

export interface IConfig {
  readonly network: Network;
  readonly wsEndpoint: string;
  readonly port: number;
}

export class Config implements IConfig {

  public static fromArgs(): Config {
    const { argv } = getYargsOption();

    return new Config({
      network: argv['network'] as Network,
      wsEndpoint: argv['ws-endpoint'],
      port: argv['port'] as number,
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
