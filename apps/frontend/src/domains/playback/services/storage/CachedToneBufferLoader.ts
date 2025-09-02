import * as Tone from 'tone';
import { createStructuredLogger } from '@bassnotion/contracts';
import { GlobalSampleCache } from './GlobalSampleCache';
import { getLogger } from '@/utils/logger.js';
import { cacheMonitor } from '../monitoring/CacheMonitor.js';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

const logger = getLogger('cached-tone-buffer-loader');

/**
 * CachedToneBufferLoader - Integrates cached audio buffers with Tone.js
 *
 * This class ensures that Tone.js uses pre-cached audio buffers instead
 * of re-downloading samples from the network, enabling instant playback.
 *
 * IMPORTANT: AudioBuffers can only be used within the same AudioContext
 * they were decoded with. Buffers decoded with OfflineAudioContext or
 * a different AudioContext cannot be used with Tone.js's AudioContext.
 */
export class CachedToneBufferLoader {
  /**
   * Load a Tone.Buffer using cached audio buffer if available
   * @param url - The URL of the audio file
   * @param plugin - Optional plugin name for tracking
   * @returns Promise resolving to a ToneAudioBuffer
   */
  static async loadBuffer(
    url: string,
    plugin?: string,
  ): Promise<Tone.ToneAudioBuffer> {
    const startTime = performance.now();
    logger.debug(`Loading buffer for: ${url}`);

    // Check cache first
    const cachedBuffer = GlobalSampleCache.getCachedBuffer(url);
    if (cachedBuffer) {
      const loadTime = performance.now() - startTime;
      logger.info(`✅ Using cached buffer for: ${url}`);

      try {
        // Check if the cached buffer is from a different AudioContext
        // by attempting to create a simple buffer source
        const testSource = Tone.context.rawContext.createBufferSource();
        testSource.buffer = cachedBuffer;

        // If we get here, the buffer is compatible
        const toneBuffer = new Tone.ToneAudioBuffer(cachedBuffer);

        // Record cache hit
        cacheMonitor.recordLoad({
          url,
          fromCache: true,
          loadTime,
          plugin,
          context: 'CachedToneBufferLoader.loadBuffer',
        });

        return toneBuffer;
      } catch (error) {
        // Buffer is from a different context, remove it from cache
        logger.debug(
          `⚠️ Cached buffer from different AudioContext for: ${url}, clearing and reloading`,
        );
        GlobalSampleCache.clearBuffer(url);
        // Continue to network loading below
      }
    }

    // Fall back to network loading
    logger.warn(
      `⚠️ No cached buffer found for: ${url}, falling back to network`,
    );
    const toneBuffer = new Tone.ToneAudioBuffer(url);
    await toneBuffer.load();
    const loadTime = performance.now() - startTime;

    // Record cache miss
    cacheMonitor.recordLoad({
      url,
      fromCache: false,
      loadTime,
      plugin,
      context: 'CachedToneBufferLoader.loadBuffer',
    });

    return toneBuffer;
  }

