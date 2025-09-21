/**
 * Plugin Preset Entity
 *
 * Represents a saved configuration for an audio plugin.
 * Encapsulates preset management logic.
 */

import { PluginId } from '../value-objects/index.js';
import type { PluginCategory } from '../../types/plugin.js';

export interface PluginPresetProps {
  id: string;
  pluginId: PluginId;
  name: string;
  category: PluginCategory;
  settings: Record<string, unknown>;
  tags: string[];
  isFactory: boolean;
  isFavorite: boolean;
  createdAt: Date;
  updatedAt: Date;
  author?: string;
  description?: string;
}

export class PluginPreset {
  private constructor(private props: PluginPresetProps) {}

  /**
   * Create a new plugin preset
   */
  static create(
    pluginId: PluginId,
    name: string,
    category: PluginCategory,
    settings: Record<string, unknown>,
    author?: string,
  ): PluginPreset {
    if (!name || name.trim().length === 0) {
      throw new Error('Preset name cannot be empty');
    }

    if (!settings || Object.keys(settings).length === 0) {
      throw new Error('Preset settings cannot be empty');
    }

    const now = new Date();
    const id = `preset_${pluginId.value}_${Date.now()}`;

    return new PluginPreset({
      id,
      pluginId,
      name: name.trim(),
      category,
      settings: { ...settings }, // Deep clone to prevent mutations
      tags: [],
      isFactory: false,
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
      author,
    });
  }

  /**
   * Create a factory preset
   */
  static createFactory(
    pluginId: PluginId,
    name: string,
    category: PluginCategory,
    settings: Record<string, unknown>,
    description?: string,
  ): PluginPreset {
    const preset = PluginPreset.create(
      pluginId,
      name,
      category,
      settings,
      'Factory',
    );
    preset.props.isFactory = true;
    preset.props.description = description;
    return preset;
  }

  /**
   * Reconstitute from persistence
   */
  static reconstitute(props: PluginPresetProps): PluginPreset {
    return new PluginPreset(props);
  }

  // Getters
  get id(): string {
    return this.props.id;
  }
  get pluginId(): PluginId {
    return this.props.pluginId;
  }
  get name(): string {
    return this.props.name;
  }
  get category(): PluginCategory {
    return this.props.category;
  }
  get settings(): Record<string, unknown> {
    return { ...this.props.settings };
  }
  get tags(): string[] {
    return [...this.props.tags];
  }
  get isFactory(): boolean {
    return this.props.isFactory;
  }
  get isFavorite(): boolean {
    return this.props.isFavorite;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get author(): string | undefined {
    return this.props.author;
  }
  get description(): string | undefined {
    return this.props.description;
  }

  /**
   * Business Logic Methods
   */

  /**
   * Check if preset can be edited
   */
  canEdit(): boolean {
    return !this.isFactory;
  }

  /**
   * Check if preset matches search query
   */
  matchesSearch(query: string): boolean {
    const lowerQuery = query.toLowerCase();
    return (
      this.name.toLowerCase().includes(lowerQuery) ||
      this.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)) ||
      (this.description
        ? this.description.toLowerCase().includes(lowerQuery)
        : false)
    );
  }

  /**
   * Check if preset has specific tag
   */
  hasTag(tag: string): boolean {
    return this.tags.includes(tag);
  }

  /**
   * Get preset type for display
   */
  getType(): string {
    if (this.isFactory) return 'Factory';
    if (this.author) return `User (${this.author})`;
    return 'User';
  }

  /**
   * Check if preset settings are compatible with another preset
   */
  isCompatibleWith(other: PluginPreset): boolean {
    return (
      this.pluginId.equals(other.pluginId) && this.category === other.category
    );
  }

  /**
   * Mutation Methods
   */

  /**
   * Update preset name
   */
  updateName(name: string): void {
    if (!this.canEdit()) {
      throw new Error('Cannot edit factory preset');
    }

    if (!name || name.trim().length === 0) {
      throw new Error('Preset name cannot be empty');
    }

    this.props.name = name.trim();
    this.props.updatedAt = new Date();
  }

  /**
   * Update preset settings
   */
  updateSettings(settings: Record<string, unknown>): void {
    if (!this.canEdit()) {
      throw new Error('Cannot edit factory preset');
    }

    if (!settings || Object.keys(settings).length === 0) {
      throw new Error('Preset settings cannot be empty');
    }

    this.props.settings = { ...settings };
    this.props.updatedAt = new Date();
  }

  /**
   * Update preset description
   */
  updateDescription(description: string): void {
    if (!this.canEdit()) {
      throw new Error('Cannot edit factory preset');
    }

    this.props.description = description;
    this.props.updatedAt = new Date();
  }

  /**
   * Add tags to preset
   */
  addTags(tags: string[]): void {
    if (!this.canEdit()) {
      throw new Error('Cannot edit factory preset');
    }

    const uniqueTags = tags.filter(
      (tag) => tag && tag.trim().length > 0 && !this.props.tags.includes(tag),
    );

    if (uniqueTags.length > 0) {
      this.props.tags.push(...uniqueTags);
      this.props.updatedAt = new Date();
    }
  }

  /**
   * Remove tag from preset
   */
  removeTag(tag: string): void {
    if (!this.canEdit()) {
      throw new Error('Cannot edit factory preset');
    }

    const index = this.props.tags.indexOf(tag);
    if (index !== -1) {
      this.props.tags.splice(index, 1);
      this.props.updatedAt = new Date();
    }
  }

  /**
   * Toggle favorite status
   */
  toggleFavorite(): void {
    this.props.isFavorite = !this.props.isFavorite;
    this.props.updatedAt = new Date();
  }

  /**
   * Set favorite status
   */
  setFavorite(favorite: boolean): void {
    if (favorite !== this.props.isFavorite) {
      this.props.isFavorite = favorite;
      this.props.updatedAt = new Date();
    }
  }

  /**
   * Create a copy of this preset with a new name
   */
  duplicate(newName: string): PluginPreset {
    return PluginPreset.create(
      this.pluginId,
      newName,
      this.category,
      this.settings,
      this.author,
    );
  }

  /**
   * Convert to persistence format
   */
  toPersistence(): PluginPresetProps {
    return { ...this.props };
  }

  /**
   * Create a simplified version for export
   */
  toExport(): {
    name: string;
    category: string;
    settings: Record<string, unknown>;
    tags: string[];
    description?: string;
  } {
    return {
      name: this.name,
      category: this.category,
      settings: this.settings,
      tags: this.tags,
      description: this.description,
    };
  }
}
