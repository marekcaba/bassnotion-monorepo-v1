/**
 * Drum Sample Engine
 *
 * Manages drum sample loading and playback
 */

import type * as ToneTypes from 'tone';
import {
  BaseInstrumentCore,
  ISamplerCore,
} from '../../architecture/IInstrumentCore.js';
import type { Note } from '../../architecture/IInstrumentCore.js';
import { createStructuredLogger } from '@bassnotion/contracts';

// Helper to get Tone from window (must be initialized before DrumSampleEngine is used)
function getTone(): typeof import('tone') {
  if (typeof window !== 'undefined') {
    // Check both locations where Tone.js may be stored
    const tone = (window as any).Tone || (window as any).__globalTone;
    if (tone) {
      return tone;
    }
  }
  throw new Error('DrumSampleEngine: Tone.js not loaded. Ensure AudioEngine is initialized first.');
}

const logger = createStructuredLogger('DrumSampleEngine');

export interface DrumNote extends Note {
  drum: string; // Drum type (kick, snare, hihat, etc.)
  variation?: number; // For multi-sample drums
  choke?: boolean; // For hi-hat choking
}

export interface DrumKitPiece {
  id: string;
  name: string;
  samples: {
    [velocity: string]: string | string[]; // URL(s) for samples
  };
  midiNote?: number; // MIDI note mapping
  group?: string; // For choke groups (e.g., 'hihat')
  envelope?: Partial<ToneTypes.EnvelopeOptions>;
  filter?: Partial<ToneTypes.FilterOptions>;
}

export interface DrumKit {
  id: string;
  name: string;
  description?: string;
  pieces: Record<string, DrumKitPiece>;
  metadata?: {
    genre?: string;
    tempo?: number;
    author?: string;
  };
}

export interface DrumSampleEngineOptions {
  kit?: DrumKit;
  volume?: number;
  reverb?: number;
  compression?: boolean;
}

/**
 * Engine for drum sample playback
 */
