/**
 * useAssetLoading Hook
 *
 * Provides widgets with Epic 2 asset loading state and progress tracking.
 * Optimized for widget consumption with detailed loading information.
 *
 * Part of Story 2.1, Task 15: Enhanced Export Structure & Integration
 * Subtask 15.3: Enhance hook exports for widget consumption
 */

import { useCallback, useMemo } from 'react';
import { usePlaybackStore } from '../store/playbackStore.js';
import type {
  AssetLoadingProgress,
  AssetLoadingItemProgress,
  AssetLoadingError,
  AssetLoadingMetrics,
} from '../store/playbackStore.js';
import type { N8nPayloadConfig, AssetManifest } from '../types/audio.js';

// ============================================================================
// HOOK INTERFACE
// ============================================================================

export interface UseAssetLoadingReturn {
  // N8n Payload State
  n8nPayload: N8nPayloadConfig | null;
  payloadProcessingStage: AssetLoadingProgress['payloadProcessingStage'];
  payloadValidationErrors: string[];

  // Asset Manifest State
  assetManifest: AssetManifest | null;
  manifestProcessingStage: AssetLoadingProgress['manifestProcessingStage'];
  manifestValidationErrors: string[];

  // Loading Progress
  loadingStage: AssetLoadingProgress['loadingStage'];
  loadingErrors: AssetLoadingError[];
  loadingMetrics: AssetLoadingMetrics;

  // Progress Information
  progressPercentage: number;
  loadingMessage: string;
  estimatedTimeRemaining: number;

  // Asset Status
  totalAssets: number;
  loadedAssets: number;
  failedAssets: number;
  criticalAssets: string[];
  minimumViableAssetsLoaded: boolean;
  canStartPlayback: boolean;

  // Background Loading
  backgroundLoadingActive: boolean;
  backgroundLoadingQueue: string[];

  // Individual Asset Progress
  getAssetProgress: (assetId: string) => AssetLoadingItemProgress | undefined;
  getAssetError: (assetId: string) => AssetLoadingError | undefined;
  isAssetRetrying: (assetId: string) => boolean;

  // Convenience Status
  isIdle: boolean;
  isLoading: boolean;
  isComplete: boolean;
  hasErrors: boolean;

