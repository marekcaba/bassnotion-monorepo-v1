import { z } from 'zod';

/**
 * Common validation patterns and schemas used across the application
 */

// Email validation pattern
export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Password strength pattern - at least 8 chars, uppercase, lowercase, number or special char
export const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9!@#$%^&*])/;

/**
 * Common validation messages
 */
export const ValidationMessages = {
  email: {
    required: 'Email is required',
    invalid: 'Invalid email format',
  },
  password: {
    required: 'Password is required',
    minLength: 'Password must be at least 8 characters',
    strength:
      'Password must contain uppercase, lowercase, number and special character',
    mismatch: "Passwords don't match",
  },
  displayName: {
    required: 'Display name is required',
    minLength: 'Display name must be at least 2 characters',
  },
} as const;

/**
 * Base email schema
 */
export const emailSchema = z
  .string()
  .min(1, ValidationMessages.email.required)
  .email(ValidationMessages.email.invalid);

/**
 * Base password schema
 */
export const passwordSchema = z
  .string()
  .min(8, ValidationMessages.password.minLength)
  .regex(passwordPattern, ValidationMessages.password.strength);

/**
 * Display name schema
 */
export const displayNameSchema = z
  .string()
  .min(2, ValidationMessages.displayName.minLength);

/**
 * Optional bio schema
 */
export const bioSchema = z.string().optional();