  /**
   * Create a Tone.Sampler from cached buffers
   * @param sampleMap - Map of notes to sample URLs
   * @param options - Additional sampler options
   * @param plugin - Optional plugin name for tracking
   * @returns Promise resolving to a configured Tone.Sampler
   */
  static async createCachedSampler(
    sampleMap: Record<string, string>,
    options?: Partial<Tone.SamplerOptions>,
    plugin?: string,
  ): Promise<Tone.Sampler> {
    logger.info(
      'Creating cached sampler with sample map:',
      Object.keys(sampleMap),
    );

    const buffers: Record<string, Tone.ToneAudioBuffer> = {};
    let cachedCount = 0;
    let networkCount = 0;

    // Load all buffers (from cache or network)
    const results = await Promise.allSettled(
      Object.entries(sampleMap).map(async ([note, url]) => {
        const startTime = performance.now();
        try {
          const cachedBuffer = GlobalSampleCache.getCachedBuffer(url);

          if (cachedBuffer) {
            const loadTime = performance.now() - startTime;
            try {
              // Check if the cached buffer is from a different AudioContext
              const testSource = Tone.context.rawContext.createBufferSource();
              testSource.buffer = cachedBuffer;

              // If we get here, the buffer is compatible
              const toneBuffer = new Tone.ToneAudioBuffer(cachedBuffer);
              buffers[note] = toneBuffer;
              cachedCount++;
              logger.debug(`✓ Cached: ${note} -> ${url}`);

              // Record cache hit
              cacheMonitor.recordLoad({
                url,
                fromCache: true,
                loadTime,
                plugin,
                context: 'CachedToneBufferLoader.createCachedSampler',
              });
              return { success: true, note, source: 'cached' };
            } catch (cacheError) {
              // Buffer is from a different context, check if it's persistent context
              const persistentContext = (window as any).__persistentAudioContext;
              if (persistentContext && cachedBuffer.context === persistentContext) {
                // This is from our persistent context, should be safe
                logger.debug(`Using cached buffer from persistent context for ${note}`);
                const toneBuffer = new Tone.ToneAudioBuffer(cachedBuffer);
                buffers[note] = toneBuffer;
                cachedCount++;
                return { success: true, note, source: 'persistent-context' };
              } else {
                // Buffer is truly from a different context, clear it and reload
                logger.warn(
                  `⚠️ AudioContext mismatch for ${note}: Cached buffer incompatible, reloading from network`,
                );
                logger.debug(
                  `⚠️ Cached buffer from different AudioContext for ${url}, clearing and reloading`,
                );
                GlobalSampleCache.clearBuffer(url);

                const buffer = new Tone.ToneAudioBuffer(url);
                await buffer.load();
                buffers[note] = buffer;
                const networkLoadTime = performance.now() - startTime;
                networkCount++;

                // Record cache miss due to context mismatch
                cacheMonitor.recordLoad({
                  url,
                  fromCache: false,
                  loadTime: networkLoadTime,
                  plugin,
                  context:
                    'CachedToneBufferLoader.createCachedSampler (context mismatch)',
                });
                return { success: true, note, source: 'network-after-context-mismatch' };
              }
            }
          } else {
            // No cached buffer - check if URL is cached and load from network
            const cachedUrl = GlobalSampleCache.getCachedUrl(url);
            if (cachedUrl && cachedUrl !== url) {
              logger.debug(`🎯 Using CACHED URL for ${note}: ${cachedUrl}`);
            } else {
              logger.debug(`❌ NO cached URL for ${note}, loading fresh from: ${url}`);
            }
            const finalUrl = cachedUrl || url;
            logger.debug(`Loading from network for ${note}: ${finalUrl}`);
            
            // Try loading with native Web Audio API first to test decoding
            try {
              const response = await fetch(finalUrl, { mode: 'cors' });
              if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
              }
              
              const arrayBuffer = await response.arrayBuffer();
              logger.debug(`✓ Fetched ${note}: ${arrayBuffer.byteLength} bytes`);
              
              // Test native decoding first
              const audioContext = Tone.context.rawContext;
              let audioBuffer: AudioBuffer;
              
              try {
                audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
                logger.debug(`✓ Native decode success for ${note}: ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.numberOfChannels} channels`);
                
              } catch (decodeError: any) {
                logger.error(`❌ Native decode failed for ${note}:`, {
                  error: decodeError.name,
                  message: decodeError.message,
                  url: cachedUrl,
                  byteLength: arrayBuffer.byteLength,
                  browser: navigator.userAgent
                });
                
                // Safari 15+ MP3 decoding issue - try workaround
                if (decodeError.name === 'EncodingError') {
                  logger.info(`🔄 Attempting Safari MP3 workaround for ${note}...`);
                  
                  try {
                    // Try with a fresh copy of the array buffer
                    const freshArrayBuffer = await (await fetch(finalUrl, { mode: 'cors' })).arrayBuffer();
                    audioBuffer = await audioContext.decodeAudioData(freshArrayBuffer);
                    logger.info(`✅ Safari workaround succeeded for ${note}`);
                    
                  } catch (workaroundError: any) {
                    logger.error(`❌ Safari workaround also failed for ${note}:`, workaroundError);
                    
                    // Create a silent buffer as final fallback
                    logger.info(`🔇 Creating silent fallback buffer for ${note}`);
                    audioBuffer = audioContext.createBuffer(2, audioContext.sampleRate * 2, audioContext.sampleRate);
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
              
              // Record cache miss
              cacheMonitor.recordLoad({
                url: finalUrl,
                fromCache: false,
                loadTime,
                plugin,
                context: 'CachedToneBufferLoader.createCachedSampler',
              });
              return { success: true, note, source: 'network' };
              
            } catch (fetchError: any) {
              logger.error(`❌ Fetch failed for ${note}:`, {
                error: fetchError.name,
                message: fetchError.message,
                url: cachedUrl
              });
              throw fetchError;
            }
          }
        } catch (error) {
          logger.error(`❌ Failed to load buffer for ${note} (${url}):`, error);
          return { success: false, note, error: error.message };
        }
      }),
    );

    // Log results for debugging
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success);
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success));
    
