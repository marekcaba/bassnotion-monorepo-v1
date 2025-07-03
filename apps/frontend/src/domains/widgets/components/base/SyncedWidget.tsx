/**
 * SyncedWidget - Base Component for Synchronized Widgets
 *
 * Provides common synchronization functionality for all widgets.
 * Handles state synchronization, error boundaries, and performance monitoring.
 *
 * Part of Story 3.6: Widget Synchronization
 * Task 3.6.3: Widget Base Components
 */

import React, { ErrorInfo, ReactNode, useEffect } from 'react';
import { useWidgetSync } from '../../hooks/useWidgetSync';
import type { UseWidgetSyncOptions } from '../../hooks/useWidgetSync';

// ============================================================================
// INTERFACES
// ============================================================================

export interface SyncedWidgetProps {
  // Widget identification
  widgetId: string;
  widgetName: string;

  // Sync configuration
  syncOptions?: Partial<UseWidgetSyncOptions>;

  // Render props
  children: (syncProps: SyncedWidgetRenderProps) => ReactNode;

  // Error handling
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  fallbackComponent?: ReactNode;

  // Performance monitoring
  enablePerformanceMonitoring?: boolean;
  onPerformanceWarning?: (metric: string, value: number) => void;

  // Debug mode
  debugMode?: boolean;
}

export interface SyncedWidgetRenderProps {
  // Sync state and actions
  sync: ReturnType<typeof useWidgetSync>;

  // Convenience props
  isPlaying: boolean;
  currentTime: number;
  tempo: number;
  masterVolume: number;
  selectedExercise: any | undefined;

  // Widget status
  isConnected: boolean;
  hasError: boolean;

  // Performance metrics
  performanceMetrics: {
    totalEvents: number;
    averageLatency: number;
    droppedUpdates: number;
  };
}

export interface SyncedWidgetState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// ============================================================================
// ERROR BOUNDARY COMPONENT
// ============================================================================

class SyncedWidgetErrorBoundary extends React.Component<
  {
    children: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    fallbackComponent?: ReactNode;
    widgetId: string;
    debugMode?: boolean;
  },
  SyncedWidgetState
