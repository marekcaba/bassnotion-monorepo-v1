/**
 * Compatibility shim for migrating from old pattern system to new region system
 * This hook provides backward compatibility while widgets are being migrated
 * to the new useTrack hook introduced in Story 3.22
 *
 * @deprecated Use useTrack hook instead
 */
import { useCallback, useEffect, useRef } from 'react';
import { useTrack } from '@/domains/playback/hooks/useTrack';
import type { Pattern } from '@/domains/playback/types/pattern';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

interface UsePatternRegistrationOptions {
  widgetId: string;
  widgetType: 'drums' | 'metronome' | 'harmony' | 'bass';
}

interface UsePatternRegistrationReturn {
  registerPattern: (pattern: Pattern) => void;
  unregisterPattern: () => void;
  updatePattern: (pattern: Pattern) => void;
  isRegistered: boolean;
}

/**
 * @deprecated Legacy hook for pattern registration
 * Provides backward compatibility by wrapping the new useTrack hook
 */
export function usePatternRegistration(
  options: UsePatternRegistrationOptions,
): UsePatternRegistrationReturn {
  const { widgetId, widgetType } = options;
  const { track, migratePatternToRegion } = useTrack({
    trackId: widgetId,
    name: `${widgetType} Widget`,
    type: widgetType as any,
  });

  const currentRegionId = useRef<string | null>(null);
  const isRegistered = useRef(false);

  const registerPattern = useCallback(
    (pattern: Pattern) => {
      if (track && !currentRegionId.current) {
        const region = migratePatternToRegion(widgetId, pattern);
        currentRegionId.current = region.id;
        isRegistered.current = true;
        logger.warn(
          `[${widgetId}] Using deprecated pattern registration. ` +
            `Please migrate to useTrack hook for better performance and features.`,
        );
      }
    },
    [track, widgetId, migratePatternToRegion],
  );

  const unregisterPattern = useCallback(() => {
    if (track && currentRegionId.current) {
      track.removeRegion(currentRegionId.current);
      currentRegionId.current = null;
      isRegistered.current = false;
    }
  }, [track]);

  const updatePattern = useCallback(
    (pattern: Pattern) => {
      if (track && currentRegionId.current) {
        // Remove old region and create new one
        track.removeRegion(currentRegionId.current);
        const region = migratePatternToRegion(widgetId, pattern);
        currentRegionId.current = region.id;
      }
    },
    [track, widgetId, migratePatternToRegion],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentRegionId.current && track) {
        track.removeRegion(currentRegionId.current);
      }
    };
  }, [track]);

  return {
    registerPattern,
    unregisterPattern,
    updatePattern,
    isRegistered: isRegistered.current,
  };
}
