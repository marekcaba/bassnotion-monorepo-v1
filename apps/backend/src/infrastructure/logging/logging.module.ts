import { Module, Global } from '@nestjs/common';
import { LogAggregatorService } from './log-aggregator.service.js';
import { LogTransportService } from './log-transport.service.js';
import { LogsController } from './logs.controller.js';
import { DatabaseModule } from '../database/database.module.js';
import { SharedModule } from '../../shared/shared.module.js';

@Global()
@Module({
  imports: [DatabaseModule, SharedModule],
  controllers: [LogsController],
  providers: [LogAggregatorService, LogTransportService],
  exports: [LogAggregatorService, LogTransportService],
})
export class LoggingModule {}
