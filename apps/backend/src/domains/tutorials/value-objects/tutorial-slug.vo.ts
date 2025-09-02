export class TutorialSlug {
  private constructor(private readonly _value: string) {
    Object.freeze(this);
  }

  static create(value: string): TutorialSlug {
    const normalized = this.normalize(value);

    // Check for empty string after normalization
    if (!normalized) {
      throw new Error('Tutorial slug cannot be empty');
    }

    // Validate the slug format
    if (!this.isValid(normalized)) {
      throw new Error(
        'Tutorial slug must contain only lowercase letters, numbers, and hyphens',
      );
    }

    return new TutorialSlug(normalized);
  }

  static fromTitle(title: string): TutorialSlug {
    const slug = title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

    return this.create(slug);
  }

  static isValid(value: string): boolean {
    // Slug must be lowercase, alphanumeric with hyphens
    // Cannot start or end with hyphen
    // Cannot have consecutive hyphens
    // Minimum length of 1 character (to support single letter slugs)
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    return slugRegex.test(value) && value.length >= 1 && value.length <= 100;
  }

  private static normalize(value: string): string {
    return value.toLowerCase().trim();
  }

  get value(): string {
    return this._value;
  }

  equals(other: TutorialSlug): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
