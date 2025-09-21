/**
 * Exercise Module
 *
 * Provides exercise loading and management functionality for the playback domain.
 * Handles MIDI file parsing and conversion to track regions.
 */

export { ExerciseLoader } from './core/ExerciseLoader.js';

export type {
  ExerciseLoaderConfig,
  LoadResult,
  ExerciseEvents,
  ExerciseMetadata,
} from './types/index.js';
