import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import {
  CourseType,
  COURSE_PRODUCTS,
  SUBSCRIPTION_PRODUCT,
  CreateCheckoutSessionDto,
  CheckoutSessionResponse,
  CustomerPortalResponse,
} from '../types/billing.types.js';

@Injectable()
export class StripeService implements OnModuleInit {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe;
  private priceIds: Map<string, string> = new Map();

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is required');
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia',
      typescript: true,
    });
  }

  async onModuleInit() {
    // Initialize or fetch price IDs on module start
    await this.initializePrices();
  }

  /**
   * Initialize Stripe products and prices
   * Creates them if they don't exist, or fetches existing ones
   */
  private async initializePrices(): Promise<void> {
    try {
      // Subscription price: PREFER a configured Stripe price ID (best practice —
      // a real price created in the dashboard, stable across restarts). Only
      // fall back to runtime get-or-create when the env var is absent (legacy
      // dev convenience). The configured path is how $24/mo goes live.
      const configuredSubPrice = this.configService.get<string>(
        'STRIPE_SUBSCRIPTION_PRICE_ID',
      );
      if (configuredSubPrice) {
        this.priceIds.set('subscription_monthly', configuredSubPrice);
        this.logger.log(
          `Using configured subscription price ${configuredSubPrice}`,
        );
      } else {
        this.logger.warn(
          'STRIPE_SUBSCRIPTION_PRICE_ID not set — falling back to runtime price creation. Set the env var for production.',
        );
        const subscriptionProduct = await this.getOrCreateProduct(
          'bassnotion_subscription',
          SUBSCRIPTION_PRODUCT.name,
          SUBSCRIPTION_PRODUCT.description,
        );
        const subscriptionPrice = await this.getOrCreatePrice(
          subscriptionProduct.id,
          SUBSCRIPTION_PRODUCT.priceInCents,
          'usd',
          { interval: SUBSCRIPTION_PRODUCT.interval },
        );
        this.priceIds.set('subscription_monthly', subscriptionPrice.id);
      }

      // Create or get course products and prices
      for (const [courseType, course] of Object.entries(COURSE_PRODUCTS)) {
        const product = await this.getOrCreateProduct(
          `bassnotion_course_${courseType}`,
          course.name,
          course.description,
        );

        const price = await this.getOrCreatePrice(
          product.id,
          course.priceInCents,
          'usd',
        );
        this.priceIds.set(`course_${courseType}`, price.id);
      }

      this.logger.log('Stripe prices initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Stripe prices', error);
      throw error;
    }
  }

  /**
   * Get or create a Stripe product by lookup key
   */
  private async getOrCreateProduct(
    lookupKey: string,
    name: string,
    description: string,
  ): Promise<Stripe.Product> {
    // Search for existing product by metadata
    const existingProducts = await this.stripe.products.search({
      query: `metadata['lookup_key']:'${lookupKey}'`,
    });

    if (existingProducts.data.length > 0) {
      return existingProducts.data[0];
    }

    // Create new product
    return await this.stripe.products.create({
      name,
      description,
      metadata: { lookup_key: lookupKey },
    });
  }

  /**
   * Get or create a Stripe price for a product
   */
  private async getOrCreatePrice(
    productId: string,
    unitAmount: number,
    currency: string,
    recurring?: { interval: 'month' | 'year' },
  ): Promise<Stripe.Price> {
    // Get existing prices for this product
    const existingPrices = await this.stripe.prices.list({
      product: productId,
      active: true,
    });

    // Find matching price
    const matchingPrice = existingPrices.data.find((p) => {
      const amountMatches = p.unit_amount === unitAmount;
      const currencyMatches = p.currency === currency;
      const recurringMatches = recurring
        ? p.recurring?.interval === recurring.interval
        : !p.recurring;
      return amountMatches && currencyMatches && recurringMatches;
    });

    if (matchingPrice) {
      return matchingPrice;
    }

    // Create new price
    const priceData: Stripe.PriceCreateParams = {
      product: productId,
      unit_amount: unitAmount,
      currency,
    };

    if (recurring) {
      priceData.recurring = { interval: recurring.interval };
    }

    return await this.stripe.prices.create(priceData);
  }

  /**
   * Resolve the app user_id from a Stripe customer's metadata. getOrCreateCustomer
   * always stamps metadata.user_id, so this is a reliable last-resort fallback
   * for webhooks whose subscription object lacks the metadata. Returns null on
   * any error / missing metadata (caller logs + skips).
   */
  async getCustomerUserId(customerId: string): Promise<string | null> {
    try {
      const customer = await this.stripe.customers.retrieve(customerId);
      if (customer.deleted) return null;
      return (customer.metadata?.user_id as string | undefined) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Get or create a Stripe customer for a user
   */
  async getOrCreateCustomer(
    userId: string,
    email: string,
    name?: string,
  ): Promise<Stripe.Customer> {
    // Search for existing customer by metadata
    const existingCustomers = await this.stripe.customers.search({
      query: `metadata['user_id']:'${userId}'`,
    });

    if (existingCustomers.data.length > 0) {
      return existingCustomers.data[0];
    }

    // Create new customer
    return await this.stripe.customers.create({
      email,
      name,
      metadata: { user_id: userId },
    });
  }

  /**
   * Create a checkout session for course purchase or subscription
   */
  async createCheckoutSession(
    userId: string,
    email: string,
    dto: CreateCheckoutSessionDto,
  ): Promise<CheckoutSessionResponse> {
    const customer = await this.getOrCreateCustomer(userId, email);

    let priceId: string;
    let mode: 'payment' | 'subscription';
    const metadata: Record<string, string> = { user_id: userId };

    if (dto.type === 'subscription') {
      priceId = this.priceIds.get('subscription_monthly')!;
      mode = 'subscription';
    } else if (dto.type === 'course' && dto.courseType) {
      priceId = this.priceIds.get(`course_${dto.courseType}`)!;
      mode = 'payment';
      metadata.course_type = dto.courseType;
    } else {
      throw new Error('Invalid checkout session type');
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode,
      success_url: dto.successUrl,
      cancel_url: dto.cancelUrl,
      metadata,
      // Propagate metadata onto the SUBSCRIPTION object itself (not just the
      // checkout session) so customer.subscription.created/updated webhooks can
      // resolve user_id from subscription.metadata. Without this the webhook
      // can't link the sub to a user and no subscriptions row is written.
      ...(mode === 'subscription' ? { subscription_data: { metadata } } : {}),
      // Allow promotion codes
      allow_promotion_codes: true,
      // Collect billing address for tax purposes
      billing_address_collection: 'auto',
    });

    return {
      sessionId: session.id,
      url: session.url!,
    };
  }

  /**
   * Create a customer portal session for subscription management
   */
  async createCustomerPortalSession(
    stripeCustomerId: string,
    returnUrl: string,
  ): Promise<CustomerPortalResponse> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    return { url: session.url };
  }

  /**
   * Cancel a subscription at period end
   */
  async cancelSubscription(
    subscriptionId: string,
  ): Promise<Stripe.Subscription> {
    return await this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }

  /**
   * Reactivate a canceled subscription
   */
  async reactivateSubscription(
    subscriptionId: string,
  ): Promise<Stripe.Subscription> {
    return await this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await this.stripe.subscriptions.retrieve(subscriptionId);
  }

  /**
   * Verify webhook signature and construct event
   */
  constructWebhookEvent(
    payload: string | Buffer,
    signature: string,
  ): Stripe.Event {
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is required');
    }

    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret,
    );
  }

  /**
   * Retrieve checkout session details
   */
  async getCheckoutSession(
    sessionId: string,
  ): Promise<Stripe.Checkout.Session> {
    return await this.stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'payment_intent', 'line_items'],
    });
  }

  /**
   * Get price ID for a course type
   */
  getPriceIdForCourse(courseType: CourseType): string | undefined {
    return this.priceIds.get(`course_${courseType}`);
  }

  /**
   * Get price ID for subscription
   */
  getSubscriptionPriceId(): string | undefined {
    return this.priceIds.get('subscription_monthly');
  }
}
