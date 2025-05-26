export class Email {
  private constructor(private readonly _value: string) {
    this.validate(_value);
  }

  get value(): string {
    return this._value;
  }

  private validate(value: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      throw new Error(`Invalid email address: ${value}`);
    }
  }

  equals(other: Email): boolean {
    return this._value.toLowerCase() === other.value.toLowerCase();
  }

  static create(value: string): Email {
    return new Email(value);
  }
}
