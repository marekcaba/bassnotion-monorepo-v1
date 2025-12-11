'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Cubic ease-out function for smooth deceleration
 * Creates natural-feeling animation that slows down at the end
 */
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

export interface UseSmoothScrollOptions {
  /** Reference to the scrollable container element */
  containerRef: RefObject<HTMLElement | null>;
  /** Animation duration in milliseconds (default: 200ms) */
  duration?: number;
  /** Custom easing function (default: cubic ease-out) */
  easing?: (t: number) => number;
  /** Callback when manual scroll is detected during playback */
  onManualScroll?: () => void;
}

export interface UseSmoothScrollReturn {
  /** Smoothly scroll to target X position */
  scrollTo: (targetX: number) => void;
  /** Cancel any ongoing scroll animation */
  cancelScroll: () => void;
  /** Whether a scroll animation is currently in progress */
  isScrolling: boolean;
  /** Whether auto-scroll has been disabled due to user manual scroll */
  isAutoScrollDisabled: boolean;
  /** Re-enable auto-scroll after it was disabled */
  enableAutoScroll: () => void;
  /** Disable auto-scroll (e.g., when user manually scrolls) */
  disableAutoScroll: () => void;
}

/**
 * Hook for smooth scroll animation with manual scroll detection
 *
 * Features:
 * - requestAnimationFrame-based smooth scrolling at 60fps
 * - Cubic ease-out easing for natural deceleration
 * - Detects user manual scroll and temporarily disables auto-scroll
 * - Cancelable animations with proper cleanup
 *
 * @example
 * ```tsx
 * const containerRef = useRef<HTMLDivElement>(null);
 * const { scrollTo, isAutoScrollDisabled, enableAutoScroll } = useSmoothScroll({
 *   containerRef,
 *   duration: 200,
 * });
 *
 * // In effect when position changes:
 * if (!isAutoScrollDisabled) {
 *   scrollTo(targetX);
 * }
 * ```
 */
export function useSmoothScroll({
  containerRef,
  duration = 200,
  easing = easeOutCubic,
  onManualScroll,
}: UseSmoothScrollOptions): UseSmoothScrollReturn {
  // Animation state refs (using refs to avoid re-renders during animation)
  const animationIdRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const startXRef = useRef<number>(0);
  const targetXRef = useRef<number>(0);

  // State for external consumers
  const [isScrolling, setIsScrolling] = useState(false);
  const [isAutoScrollDisabled, setIsAutoScrollDisabled] = useState(false);

  // Track if we initiated the scroll (to distinguish from manual scroll)
  const isProgrammaticScrollRef = useRef(false);

  // Track recent programmatic scroll to handle timing edge cases
  // IMPORTANT: Must be declared here (before animate callback) to be in scope
  const recentProgrammaticScrollRef = useRef(false);
  const recentProgrammaticTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  /**
   * Cancel any ongoing scroll animation
   */
  const cancelScroll = useCallback(() => {
    if (animationIdRef.current !== null) {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = null;
    }
    isProgrammaticScrollRef.current = false;
    // Keep recent flag for a bit longer when canceling mid-animation
    // This prevents false "manual scroll" detection from lingering scroll events
    recentProgrammaticScrollRef.current = true;
    if (recentProgrammaticTimeoutRef.current) {
      clearTimeout(recentProgrammaticTimeoutRef.current);
    }
    recentProgrammaticTimeoutRef.current = setTimeout(() => {
      recentProgrammaticScrollRef.current = false;
    }, 150); // 150ms buffer for lingering scroll events
    setIsScrolling(false);
  }, []);

  /**
   * Animation frame callback
   */
  const animate = useCallback(
    (timestamp: number) => {
      const container = containerRef.current;
      if (!container) {
        cancelScroll();
        return;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easing(progress);

      const currentX =
        startXRef.current +
        (targetXRef.current - startXRef.current) * easedProgress;

      // Mark as programmatic scroll before setting scrollLeft
      isProgrammaticScrollRef.current = true;
      container.scrollLeft = currentX;

      if (progress < 1) {
        animationIdRef.current = requestAnimationFrame(animate);
      } else {
        // Animation complete
        isProgrammaticScrollRef.current = false;
        // Keep "recent programmatic" flag set for 100ms to prevent false manual scroll detection
        recentProgrammaticScrollRef.current = true;
        if (recentProgrammaticTimeoutRef.current) {
          clearTimeout(recentProgrammaticTimeoutRef.current);
        }
        recentProgrammaticTimeoutRef.current = setTimeout(() => {
          recentProgrammaticScrollRef.current = false;
        }, 100);
        setIsScrolling(false);
        animationIdRef.current = null;
      }
    },
    [containerRef, duration, easing, cancelScroll],
  );

  /**
   * Start smooth scroll animation to target X position
   */
  const scrollTo = useCallback(
    (targetX: number) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      // Don't scroll if auto-scroll is disabled
      if (isAutoScrollDisabled) {
        return;
      }

      // Cancel any existing animation
      cancelScroll();

      // If we're already at the target (within 1px), skip animation
      if (Math.abs(container.scrollLeft - targetX) < 1) {
        return;
      }

      // Initialize animation state
      startTimeRef.current = performance.now();
      startXRef.current = container.scrollLeft;
      targetXRef.current = targetX;
      isProgrammaticScrollRef.current = true;
      setIsScrolling(true);

      // Start animation loop
      animationIdRef.current = requestAnimationFrame(animate);
    },
    [containerRef, animate, cancelScroll, isAutoScrollDisabled],
  );

  /**
   * Re-enable auto-scroll after it was disabled by manual scroll
   */
  const enableAutoScroll = useCallback(() => {
    setIsAutoScrollDisabled(false);
  }, []);

  /**
   * Disable auto-scroll (called when user manually scrolls)
   */
  const disableAutoScroll = useCallback(() => {
    setIsAutoScrollDisabled(true);
    cancelScroll();
    onManualScroll?.();
  }, [cancelScroll, onManualScroll]);

  /**
   * Handle scroll events to detect manual scrolling
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleScroll = () => {
      // If this scroll was initiated by us (or recently completed), ignore it
      if (
        isProgrammaticScrollRef.current ||
        recentProgrammaticScrollRef.current
      ) {
        return;
      }

      // Debounce to avoid multiple triggers from single scroll gesture
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      scrollTimeout = setTimeout(() => {
        // Only disable if we're not currently animating
        // (user scrolled while we weren't scrolling = manual scroll)
        if (!isScrolling) {
          disableAutoScroll();
        }
      }, 50);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [containerRef, isScrolling, isAutoScrollDisabled, disableAutoScroll]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      cancelScroll();
    };
  }, [cancelScroll]);

  return {
    scrollTo,
    cancelScroll,
    isScrolling,
    isAutoScrollDisabled,
    enableAutoScroll,
    disableAutoScroll,
  };
}
