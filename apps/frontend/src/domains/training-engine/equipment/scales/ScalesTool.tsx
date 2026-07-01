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
import {
  Circle,
  ChevronLeft,
  ChevronRight,
  Metronome,
  AudioLines,
  Guitar,
} from 'lucide-react';
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
  buildUpDownEvents,
} from './authoredPathToPlayable';
import {
  CHORD_TYPES,
  chordDroneSymbol,
  parentScaleFor,
  chordTypeForScale,
  type ChordType,
} from './chordType';
import { droneStemUrl } from './droneStem';
import { useScaleSequencer } from './useScaleSequencer';
// Dynamic Loop — the SAME control every groove card uses (Repeat-icon dial + ping-pong/
// travel engine), driven here off the scale's key stepper instead of the groove's pitch
// engine. The dial is purely UI; useDynamicLoop owns the cycle math.
import { GrooveCardDynamicLoopDial } from '@/domains/widgets/components/YouTubeWidgetPage/blocks/groove-card/GrooveCardDynamicLoopDial';
import {
  useDynamicLoop,
  type DynamicLoopConfig,
} from '@/domains/widgets/components/YouTubeWidgetPage/blocks/groove-card/useDynamicLoop';
import { useTimeTranspose } from './useTimeTranspose';
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
import type { Gig, GymToolContext } from '@bassnotion/contracts';
import { submitTake } from '../../api/training-engine.api';

/** Tempo bounds for the scale sequencer (BPM). */
const MIN_BPM = 40;
const MAX_BPM = 220;

/** Convert a target key's pitch class (0-11) to a `keyStep` offset from the backing groove's
 *  original key's pitch class — the signed-then-wrapped distance the key wheel uses. Both the
 *  assignment-preset effect and the exercise-defaults effect dial a key in via this. */
function pcToKeyStep(targetPc: number, keyBasePc: number): number {
  return (((targetPc - keyBasePc) % 12) + 12) % 12;
}


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
  /** The CHORD TYPE this exercise belongs under (maj7, m9, 13♯11, …). New content stores it;
   *  legacy content (authored before chord types) omits it → we derive from scaleType. */
  chordType?: ChordType;
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

export interface ScalesToolProps {
  /** The backing groove (stems/bpm/key). Drives the transport + the shared clock. */
  backingConfig: GrooveCardBlockConfig;
  /** The player's bass config (string count + neck length). */
  stringCount?: StringCount;
  maxFrets?: number;
  /** Resume the prewarmed AudioContext inside the play gesture (Safari). */
  onBeforePlay?: () => Promise<void> | void;
  /** The mount CONTEXT (gig / rep / gym) — the shared gym-tool contract. Resolves lock, result
   *  sink, and the exercise preset. Defaults to open GYM when omitted. See GymToolContext. */
  context?: GymToolContext;
  /** REP: fired when the tool auto-stops after the preset's loop count (the brick is "done by
   *  loops"). The rep brick uses this to complete + advance. When set, the tool auto-stops after
   *  `preset.recordLoops` loops on every play (not just record mode). */
  onLoopsComplete?: () => void;
}

/** The default OPEN-GYM context — open practice, nothing locked, nothing stored. */
const GYM_CONTEXT: GymToolContext = {
  kind: 'gym',
  locked: false,
  resultSink: { kind: 'none' },
};

