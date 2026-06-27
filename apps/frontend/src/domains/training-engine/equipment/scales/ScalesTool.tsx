'use client';

/**
 * ScalesTool — the gym "Scales" equipment station: an OPEN practice tool. Familiar
 * groove-card playback controls (the "grip"), but the main window is the 3D fretboard
 * showing the chosen scale, lit up in time as you play.
 *
 * Architecture (the EquipmentTool pattern, first instance): compose
 * useGrooveCardPlayback (transport) + GrooveCardShell (frame) + GrooveCardControls
 * (the grip) directly — NOT the whole GrooveCardBlockView (which drags in drill/caps/
 * lines&fills). The fretboard goes in the shell's `waveform` slot; a scale picker is
 * the skill-specific panel.
 *
 * The fretboard rides the SAME AtomicPlaybackClock the groove-card transport starts
 * (proven in the spike) — so pressing play lights the scale in time with the backing.
 *
 * Backing: for now the existing demo groove stems give us a real transport + clock.
 * (Chord/drone/metronome-only backing per scale is a later content decision — see
 * docs/GYM_EQUIPMENT_DESIGN.md §6.)
 */

import React from 'react';
import type { GrooveCardBlockConfig } from '@bassnotion/contracts';
import { GrooveCardShell } from '@/domains/widgets/components/YouTubeWidgetPage/blocks/groove-card/GrooveCardShell';
import {
  parsePitchClass,
  spellPitchClass,
} from '@/domains/widgets/components/YouTubeWidgetPage/blocks/groove-card/pitchClass';
import { ScaleFretboardWindow } from './ScaleFretboardWindow';
import { ScalesControls } from './ScalesControls';
import { positionCount } from './scaleBlueprints';
import { buildNoteUniverse, selectBox } from './noteUniverse';
import { buildScalePath, scalePathBeats } from './scalePath';
import {
  authoredPathToPlayable,
  authoredPathBeats,
} from './authoredPathToPlayable';
import { droneChordSymbol } from './droneChord';
import { useScaleSequencer } from './useScaleSequencer';
import {
  rootFromKey,
  type ScaleType,
  type ScaleView,
  type StringCount,
} from './scaleGenerator';
import { useGymExerciseLibrary } from '../../hooks/useGymExerciseLibrary';
import { useEquipmentListening } from '../listening/useEquipmentListening';

/** Tempo bounds for the scale sequencer (BPM). */
const MIN_BPM = 40;
const MAX_BPM = 220;

/** Scale types + labels, in cycle order for the scale stepper. */
const SCALE_TYPES: { value: ScaleType; label: string }[] = [
  { value: 'major', label: 'Major' },
  { value: 'natural_minor', label: 'Minor' },
  { value: 'dorian', label: 'Dorian' },
  { value: 'mixolydian', label: 'Mixolyd.' },
  { value: 'minor_pentatonic', label: 'Min Pent' },
  { value: 'major_pentatonic', label: 'Maj Pent' },
];

/** What kind of content the student is browsing — the library bucket (mirrors the admin
 *  PathKind). 'scale' shows "Auto" (generated) + authored scale runs; 'path' has no box
 *  position. */
type ExerciseKind = 'scale' | 'pattern' | 'path';

const KIND_TABS: { value: ExerciseKind; label: string }[] = [
  { value: 'scale', label: 'Runs' },
  { value: 'pattern', label: 'Patterns' },
  { value: 'path', label: 'Paths' },
];

/** The minimal shape we read out of an exercise's opaque payload (the admin's PathsByKey).
 *  Kept local so the tool doesn't depend on the admin page's types. */
interface PathsByKeyLite {
  name?: string;
  pathKind?: ExerciseKind;
  stringCount?: number;
  byKey?: Record<
    string,
    { ascending?: unknown[]; descending?: unknown[] | null } | undefined
  >;
}

export interface ScalesToolProps {
  /** The backing groove (stems/bpm/key). Drives the transport + the shared clock. */
  backingConfig: GrooveCardBlockConfig;
  /** The player's bass config (string count + neck length). */
  stringCount?: StringCount;
  maxFrets?: number;
  /** Resume the prewarmed AudioContext inside the play gesture (Safari). */
  onBeforePlay?: () => Promise<void> | void;
}

