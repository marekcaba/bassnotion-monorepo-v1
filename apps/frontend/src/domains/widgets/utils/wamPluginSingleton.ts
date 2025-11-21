/**
 * WAM Plugin Singleton Manager
 *
 * Ensures only one instance of each WAM plugin type exists globally
 * to prevent duplicate sample loading and memory waste
 */

import { WamKeyboard } from '@/domains/playback/modules/instruments/adapters/wam/WamKeyboard';
import { getLogger } from '@/utils/logger';
import { GlobalSampleCache } from '@/domains/playback/modules/storage';

const logger = getLogger('wam-plugin-singleton');

interface PluginInfo {
  plugin: any;
  refCount: number;
  context: AudioContext;
}

class WamPluginSingletonManager {
  private static instance: WamPluginSingletonManager;
  private plugins = new Map<string, PluginInfo>();

  private constructor() {}

  static getInstance(): WamPluginSingletonManager {
    if (!WamPluginSingletonManager.instance) {
      WamPluginSingletonManager.instance = new WamPluginSingletonManager();
    }
    return WamPluginSingletonManager.instance;
  }

  /**
   * Get or create a WamKeyboard plugin instance
   * @param context - AudioContext to use
   * @param instrument - Optional instrument type to load (defaults to grandpiano if not specified)
   */
  async getOrCreateKeyboardPlugin(
    context: AudioContext,
    instrument?: 'grandpiano' | 'rhodes' | 'wurlitzer' | 'pad',
  ): Promise<any> {
    // CHECKPOINT 7: WAM plugin loading - track singleton behavior
    console.log('🔍 [CHECKPOINT-7] getOrCreateKeyboardPlugin called:', {
      requestedInstrument: instrument,
      hasInstrument: !!instrument,
      instrumentType: typeof instrument,
      instrumentValue: instrument,
      contextState: context?.state,
      contextSampleRate: context?.sampleRate,
      hasExistingPlugin: this.plugins.has('wam-keyboard'),
    });

    console.log('🔍🔍🔍 [SINGLETON-ENTRY] getOrCreateKeyboardPlugin called', {
      requestedInstrument: instrument,
      hasInstrument: !!instrument,
      contextState: context?.state,
    });

    const key = 'wam-keyboard';
    const globalCacheKey = 'wam-keyboard-singleton';

    // First check for pre-loaded instrument from InitialSamplePreloader
    const preloadedPlugin =
      GlobalSampleCache.getCachedInstrument('harmony-preloaded');

    console.log('🔍🔍🔍 [SINGLETON-PRELOAD-CHECK] Checking preloaded plugin', {
      found: !!preloadedPlugin,
      hasAudioNode: preloadedPlugin?.audioNode !== undefined,
      requestedInstrument: instrument,
    });

    // CRITICAL DEBUGGING: Log what we actually got from the cache
    logger.info('🔍 Checking for pre-loaded harmony instrument...', {
      found: !!preloadedPlugin,
      type: preloadedPlugin ? typeof preloadedPlugin : 'undefined',
      hasAudioNode: preloadedPlugin?.audioNode !== undefined,
      keys: preloadedPlugin ? Object.keys(preloadedPlugin) : [],
      constructor: preloadedPlugin?.constructor?.name,
    });

    if (preloadedPlugin && preloadedPlugin.audioNode) {
      console.log('🔍🔍🔍 [SINGLETON-PRELOAD-FOUND] Found preloaded plugin!', {
        hasAudioNode: !!preloadedPlugin.audioNode,
        contextState: preloadedPlugin.audioNode.context?.state,
        requestedInstrument: instrument,
        loadedInstrument: preloadedPlugin.audioNode.currentInstrument,
      });

      logger.info('♻️ Found pre-loaded harmony instrument!', {
        hasAudioNode: !!preloadedPlugin.audioNode,
        contextState: preloadedPlugin.audioNode.context?.state,
        requestedInstrument: instrument,
        loadedInstrument: preloadedPlugin.audioNode.currentInstrument,
      });

      // Check if the pre-loaded plugin's context is still valid
      if (
        preloadedPlugin.audioNode.context &&
        preloadedPlugin.audioNode.context.state === 'running'
      ) {
        // CRITICAL: Check if the preloaded plugin has the correct instrument
        // If a specific instrument was requested, verify it matches
        const loadedInstrument = preloadedPlugin.audioNode.currentInstrument;
        const needsInstrumentChange = instrument && loadedInstrument !== instrument;

        console.log('🔍🔍🔍 [SINGLETON-PRELOAD-INSTRUMENT-CHECK]', {
          loadedInstrument,
          requestedInstrument: instrument,
          needsInstrumentChange,
        });

        if (needsInstrumentChange) {
          console.log('🔍🔍🔍 [SINGLETON-PRELOAD-LOADING] Loading correct instrument on preloaded plugin');
          logger.info(
            '⚠️ Preloaded plugin has wrong instrument, will load correct one',
            {
              requestedInstrument: instrument,
              loadedInstrument,
            },
          );
          // Load the correct instrument on the preloaded plugin
          await preloadedPlugin.audioNode.loadInstrument(instrument);
          console.log('🔍🔍🔍 [SINGLETON-PRELOAD-LOADED] Instrument loaded on preloaded plugin');
          logger.info('✅ Loaded correct instrument on preloaded plugin', {
            instrument,
          });
        }

        // Store in local map for reference counting
        this.plugins.set(key, {
          plugin: preloadedPlugin,
          refCount: 1,
          context: preloadedPlugin.audioNode.context,
        });
        console.log('🔍🔍🔍 [SINGLETON-PRELOAD-RETURN] Returning preloaded plugin');
        return preloadedPlugin;
      }
    }

    // Then check global cache for any existing plugin
    const cachedPlugin = GlobalSampleCache.getCachedInstrument(globalCacheKey);
    console.log('🔍🔍🔍 [SINGLETON-CACHE-CHECK] Checking cached plugin', {
      found: !!cachedPlugin,
      hasAudioNode: cachedPlugin?.audioNode !== undefined,
    });

    if (cachedPlugin && cachedPlugin.audioNode) {
      console.log('🔍🔍🔍 [SINGLETON-CACHE-FOUND] Found cached plugin!', {
        hasAudioNode: !!cachedPlugin.audioNode,
        contextState: cachedPlugin.audioNode.context?.state,
        requestedInstrument: instrument,
        loadedInstrument: cachedPlugin.audioNode.currentInstrument,
      });

      logger.debug('♻️ Found WamKeyboard plugin in GlobalSampleCache', {
        hasAudioNode: !!cachedPlugin.audioNode,
        contextState: cachedPlugin.audioNode.context?.state,
        requestedInstrument: instrument,
        loadedInstrument: cachedPlugin.audioNode.currentInstrument,
      });

      // Check if the cached plugin's context is still valid
      if (
        cachedPlugin.audioNode.context &&
        cachedPlugin.audioNode.context.state === 'running'
      ) {
        // CRITICAL: Check if the cached plugin has the correct instrument
        const loadedInstrument = cachedPlugin.audioNode.currentInstrument;
        const needsInstrumentChange = instrument && loadedInstrument !== instrument;

        if (needsInstrumentChange) {
          logger.debug(
            '⚠️ Cached plugin has wrong instrument, will load correct one',
            {
              requestedInstrument: instrument,
              loadedInstrument,
            },
          );
          // Load the correct instrument on the cached plugin
          await cachedPlugin.audioNode.loadInstrument(instrument);
          logger.debug('✅ Loaded correct instrument on cached plugin', {
            instrument,
          });
        }

        // Increment ref count in local map
        const existing = this.plugins.get(key);
        if (existing) {
          existing.refCount++;
        } else {
          this.plugins.set(key, {
            plugin: cachedPlugin,
            refCount: 1,
            context: cachedPlugin.audioNode.context,
          });
        }
        return cachedPlugin;
      } else {
        logger.warn('Cached plugin has invalid context, will create new one');
      }
    }

    // Then check local map
    const existing = this.plugins.get(key);
    if (existing) {
      // Be more lenient with context matching - accept if both are running
      if (existing.context.state === 'running' && context.state === 'running') {
        // CRITICAL: Check if the existing plugin has the correct instrument
        const loadedInstrument = existing.plugin.audioNode?.currentInstrument;
        const needsInstrumentChange = instrument && loadedInstrument !== instrument;

        if (needsInstrumentChange) {
          logger.debug(
            '⚠️ Existing plugin has wrong instrument, will load correct one',
            {
              requestedInstrument: instrument,
              loadedInstrument,
            },
          );
          // Load the correct instrument on the existing plugin
          await existing.plugin.audioNode.loadInstrument(instrument);
          logger.debug('✅ Loaded correct instrument on existing plugin', {
            instrument,
          });
        }

        existing.refCount++;
        logger.debug('♻️ Reusing existing WamKeyboard plugin', {
          refCount: existing.refCount,
          existingContextId: existing.context,
          newContextId: context,
          sameContext: existing.context === context,
          instrument: existing.plugin.audioNode?.currentInstrument,
        });
        return existing.plugin;
      } else {
        logger.warn('⚠️ Context state mismatch for WamKeyboard plugin', {
          existingState: existing.context.state,
          newState: context.state,
        });
      }
    }

    console.log('🔍🔍🔍 [SINGLETON] Creating new WamKeyboard plugin instance', {
      requestedInstrument: instrument,
      hasInstrument: !!instrument,
      instrumentType: typeof instrument,
      passedState: { instrument },
    });

    console.log('🔍 [CHECKPOINT-7-CREATE-NEW] No cached plugin found, creating new:', {
      instrument,
      contextState: context?.state,
      willPassInstrument: !!instrument,
    });

    logger.info('🔨 Creating new WamKeyboard plugin instance', {
      requestedInstrument: instrument || 'grandpiano (default)',
    });

    try {
      // CRITICAL FIX: DO NOT pass instrument to createInstance - prevents blocking network fetch
      // Plugin creation should be instant (< 100ms)
      // Instrument will be loaded separately AFTER plugin is created using cached buffers
      console.log('🔍🔍🔍 [SINGLETON] Calling WamKeyboard.createInstance WITHOUT instrument (deferred loading)');
      console.log('🔍 [CHECKPOINT-7-BEFORE-CREATE] About to call WamKeyboard.createInstance:', {
        willLoadInstrumentLater: !!instrument,
        hasContext: !!context,
      });

      // Create plugin WITHOUT instrument - this returns instantly
      const plugin = await WamKeyboard.createInstance(context, {});

      console.log('🔍🔍🔍 [SINGLETON] WamKeyboard.createInstance returned (instant!):', {
        hasPlugin: !!plugin,
        hasAudioNode: !!plugin?.audioNode,
        currentInstrument: plugin?.audioNode?.currentInstrument,
      });

      console.log('🔍 [CHECKPOINT-7-AFTER-CREATE] WamKeyboard.createInstance completed:', {
        success: !!plugin,
        hasAudioNode: !!plugin?.audioNode,
        loadedInstrument: plugin?.audioNode?.currentInstrument,
        requestedInstrument: instrument,
      });

      // CRITICAL FIX: Load instrument AFTER plugin is created
      // This allows using cached buffers from GlobalSampleCache (instant, no network)
      if (instrument && plugin.audioNode) {
        console.log('🔍 [SINGLETON-INSTRUMENT-LOAD] Loading instrument separately:', instrument);
        try {
          await plugin.audioNode.loadInstrument(instrument);
          console.log('✅ [SINGLETON-INSTRUMENT-LOAD] Instrument loaded successfully:', {
            requestedInstrument: instrument,
            actualCurrentInstrument: plugin.audioNode.currentInstrument,
            activeSampler: plugin.audioNode.activeSampler?.constructor?.name,
            samplerCount: plugin.audioNode.samplers?.size || 0,
            availableInstruments: Array.from(plugin.audioNode.samplers?.keys() || [])
          });
        } catch (error) {
          logger.error('Failed to load instrument after plugin creation', error);
          console.error('❌ [SINGLETON-INSTRUMENT-LOAD] Load failed:', {
            requestedInstrument: instrument,
            error: error instanceof Error ? error.message : String(error)
          });
          // Continue anyway - plugin is created, instrument can be loaded later
        }
      }

      // plugin.audioNode is already set by initialize() - no need to create again
      // Removed duplicate createAudioNode call that was creating a second node

      this.plugins.set(key, {
        plugin,
        refCount: 1,
        context,
      });

      // Also cache globally for persistence across re-initializations
      GlobalSampleCache.cacheInstrument(globalCacheKey, plugin);
      console.log('🔍🔍🔍 [SINGLETON-CACHE-STORED] Stored plugin in GlobalSampleCache:', {
        key: globalCacheKey,
        hasPlugin: !!plugin,
        hasAudioNode: !!plugin?.audioNode,
        currentInstrument: plugin?.audioNode?.currentInstrument,
      });

      // Verify it was actually cached
      const verifyCache = GlobalSampleCache.getCachedInstrument(globalCacheKey);
      console.log('🔍🔍🔍 [SINGLETON-CACHE-VERIFY] Immediately verified cache:', {
        found: !!verifyCache,
        hasAudioNode: verifyCache?.audioNode !== undefined,
      });

      logger.info(
        '✅ Created and cached new WamKeyboard plugin (locally and globally)',
      );
      return plugin;
    } catch (error) {
      logger.error('Failed to create WamKeyboard plugin:', error);
      throw error;
    }
  }

