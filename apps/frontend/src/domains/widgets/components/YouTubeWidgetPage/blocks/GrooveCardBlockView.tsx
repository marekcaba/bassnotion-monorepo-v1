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
import { GrooveCardChordRow } from './groove-card/GrooveCardChordRow';
import {
  GrooveCardControls,
  formatKeyLabel,
} from './groove-card/GrooveCardControls';
import { GrooveCardDynamicLoopDial } from './groove-card/GrooveCardDynamicLoopDial';
import { LinesAndFillsSection } from './groove-card/LinesAndFillsSection';
import {
  buildLinesAndFillsGroups,
  resolveComboVariantId,
  selectionForVariantId,
} from './groove-card/linesAndFills';
import { resolveFillRegionFractions } from './groove-card/fillRegion';
import {
  useDynamicLoop,
  buildCycleKeys,
  type DynamicLoopConfig,
} from './groove-card/useDynamicLoop';
import { useActiveGrooveCardStore } from '@/domains/playback/store/active-groove-card.store';
import {
  DEFAULT_PREVIEW_CAPTION,
  DEFAULT_STATE_CAPTIONS,
  HOVER_HINTS,
  type HoverHintKey,
} from './groove-card/captions';
import { useEntitlement } from '@/domains/billing/hooks/useEntitlement';
import {
  UpgradePitchContent,
  type UpgradeLever,
} from '@/domains/billing/components/UpgradePitch';
import { Popover, PopoverAnchor } from '@/shared/components/ui/popover';
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
  /** When true, the built-in "become a member" upsell popovers
   *  (UpgradePitchContent) are NOT rendered. The cap STILL bites (the lever
   *  stops at the band edge) and `onCapHit` still fires — the surface just
   *  doesn't show the in-card pitch. The public `/free` funnel uses this so
   *  it can reveal its own Sign up button instead of pitching membership. */
  suppressUpsell?: boolean;
  /** Fired whenever a capped lever hits its band edge (tempo / transpose /
   *  loopRange / deconstruction / dynamicLoop), in ADDITION to the internal
   *  upsell + the `cap_hit` analytics event. Lets an outer surface react to a
   *  cap — e.g. the `/free` page reveals its hidden Sign up button on first
   *  cap. Only fires when `enableCaps`/caps are active. */
  onCapHit?: (
    lever:
      | 'tempo'
      | 'transpose'
      | 'loopRange'
      | 'deconstruction'
      | 'dynamicLoop'
      | 'linesAndFills',
  ) => void;
}

