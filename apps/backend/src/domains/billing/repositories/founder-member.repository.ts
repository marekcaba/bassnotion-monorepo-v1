import { Injectable, Logger } from '@nestjs/common';

import { SupabaseService } from '../../../infrastructure/supabase/supabase.service.js';

export type FounderMode = 'test' | 'live';

export interface FounderMemberRow {
  id: string;
  email: string;
  full_name: string | null;
  stripe_customer_id: string;
  stripe_checkout_session_id: string;
  stripe_payment_intent_id: string | null;
  stripe_price_id: string;
  amount: number;
  currency: string;
  mode: FounderMode;
  metadata: Record<string, unknown> | null;
  paid_at: string;
  welcome_email_sent_at: string | null;
}

export interface CreateFounderMemberInput {
  email: string;
  fullName?: string | null;
  stripeCustomerId: string;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId?: string | null;
  stripePriceId: string;
  amount: number;
  currency: string;
  mode: FounderMode;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class FounderMemberRepository {
  private readonly logger = new Logger(FounderMemberRepository.name);
  private readonly TABLE_NAME = 'founder_members';

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Insert a new founder. Idempotent on `stripe_checkout_session_id` — if the
   * Stripe webhook retries, the unique constraint rejects the second insert
   * and we return the existing row instead. Caller can detect this via the
   * `created` flag.
   */
  async createIfMissing(
    input: CreateFounderMemberInput,
  ): Promise<{ row: FounderMemberRow; created: boolean }> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(this.TABLE_NAME)
      .insert({
        email: input.email,
        full_name: input.fullName ?? null,
        stripe_customer_id: input.stripeCustomerId,
        stripe_checkout_session_id: input.stripeCheckoutSessionId,
        stripe_payment_intent_id: input.stripePaymentIntentId ?? null,
        stripe_price_id: input.stripePriceId,
        amount: input.amount,
        currency: input.currency,
        mode: input.mode,
        metadata: input.metadata ?? null,
      })
      .select()
      .single();

    if (error) {
      // 23505 = unique_violation on stripe_checkout_session_id — Stripe replay.
      if (error.code === '23505') {
        const existing = await this.findByCheckoutSessionId(
          input.stripeCheckoutSessionId,
        );
        if (existing) {
          return { row: existing, created: false };
        }
      }
      this.logger.error('Failed to insert founder member', {
        code: error.code,
        message: error.message,
        sessionId: input.stripeCheckoutSessionId,
      });
      throw error;
    }

    return { row: data as FounderMemberRow, created: true };
  }

  async findByCheckoutSessionId(
    sessionId: string,
  ): Promise<FounderMemberRow | null> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(this.TABLE_NAME)
      .select('*')
      .eq('stripe_checkout_session_id', sessionId)
      .maybeSingle();

    if (error) {
      this.logger.error('Failed to load founder member by session id', {
        code: error.code,
        message: error.message,
      });
      throw error;
    }

    return (data as FounderMemberRow) ?? null;
  }

  /** Find a founder member by email (CITEXT → case-insensitive). Used at signup
   *  to link a paying founder to their new account. null when not a founder. */
  async findByEmail(email: string): Promise<FounderMemberRow | null> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from(this.TABLE_NAME)
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      this.logger.error('Failed to load founder member by email', {
        code: error.code,
        message: error.message,
      });
      throw error;
    }

    return (data as FounderMemberRow) ?? null;
  }

  async markWelcomeEmailSent(id: string): Promise<void> {
    const client = this.supabaseService.getClient();

    const { error } = await client
      .from(this.TABLE_NAME)
      .update({ welcome_email_sent_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      // Non-fatal — log and continue. Worst case the email gets re-sent on
      // a Stripe webhook retry, which is acceptable for a welcome email.
      this.logger.warn('Failed to mark welcome_email_sent_at', {
        id,
        code: error.code,
        message: error.message,
      });
    }
  }

  /**
   * Public-facing count for the marketing-page "X of 100 spots claimed"
   * counter. By default counts only live-mode founders so test purchases
   * don't inflate the public number. Pass `{ mode: 'test' }` for staging
   * dashboards if we ever want to see test data separately.
   */
  async countByMode(mode: FounderMode = 'live'): Promise<number> {
    const client = this.supabaseService.getClient();

    const { count, error } = await client
      .from(this.TABLE_NAME)
      .select('id', { count: 'exact', head: true })
      .eq('mode', mode);

    if (error) {
      this.logger.error('Failed to count founder members', {
        code: error.code,
        message: error.message,
      });
      throw error;
    }

    return count ?? 0;
  }
}
