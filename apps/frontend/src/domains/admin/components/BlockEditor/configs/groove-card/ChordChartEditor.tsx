'use client';

/**
 * ChordChartEditor — admin grid for authoring a groove's chord chart.
 *
 * A grid of `lengthBars` rows × 8 eighth-note slots. The admin types a chord
 * symbol into any cell where the harmony CHANGES; empty cells inherit the
 * previous chord (shown ghosted so it's clear what's holding). The chart is
 * SPARSE — only filled cells are stored as { bar, slot, symbol } entries.
 *
 * Beat layout per bar: slots 0,2,4,6 are the downbeats (beats 1-4), 1,3,5,7
 * are the "ands". Downbeat cells are visually stronger.
 */

import { CHORD_SLOTS_PER_BAR, type ChordChart } from '@bassnotion/contracts';
import {
  chartCellMap,
  chordAt,
  cellKey,
} from '@/domains/widgets/components/YouTubeWidgetPage/blocks/groove-card/chordChart';

interface ChordChartEditorProps {
  lengthBars: number;
  value: ChordChart | undefined;
  onChange: (next: ChordChart) => void;
  /** Visual theme — 'light' for the standalone admin pages (light bg),
   *  'dark' for the block-editor surface (dark bg). Default 'light'. */
  theme?: 'light' | 'dark';
}

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

  // Set (or clear) the chord at one cell, keeping the chart sparse + sorted.
  const setCell = (bar: number, slot: number, raw: string) => {
    const symbol = raw.trim();
    const rest = (value ?? []).filter(
      (e) => !(e.bar === bar && e.slot === slot),
    );
    const next = symbol ? [...rest, { bar, slot, symbol }] : rest;
    next.sort(
      (a, b) => (a.bar - b.bar) * CHORD_SLOTS_PER_BAR + (a.slot - b.slot),
    );
    onChange(next);
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
          Type a chord where it changes · empty inherits
        </p>
      </div>

      {/* Beat header (per-bar): 1 · 2 · 3 · 4 with the "and" slots between. */}
      <div className="grid grid-cols-[3rem_1fr] gap-2">
        <div />
        <div className={`grid grid-cols-8 gap-1 px-1 text-[10px] ${t.header}`}>
          {Array.from({ length: CHORD_SLOTS_PER_BAR }, (_, s) => (
            <div key={s} className="text-center">
              {s % 2 === 0 ? s / 2 + 1 : '&'}
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
              <div className="grid grid-cols-8 gap-1">
                {Array.from({ length: CHORD_SLOTS_PER_BAR }, (_, slot) => {
                  const authored = cells.get(cellKey(bar, slot)) ?? '';
                  // The chord HOLDING into this cell (for the ghost placeholder),
                  // i.e. what sounds here if the admin leaves it empty.
                  const holding =
                    slot === 0 && bar === 1
                      ? ''
                      : (chordAt(value, ...prevCell(bar, slot)) ?? '');
                  const isDownbeat = slot % 2 === 0;
                  return (
                    <input
                      key={slot}
                      value={authored}
                      onChange={(e) => setCell(bar, slot, e.target.value)}
                      placeholder={holding}
                      aria-label={`Bar ${bar} slot ${slot} chord`}
                      className={`w-full rounded px-1 py-1 text-center text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400 ${t.cellText} ${
                        authored
                          ? t.filled
                          : isDownbeat
                            ? t.downbeat
                            : t.offbeat
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The cell immediately before (bar, slot) — used to find the holding chord. */
function prevCell(bar: number, slot: number): [number, number] {
  if (slot > 0) return [bar, slot - 1];
  return [bar - 1, CHORD_SLOTS_PER_BAR - 1];
}
