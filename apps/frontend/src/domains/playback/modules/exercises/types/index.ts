/**
 * Exercise Module Types
 *
 * Type definitions for exercise loading and management
 */

import type {
  SessionModel,
  RegionModel,
} from '../../../models/SessionModel.js';
import type { MidiEvent } from '../../midi/types.js';

/**
 * Exercise loader configuration
 */
export interface ExerciseLoaderConfig {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  autoLoadSamples?: boolean;
  cacheEnabled?: boolean;
}

/**
 * Result of loading an exercise
 */
export interface LoadResult {
  session: SessionModel;
  regions: RegionModel[];
  midiEvents: MidiEvent[];
}

/**
 * Exercise loading events
 */
export interface ExerciseEvents {
  'exercise:loaded': {
    exerciseId: string;
    sessionId: string;
    regionCount: number;
  };
  'exercise:loadError': {
    exerciseId: string;
    error: string;
  };
  'exercise:loadedIntoTracks': {
    exerciseId: string;
    sessionId: string;
    trackCount: number;
    regionCount: number;
  };
}

/**
 * Exercise metadata
 */
export interface ExerciseMetadata {
  id: string;
  title: string;
  bpm: number;
  timeSignature: string;
  duration: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
}
