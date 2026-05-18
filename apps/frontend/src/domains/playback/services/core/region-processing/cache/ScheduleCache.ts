/**
 * ScheduleCache - Manages per-exercise schedule caching for performance optimization
 *
 * Caches pre-calculated event schedules and CC64 timelines to avoid
 * recalculating on every playback. Different tempos and countdown settings
 * create separate cache entries. Implements LRU eviction.
 */

import { getLogger } from '@/utils/logger.js';
import type { CachedSchedule } from '../types/region.types.js';

// Helper to get Tone from window (must be initialized before ScheduleCache is used)
function getTone(): NonNullable<typeof window.Tone> {
  if (typeof window !== 'undefined') {
    // Check both locations where Tone.js may be stored
    const tone = window.Tone || window.__globalTone;
    if (tone) {
      return tone;
    }
  }
  throw new Error(
    'ScheduleCache: Tone.js not loaded. Ensure AudioEngine is initialized first.',
  );
}

const logger = getLogger('ScheduleCache');

export class ScheduleCache {
  private exerciseScheduleCache = new Map<string, CachedSchedule>();
  private readonly MAX_CACHE_ENTRIES = 50; // LRU eviction threshold
  private countdownOffsetBeats = 0; // Will be set by RegionProcessor

  constructor() {
    // Empty constructor
  }

  /**
   * Set the current countdown offset (for cache key generation)
   */
  setCountdownOffsetBeats(beats: number): void {
    this.countdownOffsetBeats = beats;
  }

  /**
   * Generate cache key from exercise ID, BPM, and countdown beats
   */
  private generateCacheKey(
    exerciseId: string,
    bpm: number,
    countdownBeats: number,
  ): string {
    return `${exerciseId}_${bpm}_${countdownBeats}`;
  }

  /**
   * Get cached schedule for an exercise if available
   * Returns null if not cached or if cache parameters don't match
   *
   * @param exerciseId - Unique exercise identifier
   * @returns Cached schedule or null
   */
  get(exerciseId: string): CachedSchedule | null {
    const Tone = getTone();
    const currentBpm = Tone.getTransport().bpm.value;
    const cacheKey = this.generateCacheKey(
      exerciseId,
      currentBpm,
      this.countdownOffsetBeats,
    );

    const cached = this.exerciseScheduleCache.get(cacheKey);

    if (cached) {
      logger.info(`♻️ CACHE HIT for exercise ${exerciseId}`, {
        cacheKey,
        cachedAt: new Date(cached.cachedAt).toISOString(),
        eventCount: cached.calculatedEvents.length,
        cc64EventCount: cached.cc64Timeline.size,
      });
      return cached;
    }

    logger.info(`❌ CACHE MISS for exercise ${exerciseId}`, { cacheKey });
    return null;
  }

  /**
   * Cache schedule for an exercise
   * Stores CC64 timeline and calculated event schedule for fast retrieval
   * Implements LRU eviction if cache grows too large
   *
   * @param exerciseId - Unique exercise identifier
   * @param schedule - Schedule data to cache
   */
  set(exerciseId: string, schedule: CachedSchedule): void {
    const cacheKey = this.generateCacheKey(
      exerciseId,
      schedule.bpm,
      schedule.countdownBeats,
    );

    // LRU eviction: If cache is full, remove oldest entry
    if (this.exerciseScheduleCache.size >= this.MAX_CACHE_ENTRIES) {
      const oldestKey = this.exerciseScheduleCache.keys().next().value;
      this.exerciseScheduleCache.delete(oldestKey);
      logger.info(`🗑️ LRU eviction: Removed oldest cache entry ${oldestKey}`);
    }

    this.exerciseScheduleCache.set(cacheKey, schedule);

    logger.info(`💾 CACHED schedule for exercise ${exerciseId}`, {
      cacheKey,
      eventCount: schedule.calculatedEvents.length,
      cc64EventCount: schedule.cc64Timeline.size,
      estimatedSizeKB: Math.round(JSON.stringify(schedule).length / 1024),
      totalCacheEntries: this.exerciseScheduleCache.size,
    });
  }

  /**
   * Clear cache for a specific exercise (e.g., when BPM changes)
   *
   * @param exerciseId - Exercise to clear cache for
   */
  clear(exerciseId: string): void {
    // Clear all cache entries for this exercise (across different BPM/countdown settings)
    const keysToDelete: string[] = [];

    this.exerciseScheduleCache.forEach((_, key) => {
      if (key.startsWith(`${exerciseId}_`)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.exerciseScheduleCache.delete(key));

    if (keysToDelete.length > 0) {
      logger.info(
        `🗑️ Cleared ${keysToDelete.length} cache entries for exercise ${exerciseId}`,
      );
    }
  }

  /**
   * Clear all cached schedules
   */
  clearAll(): void {
    const entriesCount = this.exerciseScheduleCache.size;
    this.exerciseScheduleCache.clear();
    if (entriesCount > 0) {
      logger.info(`🗑️ Cleared all ${entriesCount} cache entries`);
    }
  }

  /**
   * Get cache statistics for debugging
   */
  getStats() {
    return {
      size: this.exerciseScheduleCache.size,
      maxEntries: this.MAX_CACHE_ENTRIES,
      keys: Array.from(this.exerciseScheduleCache.keys()),
    };
  }
}
