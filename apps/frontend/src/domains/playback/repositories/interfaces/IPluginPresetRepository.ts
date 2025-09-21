/**
 * Plugin Preset Repository Interface
 *
 * Defines the contract for plugin preset data access operations
 */

import { PluginId } from '../value-objects/index.js';
import { PluginPreset } from '../entities/index.js';
import type { PluginCategory } from '../../types/plugin.js';

export interface IPluginPresetRepository {
  /**
   * Find a preset by ID
   */
  findById(id: string): Promise<PluginPreset | null>;

  /**
   * Find all presets for a plugin
   */
  findByPluginId(pluginId: PluginId): Promise<PluginPreset[]>;

  /**
   * Find all presets
   */
  findAll(): Promise<PluginPreset[]>;

  /**
   * Find presets by category
   */
  findByCategory(category: PluginCategory): Promise<PluginPreset[]>;

  /**
   * Find favorite presets
   */
  findFavorites(): Promise<PluginPreset[]>;

  /**
   * Search presets by name or tags
   */
  search(query: string): Promise<PluginPreset[]>;

  /**
   * Save a preset (create or update)
   */
  save(preset: PluginPreset): Promise<void>;

  /**
   * Delete a preset
   */
  delete(id: string): Promise<void>;

  /**
   * Delete all presets for a plugin
   */
  deleteByPluginId(pluginId: PluginId): Promise<void>;

  /**
   * Check if a preset exists
   */
  exists(id: string): Promise<boolean>;

  /**
   * Import presets from JSON
   */
  importPresets(data: any[]): Promise<void>;

  /**
   * Export presets to JSON
   */
  exportPresets(pluginId?: PluginId): Promise<any[]>;
}
