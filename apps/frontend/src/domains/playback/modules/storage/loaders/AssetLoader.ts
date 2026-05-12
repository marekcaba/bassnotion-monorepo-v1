/**
 * AssetLoader - Comprehensive asset loading and management
 *
 * Extends SampleLoader to handle various asset types including
 * audio samples, instrument definitions, presets, and metadata.
 * Provides batch loading, dependency resolution, and manifest support.
 */

import {
  SampleLoader,
  type LoadOptions,
  type LoadResult,
  type SampleLoaderConfig,
} from './SampleLoader.js';
import { SampleCache } from '../cache/SampleCache.js';
import { EventBus, createStructuredLogger } from '../../shared/index.js';
import type { AudioSampleMetadata } from '@bassnotion/contracts';

const logger = createStructuredLogger('AssetLoader');

export interface AssetManifest {
  version: string;
  assets: AssetDefinition[];
  dependencies?: Record<string, string[]>;
  metadata?: Record<string, any>;
}

export interface AssetDefinition {
  id: string;
  type: AssetType;
  url: string;
  size?: number;
  checksum?: string;
  metadata?: AudioSampleMetadata;
  dependencies?: string[];
  priority?: 'essential' | 'high' | 'normal' | 'low';
  qualityProfiles?: QualityProfile[];
}

export type AssetType =
  | 'sample'
  | 'instrument'
  | 'preset'
  | 'impulse'
  | 'wavetable'
  | 'soundfont'
  | 'configuration'
  | 'metadata';

export interface QualityProfile {
  quality: 'low' | 'medium' | 'high' | 'original';
  url: string;
  size: number;
  sampleRate?: number;
  bitDepth?: number;
}

export interface AssetLoadResult extends LoadResult {
  assetId: string;
  assetType: AssetType;
  dependencies?: string[];
}

export interface BatchLoadProgress {
  total: number;
  loaded: number;
  failed: number;
  currentAsset?: string;
  percentage: number;
}

export interface AssetLoaderConfig {
  manifestUrl?: string;
  enableDependencyResolution: boolean;
  enableChecksumValidation: boolean;
  enableProgressiveLoading: boolean;
  batchSize: number;
  parallelLoads: number;
}

/**
 * Combined config type for AssetLoader
 */
export type AssetLoaderFullConfig = AssetLoaderConfig & SampleLoaderConfig;

/**
 * Manages loading of various asset types with manifest support
 */
export class AssetLoader extends SampleLoader {
  private assetConfig: AssetLoaderConfig;
  private manifest?: AssetManifest;
  private loadedAssets = new Map<string, AssetLoadResult>();
  private dependencyGraph = new Map<string, Set<string>>();

  constructor(
    config: AssetLoaderFullConfig,
    cache?: SampleCache,
    eventBus?: EventBus,
  ) {
    // Extract SampleLoaderConfig properties for parent constructor
    const sampleLoaderConfig: SampleLoaderConfig = {
      baseUrl: config.baseUrl,
      defaultQuality: config.defaultQuality,
      maxRetries: config.maxRetries,
      retryDelay: config.retryDelay,
      timeout: config.timeout,
      enableAnalytics: config.enableAnalytics,
      enableQualityAdaptation: config.enableQualityAdaptation,
    };
    super(sampleLoaderConfig, cache, eventBus);
    this.assetConfig = config;
  }

