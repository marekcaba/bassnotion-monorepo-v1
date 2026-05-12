/**
 * Widget Synchronization Types
 *
 * Shared type definitions for widget synchronization events.
 * These types are used by both playback and widgets domains
 * to avoid circular dependencies.
 */

/**
 * Widget sync event types for inter-widget communication
 */
export type WidgetSyncEventType =
  | 'PLAYBACK_STATE'
  | 'TIMELINE_UPDATE'
  | 'EXERCISE_CHANGE'
  | 'TEMPO_CHANGE'
  | 'VOLUME_CHANGE'
  | 'CUSTOM_BASSLINE'
  | 'CLEAR_CUSTOM_BASSLINE'
  | 'AUDIO_SOURCE_REGISTERED'
  | 'AUDIO_SOURCE_UNREGISTERED'
  | 'MUTE_CHANGE'
  | 'SOLO_CHANGE'
  | 'WIDGET_RECONNECT'
  | 'SYNC_RESTART'
  | 'SYNC_STATE_RESET'
  | 'TIME_SIGNATURE_CHANGE'
  | 'PLAY'
  | 'PAUSE'
  | 'STOP'
  | 'SEEK'
  | 'MUSICAL_TIME_UPDATE'
  | 'HEARTBEAT'
  | 'POSITION';

/**
 * Event priority levels for widget sync events
 */
export type WidgetSyncPriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * Widget synchronization event interface
 */
export interface WidgetSyncEvent {
  type: WidgetSyncEventType;
  payload: any;
  timestamp: number;
  source: string;
  priority: WidgetSyncPriority;
}
