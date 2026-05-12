import { useState, useCallback, useMemo } from 'react';
import { PRODUCT_FOLDERS } from '../constants/product-folders';

/**
 * Hook to manage which tutorial folders are open/collapsed.
 * Shared between expanded and collapsed sidebar views.
 */
export function useFolderOpenState() {
  // Initialize with free folders open by default
  const [openFolders, setOpenFolders] = useState<Set<string>>(() => {
    const initialOpen = new Set<string>();
    PRODUCT_FOLDERS.forEach((folder) => {
      if (folder.isFree) {
        initialOpen.add(folder.id);
      }
    });
    return initialOpen;
  });

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
