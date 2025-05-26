export class UserUpdatedEvent {
  constructor(
    public readonly userId: string,
    public readonly changes: {
      email?: string;
      displayName?: string;
      role?: string;
      avatarUrl?: string;
      lastLoginAt?: Date;
    },
  ) {}
}
