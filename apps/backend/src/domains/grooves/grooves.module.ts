/**
 * Grooves Module — the reusable groove library domain.
 */

import { Module } from '@nestjs/common';
import { GroovesController } from './grooves.controller.js';
import { GroovesService } from './grooves.service.js';
import { AuthModule } from '../user/auth/auth.module.js';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module.js';
import { BillingModule } from '../billing/billing.module.js';
import { createStructuredLogger } from '@bassnotion/contracts';

@Module({
  // BillingModule exports EntitlementService (the bassline signer gates on it).
  imports: [AuthModule, SupabaseModule, BillingModule],
  controllers: [GroovesController],
  providers: [GroovesService],
  exports: [GroovesService],
})
export class GroovesModule {
  private readonly logger = createStructuredLogger(GroovesModule.name);

  onModuleInit() {
    this.logger.debug('GroovesModule initialized');
  }
}
