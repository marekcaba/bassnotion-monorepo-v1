/**
 * WAM Bass Plugin
 *
 * A Web Audio Module (WAM) 2.0 compliant bass instrument sampler.
 * Designed for bass guitar education and practice in BassNotion.
 *
 * Features:
 * - Multi-sampled bass guitar (ready for samples)
 * - MIDI-responsive with velocity layers
 * - String and fret position tracking
 * - Articulation support (fingerstyle, slap, pick, mute)
 * - Tab notation compatibility
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
import { createStructuredLogger } from '../../../shared/index.js';

const logger = createStructuredLogger('WamBass');

// Base WebAudioModule class - minimal implementation for compatibility
abstract class WebAudioModuleBase implements Partial<WebAudioModule> {
  abstract audioContext: BaseAudioContext;
  abstract audioNode: WamNode | undefined;
  abstract initialized: boolean;
  abstract moduleId: string;
  abstract instanceId: string;
  abstract descriptor: WamDescriptor;

  abstract createAudioNode(options?: any): Promise<WamNode>;

  async initialize(state?: any): Promise<WebAudioModule> {
    if (!this.initialized) {
      this.audioNode = await this.createAudioNode(state);
      (this as any).initialized = true;
    }
    return this as unknown as WebAudioModule;
  }

  abstract createGui(): Promise<Element>;
  abstract destroyGui(gui: Element): void;
  abstract getState(): any;
  abstract setState(state: any): Promise<void>;
}

/**
 * Bass articulation types
 */
export enum BassArticulation {
  FINGERSTYLE = 'fingerstyle',
  SLAP = 'slap',
  PICK = 'pick',
  MUTE = 'mute',
  HARMONIC = 'harmonic',
}

/**
 * Bass string tuning (standard 4-string)
 */
export const BASS_TUNING = {
  E: 28, // E1 - MIDI note 28
  A: 33, // A1 - MIDI note 33
  D: 38, // D2 - MIDI note 38
  G: 43, // G2 - MIDI note 43
};

/**
 * Bass note event with tab information
 */
export interface BassNoteEvent {
  note: number; // MIDI note number
  velocity: number; // Velocity (0-127)
  time: number; // When to play (audio context time)
  duration?: number; // Note duration in seconds
  string?: number; // String number (1-4)
  fret?: number; // Fret position (0-24)
  articulation?: BassArticulation;
}

/**
 * Sample mapping for future implementation
 */
interface BassSampleMap {
  note: number;
  velocityLayers: {
    min: number;
    max: number;
    url: string;
  }[];
}

/**
 * WAM Bass Node - handles MIDI processing and sample playback
 */
export class WamBassNode implements WamNode {
  private gainNode: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private currentArticulation: BassArticulation = BassArticulation.FINGERSTYLE;
  private sampleMaps: Map<BassArticulation, BassSampleMap[]> = new Map();
  private activeSamples: Map<number, AudioBufferSourceNode> = new Map();
  private activeNotes: Map<number, number> = new Map(); // note -> timestamp
  private isSamplesLoaded = false;

  // Placeholder synth for testing without samples
  private placeholderSynth: any = null;

  get gain(): AudioParam | undefined {
    return this.gainNode?.gain;
  }

  get context(): BaseAudioContext {
    return this.module.audioContext;
  }

  // AudioNode interface properties (delegated to compressor)
  get channelCount(): number {
    return this.compressor?.channelCount || 2;
  }
  set channelCount(value: number) {
    if (this.compressor) this.compressor.channelCount = value;
  }

  get channelCountMode(): ChannelCountMode {
    return this.compressor?.channelCountMode || 'max';
  }
  set channelCountMode(value: ChannelCountMode) {
    if (this.compressor) this.compressor.channelCountMode = value;
  }

  get channelInterpretation(): ChannelInterpretation {
    return this.compressor?.channelInterpretation || 'speakers';
  }
  set channelInterpretation(value: ChannelInterpretation) {
    if (this.compressor) this.compressor.channelInterpretation = value;
  }

  get numberOfInputs(): number {
    return 1;
  }

  get numberOfOutputs(): number {
    return 1;
  }

  addEventListener(): void {
    // No-op - WAM nodes don't typically use DOM events
  }

  removeEventListener(): void {
    // No-op - WAM nodes don't typically use DOM events
  }

  dispatchEvent(): boolean {
    // No-op - WAM nodes don't typically use DOM events
    return false;
  }

  module: WebAudioModule;

