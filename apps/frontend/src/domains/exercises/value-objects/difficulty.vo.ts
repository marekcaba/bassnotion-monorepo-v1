export enum DifficultyLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert',
}

export class Difficulty {
  constructor(public readonly value: DifficultyLevel) {
    if (!Object.values(DifficultyLevel).includes(value)) {
      throw new Error(`Invalid difficulty level: ${value}`);
    }
    Object.freeze(this);
  }

  static fromString(value: string): Difficulty {
    const normalizedValue = value.toLowerCase();
    if (
      !Object.values(DifficultyLevel).includes(
        normalizedValue as DifficultyLevel,
      )
    ) {
      throw new Error(`Invalid difficulty level: ${value}`);
    }
    return new Difficulty(normalizedValue as DifficultyLevel);
  }

  static beginner(): Difficulty {
    return new Difficulty(DifficultyLevel.BEGINNER);
  }

  static intermediate(): Difficulty {
    return new Difficulty(DifficultyLevel.INTERMEDIATE);
  }

  static advanced(): Difficulty {
    return new Difficulty(DifficultyLevel.ADVANCED);
  }

  static expert(): Difficulty {
    return new Difficulty(DifficultyLevel.EXPERT);
  }

  equals(other: Difficulty): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }

  toDisplayString(): string {
    return this.value.charAt(0).toUpperCase() + this.value.slice(1);
  }

  getNumericValue(): number {
    switch (this.value) {
      case DifficultyLevel.BEGINNER:
        return 1;
      case DifficultyLevel.INTERMEDIATE:
        return 2;
      case DifficultyLevel.ADVANCED:
        return 3;
      case DifficultyLevel.EXPERT:
        return 4;
      default:
        return 0;
    }
  }

  isEasierThan(other: Difficulty): boolean {
    return this.getNumericValue() < other.getNumericValue();
  }

  isHarderThan(other: Difficulty): boolean {
    return this.getNumericValue() > other.getNumericValue();
  }
}
