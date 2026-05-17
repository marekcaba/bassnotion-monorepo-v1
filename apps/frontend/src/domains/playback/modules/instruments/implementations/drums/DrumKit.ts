/**
 * DrumKit Instrument
 *
 * Now loads configuration from external JSON files using DrumKitConfigLoader.
 * This implementation maintains backward compatibility while using data-driven
 * configuration.
 */

import { BaseInstrument } from '../../base/Instrument.js';
import type {
  InstrumentConfig,
  InstrumentEvent,
  InstrumentMetrics,
} from '../../types/index.js';
import type { DrumEvent, DrumKitConfig } from '../../types/index.js';
import { DrumInstrumentProcessor } from './DrumInstrumentProcessor.js';
import { DrumKitConfigLoader } from '../../loaders/DrumKitConfigLoader.js';
import type {
  DrumKitConfig as ExternalDrumKitConfig,
  DrumPiece,
} from '../../types/drum-kit.types.js';
import { createStructuredLogger } from '../../../shared/index.js';

const logger = createStructuredLogger('DrumKit');

export interface DrumKitInstrumentConfig extends InstrumentConfig {
  type: 'drums';
  kitConfigPath?: string; // Path to drum kit JSON config
  kit?: {
    // Backward compatibility - inline config
    name: string;
    samples: {
      kick: string[];
      snare: string[];
      hihat: string[];
      openHihat: string[];
      crash: string[];
      ride: string[];
      tom1: string[];
      tom2: string[];
      tom3: string[];
      rimshot: string[];
      clap: string[];
      cowbell: string[];
      tambourine: string[];
      shaker: string[];
    };
  };
  grooveStyle?: string;
  swingAmount?: number;
  humanization?: number;
  velocityLayers?: number;
  roundRobin?: boolean;
  baseUrl?: string; // Base URL for sample loading
}

/**
 * DrumKit instrument implementation with external config support
 */
export class DrumKit extends BaseInstrument {
  private processor: DrumInstrumentProcessor;
  private kitConfig: ExternalDrumKitConfig | null = null;
  private loader: DrumKitConfigLoader;
  private grooveStyle: string;
  private swingAmount: number;
  private humanization: number;
  private audioEngine?: any;
  private baseUrl: string;
  private configPath?: string;
  private kitSamples: Record<string, string[]>; // For backward compatibility

  constructor(config: DrumKitInstrumentConfig, audioEngine?: any) {
    super(config);

    this.audioEngine = audioEngine;
    this.loader = DrumKitConfigLoader.getInstance();
    this.grooveStyle = config.grooveStyle || 'straight';
    this.swingAmount = config.swingAmount || 0;
    this.humanization = config.humanization || 0.1;
    this.configPath = config.kitConfigPath;
    this.baseUrl = config.baseUrl || '/samples/drums';
    this.kitSamples = config.kit?.samples || {}; // For backward compatibility

    // Create processor with configuration
    this.processor = new DrumInstrumentProcessor(
      {
        generalMidiCompliance: true,
        velocityLayers: config.velocityLayers || 4,
        humanizationAmount: config.humanization || 0.1,
        loopLength: '4-bars' as any,
        mode: 'pattern' as any,
        grooveStyle: this.grooveStyle as any,
        swingAmount: this.swingAmount,
        fillTriggerMode: 'automatic' as any,
        individualVolumes: this.createDefaultVolumes(),
      },
      this.audioEngine,
    );
  }

  async initialize(audioEngine?: any): Promise<void> {
    if (this._state.isInitialized) return;

    // Store audioEngine if provided
    if (audioEngine) {
      this.audioEngine = audioEngine;
    } else if (!this.audioEngine && typeof window !== 'undefined') {
      // Try to get from global DI if no audioEngine provided
      const globalServices =
        window.__coreServices || window.__globalCoreServices;
      if (
        globalServices &&
        typeof globalServices === 'object' &&
        'getAudioEngine' in globalServices
      ) {
        this.audioEngine = (
          globalServices as { getAudioEngine: () => unknown }
        ).getAudioEngine();
      }
    }

    this._state.isLoading = true;

    try {
      // Load configuration from JSON if path provided
      if (this.configPath) {
        this.kitConfig = await this.loader.loadDrumKitConfig(this.configPath);
        logger.info('Loaded drum kit configuration', {
          name: this.kitConfig.name,
          version: this.kitConfig.version,
          pieces: Object.keys(this.kitConfig.pieces).length,
        });

        // Update settings from config
        if (this.kitConfig.settings) {
          this.humanization = this.kitConfig.settings.humanizeAmount / 100;
          this.swingAmount = this.kitConfig.settings.swingAmount;
        }
      }

      // Build drum samples for processor
      const drumSamples = await this.buildDrumSamples();

      await this.processor.initialize(drumSamples, this.audioEngine);

      this._state.isInitialized = true;
      this._state.isLoading = false;

      logger.info('DrumKit initialized successfully', {
        kitName: this.kitConfig?.name || 'inline',
        samplesLoaded: Object.keys(drumSamples).length,
      });
    } catch (error) {
      this._state.isLoading = false;
      this._state.error = `Failed to initialize drum kit: ${error}`;
      logger.error('DrumKit initialization failed', { error });
      throw error;
    }
  }

