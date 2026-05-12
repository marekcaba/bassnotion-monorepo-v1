/**
 * WAM Metronome Plugin
 *
 * A Web Audio Module (WAM) 2.0 compliant metronome with configurable click sounds.
 * Designed for precise timing and rhythmic training in BassNotion.
 *
 * Features:
 * - Multiple click sound presets
 * - Configurable time signatures
 * - Accent patterns for downbeats
 * - Subdivision support (8th notes, triplets, etc.)
 * - Volume and pan control per click type
 * - Sample-accurate timing through AudioWorklet
 * - MIDI sync capability
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
  WamTransportEvent,
} from '../../../../types/wam.js';
import { GlobalSampleCache } from '../../../storage/cache/GlobalSampleCache.js';
import { createStructuredLogger } from '../../../shared/index.js';
import { musicalTruth } from '../../../tempo/MusicalTruthAuthority.js';

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
    return this as any;
  }

  async getState(): Promise<any> {
    return this.audioNode?.getState?.() || {};
  }

  async setState(state: any): Promise<void> {
    if (this.audioNode?.setState) {
      await this.audioNode.setState(state);
    }
  }

  async createGui(): Promise<Element> {
    const container = document.createElement('div');
    container.innerHTML = '<div>No GUI available</div>';
    return container;
  }

  destroyGui(gui: Element): void {
    gui.remove();
  }
}

/**
 * Metronome click types
 */
export enum MetronomeSound {
  CLASSIC = 'classic', // Traditional wood block
  ELECTRONIC = 'electronic', // Electronic beep
  ACOUSTIC = 'acoustic', // Acoustic drum stick
  SUBTLE = 'subtle', // Soft, subtle click
}

/**
 * Metronome event for scheduling
 */
export interface MetronomeEvent {
  beat: number; // Beat number in measure (0-based)
  subdivision: number; // Subdivision index (0 for main beat)
  isAccent: boolean; // True for downbeat/accent
  time: number; // When to play (audio context time)
  velocity: number; // Velocity (0-127)
}

/**
 * Time signature configuration
 */
export interface TimeSignature {
  numerator: number; // Beats per measure
  denominator: number; // Note value (4 = quarter, 8 = eighth)
}

// Check if we're in browser environment
const isBrowser =
  typeof window !== 'undefined' && typeof AudioContext !== 'undefined';

/**
 * Extended GainNode to implement AudioNode interface
 */
const BaseNode = isBrowser ? GainNode : class FakeGainNode {};
class ExtendedGainNode extends BaseNode {
  constructor(context?: BaseAudioContext, options?: GainOptions) {
    if (isBrowser && context) {
      super(context, options);
    } else {
      super();
    }
  }
}

/**
 * WAM Metronome Node - handles click generation and timing
 */
export class WamMetronomeNode extends ExtendedGainNode implements WamNode {
  private gainNode: GainNode | null = null;
  private clickBuffer: AudioBuffer | null = null;
  private accentBuffer: AudioBuffer | null = null;
  private currentSound: MetronomeSound = MetronomeSound.CLASSIC;
  private timeSignature: TimeSignature = { numerator: 4, denominator: 4 };
  private isPlaying = false;
  // ❌ REMOVED: private tempo = 120 - now reads from musicalTruth
  private subdivisions = 1; // 1 = quarter notes, 2 = 8th notes, 3 = triplets
  private accentPattern: boolean[] = [true, false, false, false]; // Accent pattern
  private _currentBeat = 0;
  private scheduledEvents: Set<NodeJS.Timeout> = new Set(); // Track scheduled timeouts
  private sampleCache = GlobalSampleCache;
  private clickSynth: any = null;
  private accentSynth: any = null;
  private logger = createStructuredLogger('WamMetronomeNode');
  private _isActive: boolean = true; // Start active by default
  private _activeSources: Set<AudioBufferSourceNode> = new Set();

  get gain(): AudioParam {
    return this.gainNode?.gain || super.gain;
  }

  get context(): BaseAudioContext {
    return this.module.audioContext;
  }

