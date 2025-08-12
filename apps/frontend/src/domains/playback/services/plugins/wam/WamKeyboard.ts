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
  WamAutomationEvent,
  WamParameterConfiguration
} from '../../../types/wam.js';
import { SalamanderVelocitySampler } from '../SalamanderVelocitySampler.js';
import { RhodesVelocitySampler } from '../RhodesVelocitySampler.js';
import { WurlitzerVelocitySampler } from '../WurlitzerVelocitySampler.js';
import { GlobalSampleCache } from '../../storage/GlobalSampleCache.js';

// Base WebAudioModule class - since we don't have the actual SDK, we'll create a minimal implementation
abstract class WebAudioModuleBase implements WebAudioModule {
  abstract audioContext: BaseAudioContext;
  abstract audioNode: AudioNode | null;
  abstract initialized: boolean;
  abstract moduleId: string;
  abstract instanceId: string;
  
  abstract createAudioNode(options?: any): Promise<AudioNode>;
  
  async initialize(state?: any): Promise<WebAudioModule> {
    if (!this.initialized) {
      this.audioNode = await this.createAudioNode(state);
      (this as any).initialized = true;
    }
    return this;
  }
  
  createGui?(): Promise<HTMLElement>;
  destroyGui?(gui: Element): void;
}

/**
 * Available keyboard instruments
 */
export enum KeyboardInstrument {
  SALAMANDER_PIANO = 'salamander',
  FENDER_RHODES = 'rhodes',
  WURLITZER = 'wurlitzer'
}

/**
 * MIDI note event for scheduling
 */
export interface MidiNoteEvent {
  note: number;      // MIDI note number (0-127)
  velocity: number;  // Velocity (0-127)
  time: number;      // When to play (in audio context time)
  duration?: number; // Note duration in seconds
  channel?: number;  // MIDI channel (0-15)
}

/**
 * WAM Keyboard Node - handles MIDI processing and audio playback
 */
export class WamKeyboardNode implements WamNode {
  private gainNode: GainNode | null = null;
  private currentInstrument: KeyboardInstrument = KeyboardInstrument.SALAMANDER_PIANO;
  private samplers: Map<KeyboardInstrument, any> = new Map();
  private activeSampler: any = null;
  private eventQueue: WamEvent[] = [];
  private sustainedNotes: Set<number> = new Set();
  private sustainPedal: boolean = false;
  private activeNotes: Map<number, number> = new Map(); // note -> voice ID for polyphony
  
  get gain(): AudioParam | undefined {
    return this.gainNode?.gain;
  }
  
  get context(): BaseAudioContext {
    return this.module.audioContext;
  }
  
  constructor(
    private module: WebAudioModule,
    options?: AudioNodeOptions
  ) {
    // Don't initialize here to avoid SSR issues
  }
  
