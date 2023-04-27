// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Query, Resolver } from '@nestjs/graphql';

import { VersionsService } from './versions.service';
import { VersionMetrics } from './metrics.model';

@Resolver(() => VersionMetrics)
export class ProjectResolver {
  constructor(private versionsService: VersionsService) {}

  @Query(() => Promise<VersionMetrics>)
  getServicesVersion() {
    return this.versionsService.getVersions();
  }
}
