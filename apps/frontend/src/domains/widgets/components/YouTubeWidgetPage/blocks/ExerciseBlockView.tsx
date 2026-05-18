'use client';

import React, { type ReactNode } from 'react';
import type { TutorialBlock } from '@bassnotion/contracts';

interface ExerciseBlockViewProps {
  block: TutorialBlock<'exercise'>;
  isActive: boolean;
  isCompleted: boolean;
  onComplete: () => void;
  onNext: () => void;
  children: ReactNode;
}

export const ExerciseBlockView = React.memo(function ExerciseBlockView({
  children,
}: ExerciseBlockViewProps) {
  return (
    <div className="h-full flex flex-col">
      <div
        className="flex-1 overflow-y-auto"
        style={{ overscrollBehavior: 'contain' }}
      >
        <div className="min-h-full flex items-center justify-center">
          <div className="mx-auto px-4 py-6 w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-[800px]">
            <div className="space-y-0">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
});