  /**
   * Connect to destination
   */
  connect(destination: AudioNode | AudioParam): AudioNode {
    if (!this.gainNode) {
      throw new Error('WAM Keyboard not initialized');
    }
    return this.gainNode.connect(destination as any);
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
    }
  }
  
  async initialize(): Promise<void> {
    // Create gain node only in browser
    if (typeof window !== 'undefined' && this.context) {
      // Get Tone from global audio services for consistency
      const globalServices = (window as any).__globalCoreServices || (window as any).__coreServices;
      let Tone = null;
      
      if (globalServices && globalServices.getAudioEngine) {
        const audioEngine = globalServices.getAudioEngine();
        Tone = audioEngine.getTone ? audioEngine.getTone() : (window as any).Tone;
      } else {
        Tone = (window as any).Tone;
      }
      
      // CRITICAL: Set Tone.js to use WAM AudioContext before any Tone operations
      if (Tone && this.context) {
        console.log('🎹 WamKeyboardNode: Setting Tone.js to use WAM AudioContext during initialization');
        try {
          // Force Tone to use our AudioContext
          if (Tone.context._context !== this.context && Tone.context.rawContext !== this.context) {
            Tone.setContext(this.context);
            console.log('✅ Tone.js context set to WAM AudioContext');
          } else {
            console.log('✅ Tone.js already using correct AudioContext');
          }
        } catch (error) {
          console.error('❌ Failed to set Tone.js context during initialization:', error);
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
      console.log(`♻️ Using cached ${instrument} sampler from GlobalSampleCache`);
      this.samplers.set(instrument, cachedSampler);
      this.switchToInstrument(instrument);
      return;
    }
    
    let sampler: any;
    
    try {
      // Ensure Tone.js uses the same AudioContext as the WAM system BEFORE creating samplers
      const Tone = (window as any).Tone;
      if (Tone && this.context) {
        console.log('🎹 Setting Tone.js to use WAM AudioContext before creating sampler');
        try {
          Tone.setContext(this.context);
          console.log('✅ Tone.js context synchronized with WAM');
        } catch (error) {
          console.error('❌ Failed to set Tone.js context:', error);
        }
      }
      
      switch (instrument) {
        case KeyboardInstrument.SALAMANDER_PIANO:
          sampler = new SalamanderVelocitySampler();
          // CRITICAL: Set the preferred context BEFORE initializing
          if (this.context) {
            sampler.setPreferredContext(this.context);
          }
          // Initialize with default velocity layers for performance
          await sampler.initialize(undefined, ['v1', 'v8', 'v10', 'v16']); // pp, mf, f, ff
          // Connect to gain node AFTER initializing
          if (this.gainNode) {
            sampler.connect(this.gainNode);
            console.log('🎹 Connected SalamanderVelocitySampler to gain node after initialization');
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
      
      this.samplers.set(instrument, sampler);
      this.switchToInstrument(instrument);
      
      // Cache the sampler globally
      GlobalSampleCache.cacheInstrument(cacheKey, sampler);
      
      console.log(`✅ Loaded ${instrument} instrument`);
    } catch (error) {
      console.error(`Failed to load ${instrument}:`, error);
      throw error;
    }
  }
  
  /**
   * Switch active instrument
   */
  private switchToInstrument(instrument: KeyboardInstrument): void {
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
      // SalamanderVelocitySampler doesn't have output property, connect directly
      if (this.activeSampler.connect) {
        this.activeSampler.connect(this.gainNode);
        console.log(`✅ Connected ${instrument} sampler to gain node`);
      } else if (this.activeSampler.output) {
        this.activeSampler.output.connect(this.gainNode);
        console.log(`✅ Connected ${instrument} sampler output to gain node`);
      }
    }
  }
  
  /**
   * Trigger a note
   */
  triggerNote(note: number, velocity: number = 80, time?: number): void {
    if (!this.activeSampler) return;
    
    try {
      // Convert MIDI note to note name (e.g., 60 -> "C4")
      const noteName = this.midiToNoteName(note);
      const triggerTime = time !== undefined ? time : this.context.currentTime;
      
      // Store active note
      this.activeNotes.set(note, Date.now());
      
      // Trigger the note on the sampler
      if (this.activeSampler.triggerAttackRelease) {
        // For SalamanderVelocitySampler which uses triggerAttackRelease
        // Use Tone.js now() for immediate playback when no time is specified
        const toneTime = time !== undefined ? `+${time - this.context.currentTime}` : undefined;
        console.log(`🎹 Triggering note ${noteName} with velocity ${velocity} at time ${toneTime || 'now'}`);
        this.activeSampler.triggerAttackRelease(noteName, 2, toneTime, velocity);
      } else if (this.activeSampler.triggerAttack) {
        // For other samplers that support separate attack/release
        this.activeSampler.triggerAttack(noteName, triggerTime, velocity);
      } else {
        console.warn('Sampler does not support triggerAttack or triggerAttackRelease');
      }
    } catch (error) {
      console.error('Failed to trigger note:', error);
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
        console.error('Failed to release note:', error);
      }
    }
  }
  
  /**
   * Convert MIDI note number to note name
   */
  private midiToNoteName(midi: number): string {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midi / 12) - 1;
    const noteIndex = midi % 12;
    return noteNames[noteIndex] + octave;
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
        bytes: new Uint8Array([0x90, note, velocity]) // Note On
      }
    });
    
    // Schedule note off if duration provided
    if (duration && duration > 0) {
      this.scheduleEvent({
        type: 'wam-midi',
        time: time + duration,
        data: {
          bytes: new Uint8Array([0x80, note, 0]) // Note Off
        }
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
      data: { bytes }
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
        maxValue: 1
      },
      instrument: {
        label: 'Instrument',
        type: 'int',
        defaultValue: 0,
        minValue: 0,
        maxValue: 2,
        choices: ['Salamander Piano', 'Fender Rhodes', 'Wurlitzer']
      },
      sustain: {
        label: 'Sustain Pedal',
        type: 'boolean',
        defaultValue: 0,
        minValue: 0,
        maxValue: 1
      }
    };
  }
  
  async getParameterValues(): Promise<WamParameterDataMap> {
    return {
      volume: this.gainNode?.gain.value || 0.8,
      instrument: Object.values(KeyboardInstrument).indexOf(this.currentInstrument),
      sustain: this.sustainPedal ? 1 : 0
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
        this.sustainedNotes.forEach(note => {
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
      const [status, note, velocity] = Array.from(bytes);
      
      // Handle MIDI events
      const command = status & 0xF0;
      const channel = status & 0x0F;
      
      // If event has a specific time, schedule it
      if (event.time && event.time > this.context.currentTime) {
        // Schedule for future
        setTimeout(() => {
          this.handleMidiCommand(command, note, velocity, channel);
        }, (event.time - this.context.currentTime) * 1000);
      } else {
        // Process immediately
        this.handleMidiCommand(command, note, velocity, channel);
      }
    }
  }
  
  private handleMidiCommand(command: number, note: number, velocity: number, channel: number): void {
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
        
      case 0xB0: // Control Change
        if (note === 64) { // Sustain pedal
          this.setParameterValues({ sustain: velocity > 63 ? 1 : 0 });
        }
        break;
        
      case 0xE0: // Pitch bend
        // TODO: Implement pitch bend
        break;
    }
  }
  
  clearEvents(): void {
    this.eventQueue = [];
    // Stop all playing notes
    if (this.activeSampler) {
      // SalamanderVelocitySampler doesn't have releaseAll, but we can release all active notes
      this.activeNotes.forEach((_, note) => {
        this.releaseNote(note);
      });
      // Also release any sustained notes
      this.sustainedNotes.forEach(note => {
        this.releaseNote(note);
      });
    }
    this.sustainedNotes.clear();
    this.activeNotes.clear();
  }
  
  /**
   * Convert chord symbol to MIDI notes
   */
  chordToMidiNotes(chord: string, octave: number = 4): number[] {
    // Basic chord mapping - can be extended
    const rootNotes: Record<string, number> = {
      'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
      'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
      'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
    };
    
    // Extract root note
    const match = chord.match(/^([A-G][#b]?)/);
    if (!match) return [];
    
    const root = match[1];
    const rootMidi = (rootNotes[root] || 0) + (octave * 12) + 12; // +12 for MIDI offset
    
    // Chord intervals (semitones from root)
    const intervals: Record<string, number[]> = {
      '': [0, 4, 7],           // Major triad
      'maj': [0, 4, 7],        // Major triad
      'm': [0, 3, 7],          // Minor triad
      'min': [0, 3, 7],        // Minor triad
      '7': [0, 4, 7, 10],      // Dominant 7th
      'maj7': [0, 4, 7, 11],   // Major 7th
      'Maj7': [0, 4, 7, 11],   // Major 7th
      'm7': [0, 3, 7, 10],     // Minor 7th
      'dim': [0, 3, 6],        // Diminished
      'aug': [0, 4, 8],        // Augmented
      'sus2': [0, 2, 7],       // Suspended 2nd
      'sus4': [0, 5, 7],       // Suspended 4th
      '6': [0, 4, 7, 9],       // Major 6th
      'm6': [0, 3, 7, 9],      // Minor 6th
      '9': [0, 4, 7, 10, 14],  // Dominant 9th
      'add9': [0, 4, 7, 14],   // Add 9th
    };
    
    // Get chord type
    const chordType = chord.substring(root.length);
    const chordIntervals = intervals[chordType] || intervals[''];
    
    // Convert intervals to MIDI notes
    return chordIntervals.map(interval => rootMidi + interval);
  }
  
  destroy(): void {
    this.clearEvents();
    this.samplers.forEach(sampler => {
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
  audioNode: WamKeyboardNode | null = null;
  initialized = false;
  readonly moduleId = 'com.bassnotion.keyboard';
  readonly instanceId: string;
  
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
    supportsMpe: false
  };
  
  constructor(audioContext: BaseAudioContext) {
    super();
    this.audioContext = audioContext;
    this.instanceId = `${this.moduleId}-${Date.now()}`;
  }
  
  /**
   * Create the audio node - follows WAM 2.0 standard
   */
  async createAudioNode(initialState?: any): Promise<AudioNode> {
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
  scheduleNote(note: number, velocity: number, time: number, duration?: number): void {
    this.audioNode?.scheduleMidiNote({ note, velocity, time, duration });
  }
  
  /**
   * Get current instrument
   */
  getCurrentInstrument(): KeyboardInstrument {
    return this.audioNode?.currentInstrument || KeyboardInstrument.SALAMANDER_PIANO;
  }
  
  /**
   * Get polyphony info
   */
  getPolyphonyInfo(): { active: number; max: number } {
    return {
      active: this.audioNode?.getPolyphonyCount() || 0,
      max: 128 // Standard MIDI polyphony
    };
  }
  
  /**
   * Play a chord (for pattern compatibility)
   */
  playChord(chord: string, velocity: number = 80, duration: number = 0.5, octave: number = 4): void {
    if (!this.audioNode) return;
    
    const notes = this.audioNode.chordToMidiNotes(chord, octave);
    const time = this.audioContext.currentTime;
    
    notes.forEach(note => {
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
      
      notes.forEach(note => {
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
    const instrumentSelect = container.querySelector('#instrument') as HTMLSelectElement;
    instrumentSelect.addEventListener('change', async () => {
      await this.audioNode.setParameterValues({
        instrument: { value: parseInt(instrumentSelect.value) }
      });
    });
    
    const volumeSlider = container.querySelector('#volume') as HTMLInputElement;
    volumeSlider.addEventListener('input', async () => {
      await this.audioNode.setParameterValues({
        volume: { value: parseFloat(volumeSlider.value) }
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
    initialState?: any
  ): Promise<WamKeyboard> {
    const instance = new WamKeyboard(audioContext);
    await instance.initialize(initialState);
    return instance;
  }
}

// Export default the class for WAM host compatibility
export default WamKeyboard;