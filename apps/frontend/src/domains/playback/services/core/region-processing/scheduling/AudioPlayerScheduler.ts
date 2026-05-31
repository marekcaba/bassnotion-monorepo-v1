/**
 * AudioPlayerScheduler - Sample-accurate audio-stem playback.
 *
 * Part of LAUNCH-02.5b. Implements the `Scheduler` interface from EventRouter
 * so audio stems (`instrumentType.startsWith('audio-')`) route through the
 * same sample-accurate frame alignment as MIDI instruments.
 *
 * Per-stem buffer + gain registration via `setStem(stemKey, buffer, gain)`
 * (called by PlaybackEngine.setAudioStemBuffers). On `schedule(event, audioTime)`,
 * creates an AudioBufferSourceNode from the cached buffer, connects to the
 * stem's gain node, and calls `source.start(audioTime, offsetSeconds)`.
 *
 * Stem identity travels via `event.data.stemKey` ('bass' | 'drums' | 'harmony'
 * | 'click') — the scheduler never inspects `instrumentType`.
 *
 * Looping is owned by RegionScheduler (the infinite-loop branch). This
 * scheduler fires exactly once per schedule() call.
 */

import { getLogger } from '@/utils/logger.js';
import type { PatternEvent, Scheduler } from '../event-routing/EventRouter.js';
import type { AudioStemKey } from '../../../../modules/tracks/management/TrackManagerProcessor.js';
import { applyClickFreeStop } from '../utils/applyClickFreeStop.js';

const logger = getLogger('AudioPlayerScheduler');

interface StemEntry {
  buffer: AudioBuffer;
  // Upstream connection point — sources connect HERE. Defaults to `gain`
  // for stems that don't need any pre-gain processing. LAUNCH-02.5c sets
  // this to a Tone.PitchShift input on the bass + harmony stems so they
  // can be transposed without touching the gain stage. Click-free stop
  // ramps still target `gain` (the real GainNode) downstream.
  input: AudioNode;
  gain: GainNode;
}

export class AudioPlayerScheduler implements Scheduler {
  private audioContext: AudioContext | null = null;
  private stems = new Map<AudioStemKey, StemEntry>();
  // Active sources tracked per stem so stopStem() / stopAll() can ramp them
  // down cleanly. Multiple sources per stem are allowed because the
  // crossfade pre-roll in RegionScheduler briefly overlaps outgoing +
  // incoming sources at iteration boundaries.
  private activeSources = new Map<AudioStemKey, Set<AudioBufferSourceNode>>();
  private instanceId: string;

  constructor(instanceId: string) {
    this.instanceId = instanceId;
  }

  setAudioContext(context: AudioContext): void {
    this.audioContext = context;
  }

  /**
   * Register or replace the buffer + gain node for a stem. Idempotent;
   * replacing a stem stops any in-flight source for that stem with a 5ms
   * ramp so the swap is click-free.
   *
   * Optional `input` is the upstream node sources connect to. Defaults to
   * `gain` when omitted (the historical behaviour). LAUNCH-02.5c passes a
   * `Tone.PitchShift` input for the bass + harmony stems so transposition
   * happens before the gain stage.
   */
  setStem(
    stemKey: AudioStemKey,
    buffer: AudioBuffer,
    gain: GainNode,
    input?: AudioNode,
    options?: { stopInFlight?: boolean },
  ): void {
    // Default behaviour: stop any in-flight source for this stem with
    // a 5 ms click-free ramp so the routing/buffer swap is audibly
    // seamless. Pass `stopInFlight: false` (used by LAUNCH-02.5c key-
    // shift mid-loop transitions) to leave current sources running so
    // they finish at the OLD routing — future sources arming from
    // RegionScheduler will pick up the NEW routing from the stems map.
    const shouldStop = options?.stopInFlight !== false;
    if (shouldStop && this.stems.has(stemKey)) {
      this.stopStem(stemKey);
    }
    this.stems.set(stemKey, { buffer, gain, input: input ?? gain });
    if (!this.activeSources.has(stemKey)) {
      this.activeSources.set(stemKey, new Set());
    }
    logger.debug(`Stem registered: ${stemKey}`, {
      instanceId: this.instanceId,
      durationSeconds: buffer.duration,
      stopInFlight: shouldStop,
    });
  }

