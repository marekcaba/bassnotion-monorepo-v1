/**
 * Drum Kit Configuration Loader
 *
 * Loads and manages drum kit configurations from JSON files.
 * Provides caching, validation, and URL building for drum samples.
 */

import { createStructuredLogger } from '../../shared/index.js';
import type {
  DrumKitConfig,
  GeneralMidiDrumMap,
  DrumKitLoaderOptions,
  DrumPiece,
} from '../types/drum-kit.types.js';

const logger = createStructuredLogger('DrumKitConfigLoader');

export class DrumKitConfigLoader {
  private static instance: DrumKitConfigLoader | null = null;
  private configCache: Map<string, DrumKitConfig> = new Map();
  private midiMapCache: Map<string, GeneralMidiDrumMap> = new Map();
  private options: Required<DrumKitLoaderOptions>;
  private loadingPromises: Map<string, Promise<any>> = new Map();

  private constructor(options?: DrumKitLoaderOptions) {
    this.options = {
      basePath: '/src/domains/playback/data/drums/',
      cache: true,
      validate: true,
      ...options,
    };
  }

  /**
   * Get singleton instance
   */
  static getInstance(options?: DrumKitLoaderOptions): DrumKitConfigLoader {
    if (!DrumKitConfigLoader.instance) {
      DrumKitConfigLoader.instance = new DrumKitConfigLoader(options);
    }
    return DrumKitConfigLoader.instance;
  }

  /**
   * Load a drum kit configuration
   */
  async loadDrumKitConfig(configPath: string): Promise<DrumKitConfig> {
    // Check cache first
    if (this.options.cache && this.configCache.has(configPath)) {
      logger.info('Returning cached drum kit config', { path: configPath });
      return this.configCache.get(configPath)!;
    }

    // Check if already loading
    if (this.loadingPromises.has(configPath)) {
      return this.loadingPromises.get(configPath);
    }

    const loadPromise = this.loadDrumKitConfigInternal(configPath);
    this.loadingPromises.set(configPath, loadPromise);

    try {
      const config = await loadPromise;
      return config;
    } finally {
      this.loadingPromises.delete(configPath);
    }
  }

  /**
   * Internal loader implementation
   */
  private async loadDrumKitConfigInternal(
    configPath: string,
  ): Promise<DrumKitConfig> {
    try {
      logger.info('Loading drum kit config', { path: configPath });

      const fullPath = `${this.options.basePath}${configPath}`;
      const response = await fetch(fullPath);

      if (!response.ok) {
        throw new Error(
          `Failed to load drum kit config: ${response.status} ${response.statusText}`,
        );
      }

      const config: DrumKitConfig = await response.json();

      // Validate if enabled
      if (this.options.validate) {
        this.validateDrumKitConfig(config);
      }

      // Cache if enabled
      if (this.options.cache) {
        this.configCache.set(configPath, config);
      }

      logger.info('Drum kit config loaded successfully', {
        name: config.name,
        version: config.version,
        pieces: Object.keys(config.pieces).length,
      });

      return config;
    } catch (error) {
      logger.error('Failed to load drum kit config', {
        error,
        path: configPath,
      });
      throw error;
    }
  }

  /**
   * Load General MIDI drum map
   */
  async loadMidiDrumMap(
    mapPath = 'general-midi-drums.json',
  ): Promise<GeneralMidiDrumMap> {
    if (this.options.cache && this.midiMapCache.has(mapPath)) {
      return this.midiMapCache.get(mapPath)!;
    }

    try {
      const fullPath = `${this.options.basePath}${mapPath}`;
      const response = await fetch(fullPath);

      if (!response.ok) {
        throw new Error(`Failed to load MIDI drum map: ${response.status}`);
      }

      const map: GeneralMidiDrumMap = await response.json();

      if (this.options.cache) {
        this.midiMapCache.set(mapPath, map);
      }

      return map;
    } catch (error) {
      logger.error('Failed to load MIDI drum map', { error, path: mapPath });
      throw error;
    }
  }

