/**
 * Feature Flags for Audio Architecture Migration
 * Story 3.18.3: Global State Elimination
 * 
 * These flags control the gradual rollout of the new FAANG-style
 * audio architecture and provide safe rollback capabilities.
 */

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
}

// Default feature flag configuration
// Epic 3.18 completed - new architecture is now the default
const defaultFlags: AudioArchitectureFlags = {
  USE_NEW_AUDIO_ENGINE: true,
  USE_NEW_DEPENDENCY_INJECTION: true,
  ROLLBACK_TO_OLD_SYSTEM: false,
  ENABLE_MIGRATION_MONITORING: true,
  ROLLOUT_PERCENTAGE: 100
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
      USE_NEW_DEPENDENCY_INJECTION: false
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
    
    ROLLOUT_PERCENTAGE: 
      parseInt(process.env.NEXT_PUBLIC_AUDIO_ROLLOUT_PERCENTAGE || '100', 10)
  };

  // Apply rollout percentage logic
  if (flags.ROLLOUT_PERCENTAGE > 0 && flags.ROLLOUT_PERCENTAGE < 100) {
    const userId = getUserIdentifier();
    const shouldEnableForUser = isUserInRolloutPercentage(userId, flags.ROLLOUT_PERCENTAGE);
    
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
function isUserInRolloutPercentage(userId: string, percentage: number): boolean {
  // Simple stable hash function
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
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
  data?: Record<string, any>
): void {
  const flags = getAudioArchitectureFlags();
  
  if (flags.ENABLE_MIGRATION_MONITORING) {
    console.log(`[Audio Migration] ${event}`, {
      ...data,
      flags,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Check if new audio architecture is enabled
 * Convenience helper for components
 */
export function isNewAudioArchitectureEnabled(): boolean {
  const flags = getAudioArchitectureFlags();
  return !flags.ROLLBACK_TO_OLD_SYSTEM && 
         flags.USE_NEW_AUDIO_ENGINE && 
         flags.USE_NEW_DEPENDENCY_INJECTION;
}

/**
 * Export flag constants for testing
 */
export const AUDIO_ARCHITECTURE_FLAGS = getAudioArchitectureFlags();