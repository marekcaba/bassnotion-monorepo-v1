export class UserId {
  private constructor(private readonly _value: string) {
    this.validate(_value);
  }

  get value(): string {
    return this._value;
  }

  private validate(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new Error('User ID cannot be empty');
    }
    // Add additional validation if needed (e.g., UUID format)
  }

  equals(other: UserId): boolean {
    return this._value === other.value;
  }

  static create(value: string): UserId {
    return new UserId(value);
  }

  static isValid(value: string): boolean {
    if (!value || value.trim().length === 0) {
      return false;
    }
    // Check if it's a valid UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }
}
