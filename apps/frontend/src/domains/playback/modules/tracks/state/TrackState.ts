/**
 * TrackState - Immutable state management for tracks
 *
 * Provides:
 * - State snapshots and history
 * - Undo/redo functionality
 * - State change notifications
 * - Serialization support
 */

import type {
  Track,
  TrackMixingState,
  TrackRouting,
  TrackSyncConfig,
  TrackLifecycle,
} from '../../../types/track.js';
import { EventBus, createStructuredLogger } from '../../shared/index.js';

const logger = createStructuredLogger('TrackState');

export interface TrackStateSnapshot {
  id: string;
  timestamp: number;
  description: string;
  state: Partial<Track>;
  changedProperties: string[];
}

export interface TrackStateConfig {
  trackId: string;
  maxHistorySize?: number;
  enableAutoSnapshot?: boolean;
  snapshotInterval?: number;
}

export class TrackState {
  private trackId: string;
  private currentState: Track;
  private history: TrackStateSnapshot[] = [];
  private historyIndex = -1;
  private maxHistorySize: number;
  private listeners = new Set<(state: Track) => void>();
  private eventBus?: EventBus;

  // Auto-snapshot configuration
  private enableAutoSnapshot: boolean;
  private snapshotInterval: number;
  private lastSnapshotTime = 0;
  private pendingChanges: Partial<Track> = {} as Partial<Track>;

  constructor(
    initialState: Track,
    config: TrackStateConfig,
    eventBus?: EventBus,
  ) {
    this.trackId = config.trackId;
    this.currentState = this.deepClone(initialState);
    this.maxHistorySize = config.maxHistorySize ?? 100;
    this.enableAutoSnapshot = config.enableAutoSnapshot ?? false; // Default to false for tests
    this.snapshotInterval = config.snapshotInterval ?? 5000; // 5 seconds
    this.eventBus = eventBus;

    // Take initial snapshot
    this.takeSnapshot('Initial state');
  }

  /**
   * Get current state (read-only)
   */
  getState(): Readonly<Track> {
    // Deep freeze to ensure true immutability
    return this.deepFreeze(this.deepClone(this.currentState));
  }

  /**
   * Update state with partial changes
   */
  updateState(updates: Partial<Track>, description = 'State update'): void {
    const changedProperties = this.getChangedProperties(updates);

    if (changedProperties.length === 0) {
      return; // No changes
    }

    const previousState = this.deepClone(this.currentState);

    // Apply updates
    this.applyUpdates(updates);

    // Handle auto-snapshot
    if (this.enableAutoSnapshot) {
      this.handleAutoSnapshot(updates, description, changedProperties);
    } else {
      this.takeSnapshot(description, changedProperties);
    }

    // Notify listeners
    this.notifyListeners();

    // Emit event
    this.eventBus?.emit('trackState:updated', {
      trackId: this.trackId,
      previousState,
      currentState: this.currentState,
      changedProperties,
    });
  }

  /**
   * Update specific sub-state
   */
  updateMixing(mixing: Partial<TrackMixingState>): void {
    this.updateState(
      { mixing: { ...this.currentState.mixing, ...mixing } },
      'Update mixing',
    );
  }

  updateRouting(routing: Partial<TrackRouting>): void {
    this.updateState(
      { routing: { ...this.currentState.routing, ...routing } },
      'Update routing',
    );
  }

  updateSync(sync: Partial<TrackSyncConfig>): void {
    this.updateState(
      { sync: { ...this.currentState.sync, ...sync } },
      'Update sync',
    );
  }

  updateLifecycle(_lifecycle: TrackLifecycle): void {
    // TrackLifecycle is not part of Track interface - this method is a no-op
    logger.warn(
      'updateLifecycle called but lifecycle is not part of Track state',
    );
  }

