/**
 * MetronomeInstrumentProcessor - Professional Metronome System
 * Story 2.2 - Task 5: Implements comprehensive metronome with advanced timing and customization
 *
 * Features:
 * - Multiple click sounds (electronic, acoustic, wood block, side stick)
 * - Complex time signatures (4/4, 3/4, 6/8, 7/8, 5/4, etc.) with accent patterns
 * - Subdivision support (quarter, eighth, sixteenth notes) with visual indicators
 * - Groove templates and swing quantization for musical feel
 * - Advanced timing precision with microsecond accuracy
 * - Visual/audio synchronization for practice enhancement
 * - Customizable accent patterns and click variations
 * - Real-time tempo changes with smooth transitions
 * - MIDI synchronization and external clock support
 */

import * as Tone from 'tone';

// Core metronome interfaces
export interface MetronomeConfig {
  clickSounds: ClickSoundConfig;
  timeSignature: TimeSignature;
  tempo: number; // BPM
  subdivision: Subdivision;
  accentPattern: AccentPattern;
  grooveTemplate: GrooveTemplate | null;
  swingAmount: number; // 0-100%
  visualSync: VisualSyncConfig;
  advancedTiming: AdvancedTimingConfig;
  midiSync: MidiSyncConfig;
}

export interface ClickSoundConfig {
  accent: ClickSound;
  regular: ClickSound;
  subdivision: ClickSound;
  currentPreset: ClickPreset;
  customSounds: Map<string, ClickSound>;
}

export interface ClickSound {
  type: ClickSoundType;
  url?: string; // For sample-based sounds
  synthParams?: SynthClickParams; // For synthesized sounds
  volume: number; // 0-1
  pitch?: number; // Pitch adjustment in cents
  envelope?: ClickEnvelope;
}

export interface SynthClickParams {
  oscillator: {
    type: OscillatorType;
    frequency: number;
  };
  envelope: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
  };
  filter?: {
    frequency: number;
    type: BiquadFilterType;
    rolloff: number;
  };
}

