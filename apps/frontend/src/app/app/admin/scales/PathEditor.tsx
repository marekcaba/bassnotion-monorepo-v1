'use client';

/**
 * PathEditor — author a "MAJOR PATH" as a rhythmically-NOTATED line: an ordered sequence
 * of TIMED notes (string + fret + duration) that spans the whole neck, in a chosen meter.
 *
 *   • Pick a DURATION from the toolbar (notation-pen), then click the grid to place a note
 *     of that value. Durations accumulate; a TIMELINE strip below shows the notes in
 *     musical time with barlines per measure + a running position; barline-crossing notes
 *     tie across.
 *   • TRULY 12 separate paths — one per key. Each authored independently.
 *   • TWO sequences — ascending + (optionally separate) descending.
 *
 * LOCAL STATE ONLY for now — no persistence. UX-first pass: feel the musical authoring;
 * the table/backend + tool playback come next.
 */

import React from 'react';
import { PathFretGrid } from './PathFretGrid';
import { RhythmTimeline } from './RhythmTimeline';
import {
  DURATIONS,
  DURATION_ORDER,
  COMMON_METERS,
  type DurationName,
  type PathEvent,
  type TimedNote,
  type TimeSignature,
} from './musicalTime';
import {
  PATTERN_PRESETS,
  type ScalePatternRule,
} from '@/domains/training-engine/equipment/scales/scalePattern';
// The canonical 12-key PathKey vocabulary, shared with the gig builder (pathKeys.ts). Aliased to
// KEYS so the internal uses below stay unchanged.
import { SCALE_KEYS_ASCII as KEYS, type PathKey } from './pathKeys';

// Re-exported so PathEditor's existing consumers (`import { PathKey } from './PathEditor'`) keep
// working after the constant moved to pathKeys.ts.
export type { PathKey };

/** One key's authored path: the ascending + (optionally separate) descending event lists
 *  (events = notes or rests). */
export interface KeyPath {
  ascending: PathEvent[];
  /** null = "descend the same way" (reverse of ascending). An array = a distinct route. */
  descending: PathEvent[] | null;
}

/** A pattern preset saved WITH the exercise (the admin's own named cells). */
export interface SavedPreset {
  label: string;
  cell: number[];
  stride: number;
}

/** What KIND of content this exercise is — the library groups by it, and the student
 *  tool uses it to decide which performance rollers apply (paths have no "position"). */
export type PathKind = 'scale' | 'pattern' | 'path';

export const PATH_KINDS: { value: PathKind; label: string; hint: string }[] = [
  {
    value: 'scale',
    label: 'Scale run',
    hint: 'a box-position run up/down the scale',
  },
  {
    value: 'pattern',
    label: 'Pattern',
    hint: 'a cell+stride figure (thirds, 1235…)',
  },
  {
    value: 'path',
    label: 'Path',
    hint: 'a route across the whole neck (no box)',
  },
];

export interface PathsByKey {
  /** Exercise name (e.g. "Major scale — 3 octaves") + a short description, shown to the
   *  student when they pick this exercise. */
  name: string;
  description: string;
  /** Library bucket + which performance controls apply. Defaults to 'path' (old exercises
   *  authored before this field existed were full-neck paths). */
  pathKind: PathKind;
  /** The CHORD TYPE this exercise belongs under (maj7, m9, 13♯11, …) — the gym groups by it.
   *  Set by the admin page on save; legacy content omits it (the gym derives from scaleType).
   *  Stored opaque here (a string) so the editor doesn't depend on the chord vocabulary. */
  chordType?: string;
  /** VARIANT GROUPING — the same logical exercise has many fingerings on bass. `variantGroup`
   *  is the exercise IDENTITY ("Two octaves"); `variantLabel` is this fingering ("v1", "Open
   *  strings"). The student tool groups by `variantGroup` and offers the labels within it.
   *  Empty `variantGroup` → the exercise stands alone (falls back to `name`). */
  variantGroup?: string;
  variantLabel?: string;
  /** The neck this exercise is FINGERED for. One exercise = one string count (a 4- vs
   *  5-string E major are separate exercises — the fingerings differ). */
  stringCount: 4 | 5 | 6;
  timeSignature: TimeSignature;
  byKey: Record<PathKey, KeyPath>;
  /** Author-saved pattern presets (named cell/stride), persisted with the exercise. */
  customPresets?: SavedPreset[];
  /** The KEY the gym dials in when this exercise loads (one of the authored PathKeys). Lets the
   *  admin start the student in the most natural key for this fingering. Unset → leave the gym's
   *  current key (the backing key). */
  defaultKey?: PathKey;
  /** The TEMPO (BPM) the gym dials in when this exercise loads. Unset → leave the current tempo. */
  defaultTempo?: number;
}

