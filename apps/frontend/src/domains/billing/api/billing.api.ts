/**
 * Billing API Client
 * Handles all communication with the billing backend endpoints.
 *
 * Entitlement is now LIVE: getUserAccess() hits the real GET /api/v1/billing/access
 * endpoint, which reads the `subscriptions` table (filled by Stripe subscription
 * webhooks / a lifetime founder row). This is what `useEntitlement` resolves
 * free-vs-member from. The free wall therefore actually bites for non-members.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  ProductsResponse,
  CheckoutSessionResponse,
  CustomerPortalResponse,
  UserAccessStatus,
  CreateCheckoutSessionDto,
} from '../types/billing.types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// ============================================================================
// DEV OVERRIDE — default OFF. Entitlement is live (reads the real /access).
// ============================================================================
// Flip to true ONLY for local UI work where you want to force the member
// (uncapped) experience without a subscriptions row. MUST stay false in any
// shared/committed state — true makes EVERY signed-in user fake-premium, which
// hides the free wall entirely. Prefer granting yourself a real subscriptions
// row (see the member escape-hatch) over flipping this.
const BILLING_DEV_MODE = false;

// Mock returned only when the override above is on.
const MOCK_USER_ACCESS: UserAccessStatus = {
  hasActiveSubscription: true,
  subscriptionStatus: 'active',
  subscriptionPeriodEnd: new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000,
  ).toISOString(),
  purchasedCourses: [],
};
// ============================================================================

/**
 * Singleton Supabase client to prevent "Multiple GoTrueClient instances" warning
 */
let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return supabaseClient;
}

/**
 * Get authorization header with current user's token
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const supabase = getSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
}

/**
 * Billing API methods
 */
export const billingApi = {
  /**
   * Get available products (courses and subscription)
   * Public endpoint - no auth required
   */
  async getProducts(): Promise<ProductsResponse> {
    const response = await fetch(`${API_BASE_URL}/api/v1/billing/products`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to fetch products');
    }

    return response.json();
  },

  /**
   * Create a checkout session for course purchase or subscription
   * Requires authentication
   */
  async createCheckoutSession(
    dto: CreateCheckoutSessionDto,
  ): Promise<CheckoutSessionResponse> {
    const headers = await getAuthHeaders();

    const response = await fetch(`${API_BASE_URL}/api/v1/billing/checkout`, {
      method: 'POST',
      headers,
      body: JSON.stringify(dto),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to create checkout session');
    }

    return response.json();
  },

  /**
   * Create a customer portal session for subscription management
   * Requires authentication
   */
  async createPortalSession(
    returnUrl: string,
  ): Promise<CustomerPortalResponse> {
    const headers = await getAuthHeaders();

    const response = await fetch(`${API_BASE_URL}/api/v1/billing/portal`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ returnUrl }),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to create portal session');
    }

    return response.json();
  },

  /**
   * Get current user's access status (subscriptions and purchases)
   * Requires authentication
   *
   * NOTE: In BILLING_DEV_MODE, returns mock data to avoid 500 errors
   * from the unconnected Stripe backend.
   */
  async getUserAccess(): Promise<UserAccessStatus> {
    // DEV MODE: Return mock data to prevent console errors
    if (BILLING_DEV_MODE) {
      return MOCK_USER_ACCESS;
    }

    const headers = await getAuthHeaders();

    const response = await fetch(`${API_BASE_URL}/api/v1/billing/access`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to fetch user access');
    }

    return response.json();
  },

  /**
   * Cancel subscription at period end
   * Requires authentication
   */
  async cancelSubscription(): Promise<{ message: string }> {
    const headers = await getAuthHeaders();

    const response = await fetch(
      `${API_BASE_URL}/api/v1/billing/cancel-subscription`,
      {
        method: 'POST',
        headers,
      },
    );

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to cancel subscription');
    }

    return response.json();
  },

  /**
   * Reactivate a canceled subscription (before period ends)
   * Requires authentication
   */
  async reactivateSubscription(): Promise<{ message: string }> {
    const headers = await getAuthHeaders();

    const response = await fetch(
      `${API_BASE_URL}/api/v1/billing/reactivate-subscription`,
      {
        method: 'POST',
        headers,
      },
    );

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to reactivate subscription');
    }

    return response.json();
  },
};
