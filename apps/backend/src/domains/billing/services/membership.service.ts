import { Injectable, Logger } from '@nestjs/common';

import { SubscriptionRepository } from '../repositories/subscription.repository.js';
import { FounderMemberRepository } from '../repositories/founder-member.repository.js';
import { SupabaseService } from '../../../infrastructure/supabase/supabase.service.js';

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
    private readonly supabaseService: SupabaseService,
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

  /**
   * The OTHER timing order: a user who ALREADY has an account buys a founder
   * membership. Called from the founder checkout webhook. If a profile exists
   * for the email, grant the lifetime membership now; if not, do nothing — the
   * signup-time linkage (grantFounderMembershipIfEligible) covers them when they
   * eventually create the account. Best-effort; never throws into the webhook.
   */
  async grantFounderMembershipByEmail(
    email: string | null | undefined,
  ): Promise<boolean> {
    if (!email) return false;
    try {
      const { data, error } = await this.supabaseService
        .getClient()
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (error) throw error;
      const userId = data?.id as string | undefined;
      if (!userId) return false; // no account yet → signup linkage handles it

      await this.subscriptionRepository.grantLifetimeMembership(
        userId,
        'founder',
      );
      this.logger.log(
        `Granted lifetime founder membership to existing account ${email} (${userId})`,
      );
      return true;
    } catch (err) {
      this.logger.error(
        'Failed to grant founder membership by email',
        err as Error,
      );
      return false;
    }
  }
}