  /**
   * Batch multiple updates
   */
  batchUpdate(
    updater: (draft: Track) => void,
    description = 'Batch update',
  ): void {
    const draft = this.deepClone(this.currentState);
    updater(draft);

    const updates = this.diffStates(this.currentState, draft);
    if (Object.keys(updates).length > 0) {
      this.updateState(updates, description);
    }
  }

  /**
   * Take a snapshot of current state
   */
  takeSnapshot(description: string, changedProperties: string[] = []): void {
    // Remove any history after current index
    if (this.historyIndex < this.history.length - 1) {
      this.history.splice(this.historyIndex + 1);
    }

    const snapshot: TrackStateSnapshot = {
      id: `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      timestamp: Date.now(),
      description,
      state: this.deepClone(this.currentState),
      changedProperties,
    };

    this.history.push(snapshot);
    this.historyIndex++;

    // Trim history if needed
    if (this.history.length > this.maxHistorySize) {
      const removeCount = this.history.length - this.maxHistorySize;
      this.history.splice(0, removeCount);
      this.historyIndex -= removeCount;
    }

    logger.debug('Snapshot taken', {
      trackId: this.trackId,
      description,
      historySize: this.history.length,
    });
  }

  /**
   * Undo to previous state
   */
  undo(): boolean {
    if (!this.canUndo()) {
      return false;
    }

    this.historyIndex--;
    const snapshot = this.history[this.historyIndex];
    if (!snapshot) return false;

    this.restoreFromSnapshot(snapshot);
    this.notifyListeners();

    this.eventBus?.emit('trackState:undo', {
      trackId: this.trackId,
      description: snapshot.description,
    });

    return true;
  }

  /**
   * Redo to next state
   */
  redo(): boolean {
    if (!this.canRedo()) {
      return false;
    }

    this.historyIndex++;
    const snapshot = this.history[this.historyIndex];
    if (!snapshot) return false;

    this.restoreFromSnapshot(snapshot);
    this.notifyListeners();

    this.eventBus?.emit('trackState:redo', {
      trackId: this.trackId,
      description: snapshot.description,
    });

    return true;
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.historyIndex > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.historyIndex < this.history.length - 1;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: Track) => void): () => void {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get history information
   */
  getHistoryInfo(): {
    current: number;
    total: number;
    canUndo: boolean;
    canRedo: boolean;
    snapshots: ReadonlyArray<{
      id: string;
      timestamp: number;
      description: string;
    }>;
  } {
    return {
      current: this.historyIndex,
      total: this.history.length,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      snapshots: this.history.map((s) => ({
        id: s.id,
        timestamp: s.timestamp,
        description: s.description,
      })),
    };
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
    this.historyIndex = -1;
    this.takeSnapshot('History cleared');
  }

  /**
   * Jump to specific snapshot
   */
  jumpToSnapshot(snapshotId: string): boolean {
    const index = this.history.findIndex((s) => s.id === snapshotId);
    if (index === -1) {
      return false;
    }

    this.historyIndex = index;
    const snapshot = this.history[index];
    if (!snapshot) return false;

    this.restoreFromSnapshot(snapshot);
    this.notifyListeners();

    return true;
  }

  /**
   * Apply updates to current state
   */
  private applyUpdates(updates: Partial<Track>): void {
    this.deepMerge(this.currentState, updates);
  }

  /**
   * Handle auto-snapshot logic
   */
  private handleAutoSnapshot(
    updates: Partial<Track>,
    description: string,
    changedProperties: string[],
  ): void {
    const now = Date.now();

    // Initialize lastSnapshotTime if not set
    if (this.lastSnapshotTime === 0) {
      this.lastSnapshotTime = now;
    }

    // Merge with pending changes
    this.deepMerge(this.pendingChanges, updates);

    // Check if we should take a snapshot
    if (now - this.lastSnapshotTime >= this.snapshotInterval) {
      this.takeSnapshot(description, changedProperties);
      this.pendingChanges = {};
      this.lastSnapshotTime = now;
    }
    // Don't take immediate snapshot - wait for interval
  }

  /**
   * Restore state from snapshot
   */
  private restoreFromSnapshot(snapshot: TrackStateSnapshot): void {
    this.currentState = this.deepClone(snapshot.state as Track);
  }

  /**
   * Get changed properties
   */
  private getChangedProperties(updates: Partial<Track>): string[] {
    const changed: string[] = [];

    const checkChanges = (current: any, update: any, path = '') => {
      Object.keys(update).forEach((key) => {
        const fullPath = path ? `${path}.${key}` : key;
        const currentValue = current?.[key];
        const updateValue = update[key];

        if (updateValue === undefined) return;

        if (
          typeof updateValue === 'object' &&
          updateValue !== null &&
          !Array.isArray(updateValue) &&
          typeof currentValue === 'object' &&
          currentValue !== null
        ) {
          // Check if the entire object has changed
          if (!this.deepEqual(currentValue, updateValue)) {
            // Add the parent path for nested object changes
            if (!changed.includes(fullPath)) {
              changed.push(fullPath);
            }
          }
          // Still check nested properties
          checkChanges(currentValue, updateValue, fullPath);
        } else if (!this.deepEqual(currentValue, updateValue)) {
          changed.push(fullPath);
        }
      });
    };

    checkChanges(this.currentState, updates);

    // Return only top-level properties for nested changes
    const topLevel = new Set<string>();
    changed.forEach((prop) => {
      const parts = prop.split('.');
      const firstPart = parts[0];
      if (firstPart) {
        topLevel.add(firstPart);
      }
    });

    return Array.from(topLevel);
  }

  /**
   * Deep clone an object
   */
  private deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime()) as any;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.deepClone(item)) as any;
    }

    const cloned = {} as T;
    Object.keys(obj).forEach((key) => {
      (cloned as any)[key] = this.deepClone((obj as any)[key]);
    });

    return cloned;
  }

  /**
   * Deep merge source into target
   */
  private deepMerge(target: any, source: any): void {
    Object.keys(source).forEach((key) => {
      const sourceValue = source[key];
      const targetValue = target[key];

      if (sourceValue === undefined) return;

      if (
        sourceValue === null ||
        typeof sourceValue !== 'object' ||
        Array.isArray(sourceValue)
      ) {
        target[key] = sourceValue;
      } else if (
        targetValue &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        this.deepMerge(targetValue, sourceValue);
      } else {
        target[key] = sourceValue;
      }
    });
  }

  /**
   * Deep equality check
   */
  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true;

    if (typeof a !== typeof b) return false;
    if (a === null || b === null) return false;
    if (typeof a !== 'object') return false;

    if (Array.isArray(a) !== Array.isArray(b)) return false;

    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      return a.every((item, index) => this.deepEqual(item, b[index]));
    }

    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);

    if (aKeys.length !== bKeys.length) return false;

    return aKeys.every((key) => this.deepEqual(a[key], b[key]));
  }

  /**
   * Get difference between two states
   */
  private diffStates(oldState: Track, newState: Track): Partial<Track> {
    const diff: any = {};

    const compare = (oldObj: any, newObj: any, result: any) => {
      Object.keys(newObj).forEach((key) => {
        if (!this.deepEqual(oldObj[key], newObj[key])) {
          result[key] = newObj[key];
        }
      });
    };

    compare(oldState, newState, diff);
    return diff;
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        logger.error('Error in state listener', error as Error);
      }
    });
  }

  /**
   * Deep freeze an object
   */
  private deepFreeze<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    Object.freeze(obj);

    Object.getOwnPropertyNames(obj).forEach((prop) => {
      if (
        obj[prop as keyof T] !== null &&
        (typeof obj[prop as keyof T] === 'object' ||
          typeof obj[prop as keyof T] === 'function') &&
        !Object.isFrozen(obj[prop as keyof T])
      ) {
        this.deepFreeze(obj[prop as keyof T]);
      }
    });

    return obj;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.listeners.clear();
    this.history = [];
    this.pendingChanges = {};
  }
}
