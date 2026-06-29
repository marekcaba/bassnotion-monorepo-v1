'use client';

/**
 * PathFretGrid — a clean 2D fretboard grid the admin clicks to DRAW a path: tap notes in
 * order, each gets a numbered marker (1, 2, 3 …). This is the authoring surface for the
 * "MAJOR PATH" — an explicit ordered note sequence spanning the WHOLE neck, not a box.
 *
 * Why a 2D grid (not the 3D board): clicking exact notes on the angled 3D perspective is
 * imprecise; a flat strings×frets grid gives pixel-perfect hit-testing. The 3D board sits
 * alongside as the "how it looks" preview, lit from the same sequence.
 *
 * STRING CONVENTION (matches noteUniverse): string 1 = highest pitch (G), the highest
 * string NUMBER = lowest. Row 0 (top) = string 1 (highest), bottom = lowest. The OPEN
 * string (fret 0) shows the string's letter and is itself clickable; fret 1, 2 … follow.
 *   4-string: G D A E (E lowest)   5-string: + low B   6-string: + low B + high C
 */

import React from 'react';

export interface PathNote {
  string: number; // 1 = highest (G) … stringCount = lowest
  fret: number; // 0 = open
}

const FRET_W = 34;
const STRING_H = 30;

// Open-string names by string count, TOP→BOTTOM (string 1 = highest at top, last = lowest
// at bottom). Standard bass tunings: 4=EADG, 5 adds low B, 6 = B-E-A-D-G-C.
const OPEN_NAMES_BY_COUNT: Record<number, string[]> = {
  4: ['G', 'D', 'A', 'E'], // string 1..4 (top..bottom): G high → E low
  5: ['G', 'D', 'A', 'E', 'B'], // + low B at the bottom
  6: ['C', 'G', 'D', 'A', 'E', 'B'], // high C at top → low B at bottom
};
const MARKER_FRETS = new Set([3, 5, 7, 9, 12, 15, 17, 19, 21, 24]);

