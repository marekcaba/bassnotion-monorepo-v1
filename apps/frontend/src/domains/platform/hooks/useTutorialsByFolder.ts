'use client';

import { useMemo, useState, useEffect } from 'react';
import { useTutorials } from '@/domains/widgets/hooks/useTutorials';
import { useTutorialProgress, type TutorialProgress } from './useTutorialProgress';
import { PRODUCT_FOLDERS } from '../constants/product-folders';

/** Block visible in the sidebar progress dots */
export interface IslandBlock {
  id: string;
  title: string;
}

export interface TutorialItem {
  slug: string;
  title: string;
  sidebarTitle?: string;
  difficulty: string;
  /** Legacy field - kept for backward compatibility */
  isComplete: boolean;
  /** Three-stage progress tracking */
  progress: TutorialProgress;
  /** Blocks visible in the Dynamic Island (showInIsland !== false) */
  islandBlocks?: IslandBlock[];
  /** Per-block completion status read from localStorage */
  blockProgress?: Record<string, { completed: boolean }>;
}

const BLOCK_PROGRESS_STORAGE_PREFIX = 'bassnotion-block-progress-';

/** Read block progress from localStorage for a given tutorial */
function readBlockProgressFromStorage(tutorialId: string): Record<string, { completed: boolean }> | undefined {
  try {
    const raw = localStorage.getItem(`${BLOCK_PROGRESS_STORAGE_PREFIX}${tutorialId}`);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Record<string, { completed: boolean }>;
    return parsed;
  } catch {
    return undefined;
  }
}

export type TutorialsByFolder = Record<string, TutorialItem[]>;

/**
 * Hook to fetch tutorials and group them by folder.
 * Shared between TutorialDock and CollapsedTutorialDock.
 *
 * Now includes three-stage progress tracking (understood, practiced, applied).
 */
export function useTutorialsByFolder() {
  const { tutorials, isLoading } = useTutorials();
  const [updateTrigger, setUpdateTrigger] = useState(0);

  // Prepare tutorial info for progress check
  const tutorialInfos = useMemo(
    () =>
      tutorials.map((t) => ({
        id: t.id,
        exerciseCount: t.exercise_count,
      })),
    [tutorials],
  );

  // Get three-stage progress for all tutorials
  const progressMap = useTutorialProgress(tutorialInfos);

  // Listen for progress update events to trigger re-render
  useEffect(() => {
    const handleProgressUpdate = () => {
      setUpdateTrigger((prev) => prev + 1);
    };

    window.addEventListener('tutorial-progress-updated', handleProgressUpdate);
    window.addEventListener('block-progress-updated', handleProgressUpdate);
    return () => {
      window.removeEventListener('tutorial-progress-updated', handleProgressUpdate);
      window.removeEventListener('block-progress-updated', handleProgressUpdate);
    };
  }, []);

  // Group tutorials by category (folder)
  const tutorialsByFolder = useMemo(() => {
    const grouped: TutorialsByFolder = {};

    // Initialize folders
    PRODUCT_FOLDERS.forEach((folder) => {
      grouped[folder.id] = [];
    });

    // Group tutorials by their category
    tutorials.forEach((t) => {
      const folderId = t.category || 'starter-kit'; // Default to starter-kit if no category
      if (grouped[folderId]) {
        const progress = progressMap[t.id] ?? {
          understood: false,
          practiced: false,
          applied: false,
        };

        // Compute island-visible blocks (same filter as DynamicIsland)
        const islandBlocks: IslandBlock[] | undefined =
          t.blocks && t.blocks.length > 0
            ? t.blocks
                .filter((b) => b.showInIsland !== false)
                .map((b) => ({ id: b.id, title: b.title }))
            : undefined;

        // Read per-block completion from localStorage
        const blockProgress = islandBlocks ? readBlockProgressFromStorage(t.id) : undefined;

        // isComplete: prefer block-based when blocks exist
        const isComplete = islandBlocks && islandBlocks.length > 0
          ? islandBlocks.every((b) => blockProgress?.[b.id]?.completed)
          : progress.understood && progress.practiced && progress.applied;

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
      }
    });

    return grouped;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorials, progressMap, updateTrigger]);

  return {
    tutorialsByFolder,
    isLoading,
  };
}
