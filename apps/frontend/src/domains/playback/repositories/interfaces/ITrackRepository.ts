/**
 * Track Repository Interface
 *
 * Defines the contract for track data access operations
 */

import { TrackId } from '../value-objects/index.js';
import { TrackEntity } from '../entities/index.js';

export interface ITrackRepository {
  /**
   * Find a track by ID
   */
  findById(id: TrackId): Promise<TrackEntity | null>;

  /**
   * Find all tracks
   */
  findAll(): Promise<TrackEntity[]>;

  /**
   * Find tracks by instrument type
   */
  findByInstrumentType(type: string): Promise<TrackEntity[]>;

  /**
   * Save a track (create or update)
   */
  save(track: TrackEntity): Promise<void>;

  /**
   * Delete a track
   */
  delete(id: TrackId): Promise<void>;

  /**
   * Delete all tracks
   */
  deleteAll(): Promise<void>;

  /**
   * Check if a track exists
   */
  exists(id: TrackId): Promise<boolean>;

  /**
   * Get track count
   */
  count(): Promise<number>;
}
