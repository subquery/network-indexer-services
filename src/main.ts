import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getLogger, LogCategory, NestLogger } from './utils/logger';
import { argv } from './yargs';

async function bootstrap() {
  try {
    const port = argv('port') as number;
    const app = await NestFactory.create(AppModule, { logger: new NestLogger() });
    await app.listen(port);
    getLogger(LogCategory).info('coordinator service started');
  } catch (e) {
    getLogger(LogCategory).error(e, 'coordinator service failed');
  }
}
bootstrap();
