/**
 * Pattern Scheduling Module
 * 
 * Professional DAW-style pattern scheduler extracted from the original
 * PatternScheduler with all critical features preserved.
 */

export { PatternScheduler } from './PatternScheduler';
export { RegionManager } from './RegionManager';
export { EventScheduler } from './EventScheduler';
export { PatternConverter } from './PatternConverter';

export type {
  IPatternScheduler,
  PatternSchedulerConfig,
  PatternSchedulingMetrics,
  SchedulableEvent,
  ScheduledRegion,
  EventSchedulingResult,
  MusicalTimeOptions,
  LoopIteration,
  RegionActivationState,
  PatternSchedulerEvents,
} from './types';