import { Email } from '../value-objects/email.vo';
import { UserId } from '../value-objects/user-id.vo';
import { UserRole } from '../value-objects/user-role.vo';

export class User {
  constructor(
    private readonly _id: UserId,
    private _email: Email,
    private _role: UserRole,
    private _displayName: string,
    private _avatarUrl?: string,
    private _lastLoginAt?: Date,
  ) {}

  // Identity
  get id(): string {
    return this._id.value;
  }

  // Properties
  get email(): string {
    return this._email.value;
  }

  get role(): string {
    return this._role.value;
  }

  get displayName(): string {
    return this._displayName;
  }

  get avatarUrl(): string | undefined {
    return this._avatarUrl;
  }

  get lastLoginAt(): Date | undefined {
    return this._lastLoginAt;
  }

  // Behavior
  updateProfile(displayName: string, avatarUrl?: string): void {
    this._displayName = displayName;
    this._avatarUrl = avatarUrl;
  }

  updateEmail(email: Email): void {
    this._email = email;
  }

  updateRole(role: UserRole): void {
    this._role = role;
  }

  recordLogin(): void {
    this._lastLoginAt = new Date();
  }

  // Business logic methods
  canAccessAdminPanel(): boolean {
    return this._role.value === 'admin' || this._role.value === 'moderator';
  }

  isActive(): boolean {
    // User is considered active if they logged in within last 30 days
    if (!this._lastLoginAt) return false;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return this._lastLoginAt > thirtyDaysAgo;
  }

  hasCompletedProfile(): boolean {
    return !!this._displayName && !!this._avatarUrl;
  }

  // Factory methods
  static create(
    id: UserId,
    email: Email,
    displayName: string,
    role: UserRole = UserRole.create('user'),
    avatarUrl?: string,
  ): User {
    return new User(id, email, role, displayName, avatarUrl);
  }

  static reconstitute(
    id: UserId,
    email: Email,
    role: UserRole,
    displayName: string,
    avatarUrl?: string,
    lastLoginAt?: Date,
  ): User {
    return new User(id, email, role, displayName, avatarUrl, lastLoginAt);
  }

  // Conversion method for API/persistence
  toJSON(): any {
    return {
      id: this._id.value,
      email: this._email.value,
      displayName: this._displayName,
      role: this._role.value,
      avatarUrl: this._avatarUrl,
      lastLoginAt: this._lastLoginAt?.toISOString(),
    };
  }

  // Clone method for immutability in state management
  clone(): User {
    return new User(
      this._id,
      this._email,
      this._role,
      this._displayName,
      this._avatarUrl,
      this._lastLoginAt,
    );
  }
}
