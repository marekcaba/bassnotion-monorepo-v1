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
import type { FastifyRequest } from 'fastify';
import Stripe from 'stripe';

import { StripeService } from './services/stripe.service.js';
import { SubscriptionRepository } from './repositories/subscription.repository.js';
import { PurchaseRepository } from './repositories/purchase.repository.js';
import type { CourseType, SubscriptionStatus } from './types/billing.types.js';

@Controller('api/v1/webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly purchaseRepository: PurchaseRepository,
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
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }
  }

  /**
   * Handle successful checkout session
   * This fires when a customer completes the checkout flow
   */
  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
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

      this.logger.log(`Course purchase completed: ${courseType} for user ${userId}`);
    }
  }

  /**
   * Handle subscription created or updated
   */
  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.customer as string;
    const userId = subscription.metadata?.user_id;

    // Try to get user_id from metadata, or from existing subscription
    let resolvedUserId: string | undefined = userId;
    if (!resolvedUserId) {
      const existingSubscription = await this.subscriptionRepository.findByStripeSubscriptionId(
        subscription.id,
      );
      if (existingSubscription) {
        resolvedUserId = existingSubscription.userId;
      }
    }

    if (!resolvedUserId) {
      // Try to get from customer metadata
      const existingByCustomer = await this.subscriptionRepository.findByStripeCustomerId(customerId);
      if (existingByCustomer) {
        resolvedUserId = existingByCustomer.userId;
      }
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

    const existingSubscription = await this.subscriptionRepository.findByStripeSubscriptionId(
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

      this.logger.log(`Subscription updated: ${subscription.id} for user ${finalUserId}`);
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

      this.logger.log(`Subscription created: ${subscription.id} for user ${finalUserId}`);
    }
  }

  /**
   * Handle subscription deleted (canceled and expired)
   */
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    await this.subscriptionRepository.update(subscription.id, {
      status: 'canceled',
      canceledAt: new Date(),
    });

    this.logger.log(`Subscription canceled: ${subscription.id}`);
  }

  /**
   * Handle successful invoice payment (subscription renewal)
   */
  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    if (invoice.subscription) {
      const subscriptionId = invoice.subscription as string;
      const subscription = await this.stripeService.getSubscription(subscriptionId);

      await this.subscriptionRepository.update(subscriptionId, {
        status: 'active',
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      });

      this.logger.log(`Invoice payment succeeded for subscription: ${subscriptionId}`);
    }
  }

  /**
   * Handle failed invoice payment
   */
  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    if (invoice.subscription) {
      const subscriptionId = invoice.subscription as string;

      await this.subscriptionRepository.update(subscriptionId, {
        status: 'past_due',
      });

      this.logger.log(`Invoice payment failed for subscription: ${subscriptionId}`);
      // TODO: Send email notification to user
    }
  }

  /**
   * Handle successful payment intent (for one-time purchases)
   */
  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const existingPurchase = await this.purchaseRepository.findByPaymentIntentId(paymentIntent.id);

    if (existingPurchase && existingPurchase.status !== 'completed') {
      await this.purchaseRepository.updateStatus(paymentIntent.id, 'completed');
      this.logger.log(`Payment intent succeeded: ${paymentIntent.id}`);
    }
  }

  /**
   * Handle failed payment intent
   */
  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const existingPurchase = await this.purchaseRepository.findByPaymentIntentId(paymentIntent.id);

    if (existingPurchase) {
      await this.purchaseRepository.updateStatus(paymentIntent.id, 'failed');
      this.logger.log(`Payment intent failed: ${paymentIntent.id}`);
    }
  }

  /**
   * Map Stripe subscription status to our status type
   */
  private mapStripeStatus(stripeStatus: Stripe.Subscription.Status): SubscriptionStatus {
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
