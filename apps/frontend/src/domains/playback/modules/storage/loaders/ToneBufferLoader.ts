/**
 * ToneBufferLoader - Modern replacement for CachedToneBufferLoader
 *
 * Integrates cached audio buffers with Tone.js, ensuring efficient
 * sample loading and AudioContext compatibility.
 *
 * Features:
 * - AudioContext compatibility checking
 * - Safari MP3 decoding workaround
 * - Persistent context support
 * - URL caching fallback
 * - Detailed load analytics
 */

import type * as ToneTypes from 'tone';
import { GlobalSampleCache } from '../cache/GlobalSampleCache.js';
import { createStructuredLogger } from '../../shared/index.js';

const logger = createStructuredLogger('ToneBufferLoader');

interface LoadResult {
  success: boolean;
  note: string;
  source:
    | 'cached'
    | 'persistent-context'
    | 'network'
    | 'network-after-context-mismatch';
  error?: string;
}

export class ToneBufferLoader {
  /**
   * Load a Tone.Buffer using cached audio buffer if available
   */
  static async loadBuffer(
    url: string,
    plugin?: string,
    Tone?: typeof ToneTypes,
  ): Promise<ToneTypes.ToneAudioBuffer> {
    if (!Tone) {
      throw new Error('Tone.js instance must be provided');
    }

    const startTime = performance.now();
    logger.debug(`Loading buffer for: ${url}`);

    // Check cache first
    const cachedBuffer = GlobalSampleCache.getInstance().getCachedBuffer(url);
    if (cachedBuffer) {
      const loadTime = performance.now() - startTime;
      logger.info(`✅ Using cached buffer for: ${url}`);

      try {
        // Test if buffer is compatible with current context
        const testSource = Tone.context.rawContext.createBufferSource();
        testSource.buffer = cachedBuffer;

        // If we get here, the buffer is compatible
        const toneBuffer = new Tone.ToneAudioBuffer(cachedBuffer);

        // Cache hit logged internally by GlobalSampleCache

        return toneBuffer;
      } catch (error) {
        // Buffer is from a different context, clear and reload
        logger.debug(
          `⚠️ Cached buffer from different AudioContext for: ${url}, clearing and reloading`,
        );
        GlobalSampleCache.getInstance().clearBuffer(url);
      }
    }

    // Fall back to network loading
    logger.warn(
      `⚠️ No cached buffer found for: ${url}, falling back to network`,
    );
    const toneBuffer = new Tone.ToneAudioBuffer(url);
    await toneBuffer.load();
    const loadTime = performance.now() - startTime;

    // Cache miss - loading from network

    return toneBuffer;
  }

