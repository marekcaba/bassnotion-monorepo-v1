/**
 * Audio Engine Module Types
 *
 * Core types and interfaces for the audio engine module
 */

// Re-export common types from parent domain
export type { TransportState } from '../../../types/audio-operations.js';

/**
 * Audio engine configuration
 */
export interface AudioEngineConfig {
  sampleRate?: number;
  latencyHint?: 'interactive' | 'balanced' | 'playback';
  lookAhead?: number;
  updateInterval?: number;
  maxInitRetries?: number;
  initRetryDelay?: number;
  enableBrowserCheck?: boolean;
  enableValidation?: boolean;
  circuitBreakerConfig?: {
    failureThreshold?: number;
    recoveryTimeout?: number;
    timeout?: number;
    successThreshold?: number;
  };
}

/**
 * Audio context state
 */
export type AudioContextState =
  | 'suspended'
  | 'running'
  | 'closed'
  | 'interrupted';

/**
 * Audio metrics for monitoring
 */
export interface AudioMetrics {
  latency: number;
  sampleRate: number;
  bufferSize: number;
  cpuUsage: number;
  memoryUsage: number;
  dropouts: number;
  bufferUnderruns: number;
}

/**
 * Sampler configuration
 */
export interface SamplerConfig {
  urls?: Record<string, string>;
  baseUrl?: string;
  release?: number;
  attack?: number;
  volume?: number;
  onload?: () => void;
  onerror?: (error: Error) => void;
}

/**
 * Audio sampler interface
 */
export interface AudioSampler {
  triggerAttack(note: string, time?: number, velocity?: number): void;
  triggerRelease(note: string, time?: number): void;
  triggerAttackRelease(
    note: string,
    duration: number,
    time?: number,
    velocity?: number,
  ): void;
  connect(destination: AudioNode | AudioSampler): void;
  disconnect(): void;
  dispose(): void;
}

/**
 * Audio node wrapper interface
 */
export interface AudioNodeWrapper {
  node: AudioNode;
  input: AudioNode;
  output: AudioNode;
  connect(destination: AudioNode | AudioNodeWrapper): void;
  disconnect(): void;
  dispose(): void;
}

/**
 * Effects chain configuration
 */
export interface EffectsConfig {
  reverb?: {
    enabled: boolean;
    wetness: number;
    roomSize: number;
  };
  delay?: {
    enabled: boolean;
    time: number;
    feedback: number;
    wetness: number;
  };
  compressor?: {
    enabled: boolean;
    threshold: number;
    ratio: number;
    attack: number;
    release: number;
  };
}

/**
 * Browser information
 */
export interface BrowserInfo {
  name: string;
  version: number;
  supportsAudioWorklet: boolean;
  supportsWebAudio: boolean;
}

// ============================================================================
// Tone.js Type Definitions
// ============================================================================

/**
 * Base interface for Tone.js audio nodes with common methods
 */
export interface ToneAudioNode {
  connect(destination: ToneAudioNode | AudioNode): this;
  disconnect(): this;
  dispose(): this;
  toDestination(): this;
}

/**
 * Tone.js Gain node
 */
export interface ToneGain extends ToneAudioNode {
  gain: { value: number };
}

/**
 * Tone.js EQ3 (3-band equalizer)
 */
export interface ToneEQ3 extends ToneAudioNode {
  low: { value: number };
  mid: { value: number };
  high: { value: number };
  lowFrequency: { value: number };
  highFrequency: { value: number };
}

/**
 * Tone.js Compressor
 */
export interface ToneCompressor extends ToneAudioNode {
  threshold: { value: number };
  ratio: { value: number };
  attack: { value: number };
  release: { value: number };
  knee: { value: number };
}

/**
 * Tone.js Filter
 */
export interface ToneFilter extends ToneAudioNode {
  frequency: { value: number };
  type: BiquadFilterType;
  Q: { value: number };
  gain: { value: number };
}

/**
 * Tone.js Panner
 */
export interface TonePanner extends ToneAudioNode {
  pan: { value: number };
}

/**
 * Tone.js Volume
 */
export interface ToneVolume extends ToneAudioNode {
  volume: { value: number };
  mute: boolean;
}

/**
 * Tone.js Meter
 */
export interface ToneMeter extends ToneAudioNode {
  getValue(): number | number[];
  normalRange: boolean;
}

/**
 * Tone.js Analyser
 */
export interface ToneAnalyser extends ToneAudioNode {
  getValue(): Float32Array;
  size: number;
  type: 'fft' | 'waveform';
}

/**
 * Tone.js Reverb effect
 */
export interface ToneReverb extends ToneAudioNode {
  decay: number;
  wet: { value: number };
}

/**
 * Tone.js Delay effect
 */
export interface ToneDelay extends ToneAudioNode {
  delayTime: { value: number };
  wet: { value: number };
  feedback: { value: number };
}

/**
 * Tone.js Distortion effect
 */
export interface ToneDistortion extends ToneAudioNode {
  distortion: number;
  wet: { value: number };
}

/**
 * Tone.js Gate effect
 */
export interface ToneGate extends ToneAudioNode {
  threshold: { value: number };
}

/**
 * Tone.js Limiter effect
 */
export interface ToneLimiter extends ToneAudioNode {
  threshold: { value: number };
}

/**
 * Tone.js Synth (basic synthesizer)
 */
export interface ToneSynth extends ToneAudioNode {
  triggerAttack(note: string, time?: number, velocity?: number): this;
  triggerRelease(time?: number): this;
  triggerAttackRelease(
    note: string,
    duration: number | string,
    time?: number,
    velocity?: number,
  ): this;
}

