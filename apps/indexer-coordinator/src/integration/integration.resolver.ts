// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SeviceEndpoint } from '../project/project.model';
import { IntegrationType, LLMConfig, LLMExtra } from '../project/types';
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
    @Args('serviceEndpoints', { type: () => [SeviceEndpoint] })
    serviceEndpoints: SeviceEndpoint[],

    @Args('config', { nullable: true }) config?: LLMConfig,
    @Args('extra', { nullable: true }) extra?: LLMExtra
  ): Promise<IntegrationEntity> {
    return this.integrationService.create(title, type, serviceEndpoints, config, extra);
  }

  @Mutation(() => IntegrationEntity)
  updateIntegration(
    @Args('id') id: number,
    @Args('title') title: string,
    @Args('serviceEndpoints', { type: () => [SeviceEndpoint] })
    serviceEndpoints: SeviceEndpoint[],
    @Args('enabled') enabled: boolean,
    @Args('config', { nullable: true }) config?: LLMConfig,
    @Args('extra', { nullable: true }) extra?: LLMExtra
  ): Promise<IntegrationEntity> {
    return this.integrationService.update(id, title, serviceEndpoints, enabled, config, extra);
  }
}
