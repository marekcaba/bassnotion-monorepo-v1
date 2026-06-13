/**
 * Frontend Billing Types
 * Mirrors backend types for type safety
 */

import type { FeatureKey } from '@bassnotion/contracts';

export type CourseType = 'basic' | 'standard' | 'premium';
export type SubscriptionPlan = 'monthly';
export type SubscriptionStatus =
  | 'active'
  | 'canceled'
  | 'past_due'
  | 'unpaid'
  | 'trialing'
  | 'incomplete'
  | 'incomplete_expired';

export interface CourseProduct {
  type: CourseType;
  name: string;
  description: string;
  price: number;
  currency: string;
  features: string[];
}

export interface SubscriptionProduct {
  plan: SubscriptionPlan;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
}

export interface ProductsResponse {
  courses: CourseProduct[];
  subscription: SubscriptionProduct;
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
  subscriptionEndDate?: string;
  purchasedCourses: CourseType[];
  /** Product IDs the user owns (Groove Packs / Accelerator) — store "Owned" state. */
  purchasedProductIds?: string[];
  /**
   * The set of features the user's owned products / membership tier grant.
   * `useEntitlement` derives per-lever caps from this. OPTIONAL for back-compat:
   * a response/mock without it falls back to tier-based derivation; an authed
   * free user gets [] (every gateable lever capped).
   */
  grantedFeatures?: FeatureKey[];
}

export interface CreateCheckoutSessionDto {
  type: 'course' | 'subscription' | 'product';
  courseType?: CourseType;
  productId?: string;
  successUrl: string;
  cancelUrl: string;
}