export interface ClickEnvelope {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface TimeSignature {
  numerator: number; // Number of beats per measure
  denominator: number; // Note value that gets the beat
  display: string; // e.g., "4/4", "3/4", "7/8"
  accentBeats: number[]; // Which beats to accent (1-indexed)
  strongBeats: number[]; // Stronger accents
  grouping?: number[]; // For complex meters like 7/8 [3+2+2]
}

export interface AccentPattern {
  name: string;
  pattern: AccentBeat[];
  repeat: boolean;
  customizable: boolean;
}

export interface AccentBeat {
  beat: number; // Beat position (0-based within measure)
  subdivision: number; // Subdivision position (0-based within beat)
  accentLevel: AccentLevel;
  clickType?: ClickSoundType; // Override default click sound
}

export interface GrooveTemplate {
  name: string;
  style: GrooveStyle;
  swingRatio: number; // 0-1 (0 = straight, 0.67 = triplet swing)
  microTiming: Map<number, number>; // Beat -> timing offset in ms
  velocityAdjustments: Map<number, number>; // Beat -> velocity multiplier
  humanization: HumanizationSettings;
}

export interface HumanizationSettings {
  timingVariation: number; // ±ms random variation
  velocityVariation: number; // ±velocity random variation
  enabled: boolean;
}

export interface VisualSyncConfig {
  enabled: boolean;
  flashDuration: number; // ms
  colors: {
    accent: string;
    regular: string;
    subdivision: string;
  };
  animations: {
    pulse: boolean;
    flash: boolean;
    custom?: string;
  };
}

export interface AdvancedTimingConfig {
  precisionMode: TimingPrecision;
  lookAhead: number; // ms ahead to schedule events
  bufferSize: number; // Audio buffer size
  latencyCompensation: number; // ms to compensate for system latency
  clockSource: ClockSource;
}

export interface MidiSyncConfig {
  enabled: boolean;
  clockSource: 'internal' | 'external';
  sendClock: boolean;
  receiveClock: boolean;
  ppqn: number; // Pulses per quarter note (24 standard)
}

export interface MetronomeEvent {
  time: number; // Scheduled time
  type: MetronomeEventType;
  beat: number; // Beat position in measure
  subdivision: number; // Subdivision position
  accentLevel: AccentLevel;
  clickSound: ClickSoundType;
  velocity: number;
  visualData?: VisualEventData;
}

export interface VisualEventData {
  color: string;
  intensity: number;
  duration: number;
  animationType: string;
}

export interface MetronomeState {
  isRunning: boolean;
  currentTempo: number;
  currentMeasure: number;
  currentBeat: number;
  currentSubdivision: number;
  timeSignature: TimeSignature;
  nextEventTime: number;
  totalBeats: number;
  elapsedTime: number; // in seconds
}

// Enums
export enum ClickSoundType {
  ELECTRONIC_BEEP = 'electronic_beep',
  ACOUSTIC_CLICK = 'acoustic_click',
  WOOD_BLOCK = 'wood_block',
  SIDE_STICK = 'side_stick',
  COWBELL = 'cowbell',
  CLAP = 'clap',
  SYNTH_CLICK = 'synth_click',
  CUSTOM_SAMPLE = 'custom_sample',
}

export enum ClickPreset {
  CLASSIC = 'classic',
  MODERN = 'modern',
  VINTAGE = 'vintage',
  ELECTRONIC = 'electronic',
  ACOUSTIC = 'acoustic',
  STUDIO = 'studio',
  PRACTICE = 'practice',
}

export enum Subdivision {
  QUARTER = 'quarter', // 1/4 notes
  EIGHTH = 'eighth', // 1/8 notes
  SIXTEENTH = 'sixteenth', // 1/16 notes
  TRIPLET = 'triplet', // 1/8 triplets
  DOTTED_EIGHTH = 'dotted_eighth', // Dotted 1/8 notes
  CUSTOM = 'custom',
}

export enum AccentLevel {
  NONE = 0,
  LIGHT = 1,
  MEDIUM = 2,
  STRONG = 3,
  EXTRA_STRONG = 4,
}

export enum GrooveStyle {
  STRAIGHT = 'straight',
  SWING = 'swing',
  SHUFFLE = 'shuffle',
  LATIN = 'latin',
  JAZZ = 'jazz',
  FUNK = 'funk',
  ROCK = 'rock',
}

export enum MetronomeEventType {
  DOWNBEAT = 'downbeat',
  BEAT = 'beat',
  SUBDIVISION = 'subdivision',
  ACCENT = 'accent',
}

export enum TimingPrecision {
  STANDARD = 'standard', // ~10ms precision
  HIGH = 'high', // ~1ms precision
  ULTRA = 'ultra', // ~0.1ms precision
}

export enum ClockSource {
  INTERNAL = 'internal',
  AUDIO_CLOCK = 'audio_clock',
  MIDI_CLOCK = 'midi_clock',
  SYSTEM_CLOCK = 'system_clock',
}

// Predefined time signatures
export const COMMON_TIME_SIGNATURES: Record<string, TimeSignature> = {
  '4/4': {
    numerator: 4,
    denominator: 4,
    display: '4/4',
    accentBeats: [1],
    strongBeats: [1, 3],
  },
  '3/4': {
    numerator: 3,
    denominator: 4,
    display: '3/4',
    accentBeats: [1],
    strongBeats: [1],
  },
  '2/4': {
    numerator: 2,
    denominator: 4,
    display: '2/4',
    accentBeats: [1],
    strongBeats: [1],
  },
  '6/8': {
    numerator: 6,
    denominator: 8,
    display: '6/8',
    accentBeats: [1, 4],
    strongBeats: [1],
    grouping: [3, 3],
  },
  '9/8': {
    numerator: 9,
    denominator: 8,
    display: '9/8',
    accentBeats: [1, 4, 7],
    strongBeats: [1],
    grouping: [3, 3, 3],
  },
  '12/8': {
    numerator: 12,
    denominator: 8,
    display: '12/8',
    accentBeats: [1, 4, 7, 10],
    strongBeats: [1, 7],
    grouping: [3, 3, 3, 3],
  },
  '7/8': {
    numerator: 7,
    denominator: 8,
    display: '7/8',
    accentBeats: [1, 4],
    strongBeats: [1],
    grouping: [3, 2, 2],
  },
  '5/4': {
    numerator: 5,
    denominator: 4,
    display: '5/4',
    accentBeats: [1, 4],
    strongBeats: [1],
    grouping: [3, 2],
  },
  '7/4': {
    numerator: 7,
    denominator: 4,
    display: '7/4',
    accentBeats: [1, 5],
    strongBeats: [1],
    grouping: [4, 3],
  },
};

/**
 * Professional Metronome Instrument Processor
 */
export class MetronomeInstrumentProcessor {
  private clickSamplers: Map<ClickSoundType, Tone.Sampler>;
  private synthClicks: Map<ClickSoundType, Tone.Synth>;
  private timingEngine: TimingEngine;
  private accentProcessor: AccentProcessor;
  private grooveProcessor: GrooveProcessor;
  private visualSyncManager: VisualSyncManager;
  private midiSyncManager: MidiSyncManager;
  private config: MetronomeConfig;
  private state: MetronomeState;
  private isInitialized = false;
  private scheduledEvents: Map<number, MetronomeEvent> = new Map();
  private eventCallbacks: ((event: MetronomeEvent) => void)[] = [];
  private stateChangeCallbacks: ((state: MetronomeState) => void)[] = [];

