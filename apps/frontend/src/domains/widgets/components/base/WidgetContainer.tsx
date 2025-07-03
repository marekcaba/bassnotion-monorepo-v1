/**
 * WidgetContainer - Container with sync capabilities
 *
 * Provides layout, styling, and sync integration for widget components.
 * Includes performance monitoring, error boundaries, and accessibility features.
 *
 * Part of Story 3.6: Widget Synchronization
 * Task 3.6.3: Widget Base Components
 */

import React, { ReactNode, useRef, useEffect } from 'react';
import { SyncedWidget } from './SyncedWidget';
import type {
  SyncedWidgetProps,
  SyncedWidgetRenderProps,
} from './SyncedWidget';

// ============================================================================
// INTERFACES
// ============================================================================

export interface WidgetContainerProps
  extends Omit<SyncedWidgetProps, 'children'> {
  // Layout props
  className?: string;
  style?: React.CSSProperties;

  // Content
  title?: string;
  subtitle?: string;
  children: ReactNode | ((syncProps: SyncedWidgetRenderProps) => ReactNode);

  // Container features
  showHeader?: boolean;
  showSyncStatus?: boolean;
  showPerformanceIndicator?: boolean;
  collapsible?: boolean;
  initiallyCollapsed?: boolean;

  // Accessibility
  role?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;

  // Events
  onToggleCollapse?: (collapsed: boolean) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

export interface WidgetHeaderProps {
  title: string;
  subtitle?: string;
  isConnected: boolean;
  hasError: boolean;
  showSyncStatus: boolean;
  showPerformanceIndicator: boolean;
  performanceMetrics: {
    totalEvents: number;
    averageLatency: number;
    droppedUpdates: number;
  };
  collapsible?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
}

// ============================================================================
// WIDGET HEADER COMPONENT
// ============================================================================

const WidgetHeader: React.FC<WidgetHeaderProps> = ({
  title,
  subtitle,
  isConnected,
  hasError,
  showSyncStatus,
  showPerformanceIndicator,
  performanceMetrics,
  collapsible,
  isCollapsed,
  onToggleCollapse,
}) => {
  const getSyncStatusIcon = () => {
    if (hasError) return '⚠️';
    if (!isConnected) return '🔴';
    return '🟢';
  };

  const getPerformanceStatus = () => {
    const { averageLatency, droppedUpdates } = performanceMetrics;

    if (averageLatency > 5.0 || droppedUpdates > 10) {
      return { status: 'warning', color: '#ff9800' };
    }
    if (averageLatency > 2.0 || droppedUpdates > 5) {
      return { status: 'caution', color: '#ffc107' };
    }
    return { status: 'good', color: '#4caf50' };
  };

  return (
    <div className="widget-header">
      <div className="widget-header__content">
        <div className="widget-header__title-section">
          <h3 className="widget-header__title">{title}</h3>
          {subtitle && <p className="widget-header__subtitle">{subtitle}</p>}
        </div>

        <div className="widget-header__status-section">
          {showSyncStatus && (
            <div
              className="widget-header__sync-status"
              title={
                hasError
                  ? 'Sync Error'
                  : !isConnected
                    ? 'Disconnected'
                    : 'Connected'
              }
            >
              <span className="widget-header__sync-icon">
                {getSyncStatusIcon()}
              </span>
              <span className="widget-header__sync-text">
                {hasError ? 'Error' : !isConnected ? 'Offline' : 'Synced'}
              </span>
            </div>
          )}

          {showPerformanceIndicator && (
            <div className="widget-header__performance">
              <div
                className="widget-header__performance-indicator"
                style={{ backgroundColor: getPerformanceStatus().color }}
                title={`Latency: ${performanceMetrics.averageLatency.toFixed(1)}ms | Events: ${performanceMetrics.totalEvents} | Dropped: ${performanceMetrics.droppedUpdates}`}
              />
              <span className="widget-header__performance-text">
                {performanceMetrics.averageLatency.toFixed(1)}ms
              </span>
            </div>
          )}

          {collapsible && (
            <button
              className="widget-header__collapse-button"
              onClick={() => onToggleCollapse?.(!isCollapsed)}
              aria-label={isCollapsed ? 'Expand widget' : 'Collapse widget'}
              type="button"
            >
              <span
                className={`widget-header__collapse-icon ${isCollapsed ? 'widget-header__collapse-icon--collapsed' : ''}`}
              >
                ▼
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// WIDGET CONTAINER COMPONENT
// ============================================================================

export const WidgetContainer: React.FC<WidgetContainerProps> = ({
  className = '',
  style,
  title,
  subtitle,
  children,
  showHeader = true,
  showSyncStatus = true,
  showPerformanceIndicator = false,
  collapsible = false,
  initiallyCollapsed = false,
  role = 'region',
  ariaLabel,
  ariaDescribedBy,
  onToggleCollapse,
  onFocus,
  onBlur,
  ...syncedWidgetProps
}) => {
  const [isCollapsed, setIsCollapsed] = React.useState(initiallyCollapsed);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle collapse toggle
  const handleToggleCollapse = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    onToggleCollapse?.(collapsed);
  };

  // Focus management
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleFocus = () => onFocus?.();
    const handleBlur = () => onBlur?.();

    container.addEventListener('focus', handleFocus);
    container.addEventListener('blur', handleBlur);

    return () => {
      container.removeEventListener('focus', handleFocus);
      container.removeEventListener('blur', handleBlur);
    };
  }, [onFocus, onBlur]);

  const containerClasses = [
    'widget-container',
    className,
    isCollapsed ? 'widget-container--collapsed' : '',
    `widget-container--${syncedWidgetProps.widgetId}`,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <SyncedWidget {...syncedWidgetProps}>
      {(syncProps) => (
        <div
          ref={containerRef}
          className={containerClasses}
          style={style}
          role={role}
          aria-label={ariaLabel || title}
          aria-describedby={ariaDescribedBy}
          data-widget-id={syncedWidgetProps.widgetId}
          data-collapsed={isCollapsed}
          tabIndex={0}
        >
          {showHeader && title && (
            <WidgetHeader
              title={title}
              subtitle={subtitle}
              isConnected={syncProps.isConnected}
              hasError={syncProps.hasError}
              showSyncStatus={showSyncStatus}
              showPerformanceIndicator={showPerformanceIndicator}
              performanceMetrics={syncProps.performanceMetrics}
              collapsible={collapsible}
              isCollapsed={isCollapsed}
              onToggleCollapse={handleToggleCollapse}
            />
          )}

          <div
            className={`widget-container__content ${isCollapsed ? 'widget-container__content--collapsed' : ''}`}
          >
            {typeof children === 'function' ? children(syncProps) : children}
          </div>

          {syncProps.hasError && (
            <div className="widget-container__error-overlay">
              <div className="widget-container__error-message">
                <span className="widget-container__error-icon">⚠️</span>
                <span className="widget-container__error-text">
                  Widget sync error. Check console for details.
                </span>
                <button
                  className="widget-container__error-retry"
                  onClick={() => syncProps.sync.actions.reconnect()}
                  type="button"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </SyncedWidget>
  );
};

// ============================================================================
// STYLED WIDGET CONTAINER VARIANTS
// ============================================================================

interface StyledWidgetContainerProps extends WidgetContainerProps {
  variant?: 'card' | 'panel' | 'compact' | 'fullscreen';
}

export const StyledWidgetContainer: React.FC<StyledWidgetContainerProps> = ({
  variant = 'card',
  className = '',
  ...props
}) => {
  const variantClass = `widget-container--${variant}`;
  const combinedClassName = `${variantClass} ${className}`.trim();

  return <WidgetContainer {...props} className={combinedClassName} />;
};

// ============================================================================
// UTILITY COMPONENTS
// ============================================================================

interface WidgetLoadingProps {
  message?: string;
}

export const WidgetLoading: React.FC<WidgetLoadingProps> = ({
  message = 'Loading widget...',
}) => (
  <div className="widget-loading">
    <div className="widget-loading__spinner" />
    <p className="widget-loading__message">{message}</p>
  </div>
);

interface WidgetErrorProps {
  error: string;
  onRetry?: () => void;
}

export const WidgetError: React.FC<WidgetErrorProps> = ({ error, onRetry }) => (
  <div className="widget-error">
    <div className="widget-error__icon">⚠️</div>
    <p className="widget-error__message">{error}</p>
    {onRetry && (
      <button
        className="widget-error__retry-button"
        onClick={onRetry}
        type="button"
      >
        Retry
      </button>
    )}
  </div>
);

// Types are exported directly with their declarations above
