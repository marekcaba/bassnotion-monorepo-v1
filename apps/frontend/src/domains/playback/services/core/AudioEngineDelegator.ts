/**
 * AudioEngine Delegator
 * 
 * Delegation layer that allows gradual migration from the monolithic AudioEngine
 * to the new modular audio-engine module while maintaining backward compatibility.
 * 
 * This service:
 * - Uses feature flags to decide between legacy and modular implementations
 * - Provides the same interface as the original AudioEngine
 * - Enables A/B testing and gradual rollout
 * - Maintains all existing functionality during migration
 */

import type { Service, ServiceConfig, HealthCheckResult } from './ServiceRegistry.js';
import { featureFlags } from '../../config/featureFlags.js';
import { getLogger } from '@/utils/logger.js';

// Legacy AudioEngine import
import { AudioEngine as LegacyAudioEngine } from './AudioEngine.js';

// Modular audio-engine imports
import type { AudioEngine as ModularAudioEngine } from '../../modules/audio-engine/index.js';
import { 
  AudioContextManager,
  ToneWrapper,
  AudioNodeManager,
  EffectsChain,
  MixerNode,
  VolumeControl
} from '../../modules/audio-engine/index.js';

export interface AudioEngineConfig {
  sampleRate?: number;
  latencyHint?: 'interactive' | 'balanced' | 'playback';
  maxInitRetries?: number;
  initRetryDelay?: number;
  enableBrowserCheck?: boolean;
  enableValidation?: boolean;
}

/**
 * Delegator that routes calls to either legacy or modular audio engine
 */
export class AudioEngineDelegator implements Service {
  private legacyEngine: LegacyAudioEngine | null = null;
  private modularEngine: ModularAudioEngine | null = null;
  private logger = getLogger('audio-engine-delegator');
  private isInitialized = false;
  private isRunning = false;
  private config: AudioEngineConfig;

  constructor(config: AudioEngineConfig = {}) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const useModularEngine = featureFlags.newAudioArchitecture;
    
