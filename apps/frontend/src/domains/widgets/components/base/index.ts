/**
 * Widget Base Components Index
 *
 * Exports all base components for widget synchronization.
 *
 * Part of Story 3.6: Widget Synchronization
 * Task 3.6.3: Widget Base Components
 */

// Core synchronization components
export { SyncedWidget, SimpleSyncedWidget } from './SyncedWidget.js';
export type {
  SyncedWidgetProps,
  SyncedWidgetRenderProps,
  SyncedWidgetState,
  SimpleSyncedWidgetProps,
} from './SyncedWidget.js';

// Container components
export {
  WidgetContainer,
  StyledWidgetContainer,
  WidgetLoading,
  WidgetError,
} from './WidgetContainer.js';
export type {
  WidgetContainerProps,
  WidgetHeaderProps,
} from './WidgetContainer.js';

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
} from './SyncProvider.js';
export type {
  SyncContextValue,
  SyncProviderProps,
  WithSyncProps,
} from './SyncProvider.js';
