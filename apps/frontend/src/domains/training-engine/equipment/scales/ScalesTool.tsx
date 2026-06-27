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
import { droneChordSymbol } from './droneChord';
import { useScaleSequencer } from './useScaleSequencer';
import {
  rootFromKey,
  type ScaleType,
  type ScaleView,
  type StringCount,
} from './scaleGenerator';
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

  // The KEY wheel is a continuous chromatic dial: a signed step counter that the wheel
  // advances ±1 per spin (the fretboard root + the played notes both derive from it,
  // both mod-12). No engine transpose anymore — we GENERATE the notes at the right pitch.
  const [keyStep, setKeyStep] = React.useState(0);

  // The scale ROOT follows the KEY wheel (the `< E >` control) — no separate root picker.
  const root = rootFromKey(backingConfig.originalKey, keyStep);

  // ── The play SEQUENCE: build the box (or whole-neck) notes, turn them into an ordered,
  //    timed path, and derive the auto drone chord. The sequencer plays this. ──
  const { path, loopBeats, droneSymbol } = React.useMemo(() => {
    const fretboard = { stringCount, maxFrets };
    const universe = buildNoteUniverse(fretboard, root, scaleType);
    const notes =
      view === 'whole'
        ? universe
        : selectBox(universe, fretboard, root, scaleType, view);
    const p = buildScalePath(notes);
    return {
      path: p,
      loopBeats: scalePathBeats(p),
      droneSymbol: droneChordSymbol(root, scaleType),
    };
  }, [root, scaleType, stringCount, maxFrets, view]);

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

  // SCALE — cycles through the scale types (wraps). Changing scale resets to position 1.
  const scaleIdx = SCALE_TYPES.findIndex((s) => s.value === scaleType);
  const scaleAt = (d: number) =>
    SCALE_TYPES[(scaleIdx + d + SCALE_TYPES.length) % SCALE_TYPES.length]!;
  const setScaleBy = (d: number) => {
    setScaleType(scaleAt(d).value);
    setView(1);
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
  // (Db/Eb/Gb/Ab/Bb); the root + the generated notes both follow it.
  const keyBasePc = parsePitchClass(backingConfig.originalKey) ?? 0;
  const keyName = (s: number) => spellPitchClass(keyBasePc + s, true);
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
          position={positionRoller}
          keyRoller={keyRoller}
          tempo={tempoRoller}
          onPlayPause={onPlayPause}
        />
      }
    />
  );
}
