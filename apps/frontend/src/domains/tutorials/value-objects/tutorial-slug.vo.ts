export class TutorialSlug {
  constructor(public readonly value: string) {
    if (!TutorialSlug.isValid(value)) {
      throw new Error(
        `Invalid tutorial slug: ${value}. Must be URL-friendly (lowercase letters, numbers, hyphens)`,
      );
    }
    Object.freeze(this);
  }

  static create(value: string): TutorialSlug {
    return new TutorialSlug(value);
  }

  static fromTitle(title: string): TutorialSlug {
    const slug = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

    if (!slug) {
      throw new Error('Cannot create slug from empty title');
    }

    return new TutorialSlug(slug);
  }

  static isValid(value: string): boolean {
    // Must be lowercase letters, numbers, and hyphens only
    // Cannot start or end with a hyphen
    // Must be between 3 and 100 characters
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    return value.length >= 3 && value.length <= 100 && slugRegex.test(value);
  }

  equals(other: TutorialSlug): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
