/**
 * Result Track Repository
 *
 * Adds error handling with Result pattern to track repository
 */

import { ITrackRepository } from '../interfaces/ITrackRepository.js';
import { TrackId } from '../value-objects/index.js';
import { TrackEntity } from '../entities/index.js';
import { Result } from '@/shared/patterns/result.js';
import { createStructuredLogger } from '../../modules/shared/index.js';

const logger = createStructuredLogger('ResultTrackRepository');

export class ResultTrackRepository implements ITrackRepository {
  constructor(private repository: ITrackRepository) {}

  /**
   * Find a track by ID
   */
  async findById(id: TrackId): Promise<TrackEntity | null> {
    try {
      const result = await this.repository.findById(id);
      return result;
    } catch (error) {
      logger.error('Failed to find track by ID', error as Error, {
        trackId: id.value,
      });
      throw this.createError('Failed to find track', error);
    }
  }

  /**
   * Find all tracks
   */
  async findAll(): Promise<TrackEntity[]> {
    try {
      const result = await this.repository.findAll();
      return result;
    } catch (error) {
      logger.error('Failed to find all tracks', error as Error);
      throw this.createError('Failed to load tracks', error);
    }
  }

  /**
   * Find tracks by instrument type
   */
  async findByInstrumentType(type: string): Promise<TrackEntity[]> {
    try {
      const result = await this.repository.findByInstrumentType(type);
      return result;
    } catch (error) {
      logger.error('Failed to find tracks by type', error as Error, {
        instrumentType: type,
      });
      throw this.createError('Failed to find tracks by instrument type', error);
    }
  }

  /**
   * Save a track with Result pattern
   */
  async saveWithResult(track: TrackEntity): Promise<Result<void>> {
    try {
      await this.repository.save(track);
      return Result.ok(undefined);
    } catch (error) {
      logger.error('Failed to save track', error as Error, {
        trackId: track.id.value,
      });
      return Result.fail(
        this.createError('Failed to save track', error).message,
      );
    }
  }

  /**
   * Save a track (throws on error for interface compatibility)
   */
  async save(track: TrackEntity): Promise<void> {
    const result = await this.saveWithResult(track);
    if (result.isFailure) {
      throw new Error(result.error);
    }
  }

  /**
   * Delete a track with Result pattern
   */
  async deleteWithResult(id: TrackId): Promise<Result<void>> {
    try {
      await this.repository.delete(id);
      return Result.ok(undefined);
    } catch (error) {
      logger.error('Failed to delete track', error as Error, {
        trackId: id.value,
      });
      return Result.fail(
        this.createError('Failed to delete track', error).message,
      );
    }
  }

  /**
   * Delete a track (throws on error for interface compatibility)
   */
  async delete(id: TrackId): Promise<void> {
    const result = await this.deleteWithResult(id);
    if (result.isFailure) {
      throw new Error(result.error);
    }
  }

  /**
   * Delete all tracks with Result pattern
   */
  async deleteAllWithResult(): Promise<Result<void>> {
    try {
      await this.repository.deleteAll();
      return Result.ok(undefined);
    } catch (error) {
      logger.error('Failed to delete all tracks', error as Error);
      return Result.fail(
        this.createError('Failed to delete all tracks', error).message,
      );
    }
  }

  /**
   * Delete all tracks (throws on error for interface compatibility)
   */
  async deleteAll(): Promise<void> {
    const result = await this.deleteAllWithResult();
    if (result.isFailure) {
      throw new Error(result.error);
    }
  }

  /**
   * Check if a track exists
   */
  async exists(id: TrackId): Promise<boolean> {
    try {
      const result = await this.repository.exists(id);
      return result;
    } catch (error) {
      logger.error('Failed to check track existence', error as Error, {
        trackId: id.value,
      });
      throw this.createError('Failed to check track existence', error);
    }
  }

  /**
   * Get track count
   */
  async count(): Promise<number> {
    try {
      const result = await this.repository.count();
      return result;
    } catch (error) {
      logger.error('Failed to get track count', error as Error);
      throw this.createError('Failed to get track count', error);
    }
  }

  /**
   * Create a user-friendly error
   */
  private createError(message: string, originalError: unknown): Error {
    const error = new Error(message);
    if (originalError instanceof Error) {
      error.cause = originalError;
    }
    return error;
  }
}
