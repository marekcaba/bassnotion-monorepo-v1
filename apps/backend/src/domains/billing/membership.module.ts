import { Module } from '@nestjs/common';

import { MembershipService } from './services/membership.service.js';
import { SubscriptionRepository } from './repositories/subscription.repository.js';
import { FounderMemberRepository } from './repositories/founder-member.repository.js';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module.js';

/**
 * MembershipModule — owns the entitlement-granting primitives (the
 * subscriptions + founder repos and the MembershipService that grants lifetime
 * memberships). Deliberately depends on NOTHING in the user/auth or billing
 * controllers, so both AuthModule (grant founders at signup) and BillingModule
 * (Stripe flows) can import it WITHOUT a circular dependency.
 */
@Module({
  imports: [SupabaseModule],
  providers: [
    MembershipService,
    SubscriptionRepository,
    FounderMemberRepository,
  ],
  exports: [MembershipService, SubscriptionRepository, FounderMemberRepository],
})
export class MembershipModule {}
