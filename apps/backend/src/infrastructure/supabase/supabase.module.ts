import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { createStructuredLogger } from '@bassnotion/contracts';
import { SupabaseService } from './supabase.service.js';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class SupabaseModule {
  private readonly staticLogger = createStructuredLogger(SupabaseModule.name);

  constructor() {
    this.staticLogger.debug('SupabaseModule constructor called');
  }

  onModuleInit() {
    this.staticLogger.debug('SupabaseModule initialized');
  }
}
