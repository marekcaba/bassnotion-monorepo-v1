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
import { pickKeySet, type KeySetIndex } from './pickKeySet';
import { useGrooveCardStemPreload } from './useGrooveCardStemPreload';
import { trackWaitlistKeyCapHit } from './telemetry';

export type GrooveCardMode = 'block' | 'waitlist';

const ALL_STEMS = [
  'audio-bass',
  'audio-drums',
  'audio-harmony',
  'audio-click',
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
  const audioContextRef = useRef<AudioContext | null>(null);
  if (!audioContextRef.current && typeof window !== 'undefined') {
    audioContextRef.current = WindowRegistry.getAudioContext();
  }

  const preload = useGrooveCardStemPreload({
    audioContext: audioContextRef.current,
    keys: block.keys,
    keySetIndicesToLoad,
    preloadOnMount: true,
  });

  const isReady = preload.isPreloaded;
  const isLoading = !isReady && preload.totalCount > 0;

  // ── tempo: subscribe to musical-truth so external BPM changes propagate -
  useEffect(() => {
    // Seed local state from the live truth (it may differ from the
    // block's originalBpm if another widget on the page changed it).
    const initial = musicalTruth.getBPM?.();
    if (typeof initial === 'number') setCurrentBpm(initial);
    const unsub = musicalTruth.subscribe?.((truth) => {
      setCurrentBpm(truth.bpm);
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

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

    // Build the 5-tuple of stems for the default key set and push the
    // decoded buffers into the engine so AudioPlayerScheduler can fire.
    const buffers: Partial<Record<AudioInstrumentType, AudioBuffer>> = {};
    for (const instrumentType of ALL_STEMS) {
      const stemKey = audioInstrumentTypeToStemKey(instrumentType);
      const buf = preload.getBuffer(defaultKeySetIndex, stemKey);
      if (buf) buffers[instrumentType] = buf;
    }
    if (Object.keys(buffers).length === 0) return;
    engine.setAudioStemBuffers?.(buffers);

    // Register one Track per stem, each with one infinite-loop region.
    // Region.startTime = 0 (relative to transportStartTime); duration is
    // in beats per the existing RegionScheduler convention.
    const durationBeats = block.lengthBars * 4; // 4/4 default
    const tracks = ALL_STEMS.map((instrumentType) => ({
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
  const play = useCallback(async () => {
    if (!isReady) return;
    // If another card is currently active, becomeActive() will displace it.
    if (!activeStore.isActiveCard(cardId)) {
      becomeActive();
    }
    await transport.start?.();
    setIsPlaying(true);
  }, [isReady, activeStore, cardId, becomeActive, transport]);

  const pause = useCallback(async () => {
    await transport.pause?.();
    setIsPlaying(false);
  }, [transport]);

  const stop = useCallback(async () => {
    await transport.stop?.();
    setIsPlaying(false);
  }, [transport]);

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
