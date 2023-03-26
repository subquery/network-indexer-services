// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { AccountService } from 'src/account/account.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SetMetricEvent } from './events';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../../package.json');

@Injectable()
export class CoordinatorMetricsService {
  constructor(private accountService: AccountService, protected eventEmitter: EventEmitter2) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  handleCron() {
    this.pushServiceInfo();
  }

  public async pushServiceInfo() {
    const indexer = await this.accountService.getIndexer();
    if (!indexer) return;

    this.eventEmitter.emit(SetMetricEvent.CoordinatorVersion, {
      value: version,
      indexer,
    });
  }
}
