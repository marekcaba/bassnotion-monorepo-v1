'use client';

import { useMemo } from 'react';
import { useTutorials } from '@/domains/widgets/hooks/useTutorials';
import { useCollections } from '@/domains/widgets/hooks/useCollections';
import { useUserTutorialCompletions } from '@/domains/progress';
import type { TutorialCompletionSummary } from '@bassnotion/contracts';
import { useAuth } from '@/domains/user/hooks/use-auth';

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

/** A sidebar folder, sourced from the DB-driven collections endpoint. */
export interface SidebarFolder {
  id: string;
  title: string;
  /** Free folders default to open; non-free ones start collapsed. */
  isFree: boolean;
  /** True when the caller can see the folder but not its contents (teaser). */
  isLocked: boolean;
}

/**
 * Build a TutorialItem (sidebar shape) from a tutorial + its progress summary.
 * Extracted so it can run once per tutorial into an index, then be looked up by
 * each folder's ordered tutorialIds.
 */
function toTutorialItem(
  t: ReturnType<typeof useTutorials>['tutorials'][number],
  summary: TutorialCompletionSummary | undefined,
): TutorialItem {
  // Island-visible blocks — same filter the DynamicIsland uses, kept here so
  // the sidebar progress dots can render the right ones.
  const islandBlocks: IslandBlock[] | undefined =
    t.blocks && t.blocks.length > 0
      ? t.blocks
          .filter((b) => b.showInIsland !== false)
          .map((b) => ({ id: b.id, title: b.title }))
      : undefined;

  // Per-block completion map in the legacy {completed} shape consumers expect.
  const blockProgress = islandBlocks
    ? islandBlocks.reduce<Record<string, { completed: boolean }>>((acc, b) => {
        acc[b.id] = { completed: summary?.blockCompletions[b.id] ?? false };
        return acc;
      }, {})
    : undefined;

  const isComplete = summary?.isComplete ?? false;

  // Derived three-stage progress for legacy UI bits (approximation from blocks).
  const completedCount = summary?.completedBlockCount ?? 0;
  const totalCount = summary?.totalBlockCount ?? 0;
  const progress: TutorialProgress = {
    understood: completedCount > 0,
    practiced: totalCount > 0 && completedCount >= totalCount / 2,
    applied: isComplete,
  };

  return {
    slug: t.slug,
    title: t.title,
    sidebarTitle: t.sidebar_title,
    difficulty: t.difficulty,
    isComplete,
    progress,
    islandBlocks,
    blockProgress,
  };
}

/**
 * Source the sidebar folders + their tutorials from the DB-driven collections
 * endpoint, decorated with the current user's progress. Single chokepoint for
 * BassmentJourneyView, TutorialDock, CollapsedTutorialDock, CollapsedJourneyPath.
 *
 * Folders come from GET /collections (real folders the caller can access +
 * virtual folders for owned packs); each folder's ordered tutorialIds are
 * joined against the tutorials list (GET /tutorials) the app already loads.
 * Replaces the hardcoded PRODUCT_FOLDERS array + the brittle category match.
 */
export function useTutorialsByFolder() {
  const { tutorials, isLoading: tutorialsLoading } = useTutorials();
  const { collections, isLoading: collectionsLoading } = useCollections();
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

  // Index each tutorial's sidebar item by id, so a folder's tutorialIds resolve
  // in O(1) and a tutorial in multiple folders is built once.
  const itemByTutorialId = useMemo(() => {
    const map = new Map<string, TutorialItem>();
    for (const t of tutorials) {
      map.set(t.id, toTutorialItem(t, summaryByTutorialId.get(t.id)));
    }
    return map;
  }, [tutorials, summaryByTutorialId]);

  // The folder list the sidebar renders (from the DB), ordered by the backend.
  const folders = useMemo<SidebarFolder[]>(
    () =>
      collections.map((c) => ({
        id: c.id,
        title: c.title,
        isFree: c.accessTier === 'free',
        isLocked: c.isLocked,
      })),
    [collections],
  );

  // folderId → ordered TutorialItem[] (skipping ids not in the loaded list,
  // e.g. a tutorial filtered out by access on the server already won't appear).
  const tutorialsByFolder = useMemo(() => {
    const grouped: TutorialsByFolder = {};
    for (const c of collections) {
      grouped[c.id] = c.tutorialIds
        .map((id) => itemByTutorialId.get(id))
        .filter((item): item is TutorialItem => item !== undefined);
    }
    return grouped;
  }, [collections, itemByTutorialId]);

  return {
    folders,
    tutorialsByFolder,
    isLoading: tutorialsLoading || collectionsLoading || progressLoading,
  };
}
