/**
 * Cached Track Repository
 *
 * Adds in-memory caching layer to track repository
 */

import { ITrackRepository } from '../interfaces/ITrackRepository.js';
import { TrackId } from '../value-objects/index.js';
import { TrackEntity } from '../entities/index.js';

export class CachedTrackRepository implements ITrackRepository {
  private cache = new Map<string, TrackEntity>();
  private allTracksCache: TrackEntity[] | null = null;
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes
  private lastCacheUpdate = 0;

  constructor(private repository: ITrackRepository) {}

  /**
   * Find a track by ID
   */
  async findById(id: TrackId): Promise<TrackEntity | null> {
    // Check cache first
    const cached = this.cache.get(id.value);
    if (cached && this.isCacheValid()) {
      return cached;
    }

    // Load from repository
    const track = await this.repository.findById(id);
    if (track) {
      this.cache.set(id.value, track);
      this.lastCacheUpdate = Date.now();
    }

    return track;
  }

  /**
   * Find all tracks
   */
  async findAll(): Promise<TrackEntity[]> {
    // Check cache first
    if (this.allTracksCache && this.isCacheValid()) {
      return [...this.allTracksCache];
    }

    // Load from repository
    const tracks = await this.repository.findAll();

    // Update cache
    this.allTracksCache = tracks;
    tracks.forEach((track) => {
      this.cache.set(track.id.value, track);
    });
    this.lastCacheUpdate = Date.now();

    return [...tracks];
  }

  /**
   * Find tracks by instrument type
   */
  async findByInstrumentType(type: string): Promise<TrackEntity[]> {
    // Use cached tracks if available
    if (this.allTracksCache && this.isCacheValid()) {
      return this.allTracksCache.filter(
        (track) => track.instrumentType === type,
      );
    }

    // Otherwise load from repository
    const tracks = await this.repository.findByInstrumentType(type);

    // Update individual cache entries
    tracks.forEach((track) => {
      this.cache.set(track.id.value, track);
    });

    return tracks;
  }

  /**
   * Save a track (create or update)
   */
  async save(track: TrackEntity): Promise<void> {
    await this.repository.save(track);

    // Update cache
    this.cache.set(track.id.value, track);

    // Invalidate all tracks cache as it might be outdated
    this.allTracksCache = null;
  }

  /**
   * Delete a track
   */
  async delete(id: TrackId): Promise<void> {
    await this.repository.delete(id);

    // Remove from cache
    this.cache.delete(id.value);

    // Invalidate all tracks cache
    this.allTracksCache = null;
  }

  /**
   * Delete all tracks
   */
  async deleteAll(): Promise<void> {
    await this.repository.deleteAll();

    // Clear cache
    this.cache.clear();
    this.allTracksCache = null;
  }

  /**
   * Check if a track exists
   */
  async exists(id: TrackId): Promise<boolean> {
    // Check cache first
    if (this.cache.has(id.value) && this.isCacheValid()) {
      return true;
    }

    return this.repository.exists(id);
  }

  /**
   * Get track count
   */
  async count(): Promise<number> {
    // Use cached count if available
    if (this.allTracksCache && this.isCacheValid()) {
      return this.allTracksCache.length;
    }

    return this.repository.count();
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
    this.allTracksCache = null;
    this.lastCacheUpdate = 0;
  }

  /**
   * Set cache expiry time
   */
  setCacheExpiry(milliseconds: number): void {
    this.cacheExpiry = milliseconds;
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    return Date.now() - this.lastCacheUpdate < this.cacheExpiry;
  }
}