export function ScalesTool({
  backingConfig,
  stringCount = 4,
  maxFrets = 14,
  onBeforePlay,
}: ScalesToolProps) {
  const [scaleType, setScaleType] = React.useState<ScaleType>('major');
  const [view, setView] = React.useState<ScaleView>(1); // box position 1, or 'whole'
  const [bpm, setBpm] = React.useState(backingConfig.originalBpm || 90);
  const [masterVolume, setMasterVolume] = React.useState(0.8);

  // CONTENT picker: the kind tab (Runs/Patterns/Paths) + which exercise within it.
  // exerciseIdx === -1 (or no authored content) = "Auto" — the generated box scale.
  const [kind, setKind] = React.useState<ExerciseKind>('scale');
  const [exerciseIdx, setExerciseIdx] = React.useState(-1); // -1 = Auto

  // The KEY wheel is a continuous chromatic dial: a signed step counter that the wheel
  // advances ±1 per spin (the fretboard root + the played notes both derive from it,
  // both mod-12). No engine transpose anymore — we GENERATE the notes at the right pitch.
  const [keyStep, setKeyStep] = React.useState(0);

  // The scale ROOT follows the KEY wheel (the `< E >` control) — no separate root picker.
  const root = rootFromKey(backingConfig.originalKey, keyStep);

  // The current key NAME, flat-spelled. NOTE: spellPitchClass returns the pretty UNICODE
  // accidental (G♭, A♭ via U+266D) for the roller display, but the admin's `byKey` is keyed
  // by ASCII PathKeys (Gb, Ab). `asciiKey` converts ♭/♯ → b/# so the authored lookup hits.
  const keyBasePc = parsePitchClass(backingConfig.originalKey) ?? 0;
  const keyName = React.useCallback(
    (s: number) => spellPitchClass(keyBasePc + s, true),
    [keyBasePc],
  );
  const currentKeyName = keyName(keyStep);
  const currentKeyAscii = currentKeyName.replace('♭', 'b').replace('♯', '#');

  // ── The exercise LIBRARY: authored scale exercises for the gym Scales tool. Grouped by
  //    scale type + kind below; "Auto" (generated box scale) is always the first option. ──
  const { data: library = [] } = useGymExerciseLibrary('scales');

  // Authored exercises for the CURRENT scale type + kind tab, AND fingered for the player's
  // own neck. An exercise is fingered for ONE string count (a 5-string Major Scale doesn't
  // fit a 4-string player), so only show those matching the player's `stringCount`.
  const exercisesForTab = React.useMemo(
    () =>
      library
        .filter((ex) => (ex.scaleType ?? null) === scaleType)
        .filter((ex) => {
          const p = ex.payload as PathsByKeyLite | null;
          return (
            (p?.pathKind ?? 'path') === kind &&
            (p?.stringCount ?? 4) === stringCount
          );
        }),
    [library, scaleType, kind, stringCount],
  );

  // The currently-selected authored exercise (null = Auto / generated).
  const selectedExercise =
    exerciseIdx >= 0 ? (exercisesForTab[exerciseIdx] ?? null) : null;
  const usingAuthored = selectedExercise !== null;

  // ── The play SEQUENCE: either the GENERATED box scale (Auto) or the chosen AUTHORED
  //    exercise. Authored exercises are hand-fingered PER KEY, so we read the events for
  //    the exact current key (no transpose). If that key wasn't authored, fall back to the
  //    generated scale so the tool is never silent. Drone follows the key either way. ──
  const { path, loopBeats, droneSymbol } = React.useMemo(() => {
    const droneSymbol = droneChordSymbol(root, scaleType);

    if (selectedExercise) {
      const payload = selectedExercise.payload as PathsByKeyLite | null;
      const events = payload?.byKey?.[currentKeyAscii]?.ascending ?? [];
      if (events.length > 0) {
        const exStringCount = (payload?.stringCount ??
          stringCount) as StringCount;
        const p = authoredPathToPlayable(events, {
          maxFrets,
          rootPc: root,
          stringCount: exStringCount,
        });
        return { path: p, loopBeats: authoredPathBeats(events), droneSymbol };
      }
      // selected exercise has nothing authored for this key → fall through to Auto.
    }

    // Auto: generate the box (or whole-neck) scale at the chosen key/position.
    const fretboard = { stringCount, maxFrets };
    const universe = buildNoteUniverse(fretboard, root, scaleType);
    const notes =
      view === 'whole'
        ? universe
        : selectBox(universe, fretboard, root, scaleType, view);
    const p = buildScalePath(notes);
    return { path: p, loopBeats: scalePathBeats(p), droneSymbol };
  }, [
    selectedExercise,
    currentKeyAscii,
    root,
    scaleType,
    stringCount,
    maxFrets,
    view,
  ]);

  const sequencer = useScaleSequencer({
    path,
    loopBeats,
    bpm,
    droneSymbol,
    onBeforePlay,
  });

  // LISTENING (stubbed): every play is a take the platform hears. No-op until the
  // bass-coach engine is wired; the seam exists now so the tool is listening-ready.
  useEquipmentListening({
    station: 'scales',
    audioContext: sequencer.audioContext,
    isPlaying: sequencer.isPlaying,
    loopStartAudioTime: null,
  });

  const onPlayPause = React.useCallback(() => {
    if (sequencer.isPlaying) sequencer.stop();
    else void sequencer.play();
  }, [sequencer]);

  // Synthesize the CountdownState the controls expect from the sequencer's count-in.
  const countdownState = React.useMemo(
    () => ({
      isCountingDown: sequencer.countInBeat > 0,
      currentBeat: sequencer.countInBeat,
      totalBeats: 4,
    }),
    [sequencer.countInBeat],
  );

  // ── ROLLER specs: each control's prev/current/next labels + up/down handlers.
  //    UP selects the value shown ABOVE (prev), DOWN the value BELOW (next). ──

  // SCALE TYPE — cycles through the scale types (wraps). Changing scale resets the box
  // position AND the exercise selection (the old exercise belongs to the old scale).
  const scaleIdx = SCALE_TYPES.findIndex((s) => s.value === scaleType);
  const scaleAt = (d: number) =>
    SCALE_TYPES[(scaleIdx + d + SCALE_TYPES.length) % SCALE_TYPES.length]!;
  const setScaleBy = (d: number) => {
    setScaleType(scaleAt(d).value);
    setView(1);
    setExerciseIdx(-1);
  };
  const scaleRoller = {
    prev2Label: scaleAt(-2).label,
    prevLabel: scaleAt(-1).label,
    currentLabel: scaleAt(0).label,
    nextLabel: scaleAt(1).label,
    next2Label: scaleAt(2).label,
    onUp: () => setScaleBy(-1),
    onDown: () => setScaleBy(1),
  };

  // EXERCISE — which authored exercise (or "Auto"). The option list is the authored
  // exercises for the current scale type + kind tab, with "Auto" (generated) PREPENDED
  // only for the 'scale' kind (Auto is a box scale run). Other kinds list authored-only.
  const autoOption = kind === 'scale';
  const exerciseLabels = [
    ...(autoOption ? ['Auto'] : []),
    ...exercisesForTab.map((ex, i) => ex.name || `Exercise ${i + 1}`),
  ];
  const exerciseSlots = Math.max(exerciseLabels.length, 1);
  // exerciseIdx is -1 for Auto; map to a 0-based slot for the wheel.
  const exSlot = autoOption ? exerciseIdx + 1 : Math.max(exerciseIdx, 0);
  const exLabelAt = (slot: number) =>
    exerciseLabels.length === 0
      ? '—'
      : exerciseLabels[
          ((slot % exerciseSlots) + exerciseSlots) % exerciseSlots
        ]!;
  const setExBySlot = (slot: number) => {
    const wrapped = ((slot % exerciseSlots) + exerciseSlots) % exerciseSlots;
    setExerciseIdx(autoOption ? wrapped - 1 : wrapped);
  };
  const exerciseRoller = {
    prev2Label: exLabelAt(exSlot - 2),
    prevLabel: exLabelAt(exSlot - 1),
    currentLabel: exLabelAt(exSlot),
    nextLabel: exLabelAt(exSlot + 1),
    next2Label: exLabelAt(exSlot + 2),
    onUp: () => setExBySlot(exSlot - 1),
    onDown: () => setExBySlot(exSlot + 1),
  };

  // KIND tabs — Runs / Patterns / Paths. Switching kind resets the exercise selection
  // (Auto for 'scale', first authored for the others).
  const kindTabs = {
    tabs: KIND_TABS,
    active: kind,
    onSelect: (k: string) => {
      setKind(k as ExerciseKind);
      setExerciseIdx(k === 'scale' ? -1 : 0);
    },
  };

  // POSITION — 1..N then 'All' (wraps). Label "Pos N" / "All".
  const nPositions = positionCount(scaleType);
  const viewIdx = view === 'whole' ? nPositions : (view as number) - 1; // 0..N
  const viewSlots = nPositions + 1;
  const viewToLabel = (idx: number) =>
    idx === nPositions ? 'All' : `Pos ${idx + 1}`;
  const viewToValue = (idx: number): ScaleView =>
    idx === nPositions ? 'whole' : idx + 1;
  const setViewBy = (d: number) =>
    setView(viewToValue((viewIdx + d + viewSlots) % viewSlots));
  const positionRoller = {
    prev2Label: viewToLabel((viewIdx - 2 + viewSlots * 2) % viewSlots),
    prevLabel: viewToLabel((viewIdx - 1 + viewSlots) % viewSlots),
    currentLabel: viewToLabel(viewIdx),
    nextLabel: viewToLabel((viewIdx + 1) % viewSlots),
    next2Label: viewToLabel((viewIdx + 2) % viewSlots),
    onUp: () => setViewBy(-1),
    onDown: () => setViewBy(1),
  };

  // KEY — the wheel advances `keyStep` ±1 per spin (UP raises, sits above). It cycles
  // through all 12 pitch classes once per octave (no A#-twice). Spelled in FLATS
  // (Db/Eb/Gb/Ab/Bb); the root + the generated notes both follow it. `keyName` is defined
  // above the play memo (it also indexes the authored byKey).
  const stepKey = (d: number) => setKeyStep((k) => k + d);
  const keyRoller = {
    prev2Label: keyName(keyStep + 2),
    prevLabel: keyName(keyStep + 1),
    currentLabel: keyName(keyStep),
    nextLabel: keyName(keyStep - 1),
    next2Label: keyName(keyStep - 2),
    onUp: () => stepKey(1),
    onDown: () => stepKey(-1),
  };

  // TEMPO — the sequencer's BPM ±1 (clamped). UP faster (sits above), DOWN slower.
  const clampBpm = (b: number) => Math.max(MIN_BPM, Math.min(MAX_BPM, b));
  const tempoRoller = {
    prev2Label: `${clampBpm(bpm + 2)}`,
    prevLabel: `${clampBpm(bpm + 1)}`,
    currentLabel: `${bpm}`,
    nextLabel: `${clampBpm(bpm - 1)}`,
    next2Label: `${clampBpm(bpm - 2)}`,
    onUp: () => setBpm((b) => clampBpm(b + 1)),
    onDown: () => setBpm((b) => clampBpm(b - 1)),
  };

  // POSITION applies only to the GENERATED box scale (Auto). An authored exercise carries
  // its own fingering, and a full-neck PATH has no box position — so hide the roller for
  // any authored selection (and always for the 'path' kind).
  const showPosition = !usingAuthored && kind !== 'path';

  // The fretboard lights the AUTHORED path's exact notes (via litNotes) when an authored
  // exercise is selected; for Auto it falls back to generating the scale/box itself. The
  // play `path` already carries the resolved (string, fret) of each note.
  const litNotes = React.useMemo(
    () =>
      usingAuthored
        ? path.map((n) => ({ string: n.string, fret: n.fret }))
        : undefined,
    [usingAuthored, path],
  );

  return (
    <GrooveCardShell
      title="Scales"
      subtitle="Pick a scale, set your tempo, follow the lights."
      caption="Press play — the scale lights up in time. Loop it, change key, work the box."
      // Transparent CARD so the page's leather texture shows through behind the
      // floating fretboard. The controls bar keeps its own bg-black/40 (the solid
      // "grip"), so it stays visible against the texture. `floating` drops the
      // border + shadow so there's no outline rectangle over the leather.
      bg="transparent"
      floating
      // The station floats by itself — drop the "GROOVE CARD / Scales —…" title header.
      hideTitle
      isPlaying={sequencer.isPlaying}
      masterVolume={masterVolume}
      onMasterVolumeChange={setMasterVolume}
      // The fretboard replaces the waveform as the main window.
      waveform={
        <ScaleFretboardWindow
          root={root}
          scaleType={scaleType}
          stringCount={stringCount}
          maxFrets={maxFrets}
          isPlaying={sequencer.isPlaying}
          tempo={bpm}
          view={view}
          // Authored exercise → light its exact notes; Auto → generate the scale/box.
          litNotes={litNotes}
        />
      }
      // All controls live in the grip: Scale | Position | ▶ | Key | Tempo. No
      // footer panel needed.
      controls={
        <ScalesControls
          isPlaying={sequencer.isPlaying}
          isReady={sequencer.isReady}
          countdownState={countdownState}
          scale={scaleRoller}
          exercise={exerciseRoller}
          kindTabs={kindTabs}
          position={positionRoller}
          showPosition={showPosition}
          keyRoller={keyRoller}
          tempo={tempoRoller}
          onPlayPause={onPlayPause}
        />
      }
    />
  );
}
