'use client';

import { useState, ReactNode } from 'react';
import { cn } from '@/shared/utils/index';

interface AnimatedLoginSwitcherProps {
  children: {
    password: ReactNode;
    magicLink: ReactNode;
  };
  className?: string;
}

type LoginMode = 'password' | 'magic-link';

export function AnimatedLoginSwitcher({ children, className }: AnimatedLoginSwitcherProps) {
  const [activeMode, setActiveMode] = useState<LoginMode>('password');
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleModeChange = (mode: LoginMode) => {
    if (mode === activeMode || isTransitioning) return;
    
    setIsTransitioning(true);
    setActiveMode(mode);
    
    // Reset transition state after animation completes
    setTimeout(() => {
      setIsTransitioning(false);
    }, 200);
  };

  return (
    <div className={cn('space-y-4 sm:space-y-6', className)}>
      {/* Tab List */}
      <div className="inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground w-full">
        <button
          type="button"
          onClick={() => handleModeChange('password')}
          className={cn(
            'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 flex-1',
            activeMode === 'password'
              ? 'bg-background text-foreground shadow'
              : 'hover:bg-background/50'
          )}
          disabled={isTransitioning}
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('magic-link')}
          className={cn(
            'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 flex-1',
            activeMode === 'magic-link'
              ? 'bg-background text-foreground shadow'
              : 'hover:bg-background/50'
          )}
          disabled={isTransitioning}
        >
          Magic Link
        </button>
      </div>

      {/* Content Container with Smooth Crossfade */}
      <div className="relative min-h-[420px] overflow-hidden">
        {/* Password Form */}
        <div
          className={cn(
            'transition-opacity duration-200 ease-in-out',
            activeMode === 'password' 
              ? 'opacity-100 pointer-events-auto relative' 
              : 'opacity-0 pointer-events-none absolute inset-0'
          )}
        >
          {children.password}
        </div>

        {/* Magic Link Form */}
        <div
          className={cn(
            'transition-opacity duration-200 ease-in-out',
            activeMode === 'magic-link' 
              ? 'opacity-100 pointer-events-auto relative' 
              : 'opacity-0 pointer-events-none absolute inset-0'
          )}
        >
          {children.magicLink}
        </div>
      </div>
    </div>
  );
} 