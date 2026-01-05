'use client';

import { useState } from 'react';
import { CreditCard, Calendar, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  useUserAccess,
  useCreatePortalSession,
  useCancelSubscription,
  useReactivateSubscription,
} from '../hooks/useBilling';
import { useToast } from '@/shared/hooks/use-toast';
import { SubscriptionStatus } from '../types/billing.types';

function getStatusBadge(status: SubscriptionStatus) {
  switch (status) {
    case 'active':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400">
          <CheckCircle className="h-3 w-3" />
          Active
        </span>
      );
    case 'trialing':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-500/20 text-blue-400">
          <CheckCircle className="h-3 w-3" />
          Trial
        </span>
      );
    case 'canceled':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-500/20 text-gray-400">
          <XCircle className="h-3 w-3" />
          Canceled
        </span>
      );
    case 'past_due':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-500/20 text-red-400">
          <AlertCircle className="h-3 w-3" />
          Past Due
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-500/20 text-gray-400">
          {status}
        </span>
      );
  }
}

export function SubscriptionManager() {
  const { toast } = useToast();
  const { data: access, isLoading } = useUserAccess();
  const createPortalSession = useCreatePortalSession();
  const cancelSubscription = useCancelSubscription();
  const reactivateSubscription = useReactivateSubscription();

  const [isProcessing, setIsProcessing] = useState(false);

  const handleManageSubscription = async () => {
    setIsProcessing(true);
    try {
      await createPortalSession.mutateAsync(window.location.href);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to open subscription manager',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will still have access until the end of your billing period.')) {
      return;
    }

    setIsProcessing(true);
    try {
      await cancelSubscription.mutateAsync();
      toast({
        title: 'Subscription Canceled',
        description: 'Your subscription will end at the end of your billing period.',
        variant: 'default',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to cancel subscription',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReactivateSubscription = async () => {
    setIsProcessing(true);
    try {
      await reactivateSubscription.mutateAsync();
      toast({
        title: 'Subscription Reactivated',
        description: 'Your subscription has been reactivated.',
        variant: 'success',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to reactivate subscription',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-zinc-700 rounded w-1/3"></div>
          <div className="h-4 bg-zinc-700 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!access?.hasActiveSubscription && access?.purchasedCourses.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
        <div className="flex items-center gap-3 mb-4">
          <CreditCard className="h-5 w-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-white">Subscription & Purchases</h3>
        </div>
        <p className="text-gray-400 mb-4">
          You don't have any active subscriptions or purchases.
        </p>
        <Button
          onClick={() => window.location.href = '/pricing'}
          className="bg-[#ffc700] text-black hover:bg-[#e6b300]"
        >
          View Pricing
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <CreditCard className="h-5 w-5 text-[#ffc700]" />
        <h3 className="text-lg font-semibold text-white">Subscription & Purchases</h3>
      </div>

      {/* Subscription Status */}
      {access?.subscriptionStatus && (
        <div className="border-b border-zinc-700 pb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-400 mb-1">Current Plan</p>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-white">BassNotion Pro</span>
                {getStatusBadge(access.subscriptionStatus)}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400 mb-1">$14/month</p>
            </div>
          </div>

          {access.subscriptionEndDate && (
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
              <Calendar className="h-4 w-4" />
              <span>
                {access.subscriptionStatus === 'active'
                  ? `Renews on ${new Date(access.subscriptionEndDate).toLocaleDateString()}`
                  : `Access until ${new Date(access.subscriptionEndDate).toLocaleDateString()}`
                }
              </span>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              onClick={handleManageSubscription}
              disabled={isProcessing}
              className="bg-zinc-700 text-white hover:bg-zinc-600"
            >
              {isProcessing ? 'Loading...' : 'Manage Subscription'}
            </Button>
            {access.subscriptionStatus === 'active' && (
              <Button
                onClick={handleCancelSubscription}
                disabled={isProcessing}
                variant="ghost"
                className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
              >
                Cancel Subscription
              </Button>
            )}
            {access.subscriptionStatus === 'canceled' && access.subscriptionEndDate && new Date(access.subscriptionEndDate) > new Date() && (
              <Button
                onClick={handleReactivateSubscription}
                disabled={isProcessing}
                className="bg-green-600 text-white hover:bg-green-500"
              >
                Reactivate Subscription
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Purchased Courses */}
      {access?.purchasedCourses && access.purchasedCourses.length > 0 && (
        <div>
          <p className="text-sm text-gray-400 mb-3">Purchased Courses</p>
          <div className="space-y-2">
            {access.purchasedCourses.map((course) => (
              <div
                key={course}
                className="flex items-center justify-between py-2 px-3 bg-zinc-800 rounded-lg"
              >
                <span className="text-white capitalize">
                  {course === 'basic' && 'Basic Course Bundle'}
                  {course === 'standard' && 'Standard Course Bundle'}
                  {course === 'premium' && 'Premium Course Bundle'}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400">
                  <CheckCircle className="h-3 w-3" />
                  Owned
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
