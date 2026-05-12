import { MetronomeSettings } from './common.js';
import type {
  SkillLevel,
  PrimaryGoal,
  BassTechnique,
  MusicGenre,
} from './assessment.js';

/**
 * Learning Style - User preference for journey progression
 * - free_flow: Complete at own pace, no restrictions
 * - guided_practice: Soft nudges between checkpoints
 * - strict_mode: Must complete recommended sessions before proceeding
 */
export type LearningStyle = 'free_flow' | 'guided_practice' | 'strict_mode';

export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser extends User {
  // Represents a user in an authenticated context
  // This interface can be extended with auth-specific properties in the future
  readonly isAuthenticated?: true;
}

export interface UserProfile extends User {
  bio?: string;
  avatarUrl?: string;
  role?: 'user' | 'admin' | 'moderator'; // User role
  preferences: UserPreferences;

  // Assessment results (from entrance quiz)
  skillLevel?: SkillLevel;
  assessmentCompleted?: boolean;
  assessmentCompletedAt?: string;
  assessmentScore?: number;
  primaryGoal?: PrimaryGoal;
  preferredTechniques?: BassTechnique[];
  preferredGenres?: MusicGenre[];
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  emailNotifications: boolean;
  defaultMetronomeSettings: MetronomeSettings;
  bassConfiguration: BassConfiguration;
  learningStyle: LearningStyle;
}

export interface BassConfiguration {
  stringCount: 4 | 5 | 6;
  maxFrets: number;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface TokenInfo {
  id: string;
  userId: string;
  type: 'free' | 'purchased';
  status: TokenStatus;
  createdAt: string;
  usedAt?: string;
}

export enum TokenStatus {
  AVAILABLE = 'available',
  CONSUMED = 'consumed',
  EXPIRED = 'expired',
}