  /**
   * Load manifest file
   */
  async loadManifest(url?: string): Promise<AssetManifest> {
    const manifestUrl = url || this.assetConfig.manifestUrl;
    if (!manifestUrl) {
      throw new Error('No manifest URL provided');
    }

    try {
      logger.info('Loading asset manifest from:', { manifestUrl });

      const response = await fetch(manifestUrl);
      if (!response.ok) {
        throw new Error(`Failed to load manifest: ${response.statusText}`);
      }

      this.manifest = await response.json();

      // Build dependency graph
      this.buildDependencyGraph();

      if (!this.manifest) {
        throw new Error('Failed to parse manifest');
      }

      logger.info(`Loaded manifest with ${this.manifest.assets.length} assets`);
      return this.manifest;
    } catch (error) {
      logger.error(
        'Failed to load manifest:',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Load a single asset by ID
   */
  async loadAsset(
    assetId: string,
    options: LoadOptions = {},
  ): Promise<AssetLoadResult> {
    // Check if already loaded
    const existing = this.loadedAssets.get(assetId);
    if (existing) {
      logger.debug(`Asset ${assetId} already loaded`);
      return existing;
    }

    // Find asset definition
    const asset = this.findAssetDefinition(assetId);
    if (!asset) {
      throw new Error(`Asset ${assetId} not found in manifest`);
    }

    // Load dependencies first if enabled
    if (this.assetConfig.enableDependencyResolution && asset.dependencies) {
      await this.loadDependencies(asset.dependencies, options);
    }

    // Load based on asset type
    const result = await this.loadAssetByType(asset, options);

    // Store result
    this.loadedAssets.set(assetId, result);

    // Emit progress
    this.emitAssetLoaded(asset, result);

    return result;
  }

  /**
   * Load multiple assets
   */
  async loadAssets(
    assetIds: string[],
    options: LoadOptions = {},
  ): Promise<Map<string, AssetLoadResult>> {
    const results = new Map<string, AssetLoadResult>();

    // Resolve load order if dependencies enabled
    const loadOrder = this.assetConfig.enableDependencyResolution
      ? this.resolveLoadOrder(assetIds)
      : assetIds;

    // Load in batches
    const batchSize = this.assetConfig.batchSize;
    for (let i = 0; i < loadOrder.length; i += batchSize) {
      const batch = loadOrder.slice(i, i + batchSize);

      const batchPromises = batch.map(async (assetId) => {
        try {
          const result = await this.loadAsset(assetId, options);
          results.set(assetId, result);
        } catch (error) {
          logger.error(
            `Failed to load asset ${assetId}:`,
            error instanceof Error ? error : new Error(String(error)),
          );
          results.set(assetId, {
            assetId,
            assetType: 'sample',
            success: false,
            fromCache: false,
            loadTime: 0,
            size: 0,
            quality: 'original',
            error: error as Error,
          });
        }
      });

      await Promise.all(batchPromises);

      // Emit batch progress
      this.emitBatchProgress({
        total: loadOrder.length,
        loaded: results.size,
        failed: Array.from(results.values()).filter((r) => !r.success).length,
        percentage: (results.size / loadOrder.length) * 100,
      });
    }

    return results;
  }

  /**
   * Load all essential assets
   */
  async loadEssentialAssets(
    options: LoadOptions = {},
  ): Promise<Map<string, AssetLoadResult>> {
    if (!this.manifest) {
      await this.loadManifest();
    }

    if (!this.manifest) {
      throw new Error('Manifest not loaded');
    }

    const essentialAssets = this.manifest.assets
      .filter((a) => a.priority === 'essential')
      .map((a) => a.id);

    logger.info(`Loading ${essentialAssets.length} essential assets`);
    return this.loadAssets(essentialAssets, options);
  }

  /**
   * Load assets by type
   */
  async loadAssetsByType(
    type: AssetType,
    options: LoadOptions = {},
  ): Promise<Map<string, AssetLoadResult>> {
    if (!this.manifest) {
      await this.loadManifest();
    }

    if (!this.manifest) {
      throw new Error('Manifest not loaded');
    }

    const assets = this.manifest.assets
      .filter((a) => a.type === type)
      .map((a) => a.id);

    logger.info(`Loading ${assets.length} ${type} assets`);
    return this.loadAssets(assets, options);
  }

  /**
   * Preload assets based on priority
   */
  async preloadAssets(options: LoadOptions = {}): Promise<void> {
    if (!this.manifest) {
      await this.loadManifest();
    }

    // Group by priority
    const priorityGroups = new Map<string, AssetDefinition[]>();
    if (!this.manifest) {
      return;
    }

    for (const asset of this.manifest.assets) {
      const priority = asset.priority || 'normal';
      if (!priorityGroups.has(priority)) {
        priorityGroups.set(priority, []);
      }
      const group = priorityGroups.get(priority);
      if (group) {
        group.push(asset);
      }
    }

    // Load in priority order
    const priorities = ['essential', 'high', 'normal', 'low'];
    for (const priority of priorities) {
      const assets = priorityGroups.get(priority);
      if (assets && assets.length > 0) {
        logger.info(`Preloading ${assets.length} ${priority} priority assets`);
        await this.loadAssets(
          assets.map((a) => a.id),
          { ...options, preload: true },
        );
      }
    }
  }

  /**
   * Load asset by type with specific handling
   */
  private async loadAssetByType(
    asset: AssetDefinition,
    options: LoadOptions,
  ): Promise<AssetLoadResult> {
    const startTime = performance.now();

    try {
      let result: LoadResult;

      switch (asset.type) {
        case 'sample':
        case 'impulse':
        case 'wavetable':
          // Use parent class sample loading
          result = await this.loadSample(asset.url, asset.metadata, options);
          break;

        case 'instrument':
        case 'preset':
          // Load as JSON
          result = await this.loadJSON(asset.url, options);
          break;

        case 'soundfont':
          // Load as binary
          result = await this.loadBinary(asset.url, options);
          break;

        case 'configuration':
        case 'metadata':
          // Load as JSON
          result = await this.loadJSON(asset.url, options);
          break;

        default:
          throw new Error(`Unknown asset type: ${asset.type}`);
      }

      return {
        ...result,
        assetId: asset.id,
        assetType: asset.type,
        dependencies: asset.dependencies,
      };
    } catch (error) {
      const loadTime = performance.now() - startTime;

      return {
        assetId: asset.id,
        assetType: asset.type,
        success: false,
        fromCache: false,
        loadTime,
        size: 0,
        quality: 'original',
        error: error as Error,
        dependencies: asset.dependencies,
      };
    }
  }

  /**
   * Load JSON asset
   */
  private async loadJSON(
    url: string,
    _options: LoadOptions,
  ): Promise<LoadResult> {
    const startTime = performance.now();

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const text = JSON.stringify(data);
      const buffer = new TextEncoder().encode(text).buffer;

      return {
        success: true,
        data: buffer,
        url,
        fromCache: false,
        loadTime: performance.now() - startTime,
        size: buffer.byteLength,
        quality: 'original',
      };
    } catch (error) {
      return {
        success: false,
        fromCache: false,
        loadTime: performance.now() - startTime,
        size: 0,
        quality: 'original',
        error: error as Error,
      };
    }
  }

  /**
   * Load binary asset
   */
  private async loadBinary(
    url: string,
    options: LoadOptions,
  ): Promise<LoadResult> {
    // Use parent class sample loader for binary data
    return this.loadSample(url, undefined, options);
  }

  /**
   * Load dependencies
   */
  private async loadDependencies(
    dependencies: string[],
    options: LoadOptions,
  ): Promise<void> {
    for (const depId of dependencies) {
      if (!this.loadedAssets.has(depId)) {
        logger.debug(`Loading dependency: ${depId}`);
        await this.loadAsset(depId, options);
      }
    }
  }

  /**
   * Build dependency graph
   */
  private buildDependencyGraph(): void {
    if (!this.manifest) return;

    this.dependencyGraph.clear();

    for (const asset of this.manifest.assets) {
      if (!this.dependencyGraph.has(asset.id)) {
        this.dependencyGraph.set(asset.id, new Set());
      }

      if (asset.dependencies) {
        for (const dep of asset.dependencies) {
          const deps = this.dependencyGraph.get(asset.id);
          if (deps) {
            deps.add(dep);
          }
        }
      }
    }

    // Add manifest-level dependencies
    if (this.manifest.dependencies) {
      for (const [assetId, deps] of Object.entries(
        this.manifest.dependencies,
      )) {
        if (!this.dependencyGraph.has(assetId)) {
          this.dependencyGraph.set(assetId, new Set());
        }
        for (const dep of deps) {
          const assetDeps = this.dependencyGraph.get(assetId);
          if (assetDeps) {
            assetDeps.add(dep);
          }
        }
      }
    }
  }

  /**
   * Resolve load order based on dependencies
   */
  private resolveLoadOrder(assetIds: string[]): string[] {
    const resolved: string[] = [];
    const visited = new Set<string>();

    const visit = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);

      const deps = this.dependencyGraph.get(id);
      if (deps) {
        for (const dep of deps) {
          visit(dep);
        }
      }

      if (assetIds.includes(id)) {
        resolved.push(id);
      }
    };

    for (const id of assetIds) {
      visit(id);
    }

    return resolved;
  }

