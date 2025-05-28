// Local types copied from @bassnotion/contracts for standalone deployment

export interface MetronomeSettings {
  bpm: number;
  timeSignature: {
    numerator: number;
    denominator: number;
  };
  clickSound: 'beep' | 'click' | 'wood';
  accentFirstBeat: boolean;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile extends User {
  bio?: string;
  avatarUrl?: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  emailNotifications: boolean;
  defaultMetronomeSettings: MetronomeSettings;
}

export interface AuthCredentials {
  email: string;
  password: string;
}
