/**
 * CachedSyncedWidget - Enhanced Base Component with Cache Support
 *
 * Extends SyncedWidget to provide cache checking helpers for the unified
 * sample loading system.
 *
 * Part of Story 3.25: Unified Sample Loading System Fix
 */

import React, { ReactNode, useEffect, useState, useCallback } from 'react';
import {
  SyncedWidget,
  SyncedWidgetProps,
  SyncedWidgetRenderProps,
} from './SyncedWidget';
import { GlobalSampleCache } from '@/domains/playback/modules/storage';
import { logger } from '@/domains/playback/utils/logger';

// ============================================================================
// INTERFACES
// ============================================================================

export interface CachedInstrumentStatus {
  isLoading: boolean;
  isLoaded: boolean;
  instrument: any | null;
  error: Error | null;
}

export interface CachedSyncedWidgetRenderProps extends SyncedWidgetRenderProps {
  // Cache helpers
  checkInstrumentCache: (cacheKey: string) => any | null;
  loadInstrumentWithCache: (
    cacheKey: string,
    loadFn: () => Promise<any>,
  ) => Promise<any>;
  getCachedUrl: (path: string) => string | null;
  getCachedBuffer: (path: string) => AudioBuffer | null;

  // Instrument status
  instrumentStatus: Record<string, CachedInstrumentStatus>;

  // Loading helpers
  isAnyInstrumentLoading: boolean;
  areAllInstrumentsLoaded: boolean;
}

export interface CachedSyncedWidgetProps
  extends Omit<SyncedWidgetProps, 'children'> {
  // Instrument cache keys this widget uses
  instrumentCacheKeys?: string[];

  // Pre-load instruments on mount
  preloadOnMount?: boolean;

  // Custom loading functions for each cache key
  instrumentLoaders?: Record<string, () => Promise<any>>;

  // Render props with cache helpers
  children: (props: CachedSyncedWidgetRenderProps) => ReactNode;
}

// ============================================================================
// CACHED SYNCED WIDGET COMPONENT
// ============================================================================

export const CachedSyncedWidget: React.FC<CachedSyncedWidgetProps> = ({
  widgetId,
  widgetName,
  instrumentCacheKeys = [],
  preloadOnMount = false,
  instrumentLoaders = {},
  children,
  ...restProps
}) => {
  // Track instrument status for each cache key
  const [instrumentStatus, setInstrumentStatus] = useState<
    Record<string, CachedInstrumentStatus>
  >(() => {
    const initialStatus: Record<string, CachedInstrumentStatus> = {};
    instrumentCacheKeys.forEach((key) => {
      initialStatus[key] = {
        isLoading: false,
        isLoaded: false,
        instrument: null,
        error: null,
      };
    });
    return initialStatus;
  });

  // Check instrument cache
  const checkInstrumentCache = useCallback(
    (cacheKey: string): any | null => {
      const cached = GlobalSampleCache.getCachedInstrument(cacheKey);
      if (cached) {
        logger.log(`✅ [${widgetName}] Found cached instrument: ${cacheKey}`);
        // Update status if not already marked as loaded
        setInstrumentStatus((prev) => {
          if (!prev[cacheKey]?.isLoaded) {
            return {
              ...prev,
              [cacheKey]: {
                isLoading: false,
                isLoaded: true,
                instrument: cached,
                error: null,
              },
            };
          }
          return prev;
        });
      }
      return cached;
    },
    [widgetName],
  );

  // Load instrument with cache check
  const loadInstrumentWithCache = useCallback(
    async (cacheKey: string, loadFn: () => Promise<any>): Promise<any> => {
      // First check cache
      const cached = checkInstrumentCache(cacheKey);
      if (cached) {
        return cached;
      }

      // Update loading state
      setInstrumentStatus((prev) => ({
        ...prev,
        [cacheKey]: { ...prev[cacheKey], isLoading: true },
      }));

      try {
        logger.log(`🔄 [${widgetName}] Loading instrument: ${cacheKey}`);
        const instrument = await loadFn();

        // Cache the loaded instrument
        GlobalSampleCache.cacheInstrument(cacheKey, instrument);
        logger.log(`💾 [${widgetName}] Cached instrument: ${cacheKey}`);

        // Update status
        setInstrumentStatus((prev) => ({
          ...prev,
          [cacheKey]: {
            isLoading: false,
            isLoaded: true,
            instrument,
            error: null,
          },
        }));

        return instrument;
      } catch (error) {
        logger.error(
          `❌ [${widgetName}] Failed to load instrument: ${cacheKey}`,
          error,
        );

        // Update error state
        setInstrumentStatus((prev) => ({
          ...prev,
          [cacheKey]: {
            isLoading: false,
            isLoaded: false,
            instrument: null,
            error: error as Error,
          },
        }));

        throw error;
      }
    },
    [widgetName, checkInstrumentCache],
  );

  // Cache accessors
  const getCachedUrl = useCallback((path: string): string | null => {
    return GlobalSampleCache.getCachedUrl(path);
  }, []);

  const getCachedBuffer = useCallback((path: string): AudioBuffer | null => {
    return GlobalSampleCache.getCachedBuffer(path);
  }, []);

  // Preload on mount if requested
  useEffect(() => {
    if (preloadOnMount) {
      instrumentCacheKeys.forEach((cacheKey) => {
        // Check if already cached
        const cached = GlobalSampleCache.getCachedInstrument(cacheKey);
        if (!cached && instrumentLoaders[cacheKey]) {
          // Load if not cached and loader provided
          loadInstrumentWithCache(cacheKey, instrumentLoaders[cacheKey]);
        }
      });
    }
  }, [
    preloadOnMount,
    instrumentCacheKeys,
    instrumentLoaders,
    loadInstrumentWithCache,
  ]);

  // Check initial cache state
  useEffect(() => {
    instrumentCacheKeys.forEach((cacheKey) => {
      checkInstrumentCache(cacheKey);
    });
  }, [instrumentCacheKeys, checkInstrumentCache]);

  // Calculate aggregate loading states
  const isAnyInstrumentLoading = Object.values(instrumentStatus).some(
    (status) => status.isLoading,
  );
  const areAllInstrumentsLoaded =
    instrumentCacheKeys.length > 0 &&
    instrumentCacheKeys.every((key) => instrumentStatus[key]?.isLoaded);

  // Log cache stats in debug mode
  useEffect(() => {
    if (restProps.debugMode) {
      const stats = GlobalSampleCache.getStats();
      logger.log(`📊 [${widgetName}] Cache stats:`, stats);
    }
  }, [widgetName, restProps.debugMode]);

  return (
    <SyncedWidget widgetId={widgetId} widgetName={widgetName} {...restProps}>
      {(syncProps) =>
        children({
          ...syncProps,
          checkInstrumentCache,
          loadInstrumentWithCache,
          getCachedUrl,
          getCachedBuffer,
          instrumentStatus,
          isAnyInstrumentLoading,
          areAllInstrumentsLoaded,
        })
      }
    </SyncedWidget>
  );
};

