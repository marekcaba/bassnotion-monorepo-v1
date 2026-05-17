import type { AnyBlock, BlockProgress } from '@bassnotion/contracts';

/**
 * Determines which block to show first based on progress.
 * Returns the first incomplete block, or the last block if all are complete.
 *
 * This is the block-system equivalent of getInitialAct, but works with
 * a dynamic number of blocks instead of a fixed three-act structure.
 */
export function getInitialBlock(
  blocks: AnyBlock[],
  blockProgress: Record<string, BlockProgress>,
): string | null {
  if (blocks.length === 0) return null;

  const firstIncomplete = blocks.find(
    (block) => !blockProgress[block.id]?.completed,
  );

  return firstIncomplete?.id ?? blocks[blocks.length - 1].id;
}