  /**
   * Get current tempo from musicalTruth (single source of truth)
   */
  private get tempo(): number {
    return musicalTruth.getBPM();
  }

  constructor(
    public module: WebAudioModule,
    _options?: AudioNodeOptions,
  ) {
    super(module.audioContext);
    // Don't initialize here to avoid SSR issues
  }

  /**
   * Connect to destination
   */
  connect(destination: AudioNode | AudioParam): AudioNode {
    if (!this.gainNode) {
      throw new Error('WAM Metronome not initialized');
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
      // DON'T switch Tone.js context - use the shared context
      // This was causing multiple context switches and buffer errors
      this.logger.info(
        '🎵 WamMetronomeNode: Using shared AudioContext, not switching Tone.js',
      );

      this.gainNode = this.context.createGain();
      this.gainNode.gain.value = 0.8;
    }

    // Initialize click sounds
    await this.loadSound(MetronomeSound.CLASSIC);
  }

  /**
   * Load a metronome sound preset
   */
  async loadSound(sound: MetronomeSound): Promise<void> {
    try {
      // FIRST: Try to get preloaded decoded AudioBuffers from memory cache
      const cachedHighBuffer =
        this.sampleCache.getCachedBuffer('metronome-high');
      const cachedLowBuffer = this.sampleCache.getCachedBuffer('metronome-low');

      if (cachedHighBuffer && cachedLowBuffer) {
        this.logger.info(
          '✅ Using preloaded metronome samples from memory cache!',
        );
        this.accentBuffer = cachedHighBuffer;
        this.clickBuffer = cachedLowBuffer;
        this.currentSound = sound;
        return;
      }

      // Not in memory - check IndexedDB for raw ArrayBuffers
      this.logger.info(
        '⚠️ Preloaded samples not in memory, checking IndexedDB...',
      );

      const rawHighBuffer =
        await this.sampleCache.getCachedRawBuffer('metronome-high');
      const rawLowBuffer =
        await this.sampleCache.getCachedRawBuffer('metronome-low');

      if (rawHighBuffer && rawLowBuffer) {
        console.log(
          '💾 [INDEXEDDB-HIT] Using cached metronome samples from IndexedDB',
        );
        this.logger.info(
          '💾 IndexedDB cache HIT for metronome samples, decoding...',
        );

        // Decode the raw buffers
        const highAudioBuffer =
          await this.context.decodeAudioData(rawHighBuffer);
        const lowAudioBuffer = await this.context.decodeAudioData(rawLowBuffer);

        // Cache decoded buffers in memory for next time
        this.sampleCache.cacheBuffer('metronome-high', highAudioBuffer);
        this.sampleCache.cacheBuffer('metronome-low', lowAudioBuffer);

        this.accentBuffer = highAudioBuffer;
        this.clickBuffer = lowAudioBuffer;
        this.currentSound = sound;
        this.logger.info('✅ Metronome ready from IndexedDB cache');
        return;
      }

      // If not in IndexedDB either, load from Supabase
      this.logger.info('⚠️ Samples not in IndexedDB, loading from Supabase...');

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

      // Load TWO different samples for low and high clicks
      const clickSamplePath = 'metronome/Click_low2_fixed.mp3'; // Low pitched click
      const accentSamplePath = 'metronome/Click_high2_fixed.mp3'; // High pitched accent

      const clickUrl = `${supabaseUrl}/storage/v1/object/public/audio-samples/${clickSamplePath}`;
      const accentUrl = `${supabaseUrl}/storage/v1/object/public/audio-samples/${accentSamplePath}`;

      this.logger.info(`🎵 Loading metronome samples from Supabase:`);
      this.logger.info(`  Regular click: ${clickSamplePath}`);
      this.logger.info(`  Accent click: ${accentSamplePath}`);

      // Load regular click buffer
      const cachedClickBuffer =
        this.sampleCache.getCachedBuffer(clickUrl) ||
        this.sampleCache.getCachedBuffer('metronome-click');

      if (cachedClickBuffer) {
        this.logger.info(`♻️ Using cached buffer for regular click`);
        this.clickBuffer = cachedClickBuffer;
      } else {
        this.logger.info(`📥 Loading regular click from: ${clickUrl}`);
        const response = await fetch(clickUrl);
        if (!response.ok) {
          throw new Error(
            `HTTP error loading click! status: ${response.status}`,
          );
        }
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
        this.logger.info(`🎵 Regular click loaded: ${audioBuffer.duration}s`);

        // Cache both raw (to IndexedDB) and decoded (to memory)
        await this.sampleCache.cacheBuffer('metronome-low', arrayBuffer);
        this.sampleCache.cacheBuffer(clickUrl, audioBuffer);
        this.sampleCache.cacheBuffer('metronome-click', audioBuffer);
        this.sampleCache.cacheBuffer('metronome-low', audioBuffer);
        this.clickBuffer = audioBuffer;
      }

      // Load accent click buffer
      const cachedAccentBuffer =
        this.sampleCache.getCachedBuffer(accentUrl) ||
        this.sampleCache.getCachedBuffer('metronome-accent');

      if (cachedAccentBuffer) {
        this.logger.info(`♻️ Using cached buffer for accent click`);
        this.accentBuffer = cachedAccentBuffer;
      } else {
        this.logger.info(`📥 Loading accent click from: ${accentUrl}`);
        const response = await fetch(accentUrl);
        if (!response.ok) {
          throw new Error(
            `HTTP error loading accent! status: ${response.status}`,
          );
        }
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
        this.logger.info(`🎵 Accent click loaded: ${audioBuffer.duration}s`);

        // Cache both raw (to IndexedDB) and decoded (to memory)
        await this.sampleCache.cacheBuffer('metronome-high', arrayBuffer);
        this.sampleCache.cacheBuffer(accentUrl, audioBuffer);
        this.sampleCache.cacheBuffer('metronome-accent', audioBuffer);
        this.sampleCache.cacheBuffer('metronome-high', audioBuffer);
        this.accentBuffer = audioBuffer;
      }

      this.currentSound = sound;
      this.logger.info(`✅ Metronome ready with Supabase sample`);
    } catch (error) {
      this.logger.error(`Failed to load ${sound} sound:`, error as Error);
      // Fallback to oscillators if samples fail to load
      this.logger.warn('Falling back to oscillator-based clicks');
      this.useFallbackOscillators();
    }
  }

