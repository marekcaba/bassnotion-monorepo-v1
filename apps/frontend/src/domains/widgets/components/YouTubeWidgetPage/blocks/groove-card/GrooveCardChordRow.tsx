'use client';

/**
 * GrooveCardChordRow — a scrolling BAR RIBBON of the groove's chords.
 *
 * The ribbon IS the bar grid: a continuous ruler of fixed-width bars that glides
 * left at exactly the playhead's speed (same audio-phase clock the waveform
 * uses), with the admin-charted chords painted into the bars where they fall.
 * Bar lines are the cell edges — always present, always correct — so a chord
 * held across several bars simply leaves those bars empty (it echoes faintly).
 * The current beat is pinned at the horizontal CENTER; played bars slide off
 * left, upcoming bars approach from the right.
 *
 * Timing mirrors GrooveCardWaveform: gate on `elapsed = currentTime −
 * loopStartAudioTime >= 0` (the phase is meaningless during the count-in), and
 * honour `loopSelection` (when a sub-range loops, the phase spans the selected
 * bars). 4/4 / 8 slots-per-bar is assumed throughout (no time-signature field).
 *
 * Transposition: each loop CYCLE plays in a key. The cycle SOUNDING now keeps
 * its latched (audio-truth) key until its seam; FUTURE cycles are chained
 * forward through the dynamic-loop schedule via advanceCycleKey, so the bars of
 * the upcoming key are already drawn in that key as we approach the seam — one
 * continuous transposing line.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { CHORD_SLOTS_PER_BAR, type ChordChart } from '@bassnotion/contracts';
import { barRender, declutterChordX, sortedChart } from './chordChart';
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
   *  ribbon latches the OLD value per loop cycle so the SOUNDING bars flip with
   *  the sound, not early. */
  currentSemitones: number;
  /** Given a loop cycle's key, the key the NEXT cycle plays — the dynamic
   *  loop's schedule transition (ping-pong flip, or the next rung of the travel
   *  ladder). Lets the ribbon CHAIN future cycles forward into one continuous
   *  transposing line. Identity when the dynamic loop is inactive. */
  advanceCycleKey: (key: number) => number;
}

// Same guard the waveform uses: at the loop origin the latency-compensated
// phase briefly wraps to ≈1.0. Treat the first sliver as bar-1/start.
const BEAT1_GUARD_SEC = 0.25;
// A loop wrap is a backwards jump in loop-phase of more than this fraction of
// the loop (small forward jitter near the seam mustn't be read as a wrap).
const WRAP_BACK_THRESHOLD = 0.5;

