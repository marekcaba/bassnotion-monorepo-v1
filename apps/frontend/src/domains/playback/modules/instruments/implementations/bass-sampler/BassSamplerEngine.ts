/**
 * Bass Sampler Engine
 *
 * Core sampler engine for bass sample playback.
 * Follows the DrumSampleEngine pattern with bass-specific features.
 */

import type * as ToneTypes from 'tone';
import {
  BaseInstrumentCore,
  ISamplerCore,
} from '../../architecture/IInstrumentCore.js';
import type { Note } from '../../architecture/IInstrumentCore.js';
import { createStructuredLogger } from '@bassnotion/contracts';
import type {
  BassNote,
  BassSamplerOptions,
  BassSampleMap,
  RoundRobinState,
  MemoryStats,
} from './types.js';
import {
  midiNoteToName,
  BASS_NOTE_RANGE,
  getPositionForMidiNote,
} from './types.js';
import { getBufferKey } from './BassSampleManifest.js';

// Helper to get Tone from window (must be initialized before BassSamplerEngine is used)
function getTone(): typeof import('tone') {
  if (typeof window !== 'undefined') {
    const tone = window.Tone || window.__globalTone;
    if (tone) {
      return tone as typeof import('tone');
    }
  }
  throw new Error(
    'BassSamplerEngine: Tone.js not loaded. Ensure AudioEngine is initialized first.',
  );
}

const logger = createStructuredLogger('BassSamplerEngine');

/**
 * Bass Sampler Engine
 *
 * Manages bass sample loading and playback with:
 * - MIDI note-based sample triggering
 * - Velocity-sensitive playback
 * - Effects chain (compressor, reverb, pan, volume)
 * - Monophonic mode support
 * - ADSR envelope (attack, decay, sustain, release)
 * - Round-robin support for repeated notes
 * - Memory management with LRU eviction
 */
