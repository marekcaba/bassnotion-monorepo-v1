'use client';

/**
 * useReferenceDrop — the "Reference-Drop" pulse-steadiness drill (Lock The
 * Pocket). While the groove loops, the chosen reference stem(s) — any of drums /
 * harmony / bass (the band) and/or the metronome click — FADE OUT for
 * `dropForBars`, then FADE BACK IN, every `everyBars`. The return reveals
 * whether the player drifted while the reference was gone. Trains
 * Pulse·Steadiness + Timing·Awareness. Dropping the whole band = play to silence
 * (hold the pulse alone — the real test).
 *
 * UNIT — BARS, not loops. A groove loop is `lengthBars` bars long, so the
 * drill's cadence is driven off the BAR position (derived from the real playhead
 * phase × lengthBars), NOT the per-loop seam counter. (The earlier version
 * gated on useLoopCounter — once per LOOP — so "every 4 bars" was applied per
 * loop = every `lengthBars`×4 bars and could only toggle at 8-bar granularity.
 * Confirmed by logs; fixed here.)
 *
 * It adds NO new audio engine code, scheduler, or clock:
 *   • the deterministic BAR GRID — bar k's downbeat = loopStartAudioTime +
 *     k × barSeconds, where barSeconds = loopDurationSeconds ÷ lengthBars. The
 *     SAME grid the waveform draws its bar lines on; pure tempo math, not the
 *     bass read-head. loopStart + loopDuration both re-anchor on a tempo change,
 *     so the grid follows the tempo control automatically.
 *   • per-stem GainNode ramps — getOrCreateInstrumentGainNode(stem) +
 *     gain.setTargetAtTime(target, when, τ). Scheduled at the bar downbeat so the
 *     fade lands on the beat.
 *
 * EVERYTHING is admin-authored via `referenceDrop` config — nothing hardcoded.
 * Inert unless `config.enabled`. Does NOT touch engine mute bookkeeping or the
 * user's mute/solo — ramps the gain node directly and restores resting volume.
 * Restores any dropped stem on stop.
 */

import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { ReferenceDropConfig } from '@bassnotion/contracts';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry';

const DEFAULT_FADE_MS = 80;

/** Engine instrument type per droppable target. */
const STEM_FOR_TARGET: Record<'drums' | 'harmony' | 'bass' | 'click', string> = {
  drums: 'audio-drums',
  harmony: 'audio-harmony',
  bass: 'audio-bass',
  click: 'audio-click',
};

export interface UseReferenceDropArgs {
  /** Admin-authored config. Absent / disabled → fully inert. */
  config?: ReferenceDropConfig | null;
  /** Whether the groove is playing. */
  isPlaying: boolean;
  /** Loop length in bars (the groove's region). One loop = `lengthBars` bars. */
  lengthBars: number;
  /** Current audio-context time. Stable identity expected. */
  getCurrentTime: () => number | null;
  /** Loop duration in seconds — barSeconds = loopDurationSeconds ÷ lengthBars.
   *  RE-COMPUTES from currentBpm, so the grid follows the tempo control. */
  loopDurationSeconds: number;
  /** Audio-context time of the current loop iteration's bar-0 — the GRID ANCHOR.
   *  Bar k's downbeat = loopStartAudioTime + k × barSeconds. RE-ANCHORS on a
   *  tempo change (setTempo re-sets it to the new period), so the grid tracks
   *  the tempo control automatically. null until anchored (count-in). */
  loopStartAudioTime: number | null;
}

export interface UseReferenceDropState {
  isActive: boolean;
  isDropped: boolean;
  /** Bars until the next drop/return transition (UI cue). null when inactive. */
  barsUntilChange: number | null;
}

/** Is the reference dropped on bar `barWithinLoop` (0-based bar position WITHIN
 *  the loop)? The mask is `dropBars` (1-based bar numbers), so the pattern is
 *  bound to the loop and repeats identically every loop — it cannot desync.
 *  Exported for unit tests. */
