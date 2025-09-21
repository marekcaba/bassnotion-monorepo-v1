import { nanoid } from 'nanoid';
import {
  type Track as ITrack,
  type TrackConfig,
  type TrackLifecycle,
  TrackState,
  type TrackMixingState,
  type TrackRouting,
  type TrackSyncConfig,
  type TrackMetrics,
  type TrackAutomation,
} from '../../../types/track.js';
import type { AudioPlugin } from '../../../types/plugin.js';
import { PluginState } from '../../../types/plugin.js';
import type { Pattern } from '../../../types/pattern.js';
import type { TimeSignature } from '../../../types/timing.js';
import type { Region } from '../../../types/region.js';
import type { MusicalPosition } from '../../../types/pattern.js';
import {
  EventBus,
  createStructuredLogger,
  type InstrumentType,
} from '../../shared/index.js';
// Import serviceRegistry through shared module
const serviceRegistry = {
  get<T>(name: string): T {
    // Try window globals
    if (typeof window !== 'undefined' && (window as any).__serviceRegistry) {
      return (window as any).__serviceRegistry.get(name);
    }
    throw new Error(`Service ${name} not found`);
  },
};

// Define minimal error types needed for this module
class PlaybackError extends Error {
  constructor(
    message: string,
    public code: string,
    public severity: 'low' | 'medium' | 'high' | 'critical',
    public context?: any,
  ) {
    super(message);
    this.name = 'PlaybackError';
  }
}

const ErrorSeverity = {
  LOW: 'low' as const,
  MEDIUM: 'medium' as const,
  HIGH: 'high' as const,
  CRITICAL: 'critical' as const,
};

class ErrorReporter {
  static reportError(error: PlaybackError): void {
    logger.error('PlaybackError', error, {
      code: error.code,
      severity: error.severity,
    });
  }
}
import {
  compareMusicalPositions,
  addMusicalTime,
  isPositionInRange,
} from '../../../utils/regionUtils.js';

const logger = createStructuredLogger('Track');

/**
 * Default mixing state for new tracks
 */
const DEFAULT_MIXING_STATE: TrackMixingState = {
  volume: 0.75,
  pan: 0,
  mute: false,
  solo: false,
  recordArm: false,
  phaseInvert: false,
  delayCompensation: 0,
};

/**
 * Default routing configuration
 */
const DEFAULT_ROUTING: TrackRouting = {
  outputDestination: 'master',
  sends: [],
  inputMonitoring: false,
  listeningPoint: 'post-fader',
};

/**
 * Default sync configuration
 */
const DEFAULT_SYNC_CONFIG: TrackSyncConfig = {
  quantization: {
    enabled: false,
    gridSize: '1/16',
    strength: 1,
    swing: 0,
  },
  dependencies: [],
  priority: 50,
  humanization: 0,
  timingOffset: 0,
};

/**
 * Default time signature
 */
const DEFAULT_TIME_SIGNATURE: TimeSignature = {
  numerator: 4,
  denominator: 4,
};

/**
 * Track implementation with lifecycle management
 */
export class Track implements ITrack, TrackLifecycle {
  // Track properties
  public readonly id: string;
  public name: string;
  public color: string;
  public index: number;
  public instrumentType: InstrumentType;
  public state: TrackState;

  // Musical properties
  public musical: ITrack['musical'];

  // Mixing and routing
  public mixing: TrackMixingState;
  public routing: TrackRouting;

  // Synchronization
  public sync: TrackSyncConfig;

  // Collections
  public automation: TrackAutomation[] = [];
  public plugins: AudioPlugin[] = [];
  public patterns: Pattern[] = [];
  public regions: Region[] = [];

  // Arrangement view state
  public arrangement = {
    zoom: 1,
    scrollPosition: 0,
    selectedRegions: [] as string[],
  };

  // Performance metrics
  public metrics: TrackMetrics;

  // Metadata
  public metadata: ITrack['metadata'];

  // Internal state
  private _disposed = false;
  private _eventBus?: EventBus;
  private _errorReporter?: ErrorReporter;
  private _initPromise?: Promise<void>;