// ============================================================================
// HOOK FOR USE IN EXISTING WIDGETS
// ============================================================================

export interface UseCachedInstrumentOptions {
  cacheKey: string;
  loadFn: () => Promise<any>;
  widgetName?: string;
}

/**
 * Hook for managing cached instrument loading
 */
export const useCachedInstrument = ({
  cacheKey,
  loadFn,
  widgetName = 'Widget',
}: UseCachedInstrumentOptions) => {
  const [status, setStatus] = useState<CachedInstrumentStatus>({
    isLoading: false,
    isLoaded: false,
    instrument: null,
    error: null,
  });

  // Check and load instrument
  const loadInstrument = useCallback(async () => {
    // First check cache
    const cached = GlobalSampleCache.getCachedInstrument(cacheKey);
    if (cached) {
      logger.log(`✅ [${widgetName}] Using cached instrument: ${cacheKey}`);
      setStatus({
        isLoading: false,
        isLoaded: true,
        instrument: cached,
        error: null,
      });
      return cached;
    }

    // Load if not cached
    setStatus((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      logger.log(`🔄 [${widgetName}] Loading instrument: ${cacheKey}`);
      const instrument = await loadFn();

      // Cache it
      GlobalSampleCache.cacheInstrument(cacheKey, instrument);

      setStatus({
        isLoading: false,
        isLoaded: true,
        instrument,
        error: null,
      });

      return instrument;
    } catch (error) {
      logger.error(
        `❌ [${widgetName}] Failed to load instrument: ${cacheKey}`,
        error,
      );
      setStatus({
        isLoading: false,
        isLoaded: false,
        instrument: null,
        error: error as Error,
      });
      throw error;
    }
  }, [cacheKey, loadFn, widgetName]);

  // Check cache on mount
  useEffect(() => {
    const cached = GlobalSampleCache.getCachedInstrument(cacheKey);
    if (cached && !status.isLoaded) {
      setStatus({
        isLoading: false,
        isLoaded: true,
        instrument: cached,
        error: null,
      });
    }
  }, [cacheKey, status.isLoaded]);

  return {
    ...status,
    loadInstrument,
    refresh: loadInstrument,
  };
};

// ============================================================================
// EXAMPLE USAGE
// ============================================================================

/**
 * Example of how to use CachedSyncedWidget:
 *
 * <CachedSyncedWidget
 *   widgetId="harmony-1"
 *   widgetName="HarmonyWidget"
 *   instrumentCacheKeys={['harmony-preloaded']}
 *   preloadOnMount={false}
 *   instrumentLoaders={{
 *     'harmony-preloaded': async () => {
 *       const context = await ensureAudioContext();
 *       return wamPluginSingleton.getOrCreateKeyboardPlugin(context);
 *     }
 *   }}
 * >
 *   {(props) => {
 *     const harmonyInstrument = props.instrumentStatus['harmony-preloaded']?.instrument;
 *
 *     if (!harmonyInstrument && !props.isAnyInstrumentLoading) {
 *       // Load on demand
 *       props.loadInstrumentWithCache('harmony-preloaded', ...);
 *     }
 *
 *     return <div>Widget content</div>;
 *   }}
 * </CachedSyncedWidget>
 */
