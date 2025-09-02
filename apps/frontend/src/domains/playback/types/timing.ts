/**
 * Re-export MusicalPosition from pattern.ts for backward compatibility
 */
export type { MusicalPosition } from './pattern.js';

/**
 * Time signature representation
 */
export interface TimeSignature {
  numerator: number;
  denominator: number;
}

/**
 * Timing event for scheduler
 */
export interface TimingEvent {
  time: number;
  callback: (time: number) => void;
  priority: 'high' | 'normal' | 'low';
  id?: string;
}
