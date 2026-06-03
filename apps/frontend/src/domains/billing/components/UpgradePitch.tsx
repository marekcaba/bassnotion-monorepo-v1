'use client';

/**
 * UpgradePitch — "the cap is the pitch", in-flow.
 *
 * A small popover that pops FROM the control a free user just bumped (tempo dial,
 * key stepper, Solo Drums). It does NOT dim the screen or stop playback — the
 * student feels the limit in-context and keeps playing.
 *
 * Design: an "instrument spec-plate" — it reads like the device showing you a
 * locked capability, in the groove card's own leather-black + amber voice
 * (#100E0D / #E8A44A / mono-uppercase labels). The lever you hit is highlighted
 * in the benefit list, so the pitch answers the exact thing you reached for, then
 * shows the rest of the panel that opens with membership.
 *
 * Render <UpgradePitchContent> inside a <Popover> (caller owns open + anchor).
 */

import { Check, Lock } from 'lucide-react';
import { PopoverContent } from '@/shared/components/ui/popover';
import { useCreateCheckoutSession } from '@/domains/billing/hooks/useBilling';

/** Which capped lever was bumped (drives the headline + highlighted benefit). */
export type UpgradeLever =
  | 'tempo'
  | 'transpose'
  | 'loopRange'
  | 'deconstruction'
  | 'generic';

/** Per-lever headline — names the specific spec you just hit. */
const LEVER_HEADLINE: Record<UpgradeLever, string> = {
  tempo: 'The dial stops here — for now',
  transpose: 'Two keys, then the wall',
  loopRange: 'Loop the whole groove, not the bar',
  deconstruction: 'The layers are locked',
  generic: 'You hit the free wall',
};

/** The four member benefits. `key` ties a row to the lever that was hit so we
 *  can highlight "the one you reached for". */
const BENEFITS: Array<{ key: UpgradeLever; label: string }> = [
  { key: 'tempo', label: 'The full 40–200 tempo dial' },
  { key: 'transpose', label: 'All 12 keys' },
  { key: 'loopRange', label: 'Loop any bar, infinitely' },
  { key: 'deconstruction', label: 'Drill the layers — solo any part' },
];

interface UpgradePitchContentProps {
  lever?: UpgradeLever;
  /** Optional override copy for the sub-line (e.g. the cap's own message). */
  message?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export function UpgradePitchContent({
  lever = 'generic',
  message,
  side = 'top',
}: UpgradePitchContentProps) {
  const checkout = useCreateCheckoutSession();

  const startCheckout = () => {
    const origin =
      typeof window !== 'undefined' ? window.location.href : '/app';
    checkout.mutate({
      type: 'subscription',
      successUrl: origin,
      cancelUrl: origin,
    });
  };

  return (
    <PopoverContent
      side={side}
      sideOffset={10}
      // Don't yank focus from the instrument — this is an in-flow nudge.
      onOpenAutoFocus={(e) => e.preventDefault()}
      className="w-[280px] overflow-hidden rounded-xl border border-[#E8A44A]/20 bg-[#100E0D] p-0 text-white shadow-[0_8px_40px_-8px_rgba(0,0,0,0.8)]"
    >
      {/* Header — the spec you just hit, in the instrument voice. */}
      <div className="border-b border-white/[0.06] px-4 pb-3 pt-3.5">
        <div className="mb-1.5 flex items-center gap-1.5">
          <Lock className="h-3 w-3 text-[#E8A44A]" />
          <span className="font-mono text-[10px] uppercase tracking-[2px] text-[#E8A44A]">
            Members only
          </span>
        </div>
        <p className="text-[15px] font-semibold leading-tight">
          {LEVER_HEADLINE[lever]}
        </p>
        {message && (
          <p className="mt-1 text-xs leading-snug text-white/45">{message}</p>
        )}
      </div>

      {/* Benefit list — the panel that opens with membership; the lever you hit
          is lit in amber, the rest sit quiet so the value reads at a glance. */}
      <ul className="space-y-2 px-4 py-3">
        {BENEFITS.map((b) => {
          const hit = b.key === lever;
          return (
            <li
              key={b.key}
              className={`flex items-center gap-2.5 text-[13px] leading-tight ${
                hit ? 'font-medium text-white' : 'text-white/55'
              }`}
            >
              <Check
                className={`h-3.5 w-3.5 shrink-0 ${
                  hit ? 'text-[#E8A44A]' : 'text-white/30'
                }`}
              />
              <span>{b.label}</span>
            </li>
          );
        })}
      </ul>

      {/* CTA — copper→amber, the same warm accent the conquer burst uses. */}
      <div className="px-4 pb-4 pt-1">
        <button
          type="button"
          onClick={startCheckout}
          disabled={checkout.isPending}
          className="group flex w-full items-center justify-center gap-2 rounded-lg bg-[#E8A44A] px-3 py-2.5 text-sm font-semibold text-[#1a1207] transition-all hover:bg-[#f0b35f] active:scale-[0.98] disabled:opacity-60"
        >
          {checkout.isPending ? (
            'Opening…'
          ) : (
            <>
              <span>Become a Member</span>
              <span className="font-mono text-xs text-[#1a1207]/70">
                $24/mo
              </span>
            </>
          )}
        </button>
        <p className="mt-2 text-center text-[11px] text-white/35">
          Cancel anytime · keep playing free meanwhile
        </p>
      </div>
    </PopoverContent>
  );
}
