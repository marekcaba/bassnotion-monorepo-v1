import { Injectable, Logger } from '@nestjs/common';

import { SupabaseService } from '../../../infrastructure/supabase/supabase.service.js';
import { Subscription, SubscriptionStatus } from '../types/billing.types.js';

interface SubscriptionRow {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  stripe_price_id: string;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class SubscriptionRepository {
  private readonly logger = new Logger(SubscriptionRepository.name);
  private readonly TABLE_NAME = 'subscriptions';

  constructor(private readonly supabaseService: SupabaseService) {}

  private mapRowToSubscription(row: SubscriptionRow): Subscription {
    return {
      id: row.id,
      userId: row.user_id,
      stripeCustomerId: row.stripe_customer_id,
      stripeSubscriptionId: row.stripe_subscription_id,
      stripePriceId: row.stripe_price_id,
      status: row.status,
      currentPeriodStart: new Date(row.current_period_start),
      currentPeriodEnd: new Date(row.current_period_end),
      cancelAtPeriodEnd: row.cancel_at_period_end,
      canceledAt: row.canceled_at ? new Date(row.canceled_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async findByUserId(userId: string): Promise<Subscription | null> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(this.TABLE_NAME)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return null;
      }
      this.logger.error('Error finding subscription by user ID', error);
      throw error;
    }

    return this.mapRowToSubscription(data as SubscriptionRow);
  }

  async findByStripeSubscriptionId(
    stripeSubscriptionId: string,
  ): Promise<Subscription | null> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(this.TABLE_NAME)
      .select('*')
      .eq('stripe_subscription_id', stripeSubscriptionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.logger.error('Error finding subscription by Stripe ID', error);
      throw error;
    }

    return this.mapRowToSubscription(data as SubscriptionRow);
  }

  async findByStripeCustomerId(
    stripeCustomerId: string,
  ): Promise<Subscription | null> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(this.TABLE_NAME)
      .select('*')
      .eq('stripe_customer_id', stripeCustomerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.logger.error('Error finding subscription by customer ID', error);
      throw error;
    }

    return this.mapRowToSubscription(data as SubscriptionRow);
  }

  /**
   * Grant a NON-Stripe lifetime membership (founders, comps, dev/admin). Writes
   * a synthetic `active` row with sentinel stripe ids and a far-future period
   * end so `hasActiveSubscription` resolves true forever. Idempotent per user
   * via the deterministic `stripe_subscription_id` sentinel (`lifetime_<userId>`)
   * + the table's UNIQUE constraint — re-granting is a no-op upsert.
   *
   * This is the shared entitlement primitive for: the dev/admin member switch
   * (R0) and the founder lifetime grant (R3). Real recurring members come
   * through the Stripe webhook path instead.
   */
  async grantLifetimeMembership(
    userId: string,
    reason: 'founder' | 'comp' | 'dev' = 'comp',
  ): Promise<void> {
    const client = this.supabaseService.getClient();
    const sentinelSubId = `lifetime_${userId}`;
    // Year 2099 — effectively never expires; hasActiveSubscription only checks
    // status, but keep period_end sane for any UI that reads it.
    const farFuture = new Date('2099-12-31T00:00:00Z').toISOString();

    const { error } = await client.from(this.TABLE_NAME).upsert(
      {
        user_id: userId,
        stripe_customer_id: `lifetime_${reason}`,
        stripe_subscription_id: sentinelSubId,
        stripe_price_id: `lifetime_${reason}`,
        status: 'active' as SubscriptionStatus,
        current_period_start: new Date().toISOString(),
        current_period_end: farFuture,
        cancel_at_period_end: false,
        canceled_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'stripe_subscription_id', ignoreDuplicates: false },
    );

    if (error) {
      this.logger.error('Error granting lifetime membership', error);
      throw error;
    }
  }

  async create(
    subscription: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Subscription> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(this.TABLE_NAME)
      .insert({
        user_id: subscription.userId,
        stripe_customer_id: subscription.stripeCustomerId,
        stripe_subscription_id: subscription.stripeSubscriptionId,
        stripe_price_id: subscription.stripePriceId,
        status: subscription.status,
        current_period_start: subscription.currentPeriodStart.toISOString(),
        current_period_end: subscription.currentPeriodEnd.toISOString(),
        cancel_at_period_end: subscription.cancelAtPeriodEnd,
        canceled_at: subscription.canceledAt?.toISOString() || null,
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Error creating subscription', error);
      throw error;
    }

    return this.mapRowToSubscription(data as SubscriptionRow);
  }

  async update(
    stripeSubscriptionId: string,
    updates: Partial<
      Omit<
        Subscription,
        | 'id'
        | 'userId'
        | 'stripeCustomerId'
        | 'stripeSubscriptionId'
        | 'createdAt'
      >
    >,
  ): Promise<Subscription> {
    const client = this.supabaseService.getClient();

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.status !== undefined) {
      updateData.status = updates.status;
    }
    if (updates.stripePriceId !== undefined) {
      updateData.stripe_price_id = updates.stripePriceId;
    }
    if (updates.currentPeriodStart !== undefined) {
      updateData.current_period_start =
        updates.currentPeriodStart.toISOString();
    }
    if (updates.currentPeriodEnd !== undefined) {
      updateData.current_period_end = updates.currentPeriodEnd.toISOString();
    }
    if (updates.cancelAtPeriodEnd !== undefined) {
      updateData.cancel_at_period_end = updates.cancelAtPeriodEnd;
    }
    if (updates.canceledAt !== undefined) {
      updateData.canceled_at = updates.canceledAt?.toISOString() || null;
    }

    const { data, error } = await client
      .from(this.TABLE_NAME)
      .update(updateData)
      .eq('stripe_subscription_id', stripeSubscriptionId)
      .select()
      .single();

    if (error) {
      this.logger.error('Error updating subscription', error);
      throw error;
    }

    return this.mapRowToSubscription(data as SubscriptionRow);
  }

  async hasActiveSubscription(userId: string): Promise<boolean> {
    const subscription = await this.findByUserId(userId);
    if (!subscription) return false;

    const activeStatuses: SubscriptionStatus[] = ['active', 'trialing'];
    return activeStatuses.includes(subscription.status);
  }
}
