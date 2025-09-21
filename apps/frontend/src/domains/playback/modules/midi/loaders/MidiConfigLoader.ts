/**
 * MIDI Configuration Loader
 *
 * Central loader for all MIDI-related configurations.
 * Manages loading and caching of CC mappings, instruments, meta events, and notes.
 */

import { MidiCCLoader } from './MidiCCLoader.js';
import type { MidiCCConfig } from '../types/midi-cc.types.js';
import type {
  GMInstrumentConfig,
  MetaEventConfig,
  NoteMapConfig,
  MidiConfigResult,
  ExtendedMidiConfig,
  GMInstrument,
  MetaEventDef,
  NoteDef,
} from '../types/midi-config.types.js';
import { createStructuredLogger } from '../../shared/index.js';

const logger = createStructuredLogger('MidiConfigLoader');

export interface MidiConfigLoaderOptions {
  cache?: boolean;
  validate?: boolean;
  basePath?: string;
}

export class MidiConfigLoader {
  private static instance: MidiConfigLoader;
  private ccLoader: MidiCCLoader;
  private configCache: Map<string, any> = new Map();
  private options: MidiConfigLoaderOptions;
  private basePath: string;

  private constructor(options: MidiConfigLoaderOptions = {}) {
    this.options = {
      cache: true,
      validate: true,
      basePath: '/data/midi',
      ...options,
    };
    this.basePath = this.options.basePath || '/data/midi';
    this.ccLoader = MidiCCLoader.getInstance(options);
  }

  static getInstance(options?: MidiConfigLoaderOptions): MidiConfigLoader {
    if (!MidiConfigLoader.instance) {
      MidiConfigLoader.instance = new MidiConfigLoader(options);
    }
    return MidiConfigLoader.instance;
  }

  /**
   * Load all MIDI configurations
   */
  async loadAllConfigs(): Promise<MidiConfigResult> {
    const [cc, instruments, metaEvents, notes] = await Promise.all([
      this.loadCCConfig(),
      this.loadInstrumentsConfig(),
      this.loadMetaEventsConfig(),
      this.loadNotesConfig(),
    ]);

    return {
      cc,
      instruments,
      metaEvents,
      notes,
    };
  }

  /**
   * Load CC configuration (delegates to MidiCCLoader)
   */
  async loadCCConfig(path?: string): Promise<MidiCCConfig> {
    const configPath = path || `${this.basePath}/cc-mappings.json`;
    return this.ccLoader.loadCCConfig(configPath);
  }

  /**
   * Load General MIDI instruments configuration
   */
  async loadInstrumentsConfig(path?: string): Promise<GMInstrumentConfig> {
    const configPath = path || `${this.basePath}/gm-instruments.json`;
    return this.loadConfig<GMInstrumentConfig>(configPath, 'instruments');
  }

  /**
   * Load meta events configuration
   */
  async loadMetaEventsConfig(path?: string): Promise<MetaEventConfig> {
    const configPath = path || `${this.basePath}/meta-events.json`;
    return this.loadConfig<MetaEventConfig>(configPath, 'metaEvents');
  }

  /**
   * Load note mappings configuration
   */
  async loadNotesConfig(path?: string): Promise<NoteMapConfig> {
    const configPath = path || `${this.basePath}/note-mappings.json`;
    return this.loadConfig<NoteMapConfig>(configPath, 'notes');
  }

  /**
   * Load extended configuration (like bass-cc-mappings.json)
   */
  async loadExtendedConfig(path: string): Promise<ExtendedMidiConfig> {
    const config = await this.loadConfig<ExtendedMidiConfig>(path, 'extended');

    // Handle inheritance if specified
    if (config.extends) {
      const baseConfig = await this.loadConfig<ExtendedMidiConfig>(
        config.extends,
        'extended-base',
      );
      // Merge configurations
      return this.mergeConfigs(baseConfig, config);
    }

    return config;
  }