/**
 * Tone.js MonoSynth
 */
export interface ToneMonoSynth extends ToneSynth {
  oscillator: { type: string };
  envelope: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
  };
}

/**
 * Tone.js NoiseSynth
 */
export interface ToneNoiseSynth extends ToneAudioNode {
  triggerAttack(time?: number): this;
  triggerRelease(time?: number): this;
  triggerAttackRelease(duration: number | string, time?: number): this;
  noise: { type: 'white' | 'brown' | 'pink' };
}

/**
 * Tone.js MembraneSynth
 */
export interface ToneMembraneSynth extends ToneSynth {
  pitchDecay: number;
  octaves: number;
}

/**
 * Tone.js Player
 */
export interface TonePlayer extends ToneAudioNode {
  start(time?: number, offset?: number, duration?: number): this;
  stop(time?: number): this;
  loaded: boolean;
  loop: boolean;
  loopStart: number;
  loopEnd: number;
  playbackRate: number;
  buffer: { duration: number };
}

/**
 * Tone.js Oscillator
 */
export interface ToneOscillator extends ToneAudioNode {
  start(time?: number): this;
  stop(time?: number): this;
  frequency: { value: number };
  type: string;
}

/**
 * Tone.js AmplitudeEnvelope
 */
export interface ToneAmplitudeEnvelope extends ToneAudioNode {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  triggerAttack(time?: number, velocity?: number): this;
  triggerRelease(time?: number): this;
}

/**
 * Tone.js Sequence
 */
export interface ToneSequence {
  start(time?: number): this;
  stop(time?: number): this;
  dispose(): this;
  loop: boolean;
  loopStart: number;
  loopEnd: number;
  playbackRate: number;
}

/**
 * Tone.js Sampler instance
 */
export interface ToneSampler extends ToneAudioNode {
  triggerAttack(note: string, time?: number, velocity?: number): this;
  triggerRelease(note: string | string[], time?: number): this;
  triggerAttackRelease(
    note: string | string[],
    duration: number | string,
    time?: number,
    velocity?: number,
  ): this;
  loaded: boolean;
}

/**
 * Tone.js Transport interface
 */
export interface ToneTransport {
  start(time?: number): this;
  stop(time?: number): this;
  pause(time?: number): this;
  toggle(time?: number): this;
  state: 'started' | 'stopped' | 'paused';
  bpm: { value: number };
  position: string;
  seconds: number;
  progress: number;
  loop: boolean;
  loopStart: number | string;
  loopEnd: number | string;
  schedule(callback: (time: number) => void, time: number | string): number;
  scheduleRepeat(
    callback: (time: number) => void,
    interval: number | string,
    startTime?: number | string,
  ): number;
  clear(eventId: number): this;
  cancel(after?: number): this;
  now(): number;
}

/**
 * Tone.js module interface (comprehensive type definition)
 *
 * This interface provides type-safe access to Tone.js functionality.
 * Factory methods return typed instances to avoid `as any` casts.
 */
export interface ToneModule {
  // Core methods
  start(): Promise<void>;
  now(): number;
  setContext(context: AudioContext): void;
  getContext(): AudioContext;
  context: AudioContext;

  // Transport
  Transport: ToneTransport;

  // Sampler constructor
  Sampler: new (config: SamplerConfig) => ToneSampler;

  // Audio node constructors (optional, loaded dynamically)
  Gain?: new (gain?: number) => ToneGain;
  EQ3?: new (
    options?: Partial<{ low: number; mid: number; high: number }>,
  ) => ToneEQ3;
  Compressor?: new (
    options?: Partial<{
      threshold: number;
      ratio: number;
      attack: number;
      release: number;
    }>,
  ) => ToneCompressor;
  Filter?: new (
    frequency?: number,
    type?: BiquadFilterType,
    rolloff?: number,
  ) => ToneFilter;
  Panner?: new (pan?: number) => TonePanner;
  Volume?: new (volume?: number) => ToneVolume;
  Meter?: new (options?: Partial<{ normalRange: boolean }>) => ToneMeter;
  Analyser?: new (type?: 'fft' | 'waveform', size?: number) => ToneAnalyser;
  Reverb?: new (decay?: number) => ToneReverb;
  Delay?: new (delayTime?: number, feedback?: number) => ToneDelay;
  Distortion?: new (distortion?: number) => ToneDistortion;
  Gate?: new (threshold?: number) => ToneGate;
  Limiter?: new (threshold?: number) => ToneLimiter;
  Synth?: new (options?: Record<string, unknown>) => ToneSynth;
  MonoSynth?: new (options?: Record<string, unknown>) => ToneMonoSynth;
  NoiseSynth?: new (options?: Record<string, unknown>) => ToneNoiseSynth;
  MembraneSynth?: new (options?: Record<string, unknown>) => ToneMembraneSynth;
  Player?: new (url?: string | AudioBuffer) => TonePlayer;
  Oscillator?: new (frequency?: number, type?: string) => ToneOscillator;
  AmplitudeEnvelope?: new (
    options?: Partial<{
      attack: number;
      decay: number;
      sustain: number;
      release: number;
    }>,
  ) => ToneAmplitudeEnvelope;
  Sequence?: new (
    callback: (time: number, note: unknown) => void,
    events: unknown[],
    subdivision?: string,
  ) => ToneSequence;

  // Allow dynamic property access for lazy-loaded modules
  [key: string]: unknown;
}
