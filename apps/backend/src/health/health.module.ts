import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';
import { DatabaseModule } from '../infrastructure/database/database.module.js';

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService] })
export class HealthModule {}
