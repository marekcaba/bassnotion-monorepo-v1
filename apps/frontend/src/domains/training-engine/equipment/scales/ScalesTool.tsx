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
import { buildScalePath, scalePathBeats, BEATS_PER_STEP } from './scalePath';
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
import {
  useEquipmentListening,
  type EquipmentScoreResult,
} from '../listening/useEquipmentListening';
import type { Gig } from '@bassnotion/contracts';
import { submitTake } from '../../api/training-engine.api';

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
  variantGroup?: string;
  variantLabel?: string;
  stringCount?: number;
  byKey?: Record<
    string,
    { ascending?: unknown[]; descending?: unknown[] | null } | undefined
  >;
  /** Admin-set defaults the gym dials in when this exercise loads (see PathsByKey). */
  defaultKey?: string;
  defaultTempo?: number;
}

/**
 * ASSIGNMENT mode — when present, the tool is a LOCKED gig deliverable, not open practice. The
 * exercise + key + tempo + loop count are dialed in from the gig and the student can't change them
 * (it's an assignment); record mode is forced on; the result banner offers Submit + Retake (the
 * replace-on-resubmit flow). Absent → the normal open practice tool.
 */
export interface ScalesAssignment {
  /** The gig being performed (drives the Submit target + the banner title). */
  gig: Gig;
  /** A stable id for the backing groove driving the transport/clock — stored in the take's
   *  reconstruction recipe so the history player can rebuild the exact backing. */
  backingId?: string;
}

export interface ScalesToolProps {
  /** The backing groove (stems/bpm/key). Drives the transport + the shared clock. */
  backingConfig: GrooveCardBlockConfig;
  /** The player's bass config (string count + neck length). */
  stringCount?: StringCount;
  maxFrets?: number;
  /** Resume the prewarmed AudioContext inside the play gesture (Safari). */
  onBeforePlay?: () => Promise<void> | void;
  /** When set, the tool runs as a LOCKED gig deliverable (see ScalesAssignment). */
  assignment?: ScalesAssignment;
}

