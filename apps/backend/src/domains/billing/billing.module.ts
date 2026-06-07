import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { StripeService } from './services/stripe.service.js';
import { ResendService } from './services/resend.service.js';
import { AdminFunnelsService } from './services/admin-funnels.service.js';
import { EntitlementService } from './services/entitlement.service.js';
import { BillingController } from './billing.controller.js';
import { WebhookController } from './webhook.controller.js';
import { FoundersController } from './founders.controller.js';
import { PurchaseRepository } from './repositories/purchase.repository.js';
import { ProductRepository } from './repositories/product.repository.js';
import { ProductContentsRepository } from './repositories/product-contents.repository.js';
import { AcceleratorEnrollmentRepository } from './repositories/accelerator-enrollment.repository.js';
import { FounderCardConfigRepository } from './repositories/founder-card-config.repository.js';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module.js';
import { AuthModule } from '../user/auth/auth.module.js';
// SubscriptionRepository + FounderMemberRepository now live in MembershipModule
// (so AuthModule can grant founders at signup without a circular dep). Importing
// it re-exposes those repos to the billing controllers.
import { MembershipModule } from './membership.module.js';

@Module({
  imports: [ConfigModule, SupabaseModule, AuthModule, MembershipModule], // AuthModule for AdminGuard
  controllers: [BillingController, WebhookController, FoundersController],
  providers: [
    StripeService,
    ResendService,
    AdminFunnelsService,
    EntitlementService,
    PurchaseRepository,
    ProductRepository,
    ProductContentsRepository,
    AcceleratorEnrollmentRepository,
    FounderCardConfigRepository,
  ],
  exports: [
    StripeService,
    ResendService,
    AdminFunnelsService,
    EntitlementService,
    PurchaseRepository,
    ProductRepository,
    ProductContentsRepository,
    AcceleratorEnrollmentRepository,
    FounderCardConfigRepository,
  ],
})
export class BillingModule {}
