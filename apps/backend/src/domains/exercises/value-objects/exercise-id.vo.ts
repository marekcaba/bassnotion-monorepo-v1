import { v4 as uuidv4 } from 'uuid';

export class ExerciseId {
  private constructor(private readonly _value: string) {}

  static create(value?: string): ExerciseId {
    if (value) {
      if (!this.isValid(value)) {
        throw new Error('Invalid ExerciseId format');
      }
      return new ExerciseId(value);
    }
    return new ExerciseId(uuidv4());
  }

  static isValid(value: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }

  get value(): string {
    return this._value;
  }

  equals(other: ExerciseId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