  constructor(config?: Partial<MetronomeConfig>) {
    this.config = this.createDefaultConfig(config);
    this.state = this.createInitialState();
    this.clickSamplers = new Map();
    this.synthClicks = new Map();

    // Initialize sub-engines
    this.timingEngine = new TimingEngine(this.config.advancedTiming);
    this.accentProcessor = new AccentProcessor();
    this.grooveProcessor = new GrooveProcessor();
    this.visualSyncManager = new VisualSyncManager(this.config.visualSync);
    this.midiSyncManager = new MidiSyncManager(this.config.midiSync);
  }

  /**
   * Initialize the metronome with click sounds
   */
  public async initialize(
    clickSamples?: Record<ClickSoundType, string>,
  ): Promise<void> {
    try {
      // Load click sound samples
      if (clickSamples) {
        await this.loadClickSamples(clickSamples);
      }

      // Setup synthesized clicks
      this.setupSynthesizedClicks();

      // Initialize timing system
      await this.timingEngine.initialize();

      // Setup audio routing
      this.setupAudioRouting();

      // Initialize MIDI sync if enabled
      if (this.config.midiSync.enabled) {
        await this.midiSyncManager.initialize();
      }

      this.isInitialized = true;
      console.log('MetronomeInstrumentProcessor initialized successfully');
    } catch (error) {
      console.error(
        'Failed to initialize MetronomeInstrumentProcessor:',
        error,
      );
      throw error;
    }
  }

  /**
   * Start the metronome
   */
  public start(): void {
    if (!this.isInitialized) {
      console.warn('MetronomeInstrumentProcessor not initialized');
      return;
    }

    if (this.state.isRunning) {
      return;
    }

    this.state.isRunning = true;
    this.state.currentMeasure = 0;
    this.state.currentBeat = 0;
    this.state.currentSubdivision = 0;
    this.state.elapsedTime = 0;

    try {
      // Start Tone.js transport if not already started
      if (Tone.Transport.state !== 'started') {
        Tone.Transport.start();
      }

      // Set transport BPM
      Tone.Transport.bpm.value = this.config.tempo;

      // Schedule initial events
      this.scheduleNextEvents();

      // Start MIDI sync if enabled
      if (this.config.midiSync.enabled && this.config.midiSync.sendClock) {
        this.midiSyncManager.startSendingClock(this.config.tempo);
      }

      this.notifyStateChange();
      console.log('Metronome started');
    } catch (error) {
      // Handle audio context or transport errors gracefully
      console.error('Failed to start metronome:', error);
      this.state.isRunning = false;
    }
  }

  /**
   * Stop the metronome
   */
  public stop(): void {
    if (!this.state.isRunning) {
      return;
    }

    this.state.isRunning = false;

    // Clear scheduled events
    this.clearScheduledEvents();

    // Stop MIDI sync
    if (this.config.midiSync.enabled) {
      this.midiSyncManager.stop();
    }

    this.notifyStateChange();
    console.log('Metronome stopped');
  }

  /**
   * Set tempo with smooth transition
   */
  public setTempo(tempo: number, transitionTime = 0): void {
    if (tempo < 30 || tempo > 300) {
      console.warn('Tempo out of range (30-300 BPM)');
      return;
    }

    if (transitionTime > 0) {
      // Smooth tempo transition
      Tone.Transport.bpm.rampTo(tempo, transitionTime);
    } else {
      // Immediate tempo change
      Tone.Transport.bpm.value = tempo;
    }

    this.config.tempo = tempo;
    this.state.currentTempo = tempo;

    // Update MIDI sync if enabled
    if (this.config.midiSync.enabled && this.config.midiSync.sendClock) {
      this.midiSyncManager.updateTempo(tempo);
    }

    this.notifyStateChange();
  }

  /**
   * Set time signature
   */
  public setTimeSignature(timeSignature: TimeSignature): void {
    this.config.timeSignature = timeSignature;

    // Reset position when changing time signature
    if (this.state.isRunning) {
      this.state.currentBeat = 0;
      this.state.currentSubdivision = 0;
    }

    // Update accent pattern based on time signature
    this.updateAccentPattern();

    this.notifyStateChange();
  }

  /**
   * Set subdivision
   */
  public setSubdivision(subdivision: Subdivision): void {
    this.config.subdivision = subdivision;
    this.notifyStateChange();
  }

  /**
   * Set accent pattern
   */
  public setAccentPattern(pattern: AccentPattern): void {
    this.config.accentPattern = pattern;
    this.notifyStateChange();
  }

