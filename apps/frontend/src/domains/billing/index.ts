/**
 * Billing Domain Exports
 *
 * This module provides Stripe payment integration for BassNotion:
 * - One-time course purchases ($39, $49, $99)
 * - Monthly subscription ($14/month)
 */

// Types
export * from './types/billing.types';

// API
export { billingApi } from './api/billing.api';

// Hooks
export {
  billingKeys,
  useProducts,
  useUserAccess,
  useCreateCheckoutSession,
  useCreatePortalSession,
  useCancelSubscription,
  useReactivateSubscription,
  useHasCourseAccess,
  useHasPremiumAccess,
} from './hooks/useBilling';

// Components
export { PricingCard } from './components/PricingCard';
export { PricingSection } from './components/PricingSection';
export { SubscriptionManager } from './components/SubscriptionManager';
export { PremiumGate, usePremiumAccess } from './components/PremiumGate';
