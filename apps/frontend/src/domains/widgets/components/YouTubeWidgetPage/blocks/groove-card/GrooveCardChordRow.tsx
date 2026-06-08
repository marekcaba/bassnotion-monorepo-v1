'use client';

/**
 * GrooveCardChordRow — the chord chart shown to the player as they play along.
 *
 * Renders the groove's chords as a row aligned to the bar grid (one segment per
 * bar, matching the waveform below), and HIGHLIGHTS the chord sounding right now
 * as the playhead moves. A RAF loop reads the real audio phase, converts it to
 * (bar, slot), and resolves the active chord via the sparse chart.
 *
 * Timing mirrors GrooveCardWaveform: gate on `elapsed = currentTime −
 * loopStartAudioTime >= 0` (the phase is meaningless during the count-in), and
 * honour `loopSelection` (when a sub-range loops, the phase spans the selected
 * bars). 4/4 / 8 slots-per-bar is assumed throughout (no time-signature field).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { CHORD_SLOTS_PER_BAR, type ChordChart } from '@bassnotion/contracts';
import { phaseToPosition, sortedChart } from './chordChart';
import { transposeChordSymbol } from './transposeChord';
import type { LoopSelection } from './useGrooveCardPlayback';

interface GrooveCardChordRowProps {
  chordChart: ChordChart | undefined;
  lengthBars: number;
  isPlaying: boolean;
  /** The bar-range currently looping, or null for the whole groove. */
  loopSelection: LoopSelection | null;
  /** Live audio phase [0,1) from the bass read-head, or null when not
   *  streaming. */
  getAudioPhase: () => number | null;
  /** AudioContext for the count-in gate (elapsed >= 0). */
  audioContext: AudioContext | null;
  /** Audio-context time the current loop iteration started (post count-in), or
   *  null when stopped. */
  loopStartAudioTime: number | null;
  /** The groove's ORIGINAL key (the key the chords were authored in). Drives
   *  the flat/sharp spelling of transposed chords. */
  originalKey: string;
  /** The TARGET semitone offset from the original key (the key the user has
   *  selected). LEADS the audio — jumps to the new key before the seam. The
   *  carousel latches the OLD value per loop cycle so the SOUNDING chords flip
   *  with the sound, not early. */
  currentSemitones: number;
  /** Given a loop cycle's key, the key the NEXT cycle plays — the dynamic
   *  loop's schedule transition (ping-pong flip, or the next rung of the travel
   *  ladder). Lets the ribbon CHAIN future cycles forward into one continuous
   *  transposing line (A D G C | C F B♭ E♭ | G♭ B E A …). When the dynamic loop
   *  is inactive this is identity (no further changes are scheduled). */
  advanceCycleKey: (key: number) => number;
}

// Same guard the waveform uses: at the loop origin the latency-compensated
// phase briefly wraps to ≈1.0. Treat the first sliver as bar-1/start.
const BEAT1_GUARD_SEC = 0.25;

