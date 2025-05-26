import { AggregateRoot } from '@nestjs/cqrs';

import { UserCreatedEvent } from '../events/user-created.event.js';
import { UserUpdatedEvent } from '../events/user-updated.event.js';
import { Email } from '../value-objects/email.vo.js';
import { UserId } from '../value-objects/user-id.vo.js';
import { UserRole } from '../value-objects/user-role.vo.js';

export class User extends AggregateRoot {
  constructor(
    private readonly _id: UserId,
    private _email: Email,
    private _role: UserRole,
    private _displayName: string,
    private _avatarUrl?: string,
    private _lastLoginAt?: Date,
  ) {
    super();
  }

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

    this.apply(new UserUpdatedEvent(this.id, { displayName, avatarUrl }));
  }

  updateEmail(email: Email): void {
    this._email = email;
    this.apply(new UserUpdatedEvent(this.id, { email: email.value }));
  }

  updateRole(role: UserRole): void {
    this._role = role;
    this.apply(new UserUpdatedEvent(this.id, { role: role.value }));
  }

  recordLogin(): void {
    this._lastLoginAt = new Date();
    this.apply(
      new UserUpdatedEvent(this.id, { lastLoginAt: this._lastLoginAt }),
    );
  }

  // Factory method
  static create(
    id: UserId,
    email: Email,
    displayName: string,
    role: UserRole = UserRole.create('user'),
    avatarUrl?: string,
  ): User {
    const user = new User(id, email, role, displayName, avatarUrl);
    user.apply(
      new UserCreatedEvent(user.id, {
        email: email.value,
        displayName,
        role: role.value,
      }),
    );
    return user;
  }
}