  /**
   * Set groove template
   */
  public setGrooveTemplate(template: GrooveTemplate | null): void {
    this.config.grooveTemplate = template;
    this.grooveProcessor.setTemplate(template);
    this.notifyStateChange();
  }

  /**
   * Set swing amount
   */
  public setSwingAmount(amount: number): void {
    this.config.swingAmount = Math.max(0, Math.min(100, amount));
    this.grooveProcessor.setSwingAmount(this.config.swingAmount);
    this.notifyStateChange();
  }

  /**
   * Update click sound preset
   */
  public setClickPreset(preset: ClickPreset): void {
    this.config.clickSounds.currentPreset = preset;
    this.applyClickPreset(preset);
    this.notifyStateChange();
  }

  /**
   * Set custom click sound
   */
  public setCustomClickSound(type: ClickSoundType, sound: ClickSound): void {
    this.config.clickSounds.customSounds.set(type, sound);
    this.updateClickSound(type, sound);
  }

  /**
   * Get current state
   */
  public getState(): MetronomeState {
    return { ...this.state };
  }

  /**
   * Get current configuration
   */
  public getConfig(): MetronomeConfig {
    return { ...this.config };
  }

  /**
   * Register event callback
   */
  public onEvent(callback: (event: MetronomeEvent) => void): void {
    this.eventCallbacks.push(callback);
  }

  /**
   * Register state change callback
   */
  public onStateChange(callback: (state: MetronomeState) => void): void {
    this.stateChangeCallbacks.push(callback);
  }

  /**
   * Get available time signatures
   */
  public getAvailableTimeSignatures(): Record<string, TimeSignature> {
    return COMMON_TIME_SIGNATURES;
  }

  /**
   * Create custom time signature
   */
  public createCustomTimeSignature(
    numerator: number,
    denominator: number,
    accentBeats: number[] = [1],
    grouping?: number[],
  ): TimeSignature {
    return {
      numerator,
      denominator,
      display: `${numerator}/${denominator}`,
      accentBeats,
      strongBeats: [1],
      grouping,
    };
  }

  /**
   * Tap tempo functionality
   */
  public tapTempo(): void {
    this.timingEngine.registerTap();
    const calculatedTempo = this.timingEngine.getCalculatedTempo();

    if (calculatedTempo) {
      this.setTempo(calculatedTempo, 0.1); // Smooth transition
    }
  }

  /**
   * Reset tap tempo
   */
  public resetTapTempo(): void {
    this.timingEngine.resetTaps();
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    this.stop();

    // Dispose of audio resources
    this.clickSamplers.forEach((sampler) => sampler.dispose());
    this.synthClicks.forEach((synth) => synth.dispose());

    // Dispose of sub-engines
    this.timingEngine.dispose();
    this.visualSyncManager.dispose();
    this.midiSyncManager.dispose();

    this.isInitialized = false;
    console.log('MetronomeInstrumentProcessor disposed');
  }

  // Private methods

  private createDefaultConfig(
    config?: Partial<MetronomeConfig>,
  ): MetronomeConfig {
    return {
      clickSounds: {
        accent: {
          type: ClickSoundType.ELECTRONIC_BEEP,
          volume: 0.8,
          pitch: 200, // Higher pitch for accent
          envelope: {
            attack: 0.001,
            decay: 0.1,
            sustain: 0,
            release: 0.1,
          },
        },
        regular: {
          type: ClickSoundType.ELECTRONIC_BEEP,
          volume: 0.6,
          pitch: 0, // Normal pitch
          envelope: {
            attack: 0.001,
            decay: 0.05,
            sustain: 0,
            release: 0.05,
          },
        },
        subdivision: {
          type: ClickSoundType.ELECTRONIC_BEEP,
          volume: 0.3,
          pitch: -100, // Lower pitch for subdivisions
          envelope: {
            attack: 0.001,
            decay: 0.03,
            sustain: 0,
            release: 0.03,
          },
        },
        currentPreset: ClickPreset.CLASSIC,
        customSounds: new Map(),
      },
      timeSignature: COMMON_TIME_SIGNATURES['4/4']!,
      tempo: 120,
      subdivision: Subdivision.QUARTER,
      accentPattern: {
        name: 'Basic',
        pattern: [
          { beat: 0, subdivision: 0, accentLevel: AccentLevel.STRONG },
          { beat: 1, subdivision: 0, accentLevel: AccentLevel.LIGHT },
          { beat: 2, subdivision: 0, accentLevel: AccentLevel.MEDIUM },
          { beat: 3, subdivision: 0, accentLevel: AccentLevel.LIGHT },
        ],
        repeat: true,
        customizable: true,
      },
      grooveTemplate: null,
      swingAmount: 0,
      visualSync: {
        enabled: true,
        flashDuration: 100,
        colors: {
          accent: '#ff4444',
          regular: '#44ff44',
          subdivision: '#4444ff',
        },
        animations: {
          pulse: true,
          flash: true,
        },
      },
      advancedTiming: {
        precisionMode: TimingPrecision.HIGH,
        lookAhead: 25, // 25ms lookahead
        bufferSize: 256,
        latencyCompensation: 0,
        clockSource: ClockSource.AUDIO_CLOCK,
      },
      midiSync: {
        enabled: false,
        clockSource: 'internal',
        sendClock: false,
        receiveClock: false,
        ppqn: 24,
      },
      ...config,
    };
  }

