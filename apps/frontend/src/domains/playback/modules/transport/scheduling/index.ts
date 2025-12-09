/**
 * Position Update Scheduling Module
 *
 * Provides centralized position update management with mutual exclusion
 * between polling and event-driven strategies.
 *
 * @module transport/scheduling
 */

export { PositionUpdateScheduler } from './PositionUpdateScheduler.js';
export { EventDrivenStrategy } from './strategies/EventDrivenStrategy.js';
export { PollingStrategy } from './strategies/PollingStrategy.js';
export type {
  IPositionUpdateScheduler,
  PositionUpdate,
  PositionUpdateCallback,
  PositionUpdateStrategy,
  SchedulerConfig,
  SchedulerStartOptions,
} from './types/scheduler.types.js';
export { DEFAULT_SCHEDULER_CONFIG } from './types/scheduler.types.js';
