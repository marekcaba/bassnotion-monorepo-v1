export class TutorialId {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('TutorialId cannot be empty');
    }
    Object.freeze(this);
  }

  static create(value?: string): TutorialId {
    if (value) {
      return new TutorialId(value);
    }
    // Generate a new ID
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return new TutorialId(`tut_${timestamp}_${random}`);
  }

  equals(other: TutorialId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}