  /**
   * Get Tone.js instance
   */
  private async _getToneJS(): Promise<typeof window.Tone | null> {
    // Check both locations where Tone.js may be stored
    if (window.Tone) {
      return window.Tone;
    }
    if (window.__globalTone) {
      return window.__globalTone;
    }

    // Try to get from CoreServices
    const coreServices = window.__coreServices || window.__globalCoreServices;
    // Type assertion for CoreServices interface
    const typedCoreServices = coreServices as {
      getAudioEngine?: () => { getTone?: () => typeof window.Tone } | null;
    } | undefined;
    if (typedCoreServices?.getAudioEngine) {
      const audioEngine = typedCoreServices.getAudioEngine();
      if (audioEngine?.getTone) {
        return audioEngine.getTone();
      }
    }

    return null;
  }

  /**
   * Use fallback Web Audio API oscillators when Tone.js is not available
   */
  private useFallbackOscillators(): void {
    // Create a simple click sound using Web Audio API
    this.clickSynth = {
      triggerAttackRelease: (
        pitch: string,
        _duration: string,
        time: number,
        velocity: number,
      ) => {
        const osc = this.context.createOscillator();
        const env = this.context.createGain();

        osc.connect(env);
        if (this.gainNode) {
          env.connect(this.gainNode);
        }

        // Simple click envelope
        env.gain.setValueAtTime(0, time);
        env.gain.linearRampToValueAtTime(velocity, time + 0.001);
        env.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

        osc.frequency.value = pitch === 'C5' ? 523.25 : 261.63; // C5 or C4
        osc.start(time);
        osc.stop(time + 0.05);
      },
      dispose: () => {
        // No-op for fallback - add empty body to satisfy ESLint
      },
    } as any;

    // Use same synth for accent (could be customized)
    this.accentSynth = this.clickSynth;

    this.currentSound = MetronomeSound.CLASSIC;
    this.logger.info(
      '✅ Using fallback Web Audio API oscillators for metronome',
    );
  }

