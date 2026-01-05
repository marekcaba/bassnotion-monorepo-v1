'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PricingCard } from './PricingCard';
import { useProducts, useCreateCheckoutSession, useUserAccess } from '../hooks/useBilling';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { CourseType } from '../types/billing.types';
import { useToast } from '@/shared/hooks/use-toast';

export function PricingSection() {
  const router = useRouter();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const { data: products, isLoading: productsLoading, error: productsError } = useProducts();
  const { data: userAccess, isLoading: accessLoading } = useUserAccess(isAuthenticated);
  const createCheckoutSession = useCreateCheckoutSession();

  const [loadingItem, setLoadingItem] = useState<string | null>(null);

  const handlePurchase = async (type: 'subscription' | 'course', courseType?: CourseType) => {
    if (!isAuthenticated) {
      // Redirect to login with return URL
      router.push(`/login?returnUrl=${encodeURIComponent('/pricing')}`);
      return;
    }

    const itemId = type === 'subscription' ? 'subscription' : `course_${courseType}`;
    setLoadingItem(itemId);

    try {
      const baseUrl = window.location.origin;
      await createCheckoutSession.mutateAsync({
        type,
        courseType,
        successUrl: `${baseUrl}/pricing?success=true`,
        cancelUrl: `${baseUrl}/pricing?canceled=true`,
      });
    } catch (error) {
      toast({
        title: 'Checkout Error',
        description: error instanceof Error ? error.message : 'Failed to start checkout',
        variant: 'destructive',
      });
    } finally {
      setLoadingItem(null);
    }
  };

  if (productsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ffc700]"></div>
      </div>
    );
  }

  if (productsError || !products) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">Failed to load pricing information. Please try again later.</p>
      </div>
    );
  }

  const purchasedCourses = userAccess?.purchasedCourses || [];
  const hasSubscription = userAccess?.hasActiveSubscription || false;

  return (
    <div className="space-y-12">
      {/* Subscription Section */}
      <section>
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Monthly Subscription</h2>
          <p className="text-gray-400">
            Get unlimited access to all tutorials and features
          </p>
        </div>

        <div className="max-w-md mx-auto">
          <PricingCard
            name={products.subscription.name}
            description={products.subscription.description}
            price={products.subscription.price}
            currency={products.subscription.currency}
            interval={products.subscription.interval}
            features={products.subscription.features}
            isPopular={true}
            isPurchased={hasSubscription}
            isLoading={loadingItem === 'subscription'}
            buttonText={hasSubscription ? 'Current Plan' : 'Subscribe Now'}
            onPurchase={() => handlePurchase('subscription')}
          />
        </div>
      </section>

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-zinc-700"></div>
        <span className="text-gray-400 text-sm">or purchase individual courses</span>
        <div className="flex-1 h-px bg-zinc-700"></div>
      </div>

      {/* Courses Section */}
      <section>
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Course Bundles</h2>
          <p className="text-gray-400">
            One-time purchases with lifetime access
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {products.courses.map((course) => (
            <PricingCard
              key={course.type}
              name={course.name}
              description={course.description}
              price={course.price}
              currency={course.currency}
              features={course.features}
              isPopular={course.type === 'standard'}
              isPurchased={purchasedCourses.includes(course.type)}
              isLoading={loadingItem === `course_${course.type}`}
              buttonText={
                purchasedCourses.includes(course.type)
                  ? 'Already Owned'
                  : `Buy ${course.name.split(' ')[0]}`
              }
              onPurchase={() => handlePurchase('course', course.type)}
            />
          ))}
        </div>
      </section>

      {/* Money Back Guarantee */}
      <div className="text-center py-6 border-t border-zinc-700">
        <p className="text-gray-400 text-sm">
          30-day money-back guarantee. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
