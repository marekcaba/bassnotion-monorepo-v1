/**
 * Track Entity
 *
 * Rich domain model for a track in the playback system.
 * Encapsulates track business logic and rules.
 */

import { TrackId, Volume, Pan } from '../value-objects/index.js';
import type { InstrumentType } from '../../modules/tracks/management/TrackManagerProcessor.js';
import { TrackState } from '../../types/track.js';

export interface TrackEntityProps {
  id: TrackId;
  name: string;
  instrumentType: InstrumentType;
  volume: Volume;
  pan: Pan;
  isMuted: boolean;
  isSolo: boolean;
  isRecordArmed: boolean;
  color: string;
  index: number;
  createdAt: Date;
  updatedAt: Date;
}

export class TrackEntity {
  private constructor(
    private props: TrackEntityProps,
    private _state: TrackState = TrackState.UNINITIALIZED,
  ) {}

  /**
   * Create a new track
   */
  static create(
    id: TrackId,
    name: string,
    instrumentType: InstrumentType,
    index: number,
    color?: string,
  ): TrackEntity {
    if (!name || name.trim().length === 0) {
      throw new Error('Track name cannot be empty');
    }

    if (index < 0) {
      throw new Error('Track index must be non-negative');
    }

    const now = new Date();
    return new TrackEntity({
      id,
      name: name.trim(),
      instrumentType,
      volume: Volume.default(),
      pan: Pan.center(),
      isMuted: false,
      isSolo: false,
      isRecordArmed: false,
      color: color || this.generateColor(),
      index,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Reconstitute a track from persisted data
   */
  static reconstitute(props: TrackEntityProps, state: TrackState): TrackEntity {
    return new TrackEntity(props, state);
  }

  // Getters
  get id(): TrackId {
    return this.props.id;
  }
  get name(): string {
    return this.props.name;
  }
  get instrumentType(): InstrumentType {
    return this.props.instrumentType;
  }
  get volume(): Volume {
    return this.props.volume;
  }
  get pan(): Pan {
    return this.props.pan;
  }
  get isMuted(): boolean {
    return this.props.isMuted;
  }
  get isSolo(): boolean {
    return this.props.isSolo;
  }
  get isRecordArmed(): boolean {
    return this.props.isRecordArmed;
  }
  get color(): string {
    return this.props.color;
  }
  get index(): number {
    return this.props.index;
  }
  get state(): TrackState {
    return this._state;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /**
   * Business Logic Methods
   */

  /**
   * Check if track can produce audio
   */
  canProduceAudio(): boolean {
    return (
      !this.isMuted &&
      !this.volume.isMuted() &&
      this._state !== TrackState.ERROR &&
      this._state !== TrackState.DISPOSING
    );
  }

  /**
   * Check if track is ready for playback
   */
  isReadyForPlayback(): boolean {
    return (
      this._state === TrackState.READY ||
      this._state === TrackState.PLAYING ||
      this._state === TrackState.PAUSED ||
      this._state === TrackState.STOPPED
    );
  }

  /**
   * Check if track needs initialization
   */
  needsInitialization(): boolean {
    return this._state === TrackState.UNINITIALIZED;
  }

  /**
   * Check if track is in error state
   */
  hasError(): boolean {
    return this._state === TrackState.ERROR;
  }

  /**
   * Check if track is currently playing
   */
  isPlaying(): boolean {
    return this._state === TrackState.PLAYING;
  }

  /**
   * Check if track can be recorded
   */
  canRecord(): boolean {
    return this.isRecordArmed && this.isReadyForPlayback();
  }

  /**
   * Check if track is a metronome track
   */
  isMetronome(): boolean {
    return this.instrumentType === 'metronome';
  }

  /**
   * Check if track is a drum track
   */
  isDrumTrack(): boolean {
    return this.instrumentType === 'drums';
  }

  /**
   * Check if track is a bass track
   */
  isBassTrack(): boolean {
    return this.instrumentType === 'bass';
  }

  /**
   * Get effective volume (considering mute state)
   */
  getEffectiveVolume(): Volume {
    if (this.isMuted || !this.canProduceAudio()) {
      return Volume.silence();
    }
    return this.volume;
  }

  /**
   * Mutation Methods
   */

  /**
   * Update track name
   */
  updateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error('Track name cannot be empty');
    }

    if (name === this.props.name) return;

    this.props.name = name.trim();
    this.props.updatedAt = new Date();
  }

  /**
   * Update track volume
   */
  setVolume(volume: Volume): void {
    if (volume.equals(this.props.volume)) return;

    this.props.volume = volume;
    this.props.updatedAt = new Date();
  }

  /**
   * Update track pan
   */
  setPan(pan: Pan): void {
    if (pan.equals(this.props.pan)) return;

    this.props.pan = pan;
    this.props.updatedAt = new Date();
  }

  /**
   * Toggle mute state
   */
  toggleMute(): void {
    this.props.isMuted = !this.props.isMuted;
    this.props.updatedAt = new Date();
  }

  /**
   * Set mute state
   */
  setMuted(muted: boolean): void {
    if (muted === this.props.isMuted) return;

    this.props.isMuted = muted;
    this.props.updatedAt = new Date();
  }

  /**
   * Toggle solo state
   */
  toggleSolo(): void {
    this.props.isSolo = !this.props.isSolo;
    this.props.updatedAt = new Date();
  }

  /**
   * Set solo state
   */
  setSolo(solo: boolean): void {
    if (solo === this.props.isSolo) return;

    this.props.isSolo = solo;
    this.props.updatedAt = new Date();
  }

  /**
   * Toggle record arm state
   */
  toggleRecordArm(): void {
    this.props.isRecordArmed = !this.props.isRecordArmed;
    this.props.updatedAt = new Date();
  }

  /**
   * Set record arm state
   */
  setRecordArmed(armed: boolean): void {
    if (armed === this.props.isRecordArmed) return;

    this.props.isRecordArmed = armed;
    this.props.updatedAt = new Date();
  }

  /**
   * Update track color
   */
  setColor(color: string): void {
    if (!color || color === this.props.color) return;

    this.props.color = color;
    this.props.updatedAt = new Date();
  }

  /**
   * Update track index (position)
   */
  setIndex(index: number): void {
    if (index < 0) {
      throw new Error('Track index must be non-negative');
    }

    if (index === this.props.index) return;

    this.props.index = index;
    this.props.updatedAt = new Date();
  }

  /**
   * Update track state
   */
  setState(state: TrackState): void {
    if (state === this._state) return;

    // Validate state transitions
    if (
      this._state === TrackState.DISPOSING &&
      state !== TrackState.UNINITIALIZED
    ) {
      throw new Error('Cannot change state from DISPOSING');
    }

    this._state = state;
    this.props.updatedAt = new Date();
  }

  /**
   * Reset track to initial settings
   */
  reset(): void {
    this.props.volume = Volume.default();
    this.props.pan = Pan.center();
    this.props.isMuted = false;
    this.props.isSolo = false;
    this.props.isRecordArmed = false;
    this._state = TrackState.READY;
    this.props.updatedAt = new Date();
  }

  /**
   * Convert to persistence format
   */
  toPersistence(): TrackEntityProps & { state: TrackState } {
    return {
      ...this.props,
      state: this._state,
    };
  }

  /**
   * Generate a random color for the track
   */
  private static generateColor(): string {
    const colors = [
      '#FF6B6B',
      '#4ECDC4',
      '#45B7D1',
      '#FFA07A',
      '#98D8C8',
      '#F7DC6F',
      '#BB8FCE',
      '#85C1F2',
      '#F8B195',
      '#F67280',
      '#C06C84',
      '#6C5CE7',
    ];
    return colors[Math.floor(Math.random() * colors.length)] || '#FF6B6B';
  }

  /**
   * Clone the track entity with a new ID
   */
  clone(newId: TrackId): TrackEntity {
    return new TrackEntity(
      {
        ...this.props,
        id: newId,
        name: `${this.props.name} (Copy)`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      TrackState.UNINITIALIZED,
    );
  }
}
