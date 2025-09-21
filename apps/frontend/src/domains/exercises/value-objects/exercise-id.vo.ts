export class ExerciseId {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('ExerciseId cannot be empty');
    }
    Object.freeze(this);
  }

  static create(value: string): ExerciseId {
    return new ExerciseId(value);
  }

  static generate(): ExerciseId {
    // Generate a UUID-like ID for new exercises
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return new ExerciseId(`ex_${timestamp}_${random}`);
  }

  equals(other: ExerciseId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
