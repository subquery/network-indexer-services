// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SeviceEndpoint } from '../project/project.model';
import { IntegrationType } from '../project/types';
import { IntegrationEntity } from './integration.model';
import { IntegrationService } from './integration.service';

@Resolver(() => IntegrationEntity)
export class IntegrationResolver {
  constructor(private integrationService: IntegrationService) {}

  @Query(() => [IntegrationEntity])
  async allIntegration(): Promise<IntegrationEntity[]> {
    return await this.integrationService.getAll();
  }

  @Mutation(() => IntegrationEntity)
  addIntegration(
    @Args('title') title: string,
    @Args('type') type: IntegrationType,
    @Args('serviceEndpoints') serviceEndpoints: SeviceEndpoint[]
  ): Promise<IntegrationEntity> {
    return this.integrationService.create(title, type, serviceEndpoints);
  }
}
