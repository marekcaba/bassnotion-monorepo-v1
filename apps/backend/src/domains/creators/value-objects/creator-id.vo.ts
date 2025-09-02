import { v4 as uuidv4 } from 'uuid';

export class CreatorId {
  private constructor(public readonly value: string) {
    Object.freeze(this);
  }

  static create(value?: string): CreatorId {
    if (value) {
      if (value.trim() === '') {
        throw new Error('Creator ID cannot be empty');
      }
      return new CreatorId(value);
    }
    return new CreatorId(uuidv4());
  }

  equals(other: CreatorId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
