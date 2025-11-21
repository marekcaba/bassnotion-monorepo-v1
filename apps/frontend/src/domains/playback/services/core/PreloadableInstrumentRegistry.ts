/**
 * PreloadableInstrumentRegistry - Instrument Config Storage
 *
 * Stores instrument configurations and metadata BEFORE AudioContext is available.
 * Allows instruments to be "preloaded" as configs and instantiated lazily when needed.
 * This solves the timing issue where AudioEventRouter needs instruments before widgets load.
 */

import { getLogger } from '@/utils/logger.js';
import type { EventBus } from './EventBus.js';
import type { AudioEngine } from '../../modules/audio-engine/core/AudioEngine.js';

const logger = getLogger('PreloadableInstrumentRegistry');

export type InstrumentType = 'metronome' | 'drums' | 'harmony' | 'bass' | 'voice-cue';

export interface InstrumentConfig {
  type: InstrumentType;
  id: string;
  priority: number;
  factory: (context: AudioContext, audioEngine: AudioEngine) => Promise<any>;
  metadata?: {
    name?: string;
    category?: string;
    samples?: string[];
  };
}

export interface PreloadedInstrument {
  config: InstrumentConfig;
  instance?: any;
  status: 'config' | 'creating' | 'ready' | 'error';
  error?: Error;
}

/**
 * Registry for instrument configurations that can be instantiated later
 */
export class PreloadableInstrumentRegistry {
  private static instance: PreloadableInstrumentRegistry;
  private instruments = new Map<string, PreloadedInstrument>();
  private eventBus?: EventBus;
  private audioEngine?: AudioEngine;
  private isInitialized = false;

  private constructor() {
    logger.info('PreloadableInstrumentRegistry created');
    // Make available in window for debugging
    if (typeof window !== 'undefined') {
      (window as any).__preloadableRegistry = this;
    }
  }

  static getInstance(): PreloadableInstrumentRegistry {
    if (!PreloadableInstrumentRegistry.instance) {
      PreloadableInstrumentRegistry.instance = new PreloadableInstrumentRegistry();
    }
    return PreloadableInstrumentRegistry.instance;
  }

  /**
   * Initialize with EventBus and AudioEngine for creating instruments
   */
  initialize(eventBus: EventBus, audioEngine: AudioEngine): void {
    this.eventBus = eventBus;
    this.audioEngine = audioEngine;
    this.isInitialized = true;
    logger.info('Registry initialized with EventBus and AudioEngine');

    // Emit event for any listeners
    eventBus.emit('preloadable-registry:initialized', {});
  }

  /**
   * Register an instrument configuration (no AudioContext needed)
   */
  registerConfig(config: InstrumentConfig): void {
    if (this.instruments.has(config.id)) {
      logger.warn(`Instrument config ${config.id} already registered, replacing`);
    }

    const preloaded: PreloadedInstrument = {
      config,
      status: 'config'
    };

    this.instruments.set(config.id, preloaded);
    logger.info(`Registered instrument config: ${config.id} (${config.type})`);

    // Emit event
    if (this.eventBus) {
      this.eventBus.emit('preloadable-registry:config-registered', {
        id: config.id,
        type: config.type
      });
    }
  }

  /**
   * Get or create an instrument instance
   * Creates the instance lazily if AudioContext is available
   */
  async getOrCreateInstrument(id: string): Promise<any> {
    const preloaded = this.instruments.get(id);
    if (!preloaded) {
      logger.warn(`No config registered for instrument: ${id}`);
      return null;
    }

    // Return existing instance if ready
    if (preloaded.status === 'ready' && preloaded.instance) {
      return preloaded.instance;
    }

    // Check if we're already creating it - return null immediately to avoid blocking
    if (preloaded.status === 'creating') {
      logger.info(`Instrument ${id} is being created, skipping this trigger`);
      return null; // Don't wait, just skip this trigger
    }

    // Check if we have AudioEngine
    if (!this.audioEngine || !this.audioEngine.isReady()) {
      logger.warn(`Cannot create instrument ${id}: AudioEngine not ready`);
      return null;
    }

    const context = this.audioEngine.getContext();
    if (!context || context.state !== 'running') {
      logger.warn(`Cannot create instrument ${id}: AudioContext state is ${context?.state}`);
      return null;
    }

    // Create the instrument
    preloaded.status = 'creating';
    logger.info(`Creating instrument ${id} with AudioContext...`);

    try {
      const instance = await preloaded.config.factory(context, this.audioEngine);
      preloaded.instance = instance;
      preloaded.status = 'ready';

      logger.info(`✅ Instrument ${id} created successfully`);

      // Emit event
      if (this.eventBus) {
        this.eventBus.emit('preloadable-registry:instrument-created', {
          id,
          type: preloaded.config.type
        });
      }

      return instance;
    } catch (error) {
      logger.error(`Failed to create instrument ${id}:`, error);
      preloaded.status = 'error';
      preloaded.error = error as Error;
      throw error;
    }
  }

  /**
   * Get instrument by type (returns first matching type)
   */
  async getOrCreateByType(type: InstrumentType): Promise<any> {
    // Find highest priority config for this type
    let bestConfig: { id: string; priority: number } | null = null;

    for (const [id, preloaded] of this.instruments) {
      if (preloaded.config.type === type) {
        if (!bestConfig || preloaded.config.priority > bestConfig.priority) {
          bestConfig = { id, priority: preloaded.config.priority };
        }
      }
    }

    if (!bestConfig) {
      logger.warn(`No instrument config found for type: ${type}`);
      return null;
    }

    return this.getOrCreateInstrument(bestConfig.id);
  }

  /**
   * Check if a config is registered
   */
  hasConfig(id: string): boolean {
    return this.instruments.has(id);
  }

  /**
   * Check if a type is registered
   */
  hasType(type: InstrumentType): boolean {
    for (const preloaded of this.instruments.values()) {
      if (preloaded.config.type === type) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get all registered configs
   */
  getAllConfigs(): InstrumentConfig[] {
    return Array.from(this.instruments.values()).map(p => p.config);
  }

  /**
   * Get status of all instruments
   */
  getStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    for (const [id, preloaded] of this.instruments) {
      status[id] = {
        type: preloaded.config.type,
        status: preloaded.status,
        hasInstance: !!preloaded.instance,
        error: preloaded.error?.message
      };
    }
    return status;
  }

  /**
   * Wait for an instrument to be ready
   */
  private async waitForInstrument(id: string, timeout: number): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const preloaded = this.instruments.get(id);
      if (!preloaded) {
        throw new Error(`Instrument ${id} not found`);
      }
      if (preloaded.status === 'ready') {
        return; // Success
      }
      if (preloaded.status === 'error') {
        throw new Error(`Instrument ${id} failed to create`);
      }
      await new Promise(resolve => setTimeout(resolve, 50)); // Shorter wait
    }
    // Reset status on timeout to allow retry
    const preloaded = this.instruments.get(id);
    if (preloaded && preloaded.status === 'creating') {
      preloaded.status = 'config';
    }
    throw new Error(`Timeout waiting for instrument ${id}`);
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.instruments.clear();
    logger.info('All instrument configs cleared');
  }
}

// Export singleton getter
export const getPreloadableRegistry = () => PreloadableInstrumentRegistry.getInstance();