'use client';

import { useMemo } from 'react';
import { useTutorials } from '@/domains/widgets/hooks/useTutorials';
import { useUserTutorialCompletions } from '@/domains/progress';
import type { TutorialCompletionSummary } from '@bassnotion/contracts';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { PRODUCT_FOLDERS } from '../constants/product-folders';

/** Block visible in the sidebar progress dots */
export interface IslandBlock {
  id: string;
  title: string;
}

/**
 * Legacy three-stage progress shape, kept for backward compatibility with
 * components that still display understood/practiced/applied indicators.
 * Derived from block completion in the new model.
 */
export interface TutorialProgress {
  understood: boolean;
  practiced: boolean;
  applied: boolean;
}

export interface TutorialItem {
  slug: string;
  title: string;
  sidebarTitle?: string;
  difficulty: string;
  /** True iff every block in tutorial.blocks is completed */
  isComplete: boolean;
  /** Three-stage progress tracking (derived from blocks). */
  progress: TutorialProgress;
  /** Blocks visible in the Dynamic Island (showInIsland !== false) */
  islandBlocks?: IslandBlock[];
  /** Per-block completion status keyed by block id */
  blockProgress?: Record<string, { completed: boolean }>;
}

export type TutorialsByFolder = Record<string, TutorialItem[]>;

/**
 * Hook to fetch tutorials and group them by folder, decorated with the
 * current user's progress. Single chokepoint for TutorialDock,
 * CollapsedTutorialDock, BassmentJourneyView, CollapsedJourneyPath.
 *
 * Replaces the legacy implementation that read localStorage directly per
 * tutorial id. Now sources from the backend summary endpoint
 * (`/api/v1/users/me/tutorial-completions`) via TanStack Query, which
 * handles cache invalidation centrally — no more event-driven re-renders.
 */
export function useTutorialsByFolder() {
  const { tutorials, isLoading: tutorialsLoading } = useTutorials();
  const { isAuthenticated } = useAuth();

  // The completions query is gated on authentication — the endpoint is
  // AuthGuard-protected and would 401 for anonymous users.
  const { data: completionsData, isLoading: progressLoading } =
    useUserTutorialCompletions({ enabled: isAuthenticated });

  // Index completion summaries by tutorial id for O(1) lookup below.
  const summaryByTutorialId = useMemo(() => {
    const map = new Map<string, TutorialCompletionSummary>();
    if (!completionsData) return map;
    for (const summary of completionsData.tutorials) {
      map.set(summary.tutorialId, summary);
    }
    return map;
  }, [completionsData]);

  const tutorialsByFolder = useMemo(() => {
    const grouped: TutorialsByFolder = {};
    PRODUCT_FOLDERS.forEach((folder) => {
      grouped[folder.id] = [];
    });

    tutorials.forEach((t) => {
      const folderId = t.category || 'starter-kit';
      if (!grouped[folderId]) return;

      const summary = summaryByTutorialId.get(t.id);

      // Island-visible blocks — same filter the DynamicIsland uses, kept
      // here so the sidebar progress dots can render the right ones.
      const islandBlocks: IslandBlock[] | undefined =
        t.blocks && t.blocks.length > 0
          ? t.blocks
              .filter((b) => b.showInIsland !== false)
              .map((b) => ({ id: b.id, title: b.title }))
          : undefined;

      // Per-block completion map. Convert the summary's record into the
      // legacy {completed: boolean} shape that consumers expect. Falls
      // back to undefined when the tutorial has no blocks (legacy tutorials).
      const blockProgress = islandBlocks
        ? islandBlocks.reduce<Record<string, { completed: boolean }>>(
            (acc, b) => {
              acc[b.id] = {
                completed: summary?.blockCompletions[b.id] ?? false,
              };
              return acc;
            },
            {},
          )
        : undefined;

      const isComplete = summary?.isComplete ?? false;

      // Derived three-stage progress for legacy UI bits. We can't infer
      // a precise mapping from the new block-based model — the closest
      // approximation is "have we touched ANY block" → understood, "is
      // half the tutorial done" → practiced, "is everything done" →
      // applied. Better than dropping the field outright; consumers using
      // this should migrate to isComplete or blockCompletions over time.
      const completedCount = summary?.completedBlockCount ?? 0;
      const totalCount = summary?.totalBlockCount ?? 0;
      const progress: TutorialProgress = {
        understood: completedCount > 0,
        practiced: totalCount > 0 && completedCount >= totalCount / 2,
        applied: isComplete,
      };

      grouped[folderId].push({
        slug: t.slug,
        title: t.title,
        sidebarTitle: t.sidebar_title,
        difficulty: t.difficulty,
        isComplete,
        progress,
        islandBlocks,
        blockProgress,
      });
    });

    return grouped;
  }, [tutorials, summaryByTutorialId]);

  return {
    tutorialsByFolder,
    isLoading: tutorialsLoading || progressLoading,
  };
}
