export type UserRoleType = 'user' | 'moderator' | 'admin';

export class UserRole {
  private static readonly VALID_ROLES: UserRoleType[] = [
    'user',
    'moderator',
    'admin',
  ];

  constructor(public readonly value: UserRoleType) {
    if (!UserRole.isValid(value)) {
      throw new Error(`Invalid user role: ${value}`);
    }
    Object.freeze(this);
  }

  static create(value: string): UserRole {
    return new UserRole(value as UserRoleType);
  }

  static isValid(value: string): boolean {
    return UserRole.VALID_ROLES.includes(value as UserRoleType);
  }

  equals(other: UserRole): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }

  // Business logic for role hierarchy
  hasPermission(requiredRole: UserRoleType): boolean {
    const roleHierarchy: Record<UserRoleType, number> = {
      user: 1,
      moderator: 2,
      admin: 3,
    };

    return roleHierarchy[this.value] >= roleHierarchy[requiredRole];
  }

  isAdmin(): boolean {
    return this.value === 'admin';
  }

  isModerator(): boolean {
    return this.value === 'moderator' || this.value === 'admin';
  }
}
