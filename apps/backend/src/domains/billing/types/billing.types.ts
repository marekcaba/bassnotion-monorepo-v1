/**
 * Billing Types for BassNotion Stripe Integration
 *
 * Payment Structure:
 * - One-time payments: Block courses ($39, $49, $99)
 * - Subscription: Monthly access ($14/month)
 */

// =============================================================================
// Product Types
// =============================================================================

export type CourseType = 'basic' | 'standard' | 'premium';
export type SubscriptionPlan = 'monthly';

export interface CourseProduct {
  type: CourseType;
  name: string;
  description: string;
  priceInCents: number;
  features: string[];
}

export interface SubscriptionProduct {
  plan: SubscriptionPlan;
  name: string;
  description: string;
  priceInCents: number;
  interval: 'month' | 'year';
  features: string[];
}

// =============================================================================
// Product Catalog
// =============================================================================

export const COURSE_PRODUCTS: Record<CourseType, CourseProduct> = {
  basic: {
    type: 'basic',
    name: 'Basic Course Bundle',
    description: 'Essential bass techniques and fundamentals',
    priceInCents: 3900, // $39
    features: [
      'Core bass techniques',
      'Beginner-friendly lessons',
      'Lifetime access to course content',
      'Downloadable practice materials',
    ],
  },
  standard: {
    type: 'standard',
    name: 'Standard Course Bundle',
    description: 'Intermediate techniques and song breakdowns',
    priceInCents: 4900, // $49
    features: [
      'Everything in Basic',
      'Intermediate techniques',
      'Popular song breakdowns',
      'Practice backing tracks',
      'Technique exercises',
    ],
  },
  premium: {
    type: 'premium',
    name: 'Premium Course Bundle',
    description: 'Advanced mastery with professional techniques',
    priceInCents: 9900, // $99
    features: [
      'Everything in Standard',
      'Advanced slap and tapping techniques',
      'Professional-level exercises',
      'Exclusive masterclass content',
      'Priority support',
    ],
  },
};

export const SUBSCRIPTION_PRODUCT: SubscriptionProduct = {
  plan: 'monthly',
  name: 'Bassicology Membership',
  description: 'Play the full instrument — every tempo, key, loop, and layer',
  priceInCents: 2400, // $24/mo — the single recurring "yes" (see funnel vision)
  interval: 'month',
  features: [
    'The full 40–200 tempo dial',
    'All 12 keys',
    'Loop any bar, infinitely',
    'Drill the layers — solo any part',
    'Unlimited practice',
    'Cancel anytime',
  ],
};

// =============================================================================
// Database Entities
// =============================================================================

export type SubscriptionStatus =
  | 'active'
  | 'canceled'
  | 'past_due'
  | 'unpaid'
  | 'trialing'
  | 'incomplete'
  | 'incomplete_expired';

export interface Subscription {
  id: string;
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type PurchaseStatus = 'completed' | 'pending' | 'failed' | 'refunded';

export interface Purchase {
  id: string;
  userId: string;
  stripeCustomerId: string;
  stripePaymentIntentId: string;
  stripeCheckoutSessionId: string;
  courseType: CourseType;
  amount: number;
  currency: string;
  status: PurchaseStatus;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// API DTOs
// =============================================================================

export interface CreateCheckoutSessionDto {
  type: 'course' | 'subscription';
  courseType?: CourseType;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
}

export interface CustomerPortalResponse {
  url: string;
}

export interface UserAccessStatus {
  hasActiveSubscription: boolean;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionEndDate?: Date;
  purchasedCourses: CourseType[];
}

// =============================================================================
// Webhook Events
// =============================================================================

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
  };
}

export type WebhookEventType =
  | 'checkout.session.completed'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'invoice.payment_succeeded'
  | 'invoice.payment_failed'
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed';
