/**
 * WAM Keyboard Plugin
 *
 * A Web Audio Module (WAM) 2.0 compliant keyboard sampler with multiple instruments.
 * Designed for chord progressions and harmonic content in BassNotion.
 *
 * Features:
 * - Multiple instrument support (Salamander Piano, Fender Rhodes, etc.)
 * - Velocity-sensitive key triggering
 * - Chord progression playback
 * - MIDI input support
 * - Per-instrument volume and effects
 * - Sample-accurate timing through AudioWorklet
 *
 * Part of Story 3.21 - Track-Based Architecture Migration
 */

import type {
  WebAudioModule,
  WamNode,
  WamDescriptor,
  WamParameterInfoMap,
  WamParameterDataMap,
  WamEvent,
  WamMidiEvent,
} from '../../../../types/wam.js';
// SalamanderVelocitySampler removed - using alternative samplers
// import { SalamanderVelocitySampler } from '../../implementations/harmony/SalamanderVelocitySampler.js';
import { RhodesVelocitySampler } from '../../implementations/harmony/RhodesVelocitySampler.js';
import { WurlitzerVelocitySampler } from '../../implementations/harmony/WurlitzerVelocitySampler.js';
import { GlobalSampleCache } from '../../../storage/cache/GlobalSampleCache.js';
import { createStructuredLogger } from '../../../shared/index.js';

// Create structured logger for this module
const logger = createStructuredLogger('WamKeyboard');

// Base WebAudioModule class - since we don't have the actual SDK, we'll create a minimal implementation
abstract class WebAudioModuleBase implements WebAudioModule {
  abstract audioContext: BaseAudioContext;
  abstract audioNode: WamNode;
  abstract initialized: boolean;
  abstract moduleId: string;
  abstract instanceId: string;
  abstract descriptor: WamDescriptor;

  abstract createAudioNode(options?: any): Promise<WamNode>;
  abstract getState(): Promise<any>;
  abstract setState(state: any): Promise<void>;

  async initialize(state?: any): Promise<WebAudioModule> {
    if (!this.initialized) {
      this.audioNode = await this.createAudioNode(state);
      (this as any).initialized = true;
    }
    return this;
  }

  createGui(): Promise<Element> {
    const container = document.createElement('div');
    return Promise.resolve(container);
  }

  destroyGui(gui: Element): void {
    gui.remove();
  }
}

/**
 * Available keyboard instruments
 */
export enum KeyboardInstrument {
  SALAMANDER_PIANO = 'salamander',
  FENDER_RHODES = 'rhodes',
  WURLITZER = 'wurlitzer',
}

/**
 * MIDI note event for scheduling
 */
export interface MidiNoteEvent {
  note: number; // MIDI note number (0-127)
  velocity: number; // Velocity (0-127)
  time: number; // When to play (in audio context time)
  duration?: number; // Note duration in seconds
  channel?: number; // MIDI channel (0-15)
}

/**
 * WAM Keyboard Node - handles MIDI processing and audio playback
 */
export class WamKeyboardNode implements WamNode {
  private gainNode: GainNode | null = null;
  private currentInstrument: KeyboardInstrument =
    KeyboardInstrument.SALAMANDER_PIANO;
  private samplers: Map<KeyboardInstrument, any> = new Map();
  private activeSampler: any = null;
  private _eventQueue: WamEvent[] = [];
  private sustainedNotes: Set<number> = new Set();
  private sustainPedal = false;
  private activeNotes: Map<number, number> = new Map(); // note -> voice ID for polyphony
  private _isConnected = false; // Track connection state

  // Required AudioNode properties
  channelCountMode: ChannelCountMode = 'max';
  channelInterpretation: ChannelInterpretation = 'speakers';

  // EventTarget methods (required by AudioNode)
  addEventListener() {
    /* stub */
  }
  dispatchEvent(): boolean {
    return false;
  }
  removeEventListener() {
    /* stub */
  }

  get gain(): AudioParam | undefined {
    return this.gainNode?.gain;
  }

