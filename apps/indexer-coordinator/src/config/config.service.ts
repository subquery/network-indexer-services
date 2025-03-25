// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConfigEntity } from './config.model';

export enum ConfigType {
  FLEX_PRICE = 'flex_price',
  FLEX_PRICE_RATIO = 'flex_price_ratio',
  FLEX_VALID_PERIOD = 'flex_valid_period',
  FLEX_ENABLED = 'flex_enabled',
  ALLOCATION_REWARD_THRESHOLD = 'allocation_reward_threshold',
  ALLOCATION_REWARD_LAST_FORCE_TIME = 'allocation_reward_last_force_time',
  STATE_CHANNEL_REWARD_THRESHOLD = 'state_channel_reward_threshold',
  AUTO_REDUCE_ALLOCATION_ENABLED = 'auto_reduce_allocation_enabled',
  TIP_DOMINANT_PRICE = 'tip_dominant_price',
}

const defaultConfig: Record<string, string> = {
  [ConfigType.FLEX_PRICE]: '100000000000000', // 0.0001 sqt per request
  [ConfigType.FLEX_PRICE_RATIO]: '80',
  [ConfigType.FLEX_VALID_PERIOD]: `${60 * 60 * 24 * 3}`, // 3 days
  [ConfigType.FLEX_ENABLED]: 'true',
  [ConfigType.ALLOCATION_REWARD_THRESHOLD]: '2000000000000000000000', // 2000 sqt
  [ConfigType.ALLOCATION_REWARD_LAST_FORCE_TIME]: '0',
  [ConfigType.STATE_CHANNEL_REWARD_THRESHOLD]: '2000000000000000000000', // 2000 sqt
  [ConfigType.AUTO_REDUCE_ALLOCATION_ENABLED]: 'true',
  [ConfigType.TIP_DOMINANT_PRICE]: '1',
};

@Injectable()
export class ConfigService {
  constructor(
    @InjectRepository(ConfigEntity)
    private configRepo: Repository<ConfigEntity>
  ) {}

  async get(key: string): Promise<string> {
    const config = await this.configRepo.findOne({ where: { key } });
    return config?.value ?? (defaultConfig[key] || '');
  }

  async set(key: string, value: string): Promise<void> {
    await this.configRepo.upsert({ key, value }, ['key']);
  }

  async getAll(keys?: string[]): Promise<ConfigEntity[]> {
    keys = keys && keys.length ? keys : Object.keys(defaultConfig);
    const cfs = await this.configRepo.find({
      where: {
        key: In(keys),
      },
    });
    const configMap = {};
    for (const c of cfs) {
      configMap[c.key] = c;
    }

    const res = [];
    for (const k of keys) {
      const c = new ConfigEntity();
      Object.assign(c, configMap[k] || { key: k, value: defaultConfig[k] });
      res.push(c);
    }
    return res;
  }

  async getFlexConfig(): Promise<Record<string, string>> {
    const keys = [
      ConfigType.FLEX_PRICE,
      ConfigType.FLEX_PRICE_RATIO,
      ConfigType.FLEX_VALID_PERIOD,
      ConfigType.FLEX_ENABLED,
    ];
    const config = await this.configRepo.find({
      where: { key: In(keys) },
      select: ['key', 'value'],
    });
    const defaults = keys.reduce((acc, key) => {
      acc[key] = defaultConfig[key];
      return acc;
    }, {} as Record<string, string>);
    const data = config.reduce((acc, c) => {
      acc[c.key] = c.value || defaultConfig[c.key];
      return acc;
    }, {} as Record<string, string>);
    return Object.assign(defaults, data);
  }

  async getTips() {
    const keys = [ConfigType.TIP_DOMINANT_PRICE];
    const values = await this.getAll(keys);
    // for (const v of values) {
    //   if (v.key === ConfigType.TIP_DOMINANT_PRICE && v.value === '1') {
    //     await this.set(ConfigType.TIP_DOMINANT_PRICE, '0');
    //   }
    // }
    return values;
  }

  async getDefault(key: string) {
    return defaultConfig[key];
  }
}
