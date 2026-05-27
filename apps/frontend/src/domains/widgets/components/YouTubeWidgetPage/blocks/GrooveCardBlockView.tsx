'use client';

/**
 * GrooveCardBlockView — LAUNCH-02.5c.
 *
 * Block-renderer entry point. Wires the orchestration hook to the visual
 * components. Knows nothing about PlaybackEngine — the hook is the
 * contract.
 *
 * `mode` defaults to 'block'; 02.5d will mount this with mode='waitlist'
 * inside the marketing page (the host bootstrap differs; the component
 * shape doesn't).
 */

import { useCallback, useMemo } from 'react';
import type { TutorialBlock } from '@bassnotion/contracts';
import { useGrooveCardPlayback } from './groove-card/useGrooveCardPlayback';
import { GrooveCardShell } from './groove-card/GrooveCardShell';
import { GrooveCardWaveform } from './groove-card/GrooveCardWaveform';
import { GrooveCardControls } from './groove-card/GrooveCardControls';

interface GrooveCardBlockViewProps {
  block: TutorialBlock<'groove-card'>;
  isActive: boolean;
  isCompleted: boolean;
  onComplete: (blockId: string) => void;
  onNext: () => void;
  /** Optional rendering mode. The waitlist surface (02.5d) passes
   *  'waitlist' to swap the audio bootstrap; default is 'block'. */
  mode?: 'block' | 'waitlist';
  /** Optional bundled-click URL for waitlist mode (02.5d). */
  countdownClickUrl?: string;
}

export function GrooveCardBlockView({
  block,
  mode = 'block',
  countdownClickUrl,
}: GrooveCardBlockViewProps) {
  const config = block.config;

  const playback = useGrooveCardPlayback({
    block: config,
    cardId: block.id,
    mode,
    countdownClickUrl,
  });

  const onPlayPause = useCallback(() => {
    if (playback.isPlaying) {
      void playback.pause();
    } else {
      void playback.play();
    }
  }, [playback]);

  const isBassMuted = playback.mutedStems.has('audio-bass');
  const isSoloDrums = playback.soloedStem === 'audio-drums';

  // Reactive caption: pick the appropriate state caption when a control
  // last changed; otherwise fall back to previewCaption, then empty.
  const caption = useMemo(() => {
    const sc = config.stateCaptions ?? {};
    if (isSoloDrums && sc['solo-drums']) return sc['solo-drums'];
    if (isBassMuted && sc['mute-bass']) return sc['mute-bass'];
    if (playback.pendingKeyShift !== null && sc['key-change'])
      return sc['key-change'];
    if (playback.currentBpm !== config.originalBpm && sc['tempo-change'])
      return sc['tempo-change'];
    return config.previewCaption ?? '';
  }, [
    config,
    isBassMuted,
    isSoloDrums,
    playback.currentBpm,
    playback.pendingKeyShift,
  ]);

  return (
    <GrooveCardShell
      title={config.title}
      subtitle={config.subtitle}
      isPlaying={playback.isPlaying}
      caption={caption}
      clickEnabled={playback.clickEnabled}
      onToggleClick={() => playback.setClickEnabled(!playback.clickEnabled)}
      waveform={<GrooveCardWaveform isPlaying={playback.isPlaying} />}
      controls={
        <GrooveCardControls
          isPlaying={playback.isPlaying}
          isReady={playback.isReady}
          isLoading={playback.isLoading}
          currentBpm={playback.currentBpm}
          currentSemitones={playback.currentSemitones}
          pendingKeyShift={playback.pendingKeyShift}
          originalKey={config.originalKey}
          isBassMuted={isBassMuted}
          isSoloDrums={isSoloDrums}
          onPlayPause={onPlayPause}
          onTempoChange={playback.setTempo}
          onKeyChange={playback.setKey}
          onMuteBass={(muted) => playback.setStemMuted('audio-bass', muted)}
          onSoloDrums={(solo) =>
            playback.setStemSolo(solo ? 'audio-drums' : null)
          }
        />
      }
    />
  );
}
