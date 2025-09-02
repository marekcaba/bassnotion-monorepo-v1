export type TutorialLevelType = 'beginner' | 'intermediate' | 'advanced';

export class TutorialLevel {
  private static readonly VALID_LEVELS: TutorialLevelType[] = [
    'beginner',
    'intermediate',
    'advanced'
  ];

  private static readonly LEVEL_VALUES: Record<TutorialLevelType, number> = {
    'beginner': 1,
    'intermediate': 2,
    'advanced': 3
  };

  constructor(public readonly value: TutorialLevelType) {
    if (!TutorialLevel.isValid(value)) {
      throw new Error(`Invalid tutorial level: ${value}`);
    }
    Object.freeze(this);
  }

  static create(value: string): TutorialLevel {
    return new TutorialLevel(value as TutorialLevelType);
  }

  static isValid(value: string): boolean {
    return TutorialLevel.VALID_LEVELS.includes(value as TutorialLevelType);
  }

  equals(other: TutorialLevel): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }

  // Business logic methods
  getNumericValue(): number {
    return TutorialLevel.LEVEL_VALUES[this.value];
  }

  isHigherThan(other: TutorialLevel): boolean {
    return this.getNumericValue() > other.getNumericValue();
  }

  isLowerThan(other: TutorialLevel): boolean {
    return this.getNumericValue() < other.getNumericValue();
  }

  isAtLeast(other: TutorialLevel): boolean {
    return this.getNumericValue() >= other.getNumericValue();
  }

  canAccessLevel(requiredLevel: TutorialLevel): boolean {
    return this.isAtLeast(requiredLevel);
  }

  // Factory methods
  static beginner(): TutorialLevel {
    return new TutorialLevel('beginner');
  }

  static intermediate(): TutorialLevel {
    return new TutorialLevel('intermediate');
  }

  static advanced(): TutorialLevel {
    return new TutorialLevel('advanced');
  }
}