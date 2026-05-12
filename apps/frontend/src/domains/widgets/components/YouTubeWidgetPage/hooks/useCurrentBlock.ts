import { useState, useEffect, useCallback, type RefObject } from 'react';
import type { AnyBlock } from '@bassnotion/contracts';

interface UseCurrentBlockParams {
  containerRef: RefObject<HTMLDivElement | null>;
  blockRefs: RefObject<Map<string, HTMLDivElement>>;
  blocks: AnyBlock[];
}

interface UseCurrentBlockResult {
  currentBlockId: string | null;
  currentBlockIndex: number;
  scrollToBlock: (blockId: string, options?: { instant?: boolean }) => void;
  scrollToIndex: (index: number, options?: { instant?: boolean }) => void;
  setCurrentBlockId: (id: string) => void;
}

/**
 * Detects which block is currently visible in a scroll-snap container
 * using IntersectionObserver, and provides smooth-scroll navigation.
 *
 * Follows the same IntersectionObserver pattern as useCurrentAct but
 * supports a dynamic number of blocks via a Map of refs.
 */
export function useCurrentBlock({
  containerRef,
  blockRefs,
  blocks,
}: UseCurrentBlockParams): UseCurrentBlockResult {
  const [currentBlockId, setCurrentBlockId] = useState<string | null>(
    blocks[0]?.id ?? null
  );

  useEffect(() => {
    const container = containerRef.current;
    const refs = blockRefs.current;
    if (!container || !refs) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const blockId = Array.from(refs.entries()).find(
              ([, el]) => el === entry.target
            )?.[0];
            if (blockId) setCurrentBlockId(blockId);
          }
        }
      },
      { root: container, threshold: 0.5 }
    );

    refs.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [containerRef, blockRefs, blocks]);

  const currentBlockIndex = blocks.findIndex((b) => b.id === currentBlockId);

  const scrollToBlock = useCallback(
    (blockId: string, options?: { instant?: boolean }) => {
      const el = blockRefs.current?.get(blockId);
      el?.scrollIntoView({ behavior: options?.instant ? 'auto' : 'smooth' });
    },
    [blockRefs]
  );

  const scrollToIndex = useCallback(
    (index: number, options?: { instant?: boolean }) => {
      const block = blocks[index];
      if (block) scrollToBlock(block.id, options);
    },
    [blocks, scrollToBlock]
  );

  return {
    currentBlockId,
    currentBlockIndex,
    scrollToBlock,
    scrollToIndex,
    setCurrentBlockId,
  };
}