> {
  constructor(props: any) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<SyncedWidgetState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error
    console.error(`[${this.props.widgetId}] Widget error:`, error, errorInfo);

    // Call error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Debug logging
    if (this.props.debugMode) {
      console.log(`[${this.props.widgetId}] Error details:`, {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      });
    }
  }

  render() {
    if (this.state.hasError) {
      // Render fallback UI
      if (this.props.fallbackComponent) {
        return this.props.fallbackComponent;
      }

      return (
        <div className="widget-error-boundary">
          <div className="widget-error-content">
            <h3>Widget Error</h3>
            <p>Widget {this.props.widgetId} encountered an error.</p>
            {this.props.debugMode && this.state.error && (
              <details className="widget-error-details">
                <summary>Error Details</summary>
                <pre>{this.state.error.message}</pre>
                <pre>{this.state.error.stack}</pre>
              </details>
            )}
            <button
              onClick={() =>
                this.setState({ hasError: false, error: null, errorInfo: null })
              }
              className="widget-error-retry"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// SYNCED WIDGET COMPONENT
// ============================================================================

export const SyncedWidget: React.FC<SyncedWidgetProps> = ({
  widgetId,
  widgetName,
  syncOptions = {},
  children,
  onError,
  fallbackComponent,
  enablePerformanceMonitoring = true,
  onPerformanceWarning,
  debugMode = false,
}) => {
  // Debug: Log every render
  if (debugMode) {
    // Debug logs (temporarily disabled to reduce console noise)
    // console.log(`🔄 SyncedWidget RENDER [${widgetId}]:`, {
    //   widgetName,
    //   syncOptions,
    //   debugMode,
    //   timestamp: new Date().toISOString(),
    // });
  }

  // Debug: Log mount/unmount
  useEffect(() => {
    if (debugMode) {
      // Debug logs (temporarily disabled to reduce console noise)
      // console.log(`🟢 SyncedWidget MOUNTED [${widgetId}]`);
    }
    return () => {
      if (debugMode) {
        // Debug logs (temporarily disabled to reduce console noise)
        // console.log(`🔴 SyncedWidget UNMOUNTED [${widgetId}]`);
      }
    };
  }, [widgetId, debugMode]);

  // Merge sync options with defaults
  const mergedSyncOptions: UseWidgetSyncOptions = {
    widgetId,
    subscribeTo: [
      'PLAYBACK_STATE',
      'TIMELINE_UPDATE',
      'EXERCISE_CHANGE',
      'TEMPO_CHANGE',
      'VOLUME_CHANGE',
    ],
    throttleUpdates: true,
    throttleMs: 16, // 60fps
    debugMode,
    ...syncOptions,
  };

  // Use sync hook
  const sync = useWidgetSync(mergedSyncOptions);

  // Performance monitoring
  React.useEffect(() => {
    if (!enablePerformanceMonitoring) return;

    const checkPerformance = () => {
      const { averageLatency, droppedUpdates } = sync.performanceMetrics;

      // Check latency threshold (5ms from AC 3.6.4)
      if (averageLatency > 5.0) {
        const warning = `High sync latency: ${averageLatency.toFixed(2)}ms`;
        console.warn(`[${widgetId}] ${warning}`);
        if (onPerformanceWarning) {
          onPerformanceWarning('latency', averageLatency);
        }
      }

      // Check dropped updates
      if (droppedUpdates > 10) {
        const warning = `High dropped updates: ${droppedUpdates}`;
        console.warn(`[${widgetId}] ${warning}`);
        if (onPerformanceWarning) {
          onPerformanceWarning('droppedUpdates', droppedUpdates);
        }
      }
    };

    const interval = setInterval(checkPerformance, 1000);
    return () => clearInterval(interval);
  }, [
    widgetId,
    enablePerformanceMonitoring,
    onPerformanceWarning,
    sync.performanceMetrics,
  ]);

  // Debug logging
  React.useEffect(() => {
    if (debugMode) {
      console.log(
        `[${widgetId}] ${widgetName} mounted with sync options:`,
        mergedSyncOptions,
      );
    }
  }, [widgetId, widgetName, debugMode, mergedSyncOptions]);

  // Create render props
  const renderProps: SyncedWidgetRenderProps = {
    sync,
    isPlaying: sync.isPlaying,
    currentTime: sync.currentTime,
    tempo: sync.tempo,
    masterVolume: sync.masterVolume,
    selectedExercise: sync.selectedExercise,
    isConnected: sync.state.isConnected,
    hasError: sync.state.hasError,
    performanceMetrics: sync.performanceMetrics,
  };

  return (
    <SyncedWidgetErrorBoundary
      widgetId={widgetId}
      onError={onError}
      fallbackComponent={fallbackComponent}
      debugMode={debugMode}
    >
      <div
        className={`synced-widget synced-widget--${widgetId}`}
        data-widget-id={widgetId}
        data-widget-name={widgetName}
        data-connected={sync.state.isConnected}
        data-has-error={sync.state.hasError}
      >
        {children(renderProps)}
      </div>
    </SyncedWidgetErrorBoundary>
  );
};

// ============================================================================
// HELPER COMPONENT FOR SIMPLE WIDGETS
// ============================================================================

export interface SimpleSyncedWidgetProps {
  widgetId: string;
  widgetName: string;
  children: ReactNode;
  syncOptions?: Partial<UseWidgetSyncOptions>;
  debugMode?: boolean;
}

/**
 * Simplified version of SyncedWidget for widgets that don't need render props
 */
export const SimpleSyncedWidget: React.FC<SimpleSyncedWidgetProps> = ({
  widgetId,
  widgetName,
  children,
  syncOptions,
  debugMode,
}) => {
  return (
    <SyncedWidget
      widgetId={widgetId}
      widgetName={widgetName}
      syncOptions={syncOptions}
      debugMode={debugMode}
    >
      {() => children}
    </SyncedWidget>
  );
};

// Types are exported directly with their declarations above
