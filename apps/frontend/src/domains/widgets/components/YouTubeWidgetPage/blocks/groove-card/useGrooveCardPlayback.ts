'use client';

/**
 * useGrooveCardPlayback — LAUNCH-02.5c orchestration hook.
 *
 * Single place the Groove Card touches `PlaybackEngine`. UI components
 * (Shell, Controls, Waveform) consume the reactive state and call the
 * imperative commands; they never see PlaybackEngine or Tone directly.
 *
 * Consumes the 02.5b engine surface:
 *   - playbackEngine.setAudioStemBuffers({...})
 *   - playbackEngine.registerTracks([...])   (one per stem, audio-bass etc.)
 *   - playbackEngine.unregisterTracksByPrefix(`${cardId}#`)
 *   - playbackEngine.setInstrumentMuted('audio-bass' | ..., bool)
 *   - playbackEngine.setInstrumentVolume('audio-bass' | ..., 0..1)
 *
 * Tempo flows through `musicalTruth.setBPM(bpm)` (the single source of
 * truth at MusicalTruthAuthority); the hook subscribes so external BPM
 * changes also propagate to local state.
 *
 * Key changes update a pending offset; the actual stem-buffer swap +
 * residual PitchShift land at the next loop boundary via 02.5b's
 * `scheduleInfiniteAudioRegion`.
 *
 * Solo is local React state. The engine has no setSoloInstrument; we
 * sibling-mute via setInstrumentMuted — same pattern as
 * BassLineWidget/useVolumeControl.ts:103.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  GrooveCardBlockConfig,
  GrooveCardKeySet,
} from '@bassnotion/contracts';
import type { AudioInstrumentType } from '@/domains/playback/modules/tracks/management/TrackManagerProcessor';
import { audioInstrumentTypeToStemKey } from '@/domains/playback/modules/tracks/management/TrackManagerProcessor';
import { musicalTruth } from '@/domains/playback/modules/tempo/MusicalTruthAuthority';
import { useTransportControlsSafe } from '@/domains/playback/contexts/TransportContext';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry';
import { useActiveGrooveCardStore } from '@/domains/playback/store/active-groove-card.store';
import {
  useCountdown,
  type CountdownState,
} from '@/domains/widgets/hooks/useCountdown';
import { pickKeySet, type KeySetIndex } from './pickKeySet';
import { useGrooveCardStemPreload } from './useGrooveCardStemPreload';
import { trackWaitlistKeyCapHit } from './telemetry';

export type GrooveCardMode = 'block' | 'waitlist';

// Musical stems uploaded + preloaded + registered per key set. The
// metronome click is NOT here: it's a fixed shared metronome (MIDI
// track in /app, single bundled sample on the waitlist) injected into
// the engine's `audio-click` channel separately — never per key set.
const MUSICAL_STEMS = [
  'audio-bass',
  'audio-drums',
  'audio-harmony',
] as const satisfies readonly AudioInstrumentType[];

export interface UseGrooveCardPlaybackOptions {
  /** The Groove Card block config — drives every defaulted value. */
  block: GrooveCardBlockConfig;
  /** Unique card ID. Track IDs are namespaced by it. Typically the
   *  TutorialBlock.id of the host block. */
  cardId: string;
  /** Rendering mode — 'block' uses the in-app audio bootstrap (the
   *  TransportProvider provides PlaybackEngine via WindowRegistry).
   *  'waitlist' wires through 02.5d's WaitlistAudioBootstrap. */
  mode?: GrooveCardMode;
  /** Optional bundled-click URL used in waitlist mode (02.5d). In block
   *  mode the existing countdown MIDI metronome track is reused. */
  countdownClickUrl?: string;
}

export interface UseGrooveCardPlaybackReturn {
  // ── state
  isLoading: boolean;
  isReady: boolean;
  isPlaying: boolean;
  currentBpm: number;
  /** Active semitone offset relative to originalKey. */
  currentSemitones: number;
  mutedStems: Set<AudioInstrumentType>;
  soloedStem: 'audio-drums' | null;
  clickEnabled: boolean;
  /** Pending semitone offset queued for the next loop boundary, or null
   *  when no swap is queued. */
  pendingKeyShift: number | null;