  constructor(config: TrackConfig) {
    // Use provided ID or generate unique ID
    this.id = config.id || nanoid();

    // Basic properties
    this.name = config.name;
    this.color = config.color || this.generateColor();
    this.index = config.index ?? 0;
    this.instrumentType = config.instrumentType;
    this.state = TrackState.UNINITIALIZED;

    // Musical properties
    this.musical = {
      timeSignature: DEFAULT_TIME_SIGNATURE,
      velocityRange: { min: 0, max: 127 },
    };

    // Mixing state
    this.mixing = {
      ...DEFAULT_MIXING_STATE,
      ...config.mixing,
    };

    // Routing configuration
    this.routing = {
      ...DEFAULT_ROUTING,
      ...config.routing,
    };

    // Sync configuration
    this.sync = {
      ...DEFAULT_SYNC_CONFIG,
      ...config.sync,
    };

    // Initialize metrics
    this.metrics = {
      cpuUsage: 0,
      memoryUsage: 0,
      pluginCount: 0,
      voiceCount: 0,
      timingDrift: 0,
      droppedEvents: 0,
      lastUpdate: Date.now(),
    };

    // Metadata
    this.metadata = {
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      version: '1.0.0',
    };

    // Get services from singleton registry
    try {
      this._eventBus = serviceRegistry.get<EventBus>('eventBus');
    } catch {
      // EventBus is optional - might not be registered in tests or during initialization
      // Try multiple fallback methods
      if (!this._eventBus && typeof window !== 'undefined') {
        // Try global EventBus singleton first
        if ((window as any).__globalEventBus) {
          this._eventBus = (window as any).__globalEventBus;
          logger.info(
            `🎵 Track ${this.name}: Got EventBus from __globalEventBus`,
            { correlationId: 'system' },
          );
        }
        // Try global services
        else if ((window as any).__globalCoreServices?.getEventBus) {
          this._eventBus = (window as any).__globalCoreServices.getEventBus();
          logger.info(
            `🎵 Track ${this.name}: Got EventBus from __globalCoreServices`,
            { correlationId: 'system' },
          );
        }
        // Try creating global singleton as last resort
        else {
          this._eventBus = EventBus.getGlobalInstance();
          logger.info(
            `🎵 Track ${this.name}: Created EventBus global singleton`,
            { correlationId: 'system' },
          );
        }
      }
    }

    try {
      this._errorReporter = serviceRegistry.get<ErrorReporter>('errorReporter');
    } catch {
      // ErrorReporter is optional - might not be registered in tests or during initialization
      // Silently continue without it
    }

    // Listen for PatternScheduler requests to re-emit regions
    if (this._eventBus) {
      this._eventBus.on('pattern-scheduler:request-regions', () => {
        if (this.regions.length > 0) {
          logger.info(
            `🎵 Track ${this.name}: Re-emitting ${this.regions.length} regions in response to PatternScheduler request`,
            { correlationId: 'system' },
          );
          this._eventBus?.emit('track-regions-updated', {
            trackId: this.id,
            regions: this.regions,
          });
        }
      });
    }
  }

  /**
   * Initialize track resources
   */
  async initialize(): Promise<void> {
    if (this._disposed) {
      throw new PlaybackError(
        'Cannot initialize disposed track',
        'TRACK_DISPOSED',
        ErrorSeverity.HIGH,
      );
    }

    if (this.state !== TrackState.UNINITIALIZED) {
      return this._initPromise;
    }

    this._initPromise = this._initialize();
    return this._initPromise;
  }