  /**
   * Get or create a WamDrummer plugin instance
   */
  async getOrCreateDrummerPlugin(context: AudioContext): Promise<any> {
    const key = 'wam-drummer';
    const globalCacheKey = 'wam-drummer-singleton';

    // First check for pre-loaded instrument from InitialSamplePreloader
    const preloadedPlugin =
      GlobalSampleCache.getCachedInstrument('drums-preloaded');
    if (preloadedPlugin && preloadedPlugin.drummerNode) {
      logger.debug('♻️ Found pre-loaded drummer instrument!', {
        hasDrummerNode: !!preloadedPlugin.drummerNode,
        contextState: context?.state,
      });

      // Store in local map for reference counting
      this.plugins.set(key, {
        plugin: preloadedPlugin,
        refCount: 1,
        context: context,
      });
      return preloadedPlugin;
    }

    // Then check global cache for any existing plugin
    const cachedPlugin = GlobalSampleCache.getCachedInstrument(globalCacheKey);
    if (cachedPlugin && cachedPlugin.drummerNode) {
      logger.debug('♻️ Found WamDrummer plugin in GlobalSampleCache', {
        hasDrummerNode: !!cachedPlugin.drummerNode,
        contextState: context?.state,
      });

      // Increment ref count in local map
      const existing = this.plugins.get(key);
      if (existing) {
        existing.refCount++;
      } else {
        this.plugins.set(key, {
          plugin: cachedPlugin,
          refCount: 1,
          context: context,
        });
      }
      return cachedPlugin;
    }

    // Then check local map
    const existing = this.plugins.get(key);
    if (existing) {
      // Be more lenient with context matching - accept if both are running
      if (existing.context.state === 'running' && context.state === 'running') {
        existing.refCount++;
        logger.debug('♻️ Reusing existing WamDrummer plugin', {
          refCount: existing.refCount,
          existingContextId: existing.context,
          newContextId: context,
          sameContext: existing.context === context,
        });
        return existing.plugin;
      } else {
        logger.warn('⚠️ Context state mismatch for WamDrummer plugin', {
          existingState: existing.context.state,
          newState: context.state,
        });
      }
    }

    logger.debug('🔨 Creating new WamDrummer plugin instance');

    try {
      const { default: WamDrummer } = await import(
        '@/domains/playback/modules/instruments/adapters/wam/WamDrummer'
      );

      const plugin = await WamDrummer.createInstance(context);

      // Create audio node but DON'T connect to destination yet
      const audioNode = await plugin.createAudioNode();
      plugin.audioNode = audioNode;

      // Load essential kit (3 samples) - this should be fast
      logger.debug('📥 Loading essential drum kit...');
      await plugin.loadDefaultKit();
      logger.debug('✅ Essential drum kit loaded');

      this.plugins.set(key, {
        plugin,
        refCount: 1,
        context,
      });

      // Also cache globally for persistence across re-initializations
      GlobalSampleCache.cacheInstrument(globalCacheKey, plugin);

      logger.debug(
        '✅ Created and cached new WamDrummer plugin (locally and globally)',
      );

      // TODO: Load full kit with velocity layers in background (non-blocking)
      // plugin.loadFullKit().catch(err => logger.warn('Background drum kit load failed', err));

      return plugin;
    } catch (error) {
      logger.error('Failed to create WamDrummer plugin:', error);
      throw error;
    }
  }

