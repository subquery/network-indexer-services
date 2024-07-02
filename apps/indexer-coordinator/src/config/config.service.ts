// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigEntity } from './config.model';

export enum ConfigType {
  FLEX_PRICE = 'flex_price',
  FLEX_VALID_PERIOD = 'flex_valid_period',
  FLEX_ENABLED = 'flex_enabled',
}

const defaultConfig: Record<string, string> = {
  [ConfigType.FLEX_PRICE]: '10',
  [ConfigType.FLEX_VALID_PERIOD]: '10',
  [ConfigType.FLEX_ENABLED]: 'true',
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

  async getByGroup(group: string): Promise<Record<string, string>> {
    const datas = await this.configRepo.find({
      where: { group },
    });
    const res = {};
    for (const d of datas) {
      res[d.key] = d.value ?? (defaultConfig[d.key] || '');
    }
    return res;
  }

  async set(key: string, value: string): Promise<void> {
    await this.configRepo.upsert({ key, value }, ['key']);
  }
}