export function GrooveCardChordRow({
  chordChart,
  lengthBars,
  isPlaying,
  loopSelection,
  getAudioPhase,
  audioContext,
  loopStartAudioTime,
  originalKey,
  currentSemitones,
  advanceCycleKey,
}: GrooveCardChordRowProps) {
  // The distinct chord changes, sorted — what we lay out across the bars.
  const changes = useMemo(() => sortedChart(chordChart), [chordChart]);

  // Live props in a ref so the RAF loop (mounted once) always sees the latest
  // without restarting — same pattern as the waveform.
  const stateRef = useRef({
    isPlaying,
    loopSelection,
    getAudioPhase,
    audioContext,
    loopStartAudioTime,
    lengthBars,
    chordChart,
    currentSemitones,
  });
  stateRef.current = {
    isPlaying,
    loopSelection,
    getAudioPhase,
    audioContext,
    loopStartAudioTime,
    lengthBars,
    chordChart,
    currentSemitones,
  };

  // MONOTONIC logical position of the current chord: increases by 1 every time
  // the active chord advances — INCLUDING across loop wraps (so the carousel
  // slides forever left and never rewinds at the loop boundary). The visible
  // chord is `changes[logicalPos % changes.length]`. -1 = none yet.
  const [logicalPos, setLogicalPos] = useState(-1);
  // Track the raw active index so we can detect a step (raw → raw+1, or wrap
  // last → first) and bump the monotonic counter accordingly.
  const lastRawRef = useRef(-1);
  const logicalRef = useRef(-1);

  // KEY PER LOOP CYCLE. A "cycle" = one full pass through the chart
  // (floor(logical / changes.length)). cycleKeyRef[cycle] = the semitone offset
  // that cycle plays in. The transpose is a deferred-to-the-seam event, so:
  //  - the cycle SOUNDING now keeps its latched (old) key until its seam;
  //  - when a new key is QUEUED (currentSemitones changes), we latch it for the
  //    IMMEDIATELY-NEXT cycle — a STABLE value that won't flicker (unlike the
  //    dynamic loop's leading nextSemitones). That gives clean anticipation:
  //    the next cycle's chords show the queued key the whole approach.
  const cycleKeyRef = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    if (changes.length === 0) return undefined;
    let rafId = 0;
    let cancelled = false;
    let lastTick = 0;

    const tick = (now: number) => {
      if (cancelled) return;
      rafId = requestAnimationFrame(tick);
      if (now - lastTick < 66) return; // ~15fps is plenty
      lastTick = now;

      const s = stateRef.current;
      if (!s.isPlaying || !s.audioContext || s.loopStartAudioTime == null) {
        return; // hold the strip where it is when stopped/paused
      }
      const elapsed = s.audioContext.currentTime - s.loopStartAudioTime;
      if (elapsed < 0) return; // count-in
      let phase = s.getAudioPhase();
      if (phase == null) return;
      if (elapsed < BEAT1_GUARD_SEC && phase > 0.5) phase = 0;

      const sel = s.loopSelection;
      const barsInLoop = sel ? sel.endBar - sel.startBar + 1 : s.lengthBars;
      const barOffset = sel ? sel.startBar - 1 : 0;
      const { bar, slot } = phaseToPosition(phase, barsInLoop, barOffset);
      const targetAbs = (bar - 1) * CHORD_SLOTS_PER_BAR + slot;

      // Last change at or before the current position.
      let raw = 0;
      for (let k = 0; k < changes.length; k++) {
        const chg = changes[k];
        if (!chg) break;
        if ((chg.bar - 1) * CHORD_SLOTS_PER_BAR + chg.slot <= targetAbs)
          raw = k;
        else break;
      }

      // First reading → seed the monotonic counter + latch the first cycle's
      // key as the key sounding now.
      if (logicalRef.current < 0) {
        logicalRef.current = raw;
        lastRawRef.current = raw;
        cycleKeyRef.current.set(
          Math.floor(raw / changes.length),
          s.currentSemitones,
        );
        setLogicalPos(raw);
        return;
      }
      if (raw !== lastRawRef.current) {
        // Forward distance around the ring (handles wrap last→first as +1).
        const fwd =
          (raw - lastRawRef.current + changes.length) % changes.length;
        const prevCycle = Math.floor(logicalRef.current / changes.length);
        logicalRef.current += fwd;
        lastRawRef.current = raw;
        // If we crossed a loop seam (entered a new cycle), latch THIS cycle's
        // key = the now-current semitones (the deferred transpose has landed in
        // the audio at exactly this seam).
        const newCycle = Math.floor(logicalRef.current / changes.length);
        if (newCycle !== prevCycle) {
          cycleKeyRef.current.set(newCycle, s.currentSemitones);
          // Drop stale past-cycle entries so the Map can't grow unbounded.
          for (const c of cycleKeyRef.current.keys()) {
            if (c < newCycle - 1) cycleKeyRef.current.delete(c);
          }
        }
        setLogicalPos(logicalRef.current);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [changes]);

  // No chart → render nothing.
  if (changes.length === 0) return null;

  const SLOT_W = 88; // px per chord slot
  // No trailing past chord: at a loop wrap the just-played chord is in the OLD
  // key, and showing it sliding out flashes the old key as the loop restarts.
  // Start the strip at the current chord and only look ahead.
  const BEHIND = 0;
  const pos = logicalPos < 0 ? 0 : logicalPos;
  const playing = logicalPos >= 0 && isPlaying;
  // Look ahead a FULL loop (capped) so the chords of the NEXT cycle — already
  // transposed to the upcoming key — are visible while we approach the seam,
  // reading as one continuous transposing line. Capped so a long chart doesn't
  // render an absurd number of off-screen slots.
  const AHEAD = Math.min(changes.length + 1, 8);

  // The key (semitones) a given loop CYCLE plays in. The CURRENT/past cycles
  // are latched (audio-truth, flip with the sound). FUTURE cycles are CHAINED
  // forward from the latest latched cycle via advanceCycleKey — so the ribbon
  // shows the whole travel ladder ahead as one continuous transposing line
  // (A D G C | C F B♭ E♭ | G♭ B E A …), not just the immediate next key.
  const currentCycle = Math.floor(pos / changes.length);
  const keyForCycle = (cycle: number): number => {
    const latched = cycleKeyRef.current.get(cycle);
    if (latched != null) return latched;
    // Not latched (a future cycle): walk forward from the current cycle's key,
    // applying the schedule transition once per cycle of distance.
    let key = cycleKeyRef.current.get(currentCycle) ?? currentSemitones;
    for (let c = currentCycle; c < cycle; c++) key = advanceCycleKey(key);
    return key;
  };

  // A window of slots positioned at their ABSOLUTE logical index. We translate
  // the whole strip by -(pos × SLOT_W) so slot `pos` sits at x=0, then center
  // it. As `pos` increases the strip slides LEFT with a CSS transition — a real
  // glide, because each slot keeps its absolute x (keyed by logical index).
  // Each slot's chord is transposed by ITS cycle's key, so chords crossing into
  // the next loop cycle already appear in the upcoming key.
  const slots = [];
  for (let logical = pos - BEHIND; logical <= pos + AHEAD; logical++) {
    if (logical < 0) continue;
    const rawSym = changes[logical % changes.length]?.symbol ?? '';
    const cycle = Math.floor(logical / changes.length);
    const sym = transposeChordSymbol(rawSym, keyForCycle(cycle), originalKey);
    const d = logical - pos; // 0 = current; <0 behind; >0 ahead
    const opacity = d === 0 ? 1 : d < 0 ? 0.18 : Math.max(0.12, 1 - d * 0.3);
    slots.push(
      <div
        key={logical}
        style={{
          position: 'absolute',
          left: logical * SLOT_W,
          width: SLOT_W,
          opacity,
        }}
        className="flex h-full items-center justify-center"
      >
        <span
          className={`text-2xl font-bold tracking-tight transition-colors ${
            d === 0 && playing ? 'text-emerald-300' : 'text-white/70'
          }`}
        >
          {sym}
        </span>
      </div>,
    );
  }

  const currentSym = transposeChordSymbol(
    changes[pos % changes.length]?.symbol ?? '',
    keyForCycle(Math.floor(pos / changes.length)),
    originalKey,
  );

  return (
    <div
      className="relative h-9 overflow-hidden"
      role="status"
      aria-label={`Current chord ${currentSym}`}
    >
      {/* Centered viewport: the current slot (at absolute x = pos×SLOT_W) is
          pulled to the horizontal center by translating the strip. The slide
          animates as `pos` changes. */}
      <div
        className="absolute inset-y-0 transition-transform duration-300 ease-out"
        style={{
          left: `calc(50% - ${SLOT_W / 2}px)`,
          transform: `translateX(${-pos * SLOT_W}px)`,
        }}
      >
        {slots}
      </div>
    </div>
  );
}
