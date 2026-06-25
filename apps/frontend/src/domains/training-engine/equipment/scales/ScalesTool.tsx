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
import { GrooveCardControls } from '@/domains/widgets/components/YouTubeWidgetPage/blocks/groove-card/GrooveCardControls';
import { ScaleFretboardWindow } from './ScaleFretboardWindow';
import { ScalePicker } from './ScalePicker';
import {
  rootFromKey,
  type ScaleType,
  type StringCount,
} from './scaleGenerator';
import { useEquipmentListening } from '../listening/useEquipmentListening';

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

  const isBassMuted = playback.mutedStems.has('audio-bass');
  const isSoloBass = playback.soloedStem === 'audio-bass';

  const onPlayPause = React.useCallback(() => {
    if (playback.isPlaying) playback.pause();
    else void playback.play();
  }, [playback]);

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
        />
      }
      // The skill-specific panel: choose the scale TYPE (the root comes from the
      // playback key switcher above — no redundant root picker).
      footer={
        <ScalePicker scaleType={scaleType} onScaleTypeChange={setScaleType} />
      }
      controls={
        <GrooveCardControls
          isPlaying={playback.isPlaying}
          isReady={playback.isReady}
          isLoading={playback.isLoading}
          countdownState={playback.countdownState}
          currentBpm={playback.currentBpm}
          currentSemitones={playback.currentSemitones}
          pendingKeyShift={playback.pendingKeyShift}
          originalKey={backingConfig.originalKey}
          isBassMuted={isBassMuted}
          isSoloDrums={isSoloBass}
          muteDisabled={isSoloBass}
          onPlayPause={onPlayPause}
          onTempoChange={playback.setTempo}
          onKeyChange={playback.setKey}
          onMuteBass={(muted) => playback.setStemMuted('audio-bass', muted)}
          onSoloDrums={(solo) =>
            playback.setStemSolo(solo ? 'audio-bass' : null)
          }
          transposeRange={playback.transposeRange}
          originalBpm={backingConfig.originalBpm}
        />
      }
    />
  );
}
