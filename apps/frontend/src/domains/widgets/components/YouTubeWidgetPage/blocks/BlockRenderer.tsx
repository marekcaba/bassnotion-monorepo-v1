'use client';

import React, { useCallback } from 'react';
import type { AnyBlock, BlockType } from '@bassnotion/contracts';
import { VideoBlockView } from './VideoBlockView.js';
import { ExerciseBlockView } from './ExerciseBlockView.js';
import { GrooveBlockView } from './GrooveBlockView.js';
import { GrooveCardBlockView } from './GrooveCardBlockView.js';
import { TextBlockView } from './TextBlockView.js';
import { CelebrationBlockView } from './CelebrationBlockView.js';
import { ExplainBlockView } from './ExplainBlockView.js';
import { TaskBlockView } from './TaskBlockView.js';

const BLOCK_COMPONENTS: Record<BlockType, React.ComponentType<any>> = {
  video: VideoBlockView,
  exercise: ExerciseBlockView,
  groove: GrooveBlockView,
  'groove-card': GrooveCardBlockView,
  text: TextBlockView,
  celebration: CelebrationBlockView,
  explain: ExplainBlockView,
  task: TaskBlockView,
};

interface BlockRendererProps {
  block: AnyBlock;
  isActive: boolean;
  isCompleted: boolean;
  /** `data` carries the per-block completion payload (e.g. a drill brick's
   *  { result, criterion, achievedTier }) into block_completions.data. */
  onComplete: (blockId: string, data?: Record<string, unknown>) => void;
  onNext: () => void;
  [key: string]: any;
}

export const BlockRenderer = React.memo(function BlockRenderer({
  block,
  isActive,
  isCompleted,
  onComplete,
  onNext,
  ...passthrough
}: BlockRendererProps) {
  const Component = BLOCK_COMPONENTS[block.type];

  // Forward the optional completion payload (previously dropped — which is why
  // authenticated drill conquers never persisted their tier).
  const handleComplete = useCallback(
    (data?: Record<string, unknown>) => {
      onComplete(block.id, data);
    },
    [block.id, onComplete],
  );

  if (!Component) {
    return (
      <div className="h-full flex items-center justify-center text-white/50">
        Unknown block type: {block.type}
      </div>
    );
  }

  return (
    <Component
      block={block}
      isActive={isActive}
      isCompleted={isCompleted}
      onComplete={handleComplete}
      onNext={onNext}
      {...passthrough}
    />
  );
});
