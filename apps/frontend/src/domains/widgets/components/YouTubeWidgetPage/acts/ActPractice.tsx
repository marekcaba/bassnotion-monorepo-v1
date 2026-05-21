'use client';

import React, { type ReactNode } from 'react';

interface ActPracticeProps {
  /** The practice card content (DraggableCardLayout) */
  children: ReactNode;
}

/**
 * Act 2: "Practice"
 * Exercise selector, fretboard, and playback controls — all in an internally scrollable container.
 * Playback controls are inline within the card layout (not a separate pinned bar).
 * Transition to Act 3 is handled by the Unlock button on the reward card in ExerciseSelectorCard.
 */
export const ActPractice = React.memo(function ActPractice({
  children,
}: ActPracticeProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Internally scrollable content. overscroll-behavior-x: contain
          stops horizontal swipes from triggering browser back-nav; vertical
          intentionally chains to the parent snap container so the user can
          scroll up out of this block into the one above. */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ overscrollBehaviorX: 'contain', overscrollBehaviorY: 'auto' }}
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
