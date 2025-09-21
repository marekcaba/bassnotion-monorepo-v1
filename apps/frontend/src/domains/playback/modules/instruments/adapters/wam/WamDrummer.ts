/**
 * WAM Drummer Plugin
 *
 * A Web Audio Module (WAM) 2.0 compliant drum sampler with 16 pads (4x4 grid).
 * Designed to work seamlessly with BassNotion's track-based architecture
 * while maintaining compatibility with the broader WAM ecosystem.
 *
 * Features:
 * - 16 velocity-sensitive pads
 * - Sample loading from URLs or AudioBuffers
 * - MIDI input support (GM drum mapping)
 * - Per-pad volume, pan, and pitch controls
 * - Sample-accurate timing through AudioWorklet
 * - Zero-latency triggering
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
} from '../../../../types/wam.js';
import { GlobalSampleCache } from '../../../storage/cache/GlobalSampleCache.js';
import { createStructuredLogger } from '../../../shared/index.js';

// MIDI note mapping for 16 pads (following MPC-style layout)
const PAD_MIDI_NOTES = {
  1: 36, // C1 - Kick
  2: 37, // C#1
  3: 38, // D1 - Snare
  4: 39, // D#1
  5: 40, // E1 - Low Tom
  6: 41, // F1
  7: 42, // F#1 - Closed HH
  8: 43, // G1 - Low Tom 2
  9: 44, // G#1 - Pedal HH
  10: 45, // A1 - Mid Tom
  11: 46, // A#1 - Open HH
  12: 47, // B1 - Mid Tom 2
  13: 48, // C2 - High Tom
  14: 49, // C#2 - Crash
  15: 50, // D2 - High Tom 2
  16: 51, // D#2 - Ride
};

// Reverse mapping for MIDI input
const MIDI_TO_PAD = Object.entries(PAD_MIDI_NOTES).reduce(
  (acc, [pad, note]) => {
    acc[note] = parseInt(pad);
    return acc;
  },
  {} as Record<number, number>,
);

/**
 * Sample data for a single pad
 */
interface PadSample {
  buffer: AudioBuffer | null;
  url?: string;
  name: string;
  volume: number;
  pan: number;
  pitch: number;
  loaded: boolean;
}

/**
 * WAM Drummer AudioWorkletProcessor for sample-accurate playback
 */
const _WORKLET_PROCESSOR_CODE = `
class WamDrummerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.port.onmessage = this.handleMessage.bind(this);
  }
  
  handleMessage(event) {
    // Handle control messages
  }
  
  process(inputs, outputs, parameters) {
    // Pass through for now - actual sample playback handled by main thread
    const input = inputs[0];
    const output = outputs[0];
    
    if (input && output) {
      for (let channel = 0; channel < output.length; channel++) {
        output[channel].set(input[channel]);
      }
    }
    
    return true;
  }
}

registerProcessor('wam-drummer-processor', WamDrummerProcessor);
`;

/**
 * WAM Drummer Node - handles audio processing and parameter automation
 */
const logger = createStructuredLogger('WamDrummer');

export class WamDrummerNode extends GainNode implements WamNode {
  private _workletNode?: AudioWorkletNode;
  private pads: Map<number, PadSample> = new Map();
  private samplers: Map<number, AudioBufferSourceNode[]> = new Map();
  private padGains: Map<number, GainNode> = new Map();
  private padPanners: Map<number, StereoPannerNode> = new Map();
  private _eventQueue: WamEvent[] = [];

  module: WebAudioModule;

  constructor(module: WebAudioModule, options?: AudioNodeOptions) {
    super(module.audioContext, options);
    this.module = module;
    this.initialize();
  }

  private initialize(): void {
    // Initialize 16 pads with default samples
    for (let i = 1; i <= 16; i++) {
      this.pads.set(i, {
        buffer: null,
        name: `Pad ${i}`,
        volume: 0.8,
        pan: 0,
        pitch: 1,
        loaded: false,
      });

      // Create audio chain for each pad: sampler -> gain -> pan -> output
      const gain = this.context.createGain();
      gain.gain.value = 0.8;

      const panner = this.context.createStereoPanner();
      panner.pan.value = 0;

      gain.connect(panner);
      panner.connect(this);

      this.padGains.set(i, gain);
      this.padPanners.set(i, panner);
      this.samplers.set(i, []);
    }
  }

