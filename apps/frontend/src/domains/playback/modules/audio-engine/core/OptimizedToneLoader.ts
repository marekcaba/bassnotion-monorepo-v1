/**
 * Optimized Tone.js Loader
 *
 * Provides granular loading of Tone.js modules for optimal bundle size
 */

import { createStructuredLogger } from '../../shared/index.js';

const logger = createStructuredLogger('OptimizedToneLoader');

// Module paths for selective imports
const TONE_MODULES = {
  // Core modules
  context: () =>
    import(
      /* webpackChunkName: "tone-context" */ 'tone/build/esm/core/context/Context'
    ),
  transport: () =>
    import(
      /* webpackChunkName: "tone-transport" */ 'tone/build/esm/core/clock/Transport'
    ),
  global: () =>
    import(/* webpackChunkName: "tone-global" */ 'tone/build/esm/core/Global'),

  // Instruments
  sampler: () =>
    import(
      /* webpackChunkName: "tone-sampler" */ 'tone/build/esm/instrument/Sampler'
    ),
  synth: () =>
    import(
      /* webpackChunkName: "tone-synth"
       */ 'tone/build/esm/instrument/Synth'
    ),
  membraneSynth: () =>
    import(
      /* webpackChunkName: "tone-membrane" */ 'tone/build/esm/instrument/MembraneSynth'
    ),
  noiseSynth: () =>
    import(
      /* webpackChunkName: "tone-noise" */ 'tone/build/esm/instrument/NoiseSynth'
    ),

  // Effects (lazy load)
  reverb: () =>
    import(
      /* webpackChunkName: "tone-reverb" */ 'tone/build/esm/effect/Reverb'
    ),
  delay: () =>
    import(
      /* webpackChunkName: "tone-delay" */ 'tone/build/esm/effect/FeedbackDelay'
    ),
  compressor: () =>
    import(
      /* webpackChunkName: "tone-compressor" */ 'tone/build/esm/component/dynamics/Compressor'
    ),
  eq3: async () => {
    try {
      // Try EQ3 first
      return await (import(
        /* webpackChunkName: "tone-eq3" */ 'tone/build/esm/component/filter/EQ3'
      ) as Promise<any>);
    } catch {
      // Fallback to Filter if EQ3 doesn't work
      return await (import(
        /* webpackChunkName: "tone-filter" */ 'tone/build/esm/component/filter/Filter'
      ) as Promise<any>);
    }
  },
  filter: () =>
    import(
      /* webpackChunkName: "tone-filter" */ 'tone/build/esm/component/filter/Filter'
    ),

  // Components
  gain: () =>
    import(
      /* webpackChunkName: "tone-gain" */ 'tone/build/esm/core/context/Gain'
    ),
  volume: () =>
    import(
      /* webpackChunkName: "tone-volume" */ 'tone/build/esm/component/channel/Volume'
    ),
  panner: () =>
    import(
      /* webpackChunkName: "tone-panner" */ 'tone/build/esm/component/channel/Panner'
    ),
  meter: () =>
    import(
      /* webpackChunkName: "tone-meter" */ 'tone/build/esm/component/analysis/Meter'
    ),
};

export type ToneModuleName = keyof typeof TONE_MODULES;

/**
 * Module loading state
 */
interface LoadState {
  loaded: Set<ToneModuleName>;
  loading: Map<ToneModuleName, Promise<any>>;
  modules: Map<ToneModuleName, any>;
}

export class OptimizedToneLoader {
  private static instance: OptimizedToneLoader | null = null;
  private state: LoadState = {
    loaded: new Set(),
    loading: new Map(),
    modules: new Map(),
  };

  // Private constructor for singleton pattern
  private constructor() {
    // Intentionally empty
  }

  static getInstance(): OptimizedToneLoader {
    if (!OptimizedToneLoader.instance) {
      OptimizedToneLoader.instance = new OptimizedToneLoader();
    }
    return OptimizedToneLoader.instance;
  }

  /**
   * Load essential modules for basic functionality
   */
  async loadEssentials(): Promise<void> {
    await this.loadModules(['global', 'context', 'transport', 'sampler']);
  }

  /**
   * Load specific modules
   */
  async loadModules(modules: ToneModuleName[]): Promise<void> {
    const toLoad = modules.filter((m) => !this.state.loaded.has(m));

    if (toLoad.length === 0) {
      logger.debug('All requested modules already loaded');
      return;
    }

    logger.info(`Loading Tone.js modules: ${toLoad.join(', ')}`);

    const promises = toLoad.map(async (moduleName) => {
      // Check if already loading
      const existing = this.state.loading.get(moduleName);
      if (existing) return existing;

      // Start loading
      const loadPromise = TONE_MODULES[moduleName]()
        .then((module) => {
          this.state.modules.set(moduleName, module);
          this.state.loaded.add(moduleName);
          this.state.loading.delete(moduleName);
          logger.debug(`Loaded module: ${moduleName}`);
          return module;
        })
        .catch((error) => {
          logger.error(`Failed to load module ${moduleName}:`, error);
          this.state.loading.delete(moduleName);
          throw error;
        });

      this.state.loading.set(moduleName, loadPromise);
      return loadPromise;
    });

    await Promise.all(promises);
  }