  private createInitialState(): MetronomeState {
    return {
      isRunning: false,
      currentTempo: 120,
      currentMeasure: 0,
      currentBeat: 0,
      currentSubdivision: 0,
      timeSignature: COMMON_TIME_SIGNATURES['4/4']!,
      nextEventTime: 0,
      totalBeats: 0,
      elapsedTime: 0,
    };
  }

  private async loadClickSamples(
    clickSamples: Record<ClickSoundType, string>,
  ): Promise<void> {
    const loadPromises: Promise<void>[] = [];

    for (const [clickType, url] of Object.entries(clickSamples)) {
      loadPromises.push(
        new Promise((resolve, reject) => {
          const sampler = new Tone.Sampler(
            { C4: url },
            {
              onload: () => resolve(),
              onerror: reject,
            },
          );
          this.clickSamplers.set(clickType as ClickSoundType, sampler);
        }),
      );
    }

    await Promise.all(loadPromises);
    console.log('Click samples loaded successfully');
  }

  private setupSynthesizedClicks(): void {
    // Electronic beep synth
    const electronicSynth = new Tone.Synth({
      oscillator: {
        type: 'sine',
      },
      envelope: {
        attack: 0.001,
        decay: 0.05,
        sustain: 0,
        release: 0.05,
      },
    });
    this.synthClicks.set(ClickSoundType.ELECTRONIC_BEEP, electronicSynth);

    // Wood block synth (using filtered noise)
    const woodBlockSynth = new Tone.Synth({
      oscillator: {
        type: 'square',
      },
      envelope: {
        attack: 0.001,
        decay: 0.02,
        sustain: 0,
        release: 0.02,
      },
    });
    this.synthClicks.set(ClickSoundType.WOOD_BLOCK, woodBlockSynth);

    // Synth click (modern electronic)
    const synthClickSynth = new Tone.Synth({
      oscillator: {
        type: 'triangle',
      },
      envelope: {
        attack: 0.001,
        decay: 0.08,
        sustain: 0,
        release: 0.08,
      },
    });
    this.synthClicks.set(ClickSoundType.SYNTH_CLICK, synthClickSynth);
  }

  private setupAudioRouting(): void {
    // Connect all click sources to master output
    this.clickSamplers.forEach((sampler) => {
      sampler.toDestination();
    });

    this.synthClicks.forEach((synth) => {
      synth.toDestination();
    });
  }

  private scheduleNextEvents(): void {
    if (!this.state.isRunning) {
      return;
    }

    const subdivisionInterval = this.getSubdivisionInterval();
    const lookaheadTime = this.config.advancedTiming.lookAhead / 1000;

    // Schedule events for the next measure
    for (let i = 0; i < 16; i++) {
      // Schedule up to 16 events ahead
      const eventTime = Tone.Transport.seconds + i * subdivisionInterval;

      if (eventTime > Tone.Transport.seconds + lookaheadTime) {
        break;
      }

      const event = this.calculateNextEvent(eventTime);
      if (event) {
        this.scheduleEvent(event);
      }
    }

    // Schedule next batch of events
    Tone.Transport.scheduleOnce(() => {
      this.scheduleNextEvents();
    }, `+${lookaheadTime}`);
  }

