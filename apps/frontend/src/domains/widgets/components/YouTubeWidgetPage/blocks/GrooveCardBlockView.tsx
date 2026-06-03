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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import type {
  TutorialBlock,
  GrooveCardBlockConfig,
  DrillCompletionResult,
  MasteryTier,
} from '@bassnotion/contracts';
import { useGrooveCardPlayback } from './groove-card/useGrooveCardPlayback';
import { useGrooveCardKeyboard } from './groove-card/useGrooveCardKeyboard';
import { GrooveCardShell } from './groove-card/GrooveCardShell';
import { GrooveCardWaveform } from './groove-card/GrooveCardWaveform';
import { GrooveCardControls } from './groove-card/GrooveCardControls';
import {
  DEFAULT_PREVIEW_CAPTION,
  DEFAULT_STATE_CAPTIONS,
  HOVER_HINTS,
  type HoverHintKey,
} from './groove-card/captions';
import { useEntitlement } from '@/domains/billing/hooks/useEntitlement';
import { trackEvent } from '@/shared/attribution/events';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { useDrill } from '@/domains/drill/stores/useDrillStore';
import { ConquerOutcome } from '@/domains/drill/components/ConquerOutcome';
import { SaveAccountGate } from '@/domains/drill/components/SaveAccountGate';
import { useGroove } from '@/domains/drill/hooks/useGrooveLibrary';
import { useDrillCriterion } from '@/domains/drill/hooks/useDrillCriterion';

interface GrooveCardBlockViewProps {
  block: TutorialBlock<'groove-card'>;
  isActive: boolean;
  isCompleted: boolean;
  /** BlockRenderer binds this to (data?) => markBlockComplete(block.id, data);
   *  the brick passes its completion payload, the block id is added upstream. */
  onComplete: (data?: Record<string, unknown>) => void;
  onNext: () => void;
  /** Optional rendering mode. The waitlist surface (02.5d) passes
   *  'waitlist' to swap the audio bootstrap; default is 'block'. */
  mode?: 'block' | 'waitlist';
  /** Optional bundled-click URL for waitlist mode (02.5d). */
  countdownClickUrl?: string;
  /** Optional outer-card background colour. Forwarded to GrooveCardShell.
   *  Both surfaces now share the same default (#100E0D); leave undefined
   *  unless a specific card needs a one-off background. */
  bg?: string;
  /** Optional override for the waveform bar colour. Both surfaces share
   *  `GrooveCardWaveform`'s default (#1f252e) so the card looks identical
   *  in-app and on the waitlist; pass a value only to override a single
   *  card. */
  waveformColor?: string;
  /** Optional "before-play" hook forwarded to useGrooveCardPlayback. The
   *  waitlist surface wires `useWaitlistPrewarm.resume()` here so the
   *  prewarm's AudioContext is resumed inside the user-gesture window. */
  onBeforePlay?: () => Promise<void> | void;
  /** When true, the card enforces the free-vs-member lever caps from
   *  useEntitlement (tempo ±5, transpose ±2, bar-range loop locked for the
   *  unpaid tier) and surfaces the upsell + fires cap_hit on the band edge.
   *  The drill surface on /app opts in; the marketing/tutorial surfaces
   *  leave it off (default) so their existing behaviour is untouched. */
  enableCaps?: boolean;
}