  /**
   * Create a Tone.Sampler from cached buffers
   */
  static async createCachedSampler(
    sampleMap: Record<string, string>,
    options?: Partial<ToneTypes.SamplerOptions>,
    plugin?: string,
    Tone?: typeof ToneTypes,
  ): Promise<ToneTypes.Sampler> {
    if (!Tone) {
      throw new Error('Tone.js instance must be provided');
    }

    logger.info(
      'Creating cached sampler with sample map:',
      Object.keys(sampleMap),
    );

    const buffers: Record<string, ToneTypes.ToneAudioBuffer> = {};
    let cachedCount = 0;
    const networkCount = 0;

    // Load all buffers (from cache or network)
    const results = await Promise.allSettled(
      Object.entries(sampleMap).map(async ([note, url]) => {
        const startTime = performance.now();
        try {
          const cachedBuffer =
            GlobalSampleCache.getInstance().getCachedBuffer(url);

          if (cachedBuffer) {
            const loadTime = performance.now() - startTime;
            try {
              // Check if the cached buffer is compatible
              const testSource = Tone.context.rawContext.createBufferSource();
              testSource.buffer = cachedBuffer;

              // If we get here, the buffer is compatible
              const toneBuffer = new Tone.ToneAudioBuffer(cachedBuffer);
              buffers[note] = toneBuffer;
              cachedCount++;
              logger.debug(`✓ Cached: ${note} -> ${url}`);

              // Cache hit logged internally
              return { success: true, note, source: 'cached' } as LoadResult;
            } catch (cacheError) {
              // Check if buffer is from persistent context
              const persistentContext = window.__persistentAudioContext;
              if (
                persistentContext &&
                cachedBuffer.context === persistentContext
              ) {
                logger.debug(
                  `Using cached buffer from persistent context for ${note}`,
                );
                const toneBuffer = new Tone.ToneAudioBuffer(cachedBuffer);
                buffers[note] = toneBuffer;
                cachedCount++;
                return {
                  success: true,
                  note,
                  source: 'persistent-context',
                } as LoadResult;
              } else {
                // Buffer is from a different context, clear and reload
                logger.warn(
                  `⚠️ AudioContext mismatch for ${note}: Cached buffer incompatible, reloading from network`,
                );
                GlobalSampleCache.getInstance().clearBuffer(url);

                // Continue to network loading below
                return await this.loadFromNetwork(
                  note,
                  url,
                  buffers,
                  plugin,
                  Tone,
                  startTime,
                );
              }
            }
          } else {
            // No cached buffer - check if URL is cached
            const cachedUrl = GlobalSampleCache.getInstance().getCachedUrl(url);
            if (cachedUrl && cachedUrl !== url) {
              logger.debug(`🎯 Using CACHED URL for ${note}: ${cachedUrl}`);
            }
            const finalUrl = cachedUrl || url;

            return await this.loadFromNetwork(
              note,
              finalUrl,
              buffers,
              plugin,
              Tone,
              startTime,
            );
          }
        } catch (error: any) {
          logger.error(`❌ Failed to load buffer for ${note} (${url}):`, error);
          return { success: false, note, error: error.message } as LoadResult;
        }
      }),
    );

    // Log results for debugging
    const successful = results.filter(
      (r) => r.status === 'fulfilled' && r.value.success,
    );
    const failed = results.filter(
      (r) =>
        r.status === 'rejected' ||
        (r.status === 'fulfilled' && !r.value.success),
    );

    if (failed.length > 0) {
      logger.warn(
        `🎹 Some buffers failed to load:`,
        failed.map((f) =>
          f.status === 'fulfilled' ? f.value.note : 'unknown',
        ),
      );
    }

    // Log successful loads by source
    const successfulBySource = successful.reduce(
      (acc: Record<string, number>, r: any) => {
        if (r.status === 'fulfilled' && r.value.success) {
          acc[r.value.source] = (acc[r.value.source] || 0) + 1;
        }
        return acc;
      },
      {},
    );

    logger.info(
      `🎹 Sampler created: ${cachedCount} cached, ${networkCount} from network (Total samples: ${
        Object.keys(sampleMap).length
      })`,
    );
    logger.info('🎹 Load sources:', successfulBySource);

    // Check buffer readiness
    const buffersReady = Object.keys(buffers).length;
    const buffersExpected = Object.keys(sampleMap).length;
    logger.info(
      `🎹 Buffer check: ${buffersReady}/${buffersExpected} buffers ready for Tone.Sampler`,
    );

    if (buffersReady === 0) {
      logger.error(
        '🎹 ERROR: No buffers available for Tone.Sampler! This will cause "No available buffers" errors.',
      );
    } else {
      logger.info('🎹 Available buffer notes:', Object.keys(buffers).sort());
    }

    // Create sampler with loaded buffers
    return new Tone.Sampler(buffers, options);
  }

  /**
   * Load a sample from network with Safari workaround
   */
  private static async loadFromNetwork(
    note: string,
    url: string,
    buffers: Record<string, ToneTypes.ToneAudioBuffer>,
    plugin: string | undefined,
    Tone: typeof ToneTypes,
    startTime: number,
  ): Promise<LoadResult> {
    logger.debug(`Loading from network for ${note}: ${url}`);
    let networkCount = 0;

    try {
      // Fetch the audio data with a single retry on transient failure.
      // Sample fetches can fail under flaky network, brief CORS blips, or
      // momentary Supabase 5xx — without retry, one bad request mutes the
      // instrument for the whole session. One backoff retry is enough to
      // recover the vast majority of these without inviting infinite loops.
      const fetchWithRetry = async (): Promise<Response> => {
        try {
          const resp = await fetch(url, { mode: 'cors' });
          if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
          }
          return resp;
        } catch (firstErr) {
          logger.warn(
            `⚠️ First fetch failed for ${note}, retrying after 500ms: ${(firstErr as Error).message}`,
          );
          await new Promise((r) => setTimeout(r, 500));
          const resp = await fetch(url, { mode: 'cors' });
          if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
          }
          return resp;
        }
      };

      const response = await fetchWithRetry();

