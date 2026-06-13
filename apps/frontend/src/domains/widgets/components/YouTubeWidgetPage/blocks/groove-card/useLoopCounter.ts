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
 * COUNT-IN: the bass stem streams DURING the 1-2-3-4 count-in, so its read-head
 * wraps once at the count-in→loop-1 boundary. That wrap is NOT a completed home
 * loop. We hold the baseline at null while `isCountingDown` is true, so that
 * first wrap is suppressed and the FIRST counted wrap is the genuine end of
 * loop 1. (An earlier gap-shrink "arm gate" was removed: it pinned its running
 * minimum at ~0 once the read-head reached the first seam and then never
 * re-armed after the wrap — the isCountingDown flag handles the count-in
 * directly and correctly.)
 *
 * This is monotonic in wall-clock time, immune to the visual-latency origin
 * artifact, and follows tempo changes (the seam shifts continuously, never a
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
  /** True while the 1-2-3-4 count-in bar is playing. The bass stem already
   *  streams during the count-in, so its read-head wraps once AT THE COUNT-IN→
   *  LOOP-1 boundary — that wrap is NOT a completed home loop and must not be
   *  counted. We refuse to arm until this is false, so that count-in wrap is
   *  observed while unarmed (suppressed) and the first COUNTED wrap is the
   *  genuine end of loop 1. */
  isCountingDown: boolean;
  /** Reads the wall-clock audio-context time of the next loop seam, or null
   *  when not streaming yet (count-in / read-head unknown). Typically wired to
   *  `WindowRegistry.getPlaybackEngine()?.getStemNextSeamTime?.()`. Stable
   *  identity expected (useCallback). */
  getNextSeamTime: () => number | null;
  /** Reads the current audio-context time. Wired to `audioContext.currentTime`
   *  via a stable getter. Drives the lead-time "approaching" trigger. */
  getCurrentTime: () => number | null;
  /** Fired ONCE PER LOOP, a short lead-time BEFORE the loop's seam (while the
   *  loop is still playing), NOT after the wrap. Receives `completedLoops` —
   *  how many loops have fully completed since counting began (0 while the
   *  first loop plays and approaches its end, 1 while the second plays, …).
   *
   *  Why lead-time-before, not at-the-wrap: the consumer queues a key change
   *  via setKey(), which DEFERS to the next loop seam. Firing while still
   *  inside the current loop makes that "next seam" be THIS loop's end, so the
   *  change is heard on the very next loop — no extra loop of latency. Firing
   *  AT the wrap would make setKey target the loop AFTER next (one loop late).
   *
   *  MUST be a stable identity — read through a ref so a changing callback
   *  doesn't restart the poll loop. */
  onLoopApproaching: (completedLoops: number) => void;
}

// Fire the "approaching" callback when the seam is within this many seconds of
// `now` — late enough that we've definitely seen this loop's stable seam, early
// enough that setKey's next-seam deferral still lands on THIS loop's end.
const APPROACH_LEAD_SEC = 0.25;

// A fresh seam must be at least this many seconds LATER than the tracked seam
// to count as a wrap (rather than read-head jitter or a tempo-driven continuous
// shift). Loops are seconds long; a real wrap jumps the seam forward by ~the
// loop duration. 0.25s is comfortably below the shortest practical loop (a 1-bar
// loop at 180 BPM is ~1.3s) yet well above per-frame jitter.
const WRAP_FORWARD_JUMP_SEC = 0.25;

export function useLoopCounter({
  isPlaying,
  enabled,
  isCountingDown,
  getNextSeamTime,
  getCurrentTime,
  onLoopApproaching,
}: UseLoopCounterArgs): void {
  // Latest readers/callback held in refs so the RAF effect depends only on the
  // two booleans — the loop body always sees the current functions without
  // tearing down and rebuilding the RAF every render.
  const getNextSeamTimeRef = useRef(getNextSeamTime);
  const getCurrentTimeRef = useRef(getCurrentTime);
  const onLoopApproachingRef = useRef(onLoopApproaching);
  const isCountingDownRef = useRef(isCountingDown);
  getNextSeamTimeRef.current = getNextSeamTime;
  getCurrentTimeRef.current = getCurrentTime;
  onLoopApproachingRef.current = onLoopApproaching;
  isCountingDownRef.current = isCountingDown;

  // The seam of the loop we're CURRENTLY tracking (null = not baselined yet).
  const trackedSeamRef = useRef<number | null>(null);
  // How many loops have FULLY completed since counting began (incremented on
  // each wrap). Passed to onLoopApproaching as `completedLoops`.
  const completedLoopsRef = useRef(0);
  // Whether we've already fired the approaching callback for the current loop
  // (one fire per loop, when the seam enters the lead-time window).
  const firedForCurrentLoopRef = useRef(false);

  useEffect(() => {
    if (!enabled || !isPlaying) {
      // Parked: reset so a later (re)start counts from a clean baseline. We do
      // NOT carry the tracked seam across a stop — the read-head is gone.
      trackedSeamRef.current = null;
      completedLoopsRef.current = 0;
      firedForCurrentLoopRef.current = false;
      return;
    }

    let rafId = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;

      const seam = getNextSeamTimeRef.current();
      const now = getCurrentTimeRef.current();

      // Seam unavailable (read-head unknown): hold the baseline at null.
      if (seam == null) {
        trackedSeamRef.current = null;
        rafId = requestAnimationFrame(tick);
        return;
      }

      // COUNT-IN GUARD: the bass stem streams during the 1-2-3-4 count-in, so
      // its read-head wraps once at the count-in→loop-1 seam. That wrap is NOT
      // a completed home loop. While counting down we hold the baseline at null
      // so that wrap is suppressed and counting starts cleanly at loop 1.
      if (isCountingDownRef.current) {
        trackedSeamRef.current = null;
        rafId = requestAnimationFrame(tick);
        return;
      }

      const tracked = trackedSeamRef.current;
      if (tracked == null) {
        // First valid reading after the count-in — baseline on loop 0's seam.
        trackedSeamRef.current = seam;
        firedForCurrentLoopRef.current = false;
      } else if (seam > tracked + WRAP_FORWARD_JUMP_SEC) {
        // The seam jumped forward by ~a loop → the read-head WRAPPED → a loop
        // fully completed. Advance the count and re-arm the approach trigger
        // for the new loop.
        trackedSeamRef.current = seam;
        completedLoopsRef.current += 1;
        firedForCurrentLoopRef.current = false;
      } else if (now != null && seam < now - WRAP_FORWARD_JUMP_SEC) {
        // Defensive: seam fell well behind the clock without a visible jump
        // (long RAF gap / backgrounded tab). Re-baseline, don't invent a count.
        trackedSeamRef.current = seam;
        firedForCurrentLoopRef.current = false;
      }

      // APPROACH TRIGGER: once per loop, when the seam is within the lead-time
      // window, fire onLoopApproaching BEFORE the wrap (still inside the loop)
      // so the consumer's setKey deferral lands on THIS loop's end. completed-
      // Loops is the count BEFORE this loop's wrap (0 while loop 1 approaches).
      if (
        now != null &&
        trackedSeamRef.current != null &&
        !firedForCurrentLoopRef.current &&
        trackedSeamRef.current - now <= APPROACH_LEAD_SEC
      ) {
        firedForCurrentLoopRef.current = true;
        onLoopApproachingRef.current(completedLoopsRef.current);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [enabled, isPlaying]);
}
