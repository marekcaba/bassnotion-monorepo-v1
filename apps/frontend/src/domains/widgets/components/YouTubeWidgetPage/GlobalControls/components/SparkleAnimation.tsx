'use client';

/**
 * SparkleAnimation Component
 *
 * Renders animated sparkle particles for button feedback.
 * Used for like, favorite, loop, and comment button animations.
 */

import React from 'react';
import type { SparkleAnimationProps } from '../types.js';

/**
 * Renders animated sparkle particles
 */
export function SparkleAnimation({
  sparkles,
  Icon,
  colorClass,
}: SparkleAnimationProps) {
  if (sparkles.length === 0) {
    return null;
  }

  return (
    <>
      {sparkles.map((sparkle) => (
        <Icon
          key={sparkle.id}
          className={`absolute w-2 h-2 ${colorClass} pointer-events-none animate-sparkle-burst`}
          style={
            {
              top: '50%',
              left: '50%',
              '--sparkle-x': `${sparkle.x}px`,
              '--sparkle-y': `${sparkle.y}px`,
              '--sparkle-scale': sparkle.scale,
              '--sparkle-rotation': `${sparkle.rotation}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </>
  );
}