  constructor(module: WebAudioModule, _options?: AudioNodeOptions) {
    this.module = module;
    // Don't initialize here to avoid SSR issues
  }

  /**
   * Connect to destination
   */
  connect(destination: AudioNode | AudioParam): AudioNode {
    if (!this.compressor) {
      throw new Error('WAM Bass not initialized');
    }
    return this.compressor.connect(destination as any);
  }

  /**
   * Disconnect from destination
   */
  disconnect(destination?: AudioNode | AudioParam | number): void {
    if (this.compressor) {
      if (destination) {
        this.compressor.disconnect(destination as any);
      } else {
        this.compressor.disconnect();
      }
    }
  }

  async initialize(): Promise<void> {
    // Create audio nodes only in browser
    if (typeof window !== 'undefined' && this.context) {
      // CRITICAL: Set Tone.js to use WAM AudioContext before any Tone operations
      const Tone = (window as any).Tone;
      if (Tone) {
        // DON'T switch Tone.js context - use the shared context
        // This was causing multiple context switches and buffer errors
        logger.info(
          '🎸 WamBassNode: Using shared AudioContext, not switching Tone.js',
        );
      }

      // Create gain node for volume control
      this.gainNode = this.context.createGain();
      this.gainNode.gain.value = 0.8;

      // Create compressor for bass dynamics
      this.compressor = this.context.createDynamicsCompressor();
      this.compressor.threshold.value = -24;
      this.compressor.knee.value = 30;
      this.compressor.ratio.value = 4;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.25;

      // Connect chain: gain -> compressor -> output
      this.gainNode.connect(this.compressor);
    }

    // Initialize placeholder synth for testing
    await this.initializePlaceholderSynth();

    // Load samples when available
    await this.loadSamples();
  }

  /**
   * Initialize a placeholder synth for testing without samples
   */
  private async initializePlaceholderSynth(): Promise<void> {
    const Tone = await this.getToneJS();
    if (!Tone) return;

    try {
      // Create a simple synth that mimics bass guitar
      this.placeholderSynth = new Tone.MonoSynth({
        oscillator: {
          type: 'sawtooth',
        },
        envelope: {
          attack: 0.01,
          decay: 0.3,
          sustain: 0.4,
          release: 0.2,
        },
        filterEnvelope: {
          attack: 0.001,
          decay: 0.1,
          sustain: 0.5,
          release: 0.2,
          baseFrequency: 200,
          octaves: 2.5,
        },
      });

      if (this.gainNode) {
        this.placeholderSynth.connect(this.gainNode);
      }

      logger.info(
        '✅ Placeholder bass synth initialized (waiting for real samples)',
      );
    } catch (error) {
      logger.error('Failed to initialize placeholder synth:', error as Error);
    }
  }

  /**
   * Load bass samples from Supabase (when available)
   */
  async loadSamples(): Promise<void> {
    try {
      // TODO: Implement actual sample loading from Supabase
      // For now, we'll just set up the structure

      // Example of what the sample loading will look like:
      /*
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .storage
        .from('bass-samples')
        .list('fingerstyle');
      
      if (data) {
        // Load each sample and create AudioBuffers
        for (const file of data) {
          const { data: audioData } = await supabase
            .storage
            .from('bass-samples')
            .download(`fingerstyle/${file.name}`);
          
          if (audioData) {
            const arrayBuffer = await audioData.arrayBuffer();
            const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
            // Store in sampleMaps...
          }
        }
      }
      */

      // For now, just log that we're ready for samples
      logger.info(
        '🎸 Bass plugin ready - waiting for samples to be uploaded to Supabase',
      );

      // Set up empty sample maps for each articulation
      Object.values(BassArticulation).forEach((articulation) => {
        this.sampleMaps.set(articulation, []);
      });
    } catch (error) {
      logger.error('Failed to load bass samples:', error as Error);
    }
  }

  /**
   * Get Tone.js instance
   */
  private async getToneJS(): Promise<any> {
    // Check both locations where Tone.js may be stored
    if ((window as any).Tone) {
      return (window as any).Tone;
    }
    if ((window as any).__globalTone) {
      return (window as any).__globalTone;
    }

    const coreServices =
      (window as any).__coreServices || (window as any).__globalCoreServices;
    if (coreServices && typeof coreServices.getAudioEngine === 'function') {
      const audioEngine = coreServices.getAudioEngine();
      if (audioEngine && typeof audioEngine.getTone === 'function') {
        return audioEngine.getTone();
      }
    }

    return null;
  }

