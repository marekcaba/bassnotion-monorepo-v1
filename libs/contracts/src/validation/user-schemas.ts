import { z } from 'zod';
import { emailSchema, displayNameSchema, bioSchema } from './common-schemas.js';

/**
 * User profile validation schemas
 */

/**
 * User profile schema for profile updates
 */
export const userProfileSchema = z.object({
  displayName: displayNameSchema,
  bio: bioSchema,
  avatarUrl: z.string().url().optional(),
});

export type UserProfileData = z.infer<typeof userProfileSchema>;

/**
 * User preferences schema
 */
export const userPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark']).default('dark'),
  emailNotifications: z.boolean().default(true),
  defaultMetronomeSettings: z.object({
    bpm: z.number().min(40).max(300).default(120),
    timeSignature: z.string().default('4/4'),
    sound: z.enum(['click', 'beep', 'wood']).default('click'),
  }),
});

export type UserPreferencesData = z.infer<typeof userPreferencesSchema>;

/**
 * Complete user schema (read-only, for API responses)
 */
export const userSchema = z.object({
  id: z.string(),
  email: emailSchema,
  displayName: displayNameSchema,
  bio: bioSchema,
  avatarUrl: z.string().url().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type UserData = z.infer<typeof userSchema>;
