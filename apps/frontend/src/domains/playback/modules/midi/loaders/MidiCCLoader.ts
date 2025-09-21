/**
 * MIDI CC Configuration Loader
 *
 * Singleton loader for MIDI Control Change mappings.
 * Loads and manages CC configurations from external JSON files.
 */

import type {
  MidiCCConfig,
  CCMapping,
  StandardCC,
} from '../types/midi-cc.types.js';
import { createStructuredLogger } from '../../shared/index.js';

const logger = createStructuredLogger('MidiCCLoader');

export interface MidiCCLoaderOptions {
  cache?: boolean;
  validate?: boolean;
  customMappings?: Record<number, CCMapping>;
}

export class MidiCCLoader {
  private static instance: MidiCCLoader;
  private configCache: Map<string, MidiCCConfig> = new Map();
  private ccLookupCache: Map<string, Map<number, CCMapping>> = new Map();
  private options: MidiCCLoaderOptions;

  private constructor(options: MidiCCLoaderOptions = {}) {
    this.options = {
      cache: true,
      validate: true,
      ...options,
    };
  }

  static getInstance(options?: MidiCCLoaderOptions): MidiCCLoader {
    if (!MidiCCLoader.instance) {
      MidiCCLoader.instance = new MidiCCLoader(options);
    }
    return MidiCCLoader.instance;
  }

