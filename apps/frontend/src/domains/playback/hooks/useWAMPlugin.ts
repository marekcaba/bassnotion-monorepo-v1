/**
 * useWAMPlugin Hook - Simplified WAM Plugin Management
 * 
 * Provides easy WAM plugin loading and management for tracks.
 * This replaces the complex useWamDrummer with a generic WAM plugin system.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseWAMPluginOptions {
  /** Track instance or useTrack hook return with loadWAMPlugin method */
  track: any;
  /** WAM plugin URL or type */
  pluginUrl: string;
  /** Auto-load plugin */
  autoLoad?: boolean;
  /** Plugin configuration */
  config?: Record<string, any>;
  /** Debug mode */
  debugMode?: boolean;
}

interface UseWAMPluginReturn {
  // Plugin state
  plugin: any;
  isLoaded: boolean;
  isReady: boolean;
  error: Error | null;
  
  // Plugin control
  load: () => Promise<void>;
  unload: () => void;
  setParameter: (name: string, value: any) => void;
  getParameter: (name: string) => any;
  
  // Audio control
  trigger: (note?: number, velocity?: number) => void;
  setVolume: (volume: number) => void;
  setMute: (muted: boolean) => void;
}

export function useWAMPlugin(options: UseWAMPluginOptions): UseWAMPluginReturn {
  const { track, pluginUrl, autoLoad = true, config = {}, debugMode = false } = options;
  
  // State
  const [plugin, setPlugin] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Refs
  const pluginRef = useRef<any>(null);
  
  // Debug logging
  const debug = useCallback((message: string, data?: any) => {
    if (debugMode) {
      console.log(`🔌 useWAMPlugin[${pluginUrl}]: ${message}`, data);
    }
  }, [pluginUrl, debugMode]);
  
  /**
   * Load WAM plugin
   */
  const load = useCallback(async () => {
    if (!track || isLoaded) return;
    
    try {
      debug('Loading WAM plugin');
      
      // Check if track has loadWAMPlugin method (from useTrack hook)
      if (typeof track.loadWAMPlugin === 'function') {
        // Track is from useTrack hook
        const loadedPlugin = await track.loadWAMPlugin(pluginUrl, config);
        pluginRef.current = loadedPlugin;
        setPlugin(loadedPlugin);
      } else {
        // Track is a raw Track instance, manual loading not supported
        console.warn('Track does not have loadWAMPlugin method. Manual plugin loading not supported.');
        setError(new Error('Track does not support WAM plugin loading'));
        return;
      }
      
      setIsLoaded(true);
      setIsReady(true);
      
      debug('WAM plugin loaded successfully');
    } catch (err) {
      console.error('Failed to load WAM plugin:', err);
      setError(err as Error);
    }
  }, [track, pluginUrl, config, isLoaded, debug]);
  
  /**
   * Unload plugin
   */
  const unload = useCallback(() => {
    if (!plugin || !track) return;
    
    debug('Unloading WAM plugin');
    
    track.removePlugin(plugin.id);
    pluginRef.current = null;
    setPlugin(null);
    setIsLoaded(false);
    setIsReady(false);
  }, [plugin, track, debug]);
  
  /**
   * Set plugin parameter
   */
  const setParameter = useCallback((name: string, value: any) => {
    if (!plugin) return;
    
    debug(`Setting parameter ${name}`, { value });
    
    if (plugin.setParameter) {
      plugin.setParameter(name, value);
    } else if (plugin.audioNode && plugin.audioNode.parameters && plugin.audioNode.parameters[name]) {
      plugin.audioNode.parameters[name].value = value;
    }
  }, [plugin, debug]);
  
  /**
   * Get plugin parameter
   */
  const getParameter = useCallback((name: string) => {
    if (!plugin) return null;
    
    if (plugin.getParameter) {
      return plugin.getParameter(name);
    } else if (plugin.audioNode && plugin.audioNode.parameters && plugin.audioNode.parameters[name]) {
      return plugin.audioNode.parameters[name].value;
    }
    
    return null;
  }, [plugin]);
  
  /**
   * Trigger plugin (for instruments)
   */
  const trigger = useCallback((note: number = 60, velocity: number = 0.8) => {
    if (!plugin) return;
    
    debug('Triggering plugin', { note, velocity });
    
    if (plugin.trigger) {
      plugin.trigger(note, velocity);
    } else if (plugin.audioNode && plugin.audioNode.trigger) {
      plugin.audioNode.trigger(note, velocity);
    }
  }, [plugin, debug]);
  
  /**
   * Set plugin volume
   */
  const setVolume = useCallback((volume: number) => {
    setParameter('volume', Math.max(0, Math.min(1, volume)));
  }, [setParameter]);
  
  /**
   * Set plugin mute
   */
  const setMute = useCallback((muted: boolean) => {
    setParameter('mute', muted);
  }, [setParameter]);
  
  /**
   * Auto-load effect
   */
  useEffect(() => {
    if (autoLoad && track && !isLoaded && !error) {
      load();
    }
    
    // Cleanup
    return () => {
      if (isLoaded) {
        unload();
      }
    };
  }, [autoLoad, track, isLoaded, error, load, unload]);
  
  return {
    // Plugin state
    plugin,
    isLoaded,
    isReady,
    error,
    
    // Plugin control
    load,
    unload,
    setParameter,
    getParameter,
    
    // Audio control
    trigger,
    setVolume,
    setMute
  };
}