  /**
   * Trigger a metronome click
   */
  triggerClick(isAccent = false, velocity = 80, time?: number): void {
    this.logger.info('🎵 WamMetronomeNode.triggerClick() called', {
      hasClickBuffer: !!this.clickBuffer,
      hasAccentBuffer: !!this.accentBuffer,
      isAccent,
      velocity,
      time,
    });

    const buffer = isAccent ? this.accentBuffer : this.clickBuffer;

    // If no buffer loaded, try fallback
    if (!buffer) {
      this.logger.info(
        '❌ No buffer available for metronome click - using fallback oscillator',
      );
      if (this.clickSynth) {
        const synth = isAccent ? this.accentSynth : this.clickSynth;
        const actualTime = time !== undefined ? time : this.context.currentTime;
        const volume = (velocity / 127) * 0.8;
        const pitch = isAccent ? 'C5' : 'C4';
        this.logger.info('🎵 Using fallback oscillator:', {
          pitch,
          volume,
          actualTime,
        });
        synth.triggerAttackRelease(pitch, '32n', actualTime, volume);
      } else {
        this.logger.error('❌ No fallback synth available either!');
      }
      return;
    }

    const triggerTime = time !== undefined ? time : this.context.currentTime;

    this.logger.info('🎵 Playing metronome click with buffer', {
      bufferDuration: buffer.duration,
      bufferSampleRate: buffer.sampleRate,
      triggerTime,
      contextTime: this.context.currentTime,
      gainNodeConnected: !!this.gainNode,
    });

    try {
      // Create source node
      const source = this.context.createBufferSource();
      source.buffer = buffer;

      // Create gain for velocity
      const velocityGain = this.context.createGain();
      // Same volume for all beats (no accent boost)
      const baseVolume = 0.8;
      velocityGain.gain.value = (velocity / 127) * baseVolume;

      // Connect nodes
      source.connect(velocityGain);
      if (this.gainNode) {
        velocityGain.connect(this.gainNode);
      }

      // Start playback
      source.start(triggerTime);

      // Track source for stop functionality
      this._activeSources.add(source);

      // Log audio output scheduling with frame-accurate timing
      const frame = Math.round(triggerTime * this.context.sampleRate);
      this.logger.info('✅ Metronome click scheduled', {
        triggerTime: triggerTime.toFixed(6),
        frame,
        sampleRate: this.context.sampleRate,
      });

      // Cleanup after playback
      source.onended = () => {
        source.disconnect();
        velocityGain.disconnect();
        // Remove from active sources tracking
        this._activeSources.delete(source);
      };
    } catch (error) {
      this.logger.error('Failed to trigger click:', error as Error);
    }
  }

  /**
   * Schedule a pattern of clicks
   */
  schedulePattern(startTime: number, measures = 1): void {
    const beatDuration = 60 / this.tempo / this.subdivisions;
    const beatsPerMeasure = this.timeSignature.numerator * this.subdivisions;

    for (let measure = 0; measure < measures; measure++) {
      for (let beat = 0; beat < beatsPerMeasure; beat++) {
        const time =
          startTime + (measure * beatsPerMeasure + beat) * beatDuration;
        const mainBeat = beat % this.subdivisions === 0;
        const beatIndex = Math.floor(beat / this.subdivisions);
        const isAccent =
          mainBeat && this.accentPattern[beatIndex % this.accentPattern.length];

        // Schedule the click
        if (time > this.context.currentTime) {
          const timeoutId = setTimeout(
            () => {
              this.triggerClick(isAccent, isAccent ? 100 : 70);
              this.scheduledEvents.delete(timeoutId as any);
            },
            (time - this.context.currentTime) * 1000,
          ) as unknown as NodeJS.Timeout;

          this.scheduledEvents.add(timeoutId);
        }
      }
    }
  }

