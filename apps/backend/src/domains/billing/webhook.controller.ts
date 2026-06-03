import {
  Controller,
  Post,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyRequest } from 'fastify';
import Stripe from 'stripe';

import { StripeService } from './services/stripe.service.js';
import { ResendService } from './services/resend.service.js';
import { MembershipService } from './services/membership.service.js';
import { SubscriptionRepository } from './repositories/subscription.repository.js';
import { PurchaseRepository } from './repositories/purchase.repository.js';
import { FounderMemberRepository } from './repositories/founder-member.repository.js';
import type { CourseType, SubscriptionStatus } from './types/billing.types.js';

@Controller('api/v1/webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly purchaseRepository: PurchaseRepository,
    private readonly founderMemberRepository: FounderMemberRepository,
    private readonly resendService: ResendService,
    private readonly configService: ConfigService,
    private readonly membershipService: MembershipService,
  ) {}

  /**
   * Handle Stripe webhook events
   * This endpoint receives raw body for signature verification
   */
  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() request: RawBodyRequest<FastifyRequest>,
  ): Promise<{ received: boolean }> {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    const rawBody = request.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Missing raw body');
    }

    let event: Stripe.Event;

    try {
      event = this.stripeService.constructWebhookEvent(rawBody, signature);
    } catch (err) {
      this.logger.error('Webhook signature verification failed', err);
      throw new BadRequestException('Invalid signature');
    }

    this.logger.log(`Received Stripe webhook: ${event.type}`);

    try {
      await this.handleEvent(event);
    } catch (err) {
      this.logger.error(`Error handling webhook event ${event.type}`, err);
      // Still return 200 to acknowledge receipt
      // Stripe will retry if we return an error
    }

    return { received: true };
  }

  private async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
        );
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;

      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(
          event.data.object as Stripe.Invoice,
        );
        break;

      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(
          event.data.object as Stripe.Invoice,
        );
        break;

      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent,
        );
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(
          event.data.object as Stripe.PaymentIntent,
        );
        break;

      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }
  }

  /**
   * Handle successful checkout session
   * This fires when a customer completes the checkout flow
   */
  private async handleCheckoutCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    // Founder-membership purchases come from anonymous visitors on the
    // marketing waitlist (no user_id, no course_type — yet). Route them
    // BEFORE the auth'd-purchase logic that requires user_id.
    if (this.isFounderCheckout(session)) {
      await this.handleFounderCheckoutCompleted(session);
      return;
    }

    const userId = session.metadata?.user_id;
    const courseType = session.metadata?.course_type as CourseType | undefined;

    if (!userId) {
      this.logger.error('Checkout session missing user_id in metadata');
      return;
    }

    if (session.mode === 'subscription') {
      // Subscription is handled by customer.subscription.created event
      this.logger.log(`Subscription checkout completed for user ${userId}`);
    } else if (session.mode === 'payment' && courseType) {
      // One-time course purchase
      await this.purchaseRepository.create({
        userId,
        stripeCustomerId: session.customer as string,
        stripePaymentIntentId: session.payment_intent as string,
        stripeCheckoutSessionId: session.id,
        courseType,
        amount: session.amount_total || 0,
        currency: session.currency || 'usd',
        status: 'completed',
      });

      this.logger.log(
        `Course purchase completed: ${courseType} for user ${userId}`,
      );
    }
  }

  /**
   * Handle subscription created or updated
   */
  private async handleSubscriptionUpdated(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const customerId = subscription.customer as string;
    const userId = subscription.metadata?.user_id;

    // Try to get user_id from metadata, or from existing subscription
    let resolvedUserId: string | undefined = userId;
    if (!resolvedUserId) {
      const existingSubscription =
        await this.subscriptionRepository.findByStripeSubscriptionId(
          subscription.id,
        );
      if (existingSubscription) {
        resolvedUserId = existingSubscription.userId;
      }
    }

    if (!resolvedUserId) {
      // Try an existing subscription row keyed by customer.
      const existingByCustomer =
        await this.subscriptionRepository.findByStripeCustomerId(customerId);
      if (existingByCustomer) {
        resolvedUserId = existingByCustomer.userId;
      }
    }

    if (!resolvedUserId) {
      // Final fallback: the Stripe customer's metadata.user_id (always stamped
      // by getOrCreateCustomer). Covers first-ever subscriptions whose own
      // metadata didn't carry user_id.
      resolvedUserId =
        (await this.stripeService.getCustomerUserId(customerId)) ?? undefined;
    }

    if (!resolvedUserId) {
      this.logger.error('Unable to resolve user_id for subscription', {
        subscriptionId: subscription.id,
        customerId,
      });
      return;
    }

    const finalUserId: string = resolvedUserId;

    const priceId = subscription.items.data[0]?.price.id ?? '';
    const status = this.mapStripeStatus(subscription.status) ?? 'incomplete';

    const existingSubscription =
      await this.subscriptionRepository.findByStripeSubscriptionId(
        subscription.id,
      );

    if (existingSubscription) {
      await this.subscriptionRepository.update(subscription.id, {
        stripePriceId: priceId,
        status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at
          ? new Date(subscription.canceled_at * 1000)
          : undefined,
      });

      this.logger.log(
        `Subscription updated: ${subscription.id} for user ${finalUserId}`,
      );
    } else {
      await this.subscriptionRepository.create({
        userId: finalUserId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at
          ? new Date(subscription.canceled_at * 1000)
          : undefined,
      });

      this.logger.log(
        `Subscription created: ${subscription.id} for user ${finalUserId}`,
      );
    }
  }

  /**
   * Handle subscription deleted (canceled and expired)
   */
  private async handleSubscriptionDeleted(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    await this.subscriptionRepository.update(subscription.id, {
      status: 'canceled',
      canceledAt: new Date(),
    });

    this.logger.log(`Subscription canceled: ${subscription.id}`);
  }

  /**
   * Handle successful invoice payment (subscription renewal)
   */
  private async handleInvoicePaymentSucceeded(
    invoice: Stripe.Invoice,
  ): Promise<void> {
    if (invoice.subscription) {
      const subscriptionId = invoice.subscription as string;
      const subscription =
        await this.stripeService.getSubscription(subscriptionId);

      await this.subscriptionRepository.update(subscriptionId, {
        status: 'active',
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      });

      this.logger.log(
        `Invoice payment succeeded for subscription: ${subscriptionId}`,
      );
    }
  }

  /**
   * Handle failed invoice payment
   */
  private async handleInvoicePaymentFailed(
    invoice: Stripe.Invoice,
  ): Promise<void> {
    if (invoice.subscription) {
      const subscriptionId = invoice.subscription as string;

      await this.subscriptionRepository.update(subscriptionId, {
        status: 'past_due',
      });

      this.logger.log(
        `Invoice payment failed for subscription: ${subscriptionId}`,
      );
      // TODO: Send email notification to user
    }
  }

  /**
   * Handle successful payment intent (for one-time purchases)
   */
  private async handlePaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    const existingPurchase =
      await this.purchaseRepository.findByPaymentIntentId(paymentIntent.id);

    if (existingPurchase && existingPurchase.status !== 'completed') {
      await this.purchaseRepository.updateStatus(paymentIntent.id, 'completed');
      this.logger.log(`Payment intent succeeded: ${paymentIntent.id}`);
    }
  }

  /**
   * Handle failed payment intent
   */
  private async handlePaymentIntentFailed(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    const existingPurchase =
      await this.purchaseRepository.findByPaymentIntentId(paymentIntent.id);

    if (existingPurchase) {
      await this.purchaseRepository.updateStatus(paymentIntent.id, 'failed');
      this.logger.log(`Payment intent failed: ${paymentIntent.id}`);
    }
  }

  /**
   * Detects a founder-membership checkout. Primary signal: the configured
   * STRIPE_FOUNDER_PRICE_ID appears on a line item. Secondary signal: the
   * `purchase_type=founder_membership` metadata tag we attach to the
   * Payment Link. Either one is sufficient.
   */
  private isFounderCheckout(session: Stripe.Checkout.Session): boolean {
    const metadataMatch =
      session.metadata?.purchase_type === 'founder_membership';

    const configuredPriceId = this.configService.get<string>(
      'STRIPE_FOUNDER_PRICE_ID',
    );

    // Try the line items if Stripe expanded them on the event. Stripe doesn't
    // always include line_items on the session payload (depends on how the
    // event was generated), so we fall back to a retrieve() call if needed.
    let priceIdMatch = false;
    const expandedItems = session.line_items?.data;
    if (expandedItems && expandedItems.length > 0) {
      priceIdMatch = expandedItems.some(
        (item) => item.price?.id === configuredPriceId,
      );
    }

    return metadataMatch || priceIdMatch;
  }

  /**
   * Founder-membership branch — anonymous one-time purchase from the
   * marketing waitlist. Idempotent on stripe_checkout_session_id.
   *
   * Side effects, in order:
   *   1. Insert founder_members row (or no-op if Stripe replayed).
   *   2. On fresh insert, send the welcome email and mark it sent.
   *
   * Replay (already-inserted) skips the email so we don't double-send when
   * Stripe retries the webhook.
   */
  private async handleFounderCheckoutCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    // Pull line items if not already expanded — we need the price id for
    // the canonical record and the amount/currency for the row.
    let lineItems = session.line_items?.data;
    if (!lineItems || lineItems.length === 0) {
      const expanded = await this.stripeService.getCheckoutSession(session.id);
      lineItems = expanded.line_items?.data ?? [];
    }

    const firstItem = lineItems[0];
    const priceId = firstItem?.price?.id;
    if (!priceId) {
      this.logger.error('Founder checkout missing price id', {
        sessionId: session.id,
      });
      return;
    }

    const email =
      session.customer_details?.email ?? session.customer_email ?? null;
    if (!email) {
      this.logger.error('Founder checkout missing customer email', {
        sessionId: session.id,
      });
      return;
    }

    const fullName = session.customer_details?.name ?? null;
    const firstName = fullName?.split(/\s+/)[0] ?? null;

    const amount =
      session.amount_total ??
      firstItem?.amount_total ??
      firstItem?.amount_subtotal ??
      0;
    const currency = (
      session.currency ??
      firstItem?.currency ??
      'usd'
    ).toLowerCase();
    const mode: 'test' | 'live' = session.livemode ? 'live' : 'test';

    // Attribution shipped through the Stripe checkout via client_reference_id
    // (frontend packs slim UTMs into a base64url JSON blob). Parse back into
    // the wider attribution shape and merge with the existing session.metadata.
    const attribution = parseAttributionFromClientReferenceId(
      session.client_reference_id ?? null,
    );
    const mergedMetadata = {
      ...(session.metadata ?? {}),
      ...(attribution ? { attribution } : {}),
    };

    const { row, created } = await this.founderMemberRepository.createIfMissing(
      {
        email,
        fullName,
        // null (not '') when the checkout created no Customer — honest data.
        // Payment Links only create a Customer with customer_creation:'always';
        // for older/one-time guest charges this stays null rather than blank.
        stripeCustomerId: (session.customer as string) || null,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: (session.payment_intent as string) ?? null,
        stripePriceId: priceId,
        amount,
        currency,
        mode,
        metadata:
          Object.keys(mergedMetadata).length > 0 ? mergedMetadata : null,
      },
    );

    // Grant entitlement NOW if they already have an account (the "sign up first,
    // buy founder later" order). If no account yet, this is a no-op and the
    // signup-time linkage grants them when they create one. Runs on replay too
    // (idempotent grant) so a missed grant self-heals on the next webhook.
    await this.membershipService.grantFounderMembershipByEmail(email);

    if (!created) {
      this.logger.log(
        `Founder checkout replay — already recorded (${session.id}); skipping welcome email`,
      );
      return;
    }

    this.logger.log(
      `New founder member: ${email} (mode=${mode}, session=${session.id})`,
    );

    const messageId = await this.resendService.sendFounderWelcome({
      toEmail: email,
      firstName,
    });

    if (messageId) {
      await this.founderMemberRepository.markWelcomeEmailSent(row.id);
    }
  }

  /**
   * Map Stripe subscription status to our status type
   */
  private mapStripeStatus(
    stripeStatus: Stripe.Subscription.Status,
  ): SubscriptionStatus {
    const statusMap: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
      active: 'active',
      canceled: 'canceled',
      incomplete: 'incomplete',
      incomplete_expired: 'incomplete_expired',
      past_due: 'past_due',
      paused: 'canceled', // Map paused to canceled for simplicity
      trialing: 'trialing',
      unpaid: 'unpaid',
    };

    return statusMap[stripeStatus] || 'incomplete';
  }
}