export function isDroppedForBar(
  barWithinLoop: number,
  cfg: ReferenceDropConfig,
): boolean {
  const dropBars = cfg.dropBars ?? [];
  // dropBars are 1-based; barWithinLoop is 0-based.
  return dropBars.includes(barWithinLoop + 1);
}

export function useReferenceDrop({
  config,
  isPlaying,
  lengthBars,
  getCurrentTime,
  loopDurationSeconds,
  loopStartAudioTime,
}: UseReferenceDropArgs): UseReferenceDropState {
  const enabled = !!config?.enabled && (config?.dropTargets?.length ?? 0) > 0;
  const isActive = enabled && isPlaying;

  // Live values in refs so the RAF loop reads current data without restarting.
  const configRef = useRef(config);
  configRef.current = config;
  const lengthBarsRef = useRef(lengthBars);
  lengthBarsRef.current = Math.max(1, Math.round(lengthBars));
  const loopDurRef = useRef(loopDurationSeconds);
  loopDurRef.current = loopDurationSeconds;
  const loopStartRef = useRef(loopStartAudioTime);
  loopStartRef.current = loopStartAudioTime;
  const getCurrentTimeRef = useRef(getCurrentTime);
  getCurrentTimeRef.current = getCurrentTime;

  // Per-stem resting volume (snapshot on first drop → exact restore).
  const restingVolumeRef = useRef<Map<string, number>>(new Map());
  // Currently-dropped stems (so we ramp only on a real transition).
  const droppedRef = useRef<Set<string>>(new Set());
  // The drop-state currently applied (so we transition once per change).
  const appliedDroppedRef = useRef<boolean>(false);
  // The bar-within-loop we last ACTED on. We schedule when this changes (a new
  // bar entered), so it fires once per bar EVERY loop (-1 = not yet seen).
  const lastActedBarRef = useRef<number>(-1);

  const [, forceTick] = useReducer((n: number) => n + 1, 0);
  const isDroppedRef = useRef(false);
  const barsUntilChangeRef = useRef<number | null>(null);

  const rampStem = useCallback(
    (stem: string, target: number, whenSeconds: number, fadeMs: number) => {
      const engine = WindowRegistry.getPlaybackEngine();
      const node = engine?.getOrCreateInstrumentGainNode?.(stem as never);
      if (!node) return;
      const tau = Math.max(0.001, fadeMs / 1000 / 3);
      try {
        node.gain.setTargetAtTime(target, whenSeconds, tau);
      } catch {
        /* a stale time is non-fatal; the next bar re-evaluates */
      }
    },
    [],
  );

  const snapshotResting = useCallback((stem: string) => {
    if (restingVolumeRef.current.has(stem)) return;
    const node = WindowRegistry.getPlaybackEngine()?.getOrCreateInstrumentGainNode?.(
      stem as never,
    );
    const stamped = (node as (GainNode & { __restingVolume?: number }) | null)
      ?.__restingVolume;
    const live = node?.gain.value;
    restingVolumeRef.current.set(
      stem,
      typeof stamped === 'number' ? stamped : (live ?? 0.8),
    );
  }, []);

  const restoreAll = useCallback(
    (whenSeconds: number, fadeMs: number) => {
      for (const stem of droppedRef.current) {
        rampStem(stem, restingVolumeRef.current.get(stem) ?? 0.8, whenSeconds, fadeMs);
      }
      droppedRef.current.clear();
      isDroppedRef.current = false;
      appliedDroppedRef.current = false;
    },
    [rampStem],
  );

  /** Apply (or lift) the drop for `targets`, scheduled at `when`. */
  const applyDrop = useCallback(
    (drop: boolean, targets: string[], when: number, fadeMs: number) => {
      if (drop) {
        for (const stem of targets) {
          snapshotResting(stem);
          rampStem(stem, 0, when, fadeMs);
          droppedRef.current.add(stem);
        }
      } else {
        for (const stem of targets) {
          rampStem(stem, restingVolumeRef.current.get(stem) ?? 0.8, when, fadeMs);
          droppedRef.current.delete(stem);
        }
      }
      isDroppedRef.current = drop;
      appliedDroppedRef.current = drop;
    },
    [rampStem, snapshotResting],
  );

  // ── The bar-driven drill loop (RAF) ──────────────────────────────────────
  useEffect(() => {
    if (!isActive) {
      // Reset so the next play starts a clean cycle.
      appliedDroppedRef.current = false;
      lastActedBarRef.current = -1;
      barsUntilChangeRef.current = null;
      return;
    }

    let rafId = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const cfg = configRef.current;
      const loopStart = loopStartRef.current;
      const now = getCurrentTimeRef.current();
      const bars = lengthBarsRef.current;
      const barSeconds = loopDurRef.current / bars;

      // FULLY GRID-MATH DRIVEN. The whole drill runs off ONE deterministic clock:
      // the bar grid laid down from TEMPO + lengthBars, anchored at
      // loopStartAudioTime — the SAME grid the waveform draws its bar lines on
      // (bar k starts at loopStart + k × barSeconds). NOT the bass read-head /
      // visual phase (which jittered + carried the ~185ms visual-latency shift,
      // so the fade landed off the beat). Because BOTH loopStart and barSeconds
      // RE-ANCHOR when the user changes tempo mid-play (setTempo re-sets
      // loopStartAudioTime to the new period; loopDurationSeconds recomputes from
      // currentBpm), the grid follows the tempo control automatically — detection
      // and scheduling share the one clock, so they can't diverge.
      if (cfg && loopStart != null && now != null && barSeconds > 0) {
        // Absolute bar index since the anchor, and its position within the loop.
        const absBar = Math.floor((now - loopStart) / barSeconds);
        const barWithinLoop = ((absBar % bars) + bars) % bars;
        const upcomingPos = (barWithinLoop + 1) % bars;
        const shouldDropUpcoming = isDroppedForBar(upcomingPos, cfg);

        // ACT ONCE PER BAR: when absBar advances (we entered a new bar), decide
        // the UPCOMING bar and, if its drop-state changes, schedule the ramp at
        // the upcoming bar's EXACT downbeat = loopStart + (absBar+1) × barSeconds.
        // Keying on absBar (not loop position) fires once per bar EVERY loop and
        // survives a tempo re-anchor cleanly (absBar recomputes off the new grid).
        if (absBar !== lastActedBarRef.current) {
          lastActedBarRef.current = absBar;
          if (shouldDropUpcoming !== appliedDroppedRef.current) {
            const fadeMs = cfg.fadeMs ?? DEFAULT_FADE_MS;
            const targets = cfg.dropTargets.map((t) => STEM_FOR_TARGET[t]);
            const downbeat = loopStart + (absBar + 1) * barSeconds;
            // RESTORE: finish the fade-in just BEFORE the downbeat so the first
            // kick transient is full ON beat 1 (a ramp starting at the downbeat
            // climbs through the transient → clipped attack). DROP: at the beat.
            const when = shouldDropUpcoming
              ? downbeat
              : Math.max(now, downbeat - fadeMs / 1000);
            applyDrop(shouldDropUpcoming, targets, when, fadeMs);
            forceTick();
          }
        }

        // Status cue: bars until the next transition (scan the loop mask forward
        // from the current bar position, wrapping).
        const here = isDroppedForBar(barWithinLoop, cfg);
        let ahead = 1;
        for (; ahead <= bars; ahead++) {
          if (isDroppedForBar((barWithinLoop + ahead) % bars, cfg) !== here) break;
        }
        if (barsUntilChangeRef.current !== ahead) {
          barsUntilChangeRef.current = ahead;
          forceTick();
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [isActive, applyDrop]);

  // On stop / disable, restore anything dropped so nothing is left silent.
  const wasActiveRef = useRef(false);
  useEffect(() => {
    if (wasActiveRef.current && !isActive) {
      const now = getCurrentTimeRef.current() ?? 0;
      restoreAll(now + 0.001, configRef.current?.fadeMs ?? DEFAULT_FADE_MS);
      forceTick();
    }
    wasActiveRef.current = isActive;
  }, [isActive, restoreAll]);

  return {
    isActive,
    isDropped: isActive ? isDroppedRef.current : false,
    barsUntilChange: isActive ? barsUntilChangeRef.current : null,
  };
}
