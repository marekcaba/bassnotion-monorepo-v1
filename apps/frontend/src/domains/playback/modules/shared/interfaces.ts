/**
 * Core Module Interfaces
 *
 * Defines the contracts between playback modules to ensure
 * clean architecture and clear boundaries.
 */

import type { AudioBuffer, AudioContext } from 'standardized-audio-context';
import type * as Tone from 'tone';

// ============================================================================
// Transport → Audio Engine Interface
// ============================================================================

export interface ITransportAudioSync {
  /** Get the current audio context time */
  getCurrentTime(): number;

  /** Schedule a callback at a specific audio time */
  scheduleAtTime(callback: () => void, time: number): void;

  /** Get latency compensation offset */
  getLatencyOffset(): number;
}

// ============================================================================
// Audio Engine → All Modules Interface
// ============================================================================

export interface IAudioEngineProvider {
  /** Get the audio context (Web Audio or Tone.js) */
  getContext(): AudioContext | Tone.BaseContext;

  /** Create an audio node */
  createNode(type: string, options?: any): any;

  /** Connect audio nodes */
  connect(source: any, destination: any): void;

  /** Get master output */
  getMasterOutput(): any;
}

// ============================================================================
// Storage → Instruments Interface
// ============================================================================

export interface ISampleProvider {
  /** Load a sample by URL */
  loadSample(url: string, options?: any): Promise<AudioBuffer>;

  /** Get cached sample if available */
  getCachedSample(id: string): AudioBuffer | null;

  /** Preload samples for an instrument */
  preloadInstrumentSamples(instrumentId: string, urls: string[]): Promise<void>;
}

// ============================================================================
// Instruments → Tracks Interface
// ============================================================================

export interface IInstrumentInstance {
  /** Unique identifier */
  id: string;

  /** Instrument type */
  type: 'bass' | 'drums' | 'harmony' | 'metronome';

  /** Connect to audio destination */
  connect(destination: any): void;

  /** Trigger a note/event */
  trigger(event: any): void;

  /** Release resources */
  dispose(): void;
}

// ============================================================================
// Tracks → Transport Interface
// ============================================================================

export interface ITrackTransportSync {
  /** Register a track with the transport */
  registerTrack(trackId: string, track: any): void;

  /** Schedule track events */
  scheduleTrackEvents(trackId: string, events: any[], startTime: number): void;

  /** Get current position for a track */
  getTrackPosition(trackId: string): any;
}

// ============================================================================
// Cross-Module Event Interface
// ============================================================================

export interface IModuleEventEmitter {
  /** Emit an event to other modules */
  emit(event: string, data: any): void;

  /** Listen for events from other modules */
  on(event: string, handler: (data: any) => void): void;

  /** Remove event listener */
  off(event: string, handler: (data: any) => void): void;
}

// ============================================================================
// Module Lifecycle Interface
// ============================================================================

export interface IModule {
  /** Module name */
  name: string;

  /** Initialize the module */
  initialize(): Promise<void>;

  /** Cleanup resources */
  dispose(): Promise<void>;

  /** Health check */
  isHealthy(): boolean;
}

// ============================================================================
// Module Registry Interface
// ============================================================================

export interface IModuleRegistry {
  /** Register a module */
  registerModule(name: string, module: IModule): void;

  /** Get a module by name */
  getModule<T extends IModule>(name: string): T | null;

  /** Check if module is registered */
  hasModule(name: string): boolean;

  /** Initialize all modules */
  initializeAll(): Promise<void>;

  /** Dispose all modules */
  disposeAll(): Promise<void>;
}

// ============================================================================
// Performance Monitoring Interface
// ============================================================================

export interface IPerformanceMonitor {
  /** Start a performance measurement */
  startMeasure(name: string): void;

  /** End a performance measurement */
  endMeasure(name: string): number;

  /** Get performance metrics */
  getMetrics(): Record<string, any>;
}

// ============================================================================
// Error Handling Interface
// ============================================================================

export interface IErrorHandler {
  /** Handle an error */
  handleError(error: Error, context?: any): void;

  /** Register error recovery strategy */
  registerRecovery(errorType: string, recovery: () => void): void;
}
