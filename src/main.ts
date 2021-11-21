import { NestFactory } from '@nestjs/core';
import { CommandFactory } from 'nest-commander';
import { AppModule } from './app.module';
import { getLogger, LogCategory, NestLogger } from './utils/logger';
import { CliModule } from './cli/cli.module';

async function bootstrap() {
  try {
    // TODO: fix cli issue
    await CommandFactory.run(CliModule);
    const app = await NestFactory.create(AppModule, { logger: new NestLogger() });
    await app.listen(3001);
    getLogger(LogCategory).info('coordinator service started');
  } catch (e) {
    getLogger(LogCategory).error(e, 'coordinator service failed');
  }
}
bootstrap();
