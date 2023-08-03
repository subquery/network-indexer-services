import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { ProjectModule } from '../project/project.module';
import { MonitorService } from './monitor.service';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [CoreModule, ProjectModule, ScheduleModule.forRoot()],
  providers: [MonitorService],
})
export class MonitorModule {}
