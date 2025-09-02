import { describe, it, expect } from 'vitest';
import { TutorialSlug } from '../tutorial-slug.vo.js';

describe('TutorialSlug Value Object', () => {
  describe('create', () => {
    it('should create a valid slug', () => {
      const slug = TutorialSlug.create('valid-slug');

      expect(slug).toBeInstanceOf(TutorialSlug);
      expect(slug.value).toBe('valid-slug');
    });

    it('should convert to lowercase', () => {
      const slug = TutorialSlug.create('Valid-Slug');

      expect(slug.value).toBe('valid-slug');
    });

    it('should trim whitespace', () => {
      const slug = TutorialSlug.create('  valid-slug  ');

      expect(slug.value).toBe('valid-slug');
    });

    it('should throw error for empty string', () => {
      expect(() => TutorialSlug.create('')).toThrow(
        'Tutorial slug cannot be empty',
      );
    });

    it('should throw error for whitespace only', () => {
      expect(() => TutorialSlug.create('   ')).toThrow(
        'Tutorial slug cannot be empty',
      );
    });

    it('should throw error for invalid format with spaces', () => {
      expect(() => TutorialSlug.create('invalid slug')).toThrow(
        'Tutorial slug must contain only lowercase letters, numbers, and hyphens',
      );
    });

    it('should throw error for invalid format with special characters', () => {
      expect(() => TutorialSlug.create('invalid@slug')).toThrow(
        'Tutorial slug must contain only lowercase letters, numbers, and hyphens',
      );
    });

    it('should throw error for starting with hyphen', () => {
      expect(() => TutorialSlug.create('-invalid-slug')).toThrow(
        'Tutorial slug must contain only lowercase letters, numbers, and hyphens',
      );
    });

    it('should throw error for ending with hyphen', () => {
      expect(() => TutorialSlug.create('invalid-slug-')).toThrow(
        'Tutorial slug must contain only lowercase letters, numbers, and hyphens',
      );
    });

    it('should throw error for consecutive hyphens', () => {
      expect(() => TutorialSlug.create('invalid--slug')).toThrow(
        'Tutorial slug must contain only lowercase letters, numbers, and hyphens',
      );
    });

    it('should accept valid slugs with numbers', () => {
      const slug = TutorialSlug.create('tutorial-123');

      expect(slug.value).toBe('tutorial-123');
    });

    it('should accept valid slugs with multiple segments', () => {
      const slug = TutorialSlug.create('learn-bass-guitar-basics-2024');

      expect(slug.value).toBe('learn-bass-guitar-basics-2024');
    });

    it('should accept single word slugs', () => {
      const slug = TutorialSlug.create('tutorial');

      expect(slug.value).toBe('tutorial');
    });

    it('should accept single letter slugs', () => {
      const slug = TutorialSlug.create('a');

      expect(slug.value).toBe('a');
    });
  });

  describe('equals', () => {
    it('should return true for equal slugs', () => {
      const slug1 = TutorialSlug.create('same-slug');
      const slug2 = TutorialSlug.create('same-slug');

      expect(slug1.equals(slug2)).toBe(true);
    });

    it('should return true for equal slugs with different casing in input', () => {
      const slug1 = TutorialSlug.create('Same-Slug');
      const slug2 = TutorialSlug.create('SAME-SLUG');

      expect(slug1.equals(slug2)).toBe(true);
    });

    it('should return false for different slugs', () => {
      const slug1 = TutorialSlug.create('first-slug');
      const slug2 = TutorialSlug.create('second-slug');

      expect(slug1.equals(slug2)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the string value', () => {
      const slug = TutorialSlug.create('test-slug');

      expect(slug.toString()).toBe('test-slug');
    });
  });

  describe('immutability', () => {
    it('should not allow value modification', () => {
      const slug = TutorialSlug.create('immutable-slug');

      expect(() => {
        (slug as any).value = 'new-value';
      }).toThrow();
    });
  });
});
