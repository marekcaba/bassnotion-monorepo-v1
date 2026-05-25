import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { StripeService } from './services/stripe.service.js';
import { ResendService } from './services/resend.service.js';
import { AdminFunnelsService } from './services/admin-funnels.service.js';
import { BillingController } from './billing.controller.js';
import { WebhookController } from './webhook.controller.js';
import { FoundersController } from './founders.controller.js';
import { SubscriptionRepository } from './repositories/subscription.repository.js';
import { PurchaseRepository } from './repositories/purchase.repository.js';
import { FounderMemberRepository } from './repositories/founder-member.repository.js';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module.js';
import { AuthModule } from '../user/auth/auth.module.js';

@Module({
  imports: [ConfigModule, SupabaseModule, AuthModule], // AuthModule for AdminGuard on FoundersController
  controllers: [BillingController, WebhookController, FoundersController],
  providers: [
    StripeService,
    ResendService,
    AdminFunnelsService,
    SubscriptionRepository,
    PurchaseRepository,
    FounderMemberRepository,
  ],
  exports: [
    StripeService,
    ResendService,
    AdminFunnelsService,
    SubscriptionRepository,
    PurchaseRepository,
    FounderMemberRepository,
  ],
})
export class BillingModule {}
