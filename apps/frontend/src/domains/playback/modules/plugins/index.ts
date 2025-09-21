/**
 * Plugin Module Exports
 *
 * Central export point for all plugin-related functionality
 */

export { BaseAudioPlugin } from './base/BaseAudioPlugin.js';

// Export types that plugins commonly need
export type {
  AudioPlugin,
  PluginMetadata,
  PluginConfig,
  PluginState,
  PluginCapabilities,
  PluginParameter,
  PluginAudioContext,
  PluginProcessingResult,
  ProcessingResultStatus,
  PluginCategory,
  PluginParameterType,
} from '../../types/plugin.js';
