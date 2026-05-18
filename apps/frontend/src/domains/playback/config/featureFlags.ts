/**
 * Feature Flags for Audio Architecture Migration
 * Story 3.18.3: Global State Elimination
 *
 * These flags control the gradual rollout of the new FAANG-style
 * audio architecture and provide safe rollback capabilities.
 */

// eslint-disable-next-line @nx/enforce-module-boundaries -- featureFlags is loaded at module init; lazy-loading defeats the purpose
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('FeatureFlags');

export interface AudioArchitectureFlags {
  /** Use the new AudioEngine from core services */
  USE_NEW_AUDIO_ENGINE: boolean;

  /** Use ServiceRegistry for dependency injection */
  USE_NEW_DEPENDENCY_INJECTION: boolean;

  /** Emergency rollback to old system */
  ROLLBACK_TO_OLD_SYSTEM: boolean;

  /** Enable migration monitoring and logging */
  ENABLE_MIGRATION_MONITORING: boolean;

  /** Percentage of users to roll out to (0-100) */
  ROLLOUT_PERCENTAGE: number;

  /** Use new modular transport implementation */
  USE_MODULAR_TRANSPORT: boolean;

  /** Enable debug logging for transport migration */
  DEBUG_TRANSPORT_MIGRATION: boolean;

  /** Enable performance comparison between old and new transport */
  COMPARE_TRANSPORT_PERFORMANCE: boolean;

  /** Use new modular instruments implementation */
  USE_MODULAR_INSTRUMENTS: boolean;

  /** Enable debug logging for instruments migration */
  DEBUG_INSTRUMENTS_MIGRATION: boolean;

  /** Use new PlaybackEngine instead of RegionProcessor (Phase 0.4) */
  ENABLE_NEW_PLAYBACK_ENGINE: boolean;

  /** Enable debug logging for PlaybackEngine migration */
  DEBUG_PLAYBACK_ENGINE_MIGRATION: boolean;

  /** Enable performance comparison between RegionProcessor and PlaybackEngine */
  COMPARE_PLAYBACK_ENGINE_PERFORMANCE: boolean;
}

// Default feature flag configuration
// Epic 3.18 completed - new architecture is now the default
const defaultFlags: AudioArchitectureFlags = {
  USE_NEW_AUDIO_ENGINE: true,
  USE_NEW_DEPENDENCY_INJECTION: true,
  ROLLBACK_TO_OLD_SYSTEM: false,
  ENABLE_MIGRATION_MONITORING: true,
  ROLLOUT_PERCENTAGE: 100,
  USE_MODULAR_TRANSPORT: true, // Modular transport is now the default
  DEBUG_TRANSPORT_MIGRATION: false, // Migration complete
  COMPARE_TRANSPORT_PERFORMANCE: false, // No longer needed
  USE_MODULAR_INSTRUMENTS: true, // Modular instruments are now the default
  DEBUG_INSTRUMENTS_MIGRATION: false, // Migration complete
  ENABLE_NEW_PLAYBACK_ENGINE: true, // Phase 3.2 — 100% rollout, RegionProcessor deleted
  DEBUG_PLAYBACK_ENGINE_MIGRATION: false, // Migration complete — disabled for prod (re-enable via NEXT_PUBLIC_DEBUG_PLAYBACK_ENGINE_MIGRATION if needed)
  COMPARE_PLAYBACK_ENGINE_PERFORMANCE: false, // Migration complete — old engine no longer in tree
};

/**
 * Get current feature flag configuration
 * Checks environment variables and applies rollout percentage
 */