  private async _initialize(): Promise<void> {
    try {
      this.setState(TrackState.INITIALIZING);

      // Validate configuration
      if (!this.validate()) {
        throw new PlaybackError(
          'Invalid track configuration',
          'TRACK_VALIDATION_FAILED',
          ErrorSeverity.HIGH,
        );
      }

      // Initialize plugins
      for (const plugin of this.plugins) {
        if (plugin.state === PluginState.UNLOADED) {
          await plugin.load?.();
        }
        if (plugin.state === PluginState.LOADED && plugin.initialize) {
          await plugin.initialize({
            audioContext: {} as AudioContext,
            sampleRate: 48000,
            bufferSize: 512,
            currentTime: 0,
          });
        }
      }

      // Update metrics
      this.updateMetrics();

      // Emit initialization event
      this._eventBus?.emit('track:initialized', {
        trackId: this.id,
        instrumentType: this.instrumentType,
      });

      this.setState(TrackState.READY);
    } catch (error) {
      this.setState(TrackState.ERROR);

      const playbackError = new PlaybackError(
        `Failed to initialize track: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TRACK_INIT_FAILED',
        ErrorSeverity.HIGH,
        { trackId: this.id, instrumentType: this.instrumentType },
      );

      if (
        this._errorReporter &&
        typeof (this._errorReporter as any).reportError === 'function'
      ) {
        (this._errorReporter as any).reportError(playbackError);
      } else {
        logger.error('Track error', playbackError, {
          code: playbackError.code,
        });
      }
      throw playbackError;
    }
  }

  /**
   * Dispose track resources
   */
  async dispose(): Promise<void> {
    if (this._disposed) {
      return;
    }

    try {
      this.setState(TrackState.DISPOSING);

      // Dispose plugins
      for (const plugin of this.plugins) {
        if (plugin.dispose) {
          await plugin.dispose();
        }
      }

      // Clear collections
      this.plugins = [];
      this.patterns = [];
      this.automation = [];
      this.regions = [];

      // Emit disposal event
      this._eventBus?.emit('track:disposed', {
        trackId: this.id,
        instrumentType: this.instrumentType,
      });

      this._disposed = true;
    } catch (error) {
      const playbackError = new PlaybackError(
        `Failed to dispose track: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TRACK_DISPOSE_FAILED',
        ErrorSeverity.MEDIUM,
        { trackId: this.id },
      );

      if (
        this._errorReporter &&
        typeof (this._errorReporter as any).reportError === 'function'
      ) {
        (this._errorReporter as any).reportError(playbackError);
      } else {
        logger.error('Track error', playbackError, {
          code: playbackError.code,
        });
      }
      throw playbackError;
    }
  }

