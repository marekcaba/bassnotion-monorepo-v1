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
import { useGrooveCardPlayback } from '@/domains/widgets/components/YouTubeWidgetPage/blocks/groove-card/useGrooveCardPlayback';
import { GrooveCardShell } from '@/domains/widgets/components/YouTubeWidgetPage/blocks/groove-card/GrooveCardShell';
import { formatKeyLabel } from '@/domains/widgets/components/YouTubeWidgetPage/blocks/groove-card/GrooveCardControls';
import { ScaleFretboardWindow } from './ScaleFretboardWindow';
import { ScalesControls } from './ScalesControls';
import { positionCount } from './scaleBlueprints';
import {
  rootFromKey,
  type ScaleType,
  type ScaleView,
  type StringCount,
} from './scaleGenerator';
import { useEquipmentListening } from '../listening/useEquipmentListening';

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

  const playback = useGrooveCardPlayback({
    block: backingConfig,
    cardId: 'gym-scales-tool',
    mode: 'block',
    onBeforePlay,
  });

  // The scale ROOT follows the playback KEY switcher (the `< E >` control) — no
  // separate root picker. Changing the key transposes the audio AND moves the scale.
  const root = rootFromKey(
    backingConfig.originalKey,
    playback.currentSemitones,
  );

  // LISTENING (stubbed): every play is a take the platform hears. No-op until the
  // bass-coach engine is wired; the seam exists now so the tool is listening-ready.
  useEquipmentListening({
    station: 'scales',
    audioContext: playback.audioContext,
    isPlaying: playback.isPlaying,
    loopStartAudioTime: playback.loopStartAudioTime,
  });

  const onPlayPause = React.useCallback(() => {
    if (playback.isPlaying) playback.pause();
    else void playback.play();
  }, [playback]);

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
    prevLabel: scaleAt(-1).label,
    currentLabel: scaleAt(0).label,
    nextLabel: scaleAt(1).label,
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
    prevLabel: viewToLabel((viewIdx - 1 + viewSlots) % viewSlots),
    currentLabel: viewToLabel(viewIdx),
    nextLabel: viewToLabel((viewIdx + 1) % viewSlots),
    onUp: () => setViewBy(-1),
    onDown: () => setViewBy(1),
  };

  // KEY — semitone steps; labels are note names. UP raises, DOWN lowers (matches the
  // wheel: the higher value sits above). Bounded by the engine's transpose range.
  const semis = playback.currentSemitones;
  const range = playback.transposeRange;
  const keyName = (s: number) => formatKeyLabel(backingConfig.originalKey, s);
  const keyRoller = {
    prevLabel: semis < range ? keyName(semis + 1) : undefined,
    currentLabel: keyName(semis),
    nextLabel: semis > -range ? keyName(semis - 1) : undefined,
    onUp: () => playback.setKey(Math.min(range, semis + 1)),
    onDown: () => playback.setKey(Math.max(-range, semis - 1)),
  };

  // TEMPO — BPM ±1. UP faster (sits above), DOWN slower.
  const bpm = playback.currentBpm;
  const tempoRoller = {
    prevLabel: `${bpm + 1}`,
    currentLabel: `${bpm}`,
    nextLabel: `${bpm - 1}`,
    onUp: () => playback.setTempo(bpm + 1),
    onDown: () => playback.setTempo(bpm - 1),
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
      isPlaying={playback.isPlaying}
      masterVolume={playback.masterVolume}
      onMasterVolumeChange={playback.setMasterVolume}
      // The fretboard replaces the waveform as the main window.
      waveform={
        <ScaleFretboardWindow
          root={root}
          scaleType={scaleType}
          stringCount={stringCount}
          maxFrets={maxFrets}
          isPlaying={playback.isPlaying}
          tempo={playback.currentBpm}
          view={view}
        />
      }
      // All controls live in the grip: Scale | Position | ▶ | Key | Tempo. No
      // footer panel needed.
      controls={
        <ScalesControls
          isPlaying={playback.isPlaying}
          isReady={playback.isReady}
          countdownState={playback.countdownState}
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
