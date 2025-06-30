import { describe, it, expect } from 'vitest';
import {
  emailSchema,
  passwordSchema,
  displayNameSchema,
  bioSchema,
  emailPattern,
  passwordPattern,
  ValidationMessages,
} from '../common-schemas.js';

describe('Common Validation Schemas', () => {
  describe('emailSchema', () => {
    it('should accept valid email addresses', () => {
      const validEmails = [
        'user@example.com',
        'test.email@domain.org',
        'user+tag@example.co.uk',
        'firstname.lastname@company.com',
        'user123@test-domain.com',
      ];

      validEmails.forEach((email) => {
        expect(() => emailSchema.parse(email)).not.toThrow();
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        '',
        'invalid-email',
        '@domain.com',
        'user@',
        'user@domain',
        'user.domain.com',
        'user@domain.',
        'user space@domain.com',
      ];

      invalidEmails.forEach((email) => {
        expect(() => emailSchema.parse(email)).toThrow();
      });
    });

    it('should return correct error messages', () => {
      try {
        emailSchema.parse('');
      } catch (error: any) {
        expect(error.errors[0].message).toBe(ValidationMessages.email.required);
      }

      try {
        emailSchema.parse('invalid-email');
      } catch (error: any) {
        expect(error.errors[0].message).toBe(ValidationMessages.email.invalid);
      }
    });
  });

  describe('passwordSchema', () => {
    it('should accept valid passwords', () => {
      const validPasswords = [
        'Password123!',
        'MySecure@Pass1',
        'Strong#Password2',
        'Valid$Pass3',
        'Secure%Pass4',
        'Good^Password5',
        'Test&Pass6',
        'My*Password7',
      ];

      validPasswords.forEach((password) => {
        expect(() => passwordSchema.parse(password)).not.toThrow();
      });
    });

    it('should reject passwords that are too short', () => {
      const shortPasswords = ['Pass1!', 'Ab1!', 'Short2@', '1234567'];

      shortPasswords.forEach((password) => {
        expect(() => passwordSchema.parse(password)).toThrow();
      });
    });

    it('should reject passwords without uppercase letters', () => {
      const noUppercasePasswords = [
        'password123!',
        'mypass@word1',
        'lowercase#123',
      ];

      noUppercasePasswords.forEach((password) => {
        expect(() => passwordSchema.parse(password)).toThrow();
      });
    });

    it('should reject passwords without lowercase letters', () => {
      const noLowercasePasswords = [
        'PASSWORD123!',
        'MYPASS@WORD1',
        'UPPERCASE#123',
      ];

      noLowercasePasswords.forEach((password) => {
        expect(() => passwordSchema.parse(password)).toThrow();
      });
    });

    it('should reject passwords without numbers or special characters', () => {
      const noNumbersOrSpecialPasswords = [
        'PasswordOnly',
        'MySecurePass',
        'StrongPassword',
      ];

      noNumbersOrSpecialPasswords.forEach((password) => {
        expect(() => passwordSchema.parse(password)).toThrow();
      });
    });

    it('should return correct error messages', () => {
      try {
        passwordSchema.parse('short');
      } catch (error: any) {
        expect(error.errors[0].message).toBe(
          ValidationMessages.password.minLength,
        );
      }

      try {
        passwordSchema.parse('weakpassword');
      } catch (error: any) {
        expect(error.errors[0].message).toBe(
          ValidationMessages.password.strength,
        );
      }
    });
  });

  describe('displayNameSchema', () => {
    it('should accept valid display names', () => {
      const validNames = [
        'John Doe',
        'Jane',
        'User123',
        'Bass Player',
        'Music Lover',
        'JohnDoe123',
        'User Name With Spaces',
      ];

      validNames.forEach((name) => {
        expect(() => displayNameSchema.parse(name)).not.toThrow();
      });
    });

    it('should reject display names that are too short', () => {
      const shortNames = ['', 'A', ' '];

      shortNames.forEach((name) => {
        expect(() => displayNameSchema.parse(name)).toThrow();
      });
    });

    it('should return correct error message', () => {
      try {
        displayNameSchema.parse('A');
      } catch (error: any) {
        expect(error.errors[0].message).toBe(
          ValidationMessages.displayName.minLength,
        );
      }
    });
  });

  describe('bioSchema', () => {
    it('should accept valid bio strings', () => {
      const validBios = [
        'I love playing bass guitar!',
        'Musician and bass enthusiast',
        'Learning bass through BassNotion',
        '',
      ];

      validBios.forEach((bio) => {
        expect(() => bioSchema.parse(bio)).not.toThrow();
      });
    });

    it('should accept null and undefined values', () => {
      expect(() => bioSchema.parse(null)).not.toThrow();
      expect(() => bioSchema.parse(undefined)).not.toThrow();
    });

    it('should handle optional bio field', () => {
      const result1 = bioSchema.parse('Valid bio');
      const result2 = bioSchema.parse(null);
      const result3 = bioSchema.parse(undefined);

      expect(result1).toBe('Valid bio');
      expect(result2).toBe(null);
      expect(result3).toBe(undefined);
    });
  });

  describe('emailPattern', () => {
    it('should match valid email formats', () => {
      const validEmails = [
        'user@example.com',
        'test.email@domain.org',
        'user+tag@example.co.uk',
      ];

      validEmails.forEach((email) => {
        expect(emailPattern.test(email)).toBe(true);
      });
    });

    it('should not match invalid email formats', () => {
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user@domain',
      ];

      invalidEmails.forEach((email) => {
        expect(emailPattern.test(email)).toBe(false);
      });
    });
  });

  describe('passwordPattern', () => {
    it('should match valid password formats', () => {
      const validPasswords = [
        'Password123!',
        'MySecure@Pass1',
        'Strong#Password2',
      ];

      validPasswords.forEach((password) => {
        expect(passwordPattern.test(password)).toBe(true);
      });
    });

    it('should not match invalid password formats', () => {
      const _invalidPasswords = [
        'password123!', // no uppercase
        'PASSWORD123!', // no lowercase
        'PasswordOnly', // no numbers or special chars
        'Pass1!', // too short (but pattern doesn't check length)
      ];

      // Note: passwordPattern only checks for character requirements, not length
      expect(passwordPattern.test('password123!')).toBe(false); // no uppercase
      expect(passwordPattern.test('PASSWORD123!')).toBe(false); // no lowercase
      expect(passwordPattern.test('PasswordOnly')).toBe(false); // no numbers or special chars
      expect(passwordPattern.test('Pass1!')).toBe(true); // has all required chars
    });
  });

  describe('ValidationMessages', () => {
    it('should contain all required message categories', () => {
      expect(ValidationMessages.email).toBeDefined();
      expect(ValidationMessages.password).toBeDefined();
      expect(ValidationMessages.displayName).toBeDefined();
    });

    it('should contain all required email messages', () => {
      expect(ValidationMessages.email.required).toBe('Email is required');
      expect(ValidationMessages.email.invalid).toBe('Invalid email format');
    });

    it('should contain all required password messages', () => {
      expect(ValidationMessages.password.required).toBe('Password is required');
      expect(ValidationMessages.password.minLength).toBe(
        'Password must be at least 8 characters',
      );
      expect(ValidationMessages.password.strength).toBe(
        'Password must contain uppercase, lowercase, number and special character',
      );
      expect(ValidationMessages.password.mismatch).toBe(
        "Passwords don't match",
      );
    });

    it('should contain all required display name messages', () => {
      expect(ValidationMessages.displayName.required).toBe(
        'Display name is required',
      );
      expect(ValidationMessages.displayName.minLength).toBe(
        'Display name must be at least 2 characters',
      );
    });
  });
});
