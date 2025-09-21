export class Email {
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  constructor(public readonly value: string) {
    if (!Email.isValid(value)) {
      throw new Error(`Invalid email format: ${value}`);
    }
    Object.freeze(this);
  }

  static create(value: string): Email {
    return new Email(value.toLowerCase().trim());
  }

  static isValid(value: string): boolean {
    return Email.EMAIL_REGEX.test(value);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }

  getDomain(): string {
    return this.value.split('@')[1];
  }
}
