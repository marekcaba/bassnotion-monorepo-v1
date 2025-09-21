/**
 * Pan Value Object
 *
 * Represents stereo panning position with validation.
 * -1 = full left, 0 = center, 1 = full right
 */

export class Pan {
  private constructor(public readonly value: number) {
    Object.freeze(this);
  }

  /**
   * Create a Pan from a normalized value (-1 to 1)
   */
  static create(value: number): Pan {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error('Pan must be a valid number');
    }

    if (value < -1) {
      throw new Error('Pan cannot be less than -1 (full left)');
    }

    if (value > 1) {
      throw new Error('Pan cannot exceed 1 (full right)');
    }

    return new Pan(Math.round(value * 100) / 100); // 2 decimal places
  }

  /**
   * Create Pan from percentage (-100 to 100)
   */
  static fromPercentage(percentage: number): Pan {
    if (percentage < -100 || percentage > 100) {
      throw new Error('Pan percentage must be between -100 and 100');
    }
    return Pan.create(percentage / 100);
  }

  /**
   * Create a centered pan
   */
  static center(): Pan {
    return new Pan(0);
  }

  /**
   * Create a hard left pan
   */
  static hardLeft(): Pan {
    return new Pan(-1);
  }

  /**
   * Create a hard right pan
   */
  static hardRight(): Pan {
    return new Pan(1);
  }

  /**
   * Convert to percentage
   */
  toPercentage(): number {
    return Math.round(this.value * 100);
  }

  /**
   * Get the position as a descriptive string
   */
  getPosition(): string {
    const percentage = this.toPercentage();

    if (percentage === 0) return 'Center';
    if (percentage === -100) return 'Hard Left';
    if (percentage === 100) return 'Hard Right';
    if (percentage < -66) return 'Far Left';
    if (percentage < -33) return 'Left';
    if (percentage < 0) return 'Slightly Left';
    if (percentage < 33) return 'Slightly Right';
    if (percentage < 66) return 'Right';
    return 'Far Right';
  }

  /**
   * Check if pan is centered
   */
  isCentered(): boolean {
    return Math.abs(this.value) < 0.01;
  }

  /**
   * Invert the pan position
   */
  invert(): Pan {
    return new Pan(-this.value);
  }

  /**
   * Apply stereo width (0 = mono, 1 = full stereo)
   */
  applyWidth(width: number): Pan {
    if (width < 0 || width > 1) {
      throw new Error('Width must be between 0 and 1');
    }
    return Pan.create(this.value * width);
  }

  /**
   * Check equality with another Pan
   */
  equals(other: Pan): boolean {
    return Math.abs(this.value - other.value) < 0.01;
  }

  /**
   * Convert to string representation
   */
  toString(): string {
    if (this.isCentered()) return 'C';
    const percentage = Math.abs(this.toPercentage());
    const direction = this.value < 0 ? 'L' : 'R';
    return `${percentage}${direction}`;
  }

  /**
   * Convert to JSON
   */
  toJSON(): number {
    return this.value;
  }
}
