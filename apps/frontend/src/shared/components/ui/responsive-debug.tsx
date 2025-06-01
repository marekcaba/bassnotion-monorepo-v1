'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/shared/utils';

interface ResponsiveDebugProps {
  className?: string;
  showAlways?: boolean;
}

export function ResponsiveDebug({
  className,
  showAlways = false,
}: ResponsiveDebugProps) {
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const [currentBreakpoint, setCurrentBreakpoint] = useState('');

  useEffect(() => {
    const updateSize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setWindowSize({ width, height });

      // Determine current breakpoint
      if (width < 475) {
        setCurrentBreakpoint('mobile');
      } else if (width < 640) {
        setCurrentBreakpoint('xs');
      } else if (width < 768) {
        setCurrentBreakpoint('sm');
      } else if (width < 1024) {
        setCurrentBreakpoint('md');
      } else if (width < 1280) {
        setCurrentBreakpoint('lg');
      } else if (width < 1536) {
        setCurrentBreakpoint('xl');
      } else {
        setCurrentBreakpoint('2xl');
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Only show in development or when explicitly enabled
  if (!showAlways && process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 bg-black/80 text-white text-xs p-2 rounded font-mono z-50',
        'backdrop-blur-sm border border-white/20',
        className,
      )}
    >
      <div className="space-y-1">
        <div className="flex items-center space-x-2">
          <span className="font-semibold">Breakpoint:</span>
          <span className="px-2 py-1 bg-blue-600 rounded text-xs">
            {currentBreakpoint}
          </span>
        </div>
        <div className="text-xs opacity-75">
          {windowSize.width}×{windowSize.height}
        </div>
        <div className="text-xs opacity-75">
          {/* Show which Tailwind classes are active */}
          <span className="inline xs:hidden">mobile</span>
          <span className="hidden xs:inline sm:hidden">xs</span>
          <span className="hidden sm:inline md:hidden">sm</span>
          <span className="hidden md:inline lg:hidden">md</span>
          <span className="hidden lg:inline xl:hidden">lg</span>
          <span className="hidden xl:inline 2xl:hidden">xl</span>
          <span className="hidden 2xl:inline">2xl</span>
        </div>
      </div>
    </div>
  );
}

// Breakpoint indicator component for testing
export function BreakpointIndicator() {
  return (
    <div className="grid grid-cols-6 gap-2 p-4 bg-muted rounded-lg">
      <div className="text-center">
        <div className="block xs:hidden p-2 bg-red-500 text-white rounded text-xs">
          Mobile
        </div>
        <div className="hidden xs:block p-2 bg-gray-300 rounded text-xs">
          Mobile
        </div>
      </div>

      <div className="text-center">
        <div className="hidden xs:block sm:hidden p-2 bg-orange-500 text-white rounded text-xs">
          XS
        </div>
        <div className="block xs:hidden sm:block p-2 bg-gray-300 rounded text-xs">
          XS
        </div>
      </div>

      <div className="text-center">
        <div className="hidden sm:block md:hidden p-2 bg-yellow-500 text-white rounded text-xs">
          SM
        </div>
        <div className="block sm:hidden md:block p-2 bg-gray-300 rounded text-xs">
          SM
        </div>
      </div>

      <div className="text-center">
        <div className="hidden md:block lg:hidden p-2 bg-green-500 text-white rounded text-xs">
          MD
        </div>
        <div className="block md:hidden lg:block p-2 bg-gray-300 rounded text-xs">
          MD
        </div>
      </div>

      <div className="text-center">
        <div className="hidden lg:block xl:hidden p-2 bg-blue-500 text-white rounded text-xs">
          LG
        </div>
        <div className="block lg:hidden xl:block p-2 bg-gray-300 rounded text-xs">
          LG
        </div>
      </div>

      <div className="text-center">
        <div className="hidden xl:block p-2 bg-purple-500 text-white rounded text-xs">
          XL+
        </div>
        <div className="block xl:hidden p-2 bg-gray-300 rounded text-xs">
          XL+
        </div>
      </div>
    </div>
  );
}

// Test grid component for responsive layouts
export function ResponsiveTestGrid() {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Responsive Grid Test</h3>

      <div className="grid-responsive-cards">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="card-responsive min-h-[100px] flex items-center justify-center"
          >
            <span className="text-responsive-sm font-medium">Card {i + 1}</span>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <h4 className="text-responsive-lg">Responsive Text Sizes</h4>
        <div className="text-responsive-xs">
          Extra Small Text (text-responsive-xs)
        </div>
        <div className="text-responsive-sm">
          Small Text (text-responsive-sm)
        </div>
        <div className="text-responsive-base">
          Base Text (text-responsive-base)
        </div>
        <div className="text-responsive-lg">
          Large Text (text-responsive-lg)
        </div>
        <div className="text-responsive-xl">
          Extra Large Text (text-responsive-xl)
        </div>
        <div className="text-responsive-2xl">
          2XL Text (text-responsive-2xl)
        </div>
      </div>

      <div className="btn-responsive-group">
        <button className="btn-responsive bg-primary text-primary-foreground px-4 py-2 rounded">
          Button 1
        </button>
        <button className="btn-responsive bg-secondary text-secondary-foreground px-4 py-2 rounded">
          Button 2
        </button>
        <button className="btn-responsive bg-accent text-accent-foreground px-4 py-2 rounded">
          Button 3
        </button>
      </div>
    </div>
  );
}
