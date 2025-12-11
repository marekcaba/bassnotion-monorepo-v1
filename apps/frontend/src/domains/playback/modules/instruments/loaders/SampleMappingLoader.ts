/**
 * Sample Mapping Loader
 *
 * Loads instrument sample mappings from external JSON files
 * Provides caching and validation for sample configurations
 */

import { createStructuredLogger } from '../../shared/index.js';
import {
  protectedSampleFetch,
  SAMPLE_FETCH_TIMEOUT_MS,
} from '../../../services/core/SampleLoadingCircuitBreaker.js';
import type {
  InstrumentSampleConfig,
  DrumKitConfig,
  SimpleSampleSet,
  VelocityRange,
  SampleMapping,
} from '../types/sample-mapping.js';

const logger = createStructuredLogger('SampleMappingLoader');

export interface LoaderOptions {
  basePath?: string;
  cache?: boolean;
  validate?: boolean;
}

export class SampleMappingLoader {
  private static instance: SampleMappingLoader | null = null;
  private configCache: Map<string, InstrumentSampleConfig | DrumKitConfig> =
    new Map();
  private loadingPromises: Map<string, Promise<any>> = new Map();
  private options: Required<LoaderOptions>;

  constructor(options: LoaderOptions = {}) {
    this.options = {
      basePath: '/src/domains/playback/data/',
      cache: true,
      validate: true,
      ...options,
    };
  }

  /**
   * Get singleton instance
   */
  public static getInstance(options?: LoaderOptions): SampleMappingLoader {
    if (!SampleMappingLoader.instance) {
      SampleMappingLoader.instance = new SampleMappingLoader(options);
    }
    return SampleMappingLoader.instance;
  }

