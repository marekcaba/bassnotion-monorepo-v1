'use client';

/**
 * useRepResultSync — records a RepResult for each rep brick the player completes
 * in the gym, as a SIBLING write to the drill executor's own block-completion
 * (spec §12). It observes the shared progress cache (the single source of truth
 * the executor already writes through) for newly-completed bricks and appends a
 * RepResult per brick — WITHOUT touching the shared executor / progress hook.
 *
 * Why observe rather than tap the completion handler: the executor + useProgress
 * are shared by every tutorial. Coupling them to the training engine would
 * violate the product boundary. The generated bricks carry everything the rep
 * needs (ladderPosition, config.tempoOverride), and the completion payload
 * (DrillCompletionData) lives on the progress entry — so the engine can derive
 * the rep entirely from data it already owns, staying fully decoupled.
 *
 * Best-effort: a failed append never disturbs the drill UI (the block
 * completion already succeeded on its own path).
 */

import { useEffect, useRef } from 'react';
import {
  drillCompletionToSignal,
  type DrillCompletionData,
  type LadderLevel,
  type RepResultInput,
  type TutorialBlock,
} from '@bassnotion/contracts';

import { useProgress } from '@/domains/progress/hooks/useProgress';
import { useAppendRepResult } from './useAppendRepResult';

/** Pull the tempo a brick was performed at from its (overridden) config. */
function brickTempo(block: TutorialBlock | undefined): number | null {
  const t = (block?.config as { tempoOverride?: number } | undefined)
    ?.tempoOverride;
  return typeof t === 'number' ? t : null;
}

/** Ladder level: the engine stamps ladderPosition on every generated brick. */
function brickLadder(block: TutorialBlock | undefined): LadderLevel {
  return block?.ladderPosition ?? 'L2';
}

export function useRepResultSync(opts: {
  slug: string | null;
  enrollmentId: string | null;
  /** The minted rep's bricks, keyed by id for ladder/tempo lookup. */
  bricks: TutorialBlock[];
}) {
  const { slug, enrollmentId, bricks } = opts;
  const append = useAppendRepResult();
  const { data: progress } = useProgress(slug, { enabled: !!slug });

  // Bricks we've already recorded a rep for (dedupe across re-renders/polls).
  const recordedRef = useRef<Set<string>>(new Set());
  // Keep mutate + brick lookup in refs so the effect depends only on progress.
  const appendRef = useRef(append.mutate);
  appendRef.current = append.mutate;
  const brickMapRef = useRef<Map<string, TutorialBlock>>(new Map());
  brickMapRef.current = new Map(bricks.map((b) => [b.id, b]));
  const enrollmentRef = useRef(enrollmentId);
  enrollmentRef.current = enrollmentId;

  // Reset the dedupe set when the rep (slug) changes — a new day's rep should
  // record fresh, even if a brick id repeats.
  useEffect(() => {
    recordedRef.current = new Set();
  }, [slug]);

  useEffect(() => {
    const eid = enrollmentRef.current;
    if (!eid || !progress) return;

    for (const entry of progress.blocks) {
      if (!entry.completed) continue;
      if (recordedRef.current.has(entry.blockId)) continue;

      const block = brickMapRef.current.get(entry.blockId);
      // Only record bricks the engine generated (have a ladderPosition); skip
      // any non-rep block that might share the tutorial.
      if (!block?.ladderPosition) continue;

      const data = (entry.data ?? {}) as DrillCompletionData;
      const result = data.result;
      if (!result) continue; // not a drill completion

      const atMs = data.at ? Date.parse(data.at) : Date.now();
      const signal = drillCompletionToSignal(data, atMs);

      const input: RepResultInput = {
        goalEnrollmentId: eid,
        blockId: entry.blockId,
        ladderLevel: brickLadder(block),
        tempoBpm: brickTempo(block),
        signal,
        result, // 'conquered' | 'completed' | 'released'
        achievedTier: data.achievedTier ?? null,
      };

      recordedRef.current.add(entry.blockId);
      appendRef.current(input); // fire-and-forget; best-effort
    }
  }, [progress]);
}