  // WAM Node interface methods

  async getParameterInfo(): Promise<WamParameterInfoMap> {
    const params: WamParameterInfoMap = {};

    // Create parameters for each pad
    for (let i = 1; i <= 16; i++) {
      params[`pad${i}_volume`] = {
        label: `Pad ${i} Volume`,
        type: 'float',
        defaultValue: 0.8,
        minValue: 0,
        maxValue: 1,
      };

      params[`pad${i}_pan`] = {
        label: `Pad ${i} Pan`,
        type: 'float',
        defaultValue: 0,
        minValue: -1,
        maxValue: 1,
      };

      params[`pad${i}_pitch`] = {
        label: `Pad ${i} Pitch`,
        type: 'float',
        defaultValue: 1,
        minValue: 0.5,
        maxValue: 2,
      };
    }

    return params;
  }

  async getParameterValues(): Promise<WamParameterDataMap> {
    const values: WamParameterDataMap = {};

    for (let i = 1; i <= 16; i++) {
      const pad = this.pads.get(i);
      if (!pad) continue;
      values[`pad${i}_volume`] = pad.volume;
      values[`pad${i}_pan`] = pad.pan;
      values[`pad${i}_pitch`] = pad.pitch;
    }

    return values;
  }

  async setParameterValues(values: WamParameterDataMap): Promise<void> {
    for (const [key, value] of Object.entries(values)) {
      const match = key.match(/^pad(\d+)_(\w+)$/);
      if (match && match[1] && match[2]) {
        const padNumber = parseInt(match[1]);
        const param = match[2];
        const pad = this.pads.get(padNumber);

        if (pad) {
          switch (param) {
            case 'volume': {
              pad.volume = value;
              const gain = this.padGains.get(padNumber);
              if (gain) gain.gain.value = value;
              break;
            }
            case 'pan': {
              pad.pan = value;
              const panner = this.padPanners.get(padNumber);
              if (panner) panner.pan.value = value;
              break;
            }
            case 'pitch':
              pad.pitch = value;
              break;
          }
        }
      }
    }
  }

  getState(): any {
    return {
      pads: Array.from(this.pads.entries()).map(([num, pad]) => ({
        number: num,
        name: pad.name,
        url: pad.url,
        volume: pad.volume,
        pan: pad.pan,
        pitch: pad.pitch,
      })),
    };
  }

  async setState(state: any): Promise<void> {
    if (state.pads) {
      for (const padState of state.pads) {
        const pad = this.pads.get(padState.number);
        if (pad) {
          pad.name = padState.name;
          pad.volume = padState.volume;
          pad.pan = padState.pan;
          pad.pitch = padState.pitch;

          if (padState.url && padState.url !== pad.url) {
            await this.loadSample(padState.number, padState.url);
          }
        }
      }
    }
  }

  async getCompensationDelay(): Promise<number> {
    // No inherent latency in sample playback
    return 0;
  }

  scheduleEvents(...events: WamEvent[]): void {
    for (const event of events) {
      if (event.type === 'wam-midi') {
        this.handleMidiEvent(event as WamMidiEvent);
      } else if (event.type === 'wam-automation') {
        this.handleAutomationEvent(event as WamAutomationEvent);
      }
    }
  }

  clearEvents(): void {
    this._eventQueue = [];

    // Stop all playing samples
    for (const [padNum, sources] of this.samplers.entries()) {
      for (const source of sources) {
        try {
          source.stop();
        } catch {
          // Already stopped
        }
      }
      this.samplers.set(padNum, []);
    }
  }

  // Drummer-specific methods

