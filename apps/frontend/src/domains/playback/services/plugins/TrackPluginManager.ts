/**
 * Track Plugin Manager - Re-export from modules
 *
 * @deprecated Use import from '@/domains/playback/modules/instruments' instead
 */

export { TrackPluginManager } from '../../modules/instruments/managers/TrackPluginManager.js';
export type {
  PluginInstance,
  PluginResourcePool,
  TrackPluginChain,
  PluginMetrics,
  PluginAllocationOptions,
} from '../../modules/instruments/managers/TrackPluginManager.js';
