/**
 * Billing Hooks
 * React Query hooks for billing operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { billingApi } from '../api/billing.api';
import { CourseType, CreateCheckoutSessionDto } from '../types/billing.types';

// Query keys
export const billingKeys = {
  all: ['billing'] as const,
  products: () => [...billingKeys.all, 'products'] as const,
  access: () => [...billingKeys.all, 'access'] as const,
};

/**
 * Hook to fetch available products
 * Public endpoint - no auth required
 */
export function useProducts() {
  return useQuery({
    queryKey: billingKeys.products(),
    queryFn: billingApi.getProducts,
    staleTime: 1000 * 60 * 60, // 1 hour - products don't change often
  });
}

/**
 * Hook to fetch current user's access status
 * Requires authentication
 */
export function useUserAccess(enabled = true) {
  return useQuery({
    queryKey: billingKeys.access(),
    queryFn: billingApi.getUserAccess,
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to create a checkout session
 */
export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: (dto: CreateCheckoutSessionDto) =>
      billingApi.createCheckoutSession(dto),
    onSuccess: (data) => {
      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });
}

/**
 * Hook to create a customer portal session
 */
export function useCreatePortalSession() {
  return useMutation({
    mutationFn: (returnUrl: string) =>
      billingApi.createPortalSession(returnUrl),
    onSuccess: (data) => {
      // Redirect to Stripe Customer Portal
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });
}

/**
 * Hook to cancel subscription
 */
export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: billingApi.cancelSubscription,
    onSuccess: () => {
      // Invalidate access query to refresh subscription status
      queryClient.invalidateQueries({ queryKey: billingKeys.access() });
    },
  });
}

/**
 * Hook to reactivate subscription
 */
export function useReactivateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: billingApi.reactivateSubscription,
    onSuccess: () => {
      // Invalidate access query to refresh subscription status
      queryClient.invalidateQueries({ queryKey: billingKeys.access() });
    },
  });
}

/**
 * Helper hook to check if user has access to a specific course
 */
export function useHasCourseAccess(courseType: CourseType) {
  const { data: access } = useUserAccess();

  if (!access) return false;

  // User has access if they have an active subscription OR purchased the course
  return (
    access.hasActiveSubscription || access.purchasedCourses.includes(courseType)
  );
}

/**
 * Helper hook to check if user has premium access (subscription)
 */
export function useHasPremiumAccess() {
  const { data: access } = useUserAccess();
  return access?.hasActiveSubscription ?? false;
}