    if (failed.length > 0) {
      logger.warn(`🎹 Some buffers failed to load:`, failed.map(f => 
        f.status === 'fulfilled' ? f.value.note : 'unknown'
      ));
    }

    logger.info(
      `🎹 Sampler created: ${cachedCount} cached, ${networkCount} from network (Total samples: ${Object.keys(sampleMap).length})`,
    );

    // Debug: Check what buffers we actually have
    const buffersReady = Object.keys(buffers).length;
    const buffersExpected = Object.keys(sampleMap).length;
    logger.info(`🎹 Buffer check: ${buffersReady}/${buffersExpected} buffers ready for Tone.Sampler`);
    
    // Log successful loads by source
    const successfulBySource = successful.reduce((acc: Record<string, number>, r: any) => {
      if (r.status === 'fulfilled' && r.value.success) {
        acc[r.value.source] = (acc[r.value.source] || 0) + 1;
      }
      return acc;
    }, {});
    logger.info('🎹 Load sources:', successfulBySource);
    
    if (buffersReady === 0) {
      logger.error('🎹 ERROR: No buffers available for Tone.Sampler! This will cause "No available buffers" errors.');
      logger.info('🎹 Sample map keys:', Object.keys(sampleMap));
      logger.info('🎹 Available buffers:', Object.keys(buffers));
      logger.info('🎹 Load results:', results.map(r => ({
        status: r.status,
        value: r.status === 'fulfilled' ? r.value : null,
        reason: r.status === 'rejected' ? r.reason : null
      })));
    } else {
      logger.info('🎹 Available buffer notes:', Object.keys(buffers).sort());
    }

    // Create sampler with loaded buffers
    const sampler = new Tone.Sampler(buffers, options);

    return sampler;
  }

  /**
   * Check if all samples for a given mapping are cached
   * @param sampleMap - Map of notes to sample URLs
   * @returns true if all samples are cached
   */
  static areAllSamplesCached(sampleMap: Record<string, string>): boolean {
    // UPDATED: Also check URL cache, not just buffers
    // InitialSamplePreloader only caches URLs to avoid AudioContext issues
    const allHaveBuffers = Object.values(sampleMap).every(
      (url) => GlobalSampleCache.getCachedBuffer(url) !== null,
    );
    
    if (allHaveBuffers) {
      return true;
    }
    
    // If not all have buffers, check if at least URLs are cached
    // This indicates the samples were preloaded but buffers weren't cached
    // due to AudioContext compatibility issues
    const allHaveUrls = Object.values(sampleMap).every(
      (url) => {
        // Check if URL is cached
        const cachedUrl = GlobalSampleCache.getCachedUrl(url);
        if (cachedUrl) return true;
        
        // Also check by path key (InitialSamplePreloader uses path as key)
        // Extract path from full URL
        const urlObj = new URL(url);
        const path = urlObj.pathname.split('/audio-samples/')[1];
        if (path && GlobalSampleCache.getCachedUrl(path)) {
          return true;
        }
        
        return false;
      }
    );
    
    if (allHaveUrls) {
      logger.debug('🎹 All sample URLs are cached (buffers not cached due to AudioContext)');
    }
    
    // For now, still return false if no buffers to maintain existing behavior
    // The real fix is to prevent duplicate instrument creation at a higher level
    return allHaveBuffers;
  }

  /**
   * Get cache statistics for debugging
   * @returns Object with cache statistics
   */
  static getCacheStats(): {
    totalCached: number;
    totalUrls: number;
    cacheHitRate: number;
  } {
    const stats = GlobalSampleCache.getCacheStats();
    return {
      totalCached: stats.bufferCount,
      totalUrls: stats.urlCount,
      cacheHitRate:
        stats.bufferCount > 0 ? stats.bufferCount / stats.urlCount : 0,
    };
  }
}

// Export a singleton instance for convenience
export const cachedToneLoader = CachedToneBufferLoader;
