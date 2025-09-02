export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export class Difficulty {
  private static readonly VALID_LEVELS: DifficultyLevel[] = [
    'beginner', 
    'intermediate', 
    'advanced', 
    'expert'
  ];

  private static readonly LEVEL_VALUES: Record<DifficultyLevel, number> = {
    'beginner': 1,
    'intermediate': 2,
    'advanced': 3,
    'expert': 4
  };

  constructor(public readonly value: DifficultyLevel) {
    if (!Difficulty.isValid(value)) {
      throw new Error(`Invalid difficulty level: ${value}`);
    }
    Object.freeze(this);
  }

  static create(value: string): Difficulty {
    return new Difficulty(value as DifficultyLevel);
  }

  static isValid(value: string): boolean {
    return Difficulty.VALID_LEVELS.includes(value as DifficultyLevel);
  }

  equals(other: Difficulty): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }

  // Business logic methods
  isBeginnerFriendly(): boolean {
    return this.value === 'beginner' || this.value === 'intermediate';
  }

  isAdvanced(): boolean {
    return this.value === 'advanced' || this.value === 'expert';
  }

  getNumericValue(): number {
    return Difficulty.LEVEL_VALUES[this.value];
  }

  isHigherThan(other: Difficulty): boolean {
    return this.getNumericValue() > other.getNumericValue();
  }

  isLowerThan(other: Difficulty): boolean {
    return this.getNumericValue() < other.getNumericValue();
  }

  // Factory methods for common difficulties
  static beginner(): Difficulty {
    return new Difficulty('beginner');
  }

  static intermediate(): Difficulty {
    return new Difficulty('intermediate');
  }

  static advanced(): Difficulty {
    return new Difficulty('advanced');
  }

  static expert(): Difficulty {
    return new Difficulty('expert');
  }
}