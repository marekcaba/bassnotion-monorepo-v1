'use client';

import { useMemo } from 'react';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { PRODUCT_FOLDERS } from '../constants/product-folders';
import { useTutorialsByFolder, type IslandBlock } from '../hooks/useTutorialsByFolder';
import type { FolderOpenState } from '../hooks/useFolderOpenState';
import { CollapsedJourneyPath } from './CollapsedJourneyPath';
import type { TutorialProgress } from './ProgressPane';

interface CollapsedTutorialDockProps {
  folderState?: FolderOpenState;
}

/**
 * Collapsed version of TutorialDock showing only journey path dots.
 * Respects the folder open/closed state to show only tutorials
 * that would be visible in the expanded view.
 */
export function CollapsedTutorialDock({ folderState }: CollapsedTutorialDockProps) {
  const { tutorialsByFolder, isLoading } = useTutorialsByFolder();

  // Get only tutorials from open folders
  const visibleTutorials = useMemo(() => {
    const tutorials: Array<{
      slug: string;
      title: string;
      sidebarTitle?: string;
      isComplete: boolean;
      progress?: TutorialProgress;
      islandBlocks?: IslandBlock[];
      blockProgress?: Record<string, { completed: boolean }>;
    }> = [];

    PRODUCT_FOLDERS.forEach((folder) => {
      // Only include tutorials from open folders
      const isOpen = folderState?.isFolderOpen(folder.id) ?? folder.isFree;
      if (isOpen) {
        const folderTutorials = tutorialsByFolder[folder.id] || [];
        tutorials.push(
          ...folderTutorials.map((t) => ({
            slug: t.slug,
            title: t.title,
            sidebarTitle: t.sidebarTitle,
            isComplete: t.isComplete,
            progress: t.progress,
            islandBlocks: t.islandBlocks,
            blockProgress: t.blockProgress,
          })),
        );
      }
    });

    return tutorials;
  }, [tutorialsByFolder, folderState]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center py-3 gap-1.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="size-4 rounded-full" />
        ))}
      </div>
    );
  }

  if (visibleTutorials.length === 0) {
    return null;
  }

  return <CollapsedJourneyPath tutorials={visibleTutorials} />;
}
