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
//     SoundTouchJS WSOLA artifact load stays acceptable across ±6;
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
  const preloadRef = useRef(preload);
  // Tracks whether the bass/harmony signal chain was routed through
  // the SoundTouchNode on the previous setKey call. Used to choose
  // between immediate vs. boundary-deferred pitch writes: the FIRST
  // transition into pitched routing applies immediately (the source
  // was just discontinued by enablePitchShiftForStem's setStem call);
  // subsequent semitone-to-semitone changes within pitched state
  // schedule the AudioParam write at the next loop boundary so the
  // current loop finishes in the prior key.
  const pitchShiftPreviouslyActiveRef = useRef(false);
  // Map of region.id → AudioStemKey, populated by registerStemTracks so
  // the buffer resolver can look up which stem to serve for a given
  // region without re-parsing the region id string.
  const regionIdToStemKeyRef = useRef<Map<string, AudioStemKey>>(new Map());

  // Single-key-set + PitchShift architecture (LAUNCH-02.5e): the
  // resolver returns the SAME buffer regardless of current key — pitch
  // is applied at the SoundTouchNode, not by swapping buffers. The
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

  const setTempo = useCallback((bpm: number) => {
    const clamped = clampTempo(bpm);
    musicalTruth.setBPM(clamped);
  }, []);

  // Loop duration in seconds at the current BPM — used both by setKey
  // below (to compute the next loop-boundary audio time for the
  // deferred pitch write) and by the public reactive surface
  // (waveform playhead, etc.). Hoisted above setKey because TypeScript
  // flags forward refs in block-scoped declarations.
  const loopDurationSeconds = useMemo(() => {
    const secondsPerBeat = 60 / Math.max(1, currentBpm);
    return block.lengthBars * 4 * secondsPerBeat;
  }, [block.lengthBars, currentBpm]);

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

      // Single-key-set + PitchShift (LAUNCH-02.5e): the requested
      // semitone offset IS the residual the SoundTouchNode applies on
      // bass + harmony. Drums + click stay un-shifted regardless.
      const residualShift = desired;

      // LAUNCH-02.5c key-shift: apply the residual pitch on the bass +
      // harmony stems and rearm the WINDOW=3 pre-armed iterations so
      // the new buffer plays as soon as the currently-playing iter
      // ends (~1 iter latency, vs 3 iters without rearm).
      //
      // The pitch param write is DEFERRED to the next loop boundary
      // when we're already playing — otherwise a mid-loop tap would
      // produce an audible pitch jump in the middle of the iteration,
      // which contradicts the "queued for next loop" UX. Only the
      // first key tap (when not yet playing, or when transitioning
      // default↔pitched) snaps immediately so the engine state lines
      // up before the next play.
      const engine = WindowRegistry.getPlaybackEngine();
      if (engine) {
        const shouldEnable = residualShift !== 0;

        // Order of operations matters:
        //
        // 1. enablePitchShiftForStem FIRST — when transitioning from
        //    default → pitched it creates (lazily) the SoundTouchNode
        //    and re-routes the source through it. Idempotent when the
        //    routing already matches, so semitone-to-semitone changes
        //    don't trigger a setStem re-route (which would kill the
        //    in-flight source mid-loop). After this call, the
        //    SoundTouchNode is guaranteed to exist iff shouldEnable.
        //
        // 2. setPitchShiftLatencyCompensation — toggles drums + click
        //    + metronome delay. Idempotent at the engine level (no-op
        //    when state doesn't change), so it's safe to call on every
        //    tap.
        //
        // 3. setInstrumentPitchShift LAST — now the node exists, so
        //    the AudioParam write actually lands. We use the boundary-
        //    scheduled write ONLY when this is a semitone-to-semitone
        //    change (routing was already active); for the first
        //    transition (default → pitched), apply immediately because
        //    there's no "previous pitched loop" to preserve and the
        //    user just triggered a routing change that already
        //    discontinued the source.
        // seamless: true tells the engine NOT to kill the currently-
        // playing source on the routing change. The current iter
        // finishes at its old routing (default-key direct or pitched
        // through SoundTouchNode at the OLD pitch); future iters
        // armed by rearmFutureIterations pick up the new routing.
        // Combined with deferred pitch + drums-not-rearmed, this
        // gives the requested "current loop in OLD key, next loop
        // in NEW key" behaviour.
        engine.enablePitchShiftForStem?.('audio-bass', shouldEnable, {
          seamless: true,
        });
        engine.enablePitchShiftForStem?.('audio-harmony', shouldEnable, {
          seamless: true,
        });
        // Latency compensation (drums + click + metronome delay) is
        // intentionally LEFT DISABLED here. The pre-roll on bass +
        // harmony rearm (preRollSeconds: 0.12 below) makes their
        // SoundTouch-delayed output emerge at the natural seam —
        // already synchronised with drums + click + metronome at
        // their natural (un-delayed) timing. Adding a delay on the
        // non-pitched stems would push them 120ms late relative to
        // bass + harmony, undoing the alignment.
        engine.setPitchShiftLatencyCompensation?.(false, {
          seamless: true,
        });

        // Compute the next loop-boundary audio time for the deferred
        // pitch write. The pitch is ALWAYS deferred to the boundary
        // when playing, regardless of whether this is the first
        // transition into pitched routing or a subsequent semitone
        // change — the user's mental model is "current loop in OLD
        // key, NEXT loop in NEW key" universally.
        //
        // The rearm pre-rolls the new source's source.start by 120ms
        // so its SoundTouch-delayed output emerges at the natural
        // seam. We must align the pitchSemitones AudioParam write to
        // the SAME pre-rolled moment, otherwise the new source feeds
        // SoundTouch at the OLD pitch for 120ms before the param
        // catches up. So `applyAtAudioTime` = (natural seam - 120ms),
        // not the natural seam itself.
        //
        // When not playing, the pitch write is immediate (leave
        // applyAtAudioTime undefined) so the next play() picks it up.
        const ctx = audioContextRef.current;
        let nextBoundaryAudioTime: number | undefined;
        if (
          isPlaying &&
          ctx &&
          loopStartAudioTime != null &&
          loopDurationSeconds > 0
        ) {
          const elapsed = ctx.currentTime - loopStartAudioTime;
          const completedLoops =
            elapsed <= 0 ? 0 : Math.ceil(elapsed / loopDurationSeconds);
          const naturalSeamTime =
            loopStartAudioTime + completedLoops * loopDurationSeconds;
          // Pre-roll the param write to match the pre-rolled source.
          // 0.14 must stay in sync with engine's
          // SOUNDTOUCH_LATENCY_SECONDS + the rearm preRollSeconds —
          // see those for the math. 0.14 is sized to cover WSOLA's
          // sampleReq (~133ms at sequenceMs=110) with a small safety
          // margin so the seam falls AFTER WSOLA's first window is
          // ready, not exactly at the threshold.
          nextBoundaryAudioTime = Math.max(
            ctx.currentTime + 0.001,
            naturalSeamTime - 0.14,
          );
        }
        pitchShiftPreviouslyActiveRef.current = shouldEnable;

        engine.setInstrumentPitchShift?.(
          'audio-bass',
          residualShift,
          nextBoundaryAudioTime,
        );
        engine.setInstrumentPitchShift?.(
          'audio-harmony',
          residualShift,
          nextBoundaryAudioTime,
        );

        // Rearm only the pitch-shiftable stems (bass + harmony). Drums
        // play the same default-key recording regardless of which key
        // the user picks, so their pre-armed iterations stay valid and
        // there's nothing to swap. Re-arming them would just reload
        // the identical buffer.
        //
        // preRollSeconds: when transitioning into pitched routing
        // (default → pitched OR pitched → different pitched), the new
        // source feeds SoundTouchJS which adds ~120 ms of pipeline
        // delay. Pre-rolling the source start by that amount makes
        // its DELAYED output emerge at the natural seam, so old
        // (default-routed) audio ending at the seam connects
        // seamlessly to new (SoundTouch-routed) audio. Keep this in
        // sync with engine's SOUNDTOUCH_LATENCY_SECONDS constant.
        engine.rearmFutureIterationsForRegions?.(
          MUSICAL_STEMS.filter((t) =>
            isPitchShiftableStem(audioInstrumentTypeToStemKey(t)),
          ).map((t) => `${trackPrefix}${t}-region`),
          shouldEnable ? { preRollSeconds: 0.14 } : undefined,
        );
      }
    },
    [
      cardId,
      currentSemitones,
      isPlaying,
      keyRange,
      loopDurationSeconds,
      loopStartAudioTime,
      mode,
      pendingKeyShift,
      trackPrefix,
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
  }, [
    block.lengthBars,
    cardId,
    preload,
    trackPrefix,
    loopSelection,
  ]);

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

    // registerStemTracks must run BEFORE enablePitchShiftForStem because
    // the latter bails when there's no buffer registered for the stem.
    // This is also why pre-play key taps could appear inert: the
    // engine.audioStemBuffers map is empty until setAudioStemBuffers
    // runs inside registerStemTracks. After this call, the buffers are
    // present and the pitch-shift wiring can take effect.
    registerStemTracks();

    // Apply pitch-shift state for the currently-active key. For the
    // default key (offset 0) this is a no-op: residualShift is 0 and
    // enablePitchShiftForStem(false) keeps the PitchShift node bypassed
    // (source → gain directly). For a non-zero offset — which happens
    // when the user tapped key BEFORE pressing play — this is what
    // makes that pre-play tap audibly take effect on the first play.
    const residualShift = currentSemitonesRef.current;
    const shouldEnable = residualShift !== 0;
    engine?.enablePitchShiftForStem?.('audio-bass', shouldEnable);
    engine?.enablePitchShiftForStem?.('audio-harmony', shouldEnable);
    // setInstrumentPitchShift writes after enablePitchShiftForStem so
    // the PitchShift node has been lazily created with pitch=0 first;
    // this write then sets the actual residual. The reverse order is
    // also fine (the write is a no-op if no node, and the node defaults
    // to pitch=0 on creation) but this order is clearer.
    engine?.setInstrumentPitchShift?.('audio-bass', residualShift);
    engine?.setInstrumentPitchShift?.('audio-harmony', residualShift);
    // Latency compensation is intentionally left disabled (see setKey
    // comment for rationale). Bass + harmony pre-roll handles
    // alignment without delaying drums + click + metronome.
    engine?.setPitchShiftLatencyCompensation?.(false);
    // Reset the "previously pitched" tracker so setKey's first call
    // after this play correctly identifies the first transition into
    // pitched routing and writes the pitch immediately rather than
    // scheduling it for a (stale) boundary.
    pitchShiftPreviouslyActiveRef.current = shouldEnable;
  }, [activeStore, cardId, registerStemTracks]);

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
      // we just need to silence the current sources here. Click-free ramp
      // happens inside engine.stopAudioStems.
      engine.stopAudioStems?.();
      registerStemTracks();
    }, delayMs);

    return () => clearTimeout(id);
    // Intentionally limited deps: registerStemTracks + trackPrefix close over
    // the latest loopSelection via their own useCallback memoization. Watching
    // currentBpm / loopStartAudioTime here would re-trigger the swap on every
    // beat tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loopSelection, isPlaying]);

  // LAUNCH-02.5c key-shift, slice-mode branch.
  //
  // The standard key-swap path in setKey() calls
  // engine.rearmFutureIterationsForRegions, which tears down +
  // re-arms the WINDOW=3 pre-armed iterations. That mechanism is the
  // FAST path: it brings the audible swap to ~1 iter of latency.
  //
  // It does NOT work in bar-range loop-slice mode. Slice playback uses
  // native AudioBufferSourceNode.loop = true with a single source; there
  // is no per-iteration onended refill and rearmFutureIterations
  // explicitly skips slice entries (see RegionScheduler.ts). So for
  // slice mode we fall back to the same boundary-aligned
  // stopAudioStems + registerStemTracks pattern the loop-selection swap
  // effect above uses. The transport / metronome / count-in keep
  // running uninterrupted; only the stem source gets replaced — and
  // because registerStemTracks rebuilds buffers via the latest
  // currentSemitones (through the resolver-aware path), the new bass +
  // harmony key takes effect. Drums get a no-op re-arm against the
  // same default buffer at the boundary — inaudible because it's
  // bar-aligned and the buffer doesn't change.
  //
  // Gating notes (same shape as the loop-selection effect):
  //  - Only fire when slice mode is active and we're playing.
  //  - Only fire on an actual change in pendingKeyShift (a ref tracks
  //    the previous value) so we don't re-fire on every render.
  //  - The non-slice path is handled in setKey directly and does NOT
  //    trip this effect (loopSelection is null there).
  const prevPendingKeyShiftRef = useRef<number | null>(null);
  useEffect(() => {
    const prev = prevPendingKeyShiftRef.current;
    prevPendingKeyShiftRef.current = pendingKeyShift;
    if (prev === pendingKeyShift) return;
    if (pendingKeyShift === null) return; // settle, not a swap request
    if (loopSelection == null) return; // non-slice handled by rearm path
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
      engine.stopAudioStems?.();
      registerStemTracks();
    }, delayMs);

    return () => clearTimeout(id);
    // Limited deps for the same reason as the loop-selection effect:
    // currentBpm / loopStartAudioTime tick every beat. registerStemTracks
    // closes over the latest loopSelection + buffers; the effect only
    // needs to react to pendingKeyShift transitions while in slice mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKeyShift, loopSelection, isPlaying]);

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

    // LAUNCH-02.5c key-shift: if the user tapped key BEFORE pressing
    // play, the rearm path in setKey didn't run (no live iters to
    // rearm) and `engine.start()` just scheduled the first iters at
    // their NATURAL startAt times. But bass+harmony go through
    // SoundTouchJS which adds ~120ms processing delay, so they'd emit
    // 120ms LATER than drums. Apply the pre-roll now to shift their
    // source.start 120ms earlier so output emerges in sync with
    // drums. The engine's delta-tracking handles the case where
    // pre-roll was already applied (no-op); when starting fresh,
    // currentRearmPreRollSeconds is 0 so delta = full 0.12.
    const residualShiftAtPlay = currentSemitonesRef.current;
    if (residualShiftAtPlay !== 0 && engine) {
      engine.rearmFutureIterationsForRegions?.(
        MUSICAL_STEMS.filter((t) =>
          isPitchShiftableStem(audioInstrumentTypeToStemKey(t)),
        ).map((t) => `${trackPrefix}${t}-region`),
        { preRollSeconds: 0.14 },
      );
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
      // Clear our buffer resolver. Owner-ID guarded — if another card
      // has taken over the engine since this card became active, this
      // call is a no-op (the engine won't wipe the successor's
      // resolver). Safe under React's loose sibling effect ordering.
      engine?.setPendingBufferResolver?.(null, cardId);
      activeStore.clearActiveCard(cardId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run only on unmount; capture trackPrefix + cardId at mount

  // ── waveform data ----------------------------------------------------------
  // Bass buffer for the waveform peaks + sweeping playhead. The buffer
  // is the same regardless of current key (pitch-shift is applied at
  // the SoundTouchNode, not by swapping buffers).
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
    pendingKeyShift,
    bassBuffer,
    audioContext: audioContextRef.current,
    loopStartAudioTime,
    loopDurationSeconds,
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
    setLoopSelection,
    becomeActive,
    becomeInactive,
  };
}