  /**
   * Start metronome (for standalone use)
   */
  start(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this._currentBeat = 0;
    this.scheduleNextMeasure();
  }

  /**
   * Stop metronome
   */
  stop(): void {
    this.isPlaying = false;
    this.clearScheduledEvents();
  }

  /**
   * Schedule next measure
   */
  private scheduleNextMeasure(): void {
    if (!this.isPlaying) return;

    const currentTime = this.context.currentTime;
    this.schedulePattern(currentTime + 0.1, 1);

    // Schedule next measure
    const measureDuration = (60 / this.tempo) * this.timeSignature.numerator;
    setTimeout(() => {
      this.scheduleNextMeasure();
    }, measureDuration * 900); // Schedule slightly early
  }

  /**
   * Clear all scheduled events
   */
  private clearScheduledEvents(): void {
    this.scheduledEvents.forEach((id) => clearTimeout(id as any));
    this.scheduledEvents.clear();
  }

  /**
   * Handle transport events (start/stop/tempo)
   */
  handleTransportEvent(event: WamTransportEvent): void {
    const data = event.data as any;
    switch (data.type) {
      case 'start':
        this._currentBeat = 0;
        break;
      case 'stop':
        this.clearScheduledEvents();
        break;
      case 'tempo':
        // ✅ REMOVED: tempo setter - tempo now comes from musicalTruth
        // Tempo changes should be done via musicalTruth.setFromExercise()
        this.logger.warn(
          '⚠️ WamMetronome received tempo event - ignoring. Use musicalTruth.setFromExercise() instead',
          {
            receivedTempo: data.tempo,
            currentMusicalTruthTempo: musicalTruth.getBPM(),
          },
        );
        break;
    }
  }

  /**
   * Process pattern event (for track integration)
   */
  handlePatternEvent(event: any, time: number): void {
    if (event.type === 'click' || event.type === 'accent') {
      const velocity = Math.round((event.velocity || 0.8) * 127);
      this.triggerClick(event.type === 'accent', velocity, time);
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
      sound: {
        label: 'Sound',
        type: 'int',
        defaultValue: 0,
        minValue: 0,
        maxValue: 3,
        choices: ['Classic', 'Electronic', 'Acoustic', 'Subtle'],
      },
      subdivisions: {
        label: 'Subdivisions',
        type: 'int',
        defaultValue: 1,
        minValue: 1,
        maxValue: 4,
        choices: ['Quarter', 'Eighth', 'Triplet', 'Sixteenth'],
      },
      accentBeats: {
        label: 'Accent Beats',
        type: 'int',
        defaultValue: 4,
        minValue: 1,
        maxValue: 16,
      },
    };
  }

  async getParameterValues(): Promise<WamParameterDataMap> {
    return {
      volume: this.gainNode?.gain.value || 0.8,
      sound: Object.values(MetronomeSound).indexOf(this.currentSound),
      subdivisions: this.subdivisions,
      accentBeats: this.timeSignature.numerator,
    };
  }

  async setParameterValues(values: WamParameterDataMap): Promise<void> {
    if ('volume' in values && this.gainNode) {
      this.gainNode.gain.value = values.volume;
    }

    if ('sound' in values) {
      const sounds = Object.values(MetronomeSound);
      const sound = sounds[values.sound];
      if (sound) {
        await this.loadSound(sound);
      }
    }

    if ('subdivisions' in values) {
      this.subdivisions = values.subdivisions;
    }

    if ('accentBeats' in values) {
      this.timeSignature.numerator = values.accentBeats;
      // Update accent pattern
      this.accentPattern = Array(values.accentBeats).fill(false);
      this.accentPattern[0] = true; // Always accent first beat
    }
  }

  scheduleEvent(event: WamEvent): void {
    if (event.type === 'wam-transport') {
      this.handleTransportEvent(event as WamTransportEvent);
    } else if (event.type === 'wam-midi') {
      // Handle MIDI sync if needed
      const midiEvent = event as WamMidiEvent;
      const [status, _data1, _data2] = Array.from(midiEvent.data.bytes);

      // MIDI clock (0xF8)
      if (status === 0xf8) {
        // Handle MIDI clock sync
      }
    }
  }