  /**
   * Validate track state
   */
  validate(): boolean {
    try {
      // Basic validation
      if (!this.id || !this.name || !this.instrumentType) {
        return false;
      }

      // Validate mixing values
      if (this.mixing.volume < 0 || this.mixing.volume > 1) {
        return false;
      }
      if (this.mixing.pan < -1 || this.mixing.pan > 1) {
        return false;
      }

      // Validate velocity range
      const { velocityRange } = this.musical;
      if (
        velocityRange.min < 0 ||
        velocityRange.max > 127 ||
        velocityRange.min > velocityRange.max
      ) {
        return false;
      }

      // Validate sync configuration
      if (this.sync.priority < 0 || this.sync.priority > 100) {
        return false;
      }
      if (this.sync.humanization < 0 || this.sync.humanization > 1) {
        return false;
      }

      // Validate sends
      for (const send of this.routing.sends) {
        if (send.level < 0 || send.level > 1) {
          return false;
        }
      }

      // Validate automation
      for (const automation of this.automation) {
        for (const point of automation.points) {
          if (point.value < 0 || point.value > 1) {
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      if (
        this._errorReporter &&
        typeof (this._errorReporter as any).reportError === 'function'
      ) {
        (this._errorReporter as any).reportError(
          new PlaybackError(
            'Track validation error',
            'TRACK_VALIDATION_ERROR',
            ErrorSeverity.LOW,
            { trackId: this.id, error },
          ),
        );
      }
      return false;
    }
  }

  /**
   * Reset track to initial state
   */
  reset(): void {
    // Reset state
    this.state = TrackState.READY;

    // Reset mixing
    this.mixing = { ...DEFAULT_MIXING_STATE };

    // Reset sync
    this.sync = { ...DEFAULT_SYNC_CONFIG };

    // Clear patterns, regions, and automation
    this.patterns = [];
    this.regions = [];
    this.automation = [];
    this.arrangement.selectedRegions = [];

    // Reset metrics
    this.metrics = {
      cpuUsage: 0,
      memoryUsage: 0,
      pluginCount: this.plugins.length,
      voiceCount: 0,
      timingDrift: 0,
      droppedEvents: 0,
      lastUpdate: Date.now(),
    };

    // Update metadata
    this.metadata.modifiedAt = Date.now();

    // Emit reset event
    this._eventBus?.emit('track:reset', {
      trackId: this.id,
      instrumentType: this.instrumentType,
    });
  }

  /**
   * Clone track with new ID
   */
  clone(newId?: string): Track {
    const config: TrackConfig = {
      name: `${this.name} (Copy)`,
      instrumentType: this.instrumentType,
      mixing: { ...this.mixing },
      routing: {
        ...this.routing,
        sends: this.routing.sends.map((send) => ({ ...send })),
      },
      sync: {
        ...this.sync,
        quantization: { ...this.sync.quantization },
        dependencies: this.sync.dependencies.map((dep) => ({ ...dep })),
      },
      color: this.color,
      index: this.index + 1,
    };

    const cloned = new Track(config);

    // Override ID if provided
    if (newId) {
      (cloned as any).id = newId;
    }

    // Clone musical properties
    cloned.musical = {
      ...this.musical,
      timeSignature: { ...this.musical.timeSignature },
      noteRange: this.musical.noteRange
        ? { ...this.musical.noteRange }
        : undefined,
      velocityRange: { ...this.musical.velocityRange },
    };

    // Clone automation
    cloned.automation = this.automation.map((auto) => ({
      ...auto,
      points: auto.points.map((point) => ({ ...point })),
    }));

    // Note: Plugins and patterns are not cloned - they need to be recreated

    return cloned;
  }

  /**
   * Set track state and emit event
   */
  private setState(state: TrackState): void {
    const oldState = this.state;
    this.state = state;

    this._eventBus?.emit('track:stateChanged', {
      trackId: this.id,
      oldState,
      newState: state,
    });
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(): void {
    this.metrics.pluginCount = this.plugins.length;
    this.metrics.lastUpdate = Date.now();

    // Calculate plugin metrics
    let totalCpu = 0;
    let totalMemory = 0;

    for (const plugin of this.plugins) {
      if (typeof (plugin as any).getMetrics === 'function') {
        const metrics = (plugin as any).getMetrics();
        totalCpu += metrics.cpuUsage || 0;
        totalMemory += metrics.memoryUsage || 0;
      }
    }

    this.metrics.cpuUsage = totalCpu;
    this.metrics.memoryUsage = totalMemory;
  }

  /**
   * Generate a random color for the track
   */
  private generateColor(): string {
    const colors = [
      '#FF6B6B',
      '#4ECDC4',
      '#45B7D1',
      '#FFA07A',
      '#98D8C8',
      '#F7DC6F',
      '#BB8FCE',
      '#85C1F2',
      '#F8B195',
      '#F67280',
      '#C06C84',
      '#6C5CE7',
    ];
    return colors[Math.floor(Math.random() * colors.length)] || '#FF6B6B';
  }

  /**
   * Add a plugin to the track
   */
  addPlugin(plugin: AudioPlugin): void {
    this.plugins.push(plugin);
    this.updateMetrics();

    this._eventBus?.emit('track:pluginAdded', {
      trackId: this.id,
      pluginId: (plugin as any).id || 'unknown',
      pluginType: plugin.metadata.category,
    });
  }

  /**
   * Remove a plugin from the track
   */
  removePlugin(pluginId: string): void {
    const index = this.plugins.findIndex((p) => (p as any).id === pluginId);
    if (index !== -1) {
      const plugin = this.plugins[index];
      this.plugins.splice(index, 1);
      this.updateMetrics();

      this._eventBus?.emit('track:pluginRemoved', {
        trackId: this.id,
        pluginId: plugin ? (plugin as any).id || 'unknown' : 'unknown',
        pluginType: plugin?.metadata?.category || 'unknown',
      });
    }
  }

  /**
   * Add a pattern to the track
   */
  addPattern(pattern: Pattern): void {
    this.patterns.push(pattern);

    this._eventBus?.emit('track:patternAdded', {
      trackId: this.id,
      patternType: (pattern as any).type || 'unknown',
    });
  }

  /**
   * Remove a pattern from the track
   */
  removePattern(patternIndex: number): void {
    if (patternIndex >= 0 && patternIndex < this.patterns.length) {
      const pattern = this.patterns[patternIndex];
      this.patterns.splice(patternIndex, 1);

      this._eventBus?.emit('track:patternRemoved', {
        trackId: this.id,
        patternType: pattern ? (pattern as any).type || 'unknown' : 'unknown',
      });
    }
  }

  /**
   * Update mixing state
   */
  updateMixing(updates: Partial<TrackMixingState>): void {
    const oldMixing = { ...this.mixing };
    this.mixing = { ...this.mixing, ...updates };

    this._eventBus?.emit('track:mixingUpdated', {
      trackId: this.id,
      oldMixing,
      newMixing: this.mixing,
    });
  }

  /**
   * Add automation curve
   */
  addAutomation(automation: TrackAutomation): void {
    this.automation.push(automation);

    this._eventBus?.emit('track:automationAdded', {
      trackId: this.id,
      parameter: automation.parameter,
    });
  }

  /**
   * Get current automation value for a parameter at a given position
   */
  getAutomationValue(parameter: string, _position: number): number | undefined {
    const automation = this.automation.find((a) => a.parameter === parameter);
    if (!automation || automation.mode === 'off') {
      return undefined;
    }

    // Find surrounding points
    const points = automation.points.sort((a, b) => {
      const aTime = this.musicalPositionToSeconds(a.position);
      const bTime = this.musicalPositionToSeconds(b.position);
      return aTime - bTime;
    });

    if (points.length === 0) {
      return undefined;
    }

    // Implementation would calculate interpolated value
    // This is simplified for now
    return points[0]?.value;
  }

  /**
   * Convert musical position to seconds (simplified)
   */
  private musicalPositionToSeconds(_position: any): number {
    // This would use the transport's tempo and time signature
    // Simplified for now
    return 0;
  }

  // ============================================================================
  // REGION MANAGEMENT METHODS
  // ============================================================================

  /**
   * Add region to track
   */
  addRegion(region: Region): void {
    if (region.trackId !== this.id) {
      throw new PlaybackError(
        'Region trackId does not match track ID',
        'TRACK_REGION_MISMATCH',
        ErrorSeverity.MEDIUM,
        { trackId: this.id, regionTrackId: region.trackId },
      );
    }

    this.regions.push(region);
    this.regions.sort((a, b) =>
      compareMusicalPositions(a.startPosition, b.startPosition),
    );

    // Update metadata
    this.metadata.modifiedAt = Date.now();

    // Notify scheduler of region update
    const eventBusId = this._eventBus
      ? (this._eventBus as any).getInstanceId?.() ||
        (this._eventBus as any)._instanceId ||
        'no-id'
      : 'none';
    logger.info(`🎵 Track ${this.name}: Emitting track-regions-updated event`, {
      trackId: this.id,
      regionsCount: this.regions.length,
      region: region,
      hasEventBus: !!this._eventBus,
      eventBusId: eventBusId,
      correlationId: 'system',
    });

    if (this._eventBus) {
      this._eventBus.emit('track-regions-updated', {
        trackId: this.id,
        regions: this.regions,
      });
    } else {
      // Try to get EventBus from global services if not available
      const globalServices = (window as any).__globalCoreServices;
      if (globalServices && globalServices.getEventBus) {
        const eventBus = globalServices.getEventBus();
        if (eventBus) {
          const globalEventBusId =
            (eventBus as any).getInstanceId?.() ||
            (eventBus as any)._instanceId ||
            'no-id';
          logger.info(
            `🎵 Track ${this.name}: Using global EventBus as fallback`,
            {
              globalEventBusId: globalEventBusId,
              correlationId: 'system',
            },
          );
          eventBus.emit('track-regions-updated', {
            trackId: this.id,
            regions: this.regions,
          });
        } else {
          logger.warn(
            `🎵 Track ${this.name}: No EventBus available to emit region update!`,
            { correlationId: 'system' },
          );
        }
      } else {
        logger.warn(
          `🎵 Track ${this.name}: No EventBus available to emit region update!`,
          { correlationId: 'system' },
        );
      }
    }

    // Log the action
    logger.debug(`[Track] Added region ${region.id} to track ${this.id}`, {
      correlationId: 'system',
    });
  }

  /**
   * Remove region from track
   */
  removeRegion(regionId: string): void {
    const index = this.regions.findIndex((r) => r.id === regionId);
    if (index === -1) {
      throw new PlaybackError(
        `Region ${regionId} not found in track ${this.id}`,
        'REGION_NOT_FOUND',
        ErrorSeverity.LOW,
        { trackId: this.id, regionId },
      );
    }

    this.regions.splice(index, 1);

    // Remove from selected regions if present
    const selectedIndex = this.arrangement.selectedRegions.indexOf(regionId);
    if (selectedIndex !== -1) {
      this.arrangement.selectedRegions.splice(selectedIndex, 1);
    }

    // Update metadata
    this.metadata.modifiedAt = Date.now();

    // Notify scheduler
    this._eventBus?.emit('track-regions-updated', {
      trackId: this.id,
      regions: this.regions,
    });

    logger.debug(`[Track] Removed region ${regionId} from track ${this.id}`, {
      correlationId: 'system',
    });
  }

  /**
   * Update an existing region
   */
  updateRegion(regionId: string, updates: Partial<Region>): void {
    const region = this.regions.find((r) => r.id === regionId);
    if (!region) {
      throw new PlaybackError(
        `Region ${regionId} not found in track ${this.id}`,
        'REGION_NOT_FOUND',
        ErrorSeverity.LOW,
        { trackId: this.id, regionId },
      );
    }

    // Apply updates
    Object.assign(region, updates);

    // Re-sort if position changed
    if (updates.startPosition) {
      this.regions.sort((a, b) =>
        compareMusicalPositions(a.startPosition, b.startPosition),
      );
    }

    // Update metadata
    this.metadata.modifiedAt = Date.now();

    // Notify scheduler
    this._eventBus?.emit('track-regions-updated', {
      trackId: this.id,
      regions: this.regions,
    });

    logger.debug(`[Track] Updated region ${regionId} in track ${this.id}`, {
      correlationId: 'system',
    });
  }

  /**
   * Get regions in time range
   */
  getRegionsInRange(
    startPos: MusicalPosition,
    endPos: MusicalPosition,
  ): Region[] {
    return this.regions.filter((region) => {
      const regionEnd = addMusicalTime(region.startPosition, region.duration);
      return (
        isPositionInRange(region.startPosition, startPos, endPos) ||
        isPositionInRange(regionEnd, startPos, endPos) ||
        (compareMusicalPositions(region.startPosition, startPos) <= 0 &&
          compareMusicalPositions(regionEnd, endPos) >= 0)
      );
    });
  }

  /**
   * Get regions at specific position
   */
  getRegionsAtPosition(position: MusicalPosition): Region[] {
    return this.regions.filter((region) => {
      const regionEnd = addMusicalTime(region.startPosition, region.duration);
      return (
        compareMusicalPositions(position, region.startPosition) >= 0 &&
        compareMusicalPositions(position, regionEnd) < 0
      );
    });
  }

  /**
   * Clear all regions
   */
  clearRegions(): void {
    this.regions = [];
    this.arrangement.selectedRegions = [];

    // Update metadata
    this.metadata.modifiedAt = Date.now();

    // Notify scheduler
    this._eventBus?.emit('track-regions-updated', {
      trackId: this.id,
      regions: this.regions,
    });

    logger.debug(`[Track] Cleared all regions from track ${this.id}`, {
      correlationId: 'system',
    });
  }

  /**
   * Select region(s)
   */
  selectRegion(regionId: string, addToSelection = false): void {
    if (!this.regions.find((r) => r.id === regionId)) {
      throw new PlaybackError(
        `Region ${regionId} not found in track ${this.id}`,
        'REGION_NOT_FOUND',
        ErrorSeverity.LOW,
        { trackId: this.id, regionId },
      );
    }

    if (!addToSelection) {
      this.arrangement.selectedRegions = [regionId];
    } else if (!this.arrangement.selectedRegions.includes(regionId)) {
      this.arrangement.selectedRegions.push(regionId);
    }

    // Emit selection event
    this._eventBus?.emit('track:region-selection-changed', {
      trackId: this.id,
      selectedRegions: this.arrangement.selectedRegions,
    });
  }

  /**
   * Deselect region(s)
   */
  deselectRegion(regionId?: string): void {
    if (regionId) {
      const index = this.arrangement.selectedRegions.indexOf(regionId);
      if (index !== -1) {
        this.arrangement.selectedRegions.splice(index, 1);
      }
    } else {
      this.arrangement.selectedRegions = [];
    }

    // Emit selection event
    this._eventBus?.emit('track:region-selection-changed', {
      trackId: this.id,
      selectedRegions: this.arrangement.selectedRegions,
    });
  }

  /**
   * Create and add a region from a pattern
   */
  createRegionFromPattern(
    pattern: Pattern,
    options: {
      name: string;
      startPosition: MusicalPosition;
      duration: MusicalPosition;
      loopCount?: number;
      color?: string;
      muted?: boolean;
    },
  ): Region {
    const region: Region = {
      id: nanoid(),
      trackId: this.id,
      name: options.name,
      startPosition: options.startPosition,
      duration: options.duration,
      pattern: pattern,
      loopCount: options.loopCount ?? 1,
      muted: options.muted ?? false,
      color: options.color,
    };

    this.addRegion(region);
    return region;
  }

  /**
   * Get all regions (public accessor method)
   */
  getRegions(): Region[] {
    return [...this.regions];
  }
}
