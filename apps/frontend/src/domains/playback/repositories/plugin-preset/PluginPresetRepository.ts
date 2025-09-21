/**
 * Plugin Preset Repository Implementation
 *
 * Provides local storage persistence for plugin preset data
 */

import { IPluginPresetRepository } from '../interfaces/IPluginPresetRepository.js';
import { PluginId } from '../value-objects/index.js';
import { PluginPreset } from '../entities/index.js';
import type { PluginCategory } from '../../types/plugin.js';
import { createStructuredLogger } from '../../modules/shared/index.js';

const logger = createStructuredLogger('PluginPresetRepository');

const STORAGE_KEY = 'bassnotion_plugin_presets';

interface StoredPreset {
  id: string;
  pluginId: string;
  name: string;
  category: PluginCategory;
  settings: Record<string, unknown>;
  tags: string[];
  isFactory: boolean;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  author?: string;
  description?: string;
}

export class PluginPresetRepository implements IPluginPresetRepository {
  /**
   * Find a preset by ID
   */
  async findById(id: string): Promise<PluginPreset | null> {
    const presets = await this.loadPresets();
    const stored = presets.find((p) => p.id === id);

    if (!stored) {
      return null;
    }

    return this.fromStorage(stored);
  }

  /**
   * Find all presets for a plugin
   */
  async findByPluginId(pluginId: PluginId): Promise<PluginPreset[]> {
    const presets = await this.loadPresets();
    return presets
      .filter((p) => p.pluginId === pluginId.value)
      .sort((a, b) => {
        // Factory presets first, then by name
        if (a.isFactory && !b.isFactory) return -1;
        if (!a.isFactory && b.isFactory) return 1;
        return a.name.localeCompare(b.name);
      })
      .map((stored) => this.fromStorage(stored));
  }

  /**
   * Find all presets
   */
  async findAll(): Promise<PluginPreset[]> {
    const presets = await this.loadPresets();
    return presets
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((stored) => this.fromStorage(stored));
  }

  /**
   * Find presets by category
   */
  async findByCategory(category: PluginCategory): Promise<PluginPreset[]> {
    const presets = await this.loadPresets();
    return presets
      .filter((p) => p.category === category)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((stored) => this.fromStorage(stored));
  }

  /**
   * Find favorite presets
   */
  async findFavorites(): Promise<PluginPreset[]> {
    const presets = await this.loadPresets();
    return presets
      .filter((p) => p.isFavorite)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((stored) => this.fromStorage(stored));
  }

  /**
   * Search presets by name or tags
   */
  async search(query: string): Promise<PluginPreset[]> {
    const presets = await this.loadPresets();
    const lowerQuery = query.toLowerCase();

    return presets
      .filter((p) => {
        const nameMatch = p.name.toLowerCase().includes(lowerQuery);
        const tagMatch = p.tags.some((tag) =>
          tag.toLowerCase().includes(lowerQuery),
        );
        const descMatch =
          p.description && p.description.toLowerCase().includes(lowerQuery);
        return nameMatch || tagMatch || descMatch;
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((stored) => this.fromStorage(stored));
  }

  /**
   * Save a preset (create or update)
   */
  async save(preset: PluginPreset): Promise<void> {
    const presets = await this.loadPresets();
    const stored = this.toStorage(preset);

    const existingIndex = presets.findIndex((p) => p.id === stored.id);
    if (existingIndex >= 0) {
      presets[existingIndex] = stored;
    } else {
      presets.push(stored);
    }

    await this.savePresets(presets);
  }

  /**
   * Delete a preset
   */
  async delete(id: string): Promise<void> {
    const presets = await this.loadPresets();
    const filtered = presets.filter((p) => p.id !== id);

    if (filtered.length === presets.length) {
      throw new Error(`Preset ${id} not found`);
    }

    // Don't allow deleting factory presets
    const preset = presets.find((p) => p.id === id);
    if (preset?.isFactory) {
      throw new Error('Cannot delete factory preset');
    }

    await this.savePresets(filtered);
  }

  /**
   * Delete all presets for a plugin
   */
  async deleteByPluginId(pluginId: PluginId): Promise<void> {
    const presets = await this.loadPresets();
    // Keep factory presets, only delete user presets
    const filtered = presets.filter(
      (p) => p.pluginId !== pluginId.value || p.isFactory,
    );

    await this.savePresets(filtered);
  }

  /**
   * Check if a preset exists
   */
  async exists(id: string): Promise<boolean> {
    const presets = await this.loadPresets();
    return presets.some((p) => p.id === id);
  }

  /**
   * Import presets from JSON
   */
  async importPresets(data: any[]): Promise<void> {
    const presets = await this.loadPresets();

    for (const item of data) {
      try {
        // Validate and create preset
        const preset = PluginPreset.create(
          PluginId.create(item.pluginId),
          item.name,
          item.category,
          item.settings,
          item.author,
        );

        // Add tags if present
        if (item.tags && Array.isArray(item.tags)) {
          preset.addTags(item.tags);
        }

        // Set description if present
        if (item.description) {
          preset.updateDescription(item.description);
        }

        // Add to presets
        const stored = this.toStorage(preset);
        presets.push(stored);
      } catch (error) {
        logger.error('Failed to import preset', error as Error, {
          preset: item,
        });
      }
    }

    await this.savePresets(presets);
  }

  /**
   * Export presets to JSON
   */
  async exportPresets(pluginId?: PluginId): Promise<any[]> {
    const presets = await this.loadPresets();
    let filtered = presets;

    if (pluginId) {
      filtered = presets.filter((p) => p.pluginId === pluginId.value);
    }

    return filtered.map((p) => ({
      pluginId: p.pluginId,
      name: p.name,
      category: p.category,
      settings: p.settings,
      tags: p.tags,
      description: p.description,
      author: p.author,
    }));
  }

  /**
   * Load presets from storage
   */
  private async loadPresets(): Promise<StoredPreset[]> {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        return this.getFactoryPresets();
      }

      const parsed = JSON.parse(data);
      const presets = Array.isArray(parsed) ? parsed : [];

      // Ensure factory presets are always present
      const factoryPresets = this.getFactoryPresets();
      const hasFactory = presets.some((p) => p.isFactory);

      if (!hasFactory) {
        return [...factoryPresets, ...presets];
      }

      return presets;
    } catch (error) {
      logger.error('Failed to load presets from storage', error as Error);
      return this.getFactoryPresets();
    }
  }