  /**
   * Generic configuration loader
   */
  private async loadConfig<T>(path: string, type: string): Promise<T> {
    const cacheKey = `${type}:${path}`;

    // Check cache
    if (this.options.cache && this.configCache.has(cacheKey)) {
      logger.debug('Returning cached config', { type, path });
      return this.configCache.get(cacheKey);
    }

    try {
      logger.info('Loading MIDI configuration', { type, path });

      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Failed to load config: ${response.statusText}`);
      }

      const config: T = await response.json();

      // Validate if enabled
      if (this.options.validate) {
        this.validateConfig(config, type);
      }

      // Cache the config
      if (this.options.cache) {
        this.configCache.set(cacheKey, config);
      }

      logger.info('MIDI configuration loaded', { type, path });
      return config;
    } catch (error) {
      logger.error('Failed to load MIDI configuration', {
        type,
        path,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Merge extended configuration with base
   */
  private mergeConfigs(
    base: ExtendedMidiConfig,
    extended: ExtendedMidiConfig,
  ): ExtendedMidiConfig {
    return {
      ...base,
      ...extended,
      mappings: {
        ...base.mappings,
        ...extended.mappings,
      },
      presets: {
        ...base.presets,
        ...extended.presets,
      },
    };
  }

  /**
   * Validate configuration based on type
   */
  private validateConfig(config: any, type: string): void {
    switch (type) {
      case 'instruments':
        this.validateInstrumentsConfig(config);
        break;
      case 'metaEvents':
        this.validateMetaEventsConfig(config);
        break;
      case 'notes':
        this.validateNotesConfig(config);
        break;
      default:
        // Basic validation
        if (!config.name || !config.version) {
          throw new Error(`Config missing required name or version`);
        }
    }
  }

  /**
   * Validate instruments configuration
   */
  private validateInstrumentsConfig(config: GMInstrumentConfig): void {
    if (!Array.isArray(config.instruments)) {
      throw new Error('Instruments config missing instruments array');
    }

    config.instruments.forEach((inst, index) => {
      if (
        typeof inst.program !== 'number' ||
        inst.program < 0 ||
        inst.program > 127
      ) {
        throw new Error(`Invalid program number at index ${index}`);
      }
      if (!inst.name || !inst.category || !inst.family) {
        throw new Error(`Instrument at index ${index} missing required fields`);
      }
    });
  }

  /**
   * Validate meta events configuration
   */
  private validateMetaEventsConfig(config: MetaEventConfig): void {
    if (!config.events || typeof config.events !== 'object') {
      throw new Error('Meta events config missing events object');
    }

    Object.entries(config.events).forEach(([key, event]) => {
      if (!event.name || !event.type || !event.category) {
        throw new Error(`Meta event ${key} missing required fields`);
      }
    });
  }

  /**
   * Validate notes configuration
   */
  private validateNotesConfig(config: NoteMapConfig): void {
    if (!config.notes || typeof config.notes !== 'object') {
      throw new Error('Notes config missing notes object');
    }

    Object.entries(config.notes).forEach(([key, note]) => {
      const noteNum = parseInt(key, 10);
      if (isNaN(noteNum) || noteNum < 0 || noteNum > 127) {
        throw new Error(`Invalid note number: ${key}`);
      }
      if (!note.name || typeof note.frequency !== 'number') {
        throw new Error(`Note ${key} missing required fields`);
      }
    });
  }

  // Helper methods for common lookups

  /**
   * Get instrument by program number
   */
  getInstrument(
    config: GMInstrumentConfig,
    program: number,
  ): GMInstrument | undefined {
    return config.instruments.find((inst) => inst.program === program);
  }

  /**
   * Get instruments by category
   */
  getInstrumentsByCategory(
    config: GMInstrumentConfig,
    category: string,
  ): GMInstrument[] {
    return config.instruments.filter((inst) => inst.category === category);
  }

  /**
   * Get instruments by family
   */
  getInstrumentsByFamily(
    config: GMInstrumentConfig,
    family: string,
  ): GMInstrument[] {
    return config.instruments.filter((inst) => inst.family === family);
  }

  /**
   * Get meta event by hex code
   */
  getMetaEvent(
    config: MetaEventConfig,
    hexCode: string,
  ): MetaEventDef | undefined {
    return config.events[hexCode];
  }

  /**
   * Get note definition by MIDI number
   */
  getNote(config: NoteMapConfig, noteNumber: number): NoteDef | undefined {
    return config.notes[noteNumber.toString()];
  }

  /**
   * Get note name with octave
   */
  getNoteName(noteNumber: number): string {
    const noteNames = [
      'C',
      'C#',
      'D',
      'D#',
      'E',
      'F',
      'F#',
      'G',
      'G#',
      'A',
      'A#',
      'B',
    ];
    const octave = Math.floor(noteNumber / 12) - 1;
    const noteName = noteNames[noteNumber % 12];
    return `${noteName}${octave}`;
  }

  /**
   * Get frequency for MIDI note
   */
  getNoteFrequency(noteNumber: number): number {
    // A4 (MIDI 69) = 440 Hz
    return 440 * Math.pow(2, (noteNumber - 69) / 12);
  }

  /**
   * Get key signature name
   */
  getKeySignature(
    config: MetaEventConfig,
    sharpsFlats: number,
    mode: 'major' | 'minor',
  ): string {
    const key = config.keySignatures[sharpsFlats.toString()];
    return key ? key[mode] : 'Unknown';
  }

  /**
   * Get tempo marking
   */
  getTempoMarking(config: MetaEventConfig, bpm: number): string {
    for (const [marking, def] of Object.entries(config.commonTempos)) {
      if (bpm >= def.bpm[0] && bpm <= def.bpm[1]) {
        return marking;
      }
    }
    return 'Unknown';
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.configCache.clear();
    this.ccLoader.clearCache();
    logger.info('All MIDI configuration caches cleared');
  }
}