  /**
   * Load MIDI CC configuration from JSON file
   */
  async loadCCConfig(configPath: string): Promise<MidiCCConfig> {
    // Check cache first
    if (this.options.cache && this.configCache.has(configPath)) {
      logger.info('Returning cached MIDI CC config', { path: configPath });
      return this.configCache.get(configPath)!;
    }

    try {
      logger.info('Loading MIDI CC configuration', { path: configPath });

      const response = await fetch(configPath);
      if (!response.ok) {
        throw new Error(`Failed to load CC config: ${response.statusText}`);
      }

      const config: MidiCCConfig = await response.json();

      // Validate if enabled
      if (this.options.validate) {
        this.validateCCConfig(config);
      }

      // Apply custom mappings if provided
      if (this.options.customMappings) {
        config.mappings = {
          ...config.mappings,
          ...this.options.customMappings,
        };
      }

      // Cache the config
      if (this.options.cache) {
        this.configCache.set(configPath, config);
        // Build lookup cache
        this.buildCCLookupCache(configPath, config);
      }

      logger.info('MIDI CC configuration loaded', {
        name: config.name,
        version: config.version,
        mappingCount: Object.keys(config.mappings).length,
        categories: Object.keys(config.categories).length,
      });

      return config;
    } catch (error) {
      logger.error('Failed to load MIDI CC configuration', {
        path: configPath,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Build CC number to mapping lookup cache for fast access
   */
  private buildCCLookupCache(configPath: string, config: MidiCCConfig): void {
    const lookupMap = new Map<number, CCMapping>();

    for (const [ccStr, mapping] of Object.entries(config.mappings)) {
      const ccNumber = parseInt(ccStr, 10);
      if (!isNaN(ccNumber)) {
        lookupMap.set(ccNumber, mapping);
      }
    }

    this.ccLookupCache.set(configPath, lookupMap);
  }

  /**
   * Get CC mapping by number
   */
  getCCMapping(config: MidiCCConfig, ccNumber: number): CCMapping | undefined {
    return config.mappings[ccNumber.toString()];
  }

  /**
   * Get CC mapping by type name
   */
  getCCByType(
    config: MidiCCConfig,
    type: string,
  ): [number, CCMapping] | undefined {
    for (const [ccStr, mapping] of Object.entries(config.mappings)) {
      if (mapping.type === type) {
        return [parseInt(ccStr, 10), mapping];
      }
    }
    return undefined;
  }

  /**
   * Get all CCs in a category
   */
  getCCsByCategory(
    config: MidiCCConfig,
    category: string,
  ): Map<number, CCMapping> {
    const result = new Map<number, CCMapping>();

    for (const [ccStr, mapping] of Object.entries(config.mappings)) {
      if (mapping.category === category) {
        const ccNumber = parseInt(ccStr, 10);
        if (!isNaN(ccNumber)) {
          result.set(ccNumber, mapping);
        }
      }
    }

    return result;
  }

  /**
   * Normalize CC value to 0-1 range
   */
  normalizeCCValue(mapping: CCMapping, value: number): number {
    const [min, max] = mapping.range;
    return (value - min) / (max - min);
  }

  /**
   * Denormalize value from 0-1 to CC range
   */
  denormalizeCCValue(mapping: CCMapping, normalizedValue: number): number {
    const [min, max] = mapping.range;
    return Math.round(normalizedValue * (max - min) + min);
  }

  /**
   * Check if CC is a switch/button type
   */
  isCCSwitch(mapping: CCMapping): boolean {
    return mapping.isSwitch === true;
  }

  /**
   * Get switch state from CC value
   */
  getCCSwitchState(mapping: CCMapping, value: number): boolean {
    if (!mapping.isSwitch) {
      return value > 0;
    }
    const threshold = mapping.threshold ?? 64;
    return value >= threshold;
  }

  /**
   * Find CC by alias
   */
  findCCByAlias(
    config: MidiCCConfig,
    alias: string,
  ): [number, CCMapping] | undefined {
    // First check if it's a direct type match
    const directMatch = this.getCCByType(config, alias.toUpperCase());
    if (directMatch) return directMatch;

    // Check aliases
    for (const [mainName, aliases] of Object.entries(config.aliases)) {
      if (
        mainName === alias.toLowerCase() ||
        aliases.includes(alias.toLowerCase())
      ) {
        // Find the CC with this type
        const upperMainName = mainName.toUpperCase();
        return this.getCCByType(config, upperMainName);
      }
    }

    return undefined;
  }

  /**
   * Get human-readable CC description
   */
  getCCDescription(config: MidiCCConfig, ccNumber: number): string {
    const mapping = this.getCCMapping(config, ccNumber);
    if (!mapping) {
      return `CC${ccNumber} (Undefined)`;
    }

    const category = config.categories[mapping.category];
    return `CC${ccNumber}: ${mapping.name} (${category?.name || mapping.category})`;
  }

  /**
   * Validate CC configuration
   */
  private validateCCConfig(config: MidiCCConfig): void {
    if (!config.name || !config.version) {
      throw new Error('CC config missing required name or version');
    }

    if (!config.mappings || typeof config.mappings !== 'object') {
      throw new Error('CC config missing mappings object');
    }

    // Validate each mapping
    for (const [ccStr, mapping] of Object.entries(config.mappings)) {
      const ccNumber = parseInt(ccStr, 10);
      if (isNaN(ccNumber) || ccNumber < 0 || ccNumber > 127) {
        throw new Error(`Invalid CC number: ${ccStr}`);
      }

      if (!mapping.name || !mapping.type || !mapping.category) {
        throw new Error(`CC${ccNumber} missing required fields`);
      }

      if (!Array.isArray(mapping.range) || mapping.range.length !== 2) {
        throw new Error(`CC${ccNumber} has invalid range`);
      }

      const [min, max] = mapping.range;
      if (min < 0 || max > 127 || min > max) {
        throw new Error(`CC${ccNumber} has invalid range values`);
      }

      if (mapping.default < min || mapping.default > max) {
        throw new Error(`CC${ccNumber} default value outside range`);
      }
    }

    logger.info('CC configuration validated successfully');
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.configCache.clear();
    this.ccLookupCache.clear();
    logger.info('CC loader cache cleared');
  }

  /**
   * Get standard CC enum value
   */
  getStandardCC(ccNumber: number): StandardCC | undefined {
    return StandardCC[StandardCC[ccNumber] as keyof typeof StandardCC];
  }
}
