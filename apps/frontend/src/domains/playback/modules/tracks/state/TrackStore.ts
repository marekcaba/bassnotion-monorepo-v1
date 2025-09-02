/**
 * TrackStore - Centralized state management for all tracks
 * 
 * Provides:
 * - Global track state management
 * - Cross-track state coordination
 * - Persistence and hydration
 * - Computed state derivations
 * - Performance optimizations
 */

import { TrackState } from './TrackState.js';
import type { Track } from '../core/Track.js';
import type { 
  TrackState as ITrackState,
  TrackMixingState,
  TrackLifecycle,
} from '../../../types/track.js';
import { EventBus } from '../../../services/core/EventBus.js';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('TrackStore');

export interface TrackStoreConfig {
  maxUndoHistory?: number;
  enablePersistence?: boolean;
  persistenceKey?: string;
  autoSaveInterval?: number;
}

export interface TrackStoreSnapshot {
  version: string;
  timestamp: number;
  tracks: Map<string, ITrackState>;
  metadata: {
    projectName?: string;
    lastModified: number;
    trackCount: number;
  };
}

export interface DerivedState {
  // Solo/mute state
  hasSoloedTracks: boolean;
  soloedTrackIds: Set<string>;
  mutedTrackIds: Set<string>;
  
  // Track counts by type
  trackCounts: {
    total: number;
    byType: Map<string, number>;
    byLifecycle: Map<TrackLifecycle, number>;
  };
  
  // Mixing state
  masterVolume: number;
  hasAutomation: boolean;
  
  // Performance metrics
  cpuUsage: number;
  memoryUsage: number;
}

export class TrackStore {
  private trackStates = new Map<string, TrackState>();
  private derivedState: DerivedState;
  private eventBus: EventBus;
  private config: Required<TrackStoreConfig>;
  
  // Persistence
  private isDirty: boolean = false;
  private autoSaveTimer?: NodeJS.Timeout;
  
  // Performance optimization
  private updateQueue: Map<string, Partial<ITrackState>> = new Map();
  private isProcessingQueue: boolean = false;
  private batchUpdateTimer?: NodeJS.Timeout;
  
  // Subscribers
  private storeListeners = new Set<(snapshot: TrackStoreSnapshot) => void>();
  private derivedStateListeners = new Set<(state: DerivedState) => void>();

  constructor(eventBus: EventBus, config: TrackStoreConfig = {}) {
    this.eventBus = eventBus;
    this.config = {
      maxUndoHistory: config.maxUndoHistory ?? 100,
      enablePersistence: config.enablePersistence ?? true,
      persistenceKey: config.persistenceKey ?? 'bassnotion-track-store',
      autoSaveInterval: config.autoSaveInterval ?? 30000, // 30 seconds
    };
    
    // Initialize derived state
    this.derivedState = this.createInitialDerivedState();
    
    // Setup auto-save if enabled
    if (this.config.enablePersistence) {
      this.setupAutoSave();
      this.loadFromPersistence();
    }
    
    // Setup event handlers
    this.setupEventHandlers();
  }

  /**
   * Add a track to the store
   */
  addTrack(track: Track): void {
    if (this.trackStates.has(track.id)) {
      logger.warn('Track already exists in store', { trackId: track.id });
      return;
    }

    // Create track state
    const trackState = new TrackState(
      this.trackToState(track),
      {
        trackId: track.id,
        maxHistorySize: this.config.maxUndoHistory,
      },
      this.eventBus
    );

    // Subscribe to track state changes
    trackState.subscribe((state) => {
      this.handleTrackStateChange(track.id, state);
    });

    this.trackStates.set(track.id, trackState);
    this.updateDerivedState();
    this.markDirty();

    logger.info('Track added to store', { trackId: track.id });
  }

  /**
   * Remove a track from the store
   */
  removeTrack(trackId: string): void {
    const trackState = this.trackStates.get(trackId);
    if (!trackState) {
      return;
    }

    trackState.dispose();
    this.trackStates.delete(trackId);
    this.updateDerivedState();
    this.markDirty();

    logger.info('Track removed from store', { trackId });
  }

