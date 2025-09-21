/**
 * PluginId Value Object
 *
 * Represents a unique identifier for an audio plugin.
 * Ensures type safety for plugin references.
 */

export class PluginId {
  private constructor(public readonly value: string) {
    Object.freeze(this);
  }

  /**
   * Create a PluginId from a string
   */
  static create(value: string): PluginId {
    if (!value || typeof value !== 'string') {
      throw new Error('PluginId must be a non-empty string');
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new Error('PluginId cannot be empty');
    }

    return new PluginId(trimmed);
  }

  /**
   * Generate a new unique PluginId
   */
  static generate(): PluginId {
    const id = `plugin_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    return new PluginId(id);
  }

  /**
   * Create a PluginId for a specific plugin type
   */
  static forType(pluginType: string, index?: number): PluginId {
    const suffix = index !== undefined ? `_${index}` : '';
    return new PluginId(`${pluginType}${suffix}_${Date.now()}`);
  }

  /**
   * Check equality with another PluginId
   */
  equals(other: PluginId): boolean {
    return this.value === other.value;
  }

  /**
   * Get the plugin type from the ID (if structured)
   */
  getType(): string | null {
    const match = this.value.match(/^([^_]+)/);
    return match ? (match[1] ?? null) : null;
  }

  /**
   * Convert to string representation
   */
  toString(): string {
    return this.value;
  }

  /**
   * Convert to JSON
   */
  toJSON(): string {
    return this.value;
  }
}
