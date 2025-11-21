import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { createStructuredLogger } from '@bassnotion/contracts';
import { DatabaseService } from './database.service.js';
import { DatabaseCoreService } from './database-core.service.js';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [DatabaseService, DatabaseCoreService],
  exports: [DatabaseService, DatabaseCoreService] })
export class DatabaseModule {
  private readonly staticLogger = createStructuredLogger(DatabaseModule.name);

  constructor() {
    this.staticLogger.debug('DatabaseModule constructor called');
  }

  onModuleInit() {
    this.staticLogger.debug('DatabaseModule initialized');
  }
}
