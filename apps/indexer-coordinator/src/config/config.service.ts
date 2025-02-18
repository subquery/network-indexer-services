// Copyright 2020-2025 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConfigEntity } from './config.model';

export enum ConfigType {
  FLEX_PRICE = 'flex_price',
  FLEX_VALID_PERIOD = 'flex_valid_period',
  FLEX_ENABLED = 'flex_enabled',
  ALLOCATION_REWARD_THRESHOLD = 'allocation_reward_threshold',
  ALLOCATION_REWARD_LAST_FORCE_TIME = 'allocation_reward_last_force_time',
  STATE_CHANNEL_REWARD_THRESHOLD = 'state_channel_reward_threshold',
  AUTO_REDUCE_ALLOCATION_ENABLED = 'auto_reduce_allocation_enabled',
}

const defaultConfig: Record<string, string> = {
  [ConfigType.FLEX_PRICE]: '100000000000000', // 0.0001 sqt per request
  [ConfigType.FLEX_VALID_PERIOD]: `${60 * 60 * 24 * 3}`, // 3 days
  [ConfigType.FLEX_ENABLED]: 'true',
  [ConfigType.ALLOCATION_REWARD_THRESHOLD]: '2000000000000000000000', // 2000 sqt
  [ConfigType.ALLOCATION_REWARD_LAST_FORCE_TIME]: '0',
  [ConfigType.STATE_CHANNEL_REWARD_THRESHOLD]: '2000000000000000000000', // 2000 sqt
  [ConfigType.AUTO_REDUCE_ALLOCATION_ENABLED]: 'true',
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

  async getAll(): Promise<ConfigEntity[]> {
    const cfs = await this.configRepo.find();
    const configMap = {};
    for (const c of cfs) {
      configMap[c.key] = c;
    }

    const res = [];
    for (const key in defaultConfig) {
      const c = new ConfigEntity();
      Object.assign(c, configMap[key] || { key, value: defaultConfig[key] });
      res.push(c);
    }
    return res;
  }

  async getFlexConfig(): Promise<Record<string, string>> {
    const keys = [ConfigType.FLEX_PRICE, ConfigType.FLEX_VALID_PERIOD, ConfigType.FLEX_ENABLED];
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
}