export class DrumSampleEngine
  extends BaseInstrumentCore
  implements ISamplerCore
{
  readonly id = 'drum-sample-engine';
  readonly type = 'drums';
  readonly name = 'Drum Sample Engine';

  private kit: DrumKit | null = null;
  private samplers: Map<string, ToneTypes.Sampler> = new Map();
  private chokeGroups: Map<string, Set<string>> = new Map();
  private volume: ToneTypes.Volume | null = null;
  private reverb: ToneTypes.Reverb | null = null;
  private compressor: ToneTypes.Compressor | null = null;
  private reverbMix: ToneTypes.CrossFade | null = null;

  // Store options for deferred initialization
  private options: DrumSampleEngineOptions;

  constructor(options: DrumSampleEngineOptions = {}) {
    super();
    this.options = options;

    if (options.kit) {
      this.kit = options.kit;
    }

    // Audio nodes will be created during initialize()
  }

  async initialize(): Promise<void> {
    if (this.state.initialized) return;

    this.state.loading = true;

    try {
      const Tone = getTone();

      // Create effects chain (deferred from constructor)
      this.volume = new Tone.Volume(this.options.volume || -6);
      this.reverb = new Tone.Reverb({ decay: 2, wet: 0 });
      this.compressor = new Tone.Compressor({
        threshold: -12,
        ratio: 4,
        attack: 0.003,
        release: 0.1,
      });
      this.reverbMix = new Tone.CrossFade(this.options.reverb || 0);

      // Connect chain: samplers -> compressor -> reverbMix -> volume
      this.compressor.connect(this.reverbMix.a);
      this.compressor.connect(this.reverb);
      this.reverb.connect(this.reverbMix.b);
      this.reverbMix.connect(this.volume);

      this.output = this.volume;

      if (!this.options.compression) {
        this.compressor.wet.value = 0;
      }

      if (this.kit) {
        await this.loadKit(this.kit);
      }

      this.state.initialized = true;
      this.state.loading = false;
      this.state.ready = true;

      logger.info('DrumSampleEngine initialized', {
        kit: this.kit?.name,
        pieces: this.samplers.size,
      });
    } catch (error) {
      this.state.error = error as Error;
      this.state.loading = false;
      logger.error('Failed to initialize DrumSampleEngine', error);
      throw error;
    }
  }

  async dispose(): Promise<void> {
    this.unloadSamples();

    this.volume?.dispose();
    this.reverb?.dispose();
    this.compressor?.dispose();
    this.reverbMix?.dispose();

    this.volume = null;
    this.reverb = null;
    this.compressor = null;
    this.reverbMix = null;

    this.state.ready = false;
    this.state.initialized = false;

    logger.info('DrumSampleEngine disposed');
  }

  /**
   * Load a drum kit
   */
  async loadKit(kit: DrumKit): Promise<void> {
    this.unloadSamples();
    this.kit = kit;

    // Build choke groups
    this.chokeGroups.clear();
    for (const [drumId, piece] of Object.entries(kit.pieces)) {
      if (piece.group) {
        if (!this.chokeGroups.has(piece.group)) {
          this.chokeGroups.set(piece.group, new Set());
        }
        this.chokeGroups.get(piece.group)!.add(drumId);
      }
    }

    // Load samples for each drum piece
    const loadPromises: Promise<void>[] = [];

    for (const [drumId, piece] of Object.entries(kit.pieces)) {
      loadPromises.push(this.loadDrumPiece(drumId, piece));
    }

    await Promise.all(loadPromises);

    logger.info('Drum kit loaded', {
      kit: kit.name,
      pieces: Object.keys(kit.pieces).length,
    });
  }

  /**
   * Load a single drum piece
   */
  private async loadDrumPiece(
    drumId: string,
    piece: DrumKitPiece,
  ): Promise<void> {
    const Tone = getTone();

    // Build URL map for sampler
    const urls: Record<string, string> = {};
    let noteCounter = 60; // Start from C4

    for (const [_velocity, sampleUrl] of Object.entries(piece.samples)) {
      if (typeof sampleUrl === 'string') {
        urls[Tone.Frequency(noteCounter, 'midi').toNote()] = sampleUrl;
        noteCounter++;
      } else if (Array.isArray(sampleUrl)) {
        // Round-robin for variations
        for (const url of sampleUrl) {
          urls[Tone.Frequency(noteCounter, 'midi').toNote()] = url;
          noteCounter++;
        }
      }
    }

    // Create sampler
    const sampler = new Tone.Sampler({
      urls,
      onload: () => {
        logger.info(`Loaded drum piece: ${piece.name}`);
      },
      onerror: (error: Error) => {
        logger.error(`Failed to load drum piece: ${piece.name}`, error);
      },
    });

    // Apply envelope if specified
    if (piece.envelope) {
      sampler.envelope.set(piece.envelope);
    }

    // Connect to effects chain
    if (this.compressor) {
      sampler.connect(this.compressor);
    }

    this.samplers.set(drumId, sampler);
  }

  /**
   * Trigger a drum sound
   */
  trigger(note: Note): void {
    const Tone = getTone();
    const drumNote = note as DrumNote;
    const drumId = drumNote.drum;
    const sampler = this.samplers.get(drumId);

    if (!sampler) {
      logger.warn(`Drum not found: ${drumId}`);
      return;
    }

    const piece = this.kit?.pieces[drumId];
    if (!piece) return;

    // Handle choke groups
    if (piece.group) {
      this.chokeGroup(piece.group, drumId);
    }

    // Determine which sample to play based on velocity
    const velocityLayer = this.getVelocityLayer(drumNote.velocity, piece);
    const time = drumNote.time || Tone.now();

    // Play the sample
    sampler.triggerAttack(velocityLayer.note, time, drumNote.velocity / 127);

    // Track active note
    const noteEvent = {
      id: this.generateNoteId(note),
      ...drumNote,
      startTime: time,
      active: true,
    };

    this.state.activeNotes.set(noteEvent.id, noteEvent);

    // Auto-release after a reasonable time
    const duration = drumNote.duration || 1;
    Tone.Transport.schedule(() => {
      this.release(drumNote);
    }, time + duration);
  }

  /**
   * Release a drum sound
   */
  release(note: Note): void {
    const drumNote = note as DrumNote;
    const drumId = drumNote.drum;
    const sampler = this.samplers.get(drumId);

    if (!sampler) return;

    // Find and release the note
    for (const [noteId, activeNote] of this.state.activeNotes) {
      if (activeNote.drum === drumId) {
        sampler.triggerRelease(
          this.getVelocityLayer(activeNote.velocity, this.kit!.pieces[drumId])
            .note,
        );
        this.state.activeNotes.delete(noteId);
      }
    }
  }

  /**
   * Choke all drums in a group except the specified one
   */
  private chokeGroup(group: string, exceptDrumId: string): void {
    const groupDrums = this.chokeGroups.get(group);
    if (!groupDrums) return;

    for (const drumId of groupDrums) {
      if (drumId !== exceptDrumId) {
        // Release all active notes for this drum
        for (const [noteId, activeNote] of this.state.activeNotes) {
          if ((activeNote as DrumNote).drum === drumId) {
            this.release(activeNote);
          }
        }
      }
    }
  }

  /**
   * Get velocity layer for a drum piece
   */
  private getVelocityLayer(
    velocity: number,
    piece: DrumKitPiece,
  ): { note: string; sampleIndex: number } {
    const Tone = getTone();
    const velocityKeys = Object.keys(piece.samples)
      .map((v) => parseInt(v))
      .sort((a, b) => a - b);

    // Find the appropriate velocity layer
    let selectedVelocity = velocityKeys[0];
    for (const v of velocityKeys) {
      if (velocity >= v) {
        selectedVelocity = v;
      } else {
        break;
      }
    }

    // Handle variations
    const samples = piece.samples[selectedVelocity];
    let sampleIndex = 0;

    if (Array.isArray(samples)) {
      // Round-robin selection
      sampleIndex = Math.floor(Math.random() * samples.length);
    }

    // Map to note
    let noteCounter = 60;
    for (const [v, s] of Object.entries(piece.samples)) {
      if (parseInt(v) === selectedVelocity) {
        if (Array.isArray(s)) {
          noteCounter += sampleIndex;
        }
        break;
      }
      noteCounter += Array.isArray(s) ? s.length : 1;
    }

    return {
      note: Tone.Frequency(noteCounter, 'midi').toNote(),
      sampleIndex,
    };
  }

  /**
   * Trigger by MIDI note
   */
  triggerMidiNote(midiNote: number, velocity = 100): void {
    // Find drum piece mapped to this MIDI note
    for (const [drumId, piece] of Object.entries(this.kit?.pieces || {})) {
      if (piece.midiNote === midiNote) {
        this.trigger({
          pitch: midiNote,
          velocity,
          drum: drumId,
        } as DrumNote);
        return;
      }
    }

    logger.warn(`No drum mapped to MIDI note: ${midiNote}`);
  }

  // ISamplerCore implementation
  async loadSamples(urls: Record<string, string>): Promise<void> {
    const Tone = getTone();

    // Convert to drum kit format
    const customKit: DrumKit = {
      id: 'custom',
      name: 'Custom Kit',
      pieces: {},
    };

    for (const [note, url] of Object.entries(urls)) {
      const drumId = `drum_${note}`;
      customKit.pieces[drumId] = {
        id: drumId,
        name: `Drum ${note}`,
        samples: { '0': url },
        midiNote: Tone.Frequency(note).toMidi(),
      };
    }

    await this.loadKit(customKit);
  }

  unloadSamples(): void {
    for (const sampler of this.samplers.values()) {
      sampler.dispose();
    }
    this.samplers.clear();
    this.chokeGroups.clear();
    this.state.activeNotes.clear();
  }

  getSampleStatus(): Map<string, 'loading' | 'ready' | 'error'> {
    const status = new Map<string, 'loading' | 'ready' | 'error'>();

    for (const [drumId, sampler] of this.samplers) {
      if (sampler.loaded) {
        status.set(drumId, 'ready');
      } else {
        status.set(drumId, 'loading');
      }
    }

    return status;
  }

  /**
   * Set reverb amount
   */
  setReverb(amount: number): void {
    this.reverbMix.fade.value = Math.max(0, Math.min(1, amount));
  }

  /**
   * Set compression
   */
  setCompression(enabled: boolean): void {
    this.compressor.wet.value = enabled ? 1 : 0;
  }

  /**
   * Set volume
   */
  setVolume(volumeDb: number): void {
    this.volume.volume.value = volumeDb;
  }

  /**
   * Get current kit
   */
  getCurrentKit(): DrumKit | null {
    return this.kit;
  }

  /**
   * Get loaded drum IDs
   */
  getLoadedDrums(): string[] {
    return Array.from(this.samplers.keys());
  }
}

