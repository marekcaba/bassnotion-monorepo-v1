/**
 * Volume Value Object
 *
 * Represents audio volume level with validation.
 * Ensures volume is within valid range (0-1 normalized).
 */

export class Volume {
  private constructor(public readonly value: number) {
    Object.freeze(this);
  }

  /**
   * Create a Volume from a normalized value (0-1)
   */
  static create(value: number): Volume {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error('Volume must be a valid number');
    }

    if (value < 0) {
      throw new Error('Volume cannot be negative');
    }

    if (value > 1) {
      throw new Error('Volume cannot exceed 1');
    }

    return new Volume(Math.round(value * 1000) / 1000); // 3 decimal places
  }

  /**
   * Create Volume from decibels
   */
  static fromDecibels(db: number): Volume {
    if (db <= -60) {
      return new Volume(0); // Treat -60dB and below as silence
    }

    // Convert dB to linear scale (0-1)
    const linear = Math.pow(10, db / 20);
    return Volume.create(Math.min(1, linear));
  }

  /**
   * Create Volume from percentage (0-100)
   */
  static fromPercentage(percentage: number): Volume {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Percentage must be between 0 and 100');
    }
    return Volume.create(percentage / 100);
  }

  /**
   * Create a silent volume
   */
  static silence(): Volume {
    return new Volume(0);
  }

  /**
   * Create a full volume
   */
  static full(): Volume {
    return new Volume(1);
  }

  /**
   * Create a default volume (75%)
   */
  static default(): Volume {
    return new Volume(0.75);
  }

  /**
   * Convert to decibels
   */
  toDecibels(): number {
    if (this.value === 0) {
      return -Infinity;
    }
    return 20 * Math.log10(this.value);
  }

  /**
   * Convert to percentage
   */
  toPercentage(): number {
    return Math.round(this.value * 100);
  }

  /**
   * Check if volume is muted
   */
  isMuted(): boolean {
    return this.value === 0;
  }

  /**
   * Check if volume is at maximum
   */
  isMaximum(): boolean {
    return this.value === 1;
  }

  /**
   * Apply gain to volume
   */
  applyGain(gain: number): Volume {
    return Volume.create(this.value * gain);
  }

  /**
   * Check equality with another Volume
   */
  equals(other: Volume): boolean {
    return Math.abs(this.value - other.value) < 0.001;
  }

  /**
   * Convert to string representation
   */
  toString(): string {
    return `${this.toPercentage()}%`;
  }

  /**
   * Convert to JSON
   */
  toJSON(): number {
    return this.value;
  }
}
