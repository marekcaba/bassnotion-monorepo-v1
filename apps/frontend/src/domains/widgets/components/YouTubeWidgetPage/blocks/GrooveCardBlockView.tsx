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

import { useCallback, useMemo, useState } from 'react';
import type { TutorialBlock } from '@bassnotion/contracts';
import { useGrooveCardPlayback } from './groove-card/useGrooveCardPlayback';
import { GrooveCardShell } from './groove-card/GrooveCardShell';
import { GrooveCardWaveform } from './groove-card/GrooveCardWaveform';
import { GrooveCardControls } from './groove-card/GrooveCardControls';
import {
  DEFAULT_PREVIEW_CAPTION,
  DEFAULT_STATE_CAPTIONS,
  HOVER_HINTS,
  type HoverHintKey,
} from './groove-card/captions';

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
  /** Optional outer-card background colour. Forwarded to GrooveCardShell.
   *  The waitlist surface sets this so the card blends into the marketing
   *  page; the in-app surface leaves it undefined and gets the default. */
  bg?: string;
}

export function GrooveCardBlockView({
  block,
  mode = 'block',
  countdownClickUrl,
  bg,
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

  // Hover hint: which interactive control the pointer is currently over.
  // null when nothing is hovered. Takes priority over the reactive caption
  // (state captions reappear as soon as the cursor leaves the control).
  const [hoverHint, setHoverHint] = useState<HoverHintKey | null>(null);

  // Caption priority:
  //   1. Active hover hint (transient UX affordance — pointer only).
  //   2. While playing, a simple "Playing…" — the student should focus on
  //      listening, not reading copy.
  //   3. Reactive state caption keyed on the last user action.
  //   4. previewCaption (admin override) or the baked default.
  // Admin-authored block config wins over baked defaults for (3) and (4).
  const caption = useMemo(() => {
    if (hoverHint) return HOVER_HINTS[hoverHint];
    if (playback.isPlaying) return 'Playing…';

    const sc = config.stateCaptions ?? {};
    const pick = (key: keyof typeof DEFAULT_STATE_CAPTIONS): string =>
      sc[key] ?? DEFAULT_STATE_CAPTIONS[key];

    if (isSoloDrums) return pick('solo-drums');
    if (isBassMuted) return pick('mute-bass');
    if (playback.pendingKeyShift !== null) return pick('key-change');
    if (playback.currentBpm !== config.originalBpm) return pick('tempo-change');
    return config.previewCaption ?? DEFAULT_PREVIEW_CAPTION;
  }, [
    hoverHint,
    config,
    isBassMuted,
    isSoloDrums,
    playback.isPlaying,
    playback.currentBpm,
    playback.pendingKeyShift,
  ]);

  // Read-only metadata line under the title — just the length in bars.
  // The original key is already surfaced by the live key stepper in the
  // controls row, so duplicating it here adds noise.
  const meta = useMemo(() => {
    if (config.lengthBars <= 0) return '';
    return `${config.lengthBars} ${config.lengthBars === 1 ? 'bar' : 'bars'}`;
  }, [config.lengthBars]);

  const youtubeId = useMemo(
    () => getYouTubeVideoId(config.youtubeUrl ?? ''),
    [config.youtubeUrl],
  );

  return (
    <div className="space-y-3">
      {youtubeId && (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1`}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            frameBorder="0"
            title="Groove card video"
          />
        </div>
      )}
      <GrooveCardShell
        title={config.title}
        subtitle={config.subtitle}
        meta={meta}
        bg={bg}
        isPlaying={playback.isPlaying}
        caption={caption}
        clickEnabled={playback.clickEnabled}
        onToggleClick={() => playback.setClickEnabled(!playback.clickEnabled)}
        onMetronomeHover={(hovering) =>
          setHoverHint(hovering ? 'metronome' : null)
        }
        waveform={
          <GrooveCardWaveform
            isPlaying={playback.isPlaying}
            bassBuffer={playback.bassBuffer}
            audioContext={playback.audioContext}
            loopStartAudioTime={playback.loopStartAudioTime}
            loopDurationSeconds={playback.loopDurationSeconds}
            lengthBars={config.lengthBars}
            loopSelection={playback.loopSelection}
            onLoopSelectionChange={playback.setLoopSelection}
          />
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
            onHoverHint={setHoverHint}
          />
        }
      />
    </div>
  );
}

function getYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
  );
  return match?.[1] ?? null;
}
