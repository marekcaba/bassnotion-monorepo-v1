/**
 * BufferFallbackStrategy - Cache fallback logic for missing buffers
 *
 * Extracted from legacy HarmonyScheduler.ts and RegionProcessor (lines 2814-2903)
 * FAANG Compliance: ~140 lines < 600 line limit
 *
 * Responsibilities:
 * - Try GlobalSampleCache when buffer not found in internal map
 * - Handle race condition: user clicks play before preloading completes
 * - Velocity layer fallback: try alternative layers if requested layer missing
 * - Cache key generation for harmony instruments
 *
 * Buffer Resolution Strategy:
 * 1. Check internal buffer map (fastest)
 * 2. Fallback to GlobalSampleCache (handles preloading race)
 * 3. Try alternative velocity layers (v5 → v4 → v3 → v2 → v1)
 * 4. Return null if all strategies fail
 *
 * Usage:
 * ```typescript
 * const buffer = BufferFallbackStrategy.resolveBuffer(
 *   bufferMap,
 *   'grandpiano',
 *   'v3',
 *   'A4'
 * );
 * ```
 */

import { createStructuredLogger } from '../../../modules/shared/index.js';
import { GlobalSampleCache } from '../../../modules/storage/cache/GlobalSampleCache.js';

const logger = createStructuredLogger('BufferFallbackStrategy');

/**
 * Buffer resolution result
 */
export interface BufferResolutionResult {
  /** Resolved AudioBuffer (or null if not found) */
  buffer: AudioBuffer | null;

  /** Layer actually used (may differ from requested if fallback occurred) */
  layerUsed: string;

  /** Resolution source */
  source: 'internal-map' | 'global-cache' | 'fallback-layer' | 'not-found';

  /** Cache key used (if applicable) */
  cacheKey?: string;
}

/**
 * BufferFallbackStrategy - Resolves missing buffers using cache and layer fallback
 */
export class BufferFallbackStrategy {
  /**
   * Resolve buffer with fallback strategies
   *
   * Strategy:
   * 1. Check internal buffer map (primary source)
   * 2. Try GlobalSampleCache (handles race condition)
   * 3. Try alternative velocity layers (highest to lowest)
   * 4. Return null if all strategies fail
   *
   * @param bufferMap - Internal buffer map (Map<layer, Map<note, AudioBuffer>>)
   * @param instrument - Harmony instrument (grandpiano, wurlitzer, rhodes)
   * @param requestedLayer - Requested velocity layer (e.g., 'v3')
   * @param noteName - Note name (e.g., 'A4', 'Cs5')
   * @returns Buffer resolution result
   */
  public static resolveBuffer(
    bufferMap: Map<string, Map<string, AudioBuffer>>,
    instrument: string,
    requestedLayer: string,
    noteName: string,
  ): BufferResolutionResult {
    // STRATEGY 1: Check internal buffer map
    let buffer = bufferMap.get(requestedLayer)?.get(noteName);

    if (buffer) {
      logger.debug('Buffer found in internal map', {
        layer: requestedLayer,
        note: noteName,
      });
      return {
        buffer,
        layerUsed: requestedLayer,
        source: 'internal-map',
      };
    }

    // STRATEGY 2: Try GlobalSampleCache (handles preloading race)
    const cacheKey = this.buildCacheKey(instrument, requestedLayer, noteName);
    buffer = GlobalSampleCache.getCachedBuffer(cacheKey);

    if (buffer) {
      logger.info('Buffer found in GlobalSampleCache', {
        cacheKey,
        layer: requestedLayer,
        note: noteName,
      });
      return {
        buffer,
        layerUsed: requestedLayer,
        source: 'global-cache',
        cacheKey,
      };
    }

    // STRATEGY 3: Try alternative velocity layers (highest to lowest)
    const fallbackResult = this.tryFallbackLayers(
      bufferMap,
      instrument,
      requestedLayer,
      noteName,
    );

    if (fallbackResult.buffer) {
      logger.warn('Buffer found in fallback layer', {
        requestedLayer,
        actualLayer: fallbackResult.layerUsed,
        note: noteName,
      });
      return fallbackResult;
    }

    // STRATEGY 4: All strategies failed
    logger.error('Buffer not found after all fallback strategies', {
      instrument,
      layer: requestedLayer,
      note: noteName,
      cacheKey,
    });

    return {
      buffer: null,
      layerUsed: requestedLayer,
      source: 'not-found',
      cacheKey,
    };
  }

  /**
   * Try alternative velocity layers as fallback
   *
   * Strategy: Try all available layers from highest to lowest velocity
   * Skips the requested layer (already tried)
   *
   * @private
   */
  private static tryFallbackLayers(
    bufferMap: Map<string, Map<string, AudioBuffer>>,
    instrument: string,
    requestedLayer: string,
    noteName: string,
  ): BufferResolutionResult {
    const allLayers = Array.from(bufferMap.keys());

    // Sort layers by velocity: highest to lowest (v10 → v9 → ... → v1)
    const sortedLayers = allLayers
      .filter((layer) => layer !== requestedLayer) // Skip requested layer
      .sort((a, b) => {
        const aNum = parseInt(a.substring(1), 10); // Extract number from 'v3' → 3
        const bNum = parseInt(b.substring(1), 10);
        return bNum - aNum; // Descending order
      });

    // Try each fallback layer
    for (const layer of sortedLayers) {
      // Try internal buffer map first
      let buffer = bufferMap.get(layer)?.get(noteName);

      // If not in map, try GlobalSampleCache
      if (!buffer) {
        const cacheKey = this.buildCacheKey(instrument, layer, noteName);
        buffer = GlobalSampleCache.getCachedBuffer(cacheKey);

        if (buffer) {
          return {
            buffer,
            layerUsed: layer,
            source: 'global-cache',
            cacheKey,
          };
        }
      } else {
        return {
          buffer,
          layerUsed: layer,
          source: 'fallback-layer',
        };
      }
    }

    // No fallback layer found
    return {
      buffer: null,
      layerUsed: requestedLayer,
      source: 'not-found',
    };
  }

  /**
   * Build cache key for GlobalSampleCache lookup
   *
   * Format: "{instrument}-{layer}-{note}"
   * Example: "grandpiano-v3-A4", "wurlitzer-v2-Cs5"
   *
   * @param instrument - Harmony instrument name
   * @param layer - Velocity layer (e.g., 'v3')
   * @param noteName - Note name (e.g., 'A4')
   * @returns Cache key string
   */
  public static buildCacheKey(
    instrument: string,
    layer: string,
    noteName: string,
  ): string {
    return `${instrument}-${layer}-${noteName}`;
  }

  /**
   * Get available buffer layers from buffer map
   *
   * Utility method for diagnostics and testing
   *
   * @param bufferMap - Internal buffer map
   * @returns Array of available layer names
   */
  public static getAvailableLayers(
    bufferMap: Map<string, Map<string, AudioBuffer>>,
  ): string[] {
    return Array.from(bufferMap.keys());
  }
}
