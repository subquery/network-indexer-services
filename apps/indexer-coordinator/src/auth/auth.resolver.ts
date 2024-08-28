// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { Public, SignData } from './types';

@Resolver()
export class AuthResolver {
  constructor(private authService: AuthService) {}

  @Public()
  @Mutation(() => Boolean)
  async setPassword(
    @Args('password') password: string,
    @Args('data') data: SignData
  ): Promise<boolean> {
    await this.authService.setPassword(password, data);
    return Promise.resolve(true);
  }

  @Public()
  @Query(() => String)
  async signIn(@Args('password') password: string): Promise<string> {
    return await this.authService.signIn(password);
  }
}