  clearEvents(): void {
    this.clearScheduledEvents();
  }

  async destroy(): Promise<void> {
    this.stop();
    this.clearEvents();
    if (this.clickSynth) {
      this.clickSynth.dispose();
    }
    if (this.accentSynth) {
      this.accentSynth.dispose();
    }
    this.disconnect();
  }

  // WamNode interface methods
  async getState(): Promise<any> {
    return {
      sound: this.currentSound,
      tempo: this.tempo,
      subdivisions: this.subdivisions,
      timeSignature: this.timeSignature,
      accentPattern: this.accentPattern,
    };
  }

  async setState(state: any): Promise<void> {
    if (state.sound !== undefined) {
      await this.loadSound(state.sound);
    }
    if (state.tempo !== undefined) {
      // ✅ REMOVED: tempo setter - tempo now comes from musicalTruth
      this.logger.warn(
        '⚠️ WamMetronome.setState() received tempo - ignoring. Use musicalTruth.setFromExercise() instead',
        {
          receivedTempo: state.tempo,
          currentMusicalTruthTempo: musicalTruth.getBPM(),
        },
      );
    }
    if (state.subdivisions !== undefined) {
      this.subdivisions = state.subdivisions;
    }
    if (state.timeSignature !== undefined) {
      this.timeSignature = state.timeSignature;
    }
    if (state.accentPattern !== undefined) {
      this.accentPattern = state.accentPattern;
    }
  }

  async getCompensationDelay(): Promise<number> {
    return 0;
  }

  scheduleEvents(..._events: WamEvent[]): void {
    // Implementation for scheduling multiple events
  }
}

/**
 * WAM Metronome Module - the main plugin class
 */
export class WamMetronome extends WebAudioModuleBase {
  readonly audioContext: BaseAudioContext;
  audioNode: WamMetronomeNode | undefined = undefined;
  initialized = false;
  readonly moduleId = 'com.bassnotion.metronome';
  readonly instanceId: string;
  private logger = createStructuredLogger('WamMetronome');
  readonly descriptor: WamDescriptor;

  static descriptor: WamDescriptor = {
    name: 'BassNotion Metronome',
    vendor: 'BassNotion',
    version: '1.0.0',
    sdkVersion: '2.0.0',
    thumbnail: '',
    keywords: ['utility', 'metronome', 'timing', 'rhythm'],
    isInstrument: false,
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
    this.descriptor = WamMetronome.descriptor;
  }

  /**
   * Create the audio node - follows WAM 2.0 standard
   */
  async createAudioNode(initialState?: any): Promise<WamNode> {
    this.audioNode = new WamMetronomeNode(this as any, initialState);
    await this.audioNode.initialize();
    return this.audioNode as WamNode;
  }

  /**
   * Trigger a click sound (used by widgets)
   */
  click(isAccent = false): void {
    this.logger.info('🎵 WamMetronome.click() called', {
      hasAudioNode: !!this.audioNode,
      isAccent,
    });
    if (this.audioNode) {
      this.audioNode.triggerClick(isAccent);
    } else {
      this.logger.info('❌ No audio node available');
    }
  }

  /**
   * Trigger method for AudioEventRouter compatibility
   */
  trigger(event: {
    audioTime?: number;
    velocity?: number;
    data?: {
      beat?: number;
      isDownbeat?: boolean;
    };
  }): void {
    this.logger.info('🎵 WamMetronome.trigger() called', {
      hasAudioNode: !!this.audioNode,
      event,
    });

    if (this.audioNode) {
      const isAccent = event.data?.isDownbeat || event.data?.beat === 1;
      const velocity = Math.round((event.velocity || 0.8) * 127);
      this.audioNode.triggerClick(isAccent, velocity, event.audioTime);
    } else {
      this.logger.error('❌ No audio node available for trigger');
    }
  }

  /**
   * Set time signature
   */
  setTimeSignature(numerator: number, _denominator: number): void {
    if (this.audioNode) {
      this.audioNode.setParameterValues({
        accentBeats: numerator,
      });
    }
  }

