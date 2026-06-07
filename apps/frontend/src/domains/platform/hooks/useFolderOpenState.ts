import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { SidebarFolder } from './useTutorialsByFolder';

/**
 * Manage which sidebar folders are open/collapsed. Shared between the expanded
 * and collapsed sidebar views.
 *
 * Folders are DB-driven and load async, so the open-set can't be seeded from a
 * static list. Instead, the first time folders arrive we auto-open the free
 * ones (their default), once — after that the user's toggles are respected and
 * newly-appearing folders stay collapsed unless free.
 */
export function useFolderOpenState(folders: SidebarFolder[] = []) {
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const seededIds = useRef<Set<string>>(new Set());

  // Auto-open any free folder we haven't seeded yet (runs as folders load).
  useEffect(() => {
    const newlyFree = folders.filter(
      (f) => f.isFree && !seededIds.current.has(f.id),
    );
    if (newlyFree.length === 0) {
      // Still record any non-free folders so we don't reconsider them later.
      for (const f of folders) seededIds.current.add(f.id);
      return;
    }
    setOpenFolders((prev) => {
      const next = new Set(prev);
      for (const f of newlyFree) next.add(f.id);
      return next;
    });
    for (const f of folders) seededIds.current.add(f.id);
  }, [folders]);

  const toggleFolder = useCallback((folderId: string) => {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  const isFolderOpen = useCallback(
    (folderId: string) => openFolders.has(folderId),
    [openFolders],
  );

  return useMemo(
    () => ({
      openFolders,
      toggleFolder,
      isFolderOpen,
    }),
    [openFolders, toggleFolder, isFolderOpen],
  );
}

export type FolderOpenState = ReturnType<typeof useFolderOpenState>;
