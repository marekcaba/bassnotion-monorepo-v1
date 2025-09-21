/**
 * Transport State Entity
 *
 * Represents the current state of the transport system (play/pause/stop, position, etc).
 * Encapsulates transport control logic.
 */

import { Tempo } from '../value-objects/index.js';

export type PlaybackState = 'stopped' | 'playing' | 'paused' | 'recording';

export interface TimeSignature {
  numerator: number;
  denominator: number;
}

export interface TransportPosition {
  bars: number;
  beats: number;
  sixteenths: number;
  ticks: number;
  timeInSeconds: number;
}

export interface TransportStateProps {
  playbackState: PlaybackState;
  tempo: Tempo;
  timeSignature: TimeSignature;
  position: TransportPosition;
  isLooping: boolean;
  loopStart?: TransportPosition;
  loopEnd?: TransportPosition;
  isRecording: boolean;
  isMetronomeEnabled: boolean;
  isCountInEnabled: boolean;
  countInBars: number;
  updatedAt: Date;
}

export class TransportState {
  private constructor(private props: TransportStateProps) {}

  /**
   * Create initial transport state
   */
  static createInitial(): TransportState {
    return new TransportState({
      playbackState: 'stopped',
      tempo: Tempo.create(120),
      timeSignature: { numerator: 4, denominator: 4 },
      position: {
        bars: 0,
        beats: 0,
        sixteenths: 0,
        ticks: 0,
        timeInSeconds: 0,
      },
      isLooping: false,
      isRecording: false,
      isMetronomeEnabled: false,
      isCountInEnabled: false,
      countInBars: 1,
      updatedAt: new Date(),
    });
  }

  /**
   * Reconstitute from persistence
   */
  static reconstitute(props: TransportStateProps): TransportState {
    return new TransportState(props);
  }

