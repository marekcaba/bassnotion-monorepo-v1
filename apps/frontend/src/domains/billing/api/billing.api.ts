/**
 * Billing API Client
 * Handles all communication with the billing backend endpoints
 */

import { createClient } from '@supabase/supabase-js';
import {
  ProductsResponse,
  CheckoutSessionResponse,
  CustomerPortalResponse,
  UserAccessStatus,
  CreateCheckoutSessionDto,
} from '../types/billing.types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Get Supabase client for auth token
 */
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
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
   */
  async getUserAccess(): Promise<UserAccessStatus> {
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