export function getAudioArchitectureFlags(): AudioArchitectureFlags {
  // Check for emergency rollback first
  if (process.env.NEXT_PUBLIC_ROLLBACK_AUDIO === 'true') {
    return {
      ...defaultFlags,
      ROLLBACK_TO_OLD_SYSTEM: true,
      USE_NEW_AUDIO_ENGINE: false,
      USE_NEW_DEPENDENCY_INJECTION: false,
    };
  }

  // Get flags from environment or use defaults
  const flags: AudioArchitectureFlags = {
    USE_NEW_AUDIO_ENGINE:
      process.env.NEXT_PUBLIC_USE_NEW_AUDIO_ENGINE === 'true' ||
      defaultFlags.USE_NEW_AUDIO_ENGINE,

    USE_NEW_DEPENDENCY_INJECTION:
      process.env.NEXT_PUBLIC_USE_NEW_DI === 'true' ||
      defaultFlags.USE_NEW_DEPENDENCY_INJECTION,

    ROLLBACK_TO_OLD_SYSTEM: false,

    ENABLE_MIGRATION_MONITORING:
      process.env.NEXT_PUBLIC_ENABLE_MIGRATION_MONITORING !== 'false',

    ROLLOUT_PERCENTAGE: parseInt(
      process.env.NEXT_PUBLIC_AUDIO_ROLLOUT_PERCENTAGE || '100',
      10,
    ),

    USE_MODULAR_TRANSPORT:
      process.env.NEXT_PUBLIC_USE_MODULAR_TRANSPORT === 'true' ||
      defaultFlags.USE_MODULAR_TRANSPORT,

    DEBUG_TRANSPORT_MIGRATION:
      process.env.NEXT_PUBLIC_DEBUG_TRANSPORT_MIGRATION === 'true' ||
      defaultFlags.DEBUG_TRANSPORT_MIGRATION,

    COMPARE_TRANSPORT_PERFORMANCE:
      process.env.NEXT_PUBLIC_COMPARE_TRANSPORT_PERFORMANCE === 'true' ||
      defaultFlags.COMPARE_TRANSPORT_PERFORMANCE,

    USE_MODULAR_INSTRUMENTS:
      process.env.NEXT_PUBLIC_USE_MODULAR_INSTRUMENTS === 'true' ||
      defaultFlags.USE_MODULAR_INSTRUMENTS,

    DEBUG_INSTRUMENTS_MIGRATION:
      process.env.NEXT_PUBLIC_DEBUG_INSTRUMENTS_MIGRATION === 'true' ||
      defaultFlags.DEBUG_INSTRUMENTS_MIGRATION,

    ENABLE_NEW_PLAYBACK_ENGINE:
      process.env.NEXT_PUBLIC_ENABLE_NEW_PLAYBACK_ENGINE === 'true' ||
      defaultFlags.ENABLE_NEW_PLAYBACK_ENGINE,

    DEBUG_PLAYBACK_ENGINE_MIGRATION:
      process.env.NEXT_PUBLIC_DEBUG_PLAYBACK_ENGINE_MIGRATION === 'true' ||
      defaultFlags.DEBUG_PLAYBACK_ENGINE_MIGRATION,

    COMPARE_PLAYBACK_ENGINE_PERFORMANCE:
      process.env.NEXT_PUBLIC_COMPARE_PLAYBACK_ENGINE_PERFORMANCE === 'true' ||
      defaultFlags.COMPARE_PLAYBACK_ENGINE_PERFORMANCE,
  };

  // Apply rollout percentage logic
  if (flags.ROLLOUT_PERCENTAGE > 0 && flags.ROLLOUT_PERCENTAGE < 100) {
    const userId = getUserIdentifier();
    const shouldEnableForUser = isUserInRolloutPercentage(
      userId,
      flags.ROLLOUT_PERCENTAGE,
    );

    if (!shouldEnableForUser) {
      flags.USE_NEW_AUDIO_ENGINE = false;
      flags.USE_NEW_DEPENDENCY_INJECTION = false;
    }
  }

  return flags;
}

/**
 * Get a stable user identifier for rollout percentage calculation
 * Uses localStorage to ensure consistent experience for the same user
 */
function getUserIdentifier(): string {
  if (typeof window === 'undefined') return 'ssr';

  const storageKey = 'bassnotion_user_id';
  let userId = localStorage.getItem(storageKey);

  if (!userId) {
    userId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem(storageKey, userId);
  }

  return userId;
}