  /**
   * Trigger a bass note
   */
  triggerNote(
    note: number,
    velocity = 80,
    articulation?: BassArticulation,
  ): void {
    const art = articulation || this.currentArticulation;

    if (this.isSamplesLoaded && this.sampleMaps.has(art)) {
      // Use real samples when available
      this.triggerSample(note, velocity, art);
    } else {
      // Use placeholder synth for now
      this.triggerPlaceholder(note, velocity, art);
    }

    this.activeNotes.set(note, Date.now());
  }

  /**
   * Trigger placeholder synth (temporary until samples are loaded)
   */
  private triggerPlaceholder(
    note: number,
    velocity: number,
    articulation: BassArticulation,
  ): void {
    if (!this.placeholderSynth) return;

    try {
      const freq = this.midiToFrequency(note);
      const volume = (velocity / 127) * 0.8;

      // Adjust sound based on articulation
      switch (articulation) {
        case BassArticulation.SLAP:
          // Brighter, more percussive
          this.placeholderSynth.filterEnvelope.baseFrequency = 400;
          this.placeholderSynth.envelope.attack = 0.001;
          break;
        case BassArticulation.PICK:
          // Slightly brighter than fingerstyle
          this.placeholderSynth.filterEnvelope.baseFrequency = 300;
          this.placeholderSynth.envelope.attack = 0.005;
          break;
        case BassArticulation.MUTE:
          // Very short, muted sound
          this.placeholderSynth.envelope.sustain = 0;
          this.placeholderSynth.envelope.release = 0.05;
          break;
        default: // FINGERSTYLE
          this.placeholderSynth.filterEnvelope.baseFrequency = 200;
          this.placeholderSynth.envelope.attack = 0.01;
      }

      this.placeholderSynth.triggerAttack(
        freq,
        this.context.currentTime,
        volume,
      );
    } catch (error) {
      logger.error('Failed to trigger placeholder note:', error as Error);
    }
  }

  /**
   * Trigger actual sample (when available)
   */
  private triggerSample(
    _note: number,
    _velocity: number,
    _articulation: BassArticulation,
  ): void {
    // TODO: Implement actual sample triggering
    // This will find the appropriate sample based on note and velocity
    // and play it through Web Audio API
  }

  /**
   * Release a bass note
   */
  releaseNote(note: number): void {
    if (this.placeholderSynth && !this.isSamplesLoaded) {
      const freq = this.midiToFrequency(note);
      this.placeholderSynth.triggerRelease(freq, this.context.currentTime);
    } else if (this.activeSamples.has(note)) {
      // Stop the sample
      const source = this.activeSamples.get(note);
      if (source) {
        source.stop();
        this.activeSamples.delete(note);
      }
    }

    this.activeNotes.delete(note);
  }

  /**
   * Convert MIDI note to frequency
   */
  private midiToFrequency(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /**
   * Get string and fret from MIDI note
   */
  getStringAndFret(note: number): { string: number; fret: number } | null {
    // Check each string
    const strings = [
      { num: 4, open: BASS_TUNING.E },
      { num: 3, open: BASS_TUNING.A },
      { num: 2, open: BASS_TUNING.D },
      { num: 1, open: BASS_TUNING.G },
    ];

    for (const { num, open } of strings) {
      const fret = note - open;
      if (fret >= 0 && fret <= 24) {
        return { string: num, fret };
      }
    }

    return null;
  }

  /**
   * Schedule a bass note with tab info
   */
  scheduleBassNote(event: BassNoteEvent): void {
    const { note, velocity, time, duration, articulation } = event;

    // Schedule note on
    this.scheduleEvent({
      type: 'wam-midi',
      time,
      data: {
        bytes: new Uint8Array([0x90, note, velocity]),
      },
    });

    // Store articulation info if provided
    if (articulation) {
      this.currentArticulation = articulation;
    }

    // Schedule note off if duration provided
    if (duration && duration > 0) {
      this.scheduleEvent({
        type: 'wam-midi',
        time: time + duration,
        data: {
          bytes: new Uint8Array([0x80, note, 0]),
        },
      });
    }
  }

  /**
   * Process pattern event (for track integration)
   */
  handlePatternEvent(event: any, time: number): void {
    if (event.note) {
      const velocity = Math.round((event.velocity || 0.8) * 127);
      const articulation = event.articulation || this.currentArticulation;

      // Schedule the note
      this.scheduleBassNote({
        note: event.note,
        velocity,
        time,
        duration: event.duration,
        string: event.string,
        fret: event.fret,
        articulation,
      });
    }
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
      articulation: {
        label: 'Articulation',
        type: 'int',
        defaultValue: 0,
        minValue: 0,
        maxValue: 4,
        choices: ['Fingerstyle', 'Slap', 'Pick', 'Mute', 'Harmonic'],
      },
      tone: {
        label: 'Tone',
        type: 'float',
        defaultValue: 0.5,
        minValue: 0,
        maxValue: 1,
      },
      compression: {
        label: 'Compression',
        type: 'float',
        defaultValue: 0.3,
        minValue: 0,
        maxValue: 1,
      },
    };
  }

