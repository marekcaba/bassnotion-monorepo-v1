/**
 * Adapters from the new server progress response to the legacy shapes that
 * downstream UI components consume. These exist so we can change the data
 * source (frontend-direct-to-Supabase → backend API) without rewriting
 * every component that reads progress.
 *
 * Eventually the components should consume the server response directly,
 * but doing that in one PR balloons the diff. Adapters are a known
 * intermediate state.
 */

import type {
  GetTutorialProgressResponse,
  BlockProgressEntry,
  DrillCompletionData,
} from '@bassnotion/contracts';

/** Legacy block-progress map shape used by DynamicIsland, FourWidgetsCard, etc. */
export interface LegacyBlockProgress {
  [blockId: string]: {
    blockId: string;
    completed: boolean;
    completedAt?: string;
    /** Drill-brick completion payload (result / criterion / achievedTier). */
    data?: DrillCompletionData;
  };
}

/** Legacy practice-completions map keyed by exercise id. */
export interface LegacyPracticeCompletions {
  [exerciseId: string]: {
    count: number;
    lastTempoBpm?: number;
  };
}

/**
 * Convert the server's blocks array to the legacy map keyed by blockId.
 * Only includes completed blocks (matching the legacy semantics where a
 * missing entry means "not completed").
 */
export function toLegacyBlockProgress(
  data: GetTutorialProgressResponse | undefined,
): LegacyBlockProgress {
  if (!data) return {};
  const out: LegacyBlockProgress = {};
  for (const entry of data.blocks) {
    if (entry.completed) {
      out[entry.blockId] = {
        blockId: entry.blockId,
        completed: true,
        completedAt: entry.completedAt ?? undefined,
        // The completion payload (drill result / criterion / achievedTier) is
        // now surfaced by the server — carry it so the session summary can read
        // each brick's outcome. null → leave undefined (legacy "no payload").
        data: entry.data ?? undefined,
      };
    }
  }
  return out;
}

/** Convert the server's exercises array to the legacy map keyed by exerciseId. */
export function toLegacyPracticeCompletions(
  data: GetTutorialProgressResponse | undefined,
): LegacyPracticeCompletions {
  if (!data) return {};
  const out: LegacyPracticeCompletions = {};
  for (const entry of data.exercises) {
    out[entry.exerciseId] = {
      count: entry.completionCount,
      lastTempoBpm: entry.lastTempoBpm ?? undefined,
    };
  }
  return out;
}

/** Look up a block entry by id. Undefined when the block isn't in the response. */
export function findBlockEntry(
  data: GetTutorialProgressResponse | undefined,
  blockId: string,
): BlockProgressEntry | undefined {
  return data?.blocks.find((b) => b.blockId === blockId);
}