  // ── commands (all idempotent)
  play: () => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  setTempo: (bpm: number) => void;
  setKey: (semitonesFromOriginal: number) => void;
  setStemMuted: (stem: AudioInstrumentType, muted: boolean) => void;
  setStemSolo: (stem: 'audio-drums' | null) => void;
  setClickEnabled: (enabled: boolean) => void;

  // ── lifecycle (used by active-card store coordination)
  becomeActive: () => void;
  becomeInactive: () => void;

  // ── waveform display data --------------------------------------------------
  /** The currently active bass AudioBuffer — the source the card visualises
   *  in the waveform window. Null until preload completes. */
  bassBuffer: AudioBuffer | null;
  /** The AudioContext used for playback; the waveform reads currentTime
   *  off this to position the playhead. */
  audioContext: AudioContext | null;
  /** Audio-context time (seconds) when the current loop iteration started.
   *  null when not playing. Used by the waveform to compute playhead
   *  position via (audioContext.currentTime - loopStartAudioTime) %
   *  loopDurationSeconds / loopDurationSeconds. */
  loopStartAudioTime: number | null;
  /** Duration of one loop iteration in seconds (computed from lengthBars
   *  and current BPM). */
  loopDurationSeconds: number;

  // ── visual count-in --------------------------------------------------------
  /** Counts 1-2-3-4 during the metronome count-in bar. The play button
   *  renders countdownState.currentBeat as a number while
   *  countdownState.isCountingDown is true (and currentBeat > 0). */
  countdownState: CountdownState;
}

const TEMPO_MIN = 50;
const TEMPO_MAX = 180;

// LAUNCH-02.5c: full range inside /app. LAUNCH-02.5d caps the waitlist
// surface at ±4 because (a) waitlist loads only the default key set so
// the residual PitchShift past ±4 is the full delivered range, and (b)
// the cap acts as a CTA — "full range in app".
export const KEY_RANGE_BLOCK = 12;
export const KEY_RANGE_WAITLIST = 4;

function clampTempo(bpm: number): number {
  return Math.max(TEMPO_MIN, Math.min(TEMPO_MAX, Math.round(bpm)));
}

function clampKey(semitones: number, maxRange: number): number {
  return Math.max(-maxRange, Math.min(maxRange, Math.round(semitones)));
}

function findDefaultKeySetIndex(
  keys: readonly GrooveCardKeySet[],
): KeySetIndex {
  const idx = keys.findIndex((k) => k.isDefault);
  // Fallback to the 0-offset slot if `isDefault` isn't marked.
  if (idx === -1) {
    const zeroIdx = keys.findIndex((k) => k.semitoneOffset === 0);
    return (zeroIdx === -1 ? 2 : zeroIdx) as KeySetIndex;
  }
  return idx as KeySetIndex;
}

/**
 * Lightweight Tone.Transport handle used as a fallback when there is no
 * <TransportProvider> on the tree (LAUNCH-02.5d's waitlist surface).
 * Returns `null` when Tone.js is not loaded yet — the hook silently
 * no-ops in that window.
 */
function getToneTransportFallback(): {
  start: () => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  isPlaying: boolean;
} | null {
  if (typeof window === 'undefined') return null;
  const Tone =
    (window as typeof window & { Tone?: any; __globalTone?: any }).Tone ??
    (window as typeof window & { Tone?: any; __globalTone?: any }).__globalTone;
  if (!Tone?.getTransport) return null;
  const transport = Tone.getTransport();
  return {
    start: async () => {
      // Tone requires the global audio context to be started before
      // Transport can start. Tone.start() is idempotent.
      try {
        await Tone.start?.();
      } catch {
        // already started — ignore
      }
      transport.start();
    },
    pause: async () => {
      transport.pause();
    },
    stop: async () => {
      transport.stop();
    },
    isPlaying: transport.state === 'started',
  };
}

