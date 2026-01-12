/**
 * Billing API Client
 * Handles all communication with the billing backend endpoints
 *
 * NOTE: Stripe integration is not yet complete. The billing endpoints
 * will return 500 errors until connected to Stripe in production.
 * For development, we return mock data to prevent console spam.
 *
 * TODO: Connect to Stripe before production launch
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
// DEVELOPMENT MODE - Billing API not connected to Stripe yet
// ============================================================================
// Set to true to bypass billing API calls and return mock data
// This prevents 500 errors and console spam during development
// TODO: Set to false when Stripe integration is complete
const BILLING_DEV_MODE = true;

// Mock data for development
const MOCK_USER_ACCESS: UserAccessStatus = {
  hasActiveSubscription: true, // Pretend user has premium for dev/testing
  subscriptionStatus: 'active',
  subscriptionPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
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
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
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
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to fetch products');
    }

    return response.json();
  },

  /**
   * Create a checkout session for course purchase or subscription
   * Requires authentication
   */
  async createCheckoutSession(dto: CreateCheckoutSessionDto): Promise<CheckoutSessionResponse> {
    const headers = await getAuthHeaders();

    const response = await fetch(`${API_BASE_URL}/api/v1/billing/checkout`, {
      method: 'POST',
      headers,
      body: JSON.stringify(dto),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to create checkout session');
    }

    return response.json();
  },

  /**
   * Create a customer portal session for subscription management
   * Requires authentication
   */
  async createPortalSession(returnUrl: string): Promise<CustomerPortalResponse> {
    const headers = await getAuthHeaders();

    const response = await fetch(`${API_BASE_URL}/api/v1/billing/portal`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ returnUrl }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
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
      const error = await response.json().catch(() => ({ message: response.statusText }));
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

    const response = await fetch(`${API_BASE_URL}/api/v1/billing/cancel-subscription`, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
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

    const response = await fetch(`${API_BASE_URL}/api/v1/billing/reactivate-subscription`, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Failed to reactivate subscription');
    }

    return response.json();
  },
};
