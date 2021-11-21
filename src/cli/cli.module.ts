import { Module } from '@nestjs/common';
import { BasicCommand } from './cli.command';

@Module({
  providers: [BasicCommand],
  exports: [BasicCommand]
})
export class CliModule {}