export class BassSamplerEngine
  extends BaseInstrumentCore
  implements ISamplerCore
{
  readonly id = 'bass-sampler-engine';
  readonly type = 'bass';
  readonly name = 'Bass Sampler Engine';

  // Audio buffers keyed by MIDI note number (as string)
  private buffers: Map<string, AudioBuffer> = new Map();

  // Tone.js Players for each loaded buffer
  private players: Map<string, ToneTypes.Player> = new Map();

  // Effects chain
  private volume: ToneTypes.Volume | null = null;
  private panner: ToneTypes.Panner | null = null;
  private reverb: ToneTypes.Reverb | null = null;
  private compressor: ToneTypes.Compressor | null = null;
  private reverbMix: ToneTypes.CrossFade | null = null;

  // Monophonic mode - only one note plays at a time
  private monophonic = true;
  private currentNote: string | null = null;

  // Round-robin state for repeated notes
  private roundRobinState: Map<string, RoundRobinState> = new Map();
  private roundRobinEnabled = true;
  private minRetriggerTime = 0.05; // 50ms minimum between same note triggers

  // Memory management - LRU tracking
  private noteAccessOrder: string[] = [];
  private memoryLimitBytes: number;
  private estimatedMemoryUsage = 0;

  // Options stored for deferred initialization
  private options: BassSamplerOptions;

  constructor(options: BassSamplerOptions = {}) {
    super();
    this.options = {
      volume: -6,
      pan: 0,
      reverb: 0,
      compression: true,
      attack: 0.005,
      decay: 0.1,
      sustain: 0.8,
      release: 0.3,
      roundRobin: true,
      maxSamplesPerNote: 2,
      memoryLimitMB: 50,
      ...options,
    };
    this.roundRobinEnabled = this.options.roundRobin ?? true;
    this.memoryLimitBytes = (this.options.memoryLimitMB ?? 50) * 1024 * 1024;
  }

  async initialize(): Promise<void> {
    if (this.state.initialized) return;

    this.state.loading = true;

    try {
      const Tone = getTone();

      // Create effects chain with pan control
      this.volume = new Tone.Volume(this.options.volume ?? -6);
      this.panner = new Tone.Panner(this.options.pan ?? 0);
      this.reverb = new Tone.Reverb({ decay: 1.5, wet: 0 });
      this.compressor = new Tone.Compressor({
        threshold: -18,
        ratio: 3,
        attack: 0.005,
        release: 0.15,
      });
      this.reverbMix = new Tone.CrossFade(this.options.reverb ?? 0);

      // Connect chain: players -> compressor -> reverbMix -> panner -> volume
      this.compressor.connect(this.reverbMix.a);
      this.compressor.connect(this.reverb);
      this.reverb.connect(this.reverbMix.b);
      this.reverbMix.connect(this.panner);
      this.panner.connect(this.volume);

      this.output = this.volume;

      if (!this.options.compression) {
        this.compressor.wet.value = 0;
      }

      this.state.initialized = true;
      this.state.loading = false;
      this.state.ready = true;

      logger.info('BassSamplerEngine initialized', {
        volume: this.options.volume,
        pan: this.options.pan,
        reverb: this.options.reverb,
        compression: this.options.compression,
        attack: this.options.attack,
        decay: this.options.decay,
        sustain: this.options.sustain,
        release: this.options.release,
        roundRobin: this.roundRobinEnabled,
        memoryLimitMB: this.options.memoryLimitMB,
      });
    } catch (error) {
      this.state.error = error as Error;
      this.state.loading = false;
      logger.error('Failed to initialize BassSamplerEngine', error);
      throw error;
    }
  }

  async dispose(): Promise<void> {
    this.unloadSamples();

    this.volume?.dispose();
    this.panner?.dispose();
    this.reverb?.dispose();
    this.compressor?.dispose();
    this.reverbMix?.dispose();

    this.volume = null;
    this.panner = null;
    this.reverb = null;
    this.compressor = null;
    this.reverbMix = null;

    // Clear round-robin and memory tracking state
    this.roundRobinState.clear();
    this.noteAccessOrder = [];
    this.estimatedMemoryUsage = 0;

    this.state.ready = false;
    this.state.initialized = false;

    logger.info('BassSamplerEngine disposed');
  }

  /**
   * Load samples from a buffer map
   * @param buffers - Map of MIDI note number (as string) to AudioBuffer
   */
  async loadBuffers(buffers: Record<string, AudioBuffer>): Promise<void> {
    if (!this.state.initialized) {
      await this.initialize();
    }

    const Tone = getTone();

    // Clear existing players
    this.unloadSamples();

    // Store buffers and track memory
    for (const [key, buffer] of Object.entries(buffers)) {
      // Check memory limit before adding
      const bufferSize = this.estimateBufferSize(buffer);
      if (this.estimatedMemoryUsage + bufferSize > this.memoryLimitBytes) {
        // Evict least recently used samples
        this.evictLRUSamples(bufferSize);
      }

      this.buffers.set(key, buffer);
      this.estimatedMemoryUsage += bufferSize;
      this.updateLRUAccess(key);
    }

    // Create players for each buffer with ADSR envelope settings
    for (const [key, buffer] of this.buffers) {
      const toneBuffer = new Tone.ToneAudioBuffer(buffer);

      const player = new Tone.Player({
        url: toneBuffer,
        fadeIn: this.options.attack ?? 0.005,
        fadeOut: this.options.release ?? 0.3,
      });

      // Connect to effects chain
      if (this.compressor) {
        player.connect(this.compressor);
      }

      this.players.set(key, player);

      // Initialize round-robin state for this note
      if (this.roundRobinEnabled) {
        this.roundRobinState.set(key, {
          indices: [0], // Single sample for now, can be extended
          currentIndex: 0,
          lastTriggerTime: 0,
        });
      }
    }

    logger.info('Bass samples loaded', {
      count: this.players.size,
      estimatedMemoryMB: (this.estimatedMemoryUsage / (1024 * 1024)).toFixed(2),
      notes: Array.from(this.buffers.keys()).map(
        (k) => `${k}:${midiNoteToName(parseInt(k, 10))}`,
      ),
    });
  }

  /**
   * Trigger a bass note
   */
  trigger(note: Note): void {
    const Tone = getTone();
    const bassNote = note as BassNote;
    const midiNote =
      bassNote.midiNote ?? (typeof note.pitch === 'number' ? note.pitch : 0);

    if (!this.isValidNote(midiNote)) {
      logger.warn('Invalid bass MIDI note', { midiNote });
      return;
    }

    const bufferKey = getBufferKey(midiNote);
    const player = this.players.get(bufferKey);

    if (!player) {
      logger.warn('No sample loaded for note', {
        midiNote,
        bufferKey,
        availableKeys: Array.from(this.players.keys()),
      });
      return;
    }

    // In monophonic mode, stop any currently playing note
    if (this.monophonic && this.currentNote) {
      this.stopNote(this.currentNote);
    }

    // Update LRU access order
    this.updateLRUAccess(bufferKey);

    // Get round-robin index (prevents machine gun effect)
    const rrIndex = this.getNextRoundRobinIndex(bufferKey);

    const time = bassNote.time ?? Tone.now();
    const velocity = (bassNote.velocity ?? 100) / 127;

    // Apply ADSR envelope via velocity and player settings
    // Attack/release are set on player, decay/sustain affect volume curve
    const sustainLevel = this.options.sustain ?? 0.8;
    const adjustedVelocity = velocity * sustainLevel;

    // Start playback with velocity-based volume
    player.volume.value = this.velocityToDb(adjustedVelocity);
    player.start(time);

    this.currentNote = bufferKey;

    // Track active note
    const noteEvent = {
      id: this.generateNoteId(note),
      ...bassNote,
      startTime: time,
      active: true,
    };

    this.state.activeNotes.set(noteEvent.id, noteEvent);

    // Auto-release after duration (if specified)
    if (bassNote.duration && bassNote.duration > 0) {
      Tone.Transport.schedule(() => {
        this.release(bassNote);
      }, time + bassNote.duration);
    }

    logger.debug('Bass note triggered', {
      midiNote,
      noteName: midiNoteToName(midiNote),
      velocity: bassNote.velocity,
      time,
      roundRobinIndex: rrIndex,
    });
  }

  /**
   * Release a bass note
   */
  release(note: Note): void {
    const bassNote = note as BassNote;
    const midiNote =
      bassNote.midiNote ?? (typeof note.pitch === 'number' ? note.pitch : 0);
    const bufferKey = getBufferKey(midiNote);

    this.stopNote(bufferKey);

    // Remove from active notes
    for (const [noteId, activeNote] of this.state.activeNotes) {
      if ((activeNote as BassNote).midiNote === midiNote) {
        this.state.activeNotes.delete(noteId);
      }
    }

    if (this.currentNote === bufferKey) {
      this.currentNote = null;
    }
  }

  /**
   * Stop a specific note by buffer key
   */
  private stopNote(bufferKey: string): void {
    const player = this.players.get(bufferKey);
    if (player && player.state === 'started') {
      player.stop();
    }
  }

  /**
   * Trigger by MIDI note number
   */
  triggerMidiNote(midiNote: number, velocity = 100, time?: number): void {
    this.trigger({
      pitch: midiNote,
      velocity,
      midiNote,
      time,
    } as BassNote);
  }

  /**
   * Release by MIDI note number
   */
  releaseMidiNote(midiNote: number): void {
    this.release({
      pitch: midiNote,
      velocity: 0,
      midiNote,
    } as BassNote);
  }

  /**
   * Stop all playing notes
   */
  releaseAll(): void {
    for (const player of this.players.values()) {
      if (player.state === 'started') {
        player.stop();
      }
    }
    this.state.activeNotes.clear();
    this.currentNote = null;
  }

  // ISamplerCore implementation

  async loadSamples(urls: Record<string, string>): Promise<void> {
    const Tone = getTone();

    // Clear existing
    this.unloadSamples();

    // Load each sample from URL
    const loadPromises: Promise<void>[] = [];

    for (const [note, url] of Object.entries(urls)) {
      loadPromises.push(this.loadSampleFromUrl(note, url));
    }

    await Promise.all(loadPromises);

    logger.info('Samples loaded from URLs', { count: this.players.size });
  }

  private async loadSampleFromUrl(note: string, url: string): Promise<void> {
    const Tone = getTone();

    try {
      const player = new Tone.Player({
        url,
        fadeIn: this.options.attack ?? 0.005,
        fadeOut: this.options.release ?? 0.3,
        onload: () => {
          logger.info(`Loaded bass sample: ${note}`);
        },
        onerror: (error: Error) => {
          logger.error(`Failed to load bass sample: ${note}`, error);
        },
      });

      if (this.compressor) {
        player.connect(this.compressor);
      }

      this.players.set(note, player);
    } catch (error) {
      logger.error(`Error loading sample ${note}`, error);
    }
  }

  unloadSamples(): void {
    for (const player of this.players.values()) {
      player.dispose();
    }
    this.players.clear();
    this.buffers.clear();
    this.state.activeNotes.clear();
    this.currentNote = null;
  }

  getSampleStatus(): Map<string, 'loading' | 'ready' | 'error'> {
    const status = new Map<string, 'loading' | 'ready' | 'error'>();

    for (const [key, player] of this.players) {
      if (player.loaded) {
        status.set(key, 'ready');
      } else {
        status.set(key, 'loading');
      }
    }

    return status;
  }

  // Control methods

  /**
   * Set reverb amount (0-1)
   */
  setReverb(amount: number): void {
    if (this.reverbMix) {
      this.reverbMix.fade.value = Math.max(0, Math.min(1, amount));
    }
  }

  /**
   * Set compression enabled
   */
  setCompression(enabled: boolean): void {
    if (this.compressor) {
      this.compressor.wet.value = enabled ? 1 : 0;
    }
  }

  /**
   * Set volume in dB
   */
  setVolume(volumeDb: number): void {
    if (this.volume) {
      this.volume.volume.value = volumeDb;
    }
  }

  /**
   * Set pan position (-1 left to 1 right)
   */
  setPan(pan: number): void {
    if (this.panner) {
      this.panner.pan.value = Math.max(-1, Math.min(1, pan));
    }
  }

  /**
   * Set ADSR envelope parameters
   */
  setEnvelope(params: {
    attack?: number;
    decay?: number;
    sustain?: number;
    release?: number;
  }): void {
    if (params.attack !== undefined) this.options.attack = params.attack;
    if (params.decay !== undefined) this.options.decay = params.decay;
    if (params.sustain !== undefined) this.options.sustain = params.sustain;
    if (params.release !== undefined) this.options.release = params.release;

    // Update existing players with new envelope
    for (const player of this.players.values()) {
      if (params.attack !== undefined) player.fadeIn = params.attack;
      if (params.release !== undefined) player.fadeOut = params.release;
    }

    logger.info('Envelope updated', params);
  }

  /**
   * Set monophonic mode
   */
  setMonophonic(mono: boolean): void {
    this.monophonic = mono;
    if (mono) {
      // Stop all but current note
      for (const [key, player] of this.players) {
        if (key !== this.currentNote && player.state === 'started') {
          player.stop();
        }
      }
    }
  }

  /**
   * Enable/disable round-robin
   */
  setRoundRobin(enabled: boolean): void {
    this.roundRobinEnabled = enabled;
    if (!enabled) {
      // Reset all round-robin states
      for (const state of this.roundRobinState.values()) {
        state.currentIndex = 0;
      }
    }
  }

  /**
   * Get loaded sample count
   */
  getLoadedCount(): number {
    return this.players.size;
  }

  /**
   * Get loaded MIDI notes
   */
  getLoadedNotes(): number[] {
    return Array.from(this.players.keys()).map((k) => parseInt(k, 10));
  }

  /**
   * Check if a MIDI note is loaded
   */
  hasNote(midiNote: number): boolean {
    return this.players.has(getBufferKey(midiNote));
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): MemoryStats {
    const samplesPerNote = new Map<number, number>();
    for (const key of this.buffers.keys()) {
      const midiNote = parseInt(key, 10);
      samplesPerNote.set(midiNote, (samplesPerNote.get(midiNote) || 0) + 1);
    }

    return {
      totalSamples: this.buffers.size,
      estimatedBytes: this.estimatedMemoryUsage,
      estimatedMB: this.estimatedMemoryUsage / (1024 * 1024),
      samplesPerNote,
      lruNotes: [...this.noteAccessOrder].map((k) => parseInt(k, 10)),
    };
  }

  /**
   * Manually evict samples to free memory
   * @param targetMB - Target memory usage in MB
   */
  evictToTarget(targetMB: number): void {
    const targetBytes = targetMB * 1024 * 1024;
    if (this.estimatedMemoryUsage <= targetBytes) return;

    const bytesToFree = this.estimatedMemoryUsage - targetBytes;
    this.evictLRUSamples(bytesToFree);
  }

  /**
   * Unload a specific MIDI note to free memory
   */
  unloadNote(midiNote: number): void {
    const bufferKey = getBufferKey(midiNote);
    const buffer = this.buffers.get(bufferKey);
    const player = this.players.get(bufferKey);

    if (player) {
      if (player.state === 'started') {
        player.stop();
      }
      player.dispose();
      this.players.delete(bufferKey);
    }

    if (buffer) {
      this.estimatedMemoryUsage -= this.estimateBufferSize(buffer);
      this.buffers.delete(bufferKey);
    }

    this.roundRobinState.delete(bufferKey);
    this.noteAccessOrder = this.noteAccessOrder.filter((k) => k !== bufferKey);

    logger.info('Note unloaded', {
      midiNote,
      noteName: midiNoteToName(midiNote),
    });
  }

  // Helper methods

  private isValidNote(midiNote: number): boolean {
    return midiNote >= BASS_NOTE_RANGE.min && midiNote <= BASS_NOTE_RANGE.max;
  }

  private velocityToDb(velocity: number): number {
    // Map 0-1 velocity to dB range (-24 to 0)
    const minDb = -24;
    const maxDb = 0;
    return minDb + velocity * (maxDb - minDb);
  }

  /**
   * Estimate AudioBuffer memory size in bytes
   */
  private estimateBufferSize(buffer: AudioBuffer): number {
    // Float32 = 4 bytes per sample
    return buffer.length * buffer.numberOfChannels * 4;
  }

  /**
   * Update LRU access order for a note
   */
  private updateLRUAccess(bufferKey: string): void {
    // Remove from current position
    const index = this.noteAccessOrder.indexOf(bufferKey);
    if (index > -1) {
      this.noteAccessOrder.splice(index, 1);
    }
    // Add to end (most recently used)
    this.noteAccessOrder.push(bufferKey);
  }

  /**
   * Evict least recently used samples to free memory
   */
  private evictLRUSamples(bytesNeeded: number): void {
    let bytesFreed = 0;
    const evicted: string[] = [];

    while (bytesFreed < bytesNeeded && this.noteAccessOrder.length > 0) {
      // Get least recently used (first in array)
      const lruKey = this.noteAccessOrder.shift();
      if (!lruKey) break;

      const buffer = this.buffers.get(lruKey);
      const player = this.players.get(lruKey);

      if (buffer) {
        const bufferSize = this.estimateBufferSize(buffer);
        bytesFreed += bufferSize;
        this.estimatedMemoryUsage -= bufferSize;
        this.buffers.delete(lruKey);
      }

      if (player) {
        if (player.state === 'started') {
          player.stop();
        }
        player.dispose();
        this.players.delete(lruKey);
      }

      this.roundRobinState.delete(lruKey);
      evicted.push(lruKey);
    }

    if (evicted.length > 0) {
      logger.info('LRU eviction', {
        evictedCount: evicted.length,
        evictedNotes: evicted.map(
          (k) => `${k}:${midiNoteToName(parseInt(k, 10))}`,
        ),
        bytesFreed,
        bytesFreedMB: (bytesFreed / (1024 * 1024)).toFixed(2),
      });
    }
  }

  /**
   * Get round-robin sample index for a note
   * Prevents "machine gun" effect when same note is triggered rapidly
   */
  private getNextRoundRobinIndex(bufferKey: string): number {
    if (!this.roundRobinEnabled) return 0;

    const state = this.roundRobinState.get(bufferKey);
    if (!state) return 0;

    const now = performance.now() / 1000;
    const timeSinceLastTrigger = now - state.lastTriggerTime;

    // If retriggered too fast, use next sample in round-robin
    if (
      timeSinceLastTrigger < this.minRetriggerTime &&
      state.indices.length > 1
    ) {
      state.currentIndex = (state.currentIndex + 1) % state.indices.length;
    }

    state.lastTriggerTime = now;
    return state.indices[state.currentIndex];
  }
}

/**
 * Create a new BassSamplerEngine instance
 */
export function createBassSamplerEngine(
  options?: BassSamplerOptions,
): BassSamplerEngine {
  return new BassSamplerEngine(options);
}
