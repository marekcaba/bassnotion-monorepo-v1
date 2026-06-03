import { Injectable, Logger } from '@nestjs/common';

import { SubscriptionRepository } from '../repositories/subscription.repository.js';
import { FounderMemberRepository } from '../repositories/founder-member.repository.js';

/**
 * MembershipService — the entitlement-granting seam, kept independent of the
 * Stripe/checkout flow so the auth domain can call it at signup WITHOUT a
 * circular module dependency (BillingModule already imports AuthModule for the
 * AdminGuard). Lives in its own MembershipModule.
 *
 * Grants reuse the same `subscriptions` row that recurring members get, so
 * everything downstream (/billing/access → useEntitlement) treats founders and
 * subscribers identically — one entitlement path.
 */
@Injectable()
export class MembershipService {
  private readonly logger = new Logger(MembershipService.name);

  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly founderMemberRepository: FounderMemberRepository,
  ) {}

  /**
   * If the email belongs to a paying founder, grant a lifetime membership
   * (a synthetic active subscriptions row). Best-effort: returns true on grant,
   * false otherwise, and NEVER throws — a failure here must not break signup.
   *
   * Founders paid one-time "lifetime, no monthly fee", so this honors that
   * promise the moment they create their account.
   */
  async grantFounderMembershipIfEligible(
    userId: string,
    email: string | null | undefined,
  ): Promise<boolean> {
    if (!email) return false;
    try {
      const founder = await this.founderMemberRepository.findByEmail(email);
      if (!founder) return false;

      await this.subscriptionRepository.grantLifetimeMembership(
        userId,
        'founder',
      );
      this.logger.log(
        `Granted lifetime founder membership to ${email} (${userId})`,
      );
      return true;
    } catch (error) {
      this.logger.error('Failed to grant founder membership', error as Error);
      return false; // never block signup
    }
  }
}