  /**
   * Get a loaded module
   */
  getModule<T = any>(moduleName: ToneModuleName): T {
    if (!this.state.loaded.has(moduleName)) {
      throw new Error(
        `Module ${moduleName} not loaded. Call loadModules(['${moduleName}']) first.`,
      );
    }
    return this.state.modules.get(moduleName) as T;
  }

  /**
   * Check if module is loaded
   */
  isLoaded(moduleName: ToneModuleName): boolean {
    return this.state.loaded.has(moduleName);
  }

  /**
   * Get all loaded modules
   */
  getLoadedModules(): ToneModuleName[] {
    return Array.from(this.state.loaded);
  }

  /**
   * Create optimized Tone object with lazy loading
   */
  async createToneObject(): Promise<any> {
    // Load essentials first
    await this.loadEssentials();

    const globalModule = this.getModule('global');
    const { getContext, setContext, start } = globalModule;
    const { Transport } = this.getModule('transport');
    const { Sampler } = this.getModule('sampler');

    // Store reference to loader for use in getters
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const loader = this;

    // Create base Tone object
    const tone = {
      // Core
      start,
      getContext,
      setContext,
      context: getContext(),
      now: () => Transport.now(),

      // Transport
      Transport,

      // Instruments (loaded)
      Sampler,

      // Lazy-loaded instruments
      get Synth(): any {
        if (!loader.isLoaded('synth')) {
          throw new Error(
            'Synth not loaded. Call loadModules(["synth"]) first.',
          );
        }
        return loader.getModule('synth').Synth;
      },

      get MembraneSynth(): any {
        if (!loader.isLoaded('membraneSynth')) {
          throw new Error(
            'MembraneSynth not loaded. Call loadModules(["membraneSynth"]) first.',
          );
        }
        return loader.getModule('membraneSynth').MembraneSynth;
      },

      get NoiseSynth(): any {
        if (!loader.isLoaded('noiseSynth')) {
          throw new Error(
            'NoiseSynth not loaded. Call loadModules(["noiseSynth"]) first.',
          );
        }
        return loader.getModule('noiseSynth').NoiseSynth;
      },

      // Components (lazy)
      get Gain(): any {
        if (!loader.isLoaded('gain')) {
          throw new Error('Gain not loaded. Call loadModules(["gain"]) first.');
        }
        return loader.getModule('gain').Gain;
      },

      get Volume(): any {
        if (!loader.isLoaded('volume')) {
          throw new Error(
            'Volume not loaded. Call loadModules(["volume"]) first.',
          );
        }
        return loader.getModule('volume').Volume;
      },

      // Effects (lazy)
      get Reverb(): any {
        if (!loader.isLoaded('reverb')) {
          throw new Error(
            'Reverb not loaded. Call loadModules(["reverb"]) first.',
          );
        }
        return loader.getModule('reverb').Reverb;
      },

      get Delay(): any {
        if (!loader.isLoaded('delay')) {
          throw new Error(
            'Delay not loaded. Call loadModules(["delay"]) first.',
          );
        }
        return loader.getModule('delay').Delay;
      },

      get Compressor(): any {
        if (!loader.isLoaded('compressor')) {
          throw new Error(
            'Compressor not loaded. Call loadModules(["compressor"]) first.',
          );
        }
        return loader.getModule('compressor').Compressor;
      },

      get Filter(): any {
        if (!loader.isLoaded('filter')) {
          throw new Error(
            'Filter not loaded. Call loadModules(["filter"]) first.',
          );
        }
        return loader.getModule('filter').Filter;
      },
    };

    return tone;
  }

  /**
   * Preload modules for specific instrument type
   */
  async preloadForInstrument(instrumentType: string): Promise<void> {
    switch (instrumentType) {
      case 'bass':
        await this.loadModules(['sampler', 'filter', 'compressor', 'eq3']);
        break;
      case 'drums':
        await this.loadModules([
          'sampler',
          'membraneSynth',
          'noiseSynth',
          'compressor',
        ]);
        break;
      case 'harmony':
      case 'keyboard':
        await this.loadModules(['sampler', 'reverb', 'delay']);
        break;
      case 'metronome':
        await this.loadModules(['synth']);
        break;
      case 'audio-bass':
      case 'audio-drums':
      case 'audio-harmony':
      case 'audio-click':
        // Audio stems play decoded AudioBuffers directly via AudioPlayerScheduler
        // (LAUNCH-02.5b). No Tone synth modules required.
        return;
      default:
        logger.warn(`Unknown instrument type for preload: ${instrumentType}`);
    }
  }

  /**
   * Get bundle size statistics
   */
  getBundleStats(): { loaded: number; total: number; percentage: number } {
    const loaded = this.state.loaded.size;
    const total = Object.keys(TONE_MODULES).length;
    const percentage = Math.round((loaded / total) * 100);

    return { loaded, total, percentage };
  }
}
