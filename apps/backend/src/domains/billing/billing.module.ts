import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { StripeService } from './services/stripe.service.js';
import { ResendService } from './services/resend.service.js';
import { BillingController } from './billing.controller.js';
import { WebhookController } from './webhook.controller.js';
import { FoundersController } from './founders.controller.js';
import { SubscriptionRepository } from './repositories/subscription.repository.js';
import { PurchaseRepository } from './repositories/purchase.repository.js';
import { FounderMemberRepository } from './repositories/founder-member.repository.js';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module.js';

@Module({
  imports: [ConfigModule, SupabaseModule],
  controllers: [BillingController, WebhookController, FoundersController],
  providers: [
    StripeService,
    ResendService,
    SubscriptionRepository,
    PurchaseRepository,
    FounderMemberRepository,
  ],
  exports: [
    StripeService,
    ResendService,
    SubscriptionRepository,
    PurchaseRepository,
    FounderMemberRepository,
  ],
})
export class BillingModule {}