  /**
   * Get track state
   */
  getTrackState(trackId: string): ITrackState | undefined {
    return this.trackStates.get(trackId)?.getState();
  }

  /**
   * Update track state
   */
  updateTrack(trackId: string, updates: Partial<ITrackState>): void {
    const trackState = this.trackStates.get(trackId);
    if (!trackState) {
      logger.warn('Track not found in store', { trackId });
      return;
    }

    // Queue update for batching
    this.queueUpdate(trackId, updates);
  }

  /**
   * Batch update multiple tracks
   */
  batchUpdateTracks(updates: Map<string, Partial<ITrackState>>): void {
    updates.forEach((update, trackId) => {
      this.queueUpdate(trackId, update);
    });
    
    // Process immediately for batch updates
    this.processUpdateQueue();
  }

  /**
   * Update track mixing
   */
  updateTrackMixing(trackId: string, mixing: Partial<TrackMixingState>): void {
    const trackState = this.trackStates.get(trackId);
    if (!trackState) {
      return;
    }

    trackState.updateMixing(mixing);
  }

  /**
   * Solo track (mutes all other tracks)
   */
  soloTrack(trackId: string, solo: boolean): void {
    const updates = new Map<string, Partial<ITrackState>>();
    
    if (solo) {
      // Mute all other tracks
      this.trackStates.forEach((state, id) => {
        if (id !== trackId) {
          const currentState = state.getState();
          if (!currentState.mixing.mute) {
            updates.set(id, { 
              mixing: { ...currentState.mixing, mute: true } 
            });
          }
        }
      });
      
      // Ensure soloed track is not muted
      const soloedState = this.trackStates.get(trackId)?.getState();
      if (soloedState?.mixing.mute) {
        updates.set(trackId, {
          mixing: { ...soloedState.mixing, mute: false, solo: true }
        });
      } else {
        updates.set(trackId, {
          mixing: { ...soloedState!.mixing, solo: true }
        });
      }
    } else {
      // Unsolo - restore original mute states
      // In a real implementation, we'd track original mute states
      this.trackStates.forEach((state, id) => {
        const currentState = state.getState();
        if (currentState.mixing.solo) {
          updates.set(id, {
            mixing: { ...currentState.mixing, solo: false }
          });
        }
      });
    }
    
    this.batchUpdateTracks(updates);
  }

  /**
   * Get all track states
   */
  getAllTracks(): Map<string, ITrackState> {
    const tracks = new Map<string, ITrackState>();
    this.trackStates.forEach((state, id) => {
      tracks.set(id, state.getState());
    });
    return tracks;
  }

  /**
   * Get derived state
   */
  getDerivedState(): Readonly<DerivedState> {
    return Object.freeze({ ...this.derivedState });
  }

  /**
   * Undo for specific track
   */
  undoTrack(trackId: string): boolean {
    const trackState = this.trackStates.get(trackId);
    if (!trackState) {
      return false;
    }

    return trackState.undo();
  }

  /**
   * Redo for specific track
   */
  redoTrack(trackId: string): boolean {
    const trackState = this.trackStates.get(trackId);
    if (!trackState) {
      return false;
    }

    return trackState.redo();
  }

  /**
   * Create snapshot of entire store
   */
  createSnapshot(): TrackStoreSnapshot {
    const tracks = new Map<string, ITrackState>();
    this.trackStates.forEach((state, id) => {
      tracks.set(id, state.getState());
    });

    return {
      version: '1.0.0',
      timestamp: Date.now(),
      tracks,
      metadata: {
        lastModified: Date.now(),
        trackCount: tracks.size,
      },
    };
  }