  /**
   * Build drum samples from configuration
   */
  private async buildDrumSamples(): Promise<Record<any, string[]>> {
    const drumSamples: Record<any, string[]> = {};

    if (this.kitConfig) {
      // Load from external config
      const sampleUrls = this.loader.buildSampleUrls(
        this.kitConfig,
        this.baseUrl,
      );

      // Map drum pieces to processor format
      const drumMapping = this.getDrumMapping();

      for (const [pieceName, piece] of Object.entries(this.kitConfig.pieces)) {
        const drumType = drumMapping[pieceName];
        if (!drumType) {
          logger.warn(`Unknown drum piece: ${pieceName}`);
          continue;
        }

        // Get URLs for all velocity layers
        const pieceUrls = sampleUrls.get(pieceName);
        if (pieceUrls) {
          drumSamples[drumType] = Array.from(pieceUrls.values());
        }
      }
    } else {
      // Fallback to inline config (backward compatibility)
      logger.debug('Using inline drum kit configuration');
      const drumMapping = this.getDrumMapping();

      for (const [drumName, drumPiece] of Object.entries(drumMapping)) {
        const samples = this.kitSamples[drumName];
        if (samples && samples.length > 0) {
          drumSamples[drumPiece as any] = samples;
        }
      }
    }

    return drumSamples;
  }

  /**
   * Get drum name to processor enum mapping
   */
  private getDrumMapping(): Record<string, string> {
    return {
      kick: 'KICK',
      snare: 'SNARE',
      hihat: 'HIHAT',
      'hihat-open': 'HIHAT_OPEN',
      openHihat: 'HIHAT_OPEN', // alias
      crash: 'CRASH_1',
      ride: 'RIDE',
      tom1: 'TOM_1',
      tom2: 'TOM_2',
      tom3: 'TOM_3',
      rimshot: 'RIMSHOT',
      clap: 'CLAP',
      cowbell: 'COWBELL',
      tambourine: 'TAMBOURINE',
      shaker: 'SHAKER',
    };
  }

  trigger(event: InstrumentEvent): void {
    if (!this._state.isInitialized) {
      logger.warn(`DrumKit ${this.name} not initialized`);
      return;
    }

    // Extract drum-specific data
    const drumEvent = event.data as DrumEvent;
    const drumPiece = drumEvent?.drum || 'kick';
    const velocity = event.velocity || 0.8;

    // If we have a config, apply velocity-based sample selection
    if (this.kitConfig && drumPiece) {
      const piece = this.kitConfig.pieces[drumPiece];
      if (piece) {
        // Convert velocity to 0-127 range
        const midiVelocity = Math.round(velocity * 127);

        // Let the loader select the appropriate sample
        const selectedSample = this.loader.getSampleForVelocity(
          piece,
          midiVelocity,
        );
        logger.debug('Selected sample for velocity', {
          drum: drumPiece,
          velocity: midiVelocity,
          sample: selectedSample,
        });
      }
    }

    // Call processor's trigger method
    this.processor.triggerDrum({
      drum: drumPiece,
      velocity: velocity,
      time: event.audioTime,
      duration:
        (typeof event.duration === 'string' ? event.duration : undefined) ||
        '16n',
    });

    this._state.isPlaying = true;
  }

  /**
   * Trigger specific drum piece
   */
  triggerDrum(drum: string, velocity = 0.8, time?: number): void {
    if (!this._state.isInitialized) {
      logger.warn('DrumKit not initialized');
      return;
    }

    // Apply configuration-based enhancements
    let finalVelocity = velocity;
    if (this.kitConfig) {
      const piece = this.kitConfig.pieces[drum];
      if (piece) {
        // Apply piece-specific volume adjustment
        const volumeMultiplier = Math.pow(10, piece.volume / 20);
        finalVelocity = velocity * volumeMultiplier;
      }
    }

    this.processor.triggerDrum({
      drum,
      velocity: finalVelocity,
      time: time || Date.now() / 1000,
      duration: '16n',
    });
  }

  /**
   * Trigger drum by MIDI note number
   */
  triggerByNote(noteNumber: number, velocity = 0.8, time?: number): void {
    if (!this.kitConfig) {
      logger.warn('No drum kit configuration loaded');
      return;
    }

    const drumPiece = this.loader.getDrumPieceByNote(
      this.kitConfig,
      noteNumber,
    );
    if (drumPiece) {
      const [name] = drumPiece;
      this.triggerDrum(name, velocity, time);
    } else {
      logger.warn(`No drum mapped to MIDI note ${noteNumber}`);
    }
  }

  /**
   * Set groove style
   */
  setGrooveStyle(style: string): void {
    this.grooveStyle = style;
    // Update processor if it has this method
    if ((this.processor as any).setGrooveStyle) {
      (this.processor as any).setGrooveStyle(style);
    }
  }