  // Getters
  get playbackState(): PlaybackState {
    return this.props.playbackState;
  }
  get tempo(): Tempo {
    return this.props.tempo;
  }
  get timeSignature(): TimeSignature {
    return { ...this.props.timeSignature };
  }
  get position(): TransportPosition {
    return { ...this.props.position };
  }
  get isLooping(): boolean {
    return this.props.isLooping;
  }
  get loopStart(): TransportPosition | undefined {
    return this.props.loopStart ? { ...this.props.loopStart } : undefined;
  }
  get loopEnd(): TransportPosition | undefined {
    return this.props.loopEnd ? { ...this.props.loopEnd } : undefined;
  }
  get isRecording(): boolean {
    return this.props.isRecording;
  }
  get isMetronomeEnabled(): boolean {
    return this.props.isMetronomeEnabled;
  }
  get isCountInEnabled(): boolean {
    return this.props.isCountInEnabled;
  }
  get countInBars(): number {
    return this.props.countInBars;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /**
   * Business Logic Methods
   */

  /**
   * Check if transport is playing
   */
  isPlaying(): boolean {
    return (
      this.playbackState === 'playing' || this.playbackState === 'recording'
    );
  }

  /**
   * Check if transport is stopped
   */
  isStopped(): boolean {
    return this.playbackState === 'stopped';
  }

  /**
   * Check if transport is paused
   */
  isPaused(): boolean {
    return this.playbackState === 'paused';
  }

  /**
   * Check if transport can start playing
   */
  canStart(): boolean {
    return this.playbackState === 'stopped' || this.playbackState === 'paused';
  }

  /**
   * Check if transport can stop
   */
  canStop(): boolean {
    return this.playbackState !== 'stopped';
  }

  /**
   * Check if transport can pause
   */
  canPause(): boolean {
    return (
      this.playbackState === 'playing' || this.playbackState === 'recording'
    );
  }

  /**
   * Check if transport can record
   */
  canRecord(): boolean {
    return this.playbackState === 'stopped' || this.playbackState === 'playing';
  }

  /**
   * Check if position is at start
   */
  isAtStart(): boolean {
    const pos = this.position;
    return (
      pos.bars === 0 &&
      pos.beats === 0 &&
      pos.sixteenths === 0 &&
      pos.ticks === 0
    );
  }

  /**
   * Check if position is within loop range
   */
  isInLoopRange(): boolean {
    if (!this.isLooping || !this.loopStart || !this.loopEnd) {
      return false;
    }

    const currentTime = this.position.timeInSeconds;
    const loopStartTime = this.loopStart.timeInSeconds;
    const loopEndTime = this.loopEnd.timeInSeconds;

    return currentTime >= loopStartTime && currentTime < loopEndTime;
  }

  /**
   * Get the duration of one bar in seconds
   */
  getBarDurationSeconds(): number {
    const beatsPerBar = this.timeSignature.numerator;
    const beatDuration = this.tempo.getBeatDurationMs() / 1000;
    return beatsPerBar * beatDuration;
  }

  /**
   * Get position as a formatted string (bars:beats:sixteenths)
   */
  getPositionString(): string {
    const pos = this.position;
    return `${pos.bars + 1}:${pos.beats + 1}:${pos.sixteenths + 1}`;
  }

  /**
   * Get time as formatted string (mm:ss.ms)
   */
  getTimeString(): string {
    const totalSeconds = this.position.timeInSeconds;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const ms = Math.floor((totalSeconds % 1) * 100);

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }

  /**
   * Mutation Methods
   */

  /**
   * Start playback
   */
  start(): void {
    if (!this.canStart()) {
      throw new Error(`Cannot start from ${this.playbackState} state`);
    }

    this.props.playbackState = this.isRecording ? 'recording' : 'playing';
    this.props.updatedAt = new Date();
  }

  /**
   * Stop playback and reset position
   */
  stop(): void {
    if (!this.canStop()) return;

    this.props.playbackState = 'stopped';
    this.props.isRecording = false;
    this.props.position = {
      bars: 0,
      beats: 0,
      sixteenths: 0,
      ticks: 0,
      timeInSeconds: 0,
    };
    this.props.updatedAt = new Date();
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (!this.canPause()) {
      throw new Error(`Cannot pause from ${this.playbackState} state`);
    }

    this.props.playbackState = 'paused';
    this.props.updatedAt = new Date();
  }

  /**
   * Enable recording
   */
  enableRecording(): void {
    if (!this.canRecord()) {
      throw new Error(`Cannot record from ${this.playbackState} state`);
    }

    this.props.isRecording = true;
    if (this.playbackState === 'playing') {
      this.props.playbackState = 'recording';
    }
    this.props.updatedAt = new Date();
  }

  /**
   * Disable recording
   */
  disableRecording(): void {
    this.props.isRecording = false;
    if (this.playbackState === 'recording') {
      this.props.playbackState = 'playing';
    }
    this.props.updatedAt = new Date();
  }

  /**
   * Update tempo
   */
  setTempo(tempo: Tempo): void {
    if (tempo.equals(this.props.tempo)) return;

    this.props.tempo = tempo;
    this.props.updatedAt = new Date();
  }

  /**
   * Update time signature
   */
  setTimeSignature(numerator: number, denominator: number): void {
    if (numerator < 1 || denominator < 1) {
      throw new Error('Time signature values must be positive');
    }

    if (!Number.isInteger(numerator) || !Number.isInteger(denominator)) {
      throw new Error('Time signature values must be integers');
    }

    if (
      numerator === this.props.timeSignature.numerator &&
      denominator === this.props.timeSignature.denominator
    ) {
      return;
    }

    this.props.timeSignature = { numerator, denominator };
    this.props.updatedAt = new Date();
  }

  /**
   * Update position
   */
  updatePosition(position: TransportPosition): void {
    this.props.position = { ...position };
    this.props.updatedAt = new Date();

    // Check if we need to loop
    if (
      this.isLooping &&
      this.loopEnd &&
      position.timeInSeconds >= this.loopEnd.timeInSeconds
    ) {
      this.props.position = this.loopStart
        ? { ...this.loopStart }
        : {
            bars: 0,
            beats: 0,
            sixteenths: 0,
            ticks: 0,
            timeInSeconds: 0,
          };
    }
  }

  /**
   * Enable/disable looping
   */
  setLooping(enabled: boolean): void {
    if (enabled === this.props.isLooping) return;

    this.props.isLooping = enabled;
    if (!enabled) {
      this.props.loopStart = undefined;
      this.props.loopEnd = undefined;
    }
    this.props.updatedAt = new Date();
  }

  /**
   * Set loop range
   */
  setLoopRange(start: TransportPosition, end: TransportPosition): void {
    if (start.timeInSeconds >= end.timeInSeconds) {
      throw new Error('Loop start must be before loop end');
    }

    this.props.loopStart = { ...start };
    this.props.loopEnd = { ...end };
    this.props.isLooping = true;
    this.props.updatedAt = new Date();
  }

  /**
   * Toggle metronome
   */
  toggleMetronome(): void {
    this.props.isMetronomeEnabled = !this.props.isMetronomeEnabled;
    this.props.updatedAt = new Date();
  }

  /**
   * Set metronome state
   */
  setMetronomeEnabled(enabled: boolean): void {
    if (enabled !== this.props.isMetronomeEnabled) {
      this.props.isMetronomeEnabled = enabled;
      this.props.updatedAt = new Date();
    }
  }

  /**
   * Set count-in
   */
  setCountIn(enabled: boolean, bars = 1): void {
    if (bars < 0 || bars > 4) {
      throw new Error('Count-in bars must be between 0 and 4');
    }

    this.props.isCountInEnabled = enabled;
    this.props.countInBars = bars;
    this.props.updatedAt = new Date();
  }

  /**
   * Convert to persistence format
   */
  toPersistence(): TransportStateProps {
    return { ...this.props };
  }
}
