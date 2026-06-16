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
    blocks[0]?.id ?? null,
  );

  useEffect(() => {
    const container = containerRef.current;
    const refs = blockRefs.current;
    if (!container || !refs) return;

    // Track the latest visibility ratio per block across observer batches, then
    // pick the MOST-visible block as current. The old code set current to the
    // LAST intersecting entry in a batch — which is wrong when several sections
    // intersect at once (e.g. a drill where multiple bricks unlock together and
    // are all ≥50% visible): it would jump current to the last brick instead of
    // the one actually in view, stranding the auto-advance.
    const ratios = new Map<string, number>();
    const blockIdFor = (target: Element): string | undefined =>
      Array.from(refs.entries()).find(([, el]) => el === target)?.[0];

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = blockIdFor(entry.target);
          if (!id) continue;
          ratios.set(id, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        // Choose the most-visible block (highest ratio > 0).
        let bestId: string | null = null;
        let bestRatio = 0;
        for (const [id, ratio] of ratios) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        }
        if (bestId) setCurrentBlockId(bestId);
      },
      // Multiple thresholds so the ratio updates smoothly as sections scroll,
      // letting "most visible" track the leading edge rather than snapping.
      { root: container, threshold: [0.25, 0.5, 0.75, 1] },
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
    [blockRefs],
  );

  const scrollToIndex = useCallback(
    (index: number, options?: { instant?: boolean }) => {
      const block = blocks[index];
      if (block) scrollToBlock(block.id, options);
    },
    [blocks, scrollToBlock],
  );

  return {
    currentBlockId,
    currentBlockIndex,
    scrollToBlock,
    scrollToIndex,
    setCurrentBlockId,
  };
}
