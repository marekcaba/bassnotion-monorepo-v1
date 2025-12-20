'use client';

/**
 * Glass Container Component
 *
 * A reusable container with glassmorphism effects.
 * Works independently of the UI zone system but respects theme colors.
 */

import { cn } from '@/shared/utils/cn';

interface GlassContainerProps {
  children: React.ReactNode;
  className?: string;
  /** Glass blur intensity */
  intensity?: 'light' | 'medium' | 'heavy';
  /** Use theme colors for tinting */
  themed?: boolean;
  /** HTML element to render as */
  as?: 'div' | 'section' | 'article' | 'aside';
}

const intensityClasses = {
  light: 'backdrop-blur-sm bg-white/5 border-white/10',
  medium: 'backdrop-blur-md bg-white/10 border-white/15',
  heavy: 'backdrop-blur-xl bg-white/15 border-white/20',
};

export function GlassContainer({
  children,
  className,
  intensity = 'medium',
  themed = false,
  as: Component = 'div',
}: GlassContainerProps) {
  return (
    <Component
      className={cn(
        'rounded-2xl border',
        intensityClasses[intensity],
        'shadow-[0_8px_32px_rgba(0,0,0,0.3)]',
        'transition-all duration-300',
        themed && 'glass-container--themed',
        className
      )}
    >
      {children}
    </Component>
  );
}
