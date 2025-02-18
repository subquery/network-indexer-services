// Copyright 2020-2025 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CoreModule } from '../core/core.module';
import { ProjectModule } from '../project/project.module';
import { MonitorService } from './monitor.service';

@Module({
  imports: [CoreModule, ProjectModule, ScheduleModule.forRoot()],
  providers: [MonitorService],
})
export class MonitorModule {}
