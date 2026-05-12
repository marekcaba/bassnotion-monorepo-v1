/**
 * WamHarmonyProcessor - WAM-based harmony instrument processor for track playback
 *
 * This processor bridges the AudioEventRouter chord triggers with the WAM Keyboard plugin,
 * enabling track-based harmony playback through the core audio system.
 *
 * Features:
 * - Chord triggering from PatternScheduler events
 * - Multiple keyboard instruments (Piano, Rhodes, Wurlitzer)
 * - Global sample caching for fast loading
 * - Compatible with track-based architecture
 */

import { GlobalSampleCache } from '../../../storage/cache/GlobalSampleCache.js';
import { getLogger } from '@/utils/logger.js';
import { wamPluginSingleton } from '../../wamPluginSingleton.js';
// import type WamKeyboard from './WamKeyboard.js';

export interface ChordTriggerParams {
  chord: string;
  notes?: string[];
  velocity?: number;
  time?: number;
  duration?: string;
}

export class WamHarmonyProcessor {
  private logger = getLogger('wam-harmony-processor');
  private context: AudioContext | null = null;
  private outputNode: GainNode | null = null;
  private wamPlugin: any | null = null;
  private wamKeyboardNode: any | null = null;
  private isInitialized = false;
  private volume = 0.8;
  private currentInstrument = 'grandpiano'; // Default to grand piano

  async initialize(
    audioContext: AudioContext,
    _audioEngine?: any,
  ): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Get or create plugin instance from singleton first
      this.wamPlugin =
        await wamPluginSingleton.getOrCreateKeyboardPlugin(audioContext);
      this.wamKeyboardNode = this.wamPlugin.audioNode;

      // Use the same context as the plugin to avoid AudioNode context mismatch
      this.context = this.wamPlugin.audioContext;

      // Create output gain node with the same context as the plugin
      if (this.context) {
        this.outputNode = this.context.createGain();
        this.outputNode.gain.value = this.volume;

        // Connect to master bus for proper mixing (with fallback to destination)
        try {
          // Dynamic import to avoid circular dependencies
          const { Mixer } = await import('@/domains/playback/modules/tracks/mixing/Mixer.js');
          const mixer = Mixer.getInstance();
          const masterBusInput = mixer.getMasterBusInputAsAudioNode();
          if (masterBusInput) {
            this.outputNode.connect(masterBusInput);
            this.logger.info('Connected to master bus for mixing');
          } else {
            this.outputNode.connect(this.context.destination);
            this.logger.info('Connected to destination (master bus not ready)');
          }
        } catch (e) {
          // Fallback to direct destination if mixer not available
          this.outputNode.connect(this.context.destination);
          this.logger.info('Connected to destination (mixer not available)');
        }
      }

      // Disconnect from destination and reconnect through our gain
      // Only disconnect if the node is currently connected
      if (this.wamKeyboardNode && this.outputNode) {
        if (this.wamKeyboardNode.isConnected) {
          this.wamKeyboardNode.disconnect();
        }
        this.wamKeyboardNode.connect(this.outputNode);
      } else {
        this.logger.warn(
          'WAM keyboard node or output node not available, skipping connection',
        );
      }

      // Cache the plugin for this processor
      const cacheKey = `wam-harmony-processor-${this.currentInstrument}`;
      GlobalSampleCache.cacheInstrument(cacheKey, this.wamPlugin);

      this.logger.info(
        'WAM harmony processor initialized with singleton plugin instance',
      );

