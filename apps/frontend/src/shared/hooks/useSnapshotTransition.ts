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
 * FAANG Pattern: Ref-based synchronous guards ensure displayData NEVER leaks
 * new data during transitions, even with React's async state batching.
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
  options: SnapshotTransitionOptions = {},
): SnapshotTransitionResult<T> {
  const { fadeDuration = 500, debug = false } = options;

  // =========================================================================
  // STATE & REFS
  // =========================================================================
  // displayData = what we RENDER (FROZEN during transition)
  // Using lazy initializer to capture first sourceData
  const [displayData, setDisplayData] = useState<T>(() => sourceData);
  const [opacity, setOpacity] = useState(1);
  const [phase, setPhase] = useState<'stable' | 'fading-out' | 'fading-in'>(
    'stable',
  );

  // Refs for tracking - these don't cause re-renders
  const previousKeyRef = useRef<string | undefined>(dataKey);
  const pendingDataRef = useRef<T | null>(null);
  const targetKeyRef = useRef<string | undefined>(undefined); // The key we're transitioning TO
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRenderRef = useRef(true);

  // CRITICAL: Track which key the current displayData belongs to
  // This prevents updates from wrong exercise bleeding through
  const displayKeyRef = useRef<string | undefined>(dataKey);

  // =========================================================================
  // FAANG FIX: Ref-based phase tracking for SYNCHRONOUS guards
  // =========================================================================
  // Problem: React state updates (setPhase) are async/batched, so checking
  // `phase === 'stable'` in render can be stale. By the time the effect runs,
  // the phase state might not reflect the transition we just started.
  //
  // Solution: Use a ref that updates SYNCHRONOUSLY during render. This ensures
  // that subsequent code in the SAME render cycle sees the correct phase.
  // The state is still used for React re-renders, but the ref is the source
  // of truth for synchronous guards.
  // =========================================================================
  const phaseRef = useRef<'stable' | 'fading-out' | 'fading-in'>('stable');

  // CRITICAL FIX: Only sync phaseRef FROM state when:
  // 1. State is transitioning (fading-out/fading-in) - always sync these
  // 2. State is stable AND ref is also stable - sync to keep them aligned
  //
  // We should NEVER overwrite a transitioning phaseRef (fading-out/fading-in)
  // with 'stable' from state. This happens during React StrictMode double-renders
  // where the synchronous code sets phaseRef to 'fading-out' but then a re-render
  // runs this line again before the effect, resetting it back to 'stable'.
  if (phase !== 'stable') {
    // State is transitioning - always sync
    phaseRef.current = phase;
  }
  // If phase is 'stable' but phaseRef is NOT stable, don't overwrite!
  // The synchronous key change detection may have just set it to 'fading-out'

  const log = useCallback(
    (msg: string, data?: Record<string, unknown>) => {
      if (debug) console.log(`[Snapshot] ${msg}`, data ?? '');
    },
    [debug],
  );

  // =========================================================================
  // SYNCHRONOUS KEY CHANGE DETECTION (happens BEFORE effect)
  // This is critical - we detect the change and set phase BEFORE React
  // re-renders with new data, so displayData stays frozen
  // =========================================================================
  const keyChanged = previousKeyRef.current !== dataKey;
  const isStable = phaseRef.current === 'stable'; // Use ref for synchronous check

  // If key changed and we're stable, start transition SYNCHRONOUSLY
  // This ensures displayData doesn't update until SWAP
  if (keyChanged && isStable && !isFirstRenderRef.current) {
    log('Key changed (sync)', { from: previousKeyRef.current, to: dataKey });
    previousKeyRef.current = dataKey;
    targetKeyRef.current = dataKey;
    pendingDataRef.current = sourceData;
    // CRITICAL: Update phaseRef SYNCHRONOUSLY so same-render-cycle code sees it
    phaseRef.current = 'fading-out';
    // Note: We DON'T update displayData here - it stays frozen!
  }

  // =========================================================================
  // SYNCHRONOUS MID-TRANSITION REDIRECT
  // =========================================================================
  // If key changed but we're NOT stable (already transitioning), handle it here
  // rather than waiting for the effect. This ensures fast response to rapid switching.
  if (keyChanged && !isStable && !isFirstRenderRef.current) {
    log('Mid-transition redirect (sync)', {
      from: previousKeyRef.current,
      to: dataKey,
      phase: phaseRef.current,
    });

    // Always update target and pending data
    targetKeyRef.current = dataKey;
    pendingDataRef.current = sourceData;

    // If we're in fading-in, displayData was already swapped to wrong data.
    // We need to restart the transition. DON'T update previousKeyRef so the
    // next stable-phase render will detect the key change and start fresh.
    if (phaseRef.current === 'fading-in') {
      log('Restarting from fading-in (sync)', {
        previousKeyRef: previousKeyRef.current,
        newDataKey: dataKey,
      });
      // Cancel any pending timeouts will happen in effect
      phaseRef.current = 'stable';
      // Note: State update will happen in effect to avoid calling setPhase during render
    } else {
      // During fading-out, SWAP hasn't happened yet, so just redirect the target
      // The SWAP will use the updated pendingDataRef
      previousKeyRef.current = dataKey;
    }
  }

  // =========================================================================
  // EFFECT: Handle transitions and same-key updates
  // =========================================================================
  // FAANG Pattern: Use phaseRef for ALL guards to ensure synchronous consistency.
  // The phase state drives re-renders, but phaseRef is the source of truth.
  // =========================================================================
  useEffect(() => {
    // First render - just mark as initialized
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      log('Init', { dataKey });
      return;
    }

    // =========================================================================
    // FIRST KEY SET - Handle transition from undefined to first valid key
    // =========================================================================
    // When displayKeyRef is undefined but dataKey is set, this is the first exercise
    // selection. We need to update both displayData and displayKeyRef.
    if (
      displayKeyRef.current === undefined &&
      dataKey !== undefined &&
      phaseRef.current === 'stable'
    ) {
      log('First key set', { dataKey });
      setDisplayData(sourceData);
      displayKeyRef.current = dataKey;
      return;
    }

    // =========================================================================
    // SYNC STATE WITH REF - Handle synchronous restart from fading-in
    // =========================================================================
    // If phaseRef was reset to 'stable' during synchronous mid-transition handling
    // but state is still fading-in, sync them and clear timeouts
    if (phaseRef.current === 'stable' && phase === 'fading-in') {
      log('Syncing state after mid-transition restart', {
        previousKeyRef: previousKeyRef.current,
        dataKey,
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setPhase('stable');
      setOpacity(1);
      // Return here - the re-render from setPhase will trigger a new render
      // where the synchronous key change detection will start a fresh transition
      return;
    }

    // =========================================================================
    // SAME KEY - Only update displayData if stable and matching key
    // =========================================================================
    // CRITICAL: Use phaseRef.current for synchronous guard
    if (displayKeyRef.current === dataKey && phaseRef.current === 'stable') {
      // Live update - same exercise, new data (e.g., notes loaded)
      log('Live update', { dataKey });
      setDisplayData(sourceData);
      return;
    }

    // =========================================================================
    // DURING TRANSITION - Update pending data if it's for the target key
    // This ensures SWAP uses the latest data even if it changes during fade-out
    // =========================================================================
    if (phaseRef.current !== 'stable' && targetKeyRef.current === dataKey) {
      pendingDataRef.current = sourceData;
      log('Updated pending during transition', { dataKey });
    }

    // =========================================================================
    // KEY CHANGED - Start transition if phaseRef was set to fading-out synchronously
    // =========================================================================
    // CRITICAL: Only enter here if phaseRef was set to 'fading-out' during synchronous
    // key change detection AND state hasn't caught up yet
    if (
      targetKeyRef.current === dataKey &&
      phaseRef.current === 'fading-out' &&
      phase === 'stable'
    ) {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Update pending with latest data (in case it changed)
      pendingDataRef.current = sourceData;

      // Sync state with ref (trigger re-render with correct phase)
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

            // Start fade in - update both ref and state
            phaseRef.current = 'fading-in';
            setPhase('fading-in');
            log('Phase: fading-in');

            const fadeInRafStart = performance.now();
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                const fadeInRafDelay = performance.now() - fadeInRafStart;
                setOpacity(1);
                log('Opacity → 1', {
                  fadeInRafDelay: Math.round(fadeInRafDelay),
                });

                // Return to stable after fade-in CSS transition completes
                timeoutRef.current = setTimeout(() => {
                  phaseRef.current = 'stable';
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

    // =========================================================================
    // EFFECT-SIDE MID-TRANSITION HANDLING (backup to synchronous handling)
    // =========================================================================
    // This is a safety net - synchronous handling above should catch most cases.
    // This handles edge cases where the effect runs before the sync code.
    if (phaseRef.current !== 'stable' && targetKeyRef.current !== dataKey) {
      log('Mid-transition key change (effect)', {
        currentTarget: targetKeyRef.current,
        newTarget: dataKey,
        phase: phaseRef.current,
      });

      // Update target ref to new destination
      targetKeyRef.current = dataKey;
      pendingDataRef.current = sourceData;

      // If we're in fading-in phase, restart (synchronous code may have already done this)
      if (phaseRef.current === 'fading-in') {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        // DON'T update previousKeyRef - let sync code detect key change
        phaseRef.current = 'stable';
        setPhase('stable');
        setOpacity(1);
        log('Mid-transition restart from fading-in phase (effect)');
      } else if (phaseRef.current === 'fading-out') {
        // During fading-out, SWAP hasn't happened yet
        // Update previousKeyRef so we don't detect key change again
        previousKeyRef.current = dataKey;
      }
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
