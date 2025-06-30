import { Module, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseService } from './database.service.js';

@Module({
  imports: [ConfigModule],
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor() {
    this.logger.debug('DatabaseModule constructor called');
  }

  onModuleInit() {
    this.logger.debug('DatabaseModule initialized');
  }
}