  /**
   * Restore from snapshot
   */
  restoreSnapshot(snapshot: TrackStoreSnapshot): void {
    // Clear existing tracks
    this.trackStates.forEach((state) => state.dispose());
    this.trackStates.clear();

    // Restore tracks
    snapshot.tracks.forEach((trackState, trackId) => {
      const state = new TrackState(
        trackState,
        {
          trackId,
          maxHistorySize: this.config.maxUndoHistory,
        },
        this.eventBus
      );

      state.subscribe((s) => {
        this.handleTrackStateChange(trackId, s);
      });

      this.trackStates.set(trackId, state);
    });

    this.updateDerivedState();
    this.notifyStoreListeners();

    logger.info('Store restored from snapshot', {
      trackCount: snapshot.tracks.size,
      timestamp: snapshot.timestamp,
    });
  }

  /**
   * Subscribe to store changes
   */
  subscribe(listener: (snapshot: TrackStoreSnapshot) => void): () => void {
    this.storeListeners.add(listener);
    return () => {
      this.storeListeners.delete(listener);
    };
  }

  /**
   * Subscribe to derived state changes
   */
  subscribeToDerivedState(listener: (state: DerivedState) => void): () => void {
    this.derivedStateListeners.add(listener);
    return () => {
      this.derivedStateListeners.delete(listener);
    };
  }

