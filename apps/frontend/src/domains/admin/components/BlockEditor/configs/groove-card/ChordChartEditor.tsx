'use client';

/**
 * ChordChartEditor — admin grid for authoring a groove's chord chart.
 *
 * A grid of `lengthBars` rows × CHORD_SLOTS_PER_BAR sixteenth-note slots (16 in
 * 4/4). The admin types a chord symbol into any cell where the harmony CHANGES;
 * empty cells inherit the previous chord (shown ghosted so it's clear what's
 * holding). The chart is SPARSE — only filled cells are stored as
 * { bar, slot, symbol } entries.
 *
 * Beat layout per bar: each beat is 4 sixteenths labelled `1 e & a`. The slot on
 * each beat's downbeat (every 4th slot) is visually stronger, and a faint gap
 * separates the four beats so the bar reads as 4 groups of 4.
 *
 * INTERACTION: click a cell to type; click-and-DRAG a filled cell to MOVE the
 * chord to a different slot. A click that doesn't move past a small threshold
 * focuses the input for typing (so typing is unaffected); a drag past the
 * threshold relocates the chord to whatever cell the pointer is released over.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { CHORD_SLOTS_PER_BAR, type ChordChart } from '@bassnotion/contracts';
import {
  chartCellMap,
  chordAt,
  cellKey,
} from '@/domains/widgets/components/YouTubeWidgetPage/blocks/groove-card/chordChart';

// Pointer must travel this many px before a press becomes a DRAG (under it, the
// press is a click → focus the input for typing).
const DRAG_THRESHOLD_PX = 5;

interface ChordChartEditorProps {
  lengthBars: number;
  value: ChordChart | undefined;
  onChange: (next: ChordChart) => void;
  /** Visual theme — 'light' for the standalone admin pages (light bg),
   *  'dark' for the block-editor surface (dark bg). Default 'light'. */
  theme?: 'light' | 'dark';
}

// 4/4: four beats per bar, each subdivided into sixteenths.
const BEATS = 4;
const SLOTS_PER_BEAT = CHORD_SLOTS_PER_BAR / BEATS; // 4 sixteenths per beat
// Subdivision labels within a beat: downbeat is the beat number, then e · & · a.
const SUBDIVISION_LABELS = ['', 'e', '&', 'a'] as const;

// Per-theme class sets so the editor reads correctly on both the light admin
// pages and the dark block-editor surface.
const THEMES = {
  light: {
    heading: 'text-gray-500',
    hint: 'text-gray-400',
    header: 'text-gray-400',
    barLabel: 'text-gray-400',
    cellText: 'text-gray-900 placeholder:text-gray-300',
    filled: 'bg-emerald-100 ring-1 ring-emerald-400',
    downbeat: 'bg-gray-100',
    offbeat: 'bg-gray-50',
  },
  dark: {
    heading: 'text-white/50',
    hint: 'text-white/40',
    header: 'text-white/30',
    barLabel: 'text-white/40',
    cellText: 'text-white placeholder:text-white/20',
    filled: 'bg-emerald-500/15 ring-1 ring-emerald-400/40 text-emerald-200',
    downbeat: 'bg-white/5',
    offbeat: 'bg-white/[0.02]',
  },
} as const;

