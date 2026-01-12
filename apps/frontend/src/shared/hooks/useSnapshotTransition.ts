/**
 * useSnapshotTransition - Double-buffered transition hook for smooth visual transitions
 *
 * This hook implements the "snapshot" or "double buffer" pattern:
 * - displayData = What we RENDER (front buffer) - FROZEN during transition
 * - pendingData = What's WAITING (back buffer) - stores new data during fade-out
 *
 * CRITICAL: displayData is ONLY updated:
 * 1. On initialization
 * 2. When phase is 'stable' and same key (live updates)
 * 3. At the EXACT moment of SWAP (after fade-out, before fade-in)
 *
 * @module useSnapshotTransition
 */

import { useState, useRef, useEffect, useCallback } from 'react';

export interface SnapshotTransitionOptions {
  fadeDuration?: number;
  debug?: boolean;
}

export interface SnapshotTransitionResult<T> {
  displayData: T;
  opacity: number;
  isTransitioning: boolean;
  fadeDuration: number;
  phase: 'stable' | 'fading-out' | 'fading-in';
}

export function useSnapshotTransition<T>(
  sourceData: T,
  dataKey: string | undefined,
  options: SnapshotTransitionOptions = {}
): SnapshotTransitionResult<T> {
  const { fadeDuration = 500, debug = false } = options;

  // =========================================================================
  // STATE & REFS
  // =========================================================================
  // displayData = what we RENDER (FROZEN during transition)
  // Using lazy initializer to capture first sourceData
  const [displayData, setDisplayData] = useState<T>(() => sourceData);
  const [opacity, setOpacity] = useState(1);
  const [phase, setPhase] = useState<'stable' | 'fading-out' | 'fading-in'>('stable');

  // Refs for tracking - these don't cause re-renders
  const previousKeyRef = useRef<string | undefined>(dataKey);
  const pendingDataRef = useRef<T | null>(null);
  const targetKeyRef = useRef<string | undefined>(undefined); // The key we're transitioning TO
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRenderRef = useRef(true);

  // CRITICAL: Track which key the current displayData belongs to
  // This prevents updates from wrong exercise bleeding through
  const displayKeyRef = useRef<string | undefined>(dataKey);

  const log = useCallback(
    (msg: string, data?: Record<string, unknown>) => {
      if (debug) console.log(`[Snapshot] ${msg}`, data ?? '');
    },
    [debug]
  );

  // =========================================================================
  // SYNCHRONOUS KEY CHANGE DETECTION (happens BEFORE effect)
  // This is critical - we detect the change and set phase BEFORE React
  // re-renders with new data, so displayData stays frozen
  // =========================================================================
  const keyChanged = previousKeyRef.current !== dataKey;
  const isStable = phase === 'stable';

  // If key changed and we're stable, start transition SYNCHRONOUSLY
  // This ensures displayData doesn't update until SWAP
  if (keyChanged && isStable && !isFirstRenderRef.current) {
    log('Key changed (sync)', { from: previousKeyRef.current, to: dataKey });
    previousKeyRef.current = dataKey;
    targetKeyRef.current = dataKey;
    pendingDataRef.current = sourceData;
    // Note: We DON'T update displayData here - it stays frozen!
  }

  // =========================================================================
  // EFFECT: Handle transitions and same-key updates
  // =========================================================================
  useEffect(() => {
    // First render - just mark as initialized
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      log('Init', { dataKey });
      return;
    }

    // =========================================================================
    // SAME KEY - Only update displayData if stable and matching key
    // =========================================================================
    if (displayKeyRef.current === dataKey && phase === 'stable') {
      // Live update - same exercise, new data (e.g., notes loaded)
      setDisplayData(sourceData);
      return;
    }

    // =========================================================================
    // DURING TRANSITION - Update pending data if it's for the target key
    // This ensures SWAP uses the latest data even if it changes during fade-out
    // =========================================================================
    if (phase !== 'stable' && targetKeyRef.current === dataKey) {
      pendingDataRef.current = sourceData;
      log('Updated pending during transition', { dataKey });
    }

    // =========================================================================
    // KEY CHANGED - We detected this above, now handle the transition
    // =========================================================================
    if (targetKeyRef.current === dataKey && phase === 'stable') {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Update pending with latest data (in case it changed)
      pendingDataRef.current = sourceData;

      // PHASE 1: FADE OUT - displayData stays FROZEN with OLD content
      setPhase('fading-out');
      log('Phase: fading-out (displayData FROZEN)');

      // Double RAF ensures CSS transition starts properly (browser needs to
      // "see" the element at opacity 1 before we transition to 0).
      // We measure the actual RAF delay dynamically to handle different refresh rates
      // (60Hz ≈ 32ms, 120Hz ≈ 16ms, 144Hz ≈ 14ms) and browser load variations.
      const rafStartTime = performance.now();

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const actualRafDelay = performance.now() - rafStartTime;
          setOpacity(0);
          log('Opacity → 0', { actualRafDelay: Math.round(actualRafDelay) });

          // PHASE 2: SWAP + FADE IN (after fade-out CSS transition completes)
          // Schedule SWAP for exactly when CSS transition ends (fadeDuration after opacity change)
          timeoutRef.current = setTimeout(() => {
            // SWAP: Update displayData with pending data
            if (pendingDataRef.current !== null) {
              log('SWAP', {
                oldKey: displayKeyRef.current,
                newKey: targetKeyRef.current,
              });
              setDisplayData(pendingDataRef.current);
              displayKeyRef.current = targetKeyRef.current;
              pendingDataRef.current = null;
            }

            // Start fade in
            setPhase('fading-in');
            log('Phase: fading-in');

            const fadeInRafStart = performance.now();
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                const fadeInRafDelay = performance.now() - fadeInRafStart;
                setOpacity(1);
                log('Opacity → 1', { fadeInRafDelay: Math.round(fadeInRafDelay) });

                // Return to stable after fade-in CSS transition completes
                timeoutRef.current = setTimeout(() => {
                  setPhase('stable');
                  targetKeyRef.current = undefined;
                  log('Phase: stable');
                  timeoutRef.current = null;
                }, fadeDuration);
              });
            });
          }, fadeDuration);
        });
      });
    }

    // If already transitioning and key changed again, just update pending
    if (phase !== 'stable' && targetKeyRef.current !== dataKey) {
      log('Mid-transition key change', {
        current: targetKeyRef.current,
        new: dataKey
      });
      targetKeyRef.current = dataKey;
      previousKeyRef.current = dataKey;
      pendingDataRef.current = sourceData;
    }

  }, [dataKey, sourceData, fadeDuration, phase, log]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return {
    displayData,
    opacity,
    isTransitioning: phase !== 'stable',
    fadeDuration,
    phase,
  };
}