  /**
   * Release a reference to a plugin
   */
  releasePlugin(key: string): void {
    const info = this.plugins.get(key);
    if (info) {
      info.refCount--;
      logger.debug(`Released ${key} plugin reference`, {
        refCount: info.refCount,
      });

      if (info.refCount <= 0) {
        // Clean up the plugin
        try {
          if (info.plugin.audioNode) {
            info.plugin.audioNode.clearEvents();
            info.plugin.audioNode.disconnect();
          }

          if (info.plugin.destroy) {
            info.plugin.destroy();
          }

          this.plugins.delete(key);
          logger.debug(`🧹 Cleaned up ${key} plugin (no more references)`);
        } catch (error) {
          logger.error(`Error cleaning up ${key} plugin:`, error);
        }
      }
    }
  }

  /**
   * Get plugin info for debugging
   */
  getPluginInfo(): Map<string, { refCount: number; contextState: string }> {
    const info = new Map<string, { refCount: number; contextState: string }>();

    this.plugins.forEach((value, key) => {
      info.set(key, {
        refCount: value.refCount,
        contextState: value.context.state,
      });
    });

    return info;
  }

  /**
   * Force clear all plugins (for cleanup)
   */
  clearAll(): void {
    this.plugins.forEach((info, key) => {
      try {
        if (info.plugin.audioNode) {
          info.plugin.audioNode.clearEvents();
          info.plugin.audioNode.disconnect();
        }

        if (info.plugin.destroy) {
          info.plugin.destroy();
        }
      } catch (error) {
        logger.error(`Error cleaning up ${key} plugin:`, error);
      }
    });

    this.plugins.clear();
    logger.debug('🧹 Cleared all WAM plugin instances');
  }
}

// Export singleton instance
export const wamPluginSingleton = WamPluginSingletonManager.getInstance();

// Attach to window for debugging
if (typeof window !== 'undefined') {
  (window as any).wamPluginSingleton = wamPluginSingleton;
}
