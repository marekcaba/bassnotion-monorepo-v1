/**
 * WAM Plugin Singleton Manager
 * 
 * Ensures only one instance of each WAM plugin type exists globally
 * to prevent duplicate sample loading and memory waste
 */

import { WamKeyboard } from '@/domains/playback/modules/instruments/adapters/wam/WamKeyboard';
import { getLogger } from '@/utils/logger';
import { GlobalSampleCache } from '@/domains/playback/services/storage/GlobalSampleCache';

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
   */
  async getOrCreateKeyboardPlugin(context: AudioContext): Promise<any> {
    const key = 'wam-keyboard';
    const globalCacheKey = 'wam-keyboard-singleton';
    
    // First check for pre-loaded instrument from InitialSamplePreloader
    const preloadedPlugin = GlobalSampleCache.getCachedInstrument('harmony-preloaded');
    if (preloadedPlugin && preloadedPlugin.audioNode) {
      logger.debug('♻️ Found pre-loaded harmony instrument!', {
        hasAudioNode: !!preloadedPlugin.audioNode,
        contextState: preloadedPlugin.audioNode.context?.state
      });
      
      // Check if the pre-loaded plugin's context is still valid
      if (preloadedPlugin.audioNode.context && preloadedPlugin.audioNode.context.state === 'running') {
        // Store in local map for reference counting
        this.plugins.set(key, {
          plugin: preloadedPlugin,
          refCount: 1,
          context: preloadedPlugin.audioNode.context
        });
        return preloadedPlugin;
      }
    }
    
    // Then check global cache for any existing plugin
    const cachedPlugin = GlobalSampleCache.getCachedInstrument(globalCacheKey);
    if (cachedPlugin && cachedPlugin.audioNode) {
      logger.debug('♻️ Found WamKeyboard plugin in GlobalSampleCache', {
        hasAudioNode: !!cachedPlugin.audioNode,
        contextState: cachedPlugin.audioNode.context?.state
      });
      
      // Check if the cached plugin's context is still valid
      if (cachedPlugin.audioNode.context && cachedPlugin.audioNode.context.state === 'running') {
        // Increment ref count in local map
        const existing = this.plugins.get(key);
        if (existing) {
          existing.refCount++;
        } else {
          this.plugins.set(key, {
            plugin: cachedPlugin,
            refCount: 1,
            context: cachedPlugin.audioNode.context
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
        existing.refCount++;
        logger.debug('♻️ Reusing existing WamKeyboard plugin', {
          refCount: existing.refCount,
          existingContextId: existing.context,
          newContextId: context,
          sameContext: existing.context === context
        });
        return existing.plugin;
      } else {
        logger.warn('⚠️ Context state mismatch for WamKeyboard plugin', {
          existingState: existing.context.state,
          newState: context.state
        });
      }
    }
    
    logger.debug('🔨 Creating new WamKeyboard plugin instance');
    
    try {
      const plugin = await WamKeyboard.createInstance(context);
      
      // Create audio node but DON'T connect to destination yet
      // Let the consumer decide where to connect it
      const audioNode = await plugin.createAudioNode();
      plugin.audioNode = audioNode;
      
      this.plugins.set(key, {
        plugin,
        refCount: 1,
        context
      });
      
      // Also cache globally for persistence across re-initializations
      GlobalSampleCache.cacheInstrument(globalCacheKey, plugin);
      
      logger.debug('✅ Created and cached new WamKeyboard plugin (locally and globally)');
      return plugin;
    } catch (error) {
      logger.error('Failed to create WamKeyboard plugin:', error);
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
        refCount: info.refCount
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
        contextState: value.context.state
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