  /**
   * Save presets to storage
   */
  private async savePresets(presets: StoredPreset[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    } catch (error) {
      logger.error('Failed to save presets to storage', error as Error);
      throw new Error('Failed to save presets');
    }
  }

  /**
   * Get factory presets
   */
  private getFactoryPresets(): StoredPreset[] {
    // Add some default factory presets
    const now = new Date().toISOString();
    return [
      {
        id: 'factory_bass_clean',
        pluginId: 'bass',
        name: 'Clean Bass',
        category: 'instrument' as PluginCategory,
        settings: { gain: 0.7, tone: 0.5, compression: 0.2 },
        tags: ['clean', 'basic'],
        isFactory: true,
        isFavorite: false,
        createdAt: now,
        updatedAt: now,
        author: 'Factory',
        description: 'Clean bass sound with minimal processing',
      },
      {
        id: 'factory_bass_punchy',
        pluginId: 'bass',
        name: 'Punchy Bass',
        category: 'instrument' as PluginCategory,
        settings: { gain: 0.8, tone: 0.7, compression: 0.6, attack: 0.3 },
        tags: ['punchy', 'compressed'],
        isFactory: true,
        isFavorite: false,
        createdAt: now,
        updatedAt: now,
        author: 'Factory',
        description: 'Compressed bass with enhanced attack',
      },
    ];
  }

  /**
   * Convert entity to storage format
   */
  private toStorage(preset: PluginPreset): StoredPreset {
    const persistence = preset.toPersistence();
    return {
      id: persistence.id,
      pluginId: persistence.pluginId.value,
      name: persistence.name,
      category: persistence.category,
      settings: persistence.settings,
      tags: persistence.tags,
      isFactory: persistence.isFactory,
      isFavorite: persistence.isFavorite,
      createdAt: persistence.createdAt.toISOString(),
      updatedAt: persistence.updatedAt.toISOString(),
      author: persistence.author,
      description: persistence.description,
    };
  }

  /**
   * Convert storage format to entity
   */
  private fromStorage(stored: StoredPreset): PluginPreset {
    return PluginPreset.reconstitute({
      id: stored.id,
      pluginId: PluginId.create(stored.pluginId),
      name: stored.name,
      category: stored.category,
      settings: stored.settings,
      tags: stored.tags,
      isFactory: stored.isFactory,
      isFavorite: stored.isFavorite,
      createdAt: new Date(stored.createdAt),
      updatedAt: new Date(stored.updatedAt),
      author: stored.author,
      description: stored.description,
    });
  }
}