export function ScalesTool({
  backingConfig,
  stringCount = 4,
  maxFrets = 14,
  onBeforePlay,
  assignment,
}: ScalesToolProps) {
  // In assignment mode the controls are LOCKED to the gig's presets (the student can't change
  // exercise/key/tempo/loops/record-mode — it's a deliverable).
  const locked = !!assignment;
  const [scaleType, setScaleType] = React.useState<ScaleType>('major');
  const [view, setView] = React.useState<ScaleView>(1); // box position 1, or 'whole'
  // Scales start at a practice-friendly tempo, NOT the backing groove's BPM (which is fast).
  const [bpm, setBpm] = React.useState(70);
  const [masterVolume, setMasterVolume] = React.useState(0.8);
  // RECORD MODE: the ▶ play button becomes a ● record button. In record mode the scale-note
  // bass is MUTED (only count-in + click + backing drone play) so the student plays the scale
  // themselves and the mic captures only THEM — every take is auto-armed, graded, and saved.
  // Record mode starts OFF — even in assignment mode. The student should be able to play the gig
  // through normally first (hear it, follow the lights), THEN arm Rec and hit record. Locked mode
  // keeps the Rec toggle visible (so they can arm it); only the loop count + content are fixed.
  const [recordMode, setRecordMode] = React.useState(false);
  // How many full loops a record-mode take captures before auto-stopping (1-8). Assignment mode
  // takes this from the gig (the admin-set deliverable length); open play defaults to 2.
  const [recordLoops, setRecordLoops] = React.useState(
    assignment?.gig.recordLoops ?? 2,
  );
  // The most recent graded take (record mode) — shown as a small result banner. Audio + grade are
  // held in memory; they're only PERSISTED if the student SUBMITS the take against an assignment.
  const [lastTake, setLastTake] = React.useState<EquipmentScoreResult | null>(
    null,
  );
  // The gig the student must deliver (if any) — inherited via their enrolled goal. When present
  // + the student has a graded take with audio, a "Submit this take" affordance appears. Open
  // gym play stores nothing.
  // In assignment mode the gig is GIVEN (the perform route passed it). In open practice we DON'T
  // surface a submit affordance — submission only happens on the dedicated /gigs perform page.
  const activeGig = assignment?.gig ?? null;
  const [submitState, setSubmitState] = React.useState<
    'idle' | 'submitting' | 'done' | 'error'
  >('idle');


  // CONTENT picker: the kind tab (Runs/Patterns/Paths), which exercise GROUP within it, and
  // which fingering VARIANT within the group. groupIdx === -1 = "Auto" (generated box scale).
  const [kind, setKind] = React.useState<ExerciseKind>('scale');
  const [groupIdx, setGroupIdx] = React.useState(-1); // -1 = Auto
  const [variantIdx, setVariantIdx] = React.useState(0); // fingering within the group

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

  // Submit the current graded take's audio + stats against the active gig. (Defined here,
  // after currentKeyAscii, so it can capture the live key.)
  const onSubmitTake = React.useCallback(async () => {
    if (!lastTake?.audioBlob || !activeGig) return;
    setSubmitState('submitting');
    try {
      await submitTake(lastTake.audioBlob, {
        gigId: activeGig.id,
        station: 'scales',
        exerciseName: activeGig.exerciseName ?? undefined,
        scaleKey: currentKeyAscii,
        tempoBpm: bpm,
        timingScore: lastTake.hitGrade?.hitPercent,
        pitchScore: lastTake.pitchGrade?.pitchPercent,
        jitterMs: lastTake.jitterMs,
        offsetMs: lastTake.offsetMs,
        noteCount: lastTake.noteCount,
        // RECONSTRUCTION RECIPE — what to load to replay this take in context (no backing audio
        // stored). The gig is the source of truth for the locked exercise/key/tempo/loops; view
        // (box position) + stringCount come from the live tool; backingId identifies the groove.
        playbackContext: {
          station: 'scales',
          exerciseId: activeGig.exerciseId ?? null,
          scaleKey: currentKeyAscii,
          tempoBpm: bpm,
          recordLoops,
          position: view,
          stringCount,
          backingId: assignment?.backingId ?? null,
        },
      });
      setSubmitState('done');
    } catch {
      setSubmitState('error');
    }
  }, [
    lastTake,
    activeGig,
    currentKeyAscii,
    bpm,
    recordLoops,
    view,
    stringCount,
    assignment?.backingId,
  ]);

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

  // GROUP the tab's exercises by their variantGroup (the exercise identity). Exercises with
  // no group stand alone (keyed by their own name). Each group → an ordered list of its
  // fingering variants. The Exercise roller picks a GROUP; the Variant roller picks within it.
  const exerciseGroups = React.useMemo(() => {
    const order: string[] = [];
    const byGroup = new Map<
      string,
      { label: string; variants: typeof exercisesForTab }
    >();
    for (const ex of exercisesForTab) {
      const p = ex.payload as PathsByKeyLite | null;
      const group = p?.variantGroup?.trim() || p?.name?.trim() || 'Exercise';
      if (!byGroup.has(group)) {
        byGroup.set(group, { label: group, variants: [] });
        order.push(group);
      }
      byGroup.get(group)!.variants.push(ex);
    }
    return order.map((g) => byGroup.get(g)!);
  }, [exercisesForTab]);

  // ── ASSIGNMENT: dial the LOCKED gig presets into the tool's state. Two-phase, by state
  //    convergence: (1) once the library has the gig's exercise, set the scale type + KIND tab
  //    + KEY (these change which exerciseGroups exist); (2) once exerciseGroups recompute and
  //    contain the target, select its group + variant. The effect re-runs as state converges, so
  //    both phases land. Keyed so it only drives toward the target, never fights manual input
  //    (there is none — the controls are locked). Tempo is set here too (clamped). ──
  const assignedExerciseId = assignment?.gig.exerciseId ?? null;
  React.useEffect(() => {
    if (!assignment || !assignedExerciseId) return;

    const target = library.find((ex) => ex.id === assignedExerciseId);
    if (!target) return; // library not loaded yet (or exercise removed) — try again on next data.

    const payload = target.payload as PathsByKeyLite | null;
    const targetScale = (target.scaleType ?? 'major') as ScaleType;
    const targetKind = (payload?.pathKind ?? 'path') as ExerciseKind;

    // Phase 1: scale type + kind + key + tempo + loops.
    if (scaleType !== targetScale) setScaleType(targetScale);
    if (kind !== targetKind) setKind(targetKind);

    // KEY — the gig's scaleKey is an ASCII PathKey; convert to a keyStep offset from the backing
    // key's pc (same math the open tool uses for an exercise's defaultKey).
    if (assignment.gig.scaleKey) {
      const targetPc = parsePitchClass(assignment.gig.scaleKey);
      if (targetPc != null) {
        const step = (((targetPc - keyBasePc) % 12) + 12) % 12;
        setKeyStep((cur) => (cur === step ? cur : step));
      }
    }
    if (typeof assignment.gig.tempoBpm === 'number') {
      const t = Math.max(MIN_BPM, Math.min(MAX_BPM, assignment.gig.tempoBpm));
      setBpm((cur) => (cur === t ? cur : t));
    }

    // Phase 2: find the exercise's group + variant within the (now matching) groups. Only runs
    // once scaleType/kind have settled so exerciseGroups holds the target.
    if (scaleType === targetScale && kind === targetKind) {
      for (let gi = 0; gi < exerciseGroups.length; gi++) {
        const vi = exerciseGroups[gi]!.variants.findIndex(
          (ex) => ex.id === assignedExerciseId,
        );
        if (vi >= 0) {
          if (groupIdx !== gi) setGroupIdx(gi);
          if (variantIdx !== vi) setVariantIdx(vi);
          break;
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignment, assignedExerciseId, library, exerciseGroups, scaleType, kind, keyBasePc]);

  // The selected group + the selected fingering variant within it (null = Auto / generated).
  const selectedGroup =
    groupIdx >= 0 ? (exerciseGroups[groupIdx] ?? null) : null;
  const selectedExercise = selectedGroup
    ? (selectedGroup.variants[
        Math.min(variantIdx, selectedGroup.variants.length - 1)
      ] ?? null)
    : null;
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

  // ── APPLY THE EXERCISE'S ADMIN DEFAULTS ON LOAD — when a new authored exercise is selected,
  //    dial in its default KEY and default TEMPO (if the admin set them). Keyed on the exercise id
  //    so it fires once per load, not on every re-render (and never while playing/tuning by hand).
  //    defaultKey is an ASCII PathKey; convert to a keyStep offset from the backing key's pc.
  //
  //    SKIPPED in assignment (locked) mode: the GIG's key/tempo are authoritative there, not the
  //    exercise's own defaults. Without this guard, selecting the gig's exercise would re-trigger
  //    this effect and OVERWRITE the gig presets with the exercise defaults (the load-with-wrong-
  //    key/tempo bug). The assignment effect above owns key/tempo when locked.
  const selectedExerciseId = selectedExercise?.id ?? null;
  React.useEffect(() => {
    if (locked) return;
    if (!selectedExercise) return;
    const payload = selectedExercise.payload as PathsByKeyLite | null;
    if (!payload) return;

    if (payload.defaultKey) {
      const targetPc = parsePitchClass(payload.defaultKey);
      if (targetPc != null) {
        setKeyStep(((targetPc - keyBasePc) % 12 + 12) % 12);
      }
    }
    if (typeof payload.defaultTempo === 'number') {
      setBpm(Math.max(MIN_BPM, Math.min(MAX_BPM, payload.defaultTempo)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExerciseId, keyBasePc, locked]);

  const sequencer = useScaleSequencer({
    path,
    loopBeats,
    bpm,
    droneSymbol,
    onBeforePlay,
    // Record mode mutes the scale-note bass so the student plays it (clean mic capture).
    silentBass: recordMode,
    // In record mode the take auto-stops after `recordLoops` loops; free play loops forever.
    maxLoops: recordMode ? recordLoops : 0,
  });

  // LISTENING: in RECORD mode every play is a graded take. The seam captures the player's bass,
  // scores their onsets against the exercise grid (anchored at loopStart), and grades the timing.
  // Outside record mode it's inert. Flag-gated by NEXT_PUBLIC_EQUIPMENT_LISTENING.
  useEquipmentListening({
    station: 'scales',
    audioContext: sequencer.audioContext,
    isPlaying: recordMode && sequencer.isPlaying,
    loopStartAudioTime: sequencer.getLoopStartAudioTime(),
    bpm,
    loopBeats,
    // The answer key for the PITCH grade: the exercise's expected notes (midi + startBeat).
    // midi + WHEN (startBeat) + HOW LONG (durBeats, from the chart's rhythm) — the duration sizes
    // the pitch-analysis window to each note (a quarter gets a long read, a 16th a short one).
    expectedNotes: path.map((n) => ({
      midi: n.midi,
      startBeat: n.startBeat,
      durBeats: BEATS_PER_STEP[n.duration],
    })),
    // How many loops the take ran — sets the TARGET note count (notes × loops). Skipped notes
    // count as misses so the score is out of what the exercise demanded, not what was played.
    loops: recordLoops,
    onTakeScored: setLastTake,
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
    setGroupIdx(-1);
    setVariantIdx(0);
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

  // A bounded (non-wrapping) roller spec from a label list + a current slot + a clamped
  // setter. Blank neighbors past the ends; disabled when ≤1 option (so it can't empty-spin).
  const boundedRoller = (
    labels: string[],
    slot: number,
    setSlot: (s: number) => void,
  ) => {
    const at = (s: number) => (s >= 0 && s < labels.length ? labels[s]! : '');
    const go = (s: number) => {
      if (s >= 0 && s < labels.length) setSlot(s);
    };
    return {
      prev2Label: at(slot - 2),
      prevLabel: at(slot - 1),
      currentLabel: at(slot) || '—',
      nextLabel: at(slot + 1),
      next2Label: at(slot + 2),
      onUp: () => go(slot - 1),
      onDown: () => go(slot + 1),
      disabled: labels.length <= 1,
    };
  };

  // EXERCISE roller — picks the GROUP (the exercise identity). "Auto" (generated box scale)
  // is PREPENDED only for the 'scale' kind. Selecting a group resets the variant to the first.
  const autoOption = kind === 'scale';
  const groupLabels = [
    ...(autoOption ? ['Auto'] : []),
    ...exerciseGroups.map((g) => g.label),
  ];
  const groupSlot = Math.min(
    Math.max(autoOption ? groupIdx + 1 : groupIdx, 0),
    Math.max(groupLabels.length - 1, 0),
  );
  const exerciseRoller = boundedRoller(groupLabels, groupSlot, (slot) => {
    setGroupIdx(autoOption ? slot - 1 : slot);
    setVariantIdx(0);
  });

  // VARIANT roller — picks the fingering WITHIN the selected group (v1/v2/…). Only shown
  // when an authored group with ≥1 variant is selected; for Auto it's hidden.
  const variantLabels = selectedGroup
    ? selectedGroup.variants.map((ex, i) => {
        const p = ex.payload as PathsByKeyLite | null;
        return p?.variantLabel?.trim() || `v${i + 1}`;
      })
    : [];
  const variantSlot = Math.min(
    Math.max(variantIdx, 0),
    Math.max(variantLabels.length - 1, 0),
  );
  const variantRoller = boundedRoller(
    variantLabels,
    variantSlot,
    setVariantIdx,
  );
  // Show the variant roller only when the group has more than one fingering to choose.
  const showVariant = !!selectedGroup && variantLabels.length > 1;

  // KIND tabs — Runs / Patterns / Paths. Switching kind resets the selection (Auto for
  // 'scale', first group for the others) + the variant.
  const kindTabs = {
    tabs: KIND_TABS,
    active: kind,
    onSelect: (k: string) => {
      setKind(k as ExerciseKind);
      setGroupIdx(k === 'scale' ? -1 : 0);
      setVariantIdx(0);
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

  // The PLAYHEAD sequence — the notes being played, in order, with their beat positions
  // (from the play `path`, which is the source of truth for BOTH Auto + authored). The
  // canvas glides the orange sphere along this using the sequencer's real clock.
  const playheadNotes = React.useMemo(
    () =>
      path.map((n) => ({
        string: n.string,
        fret: n.fret,
        startBeat: n.startBeat,
      })),
    [path],
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
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
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
            // The real playback clock for the gliding playhead (the gym doesn't run the
            // AtomicPlaybackClock the canvas's own active-note system reads).
            getPlaybackBeat={sequencer.getPlaybackBeat}
            // The played note sequence (string/fret + startBeat) the sphere glides along.
            playheadNotes={playheadNotes}
            // The loop length in beats — lets the sphere glide ACROSS the loop seam (last note
            // → first note of the next cycle) instead of snapping.
            loopBeats={loopBeats}
          />
          {/* RECORD-mode result: the graded take (or the refusal reason). Minimal banner; the
              full history list is a later phase. */}
          {recordMode && lastTake && !sequencer.isPlaying && (
            <TakeResultBanner
              take={lastTake}
              gig={activeGig}
              submitState={submitState}
              onSubmit={onSubmitTake}
              // Retake (assignment mode only) — discard this take's grade so the student can play
              // again. The next ● record makes a fresh take; Submit then replaces server-side.
              onRetake={
                locked
                  ? () => {
                      setLastTake(null);
                      setSubmitState('idle');
                    }
                  : undefined
              }
            />
          )}
        </div>
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
          variant={variantRoller}
          showVariant={showVariant}
          kindTabs={kindTabs}
          position={positionRoller}
          showPosition={showPosition}
          keyRoller={keyRoller}
          tempo={tempoRoller}
          onPlayPause={onPlayPause}
          recordMode={recordMode}
          onToggleRecordMode={setRecordMode}
          recordLoops={recordLoops}
          onRecordLoopsChange={setRecordLoops}
          locked={locked}
        />
      }
    />
  );
}

/** Minimal record-mode result banner: the timing grade + 2 stats, or the refusal reason when the
 *  trust gates couldn't grade the take. Pinned top-center over the fretboard. When the student has
 *  an active GIG and a gradeable take, a "Submit this take" button appears — that is the ONLY path
 *  that persists audio (open gym play stores nothing). */
function TakeResultBanner({
  take,
  gig,
  submitState,
  onSubmit,
  onRetake,
}: {
  take: EquipmentScoreResult;
  gig: Gig | null;
  submitState: 'idle' | 'submitting' | 'done' | 'error';
  onSubmit: () => void;
  /** Assignment mode only — discard this take and play again. Absent in open practice. */
  onRetake?: () => void;
}) {
  const refused = take.grade == null;
  const color = refused ? '#e0b24a' : take.grade!.color;
  // Submit is offered only when: there's a gig, the take graded (not refused), and we have
  // its audio to upload.
  const canSubmit = !!gig && !refused && !!take.audioBlob;
  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
        padding: '8px 16px',
        borderRadius: 12,
        background: 'rgba(14,16,20,0.92)',
        border: `1px solid ${color}`,
        color: '#e6e8ec',
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'center',
        pointerEvents: 'none',
        maxWidth: 360,
      }}
    >
      {refused ? (
        <div style={{ fontSize: 13, color }}>{take.refusedReason}</div>
      ) : (
        <>
          {/* TWO HEADLINES side by side — TIMING (in-time %) and PITCH (right-notes %). */}
          <div
            style={{ display: 'flex', gap: 24, justifyContent: 'center' }}
          >
            <div>
              <div
                style={{ fontSize: 26, fontWeight: 800, color: '#e6e8ec' }}
              >
                {take.hitGrade!.hitPercent}
              </div>
              <div style={{ fontSize: 11, color: '#9aa3ad' }}>
                timing · {take.hitGrade!.hits}/{take.hitGrade!.total} in time
              </div>
            </div>
            {take.pitchGrade && take.pitchGrade.judged > 0 && (
              <div>
                <div
                  style={{ fontSize: 26, fontWeight: 800, color: '#e6e8ec' }}
                >
                  {take.pitchGrade.pitchPercent}
                </div>
                <div style={{ fontSize: 11, color: '#9aa3ad' }}>
                  pitch · {take.pitchGrade.correct}/{take.pitchGrade.judged}{' '}
                  right
                  {take.pitchGrade.unverified > 0
                    ? ` (${take.pitchGrade.unverified} unread)`
                    : ''}
                </div>
              </div>
            )}
          </div>
          {/* POCKET — the deeper feel grade (the musician's metric). */}
          <div style={{ fontSize: 12, fontWeight: 600, color, marginTop: 6 }}>
            {take.grade!.label} · pocket {take.grade!.score}
          </div>
          <div style={{ fontSize: 11, color: '#9aa3ad', marginTop: 1 }}>
            jitter {Math.round(take.jitterMs)}ms · offset{' '}
            {take.offsetMs >= 0 ? '+' : ''}
            {Math.round(take.offsetMs)}ms
            {take.pitchGrade && take.pitchGrade.unverified > 0
              ? ` · ${take.pitchGrade.unverified} pitch unread`
              : ''}
          </div>
        </>
      )}
      {(canSubmit || onRetake) && (
        <div style={{ marginTop: 10, pointerEvents: 'auto' }}>
          {canSubmit && (
            <div style={{ fontSize: 11, color: '#9aa3ad', marginBottom: 4 }}>
              Gig: {gig!.title}
            </div>
          )}
          {submitState === 'done' ? (
            <div style={{ fontSize: 13, fontWeight: 700, color: '#6ad08c' }}>
              ✓ Submitted
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'center',
              }}
            >
              {/* RETAKE — discard + play again (assignment mode). */}
              {onRetake && (
                <button
                  type="button"
                  disabled={submitState === 'submitting'}
                  onClick={onRetake}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    border: '1px solid #4b5563',
                    background: 'transparent',
                    color: '#e6e8ec',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor:
                      submitState === 'submitting' ? 'not-allowed' : 'pointer',
                  }}
                >
                  Retake
                </button>
              )}
              {canSubmit && (
                <button
                  type="button"
                  disabled={submitState === 'submitting'}
                  onClick={onSubmit}
                  style={{
                    padding: '6px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: submitState === 'error' ? '#e0604a' : '#16a34a',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: submitState === 'submitting' ? 'wait' : 'pointer',
                  }}
                >
                  {submitState === 'submitting'
                    ? 'Submitting…'
                    : submitState === 'error'
                      ? 'Failed — retry'
                      : 'Submit this take'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