export function useGrooveCardPlayback({
  block,
  cardId,
  mode = 'block',
  countdownClickUrl: _countdownClickUrl,
}: UseGrooveCardPlaybackOptions): UseGrooveCardPlaybackReturn {
  void _countdownClickUrl; // consumed by 02.5d's WaitlistAudioBootstrap

  // LAUNCH-02.5d: the waitlist surface does not mount <TransportProvider>.
  // useTransportControlsSafe returns undefined there; fall back to driving
  // Tone.getTransport() directly.
  const transportFromContext = useTransportControlsSafe();
  const transport = useMemo(() => {
    if (transportFromContext) return transportFromContext;
    return (
      getToneTransportFallback() ?? {
        start: async () => undefined,
        pause: async () => undefined,
        stop: async () => undefined,
        isPlaying: false,
      }
    );
  }, [transportFromContext]);
  const activeStore = useActiveGrooveCardStore();
  const trackPrefix = `${cardId}#`;

  // LAUNCH-02.5d: tighter key cap on the waitlist surface — the marketing
  // page loads only the default key set so a residual past ±4 is the cost
  // of the lever; ±4 also reads cleanly as a CTA ("full range in app").
  const keyRange = mode === 'waitlist' ? KEY_RANGE_WAITLIST : KEY_RANGE_BLOCK;

  // ── state -----------------------------------------------------------------
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBpm, setCurrentBpm] = useState<number>(block.originalBpm);
  const [currentSemitones, setCurrentSemitones] = useState(0);
  const [pendingKeyShift, setPendingKeyShift] = useState<number | null>(null);
  const [mutedStems, setMutedStems] = useState<Set<AudioInstrumentType>>(() => {
    // Click is muted by default per the story spec.
    return new Set(['audio-click']);
  });
  const [soloedStem, setSoloedStem] = useState<'audio-drums' | null>(null);
  const [clickEnabled, setClickEnabledState] = useState(false);
  // Audio-context time at which the first stem-loop iteration started. Used
  // by the waveform to sweep a playhead across one loop length and wrap at
  // the boundary. null when stopped (the waveform draws static peaks only).
  const [loopStartAudioTime, setLoopStartAudioTime] = useState<number | null>(
    null,
  );

  // Visual count-in (1-2-3-4 inside the play button). Mirrors the YouTube
  // tutorial player pattern (usePlaybackControl + PlaybackControlsBar): the
  // audible click is owned by the engine (engine.addCountdownRegion), and
  // useCountdown runs an independent setInterval anchored to the same BPM +
  // AudioContext for the visual ticker. Both kick off in play() below.
  const { countdownState, startCountdown, cancelCountdown } = useCountdown({
    timeSignature: { numerator: 4, denominator: 4 },
  });

  // Track which key sets we want preloaded. Story spec:
  //   default on mount → adjacent (±4) on first play → outer (±8) on
  //   first cross-over.
  const defaultKeySetIndex = useMemo(
    () => findDefaultKeySetIndex(block.keys),
    [block.keys],
  );
  const [keySetIndicesToLoad, setKeySetIndicesToLoad] = useState<
    readonly number[]
  >([defaultKeySetIndex]);

  // ── audio context + preload ----------------------------------------------
  // Read the live context from WindowRegistry each render rather than
  // snapshotting at mount. During dev Fast Refresh (and the AudioProvider
  // double-mount) the first AudioContext can be closed and replaced; a
  // snapshot would leave us decoding/playing against a dead context. We
  // keep the last known-good ref but refresh it whenever the registry hands
  // back a different, non-closed context.
  const audioContextRef = useRef<AudioContext | null>(null);
  if (typeof window !== 'undefined') {
    const live = WindowRegistry.getAudioContext();
    const current = audioContextRef.current;
    const currentClosed = current?.state === 'closed';
    if (live && live !== current && (currentClosed || !current)) {
      audioContextRef.current = live;
    } else if (!current && live) {
      audioContextRef.current = live;
    }
  }

  const preload = useGrooveCardStemPreload({
    audioContext: audioContextRef.current,
    keys: block.keys,
    keySetIndicesToLoad,
    preloadOnMount: true,
  });

  const isReady = preload.isPreloaded;
  const isLoading = !isReady && preload.totalCount > 0;

  // ── tempo: the groove card OWNS its tempo. ------------------------------
  // The block was authored at block.originalBpm (e.g. 133); the global
  // musicalTruth defaults to 120. Push the groove's tempo into musicalTruth
  // on mount so the transport runs at the groove's BPM rather than the
  // default — then subscribe so the stepper / any external change keeps
  // local state honest. We do NOT pull the global default into currentBpm
  // (that's what made the UI read 120 instead of the saved tempo).
  useEffect(() => {
    musicalTruth.setBPM?.(clampTempo(block.originalBpm));
    setCurrentBpm(block.originalBpm);
    const unsub = musicalTruth.subscribe?.((truth) => {
      setCurrentBpm(truth.bpm);
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
    // block.originalBpm is stable per card; re-running on change is correct.
  }, [block.originalBpm]);

  const setTempo = useCallback((bpm: number) => {
    const clamped = clampTempo(bpm);
    musicalTruth.setBPM(clamped);
  }, []);

  // ── key: queue swap for the next loop boundary ---------------------------
  const setKey = useCallback(
    (semitonesFromOriginal: number) => {
      const rounded = Math.round(semitonesFromOriginal);
      const desired = clampKey(rounded, keyRange);

      // LAUNCH-02.5d: cap-as-CTA. When a waitlist visitor's request
      // exceeds the ±4 cap, swallow the input AND emit the telemetry
      // event the funnel team needs to measure conversion from "tap
      // the cap" → signup. In 'block' mode the range is ±12 so this
      // branch only fires past the natural musical range — no event.
      const exceededCap = rounded !== desired;
      if (exceededCap && mode === 'waitlist') {
        trackWaitlistKeyCapHit({
          blockId: cardId,
          valueAttempted: rounded,
        });
        return;
      }

      if (desired === currentSemitones && pendingKeyShift === null) return;
      // V1 behaviour: settle currentSemitones immediately for the UI
      // (the visible stepper value matches the user's intent right
      // away). The pendingKeyShift flag remains briefly so the caption
      // can show "queued for next loop". A follow-up will wire
      // pendingKeyShift to RegionScheduler's resolvePendingBuffer
      // closure so the actual stem-buffer swap respects the boundary,
      // and only then will currentSemitones be flipped from inside the
      // boundary callback.
      setPendingKeyShift(desired);
      setCurrentSemitones(desired);

      // Decide which key set the desired offset will land on and lazily
      // expand the preload set so the buffer is ready by boundary time.
      // In waitlist mode we only ever serve the default key set; skip
      // the lazy expansion so the marketing page never fetches the
      // outer (±8) keys.
      if (mode !== 'waitlist') {
        const { keySetIndex } = pickKeySet(desired);
        setKeySetIndicesToLoad((prev) => {
          if (prev.includes(keySetIndex)) return prev;
          return [...prev, keySetIndex];
        });
      }
    },
    [cardId, currentSemitones, keyRange, mode, pendingKeyShift],
  );

  // ── stem mute / solo via sibling-muting (story line 302) -----------------
  const writeMuteToEngine = useCallback(
    (stem: AudioInstrumentType, muted: boolean) => {
      const engine = WindowRegistry.getPlaybackEngine();
      engine?.setInstrumentMuted?.(stem, muted);
    },
    [],
  );

  const setStemMuted = useCallback(
    (stem: AudioInstrumentType, muted: boolean) => {
      setMutedStems((prev) => {
        const next = new Set(prev);
        if (muted) next.add(stem);
        else next.delete(stem);
        return next;
      });
      writeMuteToEngine(stem, muted);
    },
    [writeMuteToEngine],
  );

  const setStemSolo = useCallback(
    (stem: 'audio-drums' | null) => {
      setSoloedStem(stem);
      if (stem === 'audio-drums') {
        // Sibling-mute bass + harmony; preserve click's current setting.
        writeMuteToEngine('audio-bass', true);
        writeMuteToEngine('audio-harmony', true);
      } else {
        // Releasing solo: restore bass + harmony to their pre-solo
        // mutedStems state (NOT just to unmuted — the user may have
        // muted bass independently before tapping solo).
        const bassMuted = mutedStems.has('audio-bass');
        const harmonyMuted = mutedStems.has('audio-harmony');
        writeMuteToEngine('audio-bass', bassMuted);
        writeMuteToEngine('audio-harmony', harmonyMuted);
      }
    },
    [mutedStems, writeMuteToEngine],
  );

  const setClickEnabled = useCallback(
    (enabled: boolean) => {
      setClickEnabledState(enabled);
      // The "click enabled" toggle is the mute-state of the audio-click
      // stem (inverse). When enabled === true, the stem is UN-muted.
      setStemMuted('audio-click', !enabled);
    },
    [setStemMuted],
  );

  // ── lifecycle: active-card coordination ---------------------------------
  const registerStemTracks = useCallback(() => {
    const engine = WindowRegistry.getPlaybackEngine();
    if (!engine) return;

    // Push the default key set's 3 musical stems into the engine so
    // AudioPlayerScheduler can fire them. The audio-click channel is
    // not sourced here — it's the shared metronome (MIDI in /app, a
    // bundled sample on the waitlist injected via setAudioStemBuffers
    // by WaitlistGrooveCard).
    const buffers: Partial<Record<AudioInstrumentType, AudioBuffer>> = {};
    for (const instrumentType of MUSICAL_STEMS) {
      const stemKey = audioInstrumentTypeToStemKey(instrumentType);
      const buf = preload.getBuffer(defaultKeySetIndex, stemKey);
      if (buf) buffers[instrumentType] = buf;
    }
    if (Object.keys(buffers).length === 0) return;
    engine.setAudioStemBuffers?.(buffers);

    // Register one Track per musical stem, each with one infinite-loop
    // region. Region.startTime = 0 (relative to transportStartTime);
    // duration is in beats per the existing RegionScheduler convention.
    const durationBeats = block.lengthBars * 4; // 4/4 default
    const tracks = MUSICAL_STEMS.map((instrumentType) => ({
      id: `${trackPrefix}${instrumentType}`,
      name: `Groove Card ${cardId} ${instrumentType}`,
      instrumentType,
      regions: [
        {
          id: `${trackPrefix}${instrumentType}-region`,
          trackId: `${trackPrefix}${instrumentType}`,
          startTime: 0,
          duration: durationBeats,
          loopCount: 0, // infinite
        },
      ],
    }));
    engine.registerTracks?.(tracks);
  }, [block.lengthBars, cardId, defaultKeySetIndex, preload, trackPrefix]);

  const unregisterStemTracks = useCallback(() => {
    const engine = WindowRegistry.getPlaybackEngine();
    engine?.unregisterTracksByPrefix?.(trackPrefix);
  }, [trackPrefix]);

  const becomeActive = useCallback(() => {
    activeStore.setActiveCard(cardId);
    const engine = WindowRegistry.getPlaybackEngine();
    // Silence any in-flight sources from the previous card BEFORE
    // registering this card's tracks.
    engine?.stopAudioStems?.();
    registerStemTracks();
  }, [activeStore, cardId, registerStemTracks]);

  const becomeInactive = useCallback(() => {
    const engine = WindowRegistry.getPlaybackEngine();
    engine?.stopAudioStems?.();
    unregisterStemTracks();
    activeStore.clearActiveCard(cardId);
  }, [activeStore, cardId, unregisterStemTracks]);

  // ── play / pause / stop --------------------------------------------------
  // The transport clock alone produces no sound: only PlaybackEngine.start()
  // runs scheduleAllRegions() → scheduleInfiniteAudioRegion(), which creates
  // and fires the stem AudioBufferSourceNodes. So we drive the engine
  // lifecycle in lockstep with the transport (the in-app YouTube path does
  // the same via usePlaybackControl). registerTracks() only reschedules when
  // the engine is already 'playing', hence start() must come AFTER
  // becomeActive() registers this card's tracks, and BEFORE transport.start()
  // so the regions are armed when the clock begins ticking.
  const play = useCallback(async () => {
    if (!isReady) return;

    // The play button IS the user gesture browsers require to start audio.
    // Resume / (re)attach the persistent AudioContext and start Tone here,
    // exactly like the in-app YouTube path (usePlaybackControl). Without
    // this the engine schedules its buffer sources against a suspended or
    // closed context and nothing is audible ("Construction of
    // AudioBufferSourceNode is not useful when context is closed").
    try {
      const { ensureAudioContext } =
        await import('@/domains/playback/utils/ensureAudioContext');
      await ensureAudioContext();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[GrooveCard] ensureAudioContext failed', err);
    }

    // Arm the MIDI metronome count-in path. The count-in region (added
    // below) emits metronome-trigger events that AudioEventRouter routes to
    // the WAM metronome instrument — but only when the router isRunning AND
    // the metronome instrument exists. In /app the ScrollTriggerLoader +
    // CoreServices.initialize() usually arm both already; this makes the
    // Groove Card self-sufficient (a real DAW: MIDI + audio tracks coexist).
    //  - getAudioEventRouter().start() is idempotent — flips isRunning and
    //    re-binds the instrument registry.
    //  - loadEssentialSamples() registers the metronome config so the router
    //    can lazily create the instrument on first trigger. Idempotent +
    //    dedupes; requires CoreServices initialized first.
    try {
      const cs = WindowRegistry.getCoreServices();
      if (cs) {
        if (cs.isReady?.() === false) await cs.initialize?.();
        await cs.getAudioEventRouter?.()?.start?.();

        // The metronome instrument is bound to the AudioEngine's OWN context,
        // which is separate from the persistent context the stems play
        // through. ensureAudioContext() resumed the latter; the engine's
        // context can still be 'suspended', which is exactly why the lazy
        // metronome create bailed ("AudioContext state is suspended"). Resume
        // it explicitly, THEN eagerly create the metronome so it exists with a
        // running context before the count-in triggers fire.
        const engineCtx = cs.getAudioEngine?.()?.getContext?.();
        if (engineCtx && engineCtx.state === 'suspended') {
          await engineCtx.resume();
        }

        const { getSamplePreloader } =
          await import('@/domains/playback/services/InitialSamplePreloader.bridge.js');
        await getSamplePreloader()?.loadEssentialSamples?.();

        // Force the instrument into existence now (idempotent) rather than
        // waiting for the first trigger — by then the count-in window may have
        // already passed while the async create resolves. Once created we
        // register it active so AudioEventRouter's trigger handler finds it
        // synchronously on the first count-in beat.
        const { getPreloadableRegistry } =
          await import('@/domains/playback/services/core/PreloadableInstrumentRegistry');
        const reg = getPreloadableRegistry();
        if (reg?.hasType?.('metronome')) {
          const metronome = await reg.getOrCreateByType('metronome');
          const instrumentRegistry = cs.getInstrumentRegistry?.();
          if (
            metronome &&
            instrumentRegistry?.hasActive?.('metronome') === false
          ) {
            instrumentRegistry.setActive('metronome', metronome);
          }
        }
      }
    } catch (err) {
      // Count-in is non-fatal: if metronome arming fails the stems still
      // play, just without the audible click.
      // eslint-disable-next-line no-console
      console.warn('[GrooveCard] metronome count-in arming failed', err);
    }

    // Always (re)register this card's tracks + buffers before starting.
    // Stem AudioBufferSourceNodes are single-use: once stopped (on pause /
    // stop) they can't restart, so every play() re-arms from the cached
    // buffers. becomeActive() also displaces any other active card.
    becomeActive();

    const engine = WindowRegistry.getPlaybackEngine();

    // The Groove Card loops forever — never auto-stop at MusicalTruth's
    // "exercise end" (the global default is 4 bars + 1 countdown, which
    // killed playback mid-groove regardless of block.lengthBars). The
    // transport will now only stop on explicit user action.
    type WithAutoStop = { setAutoStopEnabled?: (enabled: boolean) => void };
    (transport as WithAutoStop).setAutoStopEnabled?.(false);

    // Count-in (1-2-3-4): reuse the engine's existing countdown system —
    // the same calls the in-app player makes (usePlaybackControl). This
    // injects a metronome count-in region (audible click via the engine's
    // metronome instrument) and offsets the stem regions by one bar so they
    // land on the downbeat after the count. Must run BEFORE start() so the
    // countdown region is present when scheduleAllRegions() fires.
    const timeSignature = { numerator: 4, denominator: 4 };
    engine?.enableCountdown?.(timeSignature);
    engine?.addCountdownRegion?.(timeSignature);

    const engineState = engine?.getState?.();
    // Only 'ready'/'stopped' are startable (PlaybackEngine.start()). pause()
    // and stop() below always leave the engine in 'stopped', so a fresh
    // start() re-runs scheduleAllRegions() and the stems are audible again.
    if (engineState === 'ready' || engineState === 'stopped') {
      engine.start?.();
    }

    await transport.start?.();

    // Anchor every UI timer to the SAME audio-context time the engine will
    // play the first beat at: engine.transportStartTime ≈ audioContext.now +
    // startupLookahead (~300ms by default). Reading it from the engine
    // (instead of estimating "now + a bit") is what keeps the countdown
    // numbers and the waveform playhead in lockstep with the audible click.
    const ctx = audioContextRef.current;
    const audibleStart =
      typeof engine?.getTransportStartTime === 'function'
        ? engine.getTransportStartTime()
        : null;

    if (ctx) {
      const secondsPerBeat = 60 / Math.max(1, currentBpm);
      const countdownSeconds = 4 * secondsPerBeat; // one bar of 4/4 count-in

      // Waveform playhead: stems begin one count-in bar AFTER the first
      // metronome click, which itself fires at audibleStart.
      const anchor = audibleStart ?? ctx.currentTime;
      setLoopStartAudioTime(anchor + countdownSeconds);

      // Visual count-in (1-2-3-4 inside the play button). Pass the engine's
      // anchor as the first-beat audio time so the visual ticker waits the
      // same startupLookahead the audible click is waiting — eliminates the
      // ~300ms "UI ahead of audio" drift.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      void startCountdown(
        currentBpm,
        ctx,
        null as any,
        audibleStart ?? undefined,
      ).catch(() => undefined);
    } else {
      setLoopStartAudioTime(null);
    }

    setIsPlaying(true);
  }, [isReady, becomeActive, transport, currentBpm, startCountdown]);

  // Pause and stop are the same for the Groove Card: the stem sources can't
  // be resumed mid-buffer, so we silence them and reset the engine to
  // 'stopped'. The next play() re-arms from scratch. stopAudioStems() is the
  // ONLY thing that actually kills the live infinite-loop buffer sources —
  // engine.pause()/engine.stop() alone leave them ringing until the buffer
  // ends (the bug this fixes: UI paused but audio kept playing).
  const silenceEngine = useCallback(() => {
    const engine = WindowRegistry.getPlaybackEngine();
    engine?.stopAudioStems?.();
    engine?.stop?.();
  }, []);

  // Both pause and stop call transport.stop() (NOT pause()). transport.start()
  // RESUMEs from the paused position when the transport state is 'paused',
  // which would replay from a stale offset and never re-align with the
  // freshly re-scheduled stems (their T0 anchors at transportStartTime+0).
  // Resetting to 'stopped' makes the next play() a clean start from the top.
  const pause = useCallback(async () => {
    silenceEngine();
    cancelCountdown();
    await transport.stop?.();
    setIsPlaying(false);
    setLoopStartAudioTime(null);
  }, [silenceEngine, cancelCountdown, transport]);

  const stop = useCallback(async () => {
    silenceEngine();
    cancelCountdown();
    await transport.stop?.();
    setIsPlaying(false);
    setLoopStartAudioTime(null);
  }, [silenceEngine, cancelCountdown, transport]);

  // Mirror the transport's isPlaying so external start/stop calls keep
  // local state honest.
  useEffect(() => {
    setIsPlaying(transport.isPlaying ?? false);
  }, [transport.isPlaying]);

  // ── unmount cleanup ------------------------------------------------------
  useEffect(() => {
    return () => {
      const engine = WindowRegistry.getPlaybackEngine();
      engine?.stopAudioStems?.();
      engine?.unregisterTracksByPrefix?.(trackPrefix);
      activeStore.clearActiveCard(cardId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run only on unmount; capture trackPrefix + cardId at mount

  // ── waveform data ----------------------------------------------------------
  // Bass buffer for the current key set + loop duration at the live BPM.
  // The waveform reads these and renders peaks + a sweeping playhead.
  const bassBuffer = preload.getBuffer(defaultKeySetIndex, 'bass') ?? null;
  const loopDurationSeconds = useMemo(() => {
    const secondsPerBeat = 60 / Math.max(1, currentBpm);
    return block.lengthBars * 4 * secondsPerBeat;
  }, [block.lengthBars, currentBpm]);

  return {
    isLoading,
    isReady,
    isPlaying,
    currentBpm,
    currentSemitones,
    mutedStems,
    soloedStem,
    clickEnabled,
    pendingKeyShift,
    bassBuffer,
    audioContext: audioContextRef.current,
    loopStartAudioTime,
    loopDurationSeconds,
    countdownState,
    play,
    pause,
    stop,
    setTempo,
    setKey,
    setStemMuted,
    setStemSolo,
    setClickEnabled,
    becomeActive,
    becomeInactive,
  };
}