  /**
   * Validate drum kit configuration
   */
  private validateDrumKitConfig(config: DrumKitConfig): void {
    const errors: string[] = [];

    if (!config.name) {
      errors.push('Missing required field: name');
    }

    if (!config.version) {
      errors.push('Missing required field: version');
    }

    if (!config.pieces || typeof config.pieces !== 'object') {
      errors.push('Missing or invalid pieces object');
    } else {
      // Validate each drum piece
      for (const [pieceName, piece] of Object.entries(config.pieces)) {
        const pieceErrors = this.validateDrumPiece(pieceName, piece);
        errors.push(...pieceErrors);
      }
    }

    if (!config.settings) {
      errors.push('Missing required field: settings');
    }

    if (errors.length > 0) {
      throw new Error(`Invalid drum kit configuration:\n${errors.join('\n')}`);
    }
  }

  /**
   * Validate individual drum piece
   */
  private validateDrumPiece(name: string, piece: DrumPiece): string[] {
    const errors: string[] = [];

    if (typeof piece.noteMapping !== 'number') {
      errors.push(`${name}: Missing or invalid noteMapping`);
    }

    if (!piece.samples || typeof piece.samples !== 'object') {
      errors.push(`${name}: Missing or invalid samples object`);
    }

    if (!piece.defaultSample) {
      errors.push(`${name}: Missing defaultSample`);
    }

    if (typeof piece.volume !== 'number') {
      errors.push(`${name}: Missing or invalid volume`);
    }

    if (typeof piece.pan !== 'number') {
      errors.push(`${name}: Missing or invalid pan`);
    }

    if (!piece.envelope || typeof piece.envelope !== 'object') {
      errors.push(`${name}: Missing or invalid envelope`);
    }

    return errors;
  }

  /**
   * Build sample URLs for a drum kit
   */
  buildSampleUrls(
    config: DrumKitConfig,
    baseUrl: string,
    piece?: string,
  ): Map<string, Map<string, string>> {
    const urls = new Map<string, Map<string, string>>();

    const piecesToProcess = piece
      ? { [piece]: config.pieces[piece] }
      : config.pieces;

    for (const [pieceName, drumPiece] of Object.entries(piecesToProcess)) {
      if (!drumPiece) continue;

      const pieceUrls = new Map<string, string>();

      for (const [velocity, sampleFile] of Object.entries(drumPiece.samples)) {
        const url = `${baseUrl}/${pieceName}/${sampleFile}`;
        pieceUrls.set(velocity, url);
      }

      urls.set(pieceName, pieceUrls);
    }

    return urls;
  }

  /**
   * Get drum piece by MIDI note number
   */
  getDrumPieceByNote(
    config: DrumKitConfig,
    noteNumber: number,
  ): [string, DrumPiece] | null {
    for (const [name, piece] of Object.entries(config.pieces)) {
      if (piece.noteMapping === noteNumber) {
        return [name, piece];
      }
    }
    return null;
  }

  /**
   * Get sample for velocity
   */
  getSampleForVelocity(piece: DrumPiece, velocity: number): string {
    // Normalize velocity to 0-127 range
    const v = Math.max(0, Math.min(127, velocity));

    // Define velocity ranges
    if (v < 40) return piece.samples.soft || piece.defaultSample;
    if (v < 80) return piece.samples.medium || piece.defaultSample;
    if (v < 110) return piece.samples.hard || piece.defaultSample;

    // For very hard hits, use hard sample or specific variations
    return piece.samples.veryHard || piece.samples.hard || piece.defaultSample;
  }

  /**
   * Get available drum kits
   */
  async listAvailableKits(): Promise<string[]> {
    // In a real implementation, this would scan the directory
    // For now, return known kits
    return [
      'basic-kit.json',
      'electronic-kit.json',
      'jazz-kit.json',
      'rock-kit.json',
    ].filter((kit) => kit !== 'general-midi-drums.json');
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.configCache.clear();
    this.midiMapCache.clear();
    logger.info('Drum kit config cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      drumKits: this.configCache.size,
      midiMaps: this.midiMapCache.size,
      totalSize: this.estimateCacheSize(),
    };
  }

  /**
   * Estimate cache size in bytes
   */
  private estimateCacheSize(): number {
    let size = 0;

    // Estimate based on JSON string length
    for (const config of this.configCache.values()) {
      size += JSON.stringify(config).length * 2; // 2 bytes per character
    }

    for (const map of this.midiMapCache.values()) {
      size += JSON.stringify(map).length * 2;
    }

    return size;
  }
}
