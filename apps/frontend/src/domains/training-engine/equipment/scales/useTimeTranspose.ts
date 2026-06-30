'use client';

/**
 * useTimeTranspose — the FREESTYLE (time-free) counterpart to the groove-card useDynamicLoop.
 *
 * In Freestyle there is no grid/loop to count, so key changes are driven by a WALL-CLOCK TIMER
 * instead of loop boundaries: every `config.everyN` SECONDS (the dial's "Every N" reinterpreted
 * as seconds), advance the key to the next step of the same ping-pong / travel schedule the
 * Dynamic Loop dial defines. The drone's own crossfade (long, ~3–5s, in Freestyle) makes the
 * transition a slow drift.
 *
 * It reuses the dial's config + nextCycleKey so the freestyle behaviour matches the dial the
 * user already knows; it adds only the timer. Pure-ish (one interval); the parent owns the key.
 */

import React from 'react';
import {
  nextCycleKey,
  type DynamicLoopConfig,
} from '@/domains/widgets/components/YouTubeWidgetPage/blocks/groove-card/useDynamicLoop';

export interface UseTimeTransposeArgs {
  /** Active only when freestyle is playing AND the dial is engaged. False ⇒ fully inert. */
  active: boolean;
  /** The dialed cycle config — `everyN` is read as SECONDS here. */
  config: DynamicLoopConfig;
  /** The HOME key (absolute semitones) the cycle holds + returns to — captured at activation. */
  homeSemitones: number;
  /** The transpose range edge (±this); the schedule wraps/clamps into it. */
  maxSemitones: number;
  /** Step the key to an ABSOLUTE offset. Stable identity (a React setter). */
  setKey: (semitonesFromOriginal: number) => void;
}

export function useTimeTranspose({
  active,
  config,
  homeSemitones,
  maxSemitones,
  setKey,
}: UseTimeTransposeArgs): void {
  // Live values in refs so the single interval reads fresh state without re-subscribing.
  const configRef = React.useRef(config);
  configRef.current = config;
  const maxRef = React.useRef(maxSemitones);
  maxRef.current = maxSemitones;
  const setKeyRef = React.useRef(setKey);
  setKeyRef.current = setKey;
  // The user's current key, mirrored every render — read ONCE at activation as "home". It is
  // NOT an effect dep: if it were, every setKey() the timer fires would re-run the effect and
  // restart the timer (so it'd never advance — the "stays on the same key" bug).
  const liveHomeRef = React.useRef(homeSemitones);
  liveHomeRef.current = homeSemitones;
  // The HOME the cycle holds/returns to + the CURRENT scheduled key, captured at activation.
  const homeRef = React.useRef(homeSemitones);
  const currentRef = React.useRef(homeSemitones);

  React.useEffect(() => {
    if (!active) return;
    // Capture home from the LIVE key at the moment we activate (the key the user dialed).
    homeRef.current = liveHomeRef.current;
    currentRef.current = liveHomeRef.current;

    // `cancelled` is the authoritative stop signal: even if a queued timeout fires after
    // cleanup (a fake-timer race), tick() bails. The timer handle is tracked too so cleanup
    // clears the pending one.
    let cancelled = false;
    let timer: number | null = null;
    const schedule = () => {
      if (cancelled) return;
      // everyN seconds; floor to a sane minimum so a tiny/zero value can't spin.
      const sec = Math.max(5, Math.round(configRef.current.everyN));
      timer = window.setTimeout(tick, sec * 1000);
    };
    function tick() {
      if (cancelled) return;
      const next = nextCycleKey(
        configRef.current,
        currentRef.current,
        homeRef.current,
        maxRef.current,
      );
      if (next !== currentRef.current) {
        currentRef.current = next;
        setKeyRef.current(next); // → droneSymbol changes → long crossfade (freestyle)
      }
      schedule(); // re-arm with the (possibly changed) live cadence
    }
    schedule();

    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
    // ONLY `active` — re-running on every key change (homeSemitones) would restart the timer
    // each fire and it'd never advance. Home is re-captured from liveHomeRef on each activation.
  }, [active]);
}
