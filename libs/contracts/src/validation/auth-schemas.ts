import { z } from 'zod';
import {
  emailSchema,
  passwordSchema,
  ValidationMessages,
} from './common-schemas.js';

/**
 * Authentication validation schemas
 */

/**
 * Basic login schema - email and password only
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, ValidationMessages.password.required),
});

export type LoginData = z.infer<typeof loginSchema>;

/**
 * Registration schema - includes password confirmation
 */
export const registrationSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: ValidationMessages.password.mismatch,
    path: ['confirmPassword'],
  });

export type RegistrationData = z.infer<typeof registrationSchema>;

/**
 * Sign-up schema - includes profile information
 */
export const signUpSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    displayName: z.string().min(2, ValidationMessages.displayName.minLength),
    bio: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: ValidationMessages.password.mismatch,
    path: ['confirmPassword'],
  });

export type SignUpData = z.infer<typeof signUpSchema>;

/**
 * Sign-in schema - same as login but with different naming for consistency
 */
export const signInSchema = loginSchema;
export type SignInData = LoginData;
