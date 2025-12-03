/**
 * RegionProcessorAdapter.ts - Backward Compatibility Adapter
 *
 * Wraps PlaybackEngine to provide RegionProcessor-compatible API
 * during migration period (Phase 2.2 - Phase 3.1).
 *
 * DEPRECATION TIMELINE:
 * - Phase 2.2: Adapter created, widgets migrate to PlaybackEngine
 * - Phase 3.1: Adapter marked for removal (all widgets migrated)
 * - Phase 3.2: Adapter removed from codebase
 *
 * MIGRATION GUIDE:
 * Instead of:
 *   const regionProcessor = coreServices.getRegionProcessor();
 *   regionProcessor.registerTracks([track1, track2]);
 *
 * Use:
 *   const playbackEngine = coreServices.getPlaybackEngine();
 *   playbackEngine.registerTrack(track1);
 *   playbackEngine.registerTrack(track2);
 */

import { PlaybackEngine } from './PlaybackEngine.js';
import type { PluginManager } from './PluginManager.js';
import type { WamKeyboard } from '../../modules/instruments/adapters/wam/WamKeyboard.js';

interface PatternEvent {
  position: string;
  type: string;
  velocity?: number;
  duration?: string;
}

interface Region {
  id: string;
  trackId: string;
  startTime: number;
  duration: number;
  skipCountdownOffset?: boolean;
  pattern?: {
    id?: string;
    name?: string;
    type?: string;
    events?: PatternEvent[];
  };
}

interface Track {
  id?: string;
  track?: { id?: string };
  name?: string;
  regions: Region[];
  instrumentType?: string;
  exerciseId?: string;
  audioNode?: any;
}

export class RegionProcessorAdapter {
  private playbackEngine: PlaybackEngine;
  private countdownEnabled = true; // Default from RegionProcessor

  constructor(playbackEngine: PlaybackEngine) {
    this.playbackEngine = playbackEngine;
  }

  /**
   * @deprecated Use PlaybackEngine.setCountdownConfig() directly
   */
  enableCountdown(timeSignature: {
    numerator: number;
    denominator: number;
  }): void {
    console.warn(
      '[DEPRECATED] RegionProcessorAdapter.enableCountdown() - Use PlaybackEngine.setCountdownConfig() directly',
    );
    this.countdownEnabled = true;
    const countdownBeats = timeSignature.numerator;
    this.playbackEngine.setCountdownConfig(countdownBeats, true);
  }

  /**
   * @deprecated Use PlaybackEngine.setCountdownConfig() directly
   * Sets countdown configuration to disabled state.
   */
  disableCountdown(): void {
    console.warn(
      '[DEPRECATED] RegionProcessorAdapter.disableCountdown() - Use PlaybackEngine.setCountdownConfig(beats, false) directly',
    );
    this.countdownEnabled = false;
    // Note: Can't fully disable without knowing beat count, set to 0
    this.playbackEngine.setCountdownConfig(0, false);
  }

  /**
   * @deprecated Use PlaybackEngine.addCountdownRegion() directly
   * Forwards to PlaybackEngine to create countdown metronome regions
   */
  addCountdownRegion(timeSignature: {
    numerator: number;
    denominator: number;
  }): void {
    console.warn(
      '[DEPRECATED] RegionProcessorAdapter.addCountdownRegion() - Use PlaybackEngine.addCountdownRegion() directly',
    );
    this.playbackEngine.addCountdownRegion(timeSignature);
  }

  /**
   * @deprecated Use PlaybackEngine.addVoiceCountdownRegion() directly
   * Forwards to PlaybackEngine to create voice cue countdown regions
   */
  addVoiceCountdownRegion(timeSignature: {
    numerator: number;
    denominator: number;
  }): void {
    console.warn(
      '[DEPRECATED] RegionProcessorAdapter.addVoiceCountdownRegion() - Use PlaybackEngine.addVoiceCountdownRegion() directly',
    );
    this.playbackEngine.addVoiceCountdownRegion(timeSignature);
  }

  /**
   * @deprecated AudioContext is set during PlaybackEngine.initialize()
   * This method is a no-op in the adapter.
   */
  setAudioContext(context: AudioContext): void {
    console.warn(
      '[DEPRECATED] RegionProcessorAdapter.setAudioContext() - AudioContext is set during PlaybackEngine.initialize()',
    );
    // No-op: PlaybackEngine gets AudioContext during initialize()
  }

  /**
   * @deprecated Use PlaybackEngine.setHarmonyBuffers() directly
   * Maps to PlaybackEngine's harmony buffer management.
   */
  async setHarmonyBuffers(
    buffers: Map<string, AudioBuffer> | Map<string, Map<string, AudioBuffer>>,
    destination: AudioNode,
    velocityRanges?: Record<string, any[]>,
    instrumentName?: string,
    grandPianoKeyboardMap?: Record<string, any>,
  ): Promise<void> {
    console.warn(
      '[DEPRECATED] RegionProcessorAdapter.setHarmonyBuffers() - Use PlaybackEngine.setHarmonyBuffers() directly',
    );

    // Forward to PlaybackEngine
    this.playbackEngine.setHarmonyBuffers(
      buffers,
      destination,
      velocityRanges,
      instrumentName,
    );
  }

