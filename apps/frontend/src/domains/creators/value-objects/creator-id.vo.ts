export class CreatorId {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('CreatorId cannot be empty');
    }
    Object.freeze(this);
  }

  static create(value?: string): CreatorId {
    if (value) {
      return new CreatorId(value);
    }
    // Generate a new ID
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return new CreatorId(`creator_${timestamp}_${random}`);
  }

  equals(other: CreatorId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}