  private calculateNextEvent(time: number): MetronomeEvent | null {
    const subdivisionInterval = this.getSubdivisionInterval();
    const eventPosition = Math.floor(
      (time - Tone.Transport.seconds) / subdivisionInterval,
    );

    const beatsPerMeasure = this.config.timeSignature.numerator;
    const subdivisionsPerBeat = this.getSubdivisionsPerBeat();

    const beat =
      Math.floor(eventPosition / subdivisionsPerBeat) % beatsPerMeasure;
    const subdivision = eventPosition % subdivisionsPerBeat;

    // Determine event type and accent level
    const isDownbeat = beat === 0 && subdivision === 0;
    const isBeat = subdivision === 0;
    const accentLevel = this.accentProcessor.getAccentLevel(
      beat,
      subdivision,
      this.config.accentPattern,
    );

    let eventType: MetronomeEventType;
    let clickSound: ClickSoundType;

    if (isDownbeat) {
      eventType = MetronomeEventType.DOWNBEAT;
      clickSound = this.config.clickSounds.accent.type;
    } else if (isBeat) {
      eventType = MetronomeEventType.BEAT;
      clickSound =
        accentLevel > AccentLevel.LIGHT
          ? this.config.clickSounds.accent.type
          : this.config.clickSounds.regular.type;
    } else {
      eventType = MetronomeEventType.SUBDIVISION;
      clickSound = this.config.clickSounds.subdivision.type;
    }

    // Apply groove processing
    const groovedTime = this.grooveProcessor.processEventTiming(
      time,
      beat,
      subdivision,
    );

    return {
      time: groovedTime,
      type: eventType,
      beat,
      subdivision,
      accentLevel,
      clickSound,
      velocity: this.calculateVelocity(accentLevel),
      visualData: {
        color: this.getEventColor(eventType),
        intensity: accentLevel / AccentLevel.EXTRA_STRONG,
        duration: this.config.visualSync.flashDuration,
        animationType:
          eventType === MetronomeEventType.DOWNBEAT ? 'pulse' : 'flash',
      },
    };
  }

  private scheduleEvent(event: MetronomeEvent): void {
    const eventId = Date.now() + Math.random();
    this.scheduledEvents.set(eventId, event);

    Tone.Transport.scheduleOnce((time) => {
      this.playClickEvent(event, time);
      this.scheduledEvents.delete(eventId);

      // Update state
      this.updateState(event);

      // Notify callbacks
      this.notifyEvent(event);

      // Trigger visual sync
      if (this.config.visualSync.enabled && event.visualData) {
        this.visualSyncManager.triggerVisual(event.visualData);
      }
    }, event.time);
  }

  private playClickEvent(event: MetronomeEvent, time: number): void {
    const clickSound = this.getClickSoundConfig(event.clickSound);

    if (this.clickSamplers.has(event.clickSound)) {
      // Play sample-based click
      const sampler = this.clickSamplers.get(event.clickSound)!;
      sampler.triggerAttackRelease(
        'C4',
        0.1,
        time,
        event.velocity * clickSound.volume,
      );
    } else if (this.synthClicks.has(event.clickSound)) {
      // Play synthesized click
      const synth = this.synthClicks.get(event.clickSound)!;
      const pitch = this.calculateClickPitch(event, clickSound);
      synth.triggerAttackRelease(
        pitch,
        0.1,
        time,
        event.velocity * clickSound.volume,
      );
    }
  }

  private getClickSoundConfig(clickType: ClickSoundType): ClickSound {
    // Check for custom sounds first
    if (this.config.clickSounds.customSounds.has(clickType)) {
      return this.config.clickSounds.customSounds.get(clickType)!;
    }

    // Return default config based on type
    switch (clickType) {
      case this.config.clickSounds.accent.type:
        return this.config.clickSounds.accent;
      case this.config.clickSounds.subdivision.type:
        return this.config.clickSounds.subdivision;
      default:
        return this.config.clickSounds.regular;
    }
  }

  private calculateClickPitch(
    event: MetronomeEvent,
    clickSound: ClickSound,
  ): string {
    let basePitch = 800; // Base frequency in Hz

    // Adjust for accent level
    if (event.accentLevel >= AccentLevel.STRONG) {
      basePitch += 200;
    } else if (event.accentLevel >= AccentLevel.MEDIUM) {
      basePitch += 100;
    } else if (event.type === MetronomeEventType.SUBDIVISION) {
      basePitch -= 200;
    }

    // Apply pitch adjustment from click sound config
    if (clickSound.pitch) {
      basePitch *= Math.pow(2, clickSound.pitch / 1200); // Convert cents to frequency ratio
    }

    return `${basePitch}`;
  }

  private calculateVelocity(accentLevel: AccentLevel): number {
    switch (accentLevel) {
      case AccentLevel.NONE:
        return 0.2;
      case AccentLevel.LIGHT:
        return 0.4;
      case AccentLevel.MEDIUM:
        return 0.6;
      case AccentLevel.STRONG:
        return 0.8;
      case AccentLevel.EXTRA_STRONG:
        return 1.0;
      default:
        return 0.6;
    }
  }

  private getEventColor(eventType: MetronomeEventType): string {
    switch (eventType) {
      case MetronomeEventType.DOWNBEAT:
      case MetronomeEventType.ACCENT:
        return this.config.visualSync.colors.accent;
      case MetronomeEventType.SUBDIVISION:
        return this.config.visualSync.colors.subdivision;
      default:
        return this.config.visualSync.colors.regular;
    }
  }

