// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Query, Resolver } from '@nestjs/graphql';

import { VersionMetrics } from './metrics.model';
import { VersionsService } from './versions.service';

@Resolver(() => VersionMetrics)
export class MetricsResolver {
  constructor(private versionsService: VersionsService) {}

  @Query(() => VersionMetrics)
  getServicesVersion() {
    return this.versionsService.getVersions();
  }
}
