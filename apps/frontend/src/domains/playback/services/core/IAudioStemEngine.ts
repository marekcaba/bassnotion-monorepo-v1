/**
 * IAudioStemEngine — contract pin for LAUNCH-02.5b.
 *
 * Declared in 02.5a so 02.5c can scaffold against this interface while
 * 02.5b implements it on PlaybackEngine. No implementation lives here;
 * this file is types-only.
 */

import type { AudioInstrumentType } from '../../modules/tracks/management/TrackManagerProcessor.js';

export interface IAudioStemEngine {
  /**
   * Load decoded AudioBuffers for each stem. Idempotent — replacing previous
   * buffers stops any in-flight source for that stem.
   */
  setAudioStemBuffers(
    stems: Partial<Record<AudioInstrumentType, AudioBuffer>>,
  ): void;

  /**
   * Stop all audio stems with a click-free gain ramp. Sources are owned
   * by AudioPlayerScheduler (per-event) and RegionScheduler (infinite-loop
   * iterations) — engine.stopAudioStems() delegates to both. There is no
   * matching `startAudioStems()`: audio stems start via the same region/
   * event pipeline as MIDI, i.e. PlaybackEngine.start() →
   * scheduleAllRegions() → RegionScheduler.scheduleInfiniteAudioRegion()
   * (Groove Card) or AudioPlayerScheduler.schedule() (one-shots).
   */
  stopAudioStems(): void;

  /**
   * Unregister all tracks whose trackId begins with the given prefix.
   * Used by Groove Card per-card cleanup so two cards on one page don't
   * clobber each other's tracks on the shared PlaybackEngine.
   */
  unregisterTracksByPrefix(prefix: string): void;
}