  hasStem(stemKey: AudioStemKey): boolean {
    return this.stems.has(stemKey);
  }

  /**
   * Read-only accessor for the registered buffer + gain for a stem.
   * Used by RegionScheduler.scheduleInfiniteAudioRegion (LAUNCH-02.5b)
   * which needs to spawn its own AudioBufferSources to drive the
   * iteration boundary crossfade.
   */
  getStem(stemKey: AudioStemKey): Readonly<StemEntry> | null {
    return this.stems.get(stemKey) ?? null;
  }

  /**
   * Allow RegionScheduler to register an extra source for tracking so
   * stopAll() includes infinite-loop sources too.
   */
  trackExternalSource(
    stemKey: AudioStemKey,
    source: AudioBufferSourceNode,
  ): void {
    if (!this.activeSources.has(stemKey)) {
      this.activeSources.set(stemKey, new Set());
    }
    this.activeSources.get(stemKey)!.add(source);
    source.addEventListener('ended', () => {
      this.activeSources.get(stemKey)?.delete(source);
    });
  }

  /**
   * Schedule a single audio-stem fire-event at audioTime. The event must
   * carry `data.stemKey` identifying which registered stem to play; an
   * optional `data.offsetSeconds` skips into the buffer.
   *
   * Returns true if a source was started, false otherwise (missing
   * audioContext, unknown stemKey, missing buffer). Returning false signals
   * EventRouter to fall back to the event bus.
   */
  schedule(event: PatternEvent, audioTime: number, _frame: number): boolean {
    if (!this.audioContext) {
      logger.debug('schedule(): no audio context, dropping event');
      return false;
    }

    const stemKey = event.data?.stemKey as AudioStemKey | undefined;
    if (!stemKey) {
      logger.warn('schedule(): event missing data.stemKey', {
        eventType: event.type,
      });
      return false;
    }

    const entry = this.stems.get(stemKey);
    if (!entry) {
      logger.debug(`schedule(): no stem registered for "${stemKey}"`);
      return false;
    }

    const offsetSeconds =
      typeof event.data?.offsetSeconds === 'number'
        ? event.data.offsetSeconds
        : 0;

    const source = this.audioContext.createBufferSource();
    source.buffer = entry.buffer;
    source.connect(entry.input);

    // Auto-clean once playback ends so the activeSources set doesn't grow.
    source.onended = () => {
      this.activeSources.get(stemKey)?.delete(source);
    };

    source.start(audioTime, offsetSeconds);
    this.activeSources.get(stemKey)?.add(source);
    return true;
  }

  /**
   * Stop every active source for a stem with a 5ms gain ramp-down to avoid
   * clicks. Safe to call when nothing is playing.
   */
  stopStem(stemKey: AudioStemKey): void {
    const sources = this.activeSources.get(stemKey);
    if (!sources || sources.size === 0) return;
    const entry = this.stems.get(stemKey);

    // Click-free ramp + restore resting volume so the cached gain node
    // stays usable for the next playback. (Without the restore — the
    // pre-helper implementation — the gain stayed at 0 and replays were
    // silent.)
    const { stopAt } = applyClickFreeStop(entry?.gain, this.audioContext, {
      onError: (err) =>
        logger.debug(`stopStem(${stemKey}): gain ramp failed`, { err }),
    });

    sources.forEach((source) => {
      try {
        source.stop(stopAt);
      } catch {
        // source already stopped — silently ignore
      }
    });
    sources.clear();
  }

  /**
   * Stop every active source across every stem. Used by
   * PlaybackEngine.stopAudioStems.
   */
  stopAll(): void {
    for (const stemKey of this.activeSources.keys()) {
      this.stopStem(stemKey);
    }
  }

  /**
   * Drop everything — stop active sources and forget all registered stems.
   * Used when PlaybackEngine resets or a card unmounts.
   */
  dispose(): void {
    this.stopAll();
    this.stems.clear();
    this.activeSources.clear();
  }
}
