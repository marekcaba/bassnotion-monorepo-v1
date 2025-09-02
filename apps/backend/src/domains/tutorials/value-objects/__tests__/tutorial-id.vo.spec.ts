import { describe, it, expect } from 'vitest';
import { TutorialId } from '../tutorial-id.vo.js';

describe('TutorialId Value Object', () => {
  describe('create', () => {
    it('should create a new TutorialId with UUID when no value provided', () => {
      const id = TutorialId.create();

      expect(id).toBeInstanceOf(TutorialId);
      expect(id.value).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('should create a TutorialId with provided value', () => {
      const value = '123e4567-e89b-12d3-a456-426614174000';
      const id = TutorialId.create(value);

      expect(id).toBeInstanceOf(TutorialId);
      expect(id.value).toBe(value);
    });

    it('should throw error for empty string', () => {
      expect(() => TutorialId.create('')).toThrow(
        'Tutorial ID cannot be empty',
      );
    });

    it('should throw error for whitespace string', () => {
      expect(() => TutorialId.create('   ')).toThrow(
        'Tutorial ID cannot be empty',
      );
    });
  });

  describe('equals', () => {
    it('should return true for equal IDs', () => {
      const value = '123e4567-e89b-12d3-a456-426614174000';
      const id1 = TutorialId.create(value);
      const id2 = TutorialId.create(value);

      expect(id1.equals(id2)).toBe(true);
    });

    it('should return false for different IDs', () => {
      const id1 = TutorialId.create('123e4567-e89b-12d3-a456-426614174000');
      const id2 = TutorialId.create('987fcdeb-51a2-43e1-b098-765432109876');

      expect(id1.equals(id2)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the string value', () => {
      const value = '123e4567-e89b-12d3-a456-426614174000';
      const id = TutorialId.create(value);

      expect(id.toString()).toBe(value);
    });
  });

  describe('immutability', () => {
    it('should not allow value modification', () => {
      const id = TutorialId.create('123e4567-e89b-12d3-a456-426614174000');

      expect(() => {
        (id as any).value = 'new-value';
      }).toThrow();
    });
  });
});
