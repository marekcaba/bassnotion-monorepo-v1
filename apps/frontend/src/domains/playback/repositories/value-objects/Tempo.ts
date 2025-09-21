/**
 * Tempo Value Object
 *
 * Represents beats per minute (BPM) with validation.
 * Ensures tempo values are within reasonable musical ranges.
 */

export class Tempo {
  private constructor(public readonly value: number) {
    Object.freeze(this);
  }

  /**
   * Create a Tempo from a number
   */
  static create(value: number): Tempo {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error('Tempo must be a valid number');
    }

    // Validate reasonable tempo range (20-999 BPM)
    if (value < 20) {
      throw new Error('Tempo cannot be less than 20 BPM');
    }

    if (value > 999) {
      throw new Error('Tempo cannot exceed 999 BPM');
    }

    return new Tempo(Math.round(value * 10) / 10); // Allow 1 decimal place
  }

  /**
   * Create a tempo from a musical term
   */
  static fromMusicalTerm(term: string): Tempo {
    const tempoMap: Record<string, number> = {
      grave: 35,
      largo: 50,
      larghetto: 63,
      adagio: 70,
      andante: 85,
      moderato: 105,
      allegretto: 115,
      allegro: 130,
      vivace: 140,
      presto: 170,
      prestissimo: 200,
    };

    const normalizedTerm = term.toLowerCase().trim();
    const bpm = tempoMap[normalizedTerm];

    if (!bpm) {
      throw new Error(`Unknown musical tempo term: ${term}`);
    }

    return new Tempo(bpm);
  }

  /**
   * Get the tempo category
   */
  getCategory(): string {
    if (this.value < 40) return 'Very Slow';
    if (this.value < 60) return 'Slow';
    if (this.value < 80) return 'Moderate-Slow';
    if (this.value < 120) return 'Moderate';
    if (this.value < 140) return 'Moderate-Fast';
    if (this.value < 180) return 'Fast';
    return 'Very Fast';
  }

  /**
   * Calculate the duration of one beat in milliseconds
   */
  getBeatDurationMs(): number {
    return 60000 / this.value;
  }

  /**
   * Calculate the duration of one bar in milliseconds (assuming 4/4 time)
   */
  getBarDurationMs(timeSignatureNumerator = 4): number {
    return this.getBeatDurationMs() * timeSignatureNumerator;
  }

  /**
   * Check equality with another Tempo
   */
  equals(other: Tempo): boolean {
    return Math.abs(this.value - other.value) < 0.1; // Account for decimal precision
  }

  /**
   * Convert to string representation
   */
  toString(): string {
    return `${this.value} BPM`;
  }

  /**
   * Convert to JSON
   */
  toJSON(): number {
    return this.value;
  }
}
