export class UserCreatedEvent {
  constructor(
    public readonly userId: string,
    public readonly data: {
      email: string;
      displayName: string;
      role: string;
    },
  ) {}
}