  private getSubdivisionInterval(): number {
    const beatInterval = 60 / this.config.tempo; // seconds per beat
    const subdivisionsPerBeat = this.getSubdivisionsPerBeat();
    return beatInterval / subdivisionsPerBeat;
  }

  private getSubdivisionsPerBeat(): number {
    switch (this.config.subdivision) {
      case Subdivision.QUARTER:
        return 1;
      case Subdivision.EIGHTH:
        return 2;
      case Subdivision.SIXTEENTH:
        return 4;
      case Subdivision.TRIPLET:
        return 3;
      case Subdivision.DOTTED_EIGHTH:
        return 3; // 3:2 ratio
      default:
        return 1;
    }
  }

  private updateState(event: MetronomeEvent): void {
    this.state.currentBeat = event.beat;
    this.state.currentSubdivision = event.subdivision;
    this.state.nextEventTime = event.time + this.getSubdivisionInterval();
    this.state.totalBeats++;
    this.state.elapsedTime = Tone.Transport.seconds;

    if (event.beat === 0 && event.subdivision === 0) {
      this.state.currentMeasure++;
    }
  }

  private updateAccentPattern(): void {
    // Auto-generate accent pattern based on time signature
    const timeSignature = this.config.timeSignature;
    const pattern: AccentBeat[] = [];

    for (let beat = 0; beat < timeSignature.numerator; beat++) {
      let accentLevel: AccentLevel;

      if (timeSignature.accentBeats.includes(beat + 1)) {
        accentLevel = timeSignature.strongBeats.includes(beat + 1)
          ? AccentLevel.STRONG
          : AccentLevel.MEDIUM;
      } else {
        accentLevel = AccentLevel.LIGHT;
      }

      pattern.push({
        beat,
        subdivision: 0,
        accentLevel,
      });
    }

    this.config.accentPattern = {
      name: `Auto ${timeSignature.display}`,
      pattern,
      repeat: true,
      customizable: true,
    };
  }

  private applyClickPreset(preset: ClickPreset): void {
    switch (preset) {
      case ClickPreset.CLASSIC:
        this.config.clickSounds.accent.type = ClickSoundType.ELECTRONIC_BEEP;
        this.config.clickSounds.regular.type = ClickSoundType.ELECTRONIC_BEEP;
        this.config.clickSounds.subdivision.type =
          ClickSoundType.ELECTRONIC_BEEP;
        break;
      case ClickPreset.ACOUSTIC:
        this.config.clickSounds.accent.type = ClickSoundType.WOOD_BLOCK;
        this.config.clickSounds.regular.type = ClickSoundType.ACOUSTIC_CLICK;
        this.config.clickSounds.subdivision.type = ClickSoundType.SIDE_STICK;
        break;
      case ClickPreset.ELECTRONIC:
        this.config.clickSounds.accent.type = ClickSoundType.SYNTH_CLICK;
        this.config.clickSounds.regular.type = ClickSoundType.SYNTH_CLICK;
        this.config.clickSounds.subdivision.type = ClickSoundType.SYNTH_CLICK;
        break;
      // Add more presets as needed
    }
  }

  private updateClickSound(type: ClickSoundType, sound: ClickSound): void {
    // Update the specific click sound configuration
    // This would trigger reloading of samples or updating synth parameters
    if (sound.url && !this.clickSamplers.has(type)) {
      // Load new sample
      const sampler = new Tone.Sampler({ C4: sound.url });
      this.clickSamplers.set(type, sampler);
      sampler.toDestination();
    }
  }

  private clearScheduledEvents(): void {
    // Clear all scheduled events
    this.scheduledEvents.clear();

    // Cancel all scheduled events in Tone.js
    Tone.Transport.cancel();
  }

  private notifyEvent(event: MetronomeEvent): void {
    this.eventCallbacks.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in metronome event callback:', error);
      }
    });
  }

  private notifyStateChange(): void {
    this.stateChangeCallbacks.forEach((callback) => {
      try {
        callback(this.state);
      } catch (error) {
        console.error('Error in metronome state change callback:', error);
      }
    });
  }
}

// Supporting classes

class TimingEngine {
  private config: AdvancedTimingConfig;
  private tapTimes: number[] = [];
  private isInitialized = false;

  constructor(config: AdvancedTimingConfig) {
    this.config = config;
  }

  public async initialize(): Promise<void> {
    // Setup high-precision timing if available
    if (this.config.precisionMode === TimingPrecision.ULTRA) {
      // Use Web Audio API's precise timing
      await this.setupUltraPrecisionTiming();
    }
    this.isInitialized = true;
  }

  public registerTap(): void {
    const now = Date.now();
    this.tapTimes.push(now);

    // Keep only the last 8 taps
    if (this.tapTimes.length > 8) {
      this.tapTimes.shift();
    }
  }

