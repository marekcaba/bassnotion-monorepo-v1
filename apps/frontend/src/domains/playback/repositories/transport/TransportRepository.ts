/**
 * Transport Repository Implementation
 *
 * Provides local storage persistence for transport state
 */

import { ITransportRepository } from '../interfaces/ITransportRepository.js';
import { TransportState } from '../entities/index.js';
import { Tempo } from '../value-objects/index.js';
import type {
  PlaybackState,
  TimeSignature,
  TransportPosition,
} from '../entities/index.js';
import { createStructuredLogger } from '../../modules/shared/index.js';

const logger = createStructuredLogger('TransportRepository');

const STORAGE_KEY = 'bassnotion_transport_state';

interface StoredTransportState {
  playbackState: PlaybackState;
  tempo: number;
  timeSignature: TimeSignature;
  position: TransportPosition;
  isLooping: boolean;
  loopStart?: TransportPosition;
  loopEnd?: TransportPosition;
  isRecording: boolean;
  isMetronomeEnabled: boolean;
  isCountInEnabled: boolean;
  countInBars: number;
  updatedAt: string;
}

export class TransportRepository implements ITransportRepository {
  /**
   * Get the current transport state
   *
   * CRITICAL FIX: Always return initial state to ensure countdown starts at -1:1:1
   * Previous behavior: Restored persisted position from localStorage, causing random
   * start positions (5:3:1, 3:1:1, 1:3:1) instead of always -1:1:1 for countdown
   */
  async get(): Promise<TransportState> {
    return TransportState.createInitial();
  }

  /**
   * Save the transport state
   */
  async save(state: TransportState): Promise<void> {
    const stored = this.toStorage(state);
    await this.saveTransportState(stored);
  }

  /**
   * Reset to default transport state
   */
  async reset(): Promise<void> {
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Check if transport state exists
   */
  async exists(): Promise<boolean> {
    return localStorage.getItem(STORAGE_KEY) !== null;
  }

  /**
   * Load transport state from storage
   */
  private async loadTransportState(): Promise<StoredTransportState | null> {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        return null;
      }

      const parsed = JSON.parse(data);
      return parsed;
    } catch (error) {
      logger.error(
        'Failed to load transport state from storage',
        error as Error,
      );
      return null;
    }
  }

  /**
   * Save transport state to storage
   */
  private async saveTransportState(state: StoredTransportState): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      logger.error('Failed to save transport state to storage', error as Error);
      throw new Error('Failed to save transport state');
    }
  }

  /**
   * Convert entity to storage format
   */
  private toStorage(state: TransportState): StoredTransportState {
    const persistence = state.toPersistence();
    return {
      playbackState: persistence.playbackState,
      tempo: persistence.tempo.value,
      timeSignature: persistence.timeSignature,
      position: persistence.position,
      isLooping: persistence.isLooping,
      loopStart: persistence.loopStart,
      loopEnd: persistence.loopEnd,
      isRecording: persistence.isRecording,
      isMetronomeEnabled: persistence.isMetronomeEnabled,
      isCountInEnabled: persistence.isCountInEnabled,
      countInBars: persistence.countInBars,
      updatedAt: persistence.updatedAt.toISOString(),
    };
  }

  /**
   * Convert storage format to entity
   */
  private fromStorage(stored: StoredTransportState): TransportState {
    return TransportState.reconstitute({
      playbackState: stored.playbackState,
      tempo: Tempo.create(stored.tempo),
      timeSignature: stored.timeSignature,
      position: stored.position,
      isLooping: stored.isLooping,
      loopStart: stored.loopStart,
      loopEnd: stored.loopEnd,
      isRecording: stored.isRecording,
      isMetronomeEnabled: stored.isMetronomeEnabled,
      isCountInEnabled: stored.isCountInEnabled,
      countInBars: stored.countInBars,
      updatedAt: new Date(stored.updatedAt),
    });
  }
}
