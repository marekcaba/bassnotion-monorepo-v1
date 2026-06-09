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
import type { GrooveCardBlockConfig } from '@bassnotion/contracts';
import type {
  AudioInstrumentType,
  AudioStemKey,
} from '@/domains/playback/modules/tracks/management/TrackManagerProcessor';
import {
  audioInstrumentTypeToStemKey,
  isPitchShiftableStem,
} from '@/domains/playback/modules/tracks/management/TrackManagerProcessor';
import { musicalTruth } from '@/domains/playback/modules/tempo/MusicalTruthAuthority';
import { useTransportControlsSafe } from '@/domains/playback/contexts/TransportContext';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry';
import { useActiveGrooveCardStore } from '@/domains/playback/store/active-groove-card.store';
import {
  useCountdown,
  type CountdownState,
} from '@/domains/widgets/hooks/useCountdown';
import { useGrooveCardStemPreload } from './useGrooveCardStemPreload';
import { trackWaitlistKeyCapHit } from './telemetry';

export type GrooveCardMode = 'block' | 'waitlist';

/** A 1-indexed inclusive bar range, e.g. {startBar: 2, endBar: 5} loops
 *  bars 2-3-4-5 of the groove. The hook validates and clamps to the
 *  groove's lengthBars; an "invalid" selection (start > end, etc.) is
 *  coerced to null (= no selection, loop the whole groove). */
export interface LoopSelection {
  startBar: number;
  endBar: number;
}

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
  /** Optional "before-play" hook awaited inside `play()` BEFORE
   *  `ensureAudioContext()` runs. The waitlist surface injects
   *  `useWaitlistPrewarm`'s `resume()` here so the prewarm's AudioContext
   *  is resumed inside the user-gesture window — Safari rejects later
   *  out-of-gesture resumes. In-app callers leave this undefined
   *  (CoreServices' global gesture listener handles resume there). */
  onBeforePlay?: () => Promise<void> | void;
  /** Entitlement caps for the unpaid (anonymous + free) tier. When present,
   *  these tighten the engine bounds to a band AROUND the groove's default:
   *  tempo to [originalBpm ± tempoLimit], transpose to [± transposeLimit],
   *  and bar-range loop selection is rejected when loopRangeCapped. Member
   *  callers omit these (full engine range). The hook stays billing-agnostic
   *  — GrooveCardBlockView resolves the numbers from useEntitlement. */
  caps?: {
    /** ± BPM band around originalBpm. Undefined = uncapped (full 50–180). */
    tempoLimit?: number;
    /** ± semitone band. Undefined = uncapped (full ±6). */
    transposeLimit?: number;
    /** When true, bar-range selection is rejected (whole-groove loop only). */
    loopRangeCapped?: boolean;
  };
  /** Fired when a capped lever is pushed past its band edge (so the caller
   *  can surface the upsell + emit a cap_hit funnel event). Replaces the
   *  waitlist-only telemetry path with a tier-driven one. */
  onCapHit?: (lever: 'tempo' | 'transpose' | 'loopRange') => void;
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
  /** Master volume for the whole groove (all stems), 0..1. */
  masterVolume: number;
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
  /** Set the master volume for the whole groove (all stems), 0..1. */
  setMasterVolume: (volume: number) => void;
  /** Constrain playback to bars [startBar..endBar] (1-indexed, inclusive).
   *  Pass null to clear and resume looping the entire groove. While playing,
   *  the change takes effect at the next bar boundary so the swap is
   *  musical. */
  setLoopSelection: (selection: LoopSelection | null) => void;

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
  /** Time-stretch (LAUNCH-06): the REAL audio playhead phase in [0,1) read
   *  from the bass stem's actual worklet read-head, or null when unavailable.
   *  The waveform uses this so the playhead tracks the SOUND — staying at the
   *  old tempo until a pending tempo change lands at the loop seam, then the
   *  new tempo — instead of a currentBpm formula that desyncs. Called per RAF
   *  frame; stable identity. */
  getAudioPhase: () => number | null;
  /** Dynamic Loop: the next-loop-seam wall-clock time off the bass read-head,
   *  or null when not streaming. The loop counter watches this for boundaries.
   *  Stable identity. */
  getNextSeamTime: () => number | null;
  /** Dynamic Loop: current audio-context time, or null when no context.
   *  Stable identity. */
  getCurrentTime: () => number | null;
  /** Dynamic Loop: the effective transpose range edge (engine ±KEY_RANGE,
   *  tightened to the entitlement band when capped). The dial clamps its
   *  target to ±this so an auto-cycle never trips setKey's cap/upsell path. */
  transposeRange: number;

  // ── visual count-in --------------------------------------------------------
  /** Counts 1-2-3-4 during the metronome count-in bar. The play button
   *  renders countdownState.currentBeat as a number while
   *  countdownState.isCountingDown is true (and currentBeat > 0). */
  countdownState: CountdownState;

  // ── loop selection ---------------------------------------------------------
  /** Current bar selection or null when looping the entire groove. The
   *  waveform draws a bracket around the selected bars; the scheduler
   *  uses native AudioBufferSourceNode.loopStart/loopEnd so the chosen
   *  slice loops indefinitely. */
  loopSelection: LoopSelection | null;
}

const TEMPO_MIN = 50;
const TEMPO_MAX = 180;

// Key stepper range. Capped at ±6 in both /app and waitlist because:
// (a) +6 and -6 are the same pitch class, so ±6 covers the full
//     octave with overlap at the wrap — there's no musical value in
//     going past.
// (b) After the LAUNCH-02.5c test, we settled on a single-key-set +
//     PitchShift architecture (no buffer-swap between key sets). The
//     pitch-shift artifact load stays acceptable across ±6;
//     past that, the artifacts dominate the experience.
export const KEY_RANGE_BLOCK = 6;
export const KEY_RANGE_WAITLIST = 6;

function clampTempo(bpm: number): number {
  return Math.max(TEMPO_MIN, Math.min(TEMPO_MAX, Math.round(bpm)));
}

function clampKey(semitones: number, maxRange: number): number {
  return Math.max(-maxRange, Math.min(maxRange, Math.round(semitones)));
}