export function GrooveCardBlockView({
  block,
  isCompleted,
  mode = 'block',
  countdownClickUrl,
  bg,
  waveformColor,
  onBeforePlay,
  onComplete,
  // onNext intentionally unused: drill bricks advance via the player's reactive
  // auto-advance effect (driven by onComplete → optimistic unlock), not a
  // self-fired scroll. Kept in the props interface for the BlockRenderer wiring.
  enableCaps = false,
  suppressUpsell = false,
  onCapHit: onCapHitExternal,
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
      // Chord chart resolves from the library (authored once per groove); a
      // per-block chordChart, if any, overrides it for one-off inline use.
      chordChart: rawConfig.chordChart ?? groove.chordChart,
      youtubeUrl: rawConfig.youtubeUrl ?? groove.youtubeUrl,
    });
  }, [rawConfig, groove]);

  // A groove card becomes a DRILL BRICK when its config carries a `role`
  // (groove/connecting/review) OR a `completionCriterion`. Drill bricks enforce
  // caps and show the ConquerOutcome bar (conquer / "I'm done" / release valve),
  // which is what advances the session. Plain tutorial/marketing cards have
  // neither and just play. NOTE: must match isDrillBrickBlock in
  // domains/drill/utils/drillBricks.ts — a criterion-only card (no role) still
  // needs its completion control, else the student is stranded with no button.
  const isDrillBrick =
    config.role != null || config.completionCriterion != null;
  // Caps apply on the whole in-app surface (mode 'block'): every groove card a
  // free user plays in /app is part of the capped free wall (tempo ±5 /
  // transpose ±2 / loop-range / deconstruction), and the cap is the upgrade
  // pitch. Members resolve uncapped. The separate marketing/waitlist card
  // (WaitlistGrooveCard, its own component) is untouched — it has its own hard
  // engine cap, not the entitlement band. `enableCaps`/`isDrillBrick` remain as
  // explicit opt-ins for any non-block surface that wants the band.
  const capsEnabled = mode === 'block' || enableCaps || isDrillBrick;

  // Entitlement caps — member → uncapped, anonymous/free → the unpaid band.
  const { caps } = useEntitlement({ enabled: capsEnabled });

  // Transient upsell caption shown when a capped lever hits its band edge.
  const [capUpsell, setCapUpsell] = useState<string | null>(null);
  // The cap is the pitch: the bumped lever (null = closed) drives an in-flow
  // popover anchored to that control. Keeps playback running — no modal. Only
  // the anchorable levers (no 'generic') ever set it.
  const [pitchLever, setPitchLever] = useState<Exclude<
    UpgradeLever,
    'generic'
  > | null>(null);

  const onCapHit = useCallback(
    (lever: 'tempo' | 'transpose' | 'loopRange') => {
      setCapUpsell(caps[lever]?.message ?? '');
      // Open the internal upsell popover unless the surface suppresses it
      // (the /free funnel does — it reveals its own Sign up button instead).
      if (!suppressUpsell) setPitchLever(lever);
      trackEvent('cap_hit', { lever, grooveId: block.id });
      onCapHitExternal?.(lever);
    },
    [caps, block.id, suppressUpsell, onCapHitExternal],
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

  // REACH-the-edge external notify (funnel surfaces only). The internal
  // `onCapHit` fires only when a step is CLIPPED (tried to go past the band).
  // But on a surface that greys the chevron AT the band edge (`suppressUpsell`
  // → dimAtCap), the user can't click past it, so the clipped event never
  // fires. So here we also notify the moment a lever simply REACHES its band
  // edge — keeping the revealed Sign up button in sync with the greying.
  // Guarded to funnel surfaces (suppressUpsell) so in-app behaviour (which
  // relies on the clipped-only signal) is untouched.
  const reachedTempoEdge =
    capsEnabled &&
    caps.tempo.isCapped &&
    caps.tempo.limit != null &&
    Math.abs(playback.currentBpm - config.originalBpm) >= caps.tempo.limit;
  const reachedTransposeEdge =
    capsEnabled &&
    caps.transpose.isCapped &&
    Math.abs(playback.currentSemitones) >= playback.transposeRange;
  useEffect(() => {
    if (!suppressUpsell) return;
    if (reachedTempoEdge) onCapHitExternal?.('tempo');
  }, [suppressUpsell, reachedTempoEdge, onCapHitExternal]);
  useEffect(() => {
    if (!suppressUpsell) return;
    if (reachedTransposeEdge) onCapHitExternal?.('transpose');
  }, [suppressUpsell, reachedTransposeEdge, onCapHitExternal]);

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
  // "Solo" isolates the BASS part (mutes drums + harmony) — the intuitive solo
  // for bass players. While soloing, the Mute button is inert (bass is what
  // you're hearing); a pre-existing bass mute persists THROUGH solo, so
  // releasing solo with mute on lands back in the muted-bass state.
  const isSoloBass = playback.soloedStem === 'audio-bass';

  const onToggleBassMute = useCallback(() => {
    // Mute is inert while soloing the bass (muting the soloed part = silence).
    if (isSoloBass) return;
    playback.setStemMuted('audio-bass', !isBassMuted);
  }, [playback, isBassMuted, isSoloBass]);

  // Solo is the one hard entitlement gate (the "deconstruction" cap). When
  // capped (free tier), the toggle pitches the upgrade instead of soloing —
  // same behaviour as the button — so the "S" shortcut routes here too. Solo
  // works even WHILE bass is muted (it isolates by muting the siblings; the
  // bass's own mute state is untouched and restored on release).
  const deconCapped = capsEnabled && caps.deconstruction.isCapped;
  const onToggleSolo = useCallback(() => {
    if (deconCapped) {
      if (!suppressUpsell) setPitchLever('deconstruction');
      trackEvent('cap_hit', { lever: 'deconstruction', grooveId: block.id });
      onCapHitExternal?.('deconstruction');
      return;
    }
    playback.setStemSolo(isSoloBass ? null : 'audio-bass');
  }, [
    deconCapped,
    playback,
    isSoloBass,
    block.id,
    suppressUpsell,
    onCapHitExternal,
  ]);

  // ── Dynamic Loop: auto key-cycle every N loops ──────────────────────────
  // Dynamic Loop is a MEMBERS-ONLY feature (caps.dynamicLoop):
  //  • The dial is SHOWN to everyone except drill bricks (where the key is
  //    author-prescribed + locked, so a user-driven cycle makes no sense) —
  //    free users in /app and funnel visitors see it too, so they discover it.
  //  • Engaging the cycle only works when UNCAPPED (member). When capped,
  //    engaging surfaces the upgrade pitch in-app, or reveals Sign up on the
  //    funnel — see onDynamicLoopEngagedChange.
  const dynamicLoopCapped = capsEnabled && caps.dynamicLoop.isCapped;
  const dynamicLoopUsable = !isDrillBrick && !dynamicLoopCapped;
  // Visible to everyone except drill bricks (members use it; free/funnel see it
  // and get the upgrade moment on engage).
  const dynamicLoopShown = !isDrillBrick;
  const dynamicLoopAvailable = dynamicLoopUsable;

  // Per-card, in-memory config (no persistence — reload resets to defaults).
  const [dynamicLoopConfig, setDynamicLoopConfig] = useState<DynamicLoopConfig>(
    // Default: ping-pong up a minor 3rd (+3) every 1 loop — change key each
    // loop. Interval is RELATIVE to wherever the user sets the key; mode
    // defaults to the simple 2-key ping-pong.
    { intervalSemitones: 3, everyN: 1, mode: 'ping-pong' },
  );
  const [dynamicLoopEngaged, setDynamicLoopEngaged] = useState(false);

  // Engage handler with the membership gate. When the dial is SHOWN but the
  // cycle isn't USABLE (capped free tier), trying to ENGAGE is the upgrade
  // moment — the feature is visible + explorable, switching it on is gated:
  //   • funnel (suppressUpsell): reveal the Sign up button.
  //   • in-app: open the existing upgrade pitch popover on the dial.
  // Disengaging (next === false) always passes through. Members fall straight
  // to the plain setter.
  const onDynamicLoopEngagedChange = useCallback(
    (next: boolean) => {
      if (next && !dynamicLoopUsable) {
        trackEvent('cap_hit', { lever: 'dynamicLoop', grooveId: block.id });
        if (suppressUpsell) {
          onCapHitExternal?.('dynamicLoop');
        } else {
          setCapUpsell(caps.dynamicLoop.message ?? '');
          setPitchLever('dynamicLoop');
        }
        return;
      }
      setDynamicLoopEngaged(next);
    },
    [dynamicLoopUsable, suppressUpsell, onCapHitExternal, caps, block.id],
  );

  // ── Lines & Fills (premium alternate-bassline swap) ----------------------
  // Same shape as Dynamic Loop: the section is SHOWN (when there are variants
  // and caps are active) so it's discoverable, but SELECTING a variant is gated.
  // Default-bass (null) is always free — only the premium variants gate.
  const bassVariants = config.stems.bassVariants ?? [];
  const linesAndFillsCapped = capsEnabled && caps.linesAndFills.isCapped;
  // Render only on surfaces that meter caps (so the waitlist demo, capsEnabled
  // false, never shows it), and only when the groove actually has variants. On
  // drill bricks the bass part is author-prescribed, so hide it there too.
  const linesAndFillsShown =
    capsEnabled && !isDrillBrick && bassVariants.length > 0;

  // Lines grouped with their own fills, and the current (line, fill) selection
  // derived from the active variant id (single source of truth —
  // playback.activeBassVariantId; no parallel state).
  const linesAndFillsGroups = useMemo(
    () => buildLinesAndFillsGroups(bassVariants),
    [bassVariants],
  );
  const activeSelection = useMemo(
    () => selectionForVariantId(bassVariants, playback.activeBassVariantId),
    [bassVariants, playback.activeBassVariantId],
  );

  // The active fill's region as fractional bars, for the waveform highlight.
  // Only the active variant (a fill take with a fillRegion) lights up; the plain
  // line / "No fill" / default bass resolve to null → no band.
  const activeFillRegion = useMemo(() => {
    const active = bassVariants.find(
      (v) => v.id === playback.activeBassVariantId,
    );
    return resolveFillRegionFractions(
      active?.fillRegion ?? null,
      config.lengthBars ?? 0,
    );
  }, [bassVariants, playback.activeBassVariantId, config.lengthBars]);

  // Apply a (line, fill) selection: resolve the matching pre-rendered take and
  // swap it on the next bar. The built-in Bass A + no-fill combo is the free
  // state (null → restore stems.bass); any other take is premium and gates when
  // capped. An unexported combo (resolver → undefined) is a no-op.
  const onSelectLineFill = useCallback(
    (lineId: string, fillId: string) => {
      const variantId = resolveComboVariantId(bassVariants, lineId, fillId);
      if (variantId === undefined) return; // no take for this combo — ignore
      if (variantId === null) {
        playback.setBassVariant(null); // free: back to built-in bass
        return;
      }
      if (linesAndFillsCapped) {
        trackEvent('cap_hit', { lever: 'linesAndFills', grooveId: block.id });
        if (suppressUpsell) {
          onCapHitExternal?.('linesAndFills');
        } else {
          setCapUpsell(caps.linesAndFills.message ?? '');
          setPitchLever('linesAndFills');
        }
        return;
      }
      playback.setBassVariant(variantId);
    },
    [
      bassVariants,
      linesAndFillsCapped,
      suppressUpsell,
      onCapHitExternal,
      caps,
      block.id,
      playback,
    ],
  );

  // Chord strip is opt-in: hidden until the user toggles the header chord icon.
  const [showChords, setShowChords] = useState(false);

  const dynamicLoop = useDynamicLoop({
    engaged: dynamicLoopEngaged && dynamicLoopAvailable,
    isPlaying: playback.isPlaying,
    isCountingDown: playback.countdownState.isCountingDown,
    config: dynamicLoopConfig,
    // HOME = the user's current manual key (the stepper value). The cycle
    // plays THIS key first, then transposes to the target and back — captured
    // at engage time inside the hook.
    homeSemitones: playback.currentSemitones,
    maxSemitones: playback.transposeRange,
    setKey: playback.setKey,
    getNextSeamTime: playback.getNextSeamTime,
    getCurrentTime: playback.getCurrentTime,
  });

  // Next-key preview label for the controls' "current → next" display.
  //  - Engaged + PLAYING: the live nextSemitones from the hook (advances each
  //    loop through every key in the cycle).
  //  - Engaged but NOT yet playing: the FIRST cycle step computed from the
  //    config (home + interval), so engaging the dial is a CUE that previews
  //    where the cycle will go BEFORE the user hits play.
  //  - Not engaged: null (plain stepper).
  const dynamicLoopEngagedAvailable =
    dynamicLoopEngaged && dynamicLoopAvailable;
  const nextKeyLabel = useMemo(() => {
    if (!dynamicLoopEngagedAvailable) return null;
    const nextSemis = dynamicLoop.isActive
      ? dynamicLoop.nextSemitones
      : // Stopped preview: the first key the cycle moves to from the user's
        // current key. buildCycleKeys[0] is home, [1] is the first move.
        (buildCycleKeys(
          dynamicLoopConfig,
          playback.currentSemitones,
          playback.transposeRange,
        )[1] ?? playback.currentSemitones);
    return formatKeyLabel(config.originalKey, nextSemis);
  }, [
    dynamicLoopEngagedAvailable,
    dynamicLoop.isActive,
    dynamicLoop.nextSemitones,
    dynamicLoopConfig,
    playback.currentSemitones,
    playback.transposeRange,
    config.originalKey,
  ]);

  // Multi-card pages share one engine: when another card steals active focus,
  // this card's audio is silently stopped — so disengage our cycle, else it
  // keeps firing setKey against the engine the other card now owns. Also
  // covers the simple "card unmounts / loses focus" case.
  const activeCardId = useActiveGrooveCardStore((s) => s.activeCardId);
  useEffect(() => {
    if (
      dynamicLoopEngaged &&
      activeCardId !== null &&
      activeCardId !== block.id
    ) {
      setDynamicLoopEngaged(false);
    }
  }, [activeCardId, block.id, dynamicLoopEngaged]);

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
      // No scroll here — the player auto-advances reactively once onComplete
      // marks this brick done + unlocks the next block (see the drill
      // auto-advance effect in YouTubeWidgetPage). A single action advances.
      if (isReady && isAuthenticated) {
        onComplete(data);
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
      }
    },
    [
      criterion?.type,
      isReady,
      isAuthenticated,
      onComplete,
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

  // Keyboard shortcuts: ←/→ transpose (setKey), ↑/↓ tempo (setTempo), Space
  // play/pause (onPlayPause), M mute/unmute bass (setStemMuted). Each routes
  // through the same command as its on-screen control. Gated on isReady + a
  // typing guard. There's only ever one playable element on a page, so a
  // single global listener is unambiguous.
  useGrooveCardKeyboard({
    currentSemitones: playback.currentSemitones,
    setKey: playback.setKey,
    currentBpm: playback.currentBpm,
    setTempo: playback.setTempo,
    togglePlay: onPlayPause,
    toggleBassMute: onToggleBassMute,
    toggleSoloDrums: onToggleSolo,
    // "L" engages the loop — only where it's offered (no-op on drill bricks /
    // capped free tier, matching the dial's availability).
    toggleDynamicLoop: () => {
      if (dynamicLoopAvailable) setDynamicLoopEngaged((v) => !v);
    },
    enabled: playback.isReady,
    // While the cycle is running, it owns the key — disable manual ←/→.
    lockTranspose: dynamicLoop.isActive,
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
    // Dynamic Loop status — show the next key + how many loops until it lands,
    // so the player can hear what's coming. Wins over the generic "Playing…".
    if (dynamicLoop.isActive) {
      const nextLabel = formatKeyLabel(
        config.originalKey,
        dynamicLoop.nextSemitones,
      );
      const n = dynamicLoop.loopsRemaining;
      return `Dynamic loop · → ${nextLabel} in ${n} ${n === 1 ? 'loop' : 'loops'}`;
    }
    if (playback.isPlaying) return 'Playing…';

    const sc = config.stateCaptions ?? {};
    const pick = (key: keyof typeof DEFAULT_STATE_CAPTIONS): string =>
      sc[key] ?? DEFAULT_STATE_CAPTIONS[key];

    if (isSoloBass) return pick('solo-drums');
    if (isBassMuted) return pick('mute-bass');
    // NOTE: the 'key-change' caption is intentionally NOT shown here. It's only
    // ever reached while STOPPED (the isPlaying short-circuit above wins during
    // playback), and when stopped a key change applies immediately — there's
    // nothing "queued". pendingKeyShift also clears on the next tick when
    // stopped, so reacting to it here flickered the caption on every ←/→ press.
    if (playback.currentBpm !== config.originalBpm) return pick('tempo-change');
    return config.previewCaption ?? DEFAULT_PREVIEW_CAPTION;
  }, [
    capUpsell,
    hoverHint,
    config,
    isBassMuted,
    isSoloBass,
    playback.isPlaying,
    playback.currentBpm,
    dynamicLoop.isActive,
    dynamicLoop.nextSemitones,
    dynamicLoop.loopsRemaining,
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
        masterVolume={playback.masterVolume}
        onMasterVolumeChange={playback.setMasterVolume}
        // Chord strip: opt-in via the header chord icon (always present).
        chordsVisible={showChords}
        onToggleChords={() => setShowChords((v) => !v)}
        headerExtra={
          dynamicLoopShown ? (
            // Members-only engage gate: when capped (free in-app), engaging the
            // dial pitches the upgrade in its OWN popover anchored here. On the
            // funnel (suppressUpsell) the popover is suppressed and the Sign up
            // button reveals instead.
            <Popover
              open={!suppressUpsell && pitchLever === 'dynamicLoop'}
              onOpenChange={(o) => {
                if (!o) setPitchLever(null);
              }}
            >
              <PopoverAnchor asChild>
                <div>
                  <GrooveCardDynamicLoopDial
                    config={dynamicLoopConfig}
                    onConfigChange={setDynamicLoopConfig}
                    // When the cycle isn't usable (capped) the toggle reflects
                    // "not engaged" and tapping Engage routes through
                    // onDynamicLoopEngagedChange → upgrade pitch / Sign up.
                    engaged={dynamicLoopEngaged && dynamicLoopUsable}
                    onEngagedChange={onDynamicLoopEngagedChange}
                    maxSemitones={playback.transposeRange}
                    disabled={!playback.isReady}
                    onHover={(hovering) => {
                      if (hovering) clearCapUpsell();
                      setHoverHint(hovering ? 'dynamic-loop' : null);
                    }}
                  />
                </div>
              </PopoverAnchor>
              {!suppressUpsell && pitchLever === 'dynamicLoop' && (
                <UpgradePitchContent
                  lever="dynamicLoop"
                  message={capUpsell ?? undefined}
                  side="bottom"
                />
              )}
            </Popover>
          ) : undefined
        }
        chordRow={
          // The chord chart (resolved from the groove library) with the current
          // chord highlighted as the player plays. Omitted entirely when the
          // groove has no chart (so the shell skips the row + its padding).
          config.chordChart && config.chordChart.length > 0 ? (
            <GrooveCardChordRow
              chordChart={config.chordChart}
              lengthBars={config.lengthBars}
              isPlaying={playback.isPlaying}
              loopSelection={playback.loopSelection}
              getAudioPhase={playback.getAudioPhase}
              audioContext={playback.audioContext}
              loopStartAudioTime={playback.loopStartAudioTime}
              originalKey={config.originalKey}
              // The chord row latches each loop cycle's key from this queued
              // target (set by both the manual stepper and the dynamic loop's
              // pre-queue), so chords transpose in sync with the audio.
              currentSemitones={playback.currentSemitones}
              // Chains FUTURE loop cycles forward through the dynamic loop's
              // schedule (ping-pong flip / travel-ladder rung) so the strip
              // reads as one continuous transposing line. Identity when the
              // loop is inactive (no further key changes are scheduled).
              advanceCycleKey={dynamicLoop.advanceCycleKey}
              // The ribbon lives in the header's middle column (between the
              // title and controls); the now-line is centered in that space.
              align="center"
            />
          ) : undefined
        }
        waveform={
          // The loop-range cap fires from a bar drag ON the waveform, so its
          // pitch anchors HERE (not the controls row). Own Popover, open only
          // for the loopRange lever — pops next to the bars the user selected.
          <Popover
            open={!suppressUpsell && pitchLever === 'loopRange'}
            onOpenChange={(o) => {
              if (!o) setPitchLever(null);
            }}
          >
            <PopoverAnchor asChild>
              <div>
                <GrooveCardWaveform
                  isPlaying={playback.isPlaying}
                  bassBuffer={playback.bassBuffer}
                  audioContext={playback.audioContext}
                  loopStartAudioTime={playback.loopStartAudioTime}
                  loopDurationSeconds={playback.loopDurationSeconds}
                  getAudioPhase={playback.getAudioPhase}
                  lengthBars={config.lengthBars}
                  loopSelection={playback.loopSelection}
                  fillRegion={activeFillRegion}
                  onLoopSelectionChange={playback.setLoopSelection}
                  color={waveformColor}
                  countdownBeat={
                    playback.countdownState.isCountingDown
                      ? playback.countdownState.currentBeat
                      : null
                  }
                />
              </div>
            </PopoverAnchor>
            {pitchLever === 'loopRange' && (
              <UpgradePitchContent
                lever="loopRange"
                message={capUpsell ?? undefined}
                side="bottom"
              />
            )}
          </Popover>
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
            isSoloDrums={isSoloBass}
            // While soloing the bass, the Mute button is inert (you're hearing
            // only bass; muting it = silence). Solo itself stays usable while
            // muted, so it's not disabled here.
            muteDisabled={isSoloBass}
            onPlayPause={onPlayPause}
            onTempoChange={playback.setTempo}
            onKeyChange={playback.setKey}
            onMuteBass={(muted) => playback.setStemMuted('audio-bass', muted)}
            onSoloDrums={(solo) =>
              playback.setStemSolo(solo ? 'audio-bass' : null)
            }
            onDeconCapHit={() => {
              if (!suppressUpsell) setPitchLever('deconstruction');
              trackEvent('cap_hit', {
                lever: 'deconstruction',
                grooveId: block.id,
              });
              onCapHitExternal?.('deconstruction');
            }}
            onHoverHint={(hint) => {
              if (hint) clearCapUpsell();
              setHoverHint(hint);
            }}
            enforceCaps={capsEnabled}
            lockSettings={isDrillBrick}
            lockKey={dynamicLoop.isActive}
            // The effective transpose edge + whether it's the entitlement band.
            // For a member the edge is the engine's ±6 → the chevron dims there
            // (no "become a member" pitch at the real end of the range). For a
            // capped free user the chevron stays live at the band edge so the
            // bump surfaces the upgrade pitch.
            transposeRange={playback.transposeRange}
            transposeCapped={capsEnabled && caps.transpose.isCapped}
            // Funnel surfaces (suppressUpsell) grey the tempo + key chevrons at
            // the band edge instead of pitching membership. originalBpm centres
            // the tempo band. In-app leaves dimAtCap off (live chevron + pitch).
            dimAtCap={suppressUpsell}
            originalBpm={config.originalBpm}
            // Next-key preview: appears the moment the dial is ENGAGED (a cue
            // showing where the cycle will go, even before play), then updates
            // live through every key once playing. Computed above.
            nextKeyLabel={nextKeyLabel}
            // loopRange anchors to the WAVEFORM, dynamicLoop to the header DIAL,
            // and linesAndFills to its own SECTION (all handled above), not the
            // controls row — so the controls popover ignores them. When the
            // surface suppresses the upsell (/free funnel), force null so the
            // controls popover never opens.
            pitchLever={
              suppressUpsell ||
              pitchLever === 'loopRange' ||
              pitchLever === 'dynamicLoop' ||
              pitchLever === 'linesAndFills'
                ? null
                : pitchLever
            }
            onPitchOpenChange={(open) => {
              if (!open) setPitchLever(null);
            }}
            pitchContent={
              pitchLever &&
              pitchLever !== 'loopRange' &&
              pitchLever !== 'dynamicLoop' ? (
                <UpgradePitchContent
                  lever={pitchLever}
                  message={capUpsell ?? undefined}
                />
              ) : null
            }
          />
        }
      />

      {/* Lines & Fills — premium alternate-bassline swap. Anchored upsell
          popover mirrors the Dynamic Loop dial pattern. */}
      {linesAndFillsShown && (
        <Popover
          open={!suppressUpsell && pitchLever === 'linesAndFills'}
          onOpenChange={(o) => {
            if (!o) setPitchLever(null);
          }}
        >
          <PopoverAnchor asChild>
            <div>
              <LinesAndFillsSection
                groups={linesAndFillsGroups}
                activeLineId={activeSelection.lineId}
                activeFillId={activeSelection.fillId}
                locked={linesAndFillsCapped}
                onSelect={onSelectLineFill}
              />
            </div>
          </PopoverAnchor>
          {!suppressUpsell && pitchLever === 'linesAndFills' && (
            <UpgradePitchContent
              lever="linesAndFills"
              message={capUpsell ?? undefined}
              side="bottom"
            />
          )}
        </Popover>
      )}

      {isDrillBrick && (
        <>
          <ConquerOutcome
            criterionType={criterion?.type}
            progress={criterionRuntime.progress}
            isMet={criterionRuntime.isMet}
            // "Done" derives from the SERVER (isCompleted), not the persisted
            // store — clearing block_completions must un-stick the card. The
            // store's conquered map only supplies the tier DETAIL for display,
            // and conqueredTier is the just-now optimistic value before the
            // server round-trip lands.
            doneTier={
              conqueredTier ??
              (isCompleted ? (drill.conquered[block.id] ?? 'done') : null)
            }
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
