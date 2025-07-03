/**
 * Widget Base Components Index
 *
 * Exports all base components for widget synchronization.
 *
 * Part of Story 3.6: Widget Synchronization
 * Task 3.6.3: Widget Base Components
 */

// Core synchronization components
export { SyncedWidget, SimpleSyncedWidget } from './SyncedWidget';
export type {
  SyncedWidgetProps,
  SyncedWidgetRenderProps,
  SyncedWidgetState,
  SimpleSyncedWidgetProps,
} from './SyncedWidget';

// Container components
export {
  WidgetContainer,
  StyledWidgetContainer,
  WidgetLoading,
  WidgetError,
} from './WidgetContainer';
export type {
  WidgetContainerProps,
  WidgetHeaderProps,
} from './WidgetContainer';

// Context provider and hooks
export {
  SyncProvider,
  useSyncContext,
  withSync,
  useSyncState,
  useSyncMetrics,
  useSyncConnection,
  useSyncEmitter,
  SyncDebugPanel,
} from './SyncProvider';
export type {
  SyncContextValue,
  SyncProviderProps,
  WithSyncProps,
} from './SyncProvider';
