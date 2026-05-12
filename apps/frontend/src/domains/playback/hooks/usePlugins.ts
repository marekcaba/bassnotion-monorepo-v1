/**
 * usePlugins Hook - PluginManager Integration
 * Story 3.18.6: Widget Integration & Enhancement
 *
 * Professional React hook for plugin management with:
 * - ServiceRegistry integration
 * - Type-safe plugin access
 * - Plugin state management
 * - Clean abstraction over PluginManager
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ServiceRegistry } from '../services/core/ServiceRegistry.js';
import { PluginManager } from '../services/core/PluginManager.js';
import { EventBus } from '../services/core/EventBus.js';
import type { AudioPlugin, PluginState } from '../types/plugin.js';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

export interface UsePluginsResult {
  isReady: boolean;
  error: Error | null;
  getPlugin: <T extends AudioPlugin = AudioPlugin>(
    pluginId: string,
  ) => T | null;
  getAllPlugins: () => Map<string, AudioPlugin>;
  getPluginsByCapability: (capability: string) => AudioPlugin[];
  activatePlugin: (pluginId: string) => Promise<void>;
  deactivatePlugin: (pluginId: string) => Promise<void>;
  getPluginState: (pluginId: string) => PluginState | undefined;
  registerPlugin: (
    plugin: AudioPlugin,
    dependencies?: string[],
  ) => Promise<void>;
}

export function usePlugins(
  serviceRegistry?: ServiceRegistry,
): UsePluginsResult {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [pluginStates, setPluginStates] = useState<Map<string, PluginState>>(
    new Map(),
  );

  const pluginManagerRef = useRef<PluginManager | null>(null);
  const eventBusRef = useRef<EventBus | null>(null);

  // Get PluginManager and EventBus from ServiceRegistry
  useEffect(() => {
    try {
      const registry = serviceRegistry || window.__serviceRegistry as ServiceRegistry | undefined;
      if (!registry) {
        throw new Error(
          'ServiceRegistry not found. Ensure AudioProvider is properly configured.',
        );
      }

      pluginManagerRef.current = registry.get<PluginManager>('pluginManager');
      eventBusRef.current = registry.get<EventBus>('eventBus');

      setIsReady(true);
    } catch (err) {
      setError(err as Error);
    }
  }, [serviceRegistry]);

  // Subscribe to plugin events
  useEffect(() => {
    if (!eventBusRef.current) return;

    const eventBus = eventBusRef.current;

    // Plugin state change handlers
    const handlePluginLoaded = (data: {
      pluginId: string;
      state: PluginState;
    }) => {
      setPluginStates((prev) => new Map(prev).set(data.pluginId, data.state));
    };

    const handlePluginActivated = (data: {
      pluginId: string;
      state: PluginState;
    }) => {
      setPluginStates((prev) => new Map(prev).set(data.pluginId, data.state));
    };

    const handlePluginDeactivated = (data: {
      pluginId: string;
      state: PluginState;
    }) => {
      setPluginStates((prev) => new Map(prev).set(data.pluginId, data.state));
    };

    const handlePluginError = (data: { pluginId: string; error: Error }) => {
      logger.error(`Plugin error (${data.pluginId}):`, data.error);
    };

    // Subscribe to events (EventBus.on returns unsubscribe function)
    const unsubscribeLoaded = eventBus.on(
      'plugin-manager:plugin-loaded',
      handlePluginLoaded,
    );
    const unsubscribeActivated = eventBus.on(
      'plugin-manager:plugin-activated',
      handlePluginActivated,
    );
    const unsubscribeDeactivated = eventBus.on(
      'plugin-manager:plugin-deactivated',
      handlePluginDeactivated,
    );
    const unsubscribeError = eventBus.on(
      'plugin-manager:error',
      handlePluginError,
    );

    // Cleanup subscriptions
    return () => {
      unsubscribeLoaded();
      unsubscribeActivated();
      unsubscribeDeactivated();
      unsubscribeError();
    };
  }, []);

  // Get a specific plugin
  const getPlugin = useCallback(
    <T extends AudioPlugin = AudioPlugin>(pluginId: string): T | null => {
      if (!pluginManagerRef.current) {
        logger.error('PluginManager not available');
        return null;
      }

      try {
        return pluginManagerRef.current.getPlugin<T>(pluginId);
      } catch (err) {
        logger.error(`Failed to get plugin ${pluginId}:`, err);
        return null;
      }
    },
    [],
  );

  // Get all plugins
  const getAllPlugins = useCallback((): Map<string, AudioPlugin> => {
    if (!pluginManagerRef.current) {
      return new Map();
    }

    try {
      return pluginManagerRef.current.getAllPlugins();
    } catch (err) {
      logger.error('Failed to get all plugins:', err);
      return new Map();
    }
  }, []);

  // Get plugins by capability
  const getPluginsByCapability = useCallback(
    (capability: string): AudioPlugin[] => {
      if (!pluginManagerRef.current) {
        return [];
      }

      try {
        return pluginManagerRef.current.getPluginsByCapability(capability);
      } catch (err) {
        logger.error(`Failed to get plugins by capability ${capability}:`, err);
        return [];
      }
    },
    [],
  );

  // Activate a plugin
  const activatePlugin = useCallback(
    async (pluginId: string): Promise<void> => {
      if (!pluginManagerRef.current) {
        throw new Error('PluginManager not available');
      }

      try {
        await pluginManagerRef.current.activatePlugin(pluginId);
      } catch (err) {
        const error =
          err instanceof Error
            ? err
            : new Error(`Failed to activate plugin ${pluginId}: Unknown error`);
        throw error;
      }
    },
    [],
  );

  // Deactivate a plugin
  const deactivatePlugin = useCallback(
    async (pluginId: string): Promise<void> => {
      if (!pluginManagerRef.current) {
        throw new Error('PluginManager not available');
      }

      try {
        await pluginManagerRef.current.deactivatePlugin(pluginId);
      } catch (err) {
        const error =
          err instanceof Error
            ? err
            : new Error(
                `Failed to deactivate plugin ${pluginId}: Unknown error`,
              );
        throw error;
      }
    },
    [],
  );

  // Get plugin state
  const getPluginState = useCallback(
    (pluginId: string): PluginState | undefined => {
      if (!pluginManagerRef.current) {
        return undefined;
      }

      // Try to get from local state first (more up-to-date)
      const localState = pluginStates.get(pluginId);
      if (localState !== undefined) {
        return localState;
      }

      // Fall back to plugin manager
      return pluginManagerRef.current.getPluginState(pluginId);
    },
    [pluginStates],
  );

  // Register a new plugin
  const registerPlugin = useCallback(
    async (plugin: AudioPlugin, dependencies?: string[]): Promise<void> => {
      if (!pluginManagerRef.current) {
        throw new Error('PluginManager not available');
      }

      try {
        await pluginManagerRef.current.register(plugin, dependencies);
      } catch (err) {
        const error =
          err instanceof Error
            ? err
            : new Error(`Failed to register plugin: Unknown error`);
        throw error;
      }
    },
    [],
  );

  return {
    isReady,
    error,
    getPlugin,
    getAllPlugins,
    getPluginsByCapability,
    activatePlugin,
    deactivatePlugin,
    getPluginState,
    registerPlugin,
  };
}
