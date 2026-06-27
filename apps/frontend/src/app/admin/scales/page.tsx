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
import { buildNoteUniverse } from '@/domains/training-engine/equipment/scales/noteUniverse';
import { rootFromKey } from '@/domains/training-engine/equipment/scales/scaleGenerator';
import {
  buildScaleLadder,
  generatePatternDegrees,
  degreesToPositions,
  type ScalePatternRule,
} from '@/domains/training-engine/equipment/scales/scalePattern';
import { DURATIONS, type PathEvent } from './musicalTime';
import {
  keyInterval,
  transposeBySlide,
  transposeByNearest,
} from './transposePath';
import { ScaleFretboardWindow } from '@/domains/training-engine/equipment/scales/ScaleFretboardWindow';
import {
  // FretboardCalibrationPanel, // ← uncomment (+ the mount below) to re-tune position
  type FretboardCalibrationValues,
} from '@/domains/training-engine/equipment/scales/FretboardCalibrationPanel';
import { BoxShapeEditor } from './BoxShapeEditor';
import {
  PathEditor,
  emptyPathsByKey,
  KEYS,
  type PathsByKey,
  type PathKey,
} from './PathEditor';
import { isRest, type TimedNote } from './musicalTime';
import type { GymExercise } from '@bassnotion/contracts';
import {
  useAdminGymExercises,
  useCreateGymExercise,
  useUpdateGymExercise,
  useDeleteGymExercise,
} from '@/domains/admin/hooks/useAdminGymExercises';

// Seed for the admin fretboard-position panel. Tune these via the draggable panel, read
// the logged values, and bake them here (then we can hide the panel again).
const ADMIN_FRETBOARD_CAL: FretboardCalibrationValues = {
  sceneX: -288, // tuned by eye for the 1000px-wide admin board
  offsetX: 25,
  tiltAxisOffsetX: 448,
  contentScale: 1.57,
  contentScaleX: 0.878,
  leftFadeZone: 10,
  rightFadeZone: 10,
  viewportWidth: 1000,
  windowHeight: 305,
};