      const arrayBuffer = await response.arrayBuffer();
      logger.debug(`✓ Fetched ${note}: ${arrayBuffer.byteLength} bytes`);

      // Test native decoding first
      const audioContext = Tone.context.rawContext;
      let audioBuffer: AudioBuffer;

      try {
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        logger.debug(
          `✓ Native decode success for ${note}: ${audioBuffer.duration.toFixed(
            2,
          )}s, ${audioBuffer.numberOfChannels} channels`,
        );
      } catch (decodeError: any) {
        logger.error(`❌ Native decode failed for ${note}:`, {
          error: decodeError.name,
          message: decodeError.message,
          url,
          byteLength: arrayBuffer.byteLength,
          browser: navigator.userAgent,
        });

        // Safari 15+ MP3 decoding issue - try workaround
        if (decodeError.name === 'EncodingError') {
          logger.info(`🔄 Attempting Safari MP3 workaround for ${note}...`);

          try {
            // Try with a fresh copy of the array buffer (uses the same
            // single-retry helper as the primary fetch path above).
            const freshResponse = await fetchWithRetry();
            const freshArrayBuffer = await freshResponse.arrayBuffer();
            audioBuffer = await audioContext.decodeAudioData(freshArrayBuffer);
            logger.info(`✅ Safari workaround succeeded for ${note}`);
          } catch (workaroundError: any) {
            logger.error(
              `❌ Safari workaround also failed for ${note}:`,
              workaroundError,
            );

            // Create a silent buffer as final fallback
            logger.info(`🔇 Creating silent fallback buffer for ${note}`);
            audioBuffer = audioContext.createBuffer(
              2,
              audioContext.sampleRate * 2,
              audioContext.sampleRate,
            );
            // Leave buffer silent (all zeros)
          }
        } else {
          throw decodeError;
        }
      }

      // Create Tone buffer from decoded AudioBuffer
      const buffer = new Tone.ToneAudioBuffer(audioBuffer);
      buffers[note] = buffer;
      const loadTime = performance.now() - startTime;
      networkCount++;
      logger.debug(`✓ Tone.js buffer created for ${note}`);

      // Cache miss - loaded from network

      return { success: true, note, source: 'network' };
    } catch (fetchError: any) {
      logger.error(`❌ Fetch failed for ${note}:`, {
        error: fetchError.name,
        message: fetchError.message,
        url,
      });
      throw fetchError;
    }
  }

  /**
   * Check if all samples for a given mapping are cached
   */
  static areAllSamplesCached(sampleMap: Record<string, string>): boolean {
    // Check if all samples have cached buffers
    const allHaveBuffers = Object.values(sampleMap).every(
      (url) => GlobalSampleCache.getInstance().getCachedBuffer(url) !== null,
    );

    if (allHaveBuffers) {
      return true;
    }

    // If not all have buffers, check if at least URLs are cached
    // This indicates the samples were preloaded but buffers weren't cached
    // due to AudioContext compatibility issues
    const allHaveUrls = Object.values(sampleMap).every((url) => {
      // Check if URL is cached
      const cachedUrl = GlobalSampleCache.getInstance().getCachedUrl(url);
      if (cachedUrl) return true;

      // Also check by path key (InitialSamplePreloader uses path as key)
      // Extract path from full URL
      try {
        const urlObj = new URL(url);
        const path = urlObj.pathname.split('/audio-samples/')[1];
        if (path && GlobalSampleCache.getInstance().getCachedUrl(path)) {
          return true;
        }
      } catch {
        // Invalid URL, skip path check
      }

      return false;
    });

    if (allHaveUrls) {
      logger.debug(
        '🎹 All sample URLs are cached (buffers not cached due to AudioContext)',
      );
    }

    // Return true only if buffers are cached (maintains existing behavior)
    return allHaveBuffers;
  }

  /**
   * Get cache statistics for debugging
   */
  static getCacheStats(): {
    totalCached: number;
    totalUrls: number;
    cacheHitRate: number;
  } {
    const stats = GlobalSampleCache.getInstance().getCacheStats();
    return {
      totalCached: stats.bufferCount,
      totalUrls: stats.urlCount,
      cacheHitRate:
        stats.bufferCount > 0 ? stats.bufferCount / stats.urlCount : 0,
    };
  }
}

// Backward compatibility exports
export { ToneBufferLoader as CachedToneBufferLoader };
export const cachedToneLoader = ToneBufferLoader;