// A bar is four equal BEAT columns; sized so a beat cell comfortably fits a
// chord symbol like "Amaj7" / "F♯m7♭5".
const BEATS_PER_BAR = 4;
const BEAT_W = 52; // px per beat cell
const BAR_W = BEAT_W * BEATS_PER_BAR; // px per bar cell
// Declutter: estimated rendered width of a chord symbol = chars × this + pad,
// and the minimum readable gap kept between two adjacent chords. text-sm bold
// is ≈8px/char; the pad covers the leading inset. Crowded chords are nudged
// right to preserve MIN_CHORD_GAP so both stay legible.
const CHAR_W = 8;
const CHORD_PAD = 6;
const MIN_CHORD_GAP = 6;
// Inset every chord this far right of its slot's grid line so the symbol isn't
// flush against the bar/beat line it sits on. A chord on a bar's DOWNBEAT gets
// extra room because the bar line (and the wider double line at the loop start)
// occupies the first few px there.
const CHORD_LEFT_INSET = 8;
const DOWNBEAT_EXTRA_INSET = 6; // added when the chord is on slot 0 of a bar
// How many bars of context to render on each side of the centered now-line.
// Enough to fill a wide card plus a margin so nothing pops in at the edges.
const BARS_BEHIND = 2;
const BARS_AHEAD = 4;

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
  // The sorted chart — used only to decide whether there's anything to draw.
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
    currentSemitones,
  });
  stateRef.current = {
    isPlaying,
    loopSelection,
    getAudioPhase,
    audioContext,
    loopStartAudioTime,
    lengthBars,
    currentSemitones,
  };

  // CONTINUOUS, MONOTONIC absolute bar position of the playhead: increases
  // smoothly as the loop plays and KEEPS climbing across loop wraps (so the
  // ribbon glides left forever and never rewinds at the seam). Integer part =
  // which absolute bar; fractional part = position within the bar. Drives the
  // scroll transform directly. -1 = no reading yet.
  const [absBarPos, setAbsBarPos] = useState(-1);
  const absBarRef = useRef(-1);
  // The loop-phase bar position from the LAST frame, to detect a loop wrap.
  const lastLoopBarRef = useRef(-1);

  // KEY PER LOOP CYCLE. A "cycle" = one full pass through the loop
  // (floor(absBar / barsInLoop)). cycleKeyRef[cycle] = the semitone offset that
  // cycle plays in. Transpose is deferred to the seam, so the cycle sounding now
  // keeps its latched (old) key until its own seam; we latch each new cycle's
  // key the instant the playhead crosses into it (the deferred transpose has
  // landed in the audio at exactly that seam). Future cycles aren't latched —
  // they're chained forward from the current one via advanceCycleKey.
  const cycleKeyRef = useRef<Map<number, number>>(new Map());

  // The number of bars one loop iteration spans right now (whole groove, or the
  // selected sub-range). Needed at render time too, so compute it from props.
  const sel = loopSelection;
  const barsInLoop = sel ? sel.endBar - sel.startBar + 1 : lengthBars;
  const barOffset = sel ? sel.startBar - 1 : 0;

  useEffect(() => {
    if (changes.length === 0) return undefined;
    let rafId = 0;
    let cancelled = false;
    let lastTick = 0;

    const tick = (now: number) => {
      if (cancelled) return;
      rafId = requestAnimationFrame(tick);
      if (now - lastTick < 33) return; // ~30fps — smooth glide, cheap
      lastTick = now;

      const s = stateRef.current;
      if (!s.isPlaying || !s.audioContext || s.loopStartAudioTime == null) {
        return; // hold the ribbon where it is when stopped/paused
      }
      const elapsed = s.audioContext.currentTime - s.loopStartAudioTime;
      if (elapsed < 0) return; // count-in
      let phase = s.getAudioPhase();
      if (phase == null) return;
      if (elapsed < BEAT1_GUARD_SEC && phase > 0.5) phase = 0;

      const selNow = s.loopSelection;
      const bars = selNow ? selNow.endBar - selNow.startBar + 1 : s.lengthBars;
      const loopBar =
        Math.min(0.999999, Math.max(0, phase)) * Math.max(1, bars);

      // First reading → seed the continuous position + latch cycle 0's key.
      if (absBarRef.current < 0) {
        absBarRef.current = loopBar;
        lastLoopBarRef.current = loopBar;
        cycleKeyRef.current.set(
          Math.floor(loopBar / Math.max(1, bars)),
          s.currentSemitones,
        );
        setAbsBarPos(loopBar);
        return;
      }

      // Advance the monotonic absolute position by the loop-phase delta, adding
      // a full loop's worth of bars when the phase wraps (backwards jump).
      let delta = loopBar - lastLoopBarRef.current;
      if (delta < -WRAP_BACK_THRESHOLD * bars) delta += bars; // wrapped
      lastLoopBarRef.current = loopBar;
      if (delta < 0) delta = 0; // tiny backwards jitter — never rewind

      const prevCycle = Math.floor(absBarRef.current / Math.max(1, bars));
      absBarRef.current += delta;
      const newCycle = Math.floor(absBarRef.current / Math.max(1, bars));
      if (newCycle !== prevCycle) {
        // Crossed a loop seam → the deferred transpose has landed; latch this
        // cycle's audio-true key.
        cycleKeyRef.current.set(newCycle, s.currentSemitones);
        for (const c of cycleKeyRef.current.keys()) {
          if (c < newCycle - 1) cycleKeyRef.current.delete(c);
        }
      }
      setAbsBarPos(absBarRef.current);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [changes]);

  // On STOP (playback ends → loopStartAudioTime cleared / isPlaying false),
  // rewind the ribbon to its DEFAULT position: bar 1, downbeat, at the centered
  // now-line. Reset both the continuous position and the per-cycle key latches
  // so the next play starts fresh from the top in the current key.
  useEffect(() => {
    if (isPlaying && loopStartAudioTime != null) return;
    absBarRef.current = -1;
    lastLoopBarRef.current = -1;
    cycleKeyRef.current.clear();
    setAbsBarPos(-1);
  }, [isPlaying, loopStartAudioTime]);

  // No chart → render nothing.
  if (changes.length === 0) return null;

  const safeBars = Math.max(1, barsInLoop);
  const pos = absBarPos < 0 ? 0 : absBarPos;
  const playing = absBarPos >= 0 && isPlaying;
  const currentBar = Math.floor(pos); // absolute bar the playhead is in

  // The key (semitones) a given absolute loop CYCLE plays in. Current/past
  // cycles are latched (audio-truth). FUTURE cycles are CHAINED forward from the
  // current cycle's key via advanceCycleKey — so the upcoming bars are already
  // drawn in the upcoming key, one continuous transposing line.
  const currentCycle = Math.floor(pos / safeBars);
  const keyForCycle = (cycle: number): number => {
    const latched = cycleKeyRef.current.get(cycle);
    if (latched != null) return latched;
    let key = cycleKeyRef.current.get(currentCycle) ?? currentSemitones;
    for (let c = currentCycle; c < cycle; c++) key = advanceCycleKey(key);
    return key;
  };

  // The playhead's continuous SLOT position within the current bar (0..16).
  const currentSlotPos = (pos - currentBar) * CHORD_SLOTS_PER_BAR;

  // Build the visible bars. Each bar sits at its ABSOLUTE index; we translate
  // the ribbon by -(pos × BAR_W) so the playhead point is at x=0, then offset
  // the container to 50% → the now-line is centered. The bar CELLS draw the grid
  // (bar lines, beat lines, number, simile marks); the chord SYMBOLS are laid
  // out in a separate global pass (below) so the declutter can span bar lines —
  // a crowded chord bleeding past a bar end pushes the next bar's first chord.
  const firstBar = Math.max(0, currentBar - BARS_BEHIND);
  const lastBar = currentBar + BARS_AHEAD;
  // Every visible chord change, in ABSOLUTE x (bar offset + slot offset), in time
  // order across all bars — the input to the global declutter.
  const chordItems: {
    absKey: string;
    sym: string;
    slot: number;
    absBar: number;
    naturalX: number;
    width: number;
    isActive: boolean;
  }[] = [];
  const cells = [];
  for (let absBar = firstBar; absBar <= lastBar; absBar++) {
    const cycle = Math.floor(absBar / safeBars);
    const loopBarIdx = absBar - cycle * safeBars; // 0..safeBars-1
    const grooveBar = barOffset + loopBarIdx + 1; // 1-based groove bar
    const isLoopStart = loopBarIdx === 0; // downbeat of the loop (seam)
    const key = keyForCycle(cycle);
    const render = barRender(chordChart, grooveBar);
    const isCurrentBar = absBar === currentBar;
    const barLeft = absBar * BAR_W;

    if (render.kind === 'chords') {
      // The change SOUNDING right now = the last change at or before the
      // playhead's slot in the current bar.
      let activeSlot = -1;
      if (isCurrentBar && playing) {
        for (const c of render.changes) {
          if (c.slot <= currentSlotPos) activeSlot = c.slot;
        }
      }
      for (const c of render.changes) {
        const sym = transposeChordSymbol(c.symbol, key, originalKey);
        chordItems.push({
          absKey: `${absBar}:${c.slot}`,
          sym,
          slot: c.slot,
          absBar,
          naturalX:
            barLeft +
            (c.slot / CHORD_SLOTS_PER_BAR) * BAR_W +
            CHORD_LEFT_INSET +
            (c.slot === 0 ? DOWNBEAT_EXTRA_INSET : 0),
          width: sym.length * CHAR_W + CHORD_PAD,
          isActive: c.slot === activeSlot,
        });
      }
    }

    cells.push(
      <div
        key={absBar}
        style={{ position: 'absolute', left: barLeft, width: BAR_W }}
        className="h-full"
      >
        {/* Bar line on the LEFT edge. The loop START (bar 1 of each cycle) is a
            DOUBLE bar line — two brighter strokes — like a notation section
            barline, so the loop seam is unmistakable. */}
        {isLoopStart ? (
          <>
            <div className="absolute inset-y-0 left-0 w-px bg-white/45" />
            <div className="absolute inset-y-0 left-[3px] w-px bg-white/45" />
          </>
        ) : (
          <div className="absolute inset-y-0 left-0 w-px bg-white/15" />
        )}
        {/* Faint beat reference lines (every quarter-note) for a grid feel. */}
        {[1, 2, 3].map((beat) => (
          <div
            key={beat}
            style={{ left: (beat / 4) * BAR_W }}
            className="absolute inset-y-2.5 w-px bg-white/8"
          />
        ))}
        {/* Bar number, dim, top-left like a DAW grid. */}
        <span className="absolute left-1.5 top-0 text-[9px] font-medium tabular-nums text-white/25">
          {grooveBar}
        </span>

        {/* A bar that sustains the previous chord → one simile (repeat) mark,
            centered. Reads "same chord again"; never highlighted. */}
        {render.kind === 'repeat' ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <SimileMark />
          </div>
        ) : null}
      </div>,
    );
  }

  // GLOBAL declutter across all visible chords (absolute x, time order) so a
  // crowded cluster that bleeds past a bar line pushes the next bar's first
  // chord too — no chord is ever rendered unreadably on top of another.
  const placedX = declutterChordX(chordItems, MIN_CHORD_GAP);
  const chordSpans = chordItems.map((c, i) => (
    <span
      key={c.absKey}
      style={{ left: placedX[i] }}
      className={`pointer-events-none absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-sm font-bold tracking-tight transition-colors ${
        c.isActive ? 'text-emerald-300' : 'text-white/80'
      }`}
    >
      {c.sym}
    </span>
  ));

  return (
    <div className="relative h-10 overflow-hidden" role="status">
      {/* Centered now-line marker. */}
      <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-px -translate-x-1/2 bg-emerald-400/40" />
      {/* The ribbon: each cell sits at absBar×BAR_W; translating by -pos×BAR_W
          puts the playhead point at x=0, and the 50% container offset centers
          it. The slide animates smoothly as `pos` advances each frame. */}
      <div
        className="absolute inset-y-0 left-1/2"
        style={{ transform: `translateX(${-pos * BAR_W}px)` }}
      >
        {cells}
        {/* Chord symbols, globally decluttered, in the SAME translated space as
            the cells (so they scroll together) but layered above the grid. */}
        {chordSpans}
      </div>
    </div>
  );
}

/**
 * The musical SIMILE (repeat-bar) mark: a slash from bottom-left to top-right
 * with a dot in the upper-left and lower-right. Drawn in a sustaining bar to
 * say "repeat the previous chord". Never highlighted — the playhead just runs
 * through it.
 */
function SimileMark() {
  const color = 'rgba(255,255,255,0.45)';
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      aria-label="repeat previous chord"
      className="relative"
    >
      {/* The diagonal slash. */}
      <line
        x1="5"
        y1="17"
        x2="17"
        y2="5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Dot upper-left, dot lower-right. */}
      <circle cx="7.5" cy="7.5" r="1.7" fill={color} />
      <circle cx="14.5" cy="14.5" r="1.7" fill={color} />
    </svg>
  );
}