  /**
   * Find asset definition
   */
  private findAssetDefinition(assetId: string): AssetDefinition | undefined {
    return this.manifest?.assets.find((a) => a.id === assetId);
  }

  /**
   * Emit asset loaded event
   */
  private emitAssetLoaded(
    asset: AssetDefinition,
    result: AssetLoadResult,
  ): void {
    if (this.eventBus) {
      this.eventBus.emit('asset:loaded', {
        assetId: asset.id,
        assetType: asset.type,
        success: result.success,
        fromCache: result.fromCache,
        loadTime: result.loadTime,
        size: result.size,
      });
    }
  }

  /**
   * Emit batch progress
   */
  private emitBatchProgress(progress: BatchLoadProgress): void {
    if (this.eventBus) {
      this.eventBus.emit('asset:batchProgress', progress);
    }
  }

  /**
   * Get loaded assets
   */
  getLoadedAssets(): Map<string, AssetLoadResult> {
    return new Map(this.loadedAssets);
  }

  /**
   * Check if asset is loaded
   */
  isLoaded(assetId: string): boolean {
    return this.loadedAssets.has(assetId);
  }

  /**
   * Clear loaded assets
   */
  clearLoadedAssets(): void {
    this.loadedAssets.clear();
  }

  /**
   * Get manifest
   */
  getManifest(): AssetManifest | undefined {
    return this.manifest;
  }

  /**
   * Validate asset checksum
   */
  private async _validateChecksum(
    data: ArrayBuffer,
    expectedChecksum?: string,
  ): Promise<boolean> {
    if (!expectedChecksum || !this.assetConfig.enableChecksumValidation) {
      return true;
    }

    try {
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      return hashHex === expectedChecksum;
    } catch (error) {
      logger.warn('Checksum validation failed:', {
        error: error instanceof Error ? error.message : String(error),
      });
      return true; // Don't fail load on checksum error
    }
  }
}
