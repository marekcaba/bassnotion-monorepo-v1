import type {
  Track,
  TrackStateContainer as ITrackStateContainer,
  TrackStateSnapshot
} from '../../types/track.js';
import { EventBus } from './EventBus.js';
import { serviceRegistry } from './ServiceRegistry.js';
import { PlaybackError, ErrorSeverity } from '../errors/base.js';

/**
 * Default maximum history size
 */
const DEFAULT_MAX_HISTORY_SIZE = 100;

/**
 * Track state container implementation for state management
 */
export class TrackStateContainer implements ITrackStateContainer {
  public track: Track;
  public history: TrackStateSnapshot[] = [];
  public historyIndex = -1;
  public maxHistorySize: number;
  public listeners = new Set<(track: Track) => void>();
  
  private _eventBus?: EventBus;
  
  constructor(track: Track, maxHistorySize = DEFAULT_MAX_HISTORY_SIZE) {
    this.track = track;
    this.maxHistorySize = maxHistorySize;
    
    // Get event bus from singleton registry
    try {
      this._eventBus = serviceRegistry.get<EventBus>('eventBus');
    } catch (e) {
      // EventBus might not be registered in tests
      console.warn('EventBus not found in ServiceRegistry');
    }
    
    // Take initial snapshot
    this.takeSnapshot('Initial state');
  }
  
  /**
   * Update track state and record in history
   */
  updateState(updates: Partial<Track>, description: string): void {
    // Get changed properties
    const changedProperties = this.getChangedProperties(this.track, updates);
    
    if (changedProperties.length === 0) {
      return; // No changes
    }
    
    // Apply updates
    const previousState = this.cloneTrackState(this.track);
    this.applyUpdates(updates);
    
    // Take snapshot
    this.takeSnapshot(description, changedProperties);
    
    // Notify listeners
    this.notifyListeners();
    
    // Emit state change event
    this._eventBus?.emit('track:stateUpdated', {
      trackId: this.track.id,
      changedProperties,
      previousState,
      currentState: this.track
    });
  }
  
  /**
   * Take a snapshot of current state
   */
  takeSnapshot(description: string, changedProperties: string[] = []): void {
    // Remove any history after current index (for redo)
    if (this.historyIndex < this.history.length - 1) {
      this.history.splice(this.historyIndex + 1);
    }
    
    // Create snapshot
    const snapshot: TrackStateSnapshot = {
      timestamp: Date.now(),
      description,
      state: this.cloneTrackState(this.track),
      changedProperties
    };
    
    // Add to history
    this.history.push(snapshot);
    this.historyIndex++;
    
    // Trim history if needed
    if (this.history.length > this.maxHistorySize) {
      const removeCount = this.history.length - this.maxHistorySize;
      this.history.splice(0, removeCount);
      this.historyIndex -= removeCount;
    }
  }
  
  /**
   * Undo last state change
   */
  undo(): boolean {
    if (!this.canUndo()) {
      return false;
    }
    
    this.historyIndex--;
    const snapshot = this.history[this.historyIndex];
    
    // Restore state
    this.restoreFromSnapshot(snapshot);
    
    // Notify listeners
    this.notifyListeners();
    
    // Emit undo event
    this._eventBus?.emit('track:undone', {
      trackId: this.track.id,
      description: snapshot.description
    });
    
    return true;
  }
  
  /**
   * Redo previously undone state change
   */
  redo(): boolean {
    if (!this.canRedo()) {
      return false;
    }
    
    this.historyIndex++;
    const snapshot = this.history[this.historyIndex];
    
    // Restore state
    this.restoreFromSnapshot(snapshot);
    
    // Notify listeners
    this.notifyListeners();
    
    // Emit redo event
    this._eventBus?.emit('track:redone', {
      trackId: this.track.id,
      description: snapshot.description
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
    this.history = [];
    this.historyIndex = -1;
    this.takeSnapshot('History cleared');
  }
  
  /**
   * Get history info
   */
  getHistoryInfo(): { current: number; total: number; canUndo: boolean; canRedo: boolean } {
    return {
      current: this.historyIndex,
      total: this.history.length,
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    };
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
      version: '1.0.0'
    });
  }
  
  /**
   * Deserialize state from persistence
   */
  static deserialize(data: string, track: Track): TrackStateContainer {
    try {
      const parsed = JSON.parse(data);
      const container = new TrackStateContainer(track, parsed.maxHistorySize);
      
      container.history = parsed.history;
      container.historyIndex = parsed.historyIndex;
      
      // Restore current state
      if (container.historyIndex >= 0 && container.historyIndex < container.history.length) {
        container.restoreFromSnapshot(container.history[container.historyIndex]);
      }
      
      return container;
    } catch (error) {
      throw new PlaybackError(
        'Failed to deserialize track state',
        'TRACK_STATE_DESERIALIZE_FAILED',
        ErrorSeverity.MEDIUM,
        { error }
      );
    }
  }
  