export function ScalesTool({
  backingConfig,
  stringCount = 4,
  maxFrets = 14,
  onBeforePlay,
  context,
  onLoopsComplete,
}: ScalesToolProps) {
  // The single context the whole tool reads from (defaults to open gym). All axis behavior
  // below derives from `ctx` — the shared 3-context (gig/rep/gym) gym-tool contract.
  const ctx: GymToolContext = context ?? GYM_CONTEXT;
  // AXIS 1 — locked (gig + rep lock the pickers; gym is open). Caller-computed, read here.
  const locked = ctx.locked;
  // AXIS 2 — the submit sink (gig). Non-null only when a take can be submitted against a gig.
  const submitSink = ctx.resultSink.kind === 'submit' ? ctx.resultSink : null;
  // The tool is organised around CHORD SOUNDS: the student picks a chord type (Maj7, Dom7,
  // Min9, 13♯11, …) + key — the tonal centre they play over. The practiced fretboard NOTES
  // are that chord's PARENT SCALE, and the drone IS the chord. scaleType is DERIVED from the
  // chord type (note generation + box selection + exercise filtering still key off it).
  const [chordType, setChordType] = React.useState<ChordType>('maj7');
  const scaleType: ScaleType = parentScaleFor(chordType);
  const [view, setView] = React.useState<ScaleView>(1); // box position 1, or 'whole'
  // Scales start at a practice-friendly tempo, NOT the backing groove's BPM (which is fast).
  const [bpm, setBpm] = React.useState(70);
  // PER-TRACK volumes (0..1), each wired to its own gain in the sequencer: the metronome
  // click, the bass sampler (the scale notes), and the band/drone track. The volume popover
  // shows all three; there is no single "master" for the scales tool (the shell's master
  // slider is suppressed via hideMasterSlider — it controlled nothing here).
  const [metronomeVolume, setMetronomeVolume] = React.useState(0.8);
  const [bassVolume, setBassVolume] = React.useState(0.85);
  // The volume popover's open state is OWNED here so it stays mutually exclusive with the Rec
  // loop stepper (they share the same spot under the icon cluster): while the volume sliders
  // are open, the Rec loop counter is hidden, and vice versa.
  const [volumeOpen, setVolumeOpen] = React.useState(false);
  // RECORD MODE: the ▶ play button becomes a ● record button. In record mode the scale-note
  // bass is MUTED (only count-in + click + backing drone play) so the student plays the scale
  // themselves and the mic captures only THEM — every take is auto-armed, graded, and saved.
  // Record mode starts OFF — even in assignment mode. The student should be able to play the gig
  // through normally first (hear it, follow the lights), THEN arm Rec and hit record. Locked mode
  // keeps the Rec toggle visible (so they can arm it); only the loop count + content are fixed.
  const [recordMode, setRecordMode] = React.useState(false);
  // How many full loops a record-mode take captures before auto-stopping (1-8). A locked context
  // (gig/rep) takes this from the preset (the admin-set deliverable length); open gym defaults to 2.
  const [recordLoops, setRecordLoops] = React.useState(
    ctx.preset?.recordLoops ?? 2,
  );
  // The most recent graded take (record mode) — shown as a small result banner. Audio + grade are
  // held in memory; they're only PERSISTED if the student SUBMITS the take against an assignment.
  const [lastTake, setLastTake] = React.useState<EquipmentScoreResult | null>(
    null,
  );
  // The gig the student must deliver (if any) — from the submit sink (gig context). When present
  // + the student has a graded take with audio, a "Submit this take" affordance appears. Rep + open
  // gym play surface no submit (rep records completion elsewhere; gym stores nothing).
  const activeGig = submitSink?.gig ?? null;
  const [submitState, setSubmitState] = React.useState<
    'idle' | 'submitting' | 'done' | 'error'
  >('idle');


  // CONTENT picker: the kind tab (Runs/Patterns/Paths), which exercise GROUP within it, and
  // which fingering VARIANT within the group. groupIdx === -1 = "Auto" (generated box scale).
  // Default to Paths on load (gigs with an assignment override this via the auto-load effect).
  const [kind, setKind] = React.useState<ExerciseKind>('path');
  const [groupIdx, setGroupIdx] = React.useState(-1); // -1 = Auto
  const [variantIdx, setVariantIdx] = React.useState(0); // fingering within the group

  // The KEY wheel is a continuous chromatic dial: a signed step counter that the wheel
  // advances ±1 per spin (the fretboard root + the played notes both derive from it,
  // both mod-12). No engine transpose anymore — we GENERATE the notes at the right pitch.
  const [keyStep, setKeyStep] = React.useState(0);

  // DYNAMIC LOOP — the groove-card dial's per-card config + engage flag. Ping-pong/travel,
  // a relative transpose interval, and every-N-loops. The cycle math (useDynamicLoop below)
  // drives the SCALE'S key stepper, so each auto key-change also crossfades the drone via
  // the existing droneSymbol watch. Off by default; gated off in locked (gig) mode.
  const [dynamicLoopConfig, setDynamicLoopConfig] =
    React.useState<DynamicLoopConfig>({
      intervalSemitones: 5, // a 4th up — a musical default
      everyN: 4,
      mode: 'ping-pong',
    });
  const [dynamicLoopEngaged, setDynamicLoopEngaged] = React.useState(false);

  // DRONE — the sustained chord. Its AUDIBILITY is the Band volume slider (no engage toggle);
  // the drone is always "on" so the slider alone controls it.
  const [droneVolume, setDroneVolume] = React.useState(0.8);

  // FREESTYLE (time-free) mode — toggled by the Drone icon. ON: the drone holds and you jam
  // over it; metronome + bass + exercise are silent (the sequencer starts ONLY the drone).
  // The time-based Dynamic Loop transposes the chord on a wall-clock timer. OFF: back to
  // normal exercise mode (select an exercise, press Play → count-in → it starts).
  const [freestyle, setFreestyle] = React.useState(false);

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
        // backingLayers = what was actually SOUNDING under the take: the metronome click (always)
        // + the drone stem (the replayer 404-skips it if the file isn't there, exactly like the
        // live sequencer does). A future station emits different layers — the replayer is generic.
        playbackContext: {
          station: 'scales',
          exerciseId: activeGig.exerciseId ?? null,
          scaleKey: currentKeyAscii,
          tempoBpm: bpm,
          recordLoops,
          position: view,
          stringCount,
          backingId: submitSink?.backingId ?? null,
          // The take's beat 0 sits `preRollSec` into the clip (the mic armed at the count-in
          // start). The replayer phases the click grid + starts the drone there.
          preRollSec: lastTake.preRollSec ?? null,
          backingLayers: [
            // Metronome click, rebuilt by params (4/4, one bar count-in — matches the sequencer).
            // The replayer uses the platform's real click SAMPLES (Click_Low2/High2.mp3).
            {
              kind: 'click',
              tempoBpm: bpm,
              beatsPerBar: 4,
              countInBeats: 4,
            },
            // The scale's drone pad (its .ogg). Replay tries this URL; missing → dry, like record.
            {
              kind: 'stem',
              url: droneStemUrl(chordDroneSymbol(root, chordType)),
              loop: true,
              label: 'drone',
            },
          ],
        },
      });
      setSubmitState('done');
      // Collapse back to the /gigs list (which now shows this gig checkmarked). Brief delay so
      // the "✓ Submitted" confirmation is visible before the page navigates.
      if (submitSink?.onSubmitted) {
        setTimeout(() => submitSink.onSubmitted?.(), 700);
      }
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
    root,
    scaleType,
    submitSink,
  ]);

  // ── The exercise LIBRARY: authored scale exercises for the gym Scales tool. Grouped by
  //    scale type + kind below; "Auto" (generated box scale) is always the first option. ──
  const { data: library = [] } = useGymExerciseLibrary('scales');

  // An exercise's CHORD TYPE — from its payload if authored with one, else derived from the
  // legacy scaleType (back-compat). This is what the tool groups exercises by now.
  const chordTypeOf = React.useCallback(
    (ex: { payload?: unknown; scaleType?: string | null }): ChordType => {
      const p = ex.payload as PathsByKeyLite | null;
      if (p?.chordType) return p.chordType;
      return chordTypeForScale((ex.scaleType ?? 'major') as ScaleType);
    },
    [],
  );

  // Authored exercises for the CURRENT chord type + kind tab, AND fingered for the player's
  // own neck. An exercise is fingered for ONE string count (a 5-string Major Scale doesn't
  // fit a 4-string player), so only show those matching the player's `stringCount`.
  const exercisesForTab = React.useMemo(
    () =>
      library
        .filter((ex) => chordTypeOf(ex) === chordType)
        .filter((ex) => {
          const p = ex.payload as PathsByKeyLite | null;
          return (
            (p?.pathKind ?? 'path') === kind &&
            (p?.stringCount ?? 4) === stringCount
          );
        }),
    [library, chordType, kind, stringCount, chordTypeOf],
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
  // Drives any LOCKED context's preset (gig OR rep) into the pickers. Keyed on the preset's
  // exerciseId; fires only when there's a preset to honour (open gym has none).
  const preset = ctx.preset ?? null;
  const presetExerciseId = preset?.exerciseId ?? null;
  React.useEffect(() => {
    if (!preset || !presetExerciseId) return;

    const target = library.find((ex) => ex.id === presetExerciseId);
    if (!target) return; // library not loaded yet (or exercise removed) — try again on next data.

    const payload = target.payload as PathsByKeyLite | null;
    const targetChord = chordTypeOf(target);
    const targetKind = (payload?.pathKind ?? 'path') as ExerciseKind;

    // Phase 1: chord type + kind + key + tempo + loops.
    if (chordType !== targetChord) setChordType(targetChord);
    if (kind !== targetKind) setKind(targetKind);

    // KEY — the preset's scaleKey is an ASCII PathKey; convert to a keyStep offset from the backing
    // key's pc (same math the open tool uses for an exercise's defaultKey).
    if (preset.scaleKey) {
      const targetPc = parsePitchClass(preset.scaleKey);
      if (targetPc != null) {
        const step = pcToKeyStep(targetPc, keyBasePc);
        setKeyStep((cur) => (cur === step ? cur : step));
      }
    }
    if (typeof preset.tempoBpm === 'number') {
      const t = Math.max(MIN_BPM, Math.min(MAX_BPM, preset.tempoBpm));
      setBpm((cur) => (cur === t ? cur : t));
    }

    // Phase 2: find the exercise's group + variant within the (now matching) groups. Only runs
    // once chordType/kind have settled so exerciseGroups holds the target.
    if (chordType === targetChord && kind === targetKind) {
      for (let gi = 0; gi < exerciseGroups.length; gi++) {
        const vi = exerciseGroups[gi]!.variants.findIndex(
          (ex) => ex.id === presetExerciseId,
        );
        if (vi >= 0) {
          if (groupIdx !== gi) setGroupIdx(gi);
          if (variantIdx !== vi) setVariantIdx(vi);
          break;
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, presetExerciseId, library, exerciseGroups, chordType, kind, keyBasePc]);

  // The selected group + the selected fingering variant within it (null = Auto / generated).
  // Kinds WITHOUT an Auto option (path/pattern) have no "null" state — groupIdx -1 means "first
  // group", matching the picker's groupSlot clamp. Only the 'scale' kind maps -1 → Auto (null).
  const resolvedGroupIdx =
    kind === 'scale' ? groupIdx : Math.max(groupIdx, 0);
  const selectedGroup =
    resolvedGroupIdx >= 0 ? (exerciseGroups[resolvedGroupIdx] ?? null) : null;
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
    const droneSymbol = chordDroneSymbol(root, chordType);

    // FREESTYLE: no exercise at all — empty path means no lit notes, no playhead sphere, and
    // no camera follow. Only the drone (droneSymbol) sounds.
    if (freestyle) {
      return { path: buildScalePath([]), loopBeats: 0, droneSymbol };
    }

    if (selectedExercise) {
      const payload = selectedExercise.payload as PathsByKeyLite | null;
      const keyEntry = payload?.byKey?.[currentKeyAscii];
      const ascending = keyEntry?.ascending ?? [];
      if (ascending.length > 0) {
        const exStringCount = (payload?.stringCount ??
          stringCount) as StringCount;
        // PATHS run all the way UP to the top note and back DOWN, so a loop is a full
        // up-and-down (not a snap from the last note to the first). Descent = the authored
        // `descending` array if present, else the reversed ascending (top note once). Runs +
        // patterns keep their authored events as-is (patterns already descend; box runs loop
        // as authored).
        const events =
          (payload?.pathKind ?? 'path') === 'path'
            ? buildUpDownEvents(ascending, keyEntry?.descending)
            : ascending;
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
    freestyle,
    selectedExercise,
    currentKeyAscii,
    root,
    scaleType,
    chordType,
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
        setKeyStep(pcToKeyStep(targetPc, keyBasePc));
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
    // The drone is always "enabled" — the Band slider (down to 0) controls audibility.
    droneEnabled: true,
    droneVolume,
    bassVolume,
    metronomeVolume,
    // FREESTYLE: time-free drone with a ~1s crossfade on the time-based transposes — a quick glide
    // that doesn't wash out the key change. Exercise mode keeps the snappy bar-aligned 0.7s change.
    freestyle,
    droneCrossfadeSec: freestyle ? 1 : 0.7,
    onBeforePlay,
    // Record mode mutes the scale-note bass so the student plays it (clean mic capture).
    silentBass: recordMode,
    // Auto-stop after N loops: in RECORD mode (take capture) OR in a REP brick (onLoopsComplete
    // set) — the brick "completes by loops". Open free play (neither) loops forever.
    maxLoops: recordMode || onLoopsComplete ? recordLoops : 0,
    // A rep brick completes when its required loops finish (not on a user stop). Only wire this
    // when the caller wants loop-count completion (onLoopsComplete) and NOT during record capture.
    onAutoStop:
      onLoopsComplete && !recordMode ? onLoopsComplete : undefined,
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

  // DYNAMIC LOOP — the groove-card cycle engine, driving the SCALE'S key stepper. Each auto
  // key-change calls setKeyStep, which moves the root → droneSymbol, so the drone crossfades
  // between tonal centres on its own (the droneSymbol watch in useScaleSequencer). The home
  // it holds + returns to is wherever the key stepper sits when engaged. keyStep is absolute
  // semitones from the backing key — exactly the engine's setKey(semitonesFromOriginal)
  // contract — so setKeyStep wires straight in. maxSemitones=6 = a full-octave window (the
  // travel-mode wrap math assumes this; the scale generates notes at any pitch so there's no
  // engine cap to honor). Gated off in record mode (auto-cycling would move the grader's
  // answer key) and locked/gig mode (the gig fixes the key).
  // LOOP-based dynamic loop runs only in EXERCISE mode (it counts loop seams). Disabled in
  // freestyle (no loops there) + record/locked.
  const dlEngaged =
    dynamicLoopEngaged && !recordMode && !locked && !freestyle;
  const getCurrentAudioTime = React.useCallback(
    () => sequencer.audioContext?.currentTime ?? null,
    [sequencer.audioContext],
  );
  const dynamicLoop = useDynamicLoop({
    engaged: dlEngaged,
    isPlaying: sequencer.isPlaying,
    isCountingDown: sequencer.countInBeat > 0,
    config: dynamicLoopConfig,
    homeSemitones: keyStep,
    maxSemitones: 6,
    setKey: setKeyStep,
    getNextSeamTime: sequencer.getNextSeamTime,
    getCurrentTime: getCurrentAudioTime,
  });

  // TIME-based transposer runs only in FREESTYLE: every `everyN` SECONDS it advances the key
  // along the SAME dial schedule (ping-pong / travel), and the drone's long crossfade drifts.
  const timeTransposeActive =
    freestyle && dynamicLoopEngaged && sequencer.isPlaying;
  useTimeTranspose({
    active: timeTransposeActive,
    config: dynamicLoopConfig,
    homeSemitones: keyStep,
    maxSemitones: 6,
    setKey: setKeyStep,
  });

  // While EITHER cycler actively owns the key, LOCK the manual key roller (disengage to retune).
  const keyLockedByDynamicLoop = dynamicLoop.isActive || timeTransposeActive;

  // FREESTYLE toggle (the Drone icon): it ONLY arms/disarms the mode — it does NOT start audio.
  // Starting/stopping the actual drone is the PLAY button's job (good UX: the icon says "what
  // mode", Play says "is it playing", consistent with every other groove card). Turning the mode
  // OFF while it's playing must stop the drone, since there's no freestyle context to keep it in.
  const toggleFreestyle = React.useCallback(() => {
    // Side effects run in the callback BODY, never inside a setState updater (StrictMode
    // double-invokes updaters → would double-fire sequencer.stop() → a post-fade spike).
    const next = !freestyle;
    if (next) {
      // The dial's "Every N" is now SECONDS — reset a loops-scale value (e.g. 4) to a sane
      // seconds default (60) so the displayed value matches what the timer actually uses.
      setDynamicLoopConfig((c) => (c.everyN < 15 ? { ...c, everyN: 60 } : c));
    } else {
      // Leaving freestyle: stop any playing drone and restore a loops-scale "Every N".
      if (sequencer.isPlaying) sequencer.stop();
      setDynamicLoopConfig((c) => (c.everyN > 16 ? { ...c, everyN: 4 } : c));
    }
    setFreestyle(next);
  }, [sequencer, freestyle]);

  const onPlayPause = React.useCallback(() => {
    // FREESTYLE: Play starts/stops the held drone (no count-in, no exercise). The Drone icon
    // only arms the mode; the drone never sounds until Play.
    if (freestyle) {
      if (sequencer.isPlaying) sequencer.stop();
      else void sequencer.startFreestyle();
      return;
    }
    if (sequencer.isPlaying) sequencer.stop();
    else void sequencer.play();
  }, [sequencer, freestyle]);

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

  // CHORD TYPE — the top picker cycles the chord SOUNDS (Maj7, Dom7, Min9, 13♯11, …; wraps).
  // The practiced notes (parent scale) + the drone both follow it. Changing chord resets the
  // box position AND the exercise selection (the old exercise belongs to the old chord).
  const chordIdx = CHORD_TYPES.findIndex((c) => c.value === chordType);
  const chordAt = (d: number) =>
    CHORD_TYPES[(chordIdx + d + CHORD_TYPES.length) % CHORD_TYPES.length]!;
  const setChordBy = (d: number) => {
    setChordType(chordAt(d).value);
    setView(1);
    setGroupIdx(-1);
    setVariantIdx(0);
  };
  const scaleRoller = {
    prev2Label: chordAt(-2).label,
    prevLabel: chordAt(-1).label,
    currentLabel: chordAt(0).label,
    nextLabel: chordAt(1).label,
    next2Label: chordAt(2).label,
    onUp: () => setChordBy(-1),
    onDown: () => setChordBy(1),
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
    // While the Dynamic Loop is actively cycling, the engine owns the key — lock the manual
    // roller (mirrors the groove card; disengage to retune).
    disabled: keyLockedByDynamicLoop,
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
  //
  // FREESTYLE: there's no exercise — instead light up the ENTIRE scale across the whole neck
  // (in the current, possibly dynamic-loop-transposed key) so the student sees the full layout
  // to improvise over. buildNoteUniverse emits every (string, fret) of the scale for the bass.
  const litNotes = React.useMemo(() => {
    if (freestyle) {
      return buildNoteUniverse({ stringCount, maxFrets }, root, scaleType).map(
        (n) => ({ string: n.string, fret: n.fret }),
      );
    }
    return usingAuthored
      ? path.map((n) => ({ string: n.string, fret: n.fret }))
      : undefined;
  }, [freestyle, usingAuthored, path, stringCount, maxFrets, root, scaleType]);

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
      // Move the volume + Rec icons OUT of the floating header and down into the caption
      // row (bottom-right, just above the playback controls).
      controlsInCaptionRow
      isPlaying={sequencer.isPlaying}
      // No master slider for the scales tool — the popover is THREE per-track sliders
      // (metronome / bass / band) behind the one volume icon.
      hideMasterSlider
      // Own the volume popover's open state so it can't show at the same time as the Rec loop
      // stepper (both sit under the icon cluster). Opening volume hides the loop stepper below.
      volumeOpen={volumeOpen}
      onVolumeOpenChange={setVolumeOpen}
      // The THREE track-volume sliders, each with one icon on the left: Metronome (click),
      // Bass (the scale notes), Band (the drone/instrument track). Each is wired to its own
      // gain in the sequencer so it moves only that source.
      volumePopoverExtra={
        <div className="flex flex-col gap-2.5">
          {/* METRONOME click level */}
          <div className="flex items-center gap-2" title="Metronome (click) level">
            <Metronome className="w-3.5 h-3.5 shrink-0 text-white/40" aria-hidden />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={metronomeVolume}
              onChange={(e) => setMetronomeVolume(Number(e.target.value))}
              aria-label="Metronome level"
              className="h-1 w-32 cursor-pointer accent-emerald-400"
            />
          </div>
          {/* BASS sampler (the scale notes) level */}
          <div className="flex items-center gap-2" title="Bass (scale notes) level">
            <Guitar className="w-3.5 h-3.5 shrink-0 text-white/40" aria-hidden />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={bassVolume}
              onChange={(e) => setBassVolume(Number(e.target.value))}
              aria-label="Bass level"
              className="h-1 w-32 cursor-pointer accent-orange-400"
            />
          </div>
          {/* BAND / drone track level — the drone's audibility (no engage toggle; the Drone
              icon is the Freestyle-mode switch). */}
          <div className="flex items-center gap-2" title="Band (drone) level">
            <AudioLines className="w-3.5 h-3.5 shrink-0 text-white/40" aria-hidden />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={droneVolume}
              onChange={(e) => setDroneVolume(Number(e.target.value))}
              aria-label="Band level"
              className="h-1 w-32 cursor-pointer accent-indigo-400"
            />
          </div>
        </div>
      }
      // HEADER ICON CLUSTER (in the caption row), left→right: Drone · Dynamic Loop · Rec ·
      // Volume (volume is appended by the shell after headerExtra). Drone = engage/disengage
      // the pad; Dynamic Loop = the groove-card dial; Rec = arm recording.
      headerExtra={
        <>
          {/* DRONE icon = FREESTYLE mode toggle. It ARMS the mode only — it does NOT start audio;
              press Play to start the held drone (metronome + bass + exercise stay silent; the
              time-based Dynamic Loop transposes it). OFF: back to exercise mode. Lit indigo while
              armed. Hidden in locked (gig) mode — a gig is a graded exercise, not freestyle. */}
          {!locked && (
            <button
              type="button"
              aria-label={freestyle ? 'Exit freestyle (drone)' : 'Freestyle — freeze a chord and jam'}
              aria-pressed={freestyle}
              title={
                freestyle
                  ? 'Freestyle ON — press Play to start the drone. Click to exit the mode.'
                  : 'Freestyle — freeze a chord and play over it (press Play to start; no exercise, no click)'
              }
              onClick={toggleFreestyle}
              className={`p-2.5 rounded-full transition-colors ${
                freestyle
                  ? 'bg-indigo-500 text-white hover:bg-indigo-400'
                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80'
              }`}
            >
              <AudioLines className="w-5 h-5" aria-hidden />
            </button>
          )}
          {/* DYNAMIC LOOP — the groove-card dial. Hidden in locked (gig) mode (key is fixed)
              and disabled in record mode (auto-cycling would move the grader's answer key). */}
          {!locked && (
            <GrooveCardDynamicLoopDial
              config={dynamicLoopConfig}
              onConfigChange={setDynamicLoopConfig}
              // In freestyle the cycle is the TIME transposer (engaged reflects the dial's own
              // flag); in exercise mode it's the loop-based cycle (dlEngaged). Units switch too.
              engaged={freestyle ? dynamicLoopEngaged : dlEngaged}
              onEngagedChange={setDynamicLoopEngaged}
              maxSemitones={6}
              // In freestyle there's no exercise path, so sequencer.isReady is false — but the
              // dial is the whole point of the mode, so it must stay enabled. Only gate it on
              // path-readiness + record mode in EXERCISE mode.
              disabled={!freestyle && (!sequencer.isReady || recordMode)}
              everyUnit={freestyle ? 'seconds' : 'loops'}
            />
          )}
          {/* REC ARM — single-press icon. Press once to arm (red, ▶ becomes ●), again to
              disarm. Disabled mid-take. When armed, the loop-count stepper (‹ N× ›) drops
              in by the icon — hidden in locked (gig) mode (the gig fixes the count) AND while
              the volume popover is open (the two share the same spot — one or the other).
              Recording is an EXERCISE-mode deliverable, so it's DISABLED (greyed, not removed)
              in freestyle — the icon stays put so the cluster doesn't reflow. */}
          <RecArmButton
            armed={recordMode}
            disabled={sequencer.isPlaying || freestyle}
            onToggle={() => setRecordMode((v) => !v)}
            showLoops={!locked && !volumeOpen && !freestyle}
            recordLoops={recordLoops}
            isPlaying={sequencer.isPlaying}
            onRecordLoopsChange={setRecordLoops}
            // The icons sit in the caption row, right above the controls bar — so the loop
            // stepper drops UP (toward the fretboard) to avoid covering the controls.
            dropUp
          />
        </>
      }
      // The fretboard replaces the waveform as the main window.
      waveform={
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <ScaleFretboardWindow
            root={root}
            scaleType={scaleType}
            stringCount={stringCount}
            maxFrets={maxFrets}
            // Freestyle has no exercise — the fretboard isn't "playing" a path (no playhead,
            // no camera follow). The static scale shape still shows the notes that fit the chord.
            isPlaying={sequencer.isPlaying && !freestyle}
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
          // In FREESTYLE the Play button starts/stops the held drone, so it's ALWAYS enabled
          // (no exercise-path readiness needed — there's no exercise). In exercise mode it's the
          // normal play-readiness gate.
          isReady={freestyle ? true : sequencer.isReady}
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
          locked={locked}
        />
      }
    />
  );
}

const FADE_MS = 180;

/**
 * useFadeMount — keep content mounted through an exit fade. Returns `mounted` (true while the
 * element should be in the DOM, including during fade-out) and `shown` (the opacity flag: true
 * = visible). When `wantVisible` goes false we hold `mounted` for FADE_MS so the opacity can
 * transition 1→0, then unmount. A plain conditional render only fades IN (mount) and pops out
 * (unmount) — this gives both directions.
 */
function useFadeMount(wantVisible: boolean): { mounted: boolean; shown: boolean } {
  // Start hidden (opacity 0) even when wantVisible is already true on first mount, so the very
  // first appearance still fades in rather than snapping to opaque.
  const [mounted, setMounted] = React.useState(wantVisible);
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => {
    if (wantVisible) {
      setMounted(true);
      // DOUBLE rAF: the element mounts at opacity 0 on this paint; flipping `shown` true after
      // TWO frames guarantees the browser has painted the 0 state first, so the 0→1 change
      // actually transitions (a single rAF can land in the same paint as the mount → no fade).
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    setShown(false); // start the fade-out
    const t = window.setTimeout(() => setMounted(false), FADE_MS); // unmount after it completes
    return () => window.clearTimeout(t);
  }, [wantVisible]);
  return { mounted, shown };
}

/** REC ARM — a single icon button in the header cluster (next to volume). One press arms
 *  record mode (red, filled dot), another disarms it. Styled to match the volume button's
 *  pill so the header cluster reads as one row. Disabled while a take is playing.
 *
 *  When ARMED (and loops are shown), the take-length stepper (‹ N× ›) floats off the icon
 *  row — absolutely positioned (below by default, above with dropUp) so it doesn't inflate
 *  the cluster or nudge the volume icon. It fades IN on show and OUT on hide (useFadeMount). */
function RecArmButton({
  armed,
  disabled,
  onToggle,
  showLoops,
  recordLoops,
  isPlaying,
  onRecordLoopsChange,
  dropUp = false,
}: {
  armed: boolean;
  disabled: boolean;
  onToggle: () => void;
  /** Whether the loop stepper may appear when armed (false in locked/gig mode). */
  showLoops: boolean;
  recordLoops: number;
  isPlaying: boolean;
  onRecordLoopsChange: (n: number) => void;
  /** Drop the loop stepper UPWARD (above the icon) instead of below — used when the icons
   *  sit in the caption row just above the controls bar, so the stepper doesn't cover it. */
  dropUp?: boolean;
}) {
  // The loop stepper fades both ways (mount-in, hold-then-unmount on exit).
  const { mounted: loopsMounted, shown: loopsShown } = useFadeMount(
    armed && showLoops,
  );
  return (
    <div className="relative flex items-center">
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-label={armed ? 'Disarm record mode' : 'Arm record mode'}
        aria-pressed={armed}
        title={
          armed
            ? 'Recording armed — press play to capture a graded take. Click to disarm.'
            : 'Arm recording: mute the scale, play it yourself, get graded'
        }
        className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          armed
            ? 'bg-red-600 text-white hover:bg-red-500'
            : 'bg-white/5 text-rose-400/70 hover:bg-white/10 hover:text-rose-400'
        }`}
      >
        <Circle
          className="h-4 w-4"
          // ALWAYS a FILLED dot (currentColor) so it reads as a "record" dot at a glance.
          // Idle: a MUTED red (rose-400/70 via the button's text color) — present enough that
          // a student recognizes "this records", but quiet, not the loud armed state. Armed:
          // the loud filled red pill with a white dot.
          fill="currentColor"
          aria-hidden
        />
      </button>

      {/* LOOPS stepper — only while armed. A BARE horizontal unit (‹ N× ›) floating just
          off the icon row: no card, no border, no shadow — it sits straight on the surface
          so the cluster stays uncluttered. Legibility over the busy texture comes from a
          text drop-shadow, not a panel.

          VERTICAL: drops BELOW (top-full) by default; with dropUp it rises ABOVE
          (bottom-full) — used when the icons sit in the caption row right above the controls
          bar, so the stepper goes toward the fretboard instead of covering the controls.

          CENTERING: it sits at the MIDPOINT of the rec+volume pair, not just the Rec icon.
          With the cluster order [Dynamic Loop · Rec · Volume], the volume center is 46px to
          the RIGHT of the Rec center (rec½ 18 + gap-2 8 + vol½ 20), so the pair's midpoint is
          23px RIGHT of Rec. The wrapper is anchored at Rec's left-1/2 and shifted by
          calc(-50% + 23px): -50% recenters the dropdown on its own width, the +23px nudges it
          right to the shared midpoint. The chevrons match the key picker's (lucide Chevron,
          h-4 w-4, white/70, rounded hover bg). */}
      {loopsMounted && (
        <div
          className={`pointer-events-none absolute left-1/2 z-20 -translate-x-[calc(50%-23px)] ${
            dropUp ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
        >
          <div
            className="pointer-events-auto flex select-none items-center gap-0.5 whitespace-nowrap [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]"
            role="group"
            aria-label="Take length in loops"
            // Fade in/out: opacity flips with `loopsShown` (false on mount + on exit), so it
            // eases both directions instead of popping out.
            style={{
              opacity: loopsShown ? 1 : 0,
              transition: `opacity ${FADE_MS}ms ease-out`,
            }}
          >
            <button
              type="button"
              aria-label="Fewer loops"
              disabled={isPlaying || recordLoops <= 1}
              onClick={() => onRecordLoopsChange(Math.max(1, recordLoops - 1))}
              className="rounded-md p-0.5 text-white/70 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <span className="flex items-baseline gap-0.5 tabular-nums">
              <span className="text-sm font-bold text-red-400">{recordLoops}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                ×&nbsp;loops
              </span>
            </span>
            <button
              type="button"
              aria-label="More loops"
              disabled={isPlaying || recordLoops >= 8}
              onClick={() => onRecordLoopsChange(Math.min(8, recordLoops + 1))}
              className="rounded-md p-0.5 text-white/70 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
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