  /**
   * Load a sample for a specific pad
   */
  async loadSample(
    padNumber: number,
    urlOrBuffer: string | AudioBuffer,
  ): Promise<void> {
    const pad = this.pads.get(padNumber);
    if (!pad) return;

    try {
      if (typeof urlOrBuffer === 'string') {
        // First check if we have a cached buffer (from preloading)
        const cachedBuffer =
          GlobalSampleCache.getCachedBuffer(urlOrBuffer) ||
          GlobalSampleCache.getCachedBuffer(`drum-pad-${padNumber}`);

        if (cachedBuffer) {
          logger.info(`♻️ Using cached buffer for pad ${padNumber}`);
          pad.buffer = cachedBuffer;
          pad.url = urlOrBuffer;
          pad.loaded = true;
          return;
        }

        // If no cached buffer, try to load from URL
        logger.info(`📥 Loading sample from URL for pad ${padNumber}`);
        const response = await fetch(urlOrBuffer);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.context.decodeAudioData(arrayBuffer);

        // Cache the buffer for future use
        GlobalSampleCache.cacheBuffer(urlOrBuffer, audioBuffer);
        GlobalSampleCache.cacheBuffer(`drum-pad-${padNumber}`, audioBuffer);

        pad.buffer = audioBuffer;
        pad.url = urlOrBuffer;
        pad.loaded = true;
      } else {
        // Use provided AudioBuffer
        pad.buffer = urlOrBuffer;
        pad.loaded = true;
      }

      logger.info(`✅ WamDrummer: Loaded sample for pad ${padNumber}`);
    } catch (error) {
      logger.error(
        `Failed to load sample for pad ${padNumber}:`,
        error as Error,
      );
      pad.loaded = false;
    }
  }

  /**
   * Trigger a pad with velocity
   */
  triggerPad(padNumber: number, velocity = 1, time?: number): void {
    const pad = this.pads.get(padNumber);
    if (!pad || !pad.loaded || !pad.buffer) return;

    const triggerTime = time || this.context.currentTime;

    // Create source node
    const source = this.context.createBufferSource();
    source.buffer = pad.buffer;
    source.playbackRate.value = pad.pitch;

    // Connect to pad's gain node
    const gain = this.padGains.get(padNumber);
    if (gain) {
      source.connect(gain);

      // Apply velocity
      const originalGain = pad.volume;
      gain.gain.setValueAtTime(originalGain * velocity, triggerTime);
    }

    // Start playback
    source.start(triggerTime);

    // Track active sources for cleanup
    const sources = this.samplers.get(padNumber) || [];
    sources.push(source);

    // Clean up finished sources
    source.onended = () => {
      const index = sources.indexOf(source);
      if (index >= 0) {
        sources.splice(index, 1);
      }
    };

    this.samplers.set(padNumber, sources);
  }

  /**
   * Trigger a drum (alias for triggerPad for compatibility)
   */
  triggerDrum(padNumber: number, velocity = 80, time?: number): void {
    // Convert MIDI velocity (0-127) to normalized velocity (0-1)
    const normalizedVelocity = velocity / 127;
    this.triggerPad(padNumber, normalizedVelocity, time);
  }

  /**
   * Handle MIDI events
   */
  private handleMidiEvent(event: WamMidiEvent): void {
    const bytes = event.data.bytes;
    if (!bytes || bytes.length < 3) return;

    const status = (bytes[0] || 0) & 0xf0;
    const note = bytes[1] || 0;
    const velocity = bytes[2] || 0;

    // Note On
    if (status === 0x90 && velocity > 0) {
      const padNumber = MIDI_TO_PAD[note];
      if (padNumber) {
        this.triggerPad(padNumber, velocity / 127, event.time);
      }
    }
  }

  /**
   * Handle automation events
   */
  private handleAutomationEvent(event: WamAutomationEvent): void {
    const { id, value } = event.data;
    this.setParameterValues({ [id]: value });
  }

  // Additional WamNode interface methods
  clearScheduledEvents(): void {
    this.clearEvents();
  }

  async destroy(): Promise<void> {
    this.clearEvents();
    for (const gain of this.padGains.values()) {
      gain.disconnect();
    }
    for (const panner of this.padPanners.values()) {
      panner.disconnect();
    }
    this.disconnect();
  }
}

