// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectModule } from '../project/project.module';
import { IntegrationEntity } from './integration.model';
import { IntegrationResolver } from './integration.resolver';
import { IntegrationService } from './integration.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([IntegrationEntity]),
    ProjectModule
  ],
  providers: [IntegrationService, IntegrationResolver],
  exports: [IntegrationService],
})
@Module({})
export class IntegrationModule {}
