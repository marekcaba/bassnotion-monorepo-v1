import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { StripeService } from './services/stripe.service.js';
import { BillingController } from './billing.controller.js';
import { WebhookController } from './webhook.controller.js';
import { SubscriptionRepository } from './repositories/subscription.repository.js';
import { PurchaseRepository } from './repositories/purchase.repository.js';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module.js';

@Module({
  imports: [ConfigModule, SupabaseModule],
  controllers: [BillingController, WebhookController],
  providers: [
    StripeService,
    SubscriptionRepository,
    PurchaseRepository,
  ],
  exports: [StripeService, SubscriptionRepository, PurchaseRepository],
})
export class BillingModule {}