export function ChordChartEditor({
  lengthBars,
  value,
  onChange,
  theme = 'light',
}: ChordChartEditorProps) {
  const bars = Math.max(1, Math.round(lengthBars));
  const cells = chartCellMap(value);
  const t = THEMES[theme];

  // Latest value/onChange in a ref so the window pointer listeners (bound once
  // per drag) always act on the current chart.
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Set (or clear) the chord at one cell, keeping the chart sparse + sorted.
  const setCell = (bar: number, slot: number, raw: string) => {
    const symbol = raw.trim();
    const rest = (valueRef.current ?? []).filter(
      (e) => !(e.bar === bar && e.slot === slot),
    );
    const next = symbol ? [...rest, { bar, slot, symbol }] : rest;
    next.sort(
      (a, b) => (a.bar - b.bar) * CHORD_SLOTS_PER_BAR + (a.slot - b.slot),
    );
    onChangeRef.current(next);
  };

  // Move the chord at (fromBar,fromSlot) to (toBar,toSlot): drop the source
  // entry + any entry already at the target, then place the dragged symbol at
  // the target. No-op if the target is the same cell.
  const moveCell = useCallback(
    (
      fromBar: number,
      fromSlot: number,
      symbol: string,
      toBar: number,
      toSlot: number,
    ) => {
      if (fromBar === toBar && fromSlot === toSlot) return;
      const next = (valueRef.current ?? []).filter(
        (e) =>
          !(e.bar === fromBar && e.slot === fromSlot) &&
          !(e.bar === toBar && e.slot === toSlot),
      );
      next.push({ bar: toBar, slot: toSlot, symbol });
      next.sort(
        (a, b) => (a.bar - b.bar) * CHORD_SLOTS_PER_BAR + (a.slot - b.slot),
      );
      onChangeRef.current(next);
    },
    [],
  );

  // ── Drag-to-move ───────────────────────────────────────────────────────────
  // A press on a FILLED cell arms a potential drag; once the pointer moves past
  // the threshold it becomes a drag (we blur the input so it doesn't capture
  // text-selection) and on release the chord moves to the cell under the pointer.
  const pendingRef = useRef<{
    bar: number;
    slot: number;
    symbol: string;
    startX: number;
    startY: number;
    pointerId: number;
    dragging: boolean;
    input: HTMLInputElement;
  } | null>(null);
  // The cell currently hovered while dragging (for target highlight), and a
  // floating chip following the cursor.
  const [drag, setDrag] = useState<{
    symbol: string;
    x: number;
    y: number;
    overBar: number | null;
    overSlot: number | null;
  } | null>(null);

  // Resolve the chart cell under a screen point via its data-* attributes.
  const cellAtPoint = (
    x: number,
    y: number,
  ): { bar: number; slot: number } | null => {
    const el = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>('[data-chord-cell]');
    if (!el) return null;
    const bar = Number(el.dataset.bar);
    const slot = Number(el.dataset.slot);
    if (!Number.isFinite(bar) || !Number.isFinite(slot)) return null;
    return { bar, slot };
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const p = pendingRef.current;
      if (!p || e.pointerId !== p.pointerId) return;
      if (!p.dragging) {
        const moved =
          Math.abs(e.clientX - p.startX) > DRAG_THRESHOLD_PX ||
          Math.abs(e.clientY - p.startY) > DRAG_THRESHOLD_PX;
        if (!moved) return;
        p.dragging = true;
        p.input.blur(); // stop text-selection / typing while dragging
      }
      e.preventDefault();
      const over = cellAtPoint(e.clientX, e.clientY);
      setDrag({
        symbol: p.symbol,
        x: e.clientX,
        y: e.clientY,
        overBar: over?.bar ?? null,
        overSlot: over?.slot ?? null,
      });
    };
    const onUp = (e: PointerEvent) => {
      const p = pendingRef.current;
      if (!p || e.pointerId !== p.pointerId) return;
      if (p.dragging) {
        const over = cellAtPoint(e.clientX, e.clientY);
        if (over) moveCell(p.bar, p.slot, p.symbol, over.bar, over.slot);
      }
      pendingRef.current = null;
      setDrag(null);
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [moveCell]);

  const onCellPointerDown = (
    e: React.PointerEvent<HTMLInputElement>,
    bar: number,
    slot: number,
    symbol: string,
  ) => {
    if (!symbol) return; // only filled cells are draggable
    pendingRef.current = {
      bar,
      slot,
      symbol,
      startX: e.clientX,
      startY: e.clientY,
      pointerId: e.pointerId,
      dragging: false,
      input: e.currentTarget,
    };
  };

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h3
          className={`text-sm font-semibold uppercase tracking-wider ${t.heading}`}
        >
          Chord chart
        </h3>
        <p className={`text-[11px] ${t.hint}`}>
          Type where it changes · drag to move · empty inherits
        </p>
      </div>

      {/* Beat header (per-bar): each beat shows its number then e · & · a, with
          a gap separating the four beats. */}
      <div className="grid grid-cols-[3rem_1fr] gap-2">
        <div />
        <div className={`flex gap-2 px-1 text-[10px] ${t.header}`}>
          {Array.from({ length: BEATS }, (_, beat) => (
            <div
              key={beat}
              className="grid flex-1 gap-1"
              style={{
                gridTemplateColumns: `repeat(${SLOTS_PER_BEAT}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: SLOTS_PER_BEAT }, (_, sub) => (
                <div key={sub} className="text-center">
                  {sub === 0 ? beat + 1 : SUBDIVISION_LABELS[sub]}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        {Array.from({ length: bars }, (_, b) => {
          const bar = b + 1;
          return (
            <div
              key={bar}
              className="grid grid-cols-[3rem_1fr] items-center gap-2"
            >
              <div className={`text-right text-xs font-medium ${t.barLabel}`}>
                Bar {bar}
              </div>
              {/* Four beat groups, each an inner grid of SLOTS_PER_BEAT cells,
                  with a gap between beats so the bar reads as 4 groups of 4. */}
              <div className="flex gap-2">
                {Array.from({ length: BEATS }, (_, beat) => (
                  <div
                    key={beat}
                    className="grid flex-1 gap-1"
                    style={{
                      gridTemplateColumns: `repeat(${SLOTS_PER_BEAT}, minmax(0, 1fr))`,
                    }}
                  >
                    {Array.from({ length: SLOTS_PER_BEAT }, (_, sub) => {
                      const slot = beat * SLOTS_PER_BEAT + sub;
                      const authored = cells.get(cellKey(bar, slot)) ?? '';
                      // The chord HOLDING into this cell (ghost placeholder) —
                      // what sounds here if the admin leaves it empty.
                      const holding =
                        slot === 0 && bar === 1
                          ? ''
                          : (chordAt(value, ...prevCell(bar, slot)) ?? '');
                      const isDownbeat = sub === 0; // beat's downbeat sixteenth
                      const isDropTarget =
                        drag != null &&
                        drag.overBar === bar &&
                        drag.overSlot === slot;
                      // The cell being dragged FROM fades while in flight.
                      const isDragSource =
                        drag != null &&
                        pendingRef.current?.bar === bar &&
                        pendingRef.current?.slot === slot &&
                        pendingRef.current?.dragging === true;
                      return (
                        <input
                          key={slot}
                          data-chord-cell=""
                          data-bar={bar}
                          data-slot={slot}
                          value={authored}
                          onChange={(e) => setCell(bar, slot, e.target.value)}
                          onPointerDown={(e) =>
                            onCellPointerDown(e, bar, slot, authored)
                          }
                          placeholder={holding}
                          aria-label={`Bar ${bar} slot ${slot} chord`}
                          className={`w-full rounded px-1 py-1 text-center text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400 ${
                            authored ? 'cursor-grab' : ''
                          } ${t.cellText} ${
                            isDropTarget
                              ? 'ring-2 ring-emerald-400'
                              : authored
                                ? t.filled
                                : isDownbeat
                                  ? t.downbeat
                                  : t.offbeat
                          } ${isDragSource ? 'opacity-40' : ''}`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating chip that follows the cursor while dragging a chord. */}
      {drag ? (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded bg-emerald-500 px-2 py-1 text-xs font-bold text-white shadow-lg"
          style={{ left: drag.x, top: drag.y }}
        >
          {drag.symbol}
        </div>
      ) : null}
    </div>
  );
}

/** The cell immediately before (bar, slot) — used to find the holding chord. */
function prevCell(bar: number, slot: number): [number, number] {
  if (slot > 0) return [bar, slot - 1];
  return [bar - 1, CHORD_SLOTS_PER_BAR - 1];
}