export function PathFretGrid({
  stringCount,
  maxFrets,
  path,
  onAppend,
  onRemove,
  onMove,
  playingIndex,
}: {
  stringCount: 4 | 5 | 6;
  maxFrets: number;
  /** The ordered sequence being drawn (notes only). */
  path: PathNote[];
  /** Append a note (the admin clicked an EMPTY cell). */
  onAppend: (note: PathNote) => void;
  /** Remove the note at `index` (the admin clicked an existing note dot). */
  onRemove: (index: number) => void;
  /** Move the note at `index` (in `path`) to a new string/fret (the admin dragged it). */
  onMove: (index: number, dest: PathNote) => void;
  /** The note index currently PLAYING (visual playthrough) — highlighted. null = none. */
  playingIndex?: number | null;
}) {
  const frets = Array.from({ length: maxFrets + 1 }, (_, f) => f); // 0..maxFrets
  const strings = Array.from({ length: stringCount }, (_, i) => i + 1); // 1..N (high→low)
  const names = OPEN_NAMES_BY_COUNT[stringCount] ?? OPEN_NAMES_BY_COUNT[4]!;
  const nameOf = (rowIdx: number) => names[rowIdx] ?? '?';

  // Which note index is being dragged (set on dragstart from a placed dot).
  const dragIndexRef = React.useRef<number | null>(null);

  // For each (string,fret) cell, the step numbers it carries (a note can repeat in a path).
  const stepsAt = (s: number, f: number): number[] =>
    path
      .map((n, i) => (n.string === s && n.fret === f ? i + 1 : -1))
      .filter((i) => i > 0);

  // fret 0 = the open string (shows the letter); column x = fret * FRET_W.
  const width = (maxFrets + 1) * FRET_W;
  const height = stringCount * STRING_H + 18; // + fret-number row

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ position: 'relative', width, height, userSelect: 'none' }}>
        {/* String rows */}
        {strings.map((s, rowIdx) => (
          <div
            key={s}
            style={{
              position: 'absolute',
              top: rowIdx * STRING_H,
              left: 0,
              width,
              height: STRING_H,
            }}
          >
            {/* string line (starts after the open-string cell) */}
            <div
              style={{ left: FRET_W, right: 0, top: STRING_H / 2 }}
              className="absolute h-px bg-gray-300"
            />
            {/* fret cells — fret 0 is the clickable OPEN string (shows the letter) */}
            {frets.map((f) => {
              const steps = stepsAt(s, f);
              const active = steps.length > 0;
              const isOpen = f === 0;
              // Marker frets (3,5,7,9,12,15…) get a darker dot BY DEFAULT so those frets
              // stand out without hovering — like inlays on a real neck.
              const isMarker = MARKER_FRETS.has(f);
              const inactiveCell = isOpen
                ? 'bg-gray-200 text-gray-600 hover:bg-emerald-200'
                : isMarker
                  ? 'bg-gray-300 text-transparent hover:bg-emerald-200'
                  : // ordinary frets: a faint dot (≈5% black) so they're visible on the
                    // white bg without competing with the darker marker frets.
                    'bg-black/5 text-transparent hover:bg-gray-200';
              // The note index (in `path`) of the FIRST note on this cell — the drag handle.
              const firstNoteIdx = active ? steps[0]! - 1 : -1;
              // Is this cell the note currently PLAYING (visual playthrough)?
              const isPlaying =
                playingIndex != null && steps.includes(playingIndex + 1);
              return (
                <button
                  key={f}
                  type="button"
                  // Click ANY cell (empty OR already filled) → add a note here. A filled fret
                  // can hold several notes (the path returns to it). To remove, use the ×.
                  onClick={() => onAppend({ string: s, fret: f })}
                  // Drop target: a dragged note lands here → move it to this string/fret.
                  onDragOver={(e) => {
                    if (dragIndexRef.current !== null) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const idx = dragIndexRef.current;
                    if (idx !== null) onMove(idx, { string: s, fret: f });
                    dragIndexRef.current = null;
                  }}
                  style={{ left: f * FRET_W, width: FRET_W, height: STRING_H }}
                  className="group absolute top-0 flex items-center justify-center"
                  title={
                    active
                      ? `${nameOf(rowIdx)} string, fret ${f} — click to add another, drag to move, × to remove`
                      : `${nameOf(rowIdx)} string, fret ${f} — click to add`
                  }
                >
                  <span
                    // A placed note is DRAGGABLE — drag it to another cell to move it.
                    draggable={active}
                    onDragStart={() => {
                      dragIndexRef.current = firstNoteIdx;
                    }}
                    onDragEnd={() => {
                      dragIndexRef.current = null;
                    }}
                    className={`relative flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                      isPlaying
                        ? 'scale-125 bg-amber-400 text-black ring-2 ring-amber-500'
                        : active
                          ? 'cursor-grab bg-emerald-500 text-white active:cursor-grabbing'
                          : inactiveCell
                    }`}
                  >
                    {active ? steps.join(',') : isOpen ? nameOf(rowIdx) : '+'}
                    {active && (
                      <span
                        role="button"
                        aria-label="Remove note"
                        title="Remove this note"
                        // Stop the cell's onClick (which would ADD) from firing.
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(firstNoteIdx);
                        }}
                        className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[9px] leading-none text-white opacity-0 transition-opacity hover:bg-rose-600 group-hover:opacity-100"
                      >
                        ×
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        ))}

        {/* Fret-number row (fret 0 = "open") */}
        <div
          style={{
            position: 'absolute',
            top: stringCount * STRING_H,
            left: 0,
            width,
          }}
        >
          {frets.map((f) => (
            <div
              key={f}
              style={{ position: 'absolute', left: f * FRET_W, width: FRET_W }}
              className={`text-center text-[9px] ${
                f === 0
                  ? 'font-semibold text-gray-400'
                  : MARKER_FRETS.has(f)
                    ? 'font-bold text-gray-500'
                    : 'text-gray-300'
              }`}
            >
              {f === 0 ? 'open' : f}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
