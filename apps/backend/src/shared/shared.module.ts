import { Module, Global } from '@nestjs/common';
import { RequestContextService } from './services/request-context.service.js';

/**
 * Global shared module that provides common services across the application
 */
@Global()
@Module({
  providers: [RequestContextService],
  exports: [RequestContextService] })
export class SharedModule {}