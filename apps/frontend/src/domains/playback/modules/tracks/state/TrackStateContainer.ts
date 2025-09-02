/**
 * TrackStateContainer - Legacy state container wrapper
 * 
 * This wraps the new TrackState to provide backward compatibility
 * with the existing API while using the new modular state management
 */

import { TrackState } from './TrackState.js';
import type {
  Track,
  TrackStateContainer as ITrackStateContainer,
  TrackStateSnapshot as ITrackStateSnapshot,
} from '../../../types/track.js';
import { EventBus } from '../../../services/core/EventBus.js';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('TrackStateContainer');

/**
 * Adapter to make new TrackState compatible with old interface
 */
export class TrackStateContainer implements ITrackStateContainer {
  public track: Track;
  public history: ITrackStateSnapshot[] = [];
  public historyIndex = -1;
  public maxHistorySize: number;
  public listeners = new Set<(track: Track) => void>();

  private trackState: TrackState;
  private eventBus?: EventBus;

  constructor(track: Track, maxHistorySize = 100) {
    this.track = track;
    this.maxHistorySize = maxHistorySize;

    // Create new TrackState
    this.trackState = new TrackState(
      this.convertTrackToState(track),
      {
        trackId: track.id,
        maxHistorySize,
      },
      this.eventBus
    );

    // Subscribe to state changes
    this.trackState.subscribe((state) => {
      this.updateTrackFromState(state);
      this.notifyListeners();
    });

    // Sync history
    this.syncHistory();
  }

  /**
   * Update track state and record in history
   */
  updateState(updates: Partial<Track>, description: string): void {
    // Convert track updates to state updates
    const stateUpdates = this.convertTrackToState(updates);
    this.trackState.updateState(stateUpdates, description);
    this.syncHistory();
  }

  /**
   * Take a snapshot of current state
   */
  takeSnapshot(description: string, changedProperties: string[] = []): void {
    this.trackState.takeSnapshot(description, changedProperties);
    this.syncHistory();
  }

  /**
   * Undo last state change
   */
  undo(): boolean {
    const result = this.trackState.undo();
    if (result) {
      this.syncHistory();
    }
    return result;
  }

  /**
   * Redo previously undone state change
   */
  redo(): boolean {
    const result = this.trackState.redo();
    if (result) {
      this.syncHistory();
    }
    return result;
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.trackState.canUndo();
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.trackState.canRedo();
  }

  /**
   * Add state change listener
   */
  addListener(listener: (track: Track) => void): void {
    this.listeners.add(listener);
  }

  /**
   * Remove state change listener
   */
  removeListener(listener: (track: Track) => void): void {
    this.listeners.delete(listener);
  }

  /**
   * Clear all history
   */
  clearHistory(): void {
    this.trackState.clearHistory();
    this.syncHistory();
  }

  /**
   * Get history info
   */
  getHistoryInfo(): {
    current: number;
    total: number;
    canUndo: boolean;
    canRedo: boolean;
  } {
    return this.trackState.getHistoryInfo();
  }

  /**
   * Serialize state for persistence
   */
  serialize(): string {
    return JSON.stringify({
      track: this.track,
      history: this.history,
      historyIndex: this.historyIndex,
      maxHistorySize: this.maxHistorySize,
      version: '1.0.0',
    });
  }

  /**
   * Deserialize state from persistence
   */
  static deserialize(data: string, track: Track): TrackStateContainer {
    try {
      const parsed = JSON.parse(data);
      const container = new TrackStateContainer(track, parsed.maxHistorySize);

      // Restore history
      if (parsed.history && parsed.historyIndex !== undefined) {
        // Jump to the correct history position
        const historyInfo = container.trackState.getHistoryInfo();
        if (historyInfo.snapshots[parsed.historyIndex]) {
          container.trackState.jumpToSnapshot(
            historyInfo.snapshots[parsed.historyIndex].id
          );
        }
      }

      return container;
    } catch (error) {
      logger.error('Failed to deserialize track state', { error });
      throw error;
    }
  }

  /**
   * Convert Track to state format
   */
  private convertTrackToState(track: Partial<Track>): any {
    const state: any = {};

    if (track.id !== undefined) state.id = track.id;
    if (track.name !== undefined) state.name = track.name;
    if (track.color !== undefined) state.color = track.color;
    if (track.index !== undefined) state.index = track.index;
    if (track.state !== undefined) state.lifecycle = track.state;
    if (track.musical !== undefined) state.musical = track.musical;
    if (track.mixing !== undefined) state.mixing = track.mixing;
    if (track.routing !== undefined) state.routing = track.routing;
    if (track.sync !== undefined) state.sync = track.sync;
    if (track.automation !== undefined) state.automation = track.automation;
    if (track.metadata !== undefined) state.metadata = track.metadata;

    return state;
  }

  /**
   * Update track from state
   */
  private updateTrackFromState(state: any): void {
    // Update track properties
    if (state.name !== undefined) this.track.name = state.name;
    if (state.color !== undefined) this.track.color = state.color;
    if (state.index !== undefined) this.track.index = state.index;
    if (state.lifecycle !== undefined) this.track.state = state.lifecycle;
    if (state.musical !== undefined) this.track.musical = state.musical;
    if (state.mixing !== undefined) this.track.mixing = state.mixing;
    if (state.routing !== undefined) this.track.routing = state.routing;
    if (state.sync !== undefined) this.track.sync = state.sync;
    if (state.automation !== undefined) this.track.automation = state.automation;
    if (state.metadata !== undefined) this.track.metadata = state.metadata;
  }

  /**
   * Sync history from TrackState
   */
  private syncHistory(): void {
    const historyInfo = this.trackState.getHistoryInfo();
    this.historyIndex = historyInfo.current;

    // Convert snapshots to old format
    this.history = historyInfo.snapshots.map((snapshot, index) => ({
      timestamp: snapshot.timestamp,
      description: snapshot.description,
      state: this.track, // Simplified - would need proper conversion
      changedProperties: [],
    }));
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.track);
      } catch (error) {
        logger.error('Error in track state listener:', error);
      }
    });
  }
}