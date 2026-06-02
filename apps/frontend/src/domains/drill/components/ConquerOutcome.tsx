'use client';

/**
 * The drill outcome layer (Phase 1) — the bar under the Groove Card that turns
 * playing into a CONQUER. Two states:
 *
 *   playing    → the conquer button ("I played it clean — conquer it") + the
 *                "too hard → step it down" release-valve link.
 *   conquered  → burst + Bronze badge, with Silver/Gold shown greyed (the wall).
 *
 * No scoring/Bridge yet — Phase 1 uses the honest self-report proxy the v1
 * mockups use ("I played it clean"). The conquer payload is tier-shaped so
 * swapping in a real score later needs no change here. Tiers above Bronze,
 * streaks, and full release-valve re-routing are Phase 2.
 */

import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import type { MasteryTier } from '../stores/useDrillStore';

interface ConquerOutcomeProps {
  /** Whether this groove is already conquered (optimistic or persisted). */
  conqueredTier: MasteryTier | null;
  /** Whether the card is ready to play (gates the conquer button). */
  isReady: boolean;
  /** Fired when the user confirms a clean play-through. */
  onConquer: () => void;
  /** Fired by the release valve — reset + step down. */
  onStepDown: () => void;
}

export function ConquerOutcome({
  conqueredTier,
  isReady,
  onConquer,
  onStepDown,
}: ConquerOutcomeProps) {
  if (conqueredTier) {
    return (
      <div className="flex flex-col items-center gap-3 py-3">
        {/* Burst: a scale-in ring around the earned tier. */}
        <div className="relative grid place-items-center">
          <div className="absolute h-16 w-16 rounded-full bg-[#cd7f4d]/20 animate-ping" />
          <div className="relative grid h-14 w-14 place-items-center rounded-full border-2 border-[#cd7f4d] text-2xl">
            ✓
          </div>
        </div>
        <p className="text-sm font-semibold">
          Conquered. That&apos;s a rep that counts.
        </p>
        {/* Tier ladder — Bronze earned, Silver/Gold are the wall (Phase 2). */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge className="border-transparent bg-[#cd7f4d] text-black">
            🥉 Bronze
          </Badge>
          <Badge variant="outline" className="border-zinc-700 text-zinc-500">
            🔒 Silver · at tempo
          </Badge>
          <Badge variant="outline" className="border-zinc-700 text-zinc-500">
            🔒 Gold · new key
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Members climb to Silver &amp; Gold and track every rep.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 py-3">
      <Button
        onClick={onConquer}
        disabled={!isReady}
        className="w-full text-white sm:w-auto"
      >
        ✓ I played it clean — conquer it
      </Button>
      <button
        type="button"
        onClick={onStepDown}
        className="text-xs text-white/70 underline underline-offset-2 hover:text-white"
      >
        This is too hard — step it down ↓
      </button>
    </div>
  );
}