  async getParameterValues(): Promise<WamParameterDataMap> {
    return {
      volume: this.gainNode?.gain.value || 0.8,
      articulation: Object.values(BassArticulation).indexOf(
        this.currentArticulation,
      ),
      tone: 0.5, // TODO: Implement tone control
      compression: this.compressor
        ? (this.compressor.ratio.value - 1) / 19
        : 0.3,
    };
  }

  async setParameterValues(values: WamParameterDataMap): Promise<void> {
    if ('volume' in values && this.gainNode) {
      this.gainNode.gain.value = values.volume;
    }

    if ('articulation' in values) {
      const articulations = Object.values(BassArticulation);
      const articulation = articulations[values.articulation];
      if (articulation) {
        this.currentArticulation = articulation;
      }
    }

    if ('compression' in values && this.compressor) {
      // Map 0-1 to compression ratio 1-20
      this.compressor.ratio.value = 1 + values.compression * 19;
    }
  }

  scheduleEvent(event: WamEvent): void {
    if (event.type === 'wam-midi') {
      const midiEvent = event as WamMidiEvent;
      const { bytes } = midiEvent.data;
      const [status, note, velocity] = Array.from(bytes);
      const noteValue = note || 0;
      const velocityValue = velocity || 0;

      // Handle MIDI events
      const command = (status || 0) & 0xf0;

      // If event has a specific time, schedule it
      if (event.time && event.time > this.context.currentTime) {
        setTimeout(
          () => {
            this.handleMidiCommand(command, noteValue, velocityValue);
          },
          (event.time - this.context.currentTime) * 1000,
        );
      } else {
        // Process immediately
        this.handleMidiCommand(command, noteValue, velocityValue);
      }
    }
  }

  private handleMidiCommand(
    command: number,
    note: number,
    velocity: number,
  ): void {
    switch (command) {
      case 0x90: // Note On
        if (velocity > 0) {
          this.triggerNote(note, velocity);
        } else {
          this.releaseNote(note);
        }
        break;

      case 0x80: // Note Off
        this.releaseNote(note);
        break;
    }
  }

  clearEvents(): void {
    // Stop all playing notes
    this.activeNotes.forEach((_, note) => {
      this.releaseNote(note);
    });
    this.activeNotes.clear();
    this.activeSamples.clear();
  }

  async destroy(): Promise<void> {
    this.clearEvents();
    if (this.placeholderSynth) {
      this.placeholderSynth.dispose();
    }
    this.disconnect();
  }

  // Additional WamNode interface methods
  async getState(): Promise<any> {
    return {
      volume: this.gainNode?.gain.value || 0.8,
      articulation: Object.values(BassArticulation).indexOf(
        this.currentArticulation,
      ),
      activeNotes: Array.from(this.activeNotes.entries()),
    };
  }

  async setState(state: any): Promise<void> {
    await this.setParameterValues(state);
  }

  async getCompensationDelay(): Promise<number> {
    // Return 0 as we're not doing any processing that introduces delay
    return 0;
  }

  scheduleEvents(...events: WamEvent[]): void {
    events.forEach((event) => this.scheduleEvent(event));
  }

  clearScheduledEvents(): void {
    this.clearEvents();
  }

  // These are plugin-specific and not used in this implementation
  connectEvents(): { from: any; to: any } {
    return { from: null, to: null };
  }

  disconnectEvents(): void {
    // No-op for this implementation
  }

  destroyEvents(): void {
    this.clearEvents();
  }
}

/**
 * WAM Bass Module - the main plugin class
 */
export class WamBass extends WebAudioModuleBase {
  readonly audioContext: BaseAudioContext;
  audioNode: WamBassNode | undefined = undefined;
  initialized = false;
  readonly moduleId = 'com.bassnotion.bass';
  readonly instanceId: string;
  descriptor: WamDescriptor;

