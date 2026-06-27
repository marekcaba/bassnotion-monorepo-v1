'use client';

/**
 * Admin Scales — /admin/scales.
 *
 * Author the gym Scales tool's BLUEPRINTS: the box-position fret windows + the practice
 * rhythm, per scale type. No seed SQL — the engine ships sensible defaults (scaleBlueprints
 * .ts) and this page overrides them. Editing is VISUAL + numeric, two-way bound:
 *   • drag the box on the 2D fret strip (BoxShapeEditor) → updates the numbers,
 *   • or type startFretOffset / span → moves the box,
 *   • a live 3D ScaleFretboardWindow shows how the chosen box actually looks on the neck.
 * Save writes the whole scale's positions + rhythm via the admin endpoint.
 */

import React from 'react';
import type {
  ScaleBlueprintRecord,
  ScaleTypeId,
  ScalePositionShape,
  ScaleRhythmValue,
} from '@bassnotion/contracts';

import {
  useAdminScaleBlueprints,
  useUpdateScaleBlueprint,
} from '@/domains/admin/hooks/useAdminScaleBlueprints';
import { SCALE_BLUEPRINTS } from '@/domains/training-engine/equipment/scales/scaleBlueprints';
import { ScaleFretboardWindow } from '@/domains/training-engine/equipment/scales/ScaleFretboardWindow';
import { BoxShapeEditor } from './BoxShapeEditor';

const SCALE_TYPES: { value: ScaleTypeId; label: string }[] = [
  { value: 'major', label: 'Major' },
  { value: 'natural_minor', label: 'Minor' },
  { value: 'dorian', label: 'Dorian' },
  { value: 'mixolydian', label: 'Mixolydian' },
  { value: 'minor_pentatonic', label: 'Minor Pentatonic' },
  { value: 'major_pentatonic', label: 'Major Pentatonic' },
];

const RHYTHMS: { value: ScaleRhythmValue; label: string }[] = [
  { value: '4n', label: 'Quarters (4n)' },
  { value: '8n', label: 'Eighths (8n)' },
  { value: '16n', label: 'Sixteenths (16n)' },
];

/** The seed default for a scale (used until a server row exists). */
function seedFor(scaleType: ScaleTypeId): {
  positions: ScalePositionShape[];
  rhythm: ScaleRhythmValue;
} {
  return {
    positions: SCALE_BLUEPRINTS[scaleType].positions.map((p) => ({
      positionNumber: p.positionNumber,
      startFretOffset: p.startFretOffset,
      span: p.span,
    })),
    rhythm: '8n',
  };
}

export default function AdminScalesPage() {
  const { data: serverBlueprints, isLoading } = useAdminScaleBlueprints();
  const updateBlueprint = useUpdateScaleBlueprint();

  const [scaleType, setScaleType] = React.useState<ScaleTypeId>('major');
  const [positions, setPositions] = React.useState<ScalePositionShape[]>([]);
  const [rhythm, setRhythm] = React.useState<ScaleRhythmValue>('8n');
  const [selectedPos, setSelectedPos] = React.useState(1);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  // Load the draft for the chosen scale: server row if present, else the seed default.
  const loadScale = React.useCallback(
    (type: ScaleTypeId) => {
      const server = serverBlueprints?.find(
        (b: ScaleBlueprintRecord) => b.scaleType === type,
      );
      const src =
        server && server.positions.length > 0 ? server : seedFor(type);
      setPositions(src.positions);
      setRhythm(src.rhythm);
      setSelectedPos(1);
      setSaved(false);
      setError(null);
    },
    [serverBlueprints],
  );

  // Initial + on scale change (and once the server list arrives).
  React.useEffect(() => {
    loadScale(scaleType);
  }, [scaleType, loadScale]);

  const current = positions.find((p) => p.positionNumber === selectedPos);

  const setPos = (patch: Partial<ScalePositionShape>) => {
    setPositions((prev) =>
      prev.map((p) =>
        p.positionNumber === selectedPos ? { ...p, ...patch } : p,
      ),
    );
    setSaved(false);
  };

  const handleSave = async () => {
    setError(null);
    try {
      await updateBlueprint.mutateAsync({
        scaleType,
        patch: { positions, rhythm },
      });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save blueprint');
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-1 text-2xl font-bold">Scale Blueprints</h1>
      <p className="mb-6 text-sm text-gray-500">
        Author the box fingerings + practice rhythm for the gym Scales tool.
        Drag the box on the strip or type the numbers; the fretboard previews
        the selected position.
      </p>

      {/* Scale picker */}
      <div className="mb-6 flex flex-wrap gap-2">
        {SCALE_TYPES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setScaleType(s.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              scaleType === s.value
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <p className="text-sm text-gray-400">Loading saved blueprints…</p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* LEFT: position list + editor */}
        <div>
          {/* Position tabs */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            {positions.map((p) => (
              <button
                key={p.positionNumber}
                type="button"
                onClick={() => setSelectedPos(p.positionNumber)}
                className={`rounded px-3 py-1 text-xs font-semibold ${
                  selectedPos === p.positionNumber
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Pos {p.positionNumber}
              </button>
            ))}
          </div>

          {current && (
            <div className="space-y-4 rounded-lg border border-gray-200 p-4">
              {/* Draggable strip */}
              <div className="overflow-x-auto">
                <BoxShapeEditor
                  value={{
                    startFretOffset: current.startFretOffset,
                    span: current.span,
                  }}
                  onChange={(box) => setPos(box)}
                />
              </div>

              {/* Numeric inputs (two-way bound with the drag) */}
              <div className="flex gap-4">
                <label className="text-sm">
                  <span className="mb-1 block text-gray-500">
                    Start fret offset
                  </span>
                  <input
                    type="number"
                    value={current.startFretOffset}
                    onChange={(e) =>
                      setPos({ startFretOffset: Number(e.target.value) })
                    }
                    className="w-24 rounded border border-gray-300 px-2 py-1"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-gray-500">Span (frets)</span>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={current.span}
                    onChange={(e) => setPos({ span: Number(e.target.value) })}
                    className="w-24 rounded border border-gray-300 px-2 py-1"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Rhythm (per scale) */}
          <div className="mt-4">
            <label className="text-sm">
              <span className="mb-1 block text-gray-500">Practice rhythm</span>
              <select
                value={rhythm}
                onChange={(e) => {
                  setRhythm(e.target.value as ScaleRhythmValue);
                  setSaved(false);
                }}
                className="rounded border border-gray-300 px-2 py-1.5"
              >
                {RHYTHMS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Save */}
          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={updateBlueprint.isPending}
              className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {updateBlueprint.isPending ? 'Saving…' : 'Save blueprint'}
            </button>
            {saved && <span className="text-sm text-emerald-600">Saved ✓</span>}
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </div>

        {/* RIGHT: live 3D fretboard preview of the selected box */}
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Preview — {SCALE_TYPES.find((s) => s.value === scaleType)?.label},
            Pos {selectedPos}
          </div>
          <div className="rounded-lg bg-neutral-900 p-4">
            <ScaleFretboardWindow
              root="E"
              scaleType={scaleType}
              stringCount={4}
              maxFrets={14}
              isPlaying={false}
              tempo={90}
              view={selectedPos}
              // Preview the LIVE draft (unsaved drags) — the editor's positions, not the
              // in-code seed — so the fretboard updates as you drag.
              blueprintOverride={{ positions }}
            />
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Preview uses E root, 4-string. The shape is relative to the root, so
            it transposes to any key in the tool.
          </p>
        </div>
      </div>
    </div>
  );
}
