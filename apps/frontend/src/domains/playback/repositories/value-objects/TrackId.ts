/**
 * TrackId Value Object
 *
 * Represents a unique identifier for a track in the playback system.
 * Ensures type safety and prevents primitive obsession.
 */

export class TrackId {
  private constructor(public readonly value: string) {
    Object.freeze(this);
  }

  /**
   * Create a TrackId from a string
   */
  static create(value: string): TrackId {
    if (!value || typeof value !== 'string') {
      throw new Error('TrackId must be a non-empty string');
    }

    // Validate format if needed (e.g., UUID format)
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new Error('TrackId cannot be empty');
    }

    return new TrackId(trimmed);
  }

  /**
   * Generate a new unique TrackId
   */
  static generate(): TrackId {
    // Use nanoid or similar for ID generation
    const id = `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return new TrackId(id);
  }

  /**
   * Check equality with another TrackId
   */
  equals(other: TrackId): boolean {
    return this.value === other.value;
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