/**
 * General MIDI drum mapping
 */
export const GM_DRUM_MAP: Record<number, string> = {
  35: 'kick2', // Acoustic Bass Drum
  36: 'kick', // Bass Drum 1
  37: 'stick', // Side Stick
  38: 'snare', // Acoustic Snare
  39: 'clap', // Hand Clap
  40: 'snare2', // Electric Snare
  41: 'tom-low', // Low Floor Tom
  42: 'hihat-closed', // Closed Hi-Hat
  43: 'tom-low2', // High Floor Tom
  44: 'hihat-pedal', // Pedal Hi-Hat
  45: 'tom-mid', // Low Tom
  46: 'hihat-open', // Open Hi-Hat
  47: 'tom-mid2', // Low-Mid Tom
  48: 'tom-high', // Hi-Mid Tom
  49: 'crash', // Crash Cymbal 1
  50: 'tom-high2', // High Tom
  51: 'ride', // Ride Cymbal 1
  52: 'china', // Chinese Cymbal
  53: 'ride-bell', // Ride Bell
  54: 'tambourine', // Tambourine
  55: 'splash', // Splash Cymbal
  56: 'cowbell', // Cowbell
  57: 'crash2', // Crash Cymbal 2
  58: 'vibraslap', // Vibraslap
  59: 'ride2', // Ride Cymbal 2
  // ... more can be added
};