  static descriptor: WamDescriptor = {
    name: 'BassNotion Bass',
    vendor: 'BassNotion',
    version: '1.0.0',
    sdkVersion: '2.0.0',
    thumbnail: '',
    keywords: ['instrument', 'bass', 'guitar', 'sampler'],
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
    this.descriptor = WamBass.descriptor;
  }

  /**
   * Create the audio node - follows WAM 2.0 standard
   */
  async createAudioNode(initialState?: any): Promise<WamNode> {
    this.audioNode = new WamBassNode(
      this as unknown as WebAudioModule,
      initialState,
    );
    await this.audioNode.initialize();
    return this.audioNode as unknown as WamNode;
  }

  /**
   * Play a bass note
   */
  playNote(note: number, velocity = 80, duration?: number): void {
    const time = this.audioContext.currentTime;
    this.audioNode?.scheduleBassNote({ note, velocity, time, duration });
  }

  /**
   * Play a note with tab information
   */
  playTab(
    string: number,
    fret: number,
    velocity = 80,
    duration?: number,
  ): void {
    // Calculate MIDI note from string and fret
    const openStrings = [
      BASS_TUNING.E,
      BASS_TUNING.A,
      BASS_TUNING.D,
      BASS_TUNING.G,
    ];
    const openStringNote = openStrings[4 - string];
    if (openStringNote === undefined) {
      logger.error('Invalid string number', { string } as any);
      return;
    }
    const note = openStringNote + fret;

    const time = this.audioContext.currentTime;
    this.audioNode?.scheduleBassNote({
      note,
      velocity,
      time,
      duration,
      string,
      fret,
    });
  }

  /**
   * Handle pattern event (for track integration)
   */
  handlePatternEvent(event: any, time: number): void {
    this.audioNode?.handlePatternEvent(event, time);
  }

  // WebAudioModule interface methods

  async createGui(): Promise<HTMLElement> {
    const container = document.createElement('div');
    container.innerHTML = `
      <div class="wam-bass-gui">
        <h3>WAM Bass</h3>
        <p class="status">⏳ Waiting for bass samples...</p>
        <select id="articulation">
          <option value="0">Fingerstyle</option>
          <option value="1">Slap</option>
          <option value="2">Pick</option>
          <option value="3">Mute</option>
          <option value="4">Harmonic</option>
        </select>
        <label>
          Volume:
          <input type="range" id="volume" min="0" max="1" step="0.01" value="0.8">
        </label>
        <label>
          Compression:
          <input type="range" id="compression" min="0" max="1" step="0.01" value="0.3">
        </label>
        <button id="test">Test Note (E1)</button>
      </div>
    `;

    // Wire up controls
    const articulationSelect = container.querySelector(
      '#articulation',
    ) as HTMLSelectElement;
    articulationSelect.addEventListener('change', async () => {
      await this.audioNode?.setParameterValues({
        articulation: parseInt(articulationSelect.value),
      });
    });

    const volumeSlider = container.querySelector('#volume') as HTMLInputElement;
    volumeSlider.addEventListener('input', async () => {
      await this.audioNode?.setParameterValues({
        volume: parseFloat(volumeSlider.value),
      });
    });

    const compressionSlider = container.querySelector(
      '#compression',
    ) as HTMLInputElement;
    compressionSlider.addEventListener('input', async () => {
      await this.audioNode?.setParameterValues({
        compression: parseFloat(compressionSlider.value),
      });
    });

    const testButton = container.querySelector('#test') as HTMLButtonElement;
    testButton.addEventListener('click', () => {
      this.playNote(BASS_TUNING.E, 80, 0.5);
    });

    return container;
  }

  destroyGui(gui: Element): void {
    gui.remove();
  }

  // WebAudioModule interface methods
  getState(): any {
    return {
      volume: this.audioNode?.gain?.value || 0.8,
      articulation: this.audioNode
        ? Object.values(BassArticulation).indexOf(
            (this.audioNode as any).currentArticulation ||
              BassArticulation.FINGERSTYLE,
          )
        : 0,
    };
  }

  async setState(state: any): Promise<void> {
    if (this.audioNode && state) {
      await this.audioNode.setParameterValues(state);
    }
  }

  /**
   * Static factory method - WAM 2.0 standard
   */
  static async createInstance(
    audioContext: BaseAudioContext,
    initialState?: any,
  ): Promise<WamBass> {
    const instance = new WamBass(audioContext);
    await instance.initialize(initialState);
    return instance;
  }
}

// Export default the class for WAM host compatibility
export default WamBass;
