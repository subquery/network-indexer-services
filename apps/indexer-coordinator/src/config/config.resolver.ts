// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ConfigEntity } from './config.model';
import { ConfigService } from './config.service';

@Resolver(() => ConfigEntity)
export class ConfigResolver {
  constructor(private configService: ConfigService) {}

  @Query(() => String)
  get(@Args('key') key: string): Promise<string> {
    return this.configService.get(key);
  }

  @Mutation(() => Boolean)
  async set(@Args('key') key: string, @Args('value') value: string): Promise<boolean> {
    await this.configService.set(key, value);
    return true;
  }

  @Query(() => [ConfigEntity])
  async getAll(): Promise<ConfigEntity[]> {
    return await this.configService.getAll();
  }
}
