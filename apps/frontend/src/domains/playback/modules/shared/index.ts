/**
 * Shared Module - Cross-cutting concerns for all playback modules
 *
 * This module contains shared utilities, types, and services that are
 * used across multiple playback modules. It helps prevent circular
 * dependencies and provides a centralized location for common functionality.
 */

/* eslint-disable no-restricted-imports */
// This file is the shared module itself and needs to import from services to re-export them

// Core shared services
export { EventBus } from '../../services/core/EventBus.js';
export type {
  EventData,
  EventMetadata,
  EventHandler,
  EventBusConfig,
  EventSchema,
} from '../../services/core/EventBus.js';

// Error handling utilities
export { CircuitBreaker } from '../../services/errors/CircuitBreaker.js';
export { CircuitState } from '../../services/errors/CircuitBreaker.js';
export type {
  CircuitBreakerConfig,
  CircuitBreakerMetrics,
  RetryContext,
} from '../../services/errors/CircuitBreaker.js';

// Common types that are used across modules
export type {
  InstrumentType,
  MidiInstrumentType,
  AudioInstrumentType,
} from '../tracks/management/TrackManagerProcessor.js';

// Musical position types (used by multiple modules)
export type { MusicalPosition } from '../../types/pattern.js';

// Service registry for dependency injection
export { ServiceRegistry } from '../../services/core/ServiceRegistry.js';
export type {
  Service,
  ServiceConfig,
} from '../../services/core/ServiceRegistry.js';

// Correlation tracking for debugging
export { useCorrelation } from '@/shared/hooks/useCorrelation';

// Structured logging
export { createStructuredLogger } from '@/shared/utils/errorHandling';

// Core module interfaces
export * from './interfaces.js';

// Loaders and utilities
export * from './loaders/toneLoader.js';

// Legacy bridge (temporary)
export * from './legacy-bridge.js';

// Plugin types
export * from '../../types/plugin.js';

// Feature flags
export { getAudioArchitectureFlags } from '../../config/featureFlags.js';
export type { AudioArchitectureFlags } from '../../config/featureFlags.js';