/**
 * Shape of the LAUNCH-02.5c groove-card config still on disk for tutorials
 * authored before 02.5e. Read-only; the hook coerces it to the new shape
 * via {@link resolveBlockStems}.
 */
type LegacyGrooveCardBlockConfig = GrooveCardBlockConfig & {
  keys?: Array<{
    isDefault?: boolean;
    semitoneOffset?: number;
    stems?: { bass?: string; drums?: string; harmony?: string };
  }>;
};

const EMPTY_STEMS = { bass: '', drums: '', harmony: '' } as const;

function resolveBlockStems(
  block: GrooveCardBlockConfig,
): GrooveCardBlockConfig['stems'] {
  if (block.stems) return block.stems;
  const legacy = block as LegacyGrooveCardBlockConfig;
  const def =
    legacy.keys?.find((k) => k.isDefault) ??
    legacy.keys?.find((k) => k.semitoneOffset === 0) ??
    legacy.keys?.[Math.floor((legacy.keys?.length ?? 1) / 2)];
  if (!def?.stems) return EMPTY_STEMS;
  return {
    bass: def.stems.bass ?? '',
    drums: def.stems.drums ?? '',
    harmony: def.stems.harmony ?? '',
  };
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
  onBeforePlay,
  caps,
  onCapHit,
}: UseGrooveCardPlaybackOptions): UseGrooveCardPlaybackReturn {
  void _countdownClickUrl; // consumed by 02.5d's WaitlistAudioBootstrap

  // Keep `onBeforePlay` in a ref so the `play` callback stays referentially
  // stable across renders even if the caller passes an inline function.
  // The hook runs ref.current at play-time, so consumers can swap the
  // closure between renders without invalidating downstream memoisation.
  const onBeforePlayRef = useRef(onBeforePlay);
  useEffect(() => {
    onBeforePlayRef.current = onBeforePlay;
  }, [onBeforePlay]);

  // Entitlement caps + cap-hit callback held in refs so setTempo/setKey/
  // setLoopSelection stay referentially stable while still reading the
  // latest tier (caps can change when auth/subscription resolves).
  const capsRef = useRef(caps);
  useEffect(() => {
    capsRef.current = caps;
  }, [caps]);
  const onCapHitRef = useRef(onCapHit);
  useEffect(() => {
    onCapHitRef.current = onCapHit;
  }, [onCapHit]);

  // LAUNCH-02.5c key-shift refs are declared LATER in the file (after
  // `preload` is created on line ~385) — moving them here would forward-
  // reference `preload`. See the block right after `useGrooveCardStemPreload`.

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
  // `pendingKeyShift` flags a key swap that's been requested but hasn't reached
  // its loop seam yet (drives the "…" suffix + 'key-change' caption). It is
  // CLEARED to null once the deferred boundary passes (see the timer in
  // setKey). Historically it was set-and-never-cleared, which pinned the "…"
  // and caption forever — fine for an occasional human tap, but a visible bug
  // once Dynamic Loop cycles the key continuously.
  const [pendingKeyShift, setPendingKeyShift] = useState<number | null>(null);
  // Timer that clears pendingKeyShift when the queued swap's boundary passes.
  // Held in a ref so a fresh setKey supersedes the previous pending clear.
  const pendingKeyClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [mutedStems, setMutedStems] = useState<Set<AudioInstrumentType>>(() => {
    // Click is muted by default per the story spec.
    return new Set(['audio-click']);
  });
  const [soloedStem, setSoloedStem] = useState<'audio-drums' | null>(null);
  const [clickEnabled, setClickEnabledState] = useState(false);
  // MASTER volume for the whole groove (all stems), 0..1. Scales the engine's
  // master-volume node; the engine preserves it even before the graph exists,
  // so a pre-play set is safe.
  const [masterVolume, setMasterVolumeState] = useState(1);
  // Audio-context time at which the first stem-loop iteration started. Used
  // by the waveform to sweep a playhead across one loop length and wrap at
  // the boundary. null when stopped (the waveform draws static peaks only).
  const [loopStartAudioTime, setLoopStartAudioTime] = useState<number | null>(
    null,
  );

  // Bar-range selection (drag-to-loop in the waveform). null = loop the
  // full groove. Validated on write to clamp into [1..lengthBars] and to
  // enforce startBar ≤ endBar; invalid input is coerced to null.
  const [loopSelection, setLoopSelectionState] = useState<LoopSelection | null>(
    null,
  );
  const setLoopSelection = useCallback(
    (next: LoopSelection | null) => {
      if (next == null) {
        setLoopSelectionState(null);
        return;
      }
      // Bar-range looping is a members-only lever. The unpaid tier can still
      // loop the WHOLE groove (the null path above) — only selecting a range
      // is gated. Reject + surface the upsell.
      if (capsRef.current?.loopRangeCapped) {
        onCapHitRef.current?.('loopRange');
        return;
      }
      const total = Math.max(1, block.lengthBars);
      const start = Math.max(1, Math.min(total, Math.round(next.startBar)));
      const end = Math.max(start, Math.min(total, Math.round(next.endBar)));
      // No-op selection (whole groove) collapses to null so the scheduler
      // can take its simpler full-buffer path.
      if (start === 1 && end === total) {
        setLoopSelectionState(null);
        return;
      }
      setLoopSelectionState({ startBar: start, endBar: end });
    },
    [block.lengthBars],
  );

  // Visual count-in (1-2-3-4 inside the play button). Mirrors the YouTube
  // tutorial player pattern (usePlaybackControl + PlaybackControlsBar): the
  // audible click is owned by the engine (engine.addCountdownRegion), and
  // useCountdown runs an independent setInterval anchored to the same BPM +
  // AudioContext for the visual ticker. Both kick off in play() below.
  const { countdownState, startCountdown, cancelCountdown } = useCountdown({
    timeSignature: { numerator: 4, denominator: 4 },
  });

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

  // LAUNCH-02.5e: DB rows written in the 02.5c 5-key-set shape still
  // exist in production (no migration yet). Read `stems` if present;
  // otherwise pull the default key set's stems out of `keys[]`. Drops
  // out as soon as every row has been re-saved through the new admin
  // form. The coercion is memoised on identity so the preloader's
  // effect deps stay stable across renders.
  const blockStems = useMemo(
    () => resolveBlockStems(block),
    // block.stems / block.keys identity is the right signal; if either
    // changes (admin saved a new shape), recompute. Lint can't see the
    // legacy-shape branch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [block, block.stems, (block as LegacyGrooveCardBlockConfig).keys],
  );

  const preload = useGrooveCardStemPreload({
    audioContext: audioContextRef.current,
    stems: blockStems,
    preloadOnMount: true,
  });

  const isReady = preload.isPreloaded;
  const isLoading = !isReady && preload.totalCount > 0;

  // LAUNCH-02.5c key-shift refs. The buffer-resolver closure must stay
  // referentially stable (it's installed ONCE on PlaybackEngine via
  // setPendingBufferResolver and captured by RegionScheduler's per-
  // iteration onended closures); reading state through refs keeps the
  // closure's view of "current key" fresh without re-installing on every
  // render. Mirrors the `onBeforePlayRef` pattern.
  const currentSemitonesRef = useRef(0);
  // Mirror of currentBpm for synchronous reads (e.g. inside setTempo before
  // the state update has flushed). Kept in sync by the ref-sync effect below.
  const currentBpmRef = useRef(block.originalBpm);
  const preloadRef = useRef(preload);
  // Map of region.id → AudioStemKey, populated by registerStemTracks so
  // the buffer resolver can look up which stem to serve for a given
  // region without re-parsing the region id string.
  const regionIdToStemKeyRef = useRef<Map<string, AudioStemKey>>(new Map());

  // Single-key-set + PitchShift architecture (LAUNCH-02.5e): the
  // resolver returns the SAME buffer regardless of current key — pitch
  // is applied at the pitch-shift node, not by swapping buffers. The
  // resolver still exists because RegionScheduler's rearm path expects
  // it (and because per-stem `null` returns let the engine fall back to
  // the registered default buffer for non-pitch-shiftable stems).
  const bufferResolverRef = useRef<
    ((regionId: string, _iter: number) => AudioBuffer | null) | null
  >(null);
  if (bufferResolverRef.current === null) {
    bufferResolverRef.current = (regionId, _iter) => {
      const stemKey = regionIdToStemKeyRef.current.get(regionId);
      if (!stemKey) return null;
      return preloadRef.current.getBuffer(stemKey) ?? null;
    };
  }

  // Keep buffer-resolver refs in sync with their corresponding values so the
  // stable closure stored on PlaybackEngine always reads the latest values.
  useEffect(() => {
    currentSemitonesRef.current = currentSemitones;
  }, [currentSemitones]);
  useEffect(() => {
    currentBpmRef.current = currentBpm;
  }, [currentBpm]);
  useEffect(() => {
    preloadRef.current = preload;
  }, [preload]);

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

  // Loop duration in seconds at the current BPM — used by setKey + setTempo
  // (to compute the next loop-boundary audio time for the deferred
  // pitch/tempo write) and by the public reactive surface (waveform
  // playhead, etc.). Hoisted above the callbacks because TypeScript flags
  // forward refs in block-scoped declarations.
  const loopDurationSeconds = useMemo(() => {
    const secondsPerBeat = 60 / Math.max(1, currentBpm);
    return block.lengthBars * 4 * secondsPerBeat;
  }, [block.lengthBars, currentBpm]);

  // Time-stretch (LAUNCH-06): the REAL audio playhead phase [0,1), read from
  // the bass stem's signalsmith read-head via the engine. The waveform calls
  // this each frame so the playhead is glued to the actual sound and never
  // desyncs from a pending (seam-deferred) tempo change. Stable identity.
  const getAudioPhase = useCallback((): number | null => {
    return WindowRegistry.getPlaybackEngine()?.getStemPlayheadPhase?.() ?? null;
  }, []);

  // Dynamic Loop (loop counter): the authoritative next-loop-seam wall-clock
  // time off the bass stem's real read-head, or null when not streaming. This
  // is the SAME seam clock setKey quantises to — counting loops off it is
  // correct across tempo changes and survives count-in. Stable identity.
  const getNextSeamTime = useCallback((): number | null => {
    return WindowRegistry.getPlaybackEngine()?.getStemNextSeamTime?.() ?? null;
  }, []);

  // Current audio-context time, read live from WindowRegistry so it tracks the
  // active context even if it's rebound. Stable identity. Used by the loop
  // counter to disambiguate a forward seam jump from a missed boundary.
  const getCurrentTime = useCallback((): number | null => {
    const ctx = WindowRegistry.getAudioContext() ?? audioContextRef.current;
    return ctx ? ctx.currentTime : null;
  }, []);

  // Compute the audio-context time of the next loop seam, so a key/tempo
  // change applies cleanly at a boundary (current loop finishes in the old
  // key/tempo, the next plays the new). Returns undefined when not playing
  // (caller applies immediately so the next play() picks it up).
  //
  // `preRollSeconds` shifts the returned time EARLIER to compensate for a
  // processing pipeline that delays output. Buffer-streaming signalsmith
  // self-compensates its latency, so bass/harmony pass 0; the legacy
  // live-input path passed 0.14.
  //
  // `loopDurationOverride` lets a tempo change use the OLD loop duration to
  // locate the current loop's seam (the in-flight loop was scheduled at the
  // old tempo), while the new tempo takes effect from that seam forward.
  const computeNextBoundaryAudioTime = useCallback(
    (
      preRollSeconds: number,
      loopDurationOverride?: number,
    ): number | undefined => {
      const ctx = audioContextRef.current;
      if (!isPlaying || !ctx) return undefined;

      // PRIMARY: read the REAL next loop seam off the bass stem's signalsmith
      // read-head (scaled by the live stretch rate). This is correct across a
      // tempo change — the read-head wraps on a fixed input-domain buffer length
      // and its output time is inputUntilSeam/rate. The React-state fallback
      // below (loopStartAudioTime + loopDur) goes ~750ms stale right after a
      // tempo change, which landed key swaps off the real wrap (old key heard
      // past the first beat). Skip the engine seam only when a caller forces an
      // explicit loopDurationOverride (none do today — see the dead-code note on
      // the param) or the read-head isn't available yet.
      if (loopDurationOverride == null) {
        const engineSeam =
          WindowRegistry.getPlaybackEngine()?.getStemNextSeamTime?.() ?? null;
        if (engineSeam != null) {
          return Math.max(ctx.currentTime + 0.001, engineSeam - preRollSeconds);
        }
      }

      // FALLBACK (engine read-head unavailable, or override forced): the
      // React-state clock. Honest about its limitation — only reliable when the
      // tempo hasn't changed since loopStartAudioTime was last re-anchored.
      const loopDur = loopDurationOverride ?? loopDurationSeconds;
      if (loopStartAudioTime == null || loopDur <= 0) return undefined;
      const elapsed = ctx.currentTime - loopStartAudioTime;
      const completedLoops = elapsed <= 0 ? 0 : Math.ceil(elapsed / loopDur);
      const naturalSeamTime = loopStartAudioTime + completedLoops * loopDur;
      return Math.max(
        ctx.currentTime + 0.001,
        naturalSeamTime - preRollSeconds,
      );
    },
    [isPlaying, loopStartAudioTime, loopDurationSeconds],
  );

  // ── tempo: pitch-independent time-stretch at the next loop boundary ──────
  // The recorded stems are stretched to play at the chosen BPM with NO
  // pitch change (LAUNCH-06). bass/harmony stretch via their signalsmith
  // buffer-streaming source (rate ⟂ pitch); drums stretch via the engine's
  // drum path. R = currentBpm / originalBpm; R == 1 is the bit-transparent
  // original. The musical-truth BPM still updates so the metronome,
  // pattern events, and loop interval all follow the same tempo.
  const setTempo = useCallback(
    (bpm: number) => {
      // Engine bound first, then the entitlement band around the default
      // (tempoLimit caps tempo to [originalBpm ± tempoLimit]); fire onCapHit
      // when the request is clipped so the UI can surface the gate.
      let clamped = clampTempo(bpm);
      const tempoLimit = capsRef.current?.tempoLimit;
      if (tempoLimit != null) {
        const lo = clampTempo(block.originalBpm - tempoLimit);
        const hi = clampTempo(block.originalBpm + tempoLimit);
        const banded = Math.max(lo, Math.min(hi, clamped));
        if (banded !== clamped) onCapHitRef.current?.('tempo');
        clamped = banded;
      }
      if (clamped === currentBpm) return;

      // Display number + musical truth update immediately (the stepper shows
      // the new value; the metronome, if running, follows). currentBpmRef
      // mirrors for synchronous reads.
      setCurrentBpm(clamped);
      currentBpmRef.current = clamped;
      musicalTruth.setBPM(clamped);

      const ctx = audioContextRef.current;
      // Not playing: the BPM is set; the next play() arms at the new tempo.
      if (!isPlaying || !ctx) return;

      // IMMEDIATE MID-LOOP TEMPO (Model C): change all three stems' rate LIVE,
      // mid-loop, at one shared audio time — no rebuild, no wait, no teardown
      // dip. bass/harmony via signalsmith schedule({rate}); drums via the
      // source's + WSOLA insert's playbackRate. The transition bar becomes a
      // hybrid length (intrinsic to changing tempo NOW), but the playhead is
      // driven by the real read-head so it stays glued to the audio. Key
      // changes stay quantized-to-the-seam and coexist on the same node.
      WindowRegistry.getPlaybackEngine()?.setStretchRatio?.(
        clamped / Math.max(1, block.originalBpm),
        `${trackPrefix}audio-drums-region`,
      );

      // Re-anchor the FALLBACK playhead clock to the new tempo (the primary
      // playhead reads the real read-head and is already correct). The audio
      // now loops at lengthBars×4×60/clamped; set loopStartAudioTime so the
      // current read-head phase maps onto the new period at `now`.
      const newPeriod = (block.lengthBars * 4 * 60) / Math.max(1, clamped);
      const phase =
        WindowRegistry.getPlaybackEngine()?.getStemPlayheadPhase?.() ?? null;
      if (phase != null && newPeriod > 0) {
        setLoopStartAudioTime(ctx.currentTime - phase * newPeriod);
      }
    },
    [block.lengthBars, block.originalBpm, currentBpm, isPlaying, trackPrefix],
  );

  // ── key: queue swap for the next loop boundary ---------------------------
  const setKey = useCallback(
    (semitonesFromOriginal: number) => {
      const rounded = Math.round(semitonesFromOriginal);
      // Engine bound (±6) — the HARD limit for everyone (there is no ±7).
      const engineClamped = clampKey(rounded, keyRange);
      // The entitlement BAND (e.g. ±2 for the unpaid tier), if present and
      // tighter than the engine. A member has no band → this equals the engine.
      const transposeLimit = capsRef.current?.transposeLimit;
      const effectiveRange =
        transposeLimit != null ? Math.min(keyRange, transposeLimit) : keyRange;
      const desired = clampKey(rounded, effectiveRange);

      // Cap-as-CTA. Two distinct edges:
      //  • the entitlement BAND (e.g. ±2 free tier) — exceeding it IS the
      //    upgrade pitch, so fire the upsell + cap_hit. Members have no band.
      //  • the engine's hard ±6 — for an in-app member this is just the end of
      //    the range (there is no ±7), so DON'T show the upsell; the stepper
      //    button is already disabled there → silent clamp.
      // The waitlist surface is the exception: it's an anonymous marketing
      // visitor whose ±6 edge is itself the "full range in app" CTA, so it
      // keeps firing cap_hit at the engine edge (legacy funnel behaviour).
      const blockedByBand = desired !== engineClamped;
      const exceededEngine = rounded !== engineClamped;
      if (blockedByBand || (mode === 'waitlist' && exceededEngine)) {
        onCapHitRef.current?.('transpose');
        if (mode === 'waitlist') {
          trackWaitlistKeyCapHit({ blockId: cardId, valueAttempted: rounded });
        }
        return;
      }
      // Past here, `desired === engineClamped` — a plain clamp to the engine
      // edge (or within range). Fall through to apply it.

      if (desired === currentSemitones && pendingKeyShift === null) return;
      // Settle currentSemitones immediately for the UI; the audible
      // swap is driven by the buffer resolver + rearm below, which
      // typically takes effect within ~1 loop iteration (the playing
      // iter can't be rewritten mid-buffer). The pendingKeyShift flag
      // stays briefly so the caption can show "queued for next loop"
      // — it clears on the next render that observes a settled key.
      setPendingKeyShift(desired);
      setCurrentSemitones(desired);
      // Mirror immediately to the ref so the resolver — invoked
      // synchronously below by rearmFutureIterationsForRegions when it
      // arms replacement iterations — sees the new value. The ref-sync
      // useEffect would otherwise run after this render.
      currentSemitonesRef.current = desired;

      // Single-key + PitchShift: the requested semitone offset IS the
      // residual the pitch-shift node applies on bass + harmony. Drums +
      // click stay un-shifted regardless.
      const residualShift = desired;

      // Time-stretch (LAUNCH-06): bass/harmony now play through ONE
      // signalsmith BUFFER-STREAMING node that does both pitch and tempo.
      // A key change is therefore just a pitch (semitones) write on that
      // node, deferred to the next loop boundary so the current loop
      // finishes in the old key and the next plays the new — no routing
      // toggle, no latency compensation, no re-arm (the node loops itself,
      // and its rate/tempo persists untouched because signalsmith inherits
      // omitted schedule() fields). Drums don't transpose, so they're
      // untouched entirely.
      const engine = WindowRegistry.getPlaybackEngine();
      if (engine) {
        // Buffer-streaming self-compensates its latency, so the write
        // lands at the natural seam (no pre-roll). When not playing the
        // boundary is undefined → the write applies immediately so the
        // next play() picks it up.
        const boundary = computeNextBoundaryAudioTime(0);
        engine.setInstrumentPitchShift?.('audio-bass', residualShift, boundary);
        engine.setInstrumentPitchShift?.(
          'audio-harmony',
          residualShift,
          boundary,
        );

        // Clear the "pending" flag once the deferred swap has actually landed,
        // so the "…" suffix + 'key-change' caption don't stick forever (the
        // historical bug). A fresh setKey supersedes any prior pending clear.
        if (pendingKeyClearTimerRef.current) {
          clearTimeout(pendingKeyClearTimerRef.current);
          pendingKeyClearTimerRef.current = null;
        }
        const ctx = audioContextRef.current;
        // Time until the boundary passes (ms). When not playing the write is
        // immediate → clear on the next tick. Add a small margin so we clear
        // just AFTER the seam, never before.
        const untilBoundaryMs =
          boundary != null && ctx
            ? Math.max(0, (boundary - ctx.currentTime) * 1000) + 60
            : 0;
        pendingKeyClearTimerRef.current = setTimeout(() => {
          pendingKeyClearTimerRef.current = null;
          setPendingKeyShift(null);
        }, untilBoundaryMs);
      }
    },
    [
      cardId,
      computeNextBoundaryAudioTime,
      currentSemitones,
      keyRange,
      mode,
      pendingKeyShift,
    ],
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

  const setMasterVolume = useCallback((volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume));
    setMasterVolumeState(clamped);
    // Scales the engine's master-volume node (all stems together). Engine
    // clamps + preserves the level even before the graph exists.
    WindowRegistry.getPlaybackEngine()?.setMasterVolume?.(clamped);
  }, []);

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
      const buf = preload.getBuffer(stemKey);
      if (buf) buffers[instrumentType] = buf;
    }
    if (Object.keys(buffers).length === 0) return;

    // Time-stretch (LAUNCH-06): tell the engine the MUSICAL loop length so the
    // bass/harmony buffer-streaming sources loop on the beat grid (the same
    // length the drum loop uses) rather than their own slightly-different
    // buffer durations — otherwise the stems drift out of phase. Uses
    // originalBpm (the recorded tempo); signalsmith's `rate` scales tempo on
    // top of this fixed loop length.
    if (block.lengthBars > 0 && block.originalBpm > 0) {
      engine.setStemLoopDuration?.(
        (block.lengthBars * 4 * 60) / block.originalBpm,
      );
    }
    engine.setAudioStemBuffers?.(buffers);

    // If a bar-range selection is active, convert it into a buffer-time
    // loopSlice. The buffer's natural duration represents `block.lengthBars`
    // bars, so each bar = bufDuration / lengthBars seconds. (We use the
    // buffer's actual duration rather than BPM-derived seconds because the
    // recording is authored at originalBpm; the loop pins to the recording.)
    const bassBuf = buffers['audio-bass'];
    const loopSlice =
      loopSelection && bassBuf && block.lengthBars > 0
        ? (() => {
            const secsPerBar = bassBuf.duration / block.lengthBars;
            return {
              startSeconds: (loopSelection.startBar - 1) * secsPerBar,
              endSeconds: loopSelection.endBar * secsPerBar,
            };
          })()
        : undefined;

    // Register one Track per musical stem, each with one infinite-loop
    // region. Region.startTime = 0 (relative to transportStartTime);
    // duration is in beats per the existing RegionScheduler convention.
    // loopSlice (when present) makes RegionScheduler pre-arm a single
    // source with native AudioBufferSourceNode.loop = true + loopStart/End.
    const durationBeats = block.lengthBars * 4; // 4/4 default
    // Reset the regionId→stemKey map so it tracks exactly the regions
    // whose buffer the resolver is allowed to swap. ONLY pitch-shiftable
    // stems (bass + harmony) get an entry — drums always play the
    // default-key recording regardless of which key the user picks, so
    // the resolver returning null for the drums region is the right
    // thing (RegionScheduler falls back to the registered default
    // buffer). Click is metronome-only and not on the regions list.
    regionIdToStemKeyRef.current.clear();
    const tracks = MUSICAL_STEMS.map((instrumentType) => {
      const regionId = `${trackPrefix}${instrumentType}-region`;
      const stemKey = audioInstrumentTypeToStemKey(instrumentType);
      if (isPitchShiftableStem(stemKey)) {
        regionIdToStemKeyRef.current.set(regionId, stemKey);
      }
      return {
        id: `${trackPrefix}${instrumentType}`,
        name: `Groove Card ${cardId} ${instrumentType}`,
        instrumentType,
        regions: [
          {
            id: regionId,
            trackId: `${trackPrefix}${instrumentType}`,
            startTime: 0,
            duration: durationBeats,
            loopCount: 0, // infinite
            ...(loopSlice ? { loopSlice } : {}),
          },
        ],
      };
    });
    // Unregister BEFORE re-registering. PlaybackEngine.registerTrack has a
    // "redundant-update" optimization that skips when region/event counts
    // match — for audio stems regions.length is always 1 and pattern.events
    // doesn't exist (eventCount always 0), so any loopSlice change would be
    // silently dropped. Unregistering first means the next registerTrack
    // cannot hit the skip-update branch, and the fresh region (with or
    // without loopSlice) takes effect immediately. The engine-side guard at
    // PlaybackEngine.registerTrack handles this too; keeping it here is
    // defense in depth.
    engine.unregisterTracksByPrefix?.(trackPrefix);
    engine.registerTracks?.(tracks);
  }, [block.lengthBars, cardId, preload, trackPrefix, loopSelection]);

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

    // LAUNCH-02.5c key-shift: install the buffer resolver BEFORE
    // registerStemTracks so the scheduling pass triggered by
    // setAudioStemBuffers captures it. Owner-ID is the cardId — a
    // subsequent card's install will displace this one cleanly; this
    // card's eventual clear is no-op'd by the engine if it has been
    // displaced. The resolver itself is the stable closure declared
    // at hook init.
    if (bufferResolverRef.current) {
      engine?.setPendingBufferResolver?.(bufferResolverRef.current, cardId);
    }

    // registerStemTracks runs setAudioStemBuffers, which constructs the
    // bass/harmony buffer-streaming nodes (the time-stretch sources) and
    // registers them with the scheduler. After this call those nodes exist,
    // so the pre-play key/tempo writes below land on them. (Before it, the
    // engine.audioStemBuffers map is empty — which is why pre-play taps
    // could appear inert.)
    registerStemTracks();

    // Apply the currently-active key + tempo to the freshly-created
    // buffer-streaming sources so a pre-play key/tempo change (the user
    // tapped before pressing play) takes effect on the first play.
    // Immediate writes (no boundary) — nothing is looping yet. For the
    // default key (offset 0) and original tempo (ratio 1) these are no-ops
    // (the node arms at semitones 0 / rate 1). Drums don't transpose;
    // their tempo is applied via the scheduler ratio + the drum region
    // re-arm that registerStemTracks' scheduling pass already honours.
    const residualShift = currentSemitonesRef.current;
    engine?.setInstrumentPitchShift?.('audio-bass', residualShift);
    engine?.setInstrumentPitchShift?.('audio-harmony', residualShift);
    const ratio = currentBpmRef.current / Math.max(1, block.originalBpm);
    if (ratio !== 1) {
      engine?.setStemRate?.('audio-bass', ratio);
      engine?.setStemRate?.('audio-harmony', ratio);
      engine?.setSchedulerTempoRatio?.(ratio);
    }
  }, [activeStore, block.originalBpm, cardId, registerStemTracks]);

  const becomeInactive = useCallback(() => {
    const engine = WindowRegistry.getPlaybackEngine();
    engine?.stopAudioStems?.();
    // Clear our resolver. The engine's owner-ID guard makes this a
    // no-op if another card has already taken over — safe to call
    // from React unmount paths that may race a successor's mount.
    engine?.setPendingBufferResolver?.(null, cardId);
    unregisterStemTracks();
    activeStore.clearActiveCard(cardId);
  }, [activeStore, cardId, unregisterStemTracks]);

  // Boundary-aligned loop-selection swap.
  //   - At play start the current selection is baked into registerStemTracks
  //     directly via the play() path — NO swap fires for the initial play.
  //   - While playing, only when the user actually CHANGES selection mid-
  //     loop (compared to a ref tracking the previous value), we wait until
  //     the next bar boundary and then:
  //       1. stopAudioStems() to silence the currently-armed sources
  //          (click-free via the shared ramp helper).
  //       2. re-register tracks; the engine's updateTracks reschedules
  //          while in 'playing' state so the new loopSlice takes effect.
  //     The transport / metronome / count-in continue uninterrupted; only
  //     the per-stem AudioBufferSourceNodes get replaced.
  //
  // Gating on a ref (not just deps) is critical: without it, the effect
  // fires when isPlaying transitions false→true at play start, re-arming
  // a fresh source on top of the one play() just configured. That double-
  // arm caused "loop slice ignored, plays full buffer" symptoms.
  const prevLoopSelectionRef = useRef<LoopSelection | null>(null);
  useEffect(() => {
    const prev = prevLoopSelectionRef.current;
    prevLoopSelectionRef.current = loopSelection;
    // Compare by value, not reference. Same-range selection (e.g. user
    // dragged into the same range) is a no-op.
    const same =
      (prev == null && loopSelection == null) ||
      (prev != null &&
        loopSelection != null &&
        prev.startBar === loopSelection.startBar &&
        prev.endBar === loopSelection.endBar);
    if (same) return;
    if (!isPlaying) return;
    const ctx = audioContextRef.current;
    if (!ctx || loopStartAudioTime == null) return;
    const bpm = Math.max(1, currentBpm);
    const barDuration = (60 / bpm) * 4; // seconds per bar in 4/4
    const elapsed = ctx.currentTime - loopStartAudioTime;
    const boundaryBars = elapsed < 0 ? 0 : Math.ceil(elapsed / barDuration);
    const nextBoundary =
      loopStartAudioTime + Math.max(0, boundaryBars) * barDuration;
    const delayMs = Math.max(0, (nextBoundary - ctx.currentTime) * 1000);

    const id = setTimeout(() => {
      const engine = WindowRegistry.getPlaybackEngine();
      if (!engine) return;
      // registerStemTracks now always unregisters before registering, so
      // we just need to silence the current sources here. This is a SEAMLESS
      // boundary swap: stop at the seam with rampSeconds:0 (no gain fade) so
      // the new loop re-armed into the SAME gain isn't silenced by an
      // in-flight fade — at the loop seam the audio wraps, so the hard stop is
      // click-safe. (The 30ms fade is only for the full stop button.)
      engine.stopAudioStems?.({ rampSeconds: 0 });
      registerStemTracks();
    }, delayMs);

    return () => clearTimeout(id);
    // Intentionally limited deps: registerStemTracks + trackPrefix close over
    // the latest loopSelection via their own useCallback memoization. Watching
    // currentBpm / loopStartAudioTime here would re-trigger the swap on every
    // beat tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loopSelection, isPlaying]);

  // NOTE (Ableton-grade key seam, LAUNCH-06+): there used to be a SEPARATE
  // slice-mode key-swap effect here that, on a key change while a bar-range
  // loop-slice was active, did a boundary-aligned stopAudioStems +
  // registerStemTracks. It was redundant AND latently broken: in slice mode
  // bass/harmony STILL play through the ONE signalsmith self-looping node (the
  // slice only sets the start offset), so setKey's
  // engine.setInstrumentPitchShift('audio-bass'/'audio-harmony', residual,
  // boundary) already applies the key on that live node — at the read-head seam,
  // independent of the slice. The re-register instead TORE DOWN and rebuilt the
  // worklet at key 0 (the new key only survived by racing onto the old node
  // before teardown), introducing a seam glitch and a latent default-key
  // regression. Removed: setKey handles slice mode identically to whole-groove
  // now. (The loop-SELECTION swap effect above — gated on the bar RANGE changing
  // — stays; that re-arms the source when the range itself changes.)

  // ── play / pause / stop --------------------------------------------------
  // The transport clock alone produces no sound: only PlaybackEngine.start()
  // runs scheduleAllRegions() → scheduleInfiniteAudioRegion(), which creates
  // and fires the stem AudioBufferSourceNodes. So we drive the engine
  // lifecycle in lockstep with the transport (the in-app YouTube path does
  // the same via usePlaybackControl). registerTracks() only reschedules when
  // the engine is already 'playing', hence start() must come AFTER
  // becomeActive() registers this card's tracks, and BEFORE transport.start()
  // so the regions are armed when the clock begins ticking.

  // Reentrancy guard shared by play / pause / stop. play() is deeply async
  // (it awaits onBeforePlay, the ensureAudioContext dynamic import, the
  // CoreServices init + metronome arming, then transport.start) — hundreds of
  // ms during which the play button is NOT disabled and Space repeats freely.
  // Without this guard, a fast second trigger re-enters play() while the first
  // is still mid-await: the first synchronously flips the engine to
  // 'playing'/isRunning inside engine.start(), so the second's engine.start()
  // hits its `isRunning`/`state!=='ready'|'stopped'` early-return and SKIPS
  // scheduleAllRegions() — the bass + harmony + drums infinite regions never
  // arm, while the separately-armed metronome click keeps ticking. The card is
  // then stuck "playing" (button shows pause) with no stems until a clean
  // stop→play. Serialising the three commands on one in-flight flag closes
  // that race (the dominant cause of the "rapid play/stop drops bass+harmony"
  // report). Cheap, synchronous, ref-based so it doesn't trigger re-renders.
  const transitionInFlightRef = useRef(false);
  // Play-generation epoch. play() is a long async chain (dynamic imports,
  // AudioContext resume, sample preload) with no native cancellation. A stop()
  // / pause() during that window — common when the tab is backgrounded and its
  // timers + awaits are throttled, then drained on refocus — would otherwise
  // let the STALE play() resume and re-arm the engine AFTER the stop, so the
  // groove becomes audible during what looks like a fresh count-in. We stamp an
  // epoch at the top of play(), bump it on every stop()/pause(), and bail at
  // each resumption point if our epoch is stale. (transitionInFlightRef only
  // blocks RE-ENTRY; it can't abort an already-running play().)
  const playGenRef = useRef(0);

  const play = useCallback(async () => {
    if (!isReady) return;
    if (transitionInFlightRef.current) return;
    transitionInFlightRef.current = true;
    const myGen = ++playGenRef.current;
    const isStale = () => myGen !== playGenRef.current;
    try {
      // Optional caller-supplied "before-play" hook. The waitlist surface
      // wires `useWaitlistPrewarm.resume()` here so the prewarm's
      // AudioContext is resumed inside the user-gesture window (Safari
      // rejects later out-of-gesture resumes). In-app callers leave this
      // undefined — CoreServices' document-level gesture listener handles
      // resume there. Failures are swallowed; if the prewarm hasn't
      // finished yet, `ensureAudioContext()` below still tries the standard
      // path. Must run BEFORE `ensureAudioContext` so the persistent-context
      // helpers can find the prewarm's context.
      try {
        await onBeforePlayRef.current?.();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[GrooveCard] onBeforePlay failed', err);
      }

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

      // Re-push the live BPM into musicalTruth (→ Tone.Transport.bpm.value)
      // AFTER ensureAudioContext has guaranteed Tone is loaded. The mount-
      // time setBPM at line 367 happens BEFORE Tone.js is imported on the
      // waitlist (useWaitlistPrewarm loads Tone lazily on viewport
      // intersection), so MusicalTruthAuthority's "if (Tone) write" branch
      // silently drops the write — Tone.Transport stays at its default
      // 120 BPM. RegionScheduler.computeIterationDuration then computes
      // each loop iteration as `beats * 60/120` while the audio buffers
      // were authored at the groove's real BPM, producing a per-iteration
      // silent gap of (1 - groove/120) * iterationLength. In /app this is
      // a no-op because <TransportProvider> already syncs Tone to the
      // groove BPM before any GrooveCard mounts; here we just re-assert
      // the same invariant defensively.
      musicalTruth.setBPM(clampTempo(currentBpm));

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

      // CRITICAL epoch gate: everything above was async (imports, context
      // resume, sample load) and may have been stalled while a stop()/pause()
      // ran. If so, abort BEFORE the audible tail — do not arm the engine,
      // start the transport, or flip isPlaying. Leave the engine silenced
      // exactly as stop() left it. This is the gate that prevents "groove
      // plays during the count-in after a stop".
      if (isStale()) return;

      // SELF-HEAL: the PlaybackEngine is a long-lived window-global that
      // captures its AudioContext once at initialize(). If that context has
      // since been closed (hard reload / Fast Refresh / OS audio-device change
      // disposing the AudioEngine), building the Signalsmith stretch worklets
      // against it throws ("AudioWorkletNode cannot be created"). ensureAudioContext()
      // above guaranteed a live context is registered; if the engine is bound
      // to a dead one, rebind it to the live context (which rebuilds the stale
      // gain/stretch nodes) BEFORE becomeActive() arms the stems. AudioBuffers
      // are context-bound, so on a real context swap we also drop the cache so
      // the next decode targets the new context.
      {
        const engineForRebind = WindowRegistry.getPlaybackEngine();
        const liveCtx = WindowRegistry.getAudioContext();
        if (
          liveCtx &&
          engineForRebind?.needsContextRebind?.(liveCtx) === true
        ) {
          try {
            const { GlobalSampleCache } =
              await import('@/domains/playback/modules/storage/cache/GlobalSampleCache.js');
            GlobalSampleCache.clearAllBuffers?.();
          } catch {
            /* cache module optional; best-effort */
          }
          await engineForRebind.rebindContext?.(liveCtx, liveCtx.destination);
        }
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

      let engineState = engine?.getState?.();
      // Only 'ready'/'stopped' are startable (PlaybackEngine.start()). pause()
      // and stop() leave the engine in 'stopped', so a fresh start() re-runs
      // scheduleAllRegions() and the stems are audible again.
      //
      // Belt-and-suspenders for the rapid play/stop race: if we somehow arrive
      // here with the engine still 'playing' (a prior cycle's start() flipped it
      // and a stop didn't fully land), start() would early-return on its
      // isRunning/state guard and SILENTLY skip scheduleAllRegions — leaving the
      // bass + harmony + drums regions un-armed while the transport + metronome
      // keep running (the reported "no bass/harmony after rapid toggling" bug).
      // Force the engine back to 'stopped' first so start() always reschedules.
      if (engineState === 'playing') {
        engine?.stop?.();
        engineState = engine?.getState?.();
      }
      if (engineState === 'ready' || engineState === 'stopped') {
        engine.start?.();
      }

      // Time-stretch (LAUNCH-06): bass/harmony play through self-looping
      // buffer-streaming nodes that self-compensate their own latency, so
      // there's no 120ms pitch-engine offset to pre-roll against any more —
      // the old default→pitched rearm pre-roll here is gone. A pre-play key
      // tap is already applied to those nodes in becomeActive().

      await transport.start?.();

      // A stop()/pause() may have landed during the awaited transport.start()
      // above. If so the transport is now (re)started by THIS stale play() —
      // undo it (silence + stop), skip the count-in + isPlaying flip, and bail.
      // Inline the engine silence (rather than calling silenceEngine, declared
      // later) to keep play()'s dependency surface unchanged. The count-in
      // hasn't been started yet at this point, so there's nothing to cancel.
      if (isStale()) {
        const eng = WindowRegistry.getPlaybackEngine();
        eng?.stopAudioStems?.();
        eng?.stop?.();
        void transport.stop?.();
        setIsPlaying(false);
        setLoopStartAudioTime(null);
        return;
      }

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
    } finally {
      transitionInFlightRef.current = false;
    }
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
  // pause/stop are NOT blocked by the in-flight flag — stopping is a safety
  // action and must always be responsive. They DO clear the flag so a stop
  // that races a still-resolving play() leaves the next play() unblocked.
  // silenceEngine() → engine.stop() lands the engine synchronously in
  // 'stopped' (isRunning=false), so a subsequent play()'s engine.start() is a
  // clean (re)schedule rather than a skipped one.
  const pause = useCallback(async () => {
    // Bump the play epoch so any in-flight (possibly tab-throttled) play()
    // resumes into a stale state and aborts before re-arming audio.
    playGenRef.current++;
    transitionInFlightRef.current = false;
    silenceEngine();
    cancelCountdown();
    await transport.stop?.();
    setIsPlaying(false);
    setLoopStartAudioTime(null);
  }, [silenceEngine, cancelCountdown, transport]);

  const stop = useCallback(async () => {
    // Bump the play epoch so any in-flight (possibly tab-throttled) play()
    // resumes into a stale state and aborts before re-arming audio.
    playGenRef.current++;
    transitionInFlightRef.current = false;
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
      // Clear our buffer resolver. Owner-ID guarded — if another card
      // has taken over the engine since this card became active, this
      // call is a no-op (the engine won't wipe the successor's
      // resolver). Safe under React's loose sibling effect ordering.
      engine?.setPendingBufferResolver?.(null, cardId);
      activeStore.clearActiveCard(cardId);
      // Drop any in-flight pending-key-clear timer so it can't fire after
      // unmount (would setState on an unmounted hook).
      if (pendingKeyClearTimerRef.current) {
        clearTimeout(pendingKeyClearTimerRef.current);
        pendingKeyClearTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run only on unmount; capture trackPrefix + cardId at mount

  // ── waveform data ----------------------------------------------------------
  // Bass buffer for the waveform peaks + sweeping playhead. The buffer
  // is the same regardless of current key (pitch-shift is applied at
  // the pitch-shift node, not by swapping buffers).
  // loopDurationSeconds is hoisted above setKey so it's available there
  // for the deferred-pitch boundary computation.
  const bassBuffer = preload.getBuffer('bass') ?? null;

  return {
    isLoading,
    isReady,
    isPlaying,
    currentBpm,
    currentSemitones,
    mutedStems,
    soloedStem,
    clickEnabled,
    masterVolume,
    pendingKeyShift,
    bassBuffer,
    audioContext: audioContextRef.current,
    loopStartAudioTime,
    loopDurationSeconds,
    getAudioPhase,
    getNextSeamTime,
    getCurrentTime,
    // Effective transpose band: engine ±keyRange, tightened to the entitlement
    // band when capped — the SAME number setKey clamps to (see setKey). The
    // dial reads this so an auto-cycle target can never trip the cap path.
    transposeRange:
      caps?.transposeLimit != null
        ? Math.min(keyRange, caps.transposeLimit)
        : keyRange,
    countdownState,
    loopSelection,
    play,
    pause,
    stop,
    setTempo,
    setKey,
    setStemMuted,
    setStemSolo,
    setClickEnabled,
    setMasterVolume,
    setLoopSelection,
    becomeActive,
    becomeInactive,
  };
}
