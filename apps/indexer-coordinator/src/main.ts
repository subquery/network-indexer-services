// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getLogger, LogCategory, NestLogger } from './utils/logger';
import { argv } from './yargs';

async function bootstrap() {
  try {
    const port = argv('port') as number;
    const app = await NestFactory.create(AppModule, { logger: new NestLogger() });
    await app.listen(port);
    getLogger(LogCategory.coordinator).info('coordinator service started');
    getLogger(LogCategory.admin).info('indexer admin app started');
  } catch (e) {
    getLogger(LogCategory.coordinator).error(e, 'coordinator service failed');
  }
}
void bootstrap();
