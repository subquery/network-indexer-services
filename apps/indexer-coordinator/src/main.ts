// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getLogger, LogCategory, NestLogger } from './utils/logger';
import { argv } from './yargs';

async function bootstrap() {
  try {
    const port = argv.port;
    const app = await NestFactory.create(AppModule, { logger: new NestLogger() });

    app.enableCors({
      origin: '*',
      credentials: true,
    });

    await app.listen(port);
    getLogger(LogCategory.coordinator).info('coordinator service started');
    getLogger(LogCategory.admin).info('indexer admin app started');
  } catch (e) {
    getLogger(LogCategory.coordinator).error(e, 'coordinator service failed');
  }
}

void bootstrap();
