// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
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
  STATE_CHANNEL_REWARD_THRESHOLD = 'state_channel_reward_threshold',
}

const defaultConfig: Record<string, string> = {
  [ConfigType.FLEX_PRICE]: '1000000000000000000', // 1 sqt per 1000 requests
  [ConfigType.FLEX_VALID_PERIOD]: `${60 * 60 * 24 * 14}`, // 14 days
  [ConfigType.FLEX_ENABLED]: 'true',
  [ConfigType.ALLOCATION_REWARD_THRESHOLD]: '2000000000000000000000', // 2000 sqt
  [ConfigType.STATE_CHANNEL_REWARD_THRESHOLD]: '2000000000000000000000', // 2000 sqt
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
    return await this.configRepo.find();
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
