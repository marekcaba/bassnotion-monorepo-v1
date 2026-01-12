/**
 * useRingOverlay - Hook for Ring Overlay Access Control and Configuration
 *
 * This hook manages:
 * 1. Premium access gating for the animated ring feature
 * 2. Configuration state for ring appearance and behavior
 * 3. Free tutorial teaser access (3 designated tutorials)
 *
 * @module useRingOverlay
 * @since Phase 1 - Foundation
 */

import { useMemo, useCallback } from 'react';
import { useUserAccess } from '@/domains/billing/hooks/useBilling';
import type { RingOverlayConfig } from './RingOverlayConfig.js';
import { DEFAULT_RING_CONFIG } from './RingOverlayConfig.js';

/**
 * Options for the useRingOverlay hook.
 */
export interface UseRingOverlayOptions {
  /** Current tutorial slug for free access checking */
  tutorialSlug?: string;
  /** User's custom ring preferences (persisted separately) */
  userPreferences?: Partial<RingOverlayConfig>;
}

/**
 * Result from useRingOverlay hook.
 */
export interface UseRingOverlayResult {
  /** Current ring configuration (merged defaults + user preferences) */
  config: RingOverlayConfig;
  /** Whether user has access to animated ring (premium or free tutorial) */
  hasAccess: boolean;
  /** Whether access is from free tutorial teaser */
  hasFreeAccess: boolean;
  /** Whether user has premium subscription */
  isPremium: boolean;
  /** Whether access status is still loading */
  isLoading: boolean;
  /** Attempt to enable ring overlay - returns success or reason for failure */
  enableRingOverlay: (enable: boolean) => EnableRingResult;
  /** Update ring configuration (respects access control) */
  updateConfig: (updates: Partial<RingOverlayConfig>) => void;
}

/**
 * Result from attempting to enable ring overlay.
 */
export interface EnableRingResult {
  success: boolean;
  reason?: 'premium_required' | 'tutorial_not_free';
}

/**
 * Tutorial slugs that include free animated ring access (teaser).
 * These tutorials give free users a taste of the premium feature.
 */
const FREE_ANIMATED_RING_TUTORIALS = [
  'intro-to-bass',
  'basic-rhythms',
  'first-song',
] as const;

/**
 * Check if a tutorial slug qualifies for free animated ring access.
 *
 * @param tutorialSlug - The tutorial identifier
 * @returns Whether the tutorial includes free animated ring
 */
function isFreeRingTutorial(tutorialSlug: string | undefined): boolean {
  if (!tutorialSlug) return false;
  return (FREE_ANIMATED_RING_TUTORIALS as readonly string[]).includes(
    tutorialSlug
  );
}

/**
 * Hook for managing ring overlay access and configuration.
 *
 * @example
 * ```tsx
 * const { config, hasAccess, enableRingOverlay } = useRingOverlay({
 *   tutorialSlug: 'intro-to-bass',
 *   userPreferences: { glowIntensity: 0.7 },
 * });
 *
 * if (hasAccess && config.enabled) {
 *   return <Ring3DOverlayCanvas config={config} />;
 * }
 * ```
 *
 * @param options - Configuration options
 * @returns Ring overlay state and controls
 */
export function useRingOverlay(
  options: UseRingOverlayOptions = {}
): UseRingOverlayResult {
  const { tutorialSlug, userPreferences } = options;

  // Get premium access status from billing system
  const { data: accessData, isLoading } = useUserAccess();
  const isPremium = accessData?.hasActiveSubscription ?? false;

  // Check for free tutorial teaser access
  const hasFreeAccess = useMemo(() => {
    return isFreeRingTutorial(tutorialSlug);
  }, [tutorialSlug]);

  // User has access if premium OR current tutorial is a free teaser
  const hasAccess = isPremium || hasFreeAccess;

  // Build final configuration with access enforcement
  const config: RingOverlayConfig = useMemo(() => {
    const merged = {
      ...DEFAULT_RING_CONFIG,
      ...userPreferences,
    };

    // DEBUG: Force enable for calibration testing
    // TODO: Remove this after calibration is complete
    const DEBUG_FORCE_ENABLE = true;
    if (DEBUG_FORCE_ENABLE) {
      // PERFORMANCE: Removed console.log - this runs on every render
      return {
        ...merged,
        enabled: true,
      };
    }

    // Override enabled to false if user doesn't have access
    if (!hasAccess) {
      return {
        ...merged,
        enabled: false,
      };
    }

    return merged;
  }, [hasAccess, userPreferences]);

  // Attempt to enable ring overlay
  const enableRingOverlay = useCallback(
    (enable: boolean): EnableRingResult => {
      if (!enable) {
        // Disabling is always allowed
        return { success: true };
      }

      if (!hasAccess) {
        // User doesn't have access - cannot enable
        return {
          success: false,
          reason: hasFreeAccess ? undefined : 'premium_required',
        };
      }

      return { success: true };
    },
    [hasAccess, hasFreeAccess]
  );

  // Update configuration (placeholder - actual persistence would be separate)
  const updateConfig = useCallback(
    (updates: Partial<RingOverlayConfig>): void => {
      // This would typically update a Zustand store or similar
      // For Phase 1, we just log the intent
      if (process.env.NODE_ENV === 'development') {
        console.log('[useRingOverlay] Config update requested:', updates);
      }
    },
    []
  );

  return {
    config,
    hasAccess,
    hasFreeAccess,
    isPremium,
    isLoading,
    enableRingOverlay,
    updateConfig,
  };
}