/**
 * Decode the slim attribution blob the frontend packed into Stripe's
 * client_reference_id. Format: `attr:<base64url(JSON)>`. The JSON keys
 * are single-letter shorthand to fit Stripe's 200-char limit:
 *   s = utmSource, m = utmMedium, c = utmCampaign,
 *   n = utmContent, t = utmTerm, a = capturedAt
 *
 * Returns `null` when the field is missing, malformed, or carries a
 * non-attribution value (the existing platform may use client_reference_id
 * for other purposes in the future). Never throws.
 */
function parseAttributionFromClientReferenceId(
  raw: string | null,
): Record<string, string> | null {
  if (!raw || !raw.startsWith('attr:')) return null;
  const b64url = raw.slice('attr:'.length);
  if (b64url.length === 0) return null;

  try {
    // base64url → base64 + restore padding
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json = Buffer.from(padded, 'base64').toString('utf8');
    const slim = JSON.parse(json) as Record<string, unknown>;

    const longForm: Record<string, string> = {};
    const mapping: Record<string, string> = {
      s: 'utmSource',
      m: 'utmMedium',
      c: 'utmCampaign',
      n: 'utmContent',
      t: 'utmTerm',
      a: 'capturedAt',
    };
    for (const [shortKey, longKey] of Object.entries(mapping)) {
      const v = slim[shortKey];
      if (typeof v === 'string' && v.length > 0 && v.length <= 200) {
        longForm[longKey] = v;
      }
    }
    return Object.keys(longForm).length > 0 ? longForm : null;
  } catch {
    return null;
  }
}
