import { MetronomeSettings } from './common.js';

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
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  emailNotifications: boolean;
  defaultMetronomeSettings: MetronomeSettings;
  bassConfiguration: BassConfiguration;
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