  /**
   * Save to persistence
   */
  async save(): Promise<void> {
    if (!this.config.enablePersistence) {
      return;
    }

    try {
      const snapshot = this.createSnapshot();
      const serialized = JSON.stringify(snapshot);
      
      // In a real implementation, this would use proper storage
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(this.config.persistenceKey, serialized);
      }
      
      this.isDirty = false;
      
      logger.info('Store saved to persistence');
    } catch (error) {
      logger.error('Failed to save store', { error });
    }
  }

  /**
   * Clear all tracks
   */
  clear(): void {
    this.trackStates.forEach((state) => state.dispose());
    this.trackStates.clear();
    this.updateDerivedState();
    this.markDirty();
    this.notifyStoreListeners();
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Listen for track events from other parts of the system
    this.eventBus.on('track:created', ({ track }) => {
      this.addTrack(track);
    });

    this.eventBus.on('track:deleted', ({ trackId }) => {
      this.removeTrack(trackId);
    });

    this.eventBus.on('track:updated', ({ trackId, updates }) => {
      this.updateTrack(trackId, updates);
    });
  }

  /**
   * Handle track state change
   */
  private handleTrackStateChange(trackId: string, state: ITrackState): void {
    this.updateDerivedState();
    this.markDirty();
    
    // Emit event
    this.eventBus.emit('trackStore:trackChanged', {
      trackId,
      state,
    });
  }

  /**
   * Queue update for batching
   */
  private queueUpdate(trackId: string, updates: Partial<ITrackState>): void {
    const existing = this.updateQueue.get(trackId) || {};
    this.updateQueue.set(trackId, { ...existing, ...updates });
    
    // Debounce processing
    if (this.batchUpdateTimer) {
      clearTimeout(this.batchUpdateTimer);
    }
    
    this.batchUpdateTimer = setTimeout(() => {
      this.processUpdateQueue();
    }, 16); // ~60fps
  }

  /**
   * Process queued updates
   */
  private processUpdateQueue(): void {
    if (this.isProcessingQueue || this.updateQueue.size === 0) {
      return;
    }

    this.isProcessingQueue = true;
    
    this.updateQueue.forEach((updates, trackId) => {
      const trackState = this.trackStates.get(trackId);
      if (trackState) {
        trackState.updateState(updates, 'Batch update');
      }
    });
    
    this.updateQueue.clear();
    this.isProcessingQueue = false;
  }

  /**
   * Update derived state
   */
  private updateDerivedState(): void {
    const oldState = this.derivedState;
    
    // Calculate new derived state
    const soloedTrackIds = new Set<string>();
    const mutedTrackIds = new Set<string>();
    const trackCountsByType = new Map<string, number>();
    const trackCountsByLifecycle = new Map<TrackLifecycle, number>();
    let hasAutomation = false;
    
    this.trackStates.forEach((state, id) => {
      const track = state.getState();
      
      if (track.mixing.solo) {
        soloedTrackIds.add(id);
      }
      if (track.mixing.mute) {
        mutedTrackIds.add(id);
      }
      
      // Count by type (would need instrumentType in state)
      // trackCountsByType...
      
      // Count by lifecycle
      const count = trackCountsByLifecycle.get(track.lifecycle) || 0;
      trackCountsByLifecycle.set(track.lifecycle, count + 1);
      
      if (track.automation && track.automation.length > 0) {
        hasAutomation = true;
      }
    });
    
    this.derivedState = {
      hasSoloedTracks: soloedTrackIds.size > 0,
      soloedTrackIds,
      mutedTrackIds,
      trackCounts: {
        total: this.trackStates.size,
        byType: trackCountsByType,
        byLifecycle: trackCountsByLifecycle,
      },
      masterVolume: 1.0, // Would be calculated from master bus
      hasAutomation,
      cpuUsage: 0, // Would be calculated from performance metrics
      memoryUsage: 0,
    };
    
    // Notify if changed
    if (!this.deepEqual(oldState, this.derivedState)) {
      this.notifyDerivedStateListeners();
    }
  }

  /**
   * Convert Track to TrackState
   */
  private trackToState(track: Track): ITrackState {
    return {
      id: track.id,
      name: track.name,
      color: track.color,
      index: track.index,
      lifecycle: track.state,
      musical: track.musical,
      mixing: track.mixing,
      routing: track.routing,
      sync: track.sync,
      automation: track.automation,
      metadata: track.metadata,
    };
  }

  /**
   * Create initial derived state
   */
  private createInitialDerivedState(): DerivedState {
    return {
      hasSoloedTracks: false,
      soloedTrackIds: new Set(),
      mutedTrackIds: new Set(),
      trackCounts: {
        total: 0,
        byType: new Map(),
        byLifecycle: new Map(),
      },
      masterVolume: 1.0,
      hasAutomation: false,
      cpuUsage: 0,
      memoryUsage: 0,
    };
  }

  /**
   * Setup auto-save
   */
  private setupAutoSave(): void {
    this.autoSaveTimer = setInterval(() => {
      if (this.isDirty) {
        this.save();
      }
    }, this.config.autoSaveInterval);
  }

  /**
   * Load from persistence
   */
  private loadFromPersistence(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const serialized = window.localStorage.getItem(this.config.persistenceKey);
        if (serialized) {
          const snapshot = JSON.parse(serialized) as TrackStoreSnapshot;
          // Convert tracks Map from JSON
          snapshot.tracks = new Map(Object.entries(snapshot.tracks));
          this.restoreSnapshot(snapshot);
        }
      }
    } catch (error) {
      logger.error('Failed to load from persistence', { error });
    }
  }

  /**
   * Mark store as dirty
   */
  private markDirty(): void {
    this.isDirty = true;
  }

  /**
   * Notify store listeners
   */
  private notifyStoreListeners(): void {
    const snapshot = this.createSnapshot();
    this.storeListeners.forEach(listener => {
      try {
        listener(snapshot);
      } catch (error) {
        logger.error('Error in store listener', { error });
      }
    });
  }

  /**
   * Notify derived state listeners
   */
  private notifyDerivedStateListeners(): void {
    const state = this.getDerivedState();
    this.derivedStateListeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        logger.error('Error in derived state listener', { error });
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
    
    if (a instanceof Set && b instanceof Set) {
      if (a.size !== b.size) return false;
      for (const item of a) {
        if (!b.has(item)) return false;
      }
      return true;
    }
    
    if (a instanceof Map && b instanceof Map) {
      if (a.size !== b.size) return false;
      for (const [key, value] of a) {
        if (!b.has(key) || !this.deepEqual(value, b.get(key))) return false;
      }
      return true;
    }
    
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    
    if (aKeys.length !== bKeys.length) return false;
    
    return aKeys.every(key => this.deepEqual(a[key], b[key]));
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
    
    if (this.batchUpdateTimer) {
      clearTimeout(this.batchUpdateTimer);
    }
    
    this.trackStates.forEach(state => state.dispose());
    this.trackStates.clear();
    this.storeListeners.clear();
    this.derivedStateListeners.clear();
  }
}