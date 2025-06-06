/**
 * Plugins Index - Sample Plugin Exports
 *
 * Provides convenient access to all sample plugins that demonstrate
 * the plugin architecture capabilities. These plugins serve as examples
 * and can be used directly in the BassNotion platform.
 *
 * Part of Story 2.1: Task 14, Subtask 14.4
 */

// Export sample plugins
export { BassProcessor } from './BassProcessor.js';
export { DrumProcessor } from './DrumProcessor.js';
export { SyncProcessor } from './SyncProcessor.js';

// Plugin registry for easy registration
import { BassProcessor } from './BassProcessor.js';
import { DrumProcessor } from './DrumProcessor.js';
import { SyncProcessor } from './SyncProcessor.js';
import type { AudioPlugin } from '../../types/plugin.js';

/**
 * Sample plugin registry
 */
export const SAMPLE_PLUGINS = new Map<string, () => AudioPlugin>([
  ['bassnotion.bass-processor', () => new BassProcessor()],
  ['bassnotion.drum-processor', () => new DrumProcessor()],
  ['bassnotion.sync-processor', () => new SyncProcessor()],
]);

/**
 * Plugin categories for organizing sample plugins
 */
export const PLUGIN_CATEGORIES = {
  EFFECTS: ['bassnotion.bass-processor'],
  ANALYSIS: ['bassnotion.drum-processor'],
  UTILITY: ['bassnotion.sync-processor'],
} as const;

/**
 * Create all sample plugins
 */
export function createAllSamplePlugins(): AudioPlugin[] {
  return Array.from(SAMPLE_PLUGINS.values()).map((factory) => factory());
}

/**
 * Create plugins by category
 */
export function createPluginsByCategory(
  category: keyof typeof PLUGIN_CATEGORIES,
): AudioPlugin[] {
  const pluginIds = PLUGIN_CATEGORIES[category];
  return pluginIds
    .map((id) => SAMPLE_PLUGINS.get(id))
    .filter((factory): factory is () => AudioPlugin => factory !== undefined)
    .map((factory) => factory());
}

/**
 * Get plugin factory by ID
 */
export function getPluginFactory(
  pluginId: string,
): (() => AudioPlugin) | undefined {
  return SAMPLE_PLUGINS.get(pluginId);
}

/**
 * Check if plugin ID is a sample plugin
 */
export function isSamplePlugin(pluginId: string): boolean {
  return SAMPLE_PLUGINS.has(pluginId);
}

/**
 * Get all sample plugin IDs
 */
export function getSamplePluginIds(): string[] {
  return Array.from(SAMPLE_PLUGINS.keys());
}

/**
 * Plugin presets for common configurations
 */
export const PLUGIN_PRESETS = {
  'bassnotion.bass-processor': {
    rock: {
      lowShelf: 2,
      midGain: 1,
      distortionDrive: 30,
      compressorRatio: 4,
    },
    jazz: {
      lowShelf: -1,
      midGain: -0.5,
      distortionDrive: 5,
      compressorRatio: 2,
    },
    funk: {
      lowShelf: 3,
      midGain: 2,
      distortionDrive: 15,
      compressorRatio: 6,
    },
  },
  'bassnotion.drum-processor': {
    rock: {
      patternStyle: 'rock',
      patternComplexity: 5,
      kickBoost: 2,
      snareBoost: 1,
    },
    jazz: {
      patternStyle: 'jazz',
      patternComplexity: 7,
      kickBoost: 0,
      snareBoost: -1,
    },
    funk: {
      patternStyle: 'funk',
      patternComplexity: 8,
      kickBoost: 3,
      snareBoost: 2,
    },
  },
  'bassnotion.sync-processor': {
    precise: {
      tempoSensitivity: 90,
      syncAccuracy: 95,
      phaseTolerrance: 5,
      latencyCompensation: 0,
    },
    relaxed: {
      tempoSensitivity: 70,
      syncAccuracy: 80,
      phaseTolerrance: 15,
      latencyCompensation: 10,
    },
    adaptive: {
      tempoSensitivity: 80,
      syncAccuracy: 85,
      phaseTolerrance: 10,
      latencyCompensation: 5,
    },
  },
} as const;

/**
 * Apply preset to plugin
 */
export async function applyPluginPreset(
  plugin: AudioPlugin,
  presetName: string,
): Promise<void> {
  const presets =
    PLUGIN_PRESETS[plugin.metadata.id as keyof typeof PLUGIN_PRESETS];
  if (!presets) {
    throw new Error(`No presets available for plugin ${plugin.metadata.id}`);
  }

  const preset = presets[presetName as keyof typeof presets];
  if (!preset) {
    throw new Error(
      `Preset '${presetName}' not found for plugin ${plugin.metadata.id}`,
    );
  }

  // Apply preset parameters
  for (const [parameterId, value] of Object.entries(preset)) {
    try {
      await plugin.setParameter(parameterId, value);
    } catch (error) {
      console.warn(
        `Failed to set parameter ${parameterId} to ${value}:`,
        error,
      );
    }
  }
}

/**
 * Get available presets for plugin
 */
export function getAvailablePresets(pluginId: string): string[] {
  const presets = PLUGIN_PRESETS[pluginId as keyof typeof PLUGIN_PRESETS];
  return presets ? Object.keys(presets) : [];
}
