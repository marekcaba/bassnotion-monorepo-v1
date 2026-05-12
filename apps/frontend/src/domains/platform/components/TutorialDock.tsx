'use client';

import { Skeleton } from '@/shared/components/ui/skeleton';
import { PRODUCT_FOLDERS } from '../constants/product-folders';
import { TutorialFolder } from './TutorialFolder';
import { useTutorialsByFolder } from '../hooks/useTutorialsByFolder';
import type { FolderOpenState } from '../hooks/useFolderOpenState';

interface TutorialDockProps {
  folderState?: FolderOpenState;
}

export function TutorialDock({ folderState }: TutorialDockProps) {
  const { tutorialsByFolder, isLoading } = useTutorialsByFolder();

  return (
    <div className="px-2 py-2">
      <div className="space-y-1">
        {isLoading ? (
          <div className="space-y-2 px-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </div>
        ) : (
          <>
            {PRODUCT_FOLDERS.map((folder) => (
              <TutorialFolder
                key={folder.id}
                title={folder.title}
                tutorials={tutorialsByFolder[folder.id] || []}
                isOpen={folderState?.isFolderOpen(folder.id)}
                onOpenChange={(open) => {
                  if (open !== folderState?.isFolderOpen(folder.id)) {
                    folderState?.toggleFolder(folder.id);
                  }
                }}
                defaultOpen={folder.isFree}
                isLocked={!folder.isFree && tutorialsByFolder[folder.id]?.length === 0}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
