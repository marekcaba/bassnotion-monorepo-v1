export class UserRole {
  private constructor(private readonly _value: string) {
    this.validate(_value);
  }

  get value(): string {
    return this._value;
  }

  private validate(value: string): void {
    const validRoles = ['user', 'admin', 'moderator'];
    if (!validRoles.includes(value)) {
      throw new Error(`Invalid user role: ${value}`);
    }
  }

  equals(other: UserRole): boolean {
    return this._value === other.value;
  }

  static create(value: string): UserRole {
    return new UserRole(value);
  }
}
