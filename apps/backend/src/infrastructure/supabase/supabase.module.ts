import { Module, Logger, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseService } from './supabase.service.js';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class SupabaseModule {
  private readonly logger = new Logger(SupabaseModule.name);

  constructor() {
    this.logger.debug('SupabaseModule constructor called');
  }

  onModuleInit() {
    this.logger.debug('SupabaseModule initialized');
  }
}