  /**
   * Set swing amount
   */
  setSwingAmount(amount: number): void {
    this.swingAmount = Math.max(0, Math.min(100, amount));
    // Update processor if it has this method
    if ((this.processor as any).setSwingAmount) {
      (this.processor as any).setSwingAmount(this.swingAmount);
    }
  }

  /**
   * Set individual drum volumes
   */
  setDrumVolume(drum: string, volume: number): void {
    if (this.kitConfig) {
      const piece = this.kitConfig.pieces[drum];
      if (piece) {
        piece.volume = volume;
      }
    }

    // Update processor if it has this method
    if ((this.processor as any).setDrumVolume) {
      (this.processor as any).setDrumVolume(drum, volume);
    }
  }

  updateParams(params: Partial<DrumKitInstrumentConfig>): void {
    // Update base parameters
    if (params.volume !== undefined) {
      this.setVolume(params.volume);
    }
    if (params.pan !== undefined) {
      this.setPan(params.pan);
    }
    if (params.muted !== undefined) {
      this.setMuted(params.muted);
    }

    // Update drum-specific parameters
    if (params.grooveStyle !== undefined) {
      this.setGrooveStyle(params.grooveStyle);
    }

    if (params.swingAmount !== undefined) {
      this.setSwingAmount(params.swingAmount);
    }

    if (params.kit?.samples) {
      this.kitSamples = params.kit.samples;
      // Would need to reinitialize with new samples
    }

    if (params.humanization !== undefined) {
      this.humanization = params.humanization;
    }
  }

  async dispose(): Promise<void> {
    this.processor.dispose();
    this._state.isInitialized = false;
    this._state.isPlaying = false;
  }

  connect(destination: any): void {
    this._destination = destination;
    // Processor handles its own connections internally
  }

  disconnect(): void {
    this._destination = null;
    // Processor handles its own connections internally
  }

  protected applyVolume(): void {
    // Update master volume on processor
    if ((this.processor as any).setMasterVolume) {
      (this.processor as any).setMasterVolume(this._volume);
    }
  }

  protected applyPan(): void {
    // Drums typically use stereo positioning per piece
    // Could be implemented with custom audio routing
  }

  protected applyMute(): void {
    if (this._muted && this._state.isPlaying) {
      // Stop all playing drums
      this.processor.stop();
    }
  }

  getMetrics(): InstrumentMetrics {
    const baseMetrics = super.getMetrics();
    const kitInfo = this.getKitInfo();

    return {
      ...baseMetrics,
      cpuUsage: this._state.isPlaying ? 5 : 0,
      memoryUsage: kitInfo.totalSamples * 0.5, // Estimate 0.5MB per sample
      voiceCount: this._state.isPlaying ? 1 : 0,
      latency: 10,
    };
  }

  /**
   * Get current kit information
   */
  getKitInfo(): {
    name: string;
    version: string;
    totalSamples: number;
    loadedDrums: string[];
    settings: any;
  } {
    if (this.kitConfig) {
      const totalSamples = Object.values(this.kitConfig.pieces).reduce(
        (total, piece) => total + Object.keys(piece.samples).length,
        0,
      );

      return {
        name: this.kitConfig.name,
        version: this.kitConfig.version,
        totalSamples,
        loadedDrums: Object.keys(this.kitConfig.pieces),
        settings: this.kitConfig.settings,
      };
    }

    // Fallback to inline config info
    return {
      name: this.name,
      version: '0.0.0',
      totalSamples: Object.values(this.kitSamples).reduce(
        (total, samples) => total + samples.length,
        0,
      ),
      loadedDrums: Object.keys(this.kitSamples),
      settings: {
        humanizeAmount: this.humanization * 100,
        swingAmount: this.swingAmount,
      },
    };
  }

  /**
   * Get available drum pieces
   */
  getAvailableDrums(): string[] {
    return this.kitConfig
      ? Object.keys(this.kitConfig.pieces)
      : Object.keys(this.kitSamples);
  }

  /**
   * Load a different drum kit
   */
  async loadKit(configPathOrConfig: string | DrumKitConfig): Promise<void> {
    if (typeof configPathOrConfig === 'string') {
      // Load from external JSON config
      this.configPath = configPathOrConfig;
      this._state.isInitialized = false;
      await this.initialize();
    } else {
      // Backward compatibility - load from inline config
      this.kitSamples = Object.entries(configPathOrConfig.samples).reduce(
        (acc, [key, value]) => {
          acc[key] = Array.isArray(value) ? value : [value];
          return acc;
        },
        {} as Record<string, string[]>,
      );

      if (this._state.isInitialized) {
        // Reinitialize with new samples
        await this.initialize();
      }
    }
  }

  private createDefaultVolumes() {
    return {
      kick: 0.9,
      snare: 0.8,
      hihat: 0.6,
      openHat: 0.7,
      crash: 0.8,
      ride: 0.7,
      tom1: 0.7,
      tom2: 0.7,
      tom3: 0.7,
      clap: 0.6,
      cowbell: 0.5,
      tambourine: 0.4,
      master: 0.8,
    };
  }
}