/**
 * Determine if a user should be included in the rollout percentage
 * Uses a stable hash to ensure consistent assignment
 */
function isUserInRolloutPercentage(
  userId: string,
  percentage: number,
): boolean {
  // Simple stable hash function
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Convert hash to 0-100 range
  const userPercentage = Math.abs(hash) % 100;

  return userPercentage < percentage;
}

/**
 * Migration monitoring helper
 * Logs migration events when monitoring is enabled
 */
export function logMigrationEvent(
  event: string,
  data?: Record<string, any>,
): void {
  const flags = getAudioArchitectureFlags();

  if (flags.ENABLE_MIGRATION_MONITORING) {
    logger.info(`[Audio Migration] ${event}`, {
      ...data,
      flags,
      timestamp: new Date().toISOString(),
      correlationId: 'system',
    });
  }
}

/**
 * Check if new audio architecture is enabled
 * Convenience helper for components
 */
export function isNewAudioArchitectureEnabled(): boolean {
  const flags = getAudioArchitectureFlags();
  return (
    !flags.ROLLBACK_TO_OLD_SYSTEM &&
    flags.USE_NEW_AUDIO_ENGINE &&
    flags.USE_NEW_DEPENDENCY_INJECTION
  );
}

/**
 * Check if modular transport is enabled
 */
export function isModularTransportEnabled(): boolean {
  const flags = getAudioArchitectureFlags();
  return flags.USE_MODULAR_TRANSPORT && !flags.ROLLBACK_TO_OLD_SYSTEM;
}

/**
 * Check if modular instruments are enabled
 */
export function isModularInstrumentsEnabled(): boolean {
  const flags = getAudioArchitectureFlags();
  return flags.USE_MODULAR_INSTRUMENTS && !flags.ROLLBACK_TO_OLD_SYSTEM;
}

/**
 * Log transport migration event
 */
export function logTransportMigrationEvent(
  event: string,
  data?: Record<string, any>,
): void {
  const flags = getAudioArchitectureFlags();

  if (flags.DEBUG_TRANSPORT_MIGRATION) {
    logger.info(`[Transport Migration] ${event}`, {
      ...data,
      usingModularTransport: flags.USE_MODULAR_TRANSPORT,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Log instruments migration event
 */
export function logInstrumentsMigrationEvent(
  event: string,
  data?: Record<string, any>,
): void {
  const flags = getAudioArchitectureFlags();

  if (flags.DEBUG_INSTRUMENTS_MIGRATION) {
    logger.info(`[Instruments Migration] ${event}`, {
      ...data,
      usingModularInstruments: flags.USE_MODULAR_INSTRUMENTS,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Export flag constants for testing
 */
export const AUDIO_ARCHITECTURE_FLAGS = getAudioArchitectureFlags();

/**
 * Check if new PlaybackEngine is enabled (Phase 0.4)
 */
export function isNewPlaybackEngineEnabled(): boolean {
  const flags = getAudioArchitectureFlags();
  return flags.ENABLE_NEW_PLAYBACK_ENGINE && !flags.ROLLBACK_TO_OLD_SYSTEM;
}

/**
 * Log PlaybackEngine migration event
 */
export function logPlaybackEngineMigrationEvent(
  event: string,
  data?: Record<string, any>,
): void {
  const flags = getAudioArchitectureFlags();

  if (flags.DEBUG_PLAYBACK_ENGINE_MIGRATION) {
    logger.info(`[PlaybackEngine Migration] ${event}`, {
      ...data,
      usingNewPlaybackEngine: flags.ENABLE_NEW_PLAYBACK_ENGINE,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Simple feature flags object for easy access
 */
export const featureFlags = {
  get modularTransport() {
    return isModularTransportEnabled();
  },
  get modularInstruments() {
    return isModularInstrumentsEnabled();
  },
  get newAudioArchitecture() {
    return isNewAudioArchitectureEnabled();
  },
  get newPlaybackEngine() {
    return isNewPlaybackEngineEnabled();
  },
};