export function emptyPathsByKey(stringCount: 4 | 5 | 6 = 4): PathsByKey {
  const byKey = KEYS.reduce(
    (acc, k) => {
      acc[k] = { ascending: [], descending: null };
      return acc;
    },
    {} as Record<PathKey, KeyPath>,
  );
  return {
    name: '',
    description: '',
    pathKind: 'path',
    variantGroup: '',
    variantLabel: '',
    stringCount,
    timeSignature: { numerator: 4, denominator: 4 },
    byKey,
    customPresets: [],
  };
}

const sameSig = (a: TimeSignature, b: TimeSignature) =>
  a.numerator === b.numerator && a.denominator === b.denominator;

export function PathEditor({
  stringCount,
  maxFrets,
  paths,
  onChange,
  activeKey,
  onKeyChange,
  noteLabelFor,
  onGenerate,
  onPopulate,
  onPopulateOne,
  pathSourceOptions = [],
  sourcePathId = '',
  onSourcePathChange,
}: {
  stringCount: 4 | 5 | 6;
  maxFrets: number;
  paths: PathsByKey;
  onChange: (next: PathsByKey) => void;
  activeKey: PathKey;
  onKeyChange: (k: PathKey) => void;
  /** Short label for a note on the timeline (e.g. the fret). Only called for notes. */
  noteLabelFor: (n: PathEvent) => string;
  /** Generate a fingered note seed from a PATTERN rule (the page knows the scale/key).
   *  Returns eighth-note events the editor then replaces the current path with. */
  onGenerate: (rule: ScalePatternRule) => PathEvent[];
  /** Populate the other 11 keys from the current key, transposed by the chosen method. */
  onPopulate: (method: 'slide' | 'nearest') => void;
  /** Populate ONE key by dragging its name onto another. Drop = slide the shape there. */
  onPopulateOne: (
    from: PathKey,
    to: PathKey,
    method: 'slide' | 'nearest',
  ) => void;
  /** Saved PATH exercises a pattern can be constrained to (same scale/neck). When one is
   *  picked, Generate climbs only that path's notes. Only meaningful for the 'pattern' kind. */
  pathSourceOptions?: { id: string; label: string }[];
  /** The currently selected source path id ('' = whole neck). */
  sourcePathId?: string;
  /** Change the source path selection. */
  onSourcePathChange?: (id: string) => void;
}) {
  const [dir, setDir] = React.useState<'ascending' | 'descending'>('ascending');
  const [activeDuration, setActiveDuration] =
    React.useState<DurationName>('eighth');
  const [selected, setSelected] = React.useState<number | null>(null);
  // PATTERN authoring: the rule (cell + stride). The cell is edited as a comma string.
  const [cellText, setCellText] = React.useState('0, 1, 2, 0, 4');
  const [stride, setStride] = React.useState(1);
  // Visual playback (no audio): a tempo clock walks the path; `playIndex` is the event
  // currently sounding, highlighted on the grid + timeline so you SEE the exercise run.
  const [bpm, setBpm] = React.useState(90);
  const [playIndex, setPlayIndex] = React.useState<number | null>(null);
  const rafRef = React.useRef<number | null>(null);
  // Drag-to-populate: which key is being dragged, and which key the cursor is over.
  const dragKeyRef = React.useRef<PathKey | null>(null);
  const [dropHoverKey, setDropHoverKey] = React.useState<PathKey | null>(null);

  const keyPath = paths.byKey[activeKey];
  const separateDown = keyPath.descending !== null;
  const sig = paths.timeSignature;

  // The sequence being edited.
  const current: PathEvent[] =
    dir === 'ascending'
      ? keyPath.ascending
      : (keyPath.descending ?? [...keyPath.ascending].reverse());

  const setKeyPath = (patch: Partial<KeyPath>) =>
    onChange({
      ...paths,
      byKey: { ...paths.byKey, [activeKey]: { ...keyPath, ...patch } },
    });

  const writeCurrent = (next: PathEvent[]) => {
    if (dir === 'ascending') setKeyPath({ ascending: next });
    else setKeyPath({ descending: next });
  };

  // The base list to append to (the descending route forks from reversed-ascending).
  const baseList = () =>
    dir === 'ascending'
      ? keyPath.ascending
      : (keyPath.descending ?? [...keyPath.ascending].reverse());

  const append = (pos: { string: number; fret: number }) => {
    const n: PathEvent = { ...pos, durationTicks: DURATIONS[activeDuration] };
    const base = baseList();
    writeCurrent([...base, n]);
    setSelected(base.length);
  };

  // Add a REST of the active duration (silence — no grid click needed).
  const addRest = () => {
    const base = baseList();
    writeCurrent([
      ...base,
      { kind: 'rest', durationTicks: DURATIONS[activeDuration] },
    ]);
    setSelected(base.length);
  };

  // Step back: remove the LAST placed event. Press repeatedly to walk back through the
  // sequence to the start (a simple linear undo of additions).
  const stepBack = () => {
    if (current.length === 0) return;
    writeCurrent(current.slice(0, -1));
    setSelected(null);
  };

  const removeSelected = () => {
    if (selected === null) return;
    writeCurrent(current.filter((_, i) => i !== selected));
    setSelected(null);
  };

  // Move a NOTE (dragged on the grid) to a new string/fret. The grid indexes notes-only
  // (rests aren't shown there), so map the note-index back to the event index in `current`.
  const moveNote = (
    noteIdx: number,
    dest: { string: number; fret: number },
  ) => {
    let seen = -1;
    const next = current.map((e) => {
      if (e.kind === 'rest') return e;
      seen += 1;
      return seen === noteIdx ? { ...e, ...dest } : e;
    });
    writeCurrent(next);
  };

  // Remove a NOTE the admin clicked on the grid. Map its note-index → event index (skip
  // rests) and drop it.
  const removeNote = (noteIdx: number) => {
    let seen = -1;
    let eventIdx = -1;
    current.forEach((e, i) => {
      if (e.kind === 'rest') return;
      seen += 1;
      if (seen === noteIdx) eventIdx = i;
    });
    if (eventIdx === -1) return;
    writeCurrent(current.filter((_, i) => i !== eventIdx));
    setSelected(null);
  };

  const setSelectedDuration = (d: DurationName) => {
    if (selected === null) return;
    writeCurrent(
      current.map((n, i) =>
        i === selected ? { ...n, durationTicks: DURATIONS[d] } : n,
      ),
    );
  };

  const clear = () => writeCurrent([]);

  // Parse the cell text → number[] (ignore junk), build the rule, generate + REPLACE the
  // current sequence with the fingered seed. The admin then drag-refines.
  const parseCell = (): number[] =>
    cellText
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n));

  const applyPreset = (rule: ScalePatternRule) => {
    setCellText(rule.cell.join(', '));
    setStride(rule.stride);
  };

  const runGenerate = () => {
    const cell = parseCell();
    if (cell.length === 0) return;
    const events = onGenerate({ cell, stride });
    writeCurrent(events);
    setSelected(null);
  };

  // Save the current cell/stride as a named preset stored WITH the exercise.
  const saveCurrentPreset = () => {
    const cell = parseCell();
    if (cell.length === 0) return;
    const label = window.prompt(
      'Name this pattern preset:',
      `Cell ${cell.join(',')}`,
    );
    if (!label) return;
    const next: SavedPreset = { label, cell, stride };
    onChange({
      ...paths,
      customPresets: [...(paths.customPresets ?? []), next],
    });
  };

  // Built-in presets + the exercise's saved ones, in one dropdown.
  const allPresets: { id: string; label: string; rule: ScalePatternRule }[] = [
    ...PATTERN_PRESETS,
    ...(paths.customPresets ?? []).map((p, i) => ({
      id: `custom-${i}`,
      label: `★ ${p.label}`,
      rule: { cell: p.cell, stride: p.stride },
    })),
  ];

  // ── Visual playback (no audio) ──────────────────────────────────────────────
  // Walk the current sequence at `bpm`, lighting each event as its time arrives. A
  // quarter note = 480 ticks = 60/bpm seconds, so 1 tick = 60/(bpm·480) s.
  const stopPlay = React.useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setPlayIndex(null);
  }, []);

  const startPlay = () => {
    const seq = current;
    if (seq.length === 0) return;
    // Precompute each event's start time (seconds) from accumulated ticks.
    const secPerTick = 60 / (bpm * 480);
    const starts: number[] = [];
    let acc = 0;
    for (const e of seq) {
      starts.push(acc * secPerTick);
      acc += e.durationTicks;
    }
    const totalSec = acc * secPerTick;
    const t0 = performance.now();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const tick = () => {
      const elapsed = (performance.now() - t0) / 1000;
      if (elapsed >= totalSec) {
        stopPlay();
        return;
      }
      // The active event = the last one whose start time has passed.
      let idx = 0;
      for (let i = 0; i < starts.length; i++) {
        if (starts[i]! <= elapsed) idx = i;
        else break;
      }
      setPlayIndex(idx);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  React.useEffect(() => stopPlay, [stopPlay]);

  // The playing event mapped to a NOTE index (for the grid, which shows notes only).
  // null if not playing or the active event is a rest.
  const playingNoteIndex = React.useMemo(() => {
    if (playIndex === null) return null;
    let noteIdx = -1;
    for (let i = 0; i <= playIndex; i++) {
      if (current[i]?.kind !== 'rest') noteIdx += 1;
    }
    return current[playIndex]?.kind === 'rest' ? null : noteIdx;
  }, [playIndex, current]);

  const toggleSeparateDown = (separate: boolean) => {
    if (separate) {
      setKeyPath({ descending: [...keyPath.ascending].reverse() });
      setDir('descending');
    } else {
      setKeyPath({ descending: null });
    }
  };

  return (
    <div className="space-y-4">
      {/* Exercise name + description */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
            Exercise name
          </span>
          <input
            type="text"
            value={paths.name}
            onChange={(e) => onChange({ ...paths, name: e.target.value })}
            placeholder="e.g. Major scale — 2 octaves"
            className="w-full rounded border border-gray-300 px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
            Short description
          </span>
          <input
            type="text"
            value={paths.description}
            onChange={(e) =>
              onChange({ ...paths, description: e.target.value })
            }
            placeholder="What the student practices here"
            className="w-full rounded border border-gray-300 px-2 py-1.5"
          />
        </label>
      </div>

      {/* Variant grouping — same logical exercise, different fingering. Group = the exercise
          ("Two octaves"); Variant = this fingering ("v1", "Open strings"). The gym tool
          groups exercises by Group and offers the Variants within. Leave blank to stand alone. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
            Variant group{' '}
            <span className="font-normal normal-case text-gray-300">
              (the exercise — students pick this)
            </span>
          </span>
          <input
            type="text"
            value={paths.variantGroup ?? ''}
            onChange={(e) =>
              onChange({ ...paths, variantGroup: e.target.value })
            }
            placeholder="e.g. Two octaves"
            className="w-full rounded border border-gray-300 px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
            Variant label{' '}
            <span className="font-normal normal-case text-gray-300">
              (this fingering)
            </span>
          </span>
          <input
            type="text"
            value={paths.variantLabel ?? ''}
            onChange={(e) =>
              onChange({ ...paths, variantLabel: e.target.value })
            }
            placeholder="e.g. v1 / Open strings / Pinky"
            className="w-full rounded border border-gray-300 px-2 py-1.5"
          />
        </label>
      </div>

      {/* DEFAULTS the gym dials in when this exercise loads — the natural starting key + tempo
          for this fingering. Default key picks one of the 12 PathKeys; leave "— none —" to keep
          the gym's current key. Tempo is a plain BPM (blank = keep current). */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
            Default key{' '}
            <span className="font-normal normal-case text-gray-300">
              (dialed in on load)
            </span>
          </span>
          <select
            value={paths.defaultKey ?? ''}
            onChange={(e) =>
              onChange({
                ...paths,
                defaultKey: e.target.value
                  ? (e.target.value as PathKey)
                  : undefined,
              })
            }
            className="w-full rounded border border-gray-300 px-2 py-1.5"
          >
            <option value="">— none (keep current) —</option>
            {KEYS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
            Default tempo{' '}
            <span className="font-normal normal-case text-gray-300">
              (BPM, dialed in on load)
            </span>
          </span>
          <input
            type="number"
            min={40}
            max={220}
            value={paths.defaultTempo ?? ''}
            onChange={(e) =>
              onChange({
                ...paths,
                defaultTempo: e.target.value
                  ? Number(e.target.value)
                  : undefined,
              })
            }
            placeholder="e.g. 90 (blank = keep current)"
            className="w-full rounded border border-gray-300 px-2 py-1.5"
          />
        </label>
      </div>

      {/* Meter + KEY selector */}
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Time signature
          </div>
          <div className="flex gap-1">
            {COMMON_METERS.map((m) => (
              <button
                key={m.label}
                type="button"
                onClick={() => onChange({ ...paths, timeSignature: m.sig })}
                className={`rounded px-2.5 py-1 text-xs font-semibold ${
                  sameSig(sig, m.sig)
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        {/* KIND — the library bucket. Decides how the student finds this exercise and
            which performance controls apply (paths have no box "position"). */}
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Kind
          </div>
          <div className="flex gap-1">
            {PATH_KINDS.map((pk) => (
              <button
                key={pk.value}
                type="button"
                onClick={() => onChange({ ...paths, pathKind: pk.value })}
                title={pk.hint}
                className={`rounded px-2.5 py-1 text-xs font-semibold ${
                  paths.pathKind === pk.value
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {pk.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Key (each authored separately)
          </div>
          <div className="flex flex-wrap gap-1">
            {KEYS.map((k) => {
              const authored = paths.byKey[k].ascending.length > 0;
              const isDropHover = dropHoverKey === k;
              return (
                <button
                  key={k}
                  type="button"
                  // Drag an AUTHORED key's name onto another key to copy its shape there
                  // (slide-transposed). Empty keys have nothing to copy → not draggable.
                  draggable={authored}
                  onDragStart={(e) => {
                    dragKeyRef.current = k;
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onDragEnd={() => {
                    dragKeyRef.current = null;
                    setDropHoverKey(null);
                  }}
                  onDragOver={(e) => {
                    const from = dragKeyRef.current;
                    if (from && from !== k) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'copy';
                      if (dropHoverKey !== k) setDropHoverKey(k);
                    }
                  }}
                  onDragLeave={() => {
                    if (dropHoverKey === k) setDropHoverKey(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = dragKeyRef.current;
                    dragKeyRef.current = null;
                    setDropHoverKey(null);
                    if (from && from !== k) onPopulateOne(from, k, 'slide');
                  }}
                  onClick={() => {
                    onKeyChange(k);
                    setSelected(null);
                  }}
                  title={
                    authored
                      ? `${k} — drag onto another key to copy this shape there`
                      : `${k} — empty; drag an authored key here to fill it`
                  }
                  className={`rounded px-2.5 py-1 text-xs font-semibold ${
                    isDropHover
                      ? 'bg-amber-400 text-black ring-2 ring-amber-500'
                      : activeKey === k
                        ? 'bg-emerald-600 text-white'
                        : authored
                          ? 'cursor-grab bg-emerald-100 text-emerald-700 hover:bg-emerald-200 active:cursor-grabbing'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {k}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-[11px] text-gray-400">
            Tip: drag a key name onto another to copy that shape there
            (slide-transposed).
          </p>
          {/* Populate the other 11 keys from the current key (transposed). */}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[11px] text-gray-400">
              Populate all other keys from {activeKey}:
            </span>
            <button
              type="button"
              onClick={() => onPopulate('slide')}
              className="rounded border border-gray-300 px-2 py-1 text-[11px] font-semibold hover:bg-gray-100"
              title="Slide the same shape up/down the neck (+frets, same strings)"
            >
              Slide shape
            </button>
            <button
              type="button"
              onClick={() => onPopulate('nearest')}
              className="rounded border border-gray-300 px-2 py-1 text-[11px] font-semibold hover:bg-gray-100"
              title="Re-map to each key's nearest scale positions (changes fingering)"
            >
              Nearest positions
            </button>
          </div>
        </div>
      </div>

      {/* PATTERN toolbar — pick a preset or author a custom cell/stride, then GENERATE a
          fingered note seed across the neck (which you then drag-refine). */}
      <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-400">
          Generate from a pattern
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {/* SOURCE PATH — constrain the pattern to a saved PATH's notes (the known
              fingering) instead of the whole neck. Only shown for the 'pattern' kind. */}
          {paths.pathKind === 'pattern' && onSourcePathChange && (
            <label className="text-xs">
              <span className="mb-1 block text-gray-500">On path</span>
              <select
                value={sourcePathId}
                onChange={(e) => onSourcePathChange(e.target.value)}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                title="Generate the pattern over a known authored path's notes (not the whole neck)"
              >
                <option value="">Whole neck</option>
                {pathSourceOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="text-xs">
            <span className="mb-1 block text-gray-500">Preset</span>
            <select
              onChange={(e) => {
                const p = allPresets.find((x) => x.id === e.target.value);
                if (p) applyPreset(p.rule);
              }}
              className="rounded border border-gray-300 px-2 py-1.5 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                Choose…
              </option>
              {allPresets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="mb-1 block text-gray-500">
              Cell (scale-step offsets)
            </span>
            <input
              type="text"
              value={cellText}
              onChange={(e) => setCellText(e.target.value)}
              placeholder="0, 1, 2, 0, 4"
              className="w-44 rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs">
            <span className="mb-1 block text-gray-500">Stride</span>
            <input
              type="number"
              value={stride}
              onChange={(e) => setStride(Number(e.target.value) || 1)}
              className="w-16 rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={runGenerate}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            title="Replace the current sequence with the generated pattern"
          >
            Generate ⟳
          </button>
          <button
            type="button"
            onClick={saveCurrentPreset}
            className="rounded-lg border border-indigo-300 px-3 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-100"
            title="Save this cell + stride as a named preset (stored with the exercise)"
          >
            ★ Save preset
          </button>
        </div>
        <p className="mt-2 text-[11px] text-gray-400">
          Offsets are SCALE STEPS from each cell anchor — NEGATIVES allowed
          (e.g. 0,1,-3,5 = anchor, +1, 3 down, then the 6th). Stride = how many
          degrees the cell slides each repeat. Generate fills the {dir} path
          with eighth notes; drag the dots to set the real fingerings. “Save
          preset” keeps your cell with this exercise.
          {paths.pathKind === 'pattern' && (
            <>
              {' '}
              <span className="text-indigo-400">On path</span> climbs the pattern
              through only that saved path’s notes (the known fingering) for this
              key, instead of the whole neck — author the path first, then build
              the pattern over it.
            </>
          )}
        </p>
      </div>

      {/* Duration toolbar (the notation pen) */}
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Note duration (click a note below to apply, or place new notes)
        </div>
        <div className="flex flex-wrap gap-1">
          {DURATION_ORDER.map((d) => (
            <button
              key={d.name}
              type="button"
              onClick={() => {
                setActiveDuration(d.name);
                setSelectedDuration(d.name);
              }}
              className={`rounded px-2 py-1 text-xs font-medium ${
                activeDuration === d.name
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={d.label}
            >
              {d.label}
            </button>
          ))}
          {/* REST — inserts a rest of the active duration (silence, no grid click). */}
          <button
            type="button"
            onClick={addRest}
            className="ml-2 rounded bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-200"
            title="Insert a rest of the active duration"
          >
            𝄽 Rest
          </button>
        </div>
      </div>

      {/* Direction + separate-down toggle */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-1">
          {(['ascending', 'descending'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => {
                setDir(d);
                setSelected(null);
              }}
              className={`rounded px-3 py-1 text-xs font-semibold capitalize ${
                dir === d
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={separateDown}
            onChange={(e) => toggleSeparateDown(e.target.checked)}
          />
          Descend a different way
        </label>
      </div>

      {/* The clickable PITCH grid — places a note of the active duration. Rests have no
          pitch, so the grid shows only the NOTE events (numbered in note order). */}
      <PathFretGrid
        stringCount={stringCount}
        maxFrets={maxFrets}
        path={current.filter((e): e is TimedNote => e.kind !== 'rest')}
        onAppend={append}
        onRemove={removeNote}
        onMove={moveNote}
        playingIndex={playingNoteIndex}
      />

      {/* The rhythmic TIMELINE — notes in musical time, barlines, ties + a visual PLAY
          (no audio) that lights each note in time so you see the exercise progress. */}
      <div>
        <div className="mb-1 flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Timeline ({dir})
          </span>
          <button
            type="button"
            onClick={playIndex === null ? startPlay : stopPlay}
            disabled={current.length === 0}
            className={`rounded px-3 py-1 text-xs font-semibold text-white disabled:opacity-40 ${
              playIndex === null
                ? 'bg-emerald-600 hover:bg-emerald-500'
                : 'bg-red-500 hover:bg-red-400'
            }`}
            title="Visual playthrough (no audio) — lights each note in time"
          >
            {playIndex === null ? '▶ Play' : '■ Stop'}
          </button>
          <label className="flex items-center gap-1 text-xs text-gray-500">
            tempo
            <input
              type="number"
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value) || 90)}
              className="w-16 rounded border border-gray-300 px-1.5 py-0.5"
            />
            bpm
          </label>
        </div>
        <RhythmTimeline
          notes={current}
          sig={sig}
          selectedIndex={selected}
          onSelect={setSelected}
          noteLabel={noteLabelFor}
          playingIndex={playIndex}
        />
      </div>

      {/* Sequence controls */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500">
          {current.length} note{current.length === 1 ? '' : 's'} ·{' '}
          {selected !== null
            ? `note ${selected + 1} selected`
            : 'none selected'}
        </span>
        {/* Step back — undo the last placed note, repeatedly back to the start. */}
        <button
          type="button"
          onClick={stepBack}
          disabled={current.length === 0}
          className="rounded border border-gray-300 px-2.5 py-1 text-xs hover:bg-gray-100 disabled:opacity-40"
          title="Step back — remove the last added note"
        >
          ↶ Step back
        </button>
        <button
          type="button"
          onClick={removeSelected}
          disabled={selected === null}
          className="rounded border border-gray-300 px-2.5 py-1 text-xs hover:bg-gray-100 disabled:opacity-40"
        >
          Remove selected
        </button>
        <button
          type="button"
          onClick={clear}
          disabled={current.length === 0}
          className="rounded border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

export { KEYS };
