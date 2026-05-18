'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { PricingSection } from '@/domains/billing/components/PricingSection';
import { useToast } from '@/shared/hooks/use-toast';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';
import { HomeNavbar } from '../_components/HomeNavbar';
import { UserIndicator } from '@/domains/user/components/UserIndicator';

function PaymentStatusHandler() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // Handle success/cancel from Stripe checkout
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');

    if (success === 'true') {
      toast({
        title: 'Payment Successful!',
        description:
          'Thank you for your purchase. Your access has been activated.',
        variant: 'success',
      });
      // Clean URL
      window.history.replaceState({}, '', '/pricing');
    } else if (canceled === 'true') {
      toast({
        title: 'Payment Canceled',
        description: 'Your payment was canceled. You can try again when ready.',
        variant: 'default',
      });
      // Clean URL
      window.history.replaceState({}, '', '/pricing');
    }
  }, [mounted, searchParams, toast]);

  return null;
}

export default function PricingPage() {
  const { navigateWithTransition } = useViewTransitionRouter();

  return (
    <>
      <Suspense fallback={null}>
        <PaymentStatusHandler />
      </Suspense>
      <div
        className="min-h-screen"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, hsl(220 45% 20%) 0%, hsl(230 35% 10%) 40%, hsl(240 25% 5%) 100%)',
        }}
      >
        {/* Header with Logo and User Indicator */}
        <header className="w-full pt-8 sm:pt-12 pb-5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
            {/* Spacer for centering */}
            <div className="hidden sm:block w-[200px]" />

            {/* Logo - centered */}
            <button
              onClick={() => navigateWithTransition('/')}
              className="cursor-pointer"
            >
              <Image
                src="/BASSICOLOGY BIG.png"
                alt="Bassicology"
                width={600}
                height={150}
                className="w-[180px] sm:w-[260px] md:w-[320px] lg:w-[400px] xl:w-[480px] h-auto"
                priority
              />
            </button>

            {/* User Indicator with Logout - right side */}
            <div className="hidden sm:block">
              <UserIndicator />
            </div>
          </div>

          {/* Mobile User Indicator - below logo */}
          <div className="sm:hidden flex justify-center mt-4">
            <UserIndicator />
          </div>
        </header>

        {/* Navbar */}
        <HomeNavbar />

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8 sm:py-12">
          <div className="max-w-6xl mx-auto">
            {/* Page Header */}
            <div className="text-center mb-12">
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Choose Your Plan
              </h1>
              <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                Start your bass guitar journey with Bassicology. Get access to
                professional tutorials, interactive exercises, and a 3D
                fretboard visualization.
              </p>
            </div>

            {/* Pricing Cards */}
            <PricingSection />
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-zinc-800 py-8 mt-12">
          <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
            <p>Secure payments powered by Stripe</p>
            <p className="mt-2">
              Questions? Contact us at{' '}
              <a
                href="mailto:support@bassnotion.com"
                className="text-[#ffc700] hover:underline"
              >
                support@bassnotion.com
              </a>
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
