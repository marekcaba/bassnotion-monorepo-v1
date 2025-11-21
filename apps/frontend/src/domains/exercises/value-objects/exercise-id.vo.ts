import { v4 as uuidv4 } from 'uuid';

export class ExerciseId {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('ExerciseId cannot be empty');
    }
    Object.freeze(this);
  }

  static create(value?: string): ExerciseId {
    if (value) {
      return new ExerciseId(value);
    }
    // Generate a new UUID
    return new ExerciseId(uuidv4());
  }

  equals(other: ExerciseId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}