// The most frets a user can configure (BassSettingsCard offers 19–25), so paths must be
// authorable all the way up the neck.
const MAX_FRETS = 25;

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
  { value: '8t', label: 'Triplets (8t)' },
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
  // PATHS (the primary surface): the working EXERCISE — name/desc/neck/meter + 12 per-key
  // note sequences. Persisted via gym_exercises (kind 'scale_path'). `currentExerciseId`
  // is the saved row being edited, or null for an unsaved/new draft.
  const [currentExerciseId, setCurrentExerciseId] = React.useState<
    string | null
  >(null);
  const [paths, setPaths] = React.useState<PathsByKey>(() => emptyPathsByKey());

  // The exercise's NECK is part of the exercise (one exercise = one string count). The
  // picker reads + writes paths.stringCount, so switching neck = author for THAT neck.
  const previewStrings = paths.stringCount ?? 4;
  const hasAnyNotes = (p: PathsByKey) =>
    Object.values(p.byKey).some(
      (kp) => kp.ascending.length > 0 || (kp.descending?.length ?? 0) > 0,
    );
  const setPreviewStrings = (n: 4 | 5 | 6) => {
    if (n === previewStrings) return;
    // The fingerings were authored for the OLD neck. If notes exist, confirm — to make a
    // different-neck version, the right move is a NEW exercise (one exercise = one neck).
    if (
      hasAnyNotes(paths) &&
      !confirm(
        `This exercise was fingered for a ${previewStrings}-string neck. Switch it to ${n}-string? The note positions won't move — usually you'd make a separate ${n}-string exercise instead (hit “+ New”).`,
      )
    ) {
      return;
    }
    setPaths({ ...paths, stringCount: n });
  };
  const [pathKey, setPathKey] = React.useState<PathKey>('E');
  const [pathPreviewDir, setPathPreviewDir] = React.useState<
    'ascending' | 'descending'
  >('ascending');

  // Saved exercises for the Scales station (the list at the bottom).
  const { data: exercises } = useAdminGymExercises({
    equipment: 'scales',
    kind: 'scale_path',
  });
  const createExercise = useCreateGymExercise();
  const updateExercise = useUpdateGymExercise();
  const deleteExercise = useDeleteGymExercise();
  const [savingPath, setSavingPath] = React.useState(false);
  const [pathSaved, setPathSaved] = React.useState(false);
  const [pathError, setPathError] = React.useState<string | null>(null);

  // Start a fresh, unsaved exercise on the CURRENT neck (so "make a 5-string version" =
  // switch the picker to 5, hit New → a blank 5-string slate).
  const newExercise = () => {
    setCurrentExerciseId(null);
    setPaths(emptyPathsByKey(previewStrings));
    setPathKey('E');
    setPathSaved(false);
    setPathError(null);
  };

  // Load a saved exercise into the editor (its payload IS a PathsByKey).
  const loadExercise = (ex: GymExercise) => {
    setCurrentExerciseId(ex.id);
    const payload = ex.payload as PathsByKey;
    // Older exercises predate the stringCount/pathKind fields — default them.
    setPaths({
      ...payload,
      stringCount: payload.stringCount ?? 4,
      pathKind: payload.pathKind ?? 'path',
    });
    if (ex.scaleType) setScaleType(ex.scaleType as ScaleTypeId);
    setPathKey('E');
    setPathSaved(false);
    setPathError(null);
  };

  // Save (create or update). Draft-friendly — partial exercises save fine.
  const saveExercise = async () => {
    setPathError(null);
    setSavingPath(true);
    try {
      if (currentExerciseId) {
        await updateExercise.mutateAsync({
          id: currentExerciseId,
          patch: {
            name: paths.name,
            description: paths.description,
            scaleType,
            payload: paths,
          },
        });
      } else {
        const created = await createExercise.mutateAsync({
          kind: 'scale_path',
          equipment: 'scales',
          name: paths.name,
          description: paths.description,
          scaleType,
          payload: paths,
        });
        setCurrentExerciseId(created.id);
      }
      setPathSaved(true);
    } catch (e) {
      setPathError(e instanceof Error ? e.message : 'Failed to save exercise');
    } finally {
      setSavingPath(false);
    }
  };

  // Generate a fingered note seed from a PATTERN rule, for the active key + scale. The
  // engine produces the degree sequence + nearest-position fingering; we wrap each as an
  // eighth-note PathEvent. The admin then drag-refines the fingerings + saves.
  const generatePattern = React.useCallback(
    (rule: ScalePatternRule): PathEvent[] => {
      const root = rootFromKey(pathKey, 0); // path key string → sharp PitchClass
      const universe = buildNoteUniverse(
        { stringCount: previewStrings, maxFrets: MAX_FRETS },
        root,
        scaleType,
      );
      const ladder = buildScaleLadder(universe);
      const degrees = generatePatternDegrees(rule, ladder.length);
      const positions = degreesToPositions(degrees, ladder);
      return positions.map((p) => ({
        string: p.string,
        fret: p.fret,
        durationTicks: DURATIONS.eighth,
      }));
    },
    [pathKey, previewStrings, scaleType],
  );

  // POPULATE the other 11 keys from the CURRENT key's path, transposed by `method`.
  // 'slide' = +N frets same string (keeps the shape); 'nearest' = re-map to the new key's
  // nearest scale positions. Off-neck/off-scale notes are dropped. Overwrites all 11.
  const populateKeys = (method: 'slide' | 'nearest') => {
    const src = paths.byKey[pathKey];
    if (!src || src.ascending.length === 0) {
      alert(
        'Author the current key first — there is nothing to populate from.',
      );
      return;
    }
    if (
      !confirm(
        `Populate all other 11 keys from ${pathKey} (${method})? This OVERWRITES every other key.`,
      )
    ) {
      return;
    }
    const fromRoot = rootFromKey(pathKey, 0);
    const transposeSeq = (seq: PathEvent[], toKey: PathKey): PathEvent[] => {
      if (method === 'slide') {
        return transposeBySlide(seq, keyInterval(pathKey, toKey), MAX_FRETS);
      }
      return transposeByNearest(
        seq,
        fromRoot,
        rootFromKey(toKey, 0),
        scaleType,
        previewStrings,
        MAX_FRETS,
      );
    };

    const nextByKey = { ...paths.byKey };
    for (const k of KEYS) {
      if (k === pathKey) continue;
      nextByKey[k] = {
        ascending: transposeSeq(src.ascending, k),
        descending:
          src.descending === null ? null : transposeSeq(src.descending, k),
      };
    }
    setPaths({ ...paths, byKey: nextByKey });
  };

  // Populate a SINGLE key by dragging one key name onto another. `from` is the source
  // shape, `to` the drop target. Same transpose math as populateKeys, but one target.
  // Confirms only when the target already has notes (so dropping onto an empty key is
  // friction-free).
  const populateOneKey = (
    from: PathKey,
    to: PathKey,
    method: 'slide' | 'nearest',
  ) => {
    if (from === to) return;
    const src = paths.byKey[from];
    if (!src || src.ascending.length === 0) {
      alert(`Author ${from} first — there is nothing to copy from.`);
      return;
    }
    const target = paths.byKey[to];
    if (
      target &&
      target.ascending.length > 0 &&
      !confirm(`Overwrite ${to} with ${from}'s shape (${method})?`)
    ) {
      return;
    }
    const fromRoot = rootFromKey(from, 0);
    const transposeSeq = (seq: PathEvent[]): PathEvent[] =>
      method === 'slide'
        ? transposeBySlide(seq, keyInterval(from, to), MAX_FRETS)
        : transposeByNearest(
            seq,
            fromRoot,
            rootFromKey(to, 0),
            scaleType,
            previewStrings,
            MAX_FRETS,
          );

    setPaths({
      ...paths,
      byKey: {
        ...paths.byKey,
        [to]: {
          ascending: transposeSeq(src.ascending),
          descending:
            src.descending === null ? null : transposeSeq(src.descending),
        },
      },
    });
    // Jump to the freshly-populated key so the admin sees the result.
    setPathKey(to);
  };

  // The notes to LIGHT in the preview: the drawn path for the active key + direction.
  const litNotes = React.useMemo(() => {
    const kp = paths.byKey[pathKey];
    if (!kp) return [];
    const seq =
      pathPreviewDir === 'ascending'
        ? kp.ascending
        : (kp.descending ?? [...kp.ascending].reverse());
    // Rests don't light a fret — only the NOTES go to the preview.
    return seq
      .filter((e): e is TimedNote => !isRest(e))
      .map((n) => ({ string: n.string, fret: n.fret }));
  }, [paths, pathKey, pathPreviewDir]);
  // Admin-only fretboard position. Baked in ADMIN_FRETBOARD_CAL; drag-to-scroll pans the
  // neck by adjusting sceneX. Scoped to this page — the gym's baked values are untouched.
  const [cal, setCal] =
    React.useState<FretboardCalibrationValues>(ADMIN_FRETBOARD_CAL);

  // ── Drag-to-scroll the fretboard: dragging left/right pans sceneX through the neck. ──
  const scrollDrag = React.useRef<{
    startX: number;
    startSceneX: number;
  } | null>(null);
  const onScrollMove = React.useCallback((e: PointerEvent) => {
    const d = scrollDrag.current;
    if (!d) return;
    // Drag RIGHT → reveal frets to the LEFT (sceneX increases). 1px drag ≈ 1px pan.
    setCal((c) => ({ ...c, sceneX: d.startSceneX + (e.clientX - d.startX) }));
  }, []);
  const endScroll = React.useCallback(() => {
    scrollDrag.current = null;
    window.removeEventListener('pointermove', onScrollMove);
    window.removeEventListener('pointerup', endScroll);
  }, [onScrollMove]);
  const startScroll = (e: React.PointerEvent) => {
    scrollDrag.current = { startX: e.clientX, startSceneX: cal.sceneX };
    window.addEventListener('pointermove', onScrollMove);
    window.addEventListener('pointerup', endScroll);
  };
  React.useEffect(() => endScroll, [endScroll]);

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
    <div className="mx-auto max-w-6xl p-6">
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

      <div className="flex flex-col gap-8">
        {/* ROW 1 — live 3D fretboard preview of the selected box (full width). The
            canvas is ~710px wide + absolutely positioned, so we give it a fixed-width
            centered, clipped box to sit in instead of letting it overflow off-screen. */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Preview — {SCALE_TYPES.find((s) => s.value === scaleType)?.label}{' '}
              · key {pathKey} · {pathPreviewDir} ({litNotes.length} notes)
            </span>
            {/* String-count picker — preview the path on a 4-, 5- or 6-string neck. */}
            <div className="flex gap-1">
              {([4, 5, 6] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPreviewStrings(n)}
                  className={`rounded px-2.5 py-1 text-xs font-semibold ${
                    previewStrings === n
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {n}-string
                </button>
              ))}
            </div>
          </div>
          {/* Drag the board left/right to scroll through the neck. */}
          <div
            onPointerDown={startScroll}
            className="flex cursor-ew-resize touch-none select-none justify-center overflow-hidden rounded-lg bg-neutral-900 p-4"
          >
            <div style={{ width: cal.viewportWidth + 40, maxWidth: '100%' }}>
              <ScaleFretboardWindow
                root="E"
                scaleType={scaleType}
                stringCount={previewStrings}
                maxFrets={MAX_FRETS}
                isPlaying={false}
                tempo={90}
                // Light the DRAWN PATH (active key + direction). The path is the primary
                // authored thing; the box view is secondary (below).
                litNotes={litNotes}
                calibrationOverride={cal}
              />
            </div>
          </div>
          {/* DEV: draggable panel to position/size the fretboard (sceneX, L/R fade zones,
              viewportWidth, scale…) — values baked into ADMIN_FRETBOARD_CAL above. To
              re-tune: uncomment this + the import, set
              NEXT_PUBLIC_FRETBOARD_CALIBRATION=true, drag, Log, re-bake. */}
          {/* <FretboardCalibrationPanel values={cal} onChange={setCal} /> */}
          <p className="mt-2 text-xs text-gray-400">
            Lights the drawn path for the selected key + direction. Drag the
            board to scroll the neck.
          </p>
        </div>

        {/* ROW 2 (PRIMARY) — draw the MAJOR PATH: click notes in order on the grid, per
            key, ascending + descending. */}
        <div>
          <h2 className="mb-1 text-lg font-bold">Path</h2>
          <p className="mb-3 text-xs text-gray-500">
            Click notes on the grid in order to draw the run across the whole
            neck. Author each key separately; descend the same way or a
            different way.
          </p>
          <PathEditor
            stringCount={previewStrings}
            maxFrets={MAX_FRETS}
            paths={paths}
            onChange={setPaths}
            activeKey={pathKey}
            onKeyChange={setPathKey}
            noteLabelFor={(n) => (isRest(n) ? '' : String(n.fret))}
            onGenerate={generatePattern}
            onPopulate={populateKeys}
            onPopulateOne={populateOneKey}
          />
          {/* Preview direction toggle (which route the fretboard lights). */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-gray-400">Preview direction:</span>
            {(['ascending', 'descending'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setPathPreviewDir(d)}
                className={`rounded px-2.5 py-1 text-xs font-semibold capitalize ${
                  pathPreviewDir === d
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          {/* Save / New — draft-friendly: partial exercises save fine. */}
          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={saveExercise}
              disabled={savingPath}
              className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {savingPath
                ? 'Saving…'
                : currentExerciseId
                  ? 'Save exercise'
                  : 'Save as new exercise'}
            </button>
            <button
              type="button"
              onClick={newExercise}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100"
            >
              + New
            </button>
            {currentExerciseId && (
              <span className="text-xs text-gray-400">
                editing a saved exercise
              </span>
            )}
            {pathSaved && (
              <span className="text-sm text-emerald-600">Saved ✓</span>
            )}
            {pathError && (
              <span className="text-sm text-red-600">{pathError}</span>
            )}
          </div>
        </div>

        {/* ROW 3 (SECONDARY) — the legacy box-position blueprint editor. Collapsed by
            default now that PATHS are the primary authoring surface. */}
        <details className="rounded-lg border border-gray-200">
          <summary className="cursor-pointer px-4 py-2 text-sm font-semibold text-gray-600">
            Box positions (secondary)
          </summary>
          <div className="p-4">
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
                    <span className="mb-1 block text-gray-500">
                      Span (frets)
                    </span>
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
                <span className="mb-1 block text-gray-500">
                  Practice rhythm
                </span>
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
              {saved && (
                <span className="text-sm text-emerald-600">Saved ✓</span>
              )}
              {error && <span className="text-sm text-red-600">{error}</span>}
            </div>
          </div>
        </details>

        {/* ROW 4 — SAVED EXERCISES: click to load into the editor above. */}
        <div>
          <h2 className="mb-2 text-lg font-bold">Saved exercises</h2>
          {(!exercises || exercises.length === 0) && (
            <p className="text-sm text-gray-400">
              No saved exercises yet. Author a path above and hit “Save”.
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            {(exercises ?? []).map((ex: GymExercise) => (
              <div
                key={ex.id}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                  ex.id === currentExerciseId
                    ? 'border-emerald-400 bg-emerald-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <button
                  type="button"
                  onClick={() => loadExercise(ex)}
                  className="flex flex-1 flex-col items-start text-left"
                >
                  <span className="text-sm font-semibold text-gray-800">
                    {ex.name || '(untitled exercise)'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {ex.scaleType ?? '—'} ·{' '}
                    {(ex.payload as PathsByKey | null)?.pathKind ?? 'path'} ·{' '}
                    {(ex.payload as PathsByKey | null)?.stringCount ?? 4}-string
                    {ex.description ? ` · ${ex.description}` : ''}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete “${ex.name || 'untitled'}”?`)) {
                      void deleteExercise.mutateAsync(ex.id);
                      if (ex.id === currentExerciseId) newExercise();
                    }
                  }}
                  className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
