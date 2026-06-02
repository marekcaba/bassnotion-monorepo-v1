'use client';

/**
 * Replays a pending (anonymous) conquer into the durable progress record once
 * the user is authenticated. The flow:
 *
 *   anonymous conquer → SaveAccountGate → /register → auth resolves →
 *   this hook fires → block_completions row written → pendingConquer cleared.
 *
 * Mount it once high in the /app tree (or wherever auth + drill state are
 * both live). It's a no-op until there's both a pending conquer AND an
 * authenticated user. Best-effort: a failed write keeps the pending conquer
 * so it retries on the next mount, and never throws into render.
 */

import { useEffect, useRef } from 'react';

import { useAuth } from '@/domains/user/hooks/use-auth';
import { completeBlock } from '@/domains/progress/api/progress.api';

import { useDrill } from '../stores/useDrillStore';

export function useConquerReplay() {
  const { isAuthenticated, isReady } = useAuth();
  const { pendingConquer, clearPendingConquer } = useDrill();

  // Guard so we don't double-fire while a write is in flight.
  const inFlight = useRef(false);

  useEffect(() => {
    if (!isReady || !isAuthenticated || !pendingConquer || inFlight.current) {
      return;
    }
    const { tutorialSlug, blockId, tier, proxy, at } = pendingConquer;
    // Without a slug we can't address the block_completions row — drop the
    // stale pending conquer rather than loop forever.
    if (!tutorialSlug) {
      clearPendingConquer();
      return;
    }
    inFlight.current = true;

    completeBlock(tutorialSlug, blockId, {
      conquered: true,
      tier,
      proxy,
      at,
    })
      .then(() => {
        clearPendingConquer();
      })
      .catch(() => {
        // Leave the pending conquer in place to retry next mount.
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, [isReady, isAuthenticated, pendingConquer, clearPendingConquer]);
}