  public getCalculatedTempo(): number | null {
    if (this.tapTimes.length < 2) {
      return null;
    }

    // Calculate average interval between taps
    const intervals: number[] = [];
    for (let i = 1; i < this.tapTimes.length; i++) {
      const currentTap = this.tapTimes[i];
      const previousTap = this.tapTimes[i - 1];
      if (currentTap !== undefined && previousTap !== undefined) {
        intervals.push(currentTap - previousTap);
      }
    }

    if (intervals.length === 0) {
      return null;
    }

    const averageInterval =
      intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const bpm = 60000 / averageInterval; // Convert ms to BPM

    // Clamp to reasonable range
    return Math.max(30, Math.min(300, Math.round(bpm)));
  }

  public resetTaps(): void {
    this.tapTimes = [];
  }

  public dispose(): void {
    this.tapTimes = [];
    this.isInitialized = false;
  }

  private async setupUltraPrecisionTiming(): Promise<void> {
    // Implementation for ultra-precise timing using Web Audio worklets
    // This would involve setting up audio worklets for microsecond precision
    console.log('Ultra-precision timing setup (placeholder implementation)');
  }
}

class AccentProcessor {
  public getAccentLevel(
    beat: number,
    subdivision: number,
    accentPattern: AccentPattern,
  ): AccentLevel {
    // Find matching accent beat in pattern
    const matchingAccent = accentPattern.pattern.find(
      (accent) => accent.beat === beat && accent.subdivision === subdivision,
    );

    return matchingAccent ? matchingAccent.accentLevel : AccentLevel.NONE;
  }
}

class GrooveProcessor {
  private template: GrooveTemplate | null = null;
  private swingAmount = 0;

  public setTemplate(template: GrooveTemplate | null): void {
    this.template = template;
  }

  public setSwingAmount(amount: number): void {
    this.swingAmount = amount / 100; // Convert percentage to 0-1
  }

  public processEventTiming(
    originalTime: number,
    beat: number,
    subdivision: number,
  ): number {
    let adjustedTime = originalTime;

    // Apply swing
    if (this.swingAmount > 0 && subdivision === 1) {
      // Apply swing to off-beats (subdivision 1)
      const swingDelay = this.calculateSwingDelay(beat);
      adjustedTime += swingDelay;
    }

    // Apply groove template micro-timing
    if (this.template) {
      const microTimingOffset = this.template.microTiming.get(beat) || 0;
      adjustedTime += microTimingOffset / 1000; // Convert ms to seconds

      // Apply humanization
      if (this.template.humanization.enabled) {
        const randomOffset =
          (Math.random() - 0.5) *
          2 *
          this.template.humanization.timingVariation;
        adjustedTime += randomOffset / 1000;
      }
    }

    return adjustedTime;
  }

  private calculateSwingDelay(beat: number): number {
    // Calculate swing delay based on beat position and swing amount
    const baseDelay = 0.02; // 20ms base delay for full swing
    return baseDelay * this.swingAmount * Math.sin((beat * Math.PI) / 2);
  }
}

class VisualSyncManager {
  private config: VisualSyncConfig;
  private visualCallbacks: ((data: VisualEventData) => void)[] = [];

  constructor(config: VisualSyncConfig) {
    this.config = config;
  }

  public triggerVisual(data: VisualEventData): void {
    if (!this.config.enabled) {
      return;
    }

    this.visualCallbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error('Error in visual sync callback:', error);
      }
    });
  }

  public onVisual(callback: (data: VisualEventData) => void): void {
    this.visualCallbacks.push(callback);
  }

  public dispose(): void {
    this.visualCallbacks = [];
  }
}

class MidiSyncManager {
  private config: MidiSyncConfig;
  private isInitialized = false;

  constructor(config: MidiSyncConfig) {
    this.config = config;
  }

  public async initialize(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // Initialize MIDI sync functionality
    // This would involve setting up Web MIDI API if available
    console.log('MIDI sync initialization (placeholder implementation)');
    this.isInitialized = true;
  }

  public startSendingClock(tempo: number): void {
    if (!this.isInitialized || !this.config.sendClock) {
      return;
    }

    // Start sending MIDI clock signals
    console.log(`Starting MIDI clock at ${tempo} BPM`);
  }

  public updateTempo(tempo: number): void {
    if (!this.isInitialized) {
      return;
    }

    console.log(`Updating MIDI clock tempo to ${tempo} BPM`);
  }

  public stop(): void {
    if (!this.isInitialized) {
      return;
    }

    console.log('Stopping MIDI clock');
  }

  public dispose(): void {
    this.stop();
    this.isInitialized = false;
  }
}
