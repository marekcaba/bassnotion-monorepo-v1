/**
 * Base Instrument Interface
 * 
 * Defines the contract that all instrument implementations must follow.
 * This interface ensures compatibility with the track system and AudioEventRouter.
 */

import type { InstrumentType } from '../../../services/plugins/TrackManagerProcessor.js';

export interface InstrumentConfig {
  /** Unique identifier for the instrument instance */
  id?: string;
  /** Type of instrument */
  type: InstrumentType;
  /** Human-readable name */
  name: string;
  /** Volume level (0-1) */
  volume?: number;
  /** Pan position (-1 to 1) */
  pan?: number;
  /** Whether the instrument is muted */
  muted?: boolean;
  /** Custom configuration specific to instrument type */
  customConfig?: Record<string, any>;
}

export interface InstrumentEvent {
  /** Time in the audio context when the event should occur */
  audioTime: number;
  /** Timestamp for logging/debugging */
  timestamp: number;
  /** Velocity/volume for the event (0-1) */
  velocity?: number;
  /** Duration of the event */
  duration?: string | number;
  /** Additional event-specific data */
  data?: Record<string, any>;
}

export interface InstrumentMetrics {
  /** CPU usage percentage */
  cpuUsage: number;
  /** Memory usage in MB */
  memoryUsage: number;
  /** Number of active voices */
  voiceCount: number;
  /** Latency in milliseconds */
  latency: number;
  /** Last update timestamp */
  lastUpdate: number;
}

export interface InstrumentState {
  /** Whether the instrument is initialized */
  isInitialized: boolean;
  /** Whether the instrument is currently playing */
  isPlaying: boolean;
  /** Whether the instrument is loading samples */
  isLoading: boolean;
  /** Current error state if any */
  error?: string;
}

/**
 * Base instrument interface that all instruments must implement
 */
export interface Instrument {
  /** Unique identifier */
  readonly id: string;
  /** Instrument type */
  readonly type: InstrumentType;
  /** Display name */
  name: string;
  /** Current state */
  readonly state: InstrumentState;

  /**
   * Initialize the instrument with any required resources
   * @param context - Optional initialization context
   */
  initialize(context?: any): Promise<void>;

  /**
   * Trigger a sound/note on the instrument
   * @param event - The event to trigger
   */
  trigger(event: InstrumentEvent): void;

  /**
   * Stop a currently playing sound/note
   * @param noteId - Identifier for the note to stop
   * @param time - When to stop the note
   */
  stop?(noteId: string | number, time?: number): void;

  /**
   * Update instrument parameters
   * @param params - Parameters to update
   */
  updateParams(params: Partial<InstrumentConfig>): void;

  /**
   * Get current performance metrics
   */
  getMetrics(): InstrumentMetrics;

  /**
   * Clean up and release resources
   */
  dispose(): Promise<void>;

  /**
   * Set volume (0-1)
   */
  setVolume(volume: number): void;

  /**
   * Set pan position (-1 to 1)
   */
  setPan(pan: number): void;

  /**
   * Mute/unmute the instrument
   */
  setMuted(muted: boolean): void;

  /**
   * Connect to audio destination
   */
  connect(destination: any): void;

  /**
   * Disconnect from audio destination
   */
  disconnect(): void;
}

/**
 * Base class providing common functionality for instruments
 */
export abstract class BaseInstrument implements Instrument {
  public readonly id: string;
  public readonly type: InstrumentType;
  public name: string;
  protected _state: InstrumentState;
  protected _volume: number = 0.75;
  protected _pan: number = 0;
  protected _muted: boolean = false;
  protected _destination: any = null;

  constructor(config: InstrumentConfig) {
    this.id = config.id || this.generateId();
    this.type = config.type;
    this.name = config.name;
    this._volume = config.volume ?? 0.75;
    this._pan = config.pan ?? 0;
    this._muted = config.muted ?? false;
    
    this._state = {
      isInitialized: false,
      isPlaying: false,
      isLoading: false,
    };
  }

  get state(): InstrumentState {
    return { ...this._state };
  }

  abstract initialize(context?: any): Promise<void>;
  abstract trigger(event: InstrumentEvent): void;
  abstract updateParams(params: Partial<InstrumentConfig>): void;
  abstract dispose(): Promise<void>;
  abstract connect(destination: any): void;
  abstract disconnect(): void;

  setVolume(volume: number): void {
    this._volume = Math.max(0, Math.min(1, volume));
    this.applyVolume();
  }

  setPan(pan: number): void {
    this._pan = Math.max(-1, Math.min(1, pan));
    this.applyPan();
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    this.applyMute();
  }

  getMetrics(): InstrumentMetrics {
    return {
      cpuUsage: 0,
      memoryUsage: 0,
      voiceCount: 0,
      latency: 0,
      lastUpdate: Date.now(),
    };
  }

  protected abstract applyVolume(): void;
  protected abstract applyPan(): void;
  protected abstract applyMute(): void;

  private generateId(): string {
    return `${this.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}