  /**
   * Apply updates to track
   */
  private applyUpdates(updates: Partial<Track>): void {
    // Deep merge updates into track
    this.deepMerge(this.track, updates);
    
    // Update modified timestamp
    if (this.track.metadata) {
      this.track.metadata.modifiedAt = Date.now();
    }
  }
  
  /**
   * Deep merge source into target
   */
  private deepMerge(target: any, source: any): void {
    Object.keys(source).forEach(key => {
      const sourceValue = source[key];
      const targetValue = target[key];
      
      if (sourceValue === undefined) {
        return;
      }
      
      if (sourceValue === null || typeof sourceValue !== 'object' || Array.isArray(sourceValue)) {
        // Direct assignment for null, primitives, and arrays
        target[key] = sourceValue;
      } else if (targetValue && typeof targetValue === 'object' && !Array.isArray(targetValue)) {
        // Recursive merge for nested objects
        this.deepMerge(targetValue, sourceValue);
      } else {
        // Create new object if target doesn't have one
        target[key] = sourceValue;
      }
    });
  }
  
  /**
   * Get changed properties between two states
   */
  private getChangedProperties(current: Partial<Track>, updates: Partial<Track>): string[] {
    const changed: string[] = [];
    
    const checkChanges = (currentObj: any, updateObj: any, path: string = '') => {
      Object.keys(updateObj).forEach(key => {
        const fullPath = path ? `${path}.${key}` : key;
        const currentValue = currentObj?.[key];
        const updateValue = updateObj[key];
        
        if (updateValue !== undefined) {
          if (typeof updateValue === 'object' && updateValue !== null && !Array.isArray(updateValue) &&
              typeof currentValue === 'object' && currentValue !== null && !Array.isArray(currentValue)) {
            // Recursively check nested objects
            checkChanges(currentValue, updateValue, fullPath);
          } else if (!this.deepEqual(currentValue, updateValue)) {
            // Value has changed
            if (!changed.includes(path || key)) {
              changed.push(path || key);
            }
          }
        }
      });
    };
    
    checkChanges(current, updates);
    return changed;
  }
  
  /**
   * Deep equality check
   */
  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    
    if (typeof a !== 'object' || typeof b !== 'object') {
      return false;
    }
    
    if (a === null || b === null) {
      return false;
    }
    
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    
    if (aKeys.length !== bKeys.length) {
      return false;
    }
    
    return aKeys.every(key => 
      this.deepEqual((a as any)[key], (b as any)[key])
    );
  }
  
  /**
   * Clone track state
   */
  private cloneTrackState(track: Track): Partial<Track> {
    // Deep clone relevant state properties
    return {
      name: track.name,
      color: track.color,
      index: track.index,
      state: track.state,
      musical: {
        ...track.musical,
        timeSignature: { ...track.musical.timeSignature },
        noteRange: track.musical.noteRange ? { ...track.musical.noteRange } : undefined,
        velocityRange: { ...track.musical.velocityRange }
      },
      mixing: { ...track.mixing },
      routing: {
        ...track.routing,
        sends: track.routing.sends.map(send => ({ ...send }))
      },
      sync: {
        ...track.sync,
        quantization: { ...track.sync.quantization },
        dependencies: track.sync.dependencies.map(dep => ({ ...dep }))
      },
      automation: track.automation.map(auto => ({
        ...auto,
        points: auto.points.map(point => ({ ...point }))
      }))
    };
  }
  
  /**
   * Restore track from snapshot
   */
  private restoreFromSnapshot(snapshot: TrackStateSnapshot): void {
    // Restore state properties
    if (snapshot.state.name !== undefined) this.track.name = snapshot.state.name;
    if (snapshot.state.color !== undefined) this.track.color = snapshot.state.color;
    if (snapshot.state.index !== undefined) this.track.index = snapshot.state.index;
    if (snapshot.state.state !== undefined) this.track.state = snapshot.state.state;
    
    // Restore complex properties
    if (snapshot.state.musical) {
      this.track.musical = {
        ...this.track.musical,
        ...snapshot.state.musical
      };
    }
    
    if (snapshot.state.mixing) {
      this.track.mixing = {
        ...this.track.mixing,
        ...snapshot.state.mixing
      };
    }
    
    if (snapshot.state.routing) {
      this.track.routing = {
        ...this.track.routing,
        ...snapshot.state.routing
      };
    }
    
    if (snapshot.state.sync) {
      this.track.sync = {
        ...this.track.sync,
        ...snapshot.state.sync
      };
    }
    
    if (snapshot.state.automation) {
      this.track.automation = [...snapshot.state.automation];
    }
  }
  
  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.track);
      } catch (error) {
        console.error('Error in track state listener:', error);
      }
    });
  }
}