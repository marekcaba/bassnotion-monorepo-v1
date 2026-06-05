'use client';

/**
 * Replays a pending (anonymous) brick completion into the durable progress
 * record once the user is authenticated. The flow:
 *
 *   anonymous completion → SaveAccountGate → /register → auth resolves →
 *   this hook fires → block_completions row written → pendingCompletion cleared.
 *
 * Mount it once high in the /app tree (or wherever auth + drill state are
 * both live). It's a no-op until there's both a pending completion AND an
 * authenticated user. Best-effort: a failed write keeps the pending completion
 * so it retries on the next mount, and never throws into render.
 */

import { useEffect, useRef } from 'react';

import { useAuth } from '@/domains/user/hooks/use-auth';
import { completeBlock } from '@/domains/progress/api/progress.api';

import { useDrill } from '../stores/useDrillStore';

export function useConquerReplay() {
  const { isAuthenticated, isReady } = useAuth();
  const { pendingCompletion, clearPendingCompletion } = useDrill();

  // Guard so we don't double-fire while a write is in flight.
  const inFlight = useRef(false);

  useEffect(() => {
    if (
      !isReady ||
      !isAuthenticated ||
      !pendingCompletion ||
      inFlight.current
    ) {
      return;
    }
    const { tutorialSlug, blockId, result, criterion, achievedTier, at } =
      pendingCompletion;
    // Without a slug we can't address the block_completions row — drop the
    // stale pending completion rather than loop forever.
    if (!tutorialSlug) {
      clearPendingCompletion();
      return;
    }
    inFlight.current = true;

    completeBlock(tutorialSlug, blockId, {
      result,
      criterion,
      achievedTier: achievedTier ?? null,
      at,
    })
      .then(() => {
        clearPendingCompletion();
      })
      .catch(() => {
        // Leave the pending completion in place to retry next mount.
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, [isReady, isAuthenticated, pendingCompletion, clearPendingCompletion]);
}
