'use client';

import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useUserAccess } from '../hooks/useBilling';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { CourseType } from '../types/billing.types';

interface PremiumGateProps {
  children: ReactNode;
  /** Require active subscription for access */
  requireSubscription?: boolean;
  /** Require specific course purchase for access */
  requireCourse?: CourseType;
  /** Custom fallback component when access is denied */
  fallback?: ReactNode;
  /** Whether to show loading state */
  showLoading?: boolean;
}

/**
 * PremiumGate component that restricts access to premium content
 *
 * Usage examples:
 *
 * // Require subscription
 * <PremiumGate requireSubscription>
 *   <PremiumContent />
 * </PremiumGate>
 *
 * // Require specific course
 * <PremiumGate requireCourse="premium">
 *   <PremiumCourseContent />
 * </PremiumGate>
 *
 * // Custom fallback
 * <PremiumGate requireSubscription fallback={<CustomUpgrade />}>
 *   <PremiumContent />
 * </PremiumGate>
 */
export function PremiumGate({
  children,
  requireSubscription = false,
  requireCourse,
  fallback,
  showLoading = true,
}: PremiumGateProps) {
  const router = useRouter();
  const { isAuthenticated, isReady } = useAuth();
  const { data: access, isLoading } = useUserAccess(isAuthenticated);

  // Show loading state while checking auth and access
  if (!isReady || (isAuthenticated && isLoading)) {
    if (showLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ffc700]"></div>
        </div>
      );
    }
    return null;
  }

  // Not authenticated - prompt login
  if (!isAuthenticated) {
    if (fallback) return <>{fallback}</>;

    return (
      <DefaultAccessDenied
        title="Sign in Required"
        description="Please sign in to access this content."
        buttonText="Sign In"
        onAction={() =>
          router.push(
            `/login?returnUrl=${encodeURIComponent(window.location.pathname)}`,
          )
        }
      />
    );
  }

  // Check subscription requirement
  if (requireSubscription && !access?.hasActiveSubscription) {
    if (fallback) return <>{fallback}</>;

    return (
      <DefaultAccessDenied
        title="Premium Content"
        description="This content requires an active Bassicology Pro subscription."
        buttonText="View Pricing"
        onAction={() => router.push('/pricing')}
      />
    );
  }

  // Check course requirement
  if (requireCourse) {
    const hasCourseAccess =
      access?.hasActiveSubscription ||
      access?.purchasedCourses.includes(requireCourse);

    if (!hasCourseAccess) {
      if (fallback) return <>{fallback}</>;

      const courseNames: Record<CourseType, string> = {
        basic: 'Basic Course Bundle',
        standard: 'Standard Course Bundle',
        premium: 'Premium Course Bundle',
      };

      return (
        <DefaultAccessDenied
          title="Course Required"
          description={`This content requires the ${courseNames[requireCourse]} or an active subscription.`}
          buttonText="View Pricing"
          onAction={() => router.push('/pricing')}
        />
      );
    }
  }

  // Access granted - render children
  return <>{children}</>;
}

interface DefaultAccessDeniedProps {
  title: string;
  description: string;
  buttonText: string;
  onAction: () => void;
}

function DefaultAccessDenied({
  title,
  description,
  buttonText,
  onAction,
}: DefaultAccessDeniedProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-8 max-w-md text-center">
        <div className="w-16 h-16 bg-[#ffc700]/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Lock className="w-8 h-8 text-[#ffc700]" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-gray-400 mb-6">{description}</p>
        <Button
          onClick={onAction}
          className="bg-[#ffc700] text-black hover:bg-[#e6b300]"
        >
          {buttonText}
        </Button>
      </div>
    </div>
  );
}

/**
 * Hook version of PremiumGate for programmatic access checks
 */
export function usePremiumAccess() {
  const { isAuthenticated, isReady } = useAuth();
  const { data: access, isLoading } = useUserAccess(isAuthenticated);

  return {
    isLoading: !isReady || (isAuthenticated && isLoading),
    isAuthenticated,
    hasSubscription: access?.hasActiveSubscription ?? false,
    purchasedCourses: access?.purchasedCourses ?? [],
    hasCourseAccess: (courseType: CourseType) => {
      if (!access) return false;
      return (
        access.hasActiveSubscription ||
        access.purchasedCourses.includes(courseType)
      );
    },
  };
}