export function GrooveCardBlockView({
  block,
  mode = 'block',
  countdownClickUrl,
  bg,
  waveformColor,
  onBeforePlay,
  onComplete,
  onNext,
  enableCaps = false,
}: GrooveCardBlockViewProps) {
  const rawConfig = block.config;

  // LIBRARY RESOLUTION: when the block references a groove by id, fetch the
  // library entity and build an EFFECTIVE config = the groove's intrinsic
  // fields (stems/title/bpm/key/length) + this block's per-use overrides
  // (keyOverride/tempoOverride) + the drill fields kept on the block
  // (role/timeboxMinutes). Inline (legacy) blocks have no grooveId and use
  // rawConfig as-is. The fetch is skipped for inline blocks.
  const { data: groove } = useGroove(rawConfig.grooveId);

  const config: GrooveCardBlockConfig = useMemo(() => {
    // Inline (legacy) block: ensure intrinsic fields always have safe defaults
    // so downstream (playback hook, controls) never sees undefined.
    const withDefaults = (c: GrooveCardBlockConfig): GrooveCardBlockConfig => ({
      ...c,
      title: c.title ?? '',
      subtitle: c.subtitle ?? '',
      originalBpm: c.originalBpm ?? 100,
      originalKey: c.originalKey ?? 'E',
      lengthBars: c.lengthBars ?? 4,
      stems: c.stems ?? { bass: '', drums: '', harmony: '' },
    });

    if (!rawConfig.grooveId) return withDefaults(rawConfig);
    if (!groove) return withDefaults(rawConfig); // reference still loading
    return withDefaults({
      ...rawConfig,
      title: groove.name,
      subtitle: groove.subtitle,
      originalBpm: rawConfig.tempoOverride ?? groove.originalBpm,
      originalKey: groove.originalKey,
      lengthBars: groove.lengthBars,
      stems: groove.stems,
      youtubeUrl: rawConfig.youtubeUrl ?? groove.youtubeUrl,
    });
  }, [rawConfig, groove]);

  // A groove card becomes a DRILL BRICK when its config carries a `role`
  // (groove/connecting/review). Drill bricks enforce caps and, on conquer,
  // advance the session (onComplete → onNext) — the "card emits conquered →
  // Timer advances" seam. Plain tutorial/marketing cards have no role and
  // just play.
  const isDrillBrick = config.role != null;
  const capsEnabled = enableCaps || isDrillBrick;

  // Entitlement caps — consulted when this surface opts in OR it's a brick.
  // The hook resolves member → uncapped, anonymous/free → the unpaid band.
  const { caps } = useEntitlement({ enabled: capsEnabled });

  // Transient upsell caption shown when a capped lever hits its band edge.
  const [capUpsell, setCapUpsell] = useState<string | null>(null);

  const onCapHit = useCallback(
    (lever: 'tempo' | 'transpose' | 'loopRange') => {
      setCapUpsell(caps[lever]?.message ?? '');
      trackEvent('cap_hit', { lever, grooveId: block.id });
    },
    [caps, block.id],
  );

  const playbackCaps = useMemo(() => {
    if (!capsEnabled) return undefined;
    return {
      tempoLimit: caps.tempo.isCapped ? caps.tempo.limit : undefined,
      transposeLimit: caps.transpose.isCapped
        ? caps.transpose.limit
        : undefined,
      loopRangeCapped: caps.loopRange.isCapped,
    };
  }, [capsEnabled, caps]);

  const playback = useGrooveCardPlayback({
    block: config,
    cardId: block.id,
    mode,
    countdownClickUrl,
    onBeforePlay,
    caps: playbackCaps,
    onCapHit: capsEnabled ? onCapHit : undefined,
  });

  // PER-USE key override: when a drill reference sets keyOverride, apply it as
  // the starting transpose once the card is ready (once per mount).
  const keyOverrideApplied = useRef(false);
  useEffect(() => {
    if (keyOverrideApplied.current) return;
    if (!playback.isReady) return;
    const k = rawConfig.keyOverride;
    if (k != null && k !== 0) {
      playback.setKey(k);
    }
    keyOverrideApplied.current = true;
  }, [playback.isReady, playback.setKey, rawConfig.keyOverride, playback]);

  const onPlayPause = useCallback(() => {
    if (playback.isPlaying) {
      void playback.pause();
    } else {
      void playback.play();
    }
  }, [playback]);

  const isBassMuted = playback.mutedStems.has('audio-bass');
  const isSoloDrums = playback.soloedStem === 'audio-drums';

  const onToggleBassMute = useCallback(
    () => playback.setStemMuted('audio-bass', !isBassMuted),
    [playback, isBassMuted],
  );

  // ── Drill brick: criterion → Next-unlock → advance ──────────────────────
  const { isAuthenticated, isReady } = useAuth();
  const drill = useDrill();
  // A drill renders at /app/tutorials/[slug]; read the slug so a pending
  // (anonymous) completion can persist to the right tutorial after signup.
  const routeParams = useParams<{ slug?: string }>();
  const sessionSlug =
    typeof routeParams?.slug === 'string' ? routeParams.slug : '';
  const [conqueredTier, setConqueredTier] = useState<MasteryTier | null>(null);
  const [gateOpen, setGateOpen] = useState(false);

  // The brick's completion criterion (from config; absent on plain cards).
  const criterion = config.completionCriterion;
  // Measured criteria (time/loops) report live progress + isMet; conquer/manual
  // are driven by the buttons below, not measured.
  const criterionRuntime = useDrillCriterion(
    isDrillBrick ? criterion : undefined,
    { isPlaying: playback.isPlaying, getAudioPhase: playback.getAudioPhase },
  );

  // Fire drill_started once when a brick mounts (joins to the source video
  // via the shared anonymous_id).
  useEffect(() => {
    if (!isDrillBrick) return;
    trackEvent('drill_started', { grooveId: block.id, role: config.role });
  }, [isDrillBrick, block.id, config.role]);

  // Shared completion: persist the result + advance. Authenticated → persist
  // straight through (onComplete carries the data payload now that the seam is
  // fixed). Anonymous → stash for replay + open the account gate, still advance
  // so the drill never dead-ends.
  const completeBrick = useCallback(
    (result: DrillCompletionResult, achievedTier: MasteryTier | null) => {
      const data = {
        result,
        criterion: criterion?.type,
        achievedTier,
        at: new Date().toISOString(),
      };
      if (isReady && isAuthenticated) {
        onComplete(data);
        onNext();
      } else {
        drill.setPendingCompletion({
          tutorialSlug: sessionSlug,
          blockId: block.id,
          result,
          criterion: criterion?.type,
          achievedTier,
          at: data.at,
        });
        setGateOpen(true);
        onComplete(data);
        onNext();
      }
    },
    [
      criterion?.type,
      isReady,
      isAuthenticated,
      onComplete,
      onNext,
      drill,
      block.id,
      sessionSlug,
    ],
  );

  // Conquer (self-report clean pass) → achieved tier = the brick's target.
  const handleConquer = useCallback(() => {
    const tier: MasteryTier = criterion?.targetTier ?? 'bronze';
    setConqueredTier(tier);
    drill.markConquered(block.id, tier);
    trackEvent('groove_conquered', {
      grooveId: block.id,
      role: config.role,
      tier,
      proxy: 'self_report',
    });
    if (isReady && isAuthenticated) {
      trackEvent('first_win', { grooveId: block.id, tier });
    }
    completeBrick('conquered', tier);
  }, [
    criterion?.targetTier,
    drill,
    block.id,
    config.role,
    isReady,
    isAuthenticated,
    completeBrick,
  ]);

  // Time/loops/manual met → mark done + advance.
  const handleCriterionDone = useCallback(() => {
    drill.markConquered(block.id, 'done');
    trackEvent('groove_conquered', {
      grooveId: block.id,
      role: config.role,
      criterion: criterion?.type,
      result: 'completed',
    });
    completeBrick('completed', null);
  }, [drill, block.id, config.role, criterion?.type, completeBrick]);

  // Release valve: "too hard — lay it anyway" → advance with a released result.
  const handleStepDown = useCallback(() => {
    trackEvent('groove_conquered', {
      grooveId: block.id,
      role: config.role,
      result: 'released',
    });
    completeBrick('released', null);
  }, [block.id, config.role, completeBrick]);

  // Keyboard shortcuts: ←/→ transpose (setKey), Space play/pause
  // (onPlayPause), M mute/unmute bass (setStemMuted). Each routes through
  // the same command as its on-screen control. Gated on isReady + a typing
  // guard. There's only ever one playable element on a page, so a single
  // global listener is unambiguous.
  useGrooveCardKeyboard({
    currentSemitones: playback.currentSemitones,
    setKey: playback.setKey,
    togglePlay: onPlayPause,
    toggleBassMute: onToggleBassMute,
    enabled: playback.isReady,
  });

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
    // A fresh cap-hit upsell wins briefly — it's the teaching moment.
    if (capUpsell) return capUpsell;
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
    capUpsell,
    hoverHint,
    config,
    isBassMuted,
    isSoloDrums,
    playback.isPlaying,
    playback.currentBpm,
    playback.pendingKeyShift,
  ]);

  // Clear the transient cap-hit upsell once the user moves on (hovers a
  // control or starts/stops playback) so it doesn't pin the caption.
  const clearCapUpsell = useCallback(() => setCapUpsell(null), []);

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
        masterVolume={playback.masterVolume}
        onMasterVolumeChange={playback.setMasterVolume}
        onMetronomeHover={(hovering) => {
          if (hovering) clearCapUpsell();
          setHoverHint(hovering ? 'metronome' : null);
        }}
        waveform={
          <GrooveCardWaveform
            isPlaying={playback.isPlaying}
            bassBuffer={playback.bassBuffer}
            audioContext={playback.audioContext}
            loopStartAudioTime={playback.loopStartAudioTime}
            loopDurationSeconds={playback.loopDurationSeconds}
            getAudioPhase={playback.getAudioPhase}
            lengthBars={config.lengthBars}
            loopSelection={playback.loopSelection}
            onLoopSelectionChange={playback.setLoopSelection}
            color={waveformColor}
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
            onHoverHint={(hint) => {
              if (hint) clearCapUpsell();
              setHoverHint(hint);
            }}
            enforceCaps={capsEnabled}
            lockSettings={isDrillBrick}
          />
        }
      />

      {isDrillBrick && (
        <>
          <ConquerOutcome
            criterionType={criterion?.type}
            progress={criterionRuntime.progress}
            isMet={criterionRuntime.isMet}
            doneTier={conqueredTier ?? drill.conquered[block.id] ?? null}
            isReady={playback.isReady}
            onConquer={handleConquer}
            onCriterionDone={handleCriterionDone}
            onStepDown={handleStepDown}
          />
          <SaveAccountGate
            open={gateOpen}
            onOpenChange={setGateOpen}
            grooveName={config.title}
          />
        </>
      )}
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