    try {
      if (useModularEngine) {
        await this.initializeModularEngine();
        this.logger.info('Modular AudioEngine initialized');
      } else {
        await this.initializeLegacyEngine();
        this.logger.info('Legacy AudioEngine initialized');
      }

      this.isInitialized = true;
    } catch (error) {
      this.logger.error('Failed to initialize AudioEngine:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('AudioEngine not initialized');
    }

    if (this.isRunning) return;

    const useModularEngine = featureFlags.newAudioArchitecture;

    if (useModularEngine && this.modularEngine) {
      await this.modularEngine.start();
    } else if (this.legacyEngine) {
      await this.legacyEngine.start();
    }

    this.isRunning = true;
    this.logger.info('AudioEngine started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    const useModularEngine = featureFlags.newAudioArchitecture;

    if (useModularEngine && this.modularEngine) {
      await this.modularEngine.stop();
    } else if (this.legacyEngine) {
      await this.legacyEngine.stop();
    }

    this.isRunning = false;
    this.logger.info('AudioEngine stopped');
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  async dispose(): Promise<void> {
    await this.stop();

    if (this.modularEngine) {
      await this.modularEngine.dispose();
      this.modularEngine = null;
    }

    if (this.legacyEngine) {
      await this.legacyEngine.dispose();
      this.legacyEngine = null;
    }

    this.isInitialized = false;
    this.logger.info('AudioEngine disposed');
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const useModularEngine = featureFlags.newAudioArchitecture;
    let engineHealth: HealthCheckResult;

    if (useModularEngine && this.modularEngine) {
      engineHealth = await this.modularEngine.healthCheck();
    } else if (this.legacyEngine) {
      engineHealth = await this.legacyEngine.healthCheck();
    } else {
      return {
        status: 'unhealthy',
        message: 'No AudioEngine available',
        details: { useModularEngine, hasModular: !!this.modularEngine, hasLegacy: !!this.legacyEngine },
        timestamp: Date.now(),
      };
    }

    return {
      ...engineHealth,
      details: {
        ...engineHealth.details,
        delegatorInfo: {
          useModularEngine,
          hasModular: !!this.modularEngine,
          hasLegacy: !!this.legacyEngine,
        },
      },
    };
  }

  getConfig(): ServiceConfig {
    const useModularEngine = featureFlags.newAudioArchitecture;

    if (useModularEngine && this.modularEngine) {
      return this.modularEngine.getConfig();
    } else if (this.legacyEngine) {
      return this.legacyEngine.getConfig();
    }

    return {
      isRunning: this.isRunning,
    };
  }

  // AudioEngine-specific methods that delegate to the appropriate implementation

  /**
   * Get audio context
   */
  getAudioContext(): AudioContext | null {
    const useModularEngine = featureFlags.newAudioArchitecture;

    if (useModularEngine && this.modularEngine) {
      return (this.modularEngine as any).getAudioContext?.() || null;
    } else if (this.legacyEngine) {
      return (this.legacyEngine as any).getAudioContext?.() || null;
    }

    return null;
  }

  /**
   * Get Tone.js instance
   */
  getTone(): any {
    const useModularEngine = featureFlags.newAudioArchitecture;

    if (useModularEngine && this.modularEngine) {
      return (this.modularEngine as any).getTone?.() || null;
    } else if (this.legacyEngine) {
      return (this.legacyEngine as any).getTone?.() || null;
    }

    return null;
  }

  /**
   * Create audio sampler
   */
  createSampler(config: any): any {
    const useModularEngine = featureFlags.newAudioArchitecture;

    if (useModularEngine && this.modularEngine) {
      return (this.modularEngine as any).createSampler?.(config) || null;
    } else if (this.legacyEngine) {
      return (this.legacyEngine as any).createSampler?.(config) || null;
    }

    return null;
  }

  /**
   * Set master volume
   */
  setMasterVolume(volume: number): void {
    const useModularEngine = featureFlags.newAudioArchitecture;

    if (useModularEngine && this.modularEngine) {
      (this.modularEngine as any).setMasterVolume?.(volume);
    } else if (this.legacyEngine) {
      (this.legacyEngine as any).setMasterVolume?.(volume);
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics(): any {
    const useModularEngine = featureFlags.newAudioArchitecture;

    if (useModularEngine && this.modularEngine) {
      return (this.modularEngine as any).getMetrics?.() || {};
    } else if (this.legacyEngine) {
      return (this.legacyEngine as any).getMetrics?.() || {};
    }

    return {};
  }

  private async initializeLegacyEngine(): Promise<void> {
    this.legacyEngine = new LegacyAudioEngine(this.config);
    await this.legacyEngine.initialize();
  }

  private async initializeModularEngine(): Promise<void> {
    // Create a modular engine using the components
    // This is a simplified implementation - would need full ModularAudioEngine class
    const contextManager = new AudioContextManager({
      sampleRate: this.config.sampleRate,
      latencyHint: this.config.latencyHint,
    });
    
    const toneWrapper = new ToneWrapper();
    const nodeManager = new AudioNodeManager();
    const effectsChain = new EffectsChain();
    const mixer = new MixerNode();
    const volumeControl = new VolumeControl();

    // Initialize components
    await contextManager.initialize();
    await toneWrapper.initialize(contextManager.getContext());
    await nodeManager.initialize(contextManager.getContext());
    await effectsChain.initialize(contextManager.getContext());
    await mixer.initialize(contextManager.getContext());
    await volumeControl.initialize(contextManager.getContext());

    // Create a simple modular engine wrapper
    this.modularEngine = {
      async initialize() {},
      async start() {},
      async stop() {},
      async restart() {},
      async dispose() {
        await Promise.all([
          contextManager.dispose(),
          toneWrapper.dispose(),
          nodeManager.dispose(),
          effectsChain.dispose(),
          mixer.dispose(),
          volumeControl.dispose(),
        ]);
      },
      async healthCheck(): Promise<HealthCheckResult> {
        return {
          status: 'healthy',
          message: 'Modular AudioEngine operating normally',
          details: {
            contextState: contextManager.getState(),
            toneState: toneWrapper.isInitialized(),
          },
          timestamp: Date.now(),
        };
      },
      getConfig(): ServiceConfig {
        return {
          isRunning: true,
          components: {
            contextManager: contextManager.isInitialized(),
            toneWrapper: toneWrapper.isInitialized(),
            nodeManager: nodeManager.isInitialized(),
            effectsChain: effectsChain.isInitialized(),
            mixer: mixer.isInitialized(),
            volumeControl: volumeControl.isInitialized(),
          },
        };
      },
      getAudioContext: () => contextManager.getContext(),
      getTone: () => toneWrapper.getTone(),
      createSampler: (config: any) => toneWrapper.createSampler(config),
      setMasterVolume: (volume: number) => volumeControl.setVolume(volume),
      getMetrics: () => ({
        context: contextManager.getMetrics(),
        tone: toneWrapper.getMetrics(),
        effects: effectsChain.getMetrics(),
        mixer: mixer.getMetrics(),
        volume: volumeControl.getMetrics(),
      }),
    } as ModularAudioEngine;
  }
}

/**
 * Factory function to create AudioEngine delegator
 */
export function createAudioEngine(config: AudioEngineConfig = {}): AudioEngineDelegator {
  return new AudioEngineDelegator(config);
}

// Export the delegator as the default AudioEngine
export { AudioEngineDelegator as AudioEngine };