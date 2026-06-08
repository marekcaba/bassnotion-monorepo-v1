'use client';

/**
 * useLoopCounter — fires a callback once per audio loop boundary while playing.
 *
 * WHY THIS EXISTS (and why it does NOT watch getAudioPhase wrap):
 * The obvious approach — watch the playhead phase wrap from ~1 → ~0 — is
 * unreliable here. `getStemPlayheadPhase()` is engineered to be a SMOOTH,
 * visually-latency-shifted clock: it reports ~1.0 AT the loop origin (negative
 * latency comp wraps it), slews non-monotonically toward its target, and goes
 * stale/garbage during count-in and right after a tempo nudge. A naive wrap
 * detector double-counts at the origin and false-fires on tempo changes.
 *
 * Instead we count off the AUTHORITATIVE seam clock the engine already uses to
 * quantise key changes: `getStemNextSeamTime()` returns the wall-clock
 * audio-context time of the NEXT loop seam, read off the bass stem's real
 * read-head and scaled by the live stretch rate (so it's correct across tempo
 * changes by construction; see PlaybackEngine.getStemNextSeamTime).
 *
 * DETECTION: the "next seam" time decreases as we approach it (it's a fixed
 * future instant, currentTime climbs toward it) and then JUMPS FORWARD by ~one
 * loop the moment the read-head wraps past it. We track the last seam we saw;
 * when a fresh reading is meaningfully LATER than the tracked one, the loop
 * wrapped → fire onLoopBoundary and re-baseline to the new seam.
 *
 * This is monotonic in wall-clock time, immune to the visual-latency origin
 * artifact, survives count-in (seam is null until the worklet streams, so no
 * false fire), and follows tempo changes (the seam shifts continuously, never a
 * spurious full-loop jump).
 *
 * The readers are INJECTED rather than reached for via WindowRegistry so the
 * hook is trivially testable in isolation (no engine mock needed) and matches
 * how the rest of the groove-card hooks take their engine surface as props.
 */

import { useEffect, useRef } from 'react';

export interface UseLoopCounterArgs {
  /** Only count while the groove is actually playing. When false the poll
   *  loop is parked and internal state is reset, so the next play() starts a
   *  fresh count. */
  isPlaying: boolean;
  /** Master switch — when false the hook does nothing (no RAF, no callbacks).
   *  The Dynamic Loop feature flips this with its Engage toggle so we don't
   *  spin a RAF for every groove card on a page. */
  enabled: boolean;
  /** Reads the wall-clock audio-context time of the next loop seam, or null
   *  when not streaming yet (count-in / read-head unknown). Typically wired to
   *  `WindowRegistry.getPlaybackEngine()?.getStemNextSeamTime?.()`. Stable
   *  identity expected (useCallback). */
  getNextSeamTime: () => number | null;
  /** Reads the current audio-context time. Wired to `audioContext.currentTime`
   *  via a stable getter. Used only to disambiguate a forward seam jump from
   *  ordinary jitter. */
  getCurrentTime: () => number | null;
  /** Fired exactly once per detected loop boundary (the instant the read-head
   *  wraps). Receives the running loop index (1 for the first completed loop
   *  since counting began, 2 for the next, …). MUST be a stable identity — the
   *  hook reads it through a ref so a changing callback doesn't restart the
   *  poll loop. */
  onLoopBoundary: (loopIndex: number) => void;
}

// A fresh seam must be at least this many seconds LATER than the tracked seam
// to count as a wrap (rather than read-head jitter or a tempo-driven continuous
// shift). Loops are seconds long; a real wrap jumps the seam forward by ~the
// loop duration. 0.25s is comfortably below the shortest practical loop (a 1-bar
// loop at 180 BPM is ~1.3s) yet well above per-frame jitter.
const WRAP_FORWARD_JUMP_SEC = 0.25;

export function useLoopCounter({
  isPlaying,
  enabled,
  getNextSeamTime,
  getCurrentTime,
  onLoopBoundary,
}: UseLoopCounterArgs): void {
  // Latest readers/callback held in refs so the RAF effect depends only on the
  // two booleans — the loop body always sees the current functions without
  // tearing down and rebuilding the RAF every render.
  const getNextSeamTimeRef = useRef(getNextSeamTime);
  const getCurrentTimeRef = useRef(getCurrentTime);
  const onLoopBoundaryRef = useRef(onLoopBoundary);
  getNextSeamTimeRef.current = getNextSeamTime;
  getCurrentTimeRef.current = getCurrentTime;
  onLoopBoundaryRef.current = onLoopBoundary;

  // The last seam time we observed (null = not baselined yet). Survives across
  // RAF frames but is reset whenever counting (re)starts.
  const trackedSeamRef = useRef<number | null>(null);
  // Monotonic loop index since counting began.
  const loopIndexRef = useRef(0);

  useEffect(() => {
    if (!enabled || !isPlaying) {
      // Parked: reset so a later (re)start counts from a clean baseline. We do
      // NOT carry the tracked seam across a stop — the read-head is gone.
      trackedSeamRef.current = null;
      loopIndexRef.current = 0;
      return;
    }

    let rafId = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;

      const seam = getNextSeamTimeRef.current();
      const now = getCurrentTimeRef.current();

      // Seam unavailable (count-in not finished, read-head unknown): hold the
      // baseline at null and keep polling. No count, no false fire.
      if (seam == null) {
        trackedSeamRef.current = null;
        rafId = requestAnimationFrame(tick);
        return;
      }

      const tracked = trackedSeamRef.current;
      if (tracked == null) {
        // First valid reading since (re)start — baseline only, don't count.
        trackedSeamRef.current = seam;
      } else if (seam > tracked + WRAP_FORWARD_JUMP_SEC) {
        // The next-seam target jumped forward by ~a loop → the read-head
        // wrapped → a loop boundary just occurred. Re-baseline to the new
        // seam and fire. (A single tick can only cross one boundary in
        // practice — even a 1-bar loop at 180 BPM is ~1.3s, far longer than a
        // frame — so we increment by one.)
        trackedSeamRef.current = seam;
        loopIndexRef.current += 1;
        onLoopBoundaryRef.current(loopIndexRef.current);
      } else if (now != null && seam < now - WRAP_FORWARD_JUMP_SEC) {
        // Defensive: the seam fell well behind the clock without us seeing the
        // forward jump (e.g. a long RAF gap from a backgrounded tab). Treat it
        // as a missed boundary and re-baseline without inventing a count we
        // can't trust — the next clean wrap resumes counting.
        trackedSeamRef.current = seam;
      }
      // else: seam is drifting toward us (ordinary) or shifted continuously by
      // a tempo nudge — keep the tracked baseline, no boundary.

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [enabled, isPlaying]);
}
