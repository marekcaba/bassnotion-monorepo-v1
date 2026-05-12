/**
 * Track Repository Implementation
 *
 * Provides local storage persistence for track data.
 * This is the base implementation that saves to localStorage.
 */

import { ITrackRepository } from '../interfaces/ITrackRepository.js';
import { TrackId, Volume, Pan } from '../value-objects/index.js';
import { TrackEntity } from '../entities/index.js';
import type { TrackState } from '../../types/track.js';
import type { InstrumentType } from '../../modules/shared/index.js';
import { createStructuredLogger } from '../../modules/shared/index.js';

const logger = createStructuredLogger('TrackRepository');

const STORAGE_KEY = 'bassnotion_tracks';

interface StoredTrack {
  id: string;
  name: string;
  instrumentType: string;
  volume: number;
  pan: number;
  isMuted: boolean;
  isSolo: boolean;
  isRecordArmed: boolean;
  color: string;
  index: number;
  state: TrackState;
  createdAt: string;
  updatedAt: string;
}

export class TrackRepository implements ITrackRepository {
  /**
   * Find a track by ID
   */
  async findById(id: TrackId): Promise<TrackEntity | null> {
    const tracks = await this.loadTracks();
    const stored = tracks.find((t) => t.id === id.value);

    if (!stored) {
      return null;
    }

    return this.fromStorage(stored);
  }

  /**
   * Find all tracks
   */
  async findAll(): Promise<TrackEntity[]> {
    const tracks = await this.loadTracks();
    return tracks
      .sort((a, b) => a.index - b.index)
      .map((stored) => this.fromStorage(stored));
  }

  /**
   * Find tracks by instrument type
   */
  async findByInstrumentType(type: string): Promise<TrackEntity[]> {
    const tracks = await this.loadTracks();
    return tracks
      .filter((t) => t.instrumentType === type)
      .sort((a, b) => a.index - b.index)
      .map((stored) => this.fromStorage(stored));
  }

  /**
   * Save a track (create or update)
   */
  async save(track: TrackEntity): Promise<void> {
    const tracks = await this.loadTracks();
    const stored = this.toStorage(track);

    const existingIndex = tracks.findIndex((t) => t.id === stored.id);
    if (existingIndex >= 0) {
      tracks[existingIndex] = stored;
    } else {
      tracks.push(stored);
    }

    await this.saveTracks(tracks);
  }

  /**
   * Delete a track
   */
  async delete(id: TrackId): Promise<void> {
    const tracks = await this.loadTracks();
    const filtered = tracks.filter((t) => t.id !== id.value);

    if (filtered.length === tracks.length) {
      throw new Error(`Track ${id.value} not found`);
    }

    await this.saveTracks(filtered);
  }

  /**
   * Delete all tracks
   */
  async deleteAll(): Promise<void> {
    await this.saveTracks([]);
  }

  /**
   * Check if a track exists
   */
  async exists(id: TrackId): Promise<boolean> {
    const tracks = await this.loadTracks();
    return tracks.some((t) => t.id === id.value);
  }

  /**
   * Get track count
   */
  async count(): Promise<number> {
    const tracks = await this.loadTracks();
    return tracks.length;
  }

  /**
   * Load tracks from storage
   */
  private async loadTracks(): Promise<StoredTrack[]> {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        return [];
      }

      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      logger.error('Failed to load tracks from storage', error as Error);
      return [];
    }
  }

  /**
   * Save tracks to storage
   */
  private async saveTracks(tracks: StoredTrack[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tracks));
    } catch (error) {
      logger.error('Failed to save tracks to storage', error as Error);
      throw new Error('Failed to save tracks');
    }
  }

  /**
   * Convert entity to storage format
   */
  private toStorage(track: TrackEntity): StoredTrack {
    const persistence = track.toPersistence();
    return {
      id: persistence.id.value,
      name: persistence.name,
      instrumentType: persistence.instrumentType,
      volume: persistence.volume.value,
      pan: persistence.pan.value,
      isMuted: persistence.isMuted,
      isSolo: persistence.isSolo,
      isRecordArmed: persistence.isRecordArmed,
      color: persistence.color,
      index: persistence.index,
      state: persistence.state,
      createdAt: persistence.createdAt.toISOString(),
      updatedAt: persistence.updatedAt.toISOString(),
    };
  }

  /**
   * Convert storage format to entity
   */
  private fromStorage(stored: StoredTrack): TrackEntity {
    return TrackEntity.reconstitute(
      {
        id: TrackId.create(stored.id),
        name: stored.name,
        instrumentType: stored.instrumentType as InstrumentType,
        volume: Volume.create(stored.volume),
        pan: Pan.create(stored.pan),
        isMuted: stored.isMuted,
        isSolo: stored.isSolo,
        isRecordArmed: stored.isRecordArmed,
        color: stored.color,
        index: stored.index,
        createdAt: new Date(stored.createdAt),
        updatedAt: new Date(stored.updatedAt),
      },
      stored.state,
    );
  }
}
