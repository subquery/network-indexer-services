// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { IntegrationEntity } from './integration.model';
import { IntegrationService } from './integration.service';

@Resolver(() => IntegrationEntity)
export class IntegrationResolver {
  constructor(private integrationService: IntegrationService) {}

  @Query(() => [IntegrationEntity])
  async allIntegration(): Promise<IntegrationEntity[]> {
    return await this.integrationService.getAll();
  }
}
