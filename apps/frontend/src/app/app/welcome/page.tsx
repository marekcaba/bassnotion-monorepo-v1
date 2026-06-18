'use client';

/**
 * Member welcome — post-checkout landing for a new $24/mo subscriber.
 *
 * Reached by Stripe's success redirect:
 *   /app/welcome?return=<encoded groove-card URL>&session_id=cs_...
 *
 * It (1) welcomes the new member, (2) refreshes the entitlement cache + waits
 * for the subscription webhook to land so the levers are actually uncapped when
 * they go back, and (3) offers a "Return to the Groove Card" button to the exact
 * spot they upgraded from.
 *
 * Inside /app, so AuthGuard already protects it. Brand-matched to the groove
 * card (leather-black + amber) so paying doesn't drop them onto a different feel.
 */

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import { billingKeys, useUserAccess } from '@/domains/billing/hooks/useBilling';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';
import { Button } from '@/shared/components/ui/button';

export default function MemberWelcomePage() {
  return (
    <Suspense fallback={null}>
      <MemberWelcomeContent />
    </Suspense>
  );
}

function MemberWelcomeContent() {
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('return');
  const queryClient = useQueryClient();
  const { navigateWithTransition } = useViewTransitionRouter();
  const { data: access } = useUserAccess();

  // The subscription webhook may land a beat after Stripe redirects here, so
  // the access query can briefly still read "free". Refetch on mount and a few
  // more times so the levers are uncapped by the time they return.
  const [polls, setPolls] = useState(0);
  const isMember = access?.hasActiveSubscription ?? false;

  useEffect(() => {
    if (isMember || polls >= 5) return;
    const id = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: billingKeys.access() });
      setPolls((n) => n + 1);
    }, 1200);
    return () => clearTimeout(id);
  }, [isMember, polls, queryClient]);

  const goBack = () => {
    // Return to the exact spot they upgraded from. Allow-list trusted origins
    // (open-redirect guard). The upgrade can start on the APEX (/library
    // tutorials) while welcome renders on the APP host, so accept both our
    // origins — not just the current one. An apex return is a full-page
    // navigation; an app/same-origin return is a client transition.
    let target = '/';
    let isCrossOrigin = false;
    if (returnUrl) {
      try {
        const u = new URL(returnUrl);
        const trusted = new Set(
          [
            process.env.NEXT_PUBLIC_APP_URL,
            process.env.NEXT_PUBLIC_MARKETING_URL,
            typeof window !== 'undefined' ? window.location.origin : undefined,
          ].filter(Boolean) as string[],
        );
        if (trusted.has(u.origin)) {
          isCrossOrigin =
            typeof window !== 'undefined' &&
            u.origin !== window.location.origin;
          target = isCrossOrigin ? u.href : u.pathname + u.search;
        }
      } catch {
        /* malformed return → fall back to / */
      }
    }
    if (isCrossOrigin && typeof window !== 'undefined') {
      // Different origin (e.g. apex /library): a client transition can't cross
      // origins, so do a full navigation.
      window.location.href = target;
      return;
    }
    navigateWithTransition(target);
  };

  return (
    <div className="flex min-h-[80vh] w-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-[#E8A44A]/20 bg-[#100E0D] p-8 text-center text-white shadow-[0_8px_40px_-8px_rgba(0,0,0,0.8)]">
        <div className="relative mx-auto grid h-16 w-16 place-items-center">
          <div className="absolute h-16 w-16 rounded-full bg-[#cd7f4d]/20 animate-ping" />
          <div className="relative grid h-14 w-14 place-items-center rounded-full border-2 border-[#E8A44A]">
            <Trophy className="h-7 w-7 text-[#E8A44A]" />
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="font-mono text-[11px] uppercase tracking-[2px] text-[#E8A44A]">
            You&apos;re a member
          </p>
          <h1 className="text-2xl font-semibold">
            The whole instrument is yours
          </h1>
          <p className="text-sm leading-relaxed text-white/55">
            Full tempo dial, all 12 keys, loop any bar, and drill the layers. No
            more walls — go take the seat.
          </p>
        </div>

        <ul className="mx-auto max-w-xs space-y-2 text-left text-[13px] text-white/70">
          <li className="flex items-center gap-2.5">
            <span className="text-[#E8A44A]">✓</span> The full 40–200 tempo dial
          </li>
          <li className="flex items-center gap-2.5">
            <span className="text-[#E8A44A]">✓</span> All 12 keys
          </li>
          <li className="flex items-center gap-2.5">
            <span className="text-[#E8A44A]">✓</span> Loop any bar, infinitely
          </li>
          <li className="flex items-center gap-2.5">
            <span className="text-[#E8A44A]">✓</span> Drill the layers — solo
            any part
          </li>
        </ul>

        <Button
          onClick={goBack}
          size="lg"
          className="w-full bg-[#E8A44A] font-semibold text-[#1a1207] hover:bg-[#f0b35f]"
        >
          {returnUrl ? 'Return to the Groove Card' : 'Start playing'}
        </Button>

        {!isMember && polls < 5 && (
          <p className="text-[11px] text-white/30">
            Activating your membership…
          </p>
        )}
      </div>
    </div>
  );
}
