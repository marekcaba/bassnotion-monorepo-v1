export enum DifficultyLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced' }

export class Difficulty {
  private constructor(private readonly _value: DifficultyLevel) {}

  static create(value: string): Difficulty {
    const normalizedValue = value.toLowerCase() as DifficultyLevel;

    if (!Object.values(DifficultyLevel).includes(normalizedValue)) {
      throw new Error(
        `Invalid difficulty level: ${value}. Must be one of: ${Object.values(DifficultyLevel).join(', ')}`,
      );
    }

    return new Difficulty(normalizedValue);
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

  get value(): DifficultyLevel {
    return this._value;
  }

  isBeginnerFriendly(): boolean {
    return this._value === DifficultyLevel.BEGINNER;
  }

  isMoreDifficultThan(other: Difficulty): boolean {
    const levels = [
      DifficultyLevel.BEGINNER,
      DifficultyLevel.INTERMEDIATE,
      DifficultyLevel.ADVANCED,
    ];
    return levels.indexOf(this._value) > levels.indexOf(other._value);
  }

  equals(other: Difficulty): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