  get context(): BaseAudioContext {
    return this.module.audioContext;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  get numberOfOutputs(): number {
    return this.gainNode?.numberOfOutputs || 0;
  }

  get numberOfInputs(): number {
    return this.gainNode?.numberOfInputs || 0;
  }

  get channelCount(): number {
    return this.gainNode?.channelCount || 2;
  }

  /**
   * Check if an instrument is loaded
   */
  hasInstrumentLoaded(): boolean {
    return this.activeSampler !== null && this.samplers.size > 0;
  }

  constructor(
    public module: WebAudioModule,
    _options?: AudioNodeOptions,
  ) {
    // Don't initialize here to avoid SSR issues
    // Unused parameters prefixed with underscore to avoid eslint errors
  }

  /**
   * Connect to destination
   */
  connect(destination: AudioNode | AudioParam): AudioNode {
    if (!this.gainNode) {
      throw new Error('WAM Keyboard not initialized');
    }
    logger.info('🎹 WamKeyboardNode.connect called:', {
      destination,
      gainValue: this.gainNode.gain.value,
      hasActiveSampler: !!this.activeSampler,
      samplerConnected: this.activeSampler ? 'checking...' : 'no sampler',
    });
    const result = this.gainNode.connect(destination as any);
    this._isConnected = true;
    return result;
  }

  /**
   * Disconnect from destination
   */
  disconnect(destination?: AudioNode | AudioParam | number): void {
    if (this.gainNode) {
      if (destination) {
        this.gainNode.disconnect(destination as any);
      } else {
        this.gainNode.disconnect();
      }
      this._isConnected = false;
    }
  }

  async initialize(): Promise<void> {
    // Create gain node only in browser
    if (typeof window !== 'undefined' && this.context) {
      // Get Tone from global audio services for consistency
      const globalServices =
        (window as any).__globalCoreServices || (window as any).__coreServices;
      let Tone = null;

      if (globalServices && globalServices.getAudioEngine) {
        const audioEngine = globalServices.getAudioEngine();
        Tone = audioEngine.getTone
          ? audioEngine.getTone()
          : (window as any).Tone;
      } else {
        Tone = (window as any).Tone;
      }

      // CRITICAL: Set Tone.js to use WAM AudioContext before any Tone operations
      if (Tone && this.context) {
        // DON'T switch Tone.js context - use the shared context
        // This was causing multiple context switches and buffer errors
        // Only log if there's a real issue
        const toneContext =
          Tone.context?._context ||
          Tone.context?._nativeAudioContext ||
          Tone.context?.rawContext;
        const persistentContext = (window as any).__persistentAudioContext;

        if (toneContext && this.context && toneContext !== this.context) {
          // Check if using persistent context
          if (
            persistentContext &&
            (toneContext === persistentContext ||
              this.context === persistentContext)
          ) {
            // Using persistent context, this is normal
          } else {
            logger.info(
              '🎹 WamKeyboardNode: Different contexts detected, but continuing with shared context',
            );
          }
        }
      }

      this.gainNode = this.context.createGain();
      this.gainNode.gain.value = 0.8;

      // Don't connect to destination here - let the widget handle the connection
      // This allows proper gain control through the track system

      // Initialize default instrument after gain node is ready
      await this.loadInstrument(KeyboardInstrument.SALAMANDER_PIANO);
    }
  }

  /**
   * Load a keyboard instrument
   */
  async loadInstrument(instrument: KeyboardInstrument): Promise<void> {
    if (this.samplers.has(instrument)) {
      this.switchToInstrument(instrument);
      return;
    }

    // Check global cache first
    const cacheKey = `wam-keyboard-${instrument}`;
    const cachedSampler = GlobalSampleCache.getCachedInstrument(cacheKey);
    if (cachedSampler) {
      logger.info(
        `♻️ Using cached ${instrument} sampler from GlobalSampleCache`,
      );
      this.samplers.set(instrument, cachedSampler);
      this.switchToInstrument(instrument);
      return;
    }

    // CRITICAL FIX: Check if InitialSamplePreloader created a harmony instrument
    // The preloaded instrument is a full WamKeyboard instance, not just a sampler
    if (instrument === KeyboardInstrument.SALAMANDER_PIANO) {
      const preloadedHarmony =
        GlobalSampleCache.getCachedInstrument('harmony-preloaded');
      if (preloadedHarmony && preloadedHarmony.audioNode) {
        logger.info('🎹 REUSING PRE-LOADED HARMONY INSTRUMENT FROM PHASE 2!');

        // The preloaded harmony is a complete WamKeyboard instance
        // We need to extract its internal sampler to prevent duplicate loading
        const preloadedNode = preloadedHarmony.audioNode as WamKeyboardNode;

        // Check if it has samplers already loaded
        if (
          preloadedNode.samplers &&
          preloadedNode.samplers.has(KeyboardInstrument.SALAMANDER_PIANO)
        ) {
          const existingSampler = preloadedNode.samplers.get(
            KeyboardInstrument.SALAMANDER_PIANO,
          );
          logger.info(
            '🎹 Found existing Piano sampler in pre-loaded instrument!',
          );

          // CRITICAL: Check if the sampler's context matches our current context
          // If not, we can't reuse it due to AudioBuffer restrictions
          const existingSamplerContext =
            existingSampler.destination?.context ||
            existingSampler.samplers?.values()?.next()?.value?.context;
          const persistentContext = (window as any).__persistentAudioContext;

          if (existingSamplerContext && this.context) {
            // Get the actual native context from Tone wrapper if needed
            const existingNativeContext =
              (existingSamplerContext as any)._context ||
              (existingSamplerContext as any)._nativeAudioContext ||
              (existingSamplerContext as any).rawContext ||
              existingSamplerContext;
            const currentNativeContext =
              (this.context as any)._context ||
              (this.context as any)._nativeAudioContext ||
              (this.context as any).rawContext ||
              this.context;

            if (existingNativeContext !== currentNativeContext) {
              // Check if both are using the persistent context
              if (
                persistentContext &&
                (existingNativeContext === persistentContext ||
                  currentNativeContext === persistentContext)
              ) {
                logger.info(
                  '🎹 Pre-loaded sampler using persistent context, can reuse!',
                );
                // Continue with reuse
              } else {
                logger.warn(
                  '🎹 Pre-loaded sampler uses different AudioContext, cannot reuse buffers',
                );
                logger.info('🎹 Will create new sampler with current context');
                // Fall through to create new sampler
                return; // Exit early to create new sampler
              }
            }
          }

          // Context is compatible, proceed with reuse
          // CRITICAL: Ensure the sampler is ready before reusing it
          if (
            existingSampler &&
            typeof existingSampler.ensureReady === 'function'
          ) {
            logger.info('🎹 Ensuring pre-loaded sampler is ready...');
            try {
              await existingSampler.ensureReady();
              logger.info('🎹 Pre-loaded sampler verified and ready!');
            } catch (err) {
              logger.warn(
                '🎹 Pre-loaded sampler not ready, will create new one:',
                { error: err as Error },
              );
              // Fall through to create new sampler
              return; // Exit early to create new sampler
            }
          }

          // Verify the sampler has loaded samplers with buffers
          const status = existingSampler.getStatus
            ? existingSampler.getStatus()
            : null;
          if (status && status.loadedLayers && status.loadedLayers.length > 0) {
            logger.info(
              '🎹 Pre-loaded sampler has layers:',
              status.loadedLayers.join(', '),
            );

            // Ensure it's connected to our gain node
            if (this.gainNode && existingSampler.connect) {
              try {
                existingSampler.disconnect();
                existingSampler.connect(this.gainNode);
                logger.info(
                  '🎹 Connected pre-loaded sampler to current gain node',
                );
              } catch (err) {
                logger.warn('🎹 Failed to connect pre-loaded sampler:', {
                  error: err as Error,
                });
              }
            }

            this.samplers.set(instrument, existingSampler);
            this.switchToInstrument(instrument);

            // Also cache it with our key for future use
            GlobalSampleCache.cacheInstrument(cacheKey, existingSampler);
            logger.info(
              '🎹 NO NEW SAMPLES WILL BE LOADED - using Phase 2 samples!',
            );
            return;
          } else {
            logger.warn(
              '🎹 Pre-loaded sampler has no loaded layers, will create new one',
            );
            // Fall through to create new sampler
          }
        }
      }
    }

    let sampler: any;

    try {
      // Ensure Tone.js uses the same AudioContext as the WAM system BEFORE creating samplers
      // DON'T switch Tone.js context when loading instrument
      // Use the shared context to avoid buffer errors

      switch (instrument) {
        case KeyboardInstrument.SALAMANDER_PIANO:
          logger.info(
            '🎹 WARNING: SalamanderVelocitySampler removed - using RhodesVelocitySampler as fallback',
          );
          // Use Rhodes as fallback for piano sound
          sampler = new RhodesVelocitySampler();
          // CRITICAL: Set the preferred context BEFORE initializing
          if (this.context) {
            sampler.setPreferredContext(this.context);
          }
          await sampler.initialize();
          // Connect to gain node AFTER initializing
          if (this.gainNode) {
            sampler.connect(this.gainNode);
            logger.info(
              '🎹 Connected Rhodes sampler (as piano fallback) to gain node after initialization',
            );
          }
          break;

        case KeyboardInstrument.FENDER_RHODES:
          sampler = new RhodesVelocitySampler();
          // Connect to gain node BEFORE initializing to ensure context sync
          if (this.gainNode) {
            sampler.connect(this.gainNode);
          }
          await sampler.initialize();
          break;

        case KeyboardInstrument.WURLITZER:
          sampler = new WurlitzerVelocitySampler();
          // Connect to gain node BEFORE initializing to ensure context sync
          if (this.gainNode) {
            sampler.connect(this.gainNode);
          }
          await sampler.initialize();
          break;

        default:
          throw new Error(`Unknown instrument: ${instrument}`);
      }

      // Connection already done before initialize to ensure context sync
      // No need to connect again here

      // DEBUG: Verify sampler is connected
      logger.info('🎹 WamKeyboard - After loading sampler:', {
        instrument,
        samplerType: sampler.constructor?.name,
        hasDestination: !!sampler.destination,
        destination: sampler.destination,
        gainNodeValue: this.gainNode?.gain?.value,
        isConnectedToGain: sampler.destination === this.gainNode,
      });

      // Cache the sampler globally for reuse
      GlobalSampleCache.cacheInstrument(cacheKey, sampler);

      this.samplers.set(instrument, sampler);
      this.switchToInstrument(instrument);

      logger.info(`✅ Loaded ${instrument} instrument`);
    } catch (error) {
      logger.error(`Failed to load ${instrument}:`, error as Error);
      throw error;
    }
  }

  /**
   * Switch active instrument
   */
  private switchToInstrument(instrument: KeyboardInstrument): void {
    logger.info(`🎹 switchToInstrument called for ${instrument}`, {
      hasCurrentSampler: !!this.activeSampler,
      hasGainNode: !!this.gainNode,
      gainNodeValue: this.gainNode?.gain?.value,
      availableSamplers: Array.from(this.samplers.keys()),
    });

    // Disconnect previous sampler
    if (this.activeSampler) {
      if (this.activeSampler.output) {
        this.activeSampler.output.disconnect();
      } else if (this.activeSampler.disconnect) {
        this.activeSampler.disconnect();
      }
    }

    // Connect new sampler
    this.currentInstrument = instrument;
    this.activeSampler = this.samplers.get(instrument);

    if (this.activeSampler && this.gainNode) {
      logger.info(`🎹 Connecting ${instrument} sampler:`, {
        samplerType: this.activeSampler.constructor?.name,
        hasConnect: typeof this.activeSampler.connect === 'function',
        hasOutput: !!this.activeSampler.output,
        samplerStatus: this.activeSampler.getStatus
          ? this.activeSampler.getStatus()
          : 'no status method',
      });

      // Velocity samplers don't have output property, connect directly
      if (this.activeSampler.connect) {
        this.activeSampler.connect(this.gainNode);
        logger.info(`✅ Connected ${instrument} sampler to gain node`);
      } else if (this.activeSampler.output) {
        this.activeSampler.output.connect(this.gainNode);
        logger.info(`✅ Connected ${instrument} sampler output to gain node`);
      }
    } else {
      logger.warn(`🎹 Cannot connect sampler:`, {
        hasActiveSampler: !!this.activeSampler,
        hasGainNode: !!this.gainNode,
      });
    }
  }

  /**
   * Trigger a note
   */
  triggerNote(note: number, velocity = 80, time?: number): void {
    logger.info('🎹 triggerNote called:', {
      note,
      velocity,
      time,
      hasActiveSampler: !!this.activeSampler,
      activeSamplerType: this.activeSampler?.constructor?.name,
      gainNodeValue: this.gainNode?.gain?.value,
      isConnected: this._isConnected,
      contextState: this.context?.state,
      gainNodeConnected: (this.gainNode?.numberOfOutputs ?? 0) > 0,
    });

    if (!this.gainNode) {
      logger.error('🎹 ERROR: No gain node! Cannot produce audio.');
      return;
    }

    if (!this._isConnected) {
      logger.error('🎹 ERROR: Gain node not connected to destination!');
      return;
    }

    if (!this.activeSampler) {
      logger.warn('🎹 No active sampler available!');
      return;
    }

    try {
      // Convert MIDI note to note name (e.g., 60 -> "C4")
      const noteName = this.midiToNoteName(note);
      const triggerTime = time !== undefined ? time : this.context.currentTime;

      // Store active note
      this.activeNotes.set(note, Date.now());

      // Trigger the note on the sampler
      if (this.activeSampler.triggerAttackRelease) {
        // For velocity samplers which use triggerAttackRelease
        // Use Tone.js now() for immediate playback when no time is specified
        const toneTime =
          time !== undefined
            ? `+${time - this.context.currentTime}`
            : undefined;
        logger.info(
          `🎹 Triggering note ${noteName} with velocity ${velocity} at time ${toneTime || 'now'}`,
          {
            samplerStatus: this.activeSampler.getStatus
              ? this.activeSampler.getStatus()
              : 'no status method',
            destination: this.activeSampler.destination,
            samplerConnected: this.activeSampler.destination === this.gainNode,
          },
        );

        // CRITICAL: Ensure the gain node is not muted
        if (this.gainNode.gain.value === 0) {
          logger.warn(
            '🎹 WARNING: Gain node is muted (value = 0)! Setting to 0.8',
          );
          this.gainNode.gain.value = 0.8;
        }

        this.activeSampler.triggerAttackRelease(
          noteName,
          2,
          toneTime,
          velocity,
        );
      } else if (this.activeSampler.triggerAttack) {
        // For other samplers that support separate attack/release
        this.activeSampler.triggerAttack(noteName, triggerTime, velocity);
      } else {
        logger.warn(
          'Sampler does not support triggerAttack or triggerAttackRelease',
        );
      }
    } catch (error) {
      logger.error('Failed to trigger note:', error as Error);
    }
  }

  /**
   * Release a note
   */
  releaseNote(note: number): void {
    if (!this.activeSampler) return;

    if (this.sustainPedal) {
      this.sustainedNotes.add(note);
    } else {
      try {
        const noteName = this.midiToNoteName(note);

        if (this.activeSampler.triggerRelease) {
          this.activeSampler.triggerRelease(noteName, this.context.currentTime);
        }
      } catch (error) {
        logger.error('Failed to release note:', error as Error);
      }
    }
  }

  /**
   * Convert MIDI note number to note name
   */
  private midiToNoteName(midi: number): string {
    const noteNames = [
      'C',
      'C#',
      'D',
      'D#',
      'E',
      'F',
      'F#',
      'G',
      'G#',
      'A',
      'A#',
      'B',
    ];
    const octave = Math.floor(midi / 12) - 1;
    const noteIndex = midi % 12;
    const noteName = noteNames[noteIndex];
    if (!noteName) {
      throw new Error(`Invalid MIDI note: ${midi}`);
    }
    return noteName + octave;
  }

  /**
   * Schedule a MIDI note
   */
  scheduleMidiNote(event: MidiNoteEvent): void {
    const { note, velocity, time, duration } = event;

    // Schedule note on
    this.scheduleEvent({
      type: 'wam-midi',
      time,
      data: {
        bytes: new Uint8Array([0x90, note, velocity]), // Note On
      },
    });

    // Schedule note off if duration provided
    if (duration && duration > 0) {
      this.scheduleEvent({
        type: 'wam-midi',
        time: time + duration,
        data: {
          bytes: new Uint8Array([0x80, note, 0]), // Note Off
        },
      });
    }
  }

  /**
   * Process incoming MIDI data (real-time)
   */
  processMidi(bytes: Uint8Array, timestamp?: number): void {
    const event: WamMidiEvent = {
      type: 'wam-midi',
      time: timestamp || this.context.currentTime,
      data: { bytes },
    };
    this.scheduleEvent(event);
  }

  /**
   * Get current polyphony count
   */
  getPolyphonyCount(): number {
    return this.activeNotes.size;
  }

  // WAM Node interface methods

  async getParameterInfo(): Promise<WamParameterInfoMap> {
    return {
      volume: {
        label: 'Volume',
        type: 'float',
        defaultValue: 0.8,
        minValue: 0,
        maxValue: 1,
      },
      instrument: {
        label: 'Instrument',
        type: 'int',
        defaultValue: 0,
        minValue: 0,
        maxValue: 2,
        choices: ['Salamander Piano', 'Fender Rhodes', 'Wurlitzer'],
      },
      sustain: {
        label: 'Sustain Pedal',
        type: 'boolean',
        defaultValue: 0,
        minValue: 0,
        maxValue: 1,
      },
    };
  }

  async getParameterValues(): Promise<WamParameterDataMap> {
    return {
      volume: this.gainNode?.gain.value || 0.8,
      instrument: Object.values(KeyboardInstrument).indexOf(
        this.currentInstrument,
      ),
      sustain: this.sustainPedal ? 1 : 0,
    };
  }

  async setParameterValues(values: WamParameterDataMap): Promise<void> {
    if ('volume' in values && this.gainNode) {
      this.gainNode.gain.value = values.volume;
    }

    if ('instrument' in values) {
      const instruments = Object.values(KeyboardInstrument);
      const instrument = instruments[values.instrument];
      if (instrument) {
        await this.loadInstrument(instrument);
      }
    }

    if ('sustain' in values) {
      const wasOn = this.sustainPedal;
      this.sustainPedal = values.sustain > 0.5;

      // Release sustained notes if pedal released
      if (wasOn && !this.sustainPedal) {
        this.sustainedNotes.forEach((note) => {
          this.releaseNote(note);
        });
        this.sustainedNotes.clear();
      }
    }
  }

  scheduleEvent(event: WamEvent): void {
    if (event.type === 'wam-midi') {
      const midiEvent = event as WamMidiEvent;
      const { bytes } = midiEvent.data;
      if (bytes && bytes.length >= 3) {
        const [status, note, velocity] = Array.from(bytes);

        // Handle MIDI events
        const command = (status ?? 0) & 0xf0;
        const channel = (status ?? 0) & 0x0f;

        // Safe checks for note and velocity
        if (typeof note === 'number' && typeof velocity === 'number') {
          // If event has a specific time, schedule it
          if (event.time && event.time > this.context.currentTime) {
            // Schedule for future
            setTimeout(
              () => {
                this.handleMidiCommand(command, note, velocity, channel);
              },
              (event.time - this.context.currentTime) * 1000,
            );
          } else {
            // Process immediately
            this.handleMidiCommand(command, note, velocity, channel);
          }
        }
      }
    }
  }

  private handleMidiCommand(
    command: number,
    note: number,
    velocity: number,
    _channel: number,
  ): void {
    switch (command) {
      case 0x90: // Note On
        if (velocity > 0) {
          this.activeNotes.set(note, Date.now());
          this.triggerNote(note, velocity);
        } else {
          this.activeNotes.delete(note);
          this.releaseNote(note);
        }
        break;

      case 0x80: // Note Off
        this.activeNotes.delete(note);
        this.releaseNote(note);
        break;

      case 0xb0: // Control Change
        if (note === 64) {
          // Sustain pedal
          this.setParameterValues({ sustain: velocity > 63 ? 1 : 0 });
        }
        break;

      case 0xe0: // Pitch bend
        // TODO: Implement pitch bend
        break;
    }
  }

  clearEvents(): void {
    this._eventQueue = [];
    // Stop all playing notes
    if (this.activeSampler) {
      // SalamanderVelocitySampler doesn't have releaseAll, but we can release all active notes
      this.activeNotes.forEach((_, note) => {
        this.releaseNote(note);
      });
      // Also release any sustained notes
      this.sustainedNotes.forEach((note) => {
        this.releaseNote(note);
      });
    }
    this.sustainedNotes.clear();
    this.activeNotes.clear();
  }

  /**
   * Convert chord symbol to MIDI notes
   */
  chordToMidiNotes(chord: string, octave = 4): number[] {
    // Basic chord mapping - can be extended
    const rootNotes: Record<string, number> = {
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

    // Extract root note
    const match = chord.match(/^([A-G][#b]?)/);
    if (!match) return [];

    const root = match[1];
    if (!root) return [];
    const rootMidi = (rootNotes[root] || 0) + octave * 12 + 12; // +12 for MIDI offset

    // Chord intervals (semitones from root)
    const intervals: Record<string, number[]> = {
      '': [0, 4, 7], // Major triad
      maj: [0, 4, 7], // Major triad
      m: [0, 3, 7], // Minor triad
      min: [0, 3, 7], // Minor triad
      '7': [0, 4, 7, 10], // Dominant 7th
      maj7: [0, 4, 7, 11], // Major 7th
      Maj7: [0, 4, 7, 11], // Major 7th
      m7: [0, 3, 7, 10], // Minor 7th
      dim: [0, 3, 6], // Diminished
      aug: [0, 4, 8], // Augmented
      sus2: [0, 2, 7], // Suspended 2nd
      sus4: [0, 5, 7], // Suspended 4th
      '6': [0, 4, 7, 9], // Major 6th
      m6: [0, 3, 7, 9], // Minor 6th
      '9': [0, 4, 7, 10, 14], // Dominant 9th
      add9: [0, 4, 7, 14], // Add 9th
    };

    // Get chord type
    const chordType = chord.substring(root.length);
    const chordIntervals = intervals[chordType] || intervals[''];
    if (!chordIntervals) return [];

    // Convert intervals to MIDI notes
    return chordIntervals.map((interval) => rootMidi + interval);
  }

  // Required WamNode methods
  async getState(): Promise<any> {
    return {
      currentInstrument: this.currentInstrument,
      parameterValues: await this.getParameterValues(),
    };
  }

  async setState(state: any): Promise<void> {
    if (state.currentInstrument) {
      await this.loadInstrument(state.currentInstrument);
    }
    if (state.parameterValues) {
      await this.setParameterValues(state.parameterValues);
    }
  }

  async getCompensationDelay(): Promise<number> {
    return 0; // No compensation delay for this instrument
  }

  scheduleEvents(...events: WamEvent[]): void {
    events.forEach((event) => this.scheduleEvent(event));
  }

  getCurrentInstrument(): KeyboardInstrument {
    return this.currentInstrument;
  }

  async destroy(): Promise<void> {
    this.clearEvents();
    this.samplers.forEach((sampler) => {
      if (sampler.dispose) {
        sampler.dispose();
      }
    });
    this.samplers.clear();
    this.disconnect();
  }
}

/**
 * WAM Keyboard Module - the main plugin class
 */
export class WamKeyboard extends WebAudioModuleBase {
  readonly audioContext: BaseAudioContext;
  audioNode!: WamKeyboardNode;
  initialized = false;
  readonly moduleId = 'com.bassnotion.keyboard';
  readonly instanceId: string;

  descriptor: WamDescriptor = {
    name: 'BassNotion Keyboard',
    vendor: 'BassNotion',
    version: '1.0.0',
    sdkVersion: '2.0.0',
    thumbnail: '',
    keywords: ['instrument', 'keyboard', 'piano', 'rhodes'],
    isInstrument: true,
    website: 'https://bassnotion.com',
    hasAudioInput: false,
    hasAudioOutput: true,
    hasMidiInput: true,
    hasMidiOutput: false,
    supportsMpe: false,
  };

  static descriptor: WamDescriptor = {
    name: 'BassNotion Keyboard',
    vendor: 'BassNotion',
    version: '1.0.0',
    sdkVersion: '2.0.0',
    thumbnail: '',
    keywords: ['instrument', 'keyboard', 'piano', 'rhodes'],
    isInstrument: true,
    website: 'https://bassnotion.com',
    hasAudioInput: false,
    hasAudioOutput: true,
    hasMidiInput: true,
    hasMidiOutput: false,
    supportsMpe: false,
  };

  constructor(audioContext: BaseAudioContext) {
    super();
    this.audioContext = audioContext;
    this.instanceId = `${this.moduleId}-${Date.now()}`;
  }

  /**
   * Create the audio node - follows WAM 2.0 standard
   */
  async createAudioNode(initialState?: any): Promise<WamNode> {
    this.audioNode = new WamKeyboardNode(this, initialState);
    await this.audioNode.initialize();
    return this.audioNode;
  }

  /**
   * Send MIDI message to the plugin
   */
  sendMidi(bytes: Uint8Array, timestamp?: number): void {
    this.audioNode?.processMidi(bytes, timestamp);
  }

  /**
   * Schedule a MIDI note
   */
  scheduleNote(
    note: number,
    velocity: number,
    time: number,
    duration?: number,
  ): void {
    this.audioNode?.scheduleMidiNote({ note, velocity, time, duration });
  }

  /**
   * Get current instrument
   */
  getCurrentInstrument(): KeyboardInstrument {
    return (
      this.audioNode?.getCurrentInstrument() ||
      KeyboardInstrument.SALAMANDER_PIANO
    );
  }

  async getState(): Promise<any> {
    return {
      instrument: this.getCurrentInstrument(),
      volume: this.audioNode?.gain?.value || 0.8,
    };
  }

  async setState(state: any): Promise<void> {
    if (state.instrument) {
      await this.audioNode?.loadInstrument(state.instrument);
    }
    if (state.volume && this.audioNode?.gain) {
      this.audioNode.gain.value = state.volume;
    }
  }

  /**
   * Get polyphony info
   */
  getPolyphonyInfo(): { active: number; max: number } {
    return {
      active: this.audioNode?.getPolyphonyCount() || 0,
      max: 128, // Standard MIDI polyphony
    };
  }

  /**
   * Play a chord (for pattern compatibility)
   */
  playChord(chord: string, velocity = 80, duration = 0.5, octave = 4): void {
    if (!this.audioNode) return;

    const notes = this.audioNode.chordToMidiNotes(chord, octave);
    const time = this.audioContext.currentTime;

    notes.forEach((note) => {
      this.scheduleNote(note, velocity, time, duration);
    });
  }

  /**
   * Handle pattern event (for track integration)
   */
  handlePatternEvent(event: any, time: number): void {
    if (event.chord) {
      // Chord pattern event
      const notes = this.audioNode?.chordToMidiNotes(event.chord) || [];
      const velocity = Math.round((event.velocity || 0.8) * 127);

      notes.forEach((note) => {
        this.scheduleNote(note, velocity, time, event.duration);
      });
    } else if (event.note) {
      // Single note event
      const velocity = Math.round((event.velocity || 0.8) * 127);
      this.scheduleNote(event.note, velocity, time, event.duration);
    }
  }

  // WebAudioModule interface methods

  async createGui(): Promise<HTMLElement> {
    const container = document.createElement('div');
    container.innerHTML = `
      <div class="wam-keyboard-gui">
        <h3>WAM Keyboard</h3>
        <select id="instrument">
          <option value="0">Salamander Piano</option>
          <option value="1">Fender Rhodes</option>
          <option value="2">Wurlitzer</option>
        </select>
        <input type="range" id="volume" min="0" max="1" step="0.01" value="0.8">
      </div>
    `;

    // Wire up controls
    const instrumentSelect = container.querySelector(
      '#instrument',
    ) as HTMLSelectElement;
    instrumentSelect.addEventListener('change', async () => {
      await this.audioNode.setParameterValues({
        instrument: parseInt(instrumentSelect.value),
      });
    });

    const volumeSlider = container.querySelector('#volume') as HTMLInputElement;
    volumeSlider.addEventListener('input', async () => {
      await this.audioNode.setParameterValues({
        volume: parseFloat(volumeSlider.value),
      });
    });

    return container;
  }

  destroyGui(gui: Element): void {
    gui.remove();
  }

  /**
   * Static factory method - WAM 2.0 standard
   */
  static async createInstance(
    audioContext: BaseAudioContext,
    initialState?: any,
  ): Promise<WamKeyboard> {
    const instance = new WamKeyboard(audioContext);
    await instance.initialize(initialState);
    return instance;
  }
}

// Export default the class for WAM host compatibility
export default WamKeyboard;
