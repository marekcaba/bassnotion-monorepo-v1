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

const BLOCK_COMPONENTS: Record<BlockType, React.ComponentType<any>> = {
  video: VideoBlockView,
  exercise: ExerciseBlockView,
  groove: GrooveBlockView,
  'groove-card': GrooveCardBlockView,
  text: TextBlockView,
  celebration: CelebrationBlockView,
  explain: ExplainBlockView,
};

interface BlockRendererProps {
  block: AnyBlock;
  isActive: boolean;
  isCompleted: boolean;
  onComplete: (blockId: string) => void;
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

  const handleComplete = useCallback(() => {
    onComplete(block.id);
  }, [block.id, onComplete]);

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
