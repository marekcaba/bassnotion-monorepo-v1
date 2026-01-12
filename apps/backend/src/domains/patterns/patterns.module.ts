/**
 * Patterns Module
 * NestJS module for the drum pattern library feature
 */

import { Module } from '@nestjs/common';
import { PatternsController } from './patterns.controller.js';
import { PatternsService } from './patterns.service.js';
import { AuthModule } from '../user/auth/auth.module.js';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module.js';
import { createStructuredLogger } from '@bassnotion/contracts';

@Module({
  imports: [AuthModule, SupabaseModule], // AuthGuard + Supabase for database access
  controllers: [PatternsController],
  providers: [PatternsService],
  exports: [PatternsService],
})
export class PatternsModule {
  private readonly logger = createStructuredLogger(PatternsModule.name);

  constructor() {
    this.logger.debug('PatternsModule constructor called');
  }

  onModuleInit() {
    this.logger.debug('PatternsModule initialized');
  }
}