      this.isInitialized = true;
    } catch (error) {
      this.logger.error('Failed to initialize WAM harmony processor:', error);
      throw error;
    }
  }

  /**
   * Set the volume
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.outputNode) {
      this.outputNode.gain.value = this.volume;
    }
  }

  /**
   * Check if instrument has been loaded
   */
  hasInstrumentLoaded(): boolean {
    return this.isInitialized && this.wamPlugin !== null;
  }

  /**
   * Change keyboard instrument
   */
  async setInstrument(
    instrument: 'grandpiano' | 'rhodes' | 'wurlitzer',
  ): Promise<void> {
    if (!this.wamPlugin) {
      throw new Error('WAM harmony processor not initialized');
    }

    this.currentInstrument = instrument;

    // Map instrument name to index
    const instrumentMap = {
      grandpiano: 0,
      rhodes: 1,
      wurlitzer: 2,
    };

    const index = instrumentMap[instrument] || 0;

    try {
      await this.wamKeyboardNode?.setParameterValues({
        instrument: index,
      });

      this.logger.info(`Changed harmony instrument to: ${instrument}`);
    } catch (error) {
      this.logger.error('Failed to change instrument:', error);
    }
  }

  /**
   * Trigger a chord
   */
  triggerChord(params: ChordTriggerParams): void {
    if (!this.isInitialized || !this.wamPlugin) {
      this.logger.warn('Cannot trigger chord: processor not initialized');
      return;
    }

    const { chord, notes, velocity = 0.8, time } = params;

    try {
      // If specific notes are provided, use them
      if (notes && notes.length > 0) {
        // Convert note names to MIDI numbers
        const midiNotes = notes.map((note) => this.noteNameToMidi(note));

        // Schedule each note
        midiNotes.forEach((midiNote, index) => {
          if (!this.context) return;
          const noteTime =
            (time !== undefined ? time : this.context.currentTime) +
            index * 0.01;
          this.wamKeyboardNode?.triggerNote(
            midiNote,
            Math.round(velocity * 127),
            noteTime,
          );
        });
      } else if (chord) {
        // Parse chord and play notes
        const chordNotes = this.parseChord(chord);
        chordNotes.forEach((midiNote, index) => {
          if (!this.context) return;
          const noteTime =
            (time !== undefined ? time : this.context.currentTime) +
            index * 0.01;
          this.wamKeyboardNode?.triggerNote(
            midiNote,
            Math.round(velocity * 127),
            noteTime,
          );
        });
      }

      this.logger.debug(
        `Triggered chord: ${chord} with ${notes?.length || 0} notes`,
      );
    } catch (error) {
      this.logger.error('Error triggering chord:', error);
    }
  }

  /**
   * Stop all playing notes
   */
  stopAll(): void {
    if (this.wamKeyboardNode) {
      this.wamKeyboardNode.clearEvents();
    }
  }

  /**
   * Convert note name to MIDI number
   */
  private noteNameToMidi(noteName: string): number {
    const noteMap: Record<string, number> = {
      C: 0,
      'C#': 1,
      Db: 1,
      D: 2,
      'D#': 3,
      Eb: 3,
      E: 4,
      F: 5,
      'F#': 6,
      Gb: 6,
      G: 7,
      'G#': 8,
      Ab: 8,
      A: 9,
      'A#': 10,
      Bb: 10,
      B: 11,
    };

    // Parse note name and octave
    const match = noteName.match(/^([A-G][#b]?)(\d)?$/);
    if (!match) {
      this.logger.warn(`Invalid note name: ${noteName}`);
      return 60; // Default to middle C
    }

    const [, note, octaveStr] = match;
    const octave = octaveStr ? parseInt(octaveStr) : 4;
    const noteValue = note ? (noteMap[note] ?? 0) : 0;

    return (octave + 1) * 12 + noteValue; // +1 because MIDI octaves start at -1
  }

  /**
   * Convert duration string to seconds
   */
  private _durationToSeconds(duration: string): number {
    // Assume 120 BPM for now (can be made configurable)
    const bpm = 120;
    const quarterNote = 60 / bpm;

    const durationMap: Record<string, number> = {
      '1n': quarterNote * 4, // Whole note
      '2n': quarterNote * 2, // Half note
      '4n': quarterNote, // Quarter note
      '8n': quarterNote / 2, // Eighth note
      '16n': quarterNote / 4, // Sixteenth note
      '32n': quarterNote / 8, // Thirty-second note
    };

    return durationMap[duration] || quarterNote;
  }

  /**
   * Parse chord name to MIDI notes
   */
  private parseChord(chordName: string): number[] {
    // Simple chord parser - can be expanded
    const rootNote = chordName.match(/^[A-G][#b]?/)?.[0] || 'C';
    const rootMidi = this.noteNameToMidi(rootNote + '4');

    // Basic major/minor triads
    if (chordName.includes('m') && !chordName.includes('Maj')) {
      // Minor chord
      return [rootMidi, rootMidi + 3, rootMidi + 7];
    } else if (chordName.includes('7')) {
      // Dominant 7
      return [rootMidi, rootMidi + 4, rootMidi + 7, rootMidi + 10];
    } else if (chordName.includes('Maj7')) {
      // Major 7
      return [rootMidi, rootMidi + 4, rootMidi + 7, rootMidi + 11];
    } else {
      // Major chord
      return [rootMidi, rootMidi + 4, rootMidi + 7];
    }
  }

  /**
   * Activate plugin - enable audio processing
   * Called by PluginManager when transport starts
   */
  async activate(): Promise<void> {
    // WamHarmonyProcessor uses Tone.js Sampler which handles activation internally
  }

  /**
   * Deactivate plugin - stop all active audio sources immediately
   * Called by PluginManager when transport stops
   */
  async deactivate(): Promise<void> {
    // CRITICAL FIX: First clear all scheduled events
    // This prevents new chord notes from starting after stop
    if (this.wamKeyboardNode) {
      this.wamKeyboardNode.clearEvents();
    }

    // Then stop all active chord notes using WamKeyboard's releaseAll()
    if (this.wamKeyboardNode) {
      this.wamKeyboardNode.releaseAll();
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.logger.info('Disposing WamHarmonyProcessor');

    if (this.wamKeyboardNode) {
      this.wamKeyboardNode.clearEvents();
      this.wamKeyboardNode.disconnect();
    }

    if (this.outputNode) {
      this.outputNode.disconnect();
    }

    // Release singleton reference
    if (this.wamPlugin) {
      wamPluginSingleton.releasePlugin('wam-keyboard');
    }

    this.wamPlugin = null;
    this.wamKeyboardNode = null;
    this.outputNode = null;
    this.context = null;
  }
}