  /**
   * Load instrument sample configuration
   */
  public async loadInstrumentConfig(
    instrumentPath: string,
  ): Promise<InstrumentSampleConfig> {
    const cacheKey = `instrument:${instrumentPath}`;

    // Check cache
    if (this.options.cache && this.configCache.has(cacheKey)) {
      logger.debug(`Loading ${instrumentPath} from cache`);
      return this.configCache.get(cacheKey) as InstrumentSampleConfig;
    }

    // Check if already loading
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey)!;
    }

    // Start loading
    const loadPromise =
      this.performLoad<InstrumentSampleConfig>(instrumentPath);
    this.loadingPromises.set(cacheKey, loadPromise);

    try {
      const config = await loadPromise;

      // Validate if enabled
      if (this.options.validate) {
        this.validateInstrumentConfig(config);
      }

      // Cache if enabled
      if (this.options.cache) {
        this.configCache.set(cacheKey, config);
      }

      logger.info(
        `Loaded instrument config: ${config.name} v${config.version}`,
      );
      return config;
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }

  /**
   * Load drum kit configuration
   */
  public async loadDrumKitConfig(kitPath: string): Promise<DrumKitConfig> {
    const cacheKey = `drumkit:${kitPath}`;

    // Check cache
    if (this.options.cache && this.configCache.has(cacheKey)) {
      logger.debug(`Loading ${kitPath} from cache`);
      return this.configCache.get(cacheKey) as DrumKitConfig;
    }

    // Check if already loading
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey)!;
    }

    // Start loading
    const loadPromise = this.performLoad<DrumKitConfig>(kitPath);
    this.loadingPromises.set(cacheKey, loadPromise);

    try {
      const config = await loadPromise;

      // Validate if enabled
      if (this.options.validate) {
        this.validateDrumKitConfig(config);
      }

      // Cache if enabled
      if (this.options.cache) {
        this.configCache.set(cacheKey, config);
      }

      logger.info(`Loaded drum kit config: ${config.name} v${config.version}`);
      return config;
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }

  /**
   * Perform the actual loading
   * Protected by circuit breaker to prevent cascading failures
   */
  private async performLoad<T>(path: string): Promise<T> {
    const fullPath = `${this.options.basePath}${path}`;

    try {
      // Use circuit breaker protected fetch with 10s timeout
      const response = await protectedSampleFetch(fullPath, `config-${path}`);

      const config = await response.json();
      return config as T;
    } catch (error) {
      logger.error(`Failed to load config from ${fullPath}`, { error });
      throw error;
    }
  }

  /**
   * Validate instrument configuration
   */
  private validateInstrumentConfig(config: InstrumentSampleConfig): void {
    const errors: string[] = [];

    // Required fields
    if (!config.name) errors.push('Missing name');
    if (!config.version) errors.push('Missing version');

    // Support both velocityRanges (simple) and globalVelocityRanges (advanced per-note config)
    const hasVelocityRanges =
      config.velocityRanges && config.velocityRanges.length > 0;
    const hasGlobalVelocityRanges =
      (config as any).globalVelocityRanges &&
      (config as any).globalVelocityRanges.length > 0;

    if (!hasVelocityRanges && !hasGlobalVelocityRanges) {
      errors.push('Missing or empty velocityRanges or globalVelocityRanges');
    }
    if (
      !config.sampleMapping ||
      Object.keys(config.sampleMapping).length === 0
    ) {
      errors.push('Missing or empty sampleMapping');
    }

    // Validate velocity ranges
    if (config.velocityRanges) {
      const ranges = config.velocityRanges;

      // Check for gaps or overlaps
      for (let i = 0; i < ranges.length - 1; i++) {
        const current = ranges[i];
        const next = ranges[i + 1];

        if (current.max >= next.min) {
          errors.push(
            `Velocity range overlap between ${current.layer} and ${next.layer}`,
          );
        }
        if (current.max + 1 < next.min) {
          errors.push(
            `Velocity range gap between ${current.layer} and ${next.layer}`,
          );
        }
      }

      // Check range bounds
      ranges.forEach((range) => {
        if (range.min < 0 || range.min > 127) {
          errors.push(`Invalid min velocity in ${range.layer}: ${range.min}`);
        }
        if (range.max < 0 || range.max > 127) {
          errors.push(`Invalid max velocity in ${range.layer}: ${range.max}`);
        }
        if (range.min > range.max) {
          errors.push(`Invalid velocity range in ${range.layer}: min > max`);
        }
      });
    }

    if (errors.length > 0) {
      throw new Error(`Invalid instrument config: ${errors.join(', ')}`);
    }
  }

  /**
   * Validate drum kit configuration
   */
  private validateDrumKitConfig(config: DrumKitConfig): void {
    const errors: string[] = [];

    // Required fields
    if (!config.name) errors.push('Missing name');
    if (!config.version) errors.push('Missing version');
    if (!config.pieces || Object.keys(config.pieces).length === 0) {
      errors.push('Missing or empty pieces');
    }

    // Validate pieces
    if (config.pieces) {
      Object.entries(config.pieces).forEach(([pieceName, piece]) => {
        if (!piece.noteMapping && piece.noteMapping !== 0) {
          errors.push(`Missing noteMapping for ${pieceName}`);
        }
        if (!piece.samples || Object.keys(piece.samples).length === 0) {
          errors.push(`Missing or empty samples for ${pieceName}`);
        }
      });
    }

    if (errors.length > 0) {
      throw new Error(`Invalid drum kit config: ${errors.join(', ')}`);
    }
  }

  /**
   * Get velocity layer for a given velocity
   */
  public getVelocityLayer(velocity: number, ranges: VelocityRange[]): string {
    const range = ranges.find((r) => velocity >= r.min && velocity <= r.max);
    if (!range) {
      logger.warn(
        `No velocity range found for velocity ${velocity}, using first layer`,
      );
      return ranges[0]?.layer || 'default';
    }
    return range.layer;
  }

  /**
   * Build sample URL from config
   */
  public buildSampleUrl(
    config: InstrumentSampleConfig,
    note: string,
    layer: string,
  ): string {
    const { storage, sampleMapping } = config;
    let fileName = sampleMapping[note];

    if (!fileName) {
      throw new Error(`No sample mapping found for note ${note}`);
    }

    // Replace {layer} placeholder in fileName template (for advanced configs like Wurlitzer)
    fileName = fileName.replace(/\{layer\}/g, layer);

    // URL-encode the filename to handle special characters like # in note names (F#, C#, etc.)
    // Split path and encode each component separately to preserve directory structure
    const encodePathComponent = (path: string): string => {
      return path
        .split('/')
        .map((component) => encodeURIComponent(component))
        .join('/');
    };

    // Build URL based on storage config
    if (storage.baseUrl) {
      // Remote URL
      // Check if fileName already includes layer path (advanced config)
      const hasLayerInPath = fileName.includes('/');

      // Encode fileName components
      const encodedFileName = encodePathComponent(fileName);

      const path = storage.bucketPath
        ? hasLayerInPath
          ? `${storage.bucketPath}/${encodedFileName}` // fileName has layer already (e.g., "v2/A0_v2.ogg")
          : `${storage.bucketPath}/${layer}/${encodedFileName}` // Simple format (e.g., "A0.mp3")
        : hasLayerInPath
          ? encodedFileName
          : `${layer}/${encodedFileName}`;
      return `${storage.baseUrl}/${path}`;
    } else if (storage.localPath) {
      // Local path - also encode for consistency
      const hasLayerInPath = fileName.includes('/');
      const encodedFileName = encodePathComponent(fileName);
      return hasLayerInPath
        ? `${storage.localPath}/${encodedFileName}`
        : `${storage.localPath}/${layer}/${encodedFileName}`;
    } else {
      throw new Error('No storage configuration found');
    }
  }

  /**
   * Get all sample URLs for an instrument
   */
  public getAllSampleUrls(
    config: InstrumentSampleConfig,
    layers?: string[],
  ): Map<string, Map<string, string>> {
    const urls = new Map<string, Map<string, string>>();

    // Support both velocityRanges and globalVelocityRanges
    const velocityRanges =
      config.velocityRanges || (config as any).globalVelocityRanges;
    const targetLayers =
      layers || (velocityRanges ? velocityRanges.map((r: any) => r.layer) : []);

    for (const layer of targetLayers) {
      const layerUrls = new Map<string, string>();

      for (const note of Object.keys(config.sampleMapping)) {
        try {
          const url = this.buildSampleUrl(config, note, layer);
          layerUrls.set(note, url);
        } catch (error) {
          logger.warn(`Failed to build URL for ${note} in layer ${layer}`, {
            error,
          });
        }
      }

      urls.set(layer, layerUrls);
    }

    return urls;
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.configCache.clear();
    logger.info('Sample mapping cache cleared');
  }

  /**
   * Get cache size
   */
  public getCacheSize(): number {
    return this.configCache.size;
  }

  /**
   * Preload multiple configurations
   */
  public async preloadConfigs(paths: string[]): Promise<void> {
    logger.info(`Preloading ${paths.length} configurations`);

    const promises = paths.map((path) => {
      if (path.includes('drums/')) {
        return this.loadDrumKitConfig(path);
      } else {
        return this.loadInstrumentConfig(path);
      }
    });

    await Promise.all(promises);
    logger.info('All configurations preloaded');
  }
}
