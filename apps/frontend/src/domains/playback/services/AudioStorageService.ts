/**
 * Audio Storage Service
 *
 * Domain-specific storage adapter for the playback domain.
 * This thin adapter uses the shared storage infrastructure
 * while providing audio-specific functionality.
 */

import { createStructuredLogger } from '@/shared/utils/errorHandling';
import {
  FileStorageService,
  SupabaseClientManager,
  type IStorageService,
  type DownloadOptions,
  type DownloadResult,
  type ClientManagerConfig,
} from '@/shared/infrastructure/storage';

const logger = createStructuredLogger('AudioStorageService');

export interface AudioDownloadOptions extends Omit<DownloadOptions, 'bucket'> {
  instrumentType?: 'piano' | 'drums' | 'bass' | 'metronome';
  quality?: 'low' | 'medium' | 'high';
  preload?: boolean;
}

export interface AudioStorageConfig {
  buckets: {
    samples: string;
    instruments: string;
    exercises: string;
    backing: string;
  };
  cdn?: {
    enabled: boolean;
    baseUrl?: string;
  };
  caching?: {
    maxSize?: number;
    ttl?: number;
  };
}

/**
 * Audio-specific storage service
 */
export class AudioStorageService {
  private storageService: IStorageService;
  private clientManager: SupabaseClientManager;
  private config: AudioStorageConfig;
  private static instance: AudioStorageService | null = null;

  constructor(config: AudioStorageConfig, clientConfig: ClientManagerConfig) {
    this.config = config;
    this.clientManager = new SupabaseClientManager(clientConfig);
    this.storageService = new FileStorageService(this.clientManager);
  }

  /**
   * Get singleton instance
   */
  static getInstance(
    config?: AudioStorageConfig,
    clientConfig?: ClientManagerConfig,
  ): AudioStorageService {
    if (!AudioStorageService.instance && config && clientConfig) {
      AudioStorageService.instance = new AudioStorageService(
        config,
        clientConfig,
      );
    }

    if (!AudioStorageService.instance) {
      throw new Error('AudioStorageService not initialized');
    }

    return AudioStorageService.instance;
  }

  /**
   * Download an audio sample
   */
  async downloadSample(
    instrumentPath: string,
    options?: AudioDownloadOptions,
  ): Promise<AudioBuffer> {
    try {
      logger.info('Downloading audio sample', {
        path: instrumentPath,
        options,
      });

      // Determine bucket based on instrument type
      const bucket = options?.instrumentType
        ? this.config.buckets.instruments
        : this.config.buckets.samples;

      // Apply quality transformations
      const downloadOptions: DownloadOptions = {
        bucket,
        path: instrumentPath,
      };

      // Download the file
      const result = await this.storageService.download(downloadOptions);

      // Convert to AudioBuffer
      const audioBuffer = await this.convertToAudioBuffer(result);

      logger.info('Audio sample downloaded successfully', {
        path: instrumentPath,
        size: audioBuffer.length,
        sampleRate: audioBuffer.sampleRate,
      });

      return audioBuffer;
    } catch (error) {
      logger.error('Failed to download audio sample', {
        error,
        path: instrumentPath,
      });
      throw error;
    }
  }

  /**
   * Get sample URL for streaming
   */
  async getSampleUrl(
    instrumentPath: string,
    options?: { expires?: number },
  ): Promise<string> {
    const bucket = this.config.buckets.samples;

    if (options?.expires) {
      return this.storageService.getSignedUrl(
        bucket,
        instrumentPath,
        options.expires,
      );
    }

    // Check if CDN is enabled
    if (this.config.cdn?.enabled && this.config.cdn.baseUrl) {
      return `${this.config.cdn.baseUrl}/${bucket}/${instrumentPath}`;
    }

    return this.storageService.getPublicUrl(bucket, instrumentPath);
  }

  /**
   * Preload multiple samples
   */
  async preloadSamples(paths: string[]): Promise<Map<string, AudioBuffer>> {
    logger.info('Preloading audio samples', { count: paths.length });

    const results = new Map<string, AudioBuffer>();
    const promises = paths.map(async (path) => {
      try {
        const buffer = await this.downloadSample(path, { preload: true });
        results.set(path, buffer);
      } catch (error) {
        logger.warn('Failed to preload sample', { path, error });
      }
    });

    await Promise.all(promises);

    logger.info('Preload completed', {
      requested: paths.length,
      loaded: results.size,
    });

    return results;
  }

  /**
   * List available instruments
   */
  async listInstruments(type?: string): Promise<string[]> {
    const prefix = type || '';
    const items = await this.storageService.list(
      this.config.buckets.instruments,
      prefix,
      { sortBy: 'name' },
    );

    return items.map((item) => item.path);
  }

  /**
   * Download exercise backing track
   */
  async downloadBackingTrack(exerciseId: string): Promise<AudioBuffer> {
    const path = `exercises/${exerciseId}/backing.mp3`;

    const result = await this.storageService.download({
      bucket: this.config.buckets.backing,
      path,
    });

    return this.convertToAudioBuffer(result);
  }

  /**
   * Convert downloaded data to AudioBuffer
   */
  private async convertToAudioBuffer(
    result: DownloadResult,
  ): Promise<AudioBuffer> {
    // This is a simplified version - in reality, you'd use Web Audio API
    // or a proper audio decoding library
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error('AudioContext not supported in this browser');
    }
    const audioContext = new AudioContextClass();

    const arrayBuffer =
      result.data instanceof Blob
        ? await result.data.arrayBuffer()
        : result.data;

    return audioContext.decodeAudioData(arrayBuffer);
  }

  /**
   * Get storage metrics specific to audio
   */
  getMetrics() {
    return {
      ...this.clientManager.getMetrics(),
      audioSpecific: {
        // Add audio-specific metrics here
        cachedSamples: 0, // Would integrate with cache manager
        averageLoadTime: 0,
      },
    };
  }

  /**
   * Cleanup and dispose
   */
  async dispose(): Promise<void> {
    await this.clientManager.dispose();
    AudioStorageService.instance = null;
  }
}