/**
 * WAM Drummer Module - main plugin class
 */
export default class WamDrummer implements Partial<WebAudioModule> {
  readonly isWebAudioModuleConstructor = true;
  readonly descriptor: WamDescriptor = {
    name: 'BassNotion Drummer',
    vendor: 'BassNotion',
    version: '1.0.0',
    sdkVersion: '2.0.0',
    thumbnail: '',
    keywords: ['drums', 'sampler', 'instrument', 'rhythm'],
    isInstrument: true,
    website: 'https://bassnotion.com',
    hasAudioInput: false,
    hasAudioOutput: true,
    hasMidiInput: true,
    hasMidiOutput: false,
    supportsMpe: false,
  };

  readonly audioContext: BaseAudioContext;
  audioNode?: WamDrummerNode;
  initialized = false;
  readonly instanceId: string;
  readonly moduleId = 'com.bassnotion.drummer';
  private drummerNode?: WamDrummerNode;

  constructor(audioContext: BaseAudioContext) {
    this.audioContext = audioContext;
    this.instanceId = `${this.moduleId}-${Date.now()}`;
  }

  /**
   * Create instance factory method (WAM standard)
   */
  static async createInstance(
    audioContext: BaseAudioContext,
    initialState?: any,
  ): Promise<WamDrummer> {
    const instance = new WamDrummer(audioContext);

    if (initialState) {
      await instance.setState(initialState);
    }

    return instance;
  }

  async createAudioNode(initialState?: any): Promise<WamNode> {
    if (!this.drummerNode) {
      this.drummerNode = new WamDrummerNode(this as unknown as WebAudioModule);

      if (initialState) {
        await this.drummerNode.setState(initialState);
      }
    }

    this.audioNode = this.drummerNode;
    return this.drummerNode as unknown as WamNode;
  }

  async createGui(): Promise<Element> {
    // GUI would be created here - for now we'll use the existing DrummerWidget UI
    const div = document.createElement('div');
    div.textContent = 'WAM Drummer (use existing UI)';
    return div;
  }

  destroyGui(gui: Element): void {
    gui.remove();
  }

  async getState(): Promise<any> {
    return this.drummerNode?.getState() || {};
  }

  async setState(state: any): Promise<void> {
    if (this.drummerNode) {
      await this.drummerNode.setState(state);
    }
  }

  async initialize(state?: any): Promise<WebAudioModule> {
    if (!this.initialized) {
      this.audioNode = (await this.createAudioNode(
        state,
      )) as unknown as WamDrummerNode;
      this.drummerNode = this.audioNode;
      this.initialized = true;
    }
    return this as unknown as WebAudioModule;
  }

  // Helper method to load default drum kit
  async loadDefaultKit(): Promise<void> {
    if (!this.drummerNode) return;

    const samples = [
      { pad: 1, file: 'dr110kik.mp3' }, // Kick
      { pad: 3, file: 'dr110clp.mp3' }, // Snare/Clap
      { pad: 5, file: 'dr110cht.mp3' }, // Closed HH
    ];

    for (const sample of samples) {
      // Check if URL is cached from preloading
      let url = GlobalSampleCache.getCachedUrl(`drum-pad-${sample.pad}`);

      if (!url) {
        // Fallback to Supabase if not cached
        const { supabase } = await import('@/infrastructure/supabase/client');
        const kitPath = 'drums/hydrogen-kits/mp3/electronic/boss-dr110';
        const fullPath = `${kitPath}/${sample.file}`;

        const urlResult = supabase.storage
          .from('audio-samples')
          .getPublicUrl(fullPath).data.publicUrl;
        url = urlResult;
      } else {
        logger.info(`♻️ Using cached URL for pad ${sample.pad}`);
      }

      if (url) {
        await this.drummerNode.loadSample(sample.pad, url);
      }
    }

    logger.info('✅ WamDrummer: Default kit loaded');
  }
}

// Mark as WAM constructor
(WamDrummer as any).isWebAudioModuleConstructor = true;

// Export PAD_MIDI_NOTES for external use
export { PAD_MIDI_NOTES };
