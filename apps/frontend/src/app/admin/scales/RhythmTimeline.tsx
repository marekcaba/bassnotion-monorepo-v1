'use client';

/**
 * RhythmTimeline — lays the path's timed notes out in MUSICAL TIME: a horizontal strip
 * divided into measures by BARLINES, notes positioned by their tick, a beat grid, and a
 * running position readout. A note that crosses a barline is drawn as two segments joined
 * by a TIE arc (one sounding note, split heads). Click a note to select; remove from here.
 *
 * Pure presentation over resolveTimeline() — all the musical math lives in musicalTime.ts.
 */

import React from 'react';
import {
  resolveTimeline,
  ticksPerMeasure,
  PPQ,
  type PathEvent,
  type TimeSignature,
} from './musicalTime';

const PX_PER_TICK = 0.18; // horizontal scale: 480-tick quarter ≈ 86px
const ROW_H = 54;
const NOTE_R = 9;

export function RhythmTimeline({
  notes,
  sig,
  selectedIndex,
  onSelect,
  noteLabel,
  playingIndex,
}: {
  notes: PathEvent[];
  sig: TimeSignature;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  /** Render a short label for a note (e.g. its string/fret) on its head. Rests skip it. */
  noteLabel: (n: PathEvent) => string;
  /** The event index currently PLAYING (visual playthrough) — highlighted. */
  playingIndex?: number | null;
}) {
  const { segments, measureCount } = resolveTimeline(notes, sig);
  const measureTicks = ticksPerMeasure(sig);
  const ticksPerBeat = (PPQ * 4) / sig.denominator;
  const totalTicks = measureCount * measureTicks;
  const width = totalTicks * PX_PER_TICK + 20;

  // Absolute tick → x px. Segment measure + startTickInMeasure → absolute tick.
  const segAbsTick = (measure: number, startInMeasure: number) =>
    measure * measureTicks + startInMeasure;
  const tickToX = (t: number) => 10 + t * PX_PER_TICK;

  return (
    <div style={{ overflowX: 'auto' }}>
      <div
        style={{ position: 'relative', width, height: ROW_H + 22 }}
        className="rounded-md bg-gray-50"
      >
        {/* Beat grid + barlines */}
        {Array.from({ length: measureCount }).map((_, m) => (
          <React.Fragment key={m}>
            {/* barline at the start of each measure (heavier) */}
            <div
              style={{ left: tickToX(m * measureTicks), top: 0, height: ROW_H }}
              className="absolute w-0.5 bg-gray-400"
            />
            {/* measure number */}
            <div
              style={{ left: tickToX(m * measureTicks) + 3, top: 2 }}
              className="absolute text-[9px] font-bold text-gray-400"
            >
              M{m + 1}
            </div>
            {/* beat ticks within the measure */}
            {Array.from({ length: sig.numerator }).map((_, b) =>
              b === 0 ? null : (
                <div
                  key={b}
                  style={{
                    left: tickToX(m * measureTicks + b * ticksPerBeat),
                    top: 14,
                    height: ROW_H - 14,
                  }}
                  className="absolute w-px bg-gray-200"
                />
              ),
            )}
          </React.Fragment>
        ))}
        {/* final barline */}
        <div
          style={{ left: tickToX(totalTicks), top: 0, height: ROW_H }}
          className="absolute w-0.5 bg-gray-400"
        />

        {/* Note + rest segments */}
        {segments.map((seg, i) => {
          const startTick = segAbsTick(seg.measure, seg.startTickInMeasure);
          const x = tickToX(startTick);
          const w = seg.durationTicks * PX_PER_TICK;
          const event = notes[seg.noteIndex]!;
          const selected = seg.noteIndex === selectedIndex;
          const playing = seg.noteIndex === playingIndex;
          const cy = ROW_H / 2 + 4;

          // ── REST: a faint hatched bar with a rest glyph, no head. Click to select. ──
          if (seg.isRest) {
            return (
              <React.Fragment key={i}>
                <div
                  style={{
                    left: x,
                    top: cy - 5,
                    width: Math.max(2, w - 2),
                    height: 10,
                  }}
                  className={`absolute rounded border border-dashed ${
                    selected
                      ? 'border-amber-500 bg-amber-100'
                      : 'border-gray-300 bg-gray-100'
                  }`}
                />
                {!seg.tiedFromPrev && (
                  <button
                    type="button"
                    onClick={() => onSelect(seg.noteIndex)}
                    style={{ left: x - 8, top: cy - 8 }}
                    className={`absolute flex h-4 w-4 items-center justify-center text-[12px] leading-none ${
                      selected
                        ? 'text-amber-600'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                    title="rest — click to select"
                  >
                    𝄽
                  </button>
                )}
              </React.Fragment>
            );
          }

          // ── NOTE: duration bar + head (+ tie arc). ──
          return (
            <React.Fragment key={i}>
              <div
                style={{
                  left: x,
                  top: cy - 3,
                  width: Math.max(2, w - 2),
                  height: 6,
                }}
                className={`absolute rounded ${
                  playing
                    ? 'bg-amber-400'
                    : selected
                      ? 'bg-emerald-600'
                      : 'bg-emerald-300'
                }`}
              />
              {/* note head (only on the FIRST segment — the tied tail has no new head) */}
              {!seg.tiedFromPrev && (
                <button
                  type="button"
                  onClick={() => onSelect(seg.noteIndex)}
                  style={{ left: x - NOTE_R, top: cy - NOTE_R }}
                  className={`absolute flex items-center justify-center rounded-full text-[9px] font-bold ${
                    playing
                      ? 'bg-amber-400 text-black ring-2 ring-amber-500'
                      : selected
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-500 text-white hover:bg-emerald-400'
                  }`}
                >
                  <span
                    style={{ width: NOTE_R * 2, height: NOTE_R * 2 }}
                    className="flex items-center justify-center"
                  >
                    {noteLabel(event)}
                  </span>
                </button>
              )}
              {/* tie arc into the next segment (this note continues over the barline) */}
              {seg.tiedToNext && (
                <div
                  style={{ left: x + w - 4, top: cy + 5, width: 16, height: 8 }}
                  className="absolute rounded-b-full border-b-2 border-emerald-500"
                  title="tied across the barline"
                />
              )}
            </React.Fragment>
          );
        })}

        {notes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">
            Pick a duration, then click the grid above to place notes — they lay
            out here in time.
          </div>
        )}
      </div>
    </div>
  );
}
