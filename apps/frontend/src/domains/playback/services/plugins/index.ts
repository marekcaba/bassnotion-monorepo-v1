/**
 * Plugins Index - Plugin Exports
 *
 * Provides convenient access to all plugins including sample plugins and
 * Story 2.2 professional instrument processors. These plugins serve as examples
 * and production-ready instruments for the BassNotion platform.
 *
 * Part of Story 2.1: Task 14, Subtask 14.4
 * Enhanced for Story 2.2: Professional Instrument Processors
 */

// Export sample plugins (Story 2.1)
export { BassProcessor } from '../../modules/instruments/implementations/bass/BassProcessor.js';
export { DrumProcessor } from '../../modules/instruments/implementations/drums/DrumProcessor.js';
export { SyncProcessor } from './SyncProcessor';

// Export professional instrument processors (Story 2.2)
export { MidiParserProcessor } from './MidiParserProcessor';
export { BassInstrumentProcessor } from '../../modules/instruments/implementations/bass/BassInstrumentProcessor.js';
export { DrumInstrumentProcessor } from '../../modules/instruments/implementations/drums/DrumInstrumentProcessor.js';
// ChordInstrumentProcessor removed - unused code (37k lines)
export { MetronomeInstrumentProcessor } from './MetronomeInstrumentProcessor';
export { WamHarmonyProcessor } from '../../modules/instruments/adapters/wam/WamHarmonyProcessor';

// Export enhanced processors with professional audio samples (Story 3.16)
export {
  EnhancedMetronomeProcessor,
  createEnhancedMetronome,
} from './EnhancedMetronomeProcessor';
// EnhancedChordProcessor removed - unused code
// Use WamKeyboard for harmony playback

// Export WAM integration services (Story 3.21 Task 7)
export { WamPluginAdapter } from './WamPluginAdapter';
export { WamHostManager } from './WamHostManager';
export { WamDeviceOptimizer } from './WamDeviceOptimizer';

// Plugin registry for easy registration
import { BassProcessor } from '../../modules/instruments/implementations/bass/BassProcessor.js';
import { createStructuredLogger } from '@bassnotion/contracts';
import { DrumProcessor } from '../../modules/instruments/implementations/drums/DrumProcessor.js';
import { SyncProcessor } from './SyncProcessor';
import type { AudioPlugin } from '../../types/plugin';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

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
  // TODO: Review non-null assertion - consider null safety
  if (!presets) {
    throw new Error(`No presets available for plugin ${plugin.metadata.id}`);
  }

  const preset = presets[presetName as keyof typeof presets];
  // TODO: Review non-null assertion - consider null safety
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
      logger.warn(
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