  /**
   * @deprecated Use PlaybackEngine.setPluginManager() directly
   * Maps to PlaybackEngine's PluginManager integration.
   */
  setPluginManager(pluginManager: PluginManager): void {
    console.warn(
      '[DEPRECATED] RegionProcessorAdapter.setPluginManager() - Use PlaybackEngine.setPluginManager() directly',
    );
    this.playbackEngine.setPluginManager(pluginManager);
  }

  /**
   * @deprecated Use PlaybackEngine.setMetronomeBuffers() directly
   * Forwards to PlaybackEngine for proper buffer management
   */
  setMetronomeBuffers(
    accent: AudioBuffer,
    click: AudioBuffer,
    destination: AudioNode,
  ): void {
    console.warn(
      '[DEPRECATED] RegionProcessorAdapter.setMetronomeBuffers() - Use PlaybackEngine.setMetronomeBuffers() directly',
    );
    // Forward to PlaybackEngine
    this.playbackEngine.setMetronomeBuffers(accent, click, destination);
  }

  /**
   * @deprecated Use PlaybackEngine.setVoiceCueBuffers() directly
   * Forwards to PlaybackEngine for proper buffer management
   */
  setVoiceCueBuffers(
    samples: Map<string, AudioBuffer>,
    destination: AudioNode,
  ): void {
    console.warn(
      '[DEPRECATED] RegionProcessorAdapter.setVoiceCueBuffers() - Use PlaybackEngine.setVoiceCueBuffers() directly',
    );
    // Convert Map to Record for PlaybackEngine
    const buffers: Record<string, AudioBuffer> = {};
    samples.forEach((buffer, key) => {
      buffers[key] = buffer;
    });
    // Forward to PlaybackEngine
    this.playbackEngine.setVoiceCueBuffers(buffers, destination);
  }

  /**
   * @deprecated Use PlaybackEngine.getWamKeyboard() directly
   * Maps to PlaybackEngine's WAM keyboard access.
   */
  getWamKeyboard(): WamKeyboard | null {
    console.warn(
      '[DEPRECATED] RegionProcessorAdapter.getWamKeyboard() - Use PlaybackEngine.getWamKeyboard() directly',
    );
    return this.playbackEngine.getWamKeyboard();
  }

  /**
   * @deprecated Use PlaybackEngine.registerTrack() for each track
   */
  registerTracks(tracks: Track[]): void {
    console.warn(
      '[DEPRECATED] RegionProcessorAdapter.registerTracks() - Use PlaybackEngine.registerTrack() for each track',
    );

    // Register in PlaybackEngine
    tracks.forEach((track) => {
      const trackId = track.id || track.track?.id || `track-${Date.now()}`;
      const playbackTrack = {
        id: trackId,
        name: track.name || 'Unnamed Track',
        regions: track.regions,
        instrumentType: track.instrumentType || 'metronome',
        exerciseId: track.exerciseId,
        audioNode: track.audioNode,
      };

      this.playbackEngine.registerTrack(playbackTrack);
    });
  }

  /**
   * @deprecated Use PlaybackEngine.unregisterTrack() + registerTrack()
   * Maps track updates to unregister + register pattern.
   */
  updateTracks(tracks: Track[]): void {
    console.warn(
      '[DEPRECATED] RegionProcessorAdapter.updateTracks() - Use PlaybackEngine.unregisterTrack() + registerTrack() directly',
    );

    // Update = unregister old + register new
    tracks.forEach((track) => {
      const trackId = track.id || track.track?.id || `track-${Date.now()}`;

      // Unregister if exists
      this.playbackEngine.unregisterTrack(trackId);

      // Re-register with new data
      const playbackTrack = {
        id: trackId,
        name: track.name || 'Unnamed Track',
        regions: track.regions,
        instrumentType: track.instrumentType || 'metronome',
        exerciseId: track.exerciseId,
        audioNode: track.audioNode,
      };

      this.playbackEngine.registerTrack(playbackTrack);
    });
  }

  /**
   * @deprecated Use PlaybackEngine.start() directly
   */
  start(): void {
    console.warn(
      '[DEPRECATED] RegionProcessorAdapter.start() - Use PlaybackEngine.start() directly',
    );
    this.playbackEngine.start();
  }

  /**
   * @deprecated Use PlaybackEngine.stop() directly
   * Maps to PlaybackEngine's playback control with graceful stop support.
   */
  stop(graceful = false): void {
    console.warn(
      '[DEPRECATED] RegionProcessorAdapter.stop() - Use PlaybackEngine.stop() directly',
    );
    this.playbackEngine.stop(graceful);
  }

  /**
   * @deprecated Use PlaybackEngine.dispose() directly
   * Maps to PlaybackEngine's cleanup lifecycle.
   */
  dispose(): void {
    console.warn(
      '[DEPRECATED] RegionProcessorAdapter.dispose() - Use PlaybackEngine.dispose() directly',
    );
    this.playbackEngine.dispose();
  }

  /**
   * Gets the wrapped PlaybackEngine instance for direct access.
   * Use this to bypass the adapter when possible.
   */
  getPlaybackEngine(): PlaybackEngine {
    return this.playbackEngine;
  }
}