  /**
   * Set tempo (for standalone use)
   * NOTE: Tempo is managed by musicalTruth singleton. This method updates musicalTruth
   * and the WamMetronomeNode.tempo getter will automatically read the new value.
   */
  setTempo(bpm: number): void {
    // Update the single source of truth - WamMetronomeNode.tempo getter reads from musicalTruth
    musicalTruth.setBPM(bpm);
  }

  /**
   * Handle pattern event (for track integration)
   */
  handlePatternEvent(event: any, time: number): void {
    this.audioNode?.handlePatternEvent(event, time);
  }

  /**
   * Load default metronome samples
   */
  async loadDefaultSamples(): Promise<void> {
    if (this.audioNode) {
      await this.audioNode.loadSound(MetronomeSound.CLASSIC);
    }
  }

  /**
   * Activate plugin - enable audio processing
   * Called by PluginManager when transport starts
   */
  async activate(): Promise<void> {
    if (this.audioNode) {
      this.audioNode['_isActive'] = true;
      this.logger.info('WamMetronome activated - ready for audio processing');
    }
  }

  /**
   * Deactivate plugin - stop all active audio sources immediately
   * Called by PluginManager when transport stops
   */
  async deactivate(): Promise<void> {
    if (this.audioNode) {
      this.audioNode['_isActive'] = false;
      // Stop all active click sources
      for (const source of this.audioNode['_activeSources']) {
        try {
          source.stop(0);
        } catch (e) {
          // Source may have already ended
        }
      }
      this.audioNode['_activeSources'].clear();
      this.logger.info('WamMetronome deactivated - all audio sources stopped');
    }
  }

  async createGui(): Promise<HTMLElement> {
    const container = document.createElement('div');
    container.innerHTML = `
      <div class="wam-metronome-gui">
        <h3>WAM Metronome</h3>
        <select id="sound">
          <option value="0">Classic</option>
          <option value="1">Electronic</option>
          <option value="2">Acoustic</option>
          <option value="3">Subtle</option>
        </select>
        <label>
          Volume:
          <input type="range" id="volume" min="0" max="1" step="0.01" value="0.8">
        </label>
        <label>
          Subdivisions:
          <select id="subdivisions">
            <option value="1">Quarter Notes</option>
            <option value="2">Eighth Notes</option>
            <option value="3">Triplets</option>
            <option value="4">Sixteenth Notes</option>
          </select>
        </label>
        <button id="test">Test Click</button>
      </div>
    `;

    // Wire up controls
    const soundSelect = container.querySelector('#sound') as HTMLSelectElement;
    soundSelect.addEventListener('change', async () => {
      await this.audioNode?.setParameterValues({
        sound: parseInt(soundSelect.value),
      });
    });

    const volumeSlider = container.querySelector('#volume') as HTMLInputElement;
    volumeSlider.addEventListener('input', async () => {
      await this.audioNode?.setParameterValues({
        volume: parseFloat(volumeSlider.value),
      });
    });

    const subdivisionSelect = container.querySelector(
      '#subdivisions',
    ) as HTMLSelectElement;
    subdivisionSelect.addEventListener('change', async () => {
      await this.audioNode?.setParameterValues({
        subdivisions: parseInt(subdivisionSelect.value),
      });
    });

    const testButton = container.querySelector('#test') as HTMLButtonElement;
    testButton.addEventListener('click', () => {
      this.click(false);
    });

    return container;
  }

  destroyGui(gui: Element): void {
    gui.remove();
  }

  /**
   * Get audio destination node for direct scheduling
   * Required by SimpleInstrumentScheduler for FAANG direct scheduling
   */
  getDestination(): AudioNode | null {
    return this.audioNode || null;
  }

  /**
   * Static factory method - WAM 2.0 standard
   */
  static async createInstance(
    audioContext: BaseAudioContext,
    initialState?: any,
  ): Promise<WamMetronome> {
    const instance = new WamMetronome(audioContext);
    await instance.initialize(initialState);
    return instance;
  }
}

// Export default the class for WAM host compatibility
export default WamMetronome;