  // Actions
  retryFailedAssets: () => void;
  clearLoadingErrors: () => void;
  resetAssetLoading: () => void;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Hook for widgets to track Epic 2 asset loading progress
 *
 * @param widgetId - Optional widget ID for tracking widget-specific usage
 * @returns Asset loading state and utility functions
 *
 * @example
 * ```tsx
 * function YouTubeExerciserWidget() {
 *   const {
 *     progressPercentage,
 *     loadingMessage,
 *     canStartPlayback,
 *     isLoading,
 *     hasErrors,
 *     loadingErrors,
 *     retryFailedAssets
 *   } = useAssetLoading('youtube-exerciser');
 *
 *   if (isLoading) {
 *     return (
 *       <div className="loading-overlay">
 *         <div className="progress-bar">
 *           <div
 *             className="progress-fill"
 *             style={{ width: `${progressPercentage}%` }}
 *           />
 *         </div>
 *         <p>{loadingMessage}</p>
 *       </div>
 *     );
 *   }
 *
 *   if (hasErrors) {
 *     return (
 *       <div className="error-state">
 *         <p>Loading failed: {loadingErrors[0]?.errorMessage}</p>
 *         <button onClick={retryFailedAssets}>Retry</button>
 *       </div>
 *     );
 *   }
 *
 *   return (
 *     <div>
 // TODO: Review non-null assertion - consider null safety
 *       <button disabled={!canStartPlayback}>
 *         Start Exercise
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAssetLoading(widgetId?: string): UseAssetLoadingReturn {
  // Asset loading progress selector
  const assetLoadingProgress = usePlaybackStore(
    (state) => state.assetLoadingProgress,
  );

  // Action selectors
  const clearLoadingErrors = usePlaybackStore(
    (state) => state.clearLoadingErrors,
  );
  const resetAssetLoadingState = usePlaybackStore(
    (state) => state.resetAssetLoadingState,
  );
  const addToBackgroundQueue = usePlaybackStore(
    (state) => state.addToBackgroundQueue,
  );

  // Extract individual properties for easier access
  const {
    n8nPayload,
    payloadProcessingStage,
    payloadValidationErrors,
    assetManifest,
    manifestProcessingStage,
    manifestValidationErrors,
    loadingStage,
    loadingErrors,
    loadingMetrics,
    progressPercentage,
    loadingMessage,
    estimatedTimeRemaining,
    criticalAssets,
    minimumViableAssetsLoaded,
    canStartPlayback,
    backgroundLoadingActive,
    backgroundLoadingQueue,
    assetProgress,
    failedAssets,
    retryingAssets,
  } = assetLoadingProgress;

  // Convenience status calculations
  const isIdle = useMemo(() => loadingStage === 'idle', [loadingStage]);
  const isLoading = useMemo(
    () =>
      loadingStage === 'preparing' ||
      loadingStage === 'loading' ||
      loadingStage === 'processing',
    [loadingStage],
  );
  const isComplete = useMemo(() => loadingStage === 'complete', [loadingStage]);
  const hasErrors = useMemo(
    () =>
      loadingErrors.length > 0 ||
      payloadValidationErrors.length > 0 ||
      manifestValidationErrors.length > 0,
    [
      loadingErrors.length,
      payloadValidationErrors.length,
      manifestValidationErrors.length,
    ],
  );

  // Asset count calculations
  const totalAssets = useMemo(
    () => assetManifest?.totalCount || 0,
    [assetManifest?.totalCount],
  );
  const loadedAssets = useMemo(() => {
    let count = 0;
    assetProgress.forEach((progress) => {
      if (progress.stage === 'complete') {
        count++;
      }
    });
    return count;
  }, [assetProgress]);

  const failedAssetsCount = useMemo(
    () => failedAssets.size,
    [failedAssets.size],
  );

  // Utility functions
  const getAssetProgress = useCallback(
    (assetId: string): AssetLoadingItemProgress | undefined => {
      const progress = assetProgress.get(assetId);
      if (widgetId && progress) {
        console.debug(
          `Widget ${widgetId} checking asset progress for ${assetId}:`,
          progress.stage,
        );
      }
      return progress;
    },
    [assetProgress, widgetId],
  );

  const getAssetError = useCallback(
    (assetId: string): AssetLoadingError | undefined => {
      const error = failedAssets.get(assetId);
      if (widgetId && error) {
        console.debug(
          `Widget ${widgetId} checking asset error for ${assetId}:`,
          error.errorMessage,
        );
      }
      return error;
    },
    [failedAssets, widgetId],
  );

  const isAssetRetrying = useCallback(
    (assetId: string): boolean => {
      const retrying = retryingAssets.has(assetId);
      if (widgetId && retrying) {
        console.debug(
          `Widget ${widgetId} checking retry status for ${assetId}: retrying`,
        );
      }
      return retrying;
    },
    [retryingAssets, widgetId],
  );

  // Action functions
  const retryFailedAssets = useCallback(() => {
    // Add failed assets back to the background loading queue for retry
    failedAssets.forEach((error, assetId) => {
      if (error.canRetry && error.retryCount < error.maxRetries) {
        addToBackgroundQueue(assetId);
      }
    });

    clearLoadingErrors();

    if (widgetId) {
      console.debug(
        `Widget ${widgetId} retrying ${failedAssets.size} failed assets`,
      );
    }
  }, [failedAssets, addToBackgroundQueue, clearLoadingErrors, widgetId]);

  const resetAssetLoading = useCallback(() => {
    resetAssetLoadingState();

    if (widgetId) {
      console.debug(`Widget ${widgetId} reset asset loading state`);
    }
  }, [resetAssetLoadingState, widgetId]);

  // Memoized return object to prevent unnecessary re-renders
  return useMemo(
    () => ({
      // N8n Payload State
      n8nPayload,
      payloadProcessingStage,
      payloadValidationErrors,

      // Asset Manifest State
      assetManifest,
      manifestProcessingStage,
      manifestValidationErrors,

      // Loading Progress
      loadingStage,
      loadingErrors,
      loadingMetrics,

      // Progress Information
      progressPercentage,
      loadingMessage,
      estimatedTimeRemaining,

      // Asset Status
      totalAssets,
      loadedAssets,
      failedAssets: failedAssetsCount,
      criticalAssets,
      minimumViableAssetsLoaded,
      canStartPlayback,

      // Background Loading
      backgroundLoadingActive,
      backgroundLoadingQueue,

      // Individual Asset Progress
      getAssetProgress,
      getAssetError,
      isAssetRetrying,

      // Convenience Status
      isIdle,
      isLoading,
      isComplete,
      hasErrors,

      // Actions
      retryFailedAssets,
      clearLoadingErrors,
      resetAssetLoading,
    }),
    [
      n8nPayload,
      payloadProcessingStage,
      payloadValidationErrors,
      assetManifest,
      manifestProcessingStage,
      manifestValidationErrors,
      loadingStage,
      loadingErrors,
      loadingMetrics,
      progressPercentage,
      loadingMessage,
      estimatedTimeRemaining,
      totalAssets,
      loadedAssets,
      failedAssetsCount,
      criticalAssets,
      minimumViableAssetsLoaded,
      canStartPlayback,
      backgroundLoadingActive,
      backgroundLoadingQueue,
      getAssetProgress,
      getAssetError,
      isAssetRetrying,
      isIdle,
      isLoading,
      isComplete,
      hasErrors,
      retryFailedAssets,
      clearLoadingErrors,
      resetAssetLoading,
    ],
  );
}
