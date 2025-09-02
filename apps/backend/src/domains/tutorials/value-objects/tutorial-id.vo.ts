import { v4 as uuidv4 } from 'uuid';

export class TutorialId {
  private constructor(private readonly _value: string) {}

  static create(value?: string): TutorialId {
    if (value !== undefined) {
      if (!value || value.trim() === '') {
        throw new Error('Tutorial ID cannot be empty');
      }
      if (!this.isValid(value)) {
        throw new Error('Invalid TutorialId format');
      }
      return new TutorialId(value);
    }
    return new TutorialId(uuidv4());
  }

  static isValid(value: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }

  get value(): string {
    return this._value;
  }

  equals(other: TutorialId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
