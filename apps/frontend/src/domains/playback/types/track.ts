import type { InstrumentType } from '../modules/tracks/management/TrackManagerProcessor.js';
import type { AudioPlugin, PluginConfig } from './plugin.js';
import type { Pattern } from './pattern.js';
import type { TimeSignature, MusicalPosition } from './timing.js';
import type { Region } from './region.js';

/**
 * Track state enumeration for lifecycle management
 */
export enum TrackState {
  UNINITIALIZED = 'UNINITIALIZED',
  INITIALIZING = 'INITIALIZING',
  READY = 'READY',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  STOPPED = 'STOPPED',
  MUTED = 'MUTED',
  SOLOED = 'SOLOED',
  ERROR = 'ERROR',
  DISPOSING = 'DISPOSING',
}

/**
 * Track routing configuration for input/output connections
 */
export interface TrackRouting {
  /** Input source - can be another track ID, bus ID, or external input */
  inputSource?: string;

  /** Output destination - can be master bus, aux bus, or another track */
  outputDestination: string;

  /** Send configurations for aux/effect buses */
  sends: TrackSend[];

  /** Enable/disable input monitoring */
  inputMonitoring: boolean;

  /** Pre/post fader listening point */
  listeningPoint: 'pre-fader' | 'post-fader';
}

/**
 * Track send configuration for aux/effect buses
 */
export interface TrackSend {
  /** Target bus ID */
  busId: string;

  /** Send level (0-1) */
  level: number;

  /** Pre or post fader send */
  sendPoint: 'pre-fader' | 'post-fader';

  /** Send enabled state */
  enabled: boolean;

  /** Automation enabled for this send */
  automationEnabled: boolean;
}

/**
 * Track automation configuration
 */
export interface TrackAutomation {
  /** Parameter being automated */
  parameter: string;

  /** Automation points with time and value */
  points: AutomationPoint[];

  /** Automation mode */
  mode: 'read' | 'write' | 'touch' | 'latch' | 'off';

  /** Whether automation is enabled */
  enabled?: boolean;

  /** Curve type between points */
  curveType: 'linear' | 'exponential' | 'step';
}

/**
 * Single automation point
 */
export interface AutomationPoint {
  /** Musical position of the automation point */
  position: MusicalPosition;

  /** Value at this point (normalized 0-1) */
  value: number;

  /** Optional curve tension for bezier curves */
  tension?: number;
}

/**
 * Track mixing state
 */
export interface TrackMixingState {
  /** Track volume (0-1) */
  volume: number;

  /** Track pan (-1 to 1, 0 = center) */
  pan: number;

  /** Track mute state */
  mute: boolean;

  /** Track solo state */
  solo: boolean;

  /** Track record arm state */
  recordArm: boolean;

  /** Track phase invert */
  phaseInvert: boolean;

  /** Track delay compensation in samples */
  delayCompensation: number;
}

/**
 * Track synchronization configuration
 */
export interface TrackSyncConfig {
  /** Quantization settings */
  quantization: {
    enabled: boolean;
    gridSize: '1/4' | '1/8' | '1/16' | '1/32' | 'triplet';
    strength: number; // 0-1, how much to quantize
    swing: number; // -1 to 1, swing amount
  };

  /** Groove template reference */
  grooveTemplate?: string;

  /** Timing dependencies on other tracks */
  dependencies: TrackDependency[];

  /** Track priority for timing resolution (higher = more important) */
  priority: number;

  /** Humanization amount (0-1) */
  humanization: number;

  /** Timing offset in milliseconds */
  timingOffset: number;
}

/**
 * Track dependency configuration
 */
export interface TrackDependency {
  /** Dependent track ID */
  trackId: string;

  /** Dependency type */
  type: 'follow' | 'avoid' | 'sync' | 'trigger';

  /** Dependency strength (0-1) */
  strength: number;

  /** Offset in musical time */
  offset?: MusicalPosition;
}

/**
 * Track performance metrics
 */
export interface TrackMetrics {
  /** CPU usage percentage */
  cpuUsage: number;

  /** Memory usage in bytes */
  memoryUsage: number;

  /** Plugin count */
  pluginCount: number;

  /** Voice count (for instruments) */
  voiceCount: number;

  /** Timing drift in milliseconds */
  timingDrift: number;

  /** Dropped events count */
  droppedEvents: number;

  /** Last update timestamp */
  lastUpdate: number;
}

/**
 * Core Track interface representing a single track in the DAW
 */
export interface Track {
  /** Unique track identifier */
  id: string;

  /** Track name */
  name: string;

  /** Track color for UI */
  color: string;

  /** Track index for ordering */
  index: number;

  /** Instrument type */
  instrumentType: InstrumentType;

  /** Current track state */
  state: TrackState;

  /** Musical properties */
  musical: {
    /** Key signature */
    keySignature?: string;

    /** Time signature */
    timeSignature: TimeSignature;

    /** Note range constraints */
    noteRange?: {
      min: number; // MIDI note number
      max: number; // MIDI note number
    };

    /** Velocity range */
    velocityRange: {
      min: number; // 0-127
      max: number; // 0-127
    };

    /** Track tempo (if different from master) */
    tempo?: number;
  };

  /** Mixing properties */
  mixing: TrackMixingState;

  /** Track routing configuration */
  routing: TrackRouting;

  /** Synchronization configuration */
  sync: TrackSyncConfig;

  /** Automation curves */
  automation: TrackAutomation[];

  /** Plugin chain */
  plugins: AudioPlugin[];

  /** Track patterns */
  patterns: Pattern[];

  /** Track regions for timeline-based composition */
  regions: Region[];

  /** Arrangement metadata for timeline view */
  arrangement: {
    /** Timeline zoom level */
    zoom: number;
    /** Timeline scroll position */
    scrollPosition: number;
    /** Selected regions */
    selectedRegions: string[];
  };

  /** Performance metrics */
  metrics: TrackMetrics;

  /** Track metadata */
  metadata: {
    /** Creation timestamp */
    createdAt: number;

    /** Last modified timestamp */
    modifiedAt: number;

    /** Track version for compatibility */
    version: string;

    /** Custom user data */
    userData?: Record<string, unknown>;
  };
}

/**
 * Track lifecycle methods
 */
export interface TrackLifecycle {
  /** Initialize track resources */
  initialize(): Promise<void>;

  /** Dispose track resources */
  dispose(): Promise<void>;

  /** Validate track state */
  validate(): boolean;

  /** Reset track to initial state */
  reset(): void;

  /** Clone track with new ID */
  clone(newId: string): Track;
}

/**
 * Track state container for state management
 */
export interface TrackStateContainer {
  /** Current track data */
  track: Track;

  /** Track state history for undo/redo */
  history: TrackStateSnapshot[];

  /** Current history index */
  historyIndex: number;

  /** Maximum history size */
  maxHistorySize: number;

  /** State change listeners */
  listeners: Set<(track: Track) => void>;
}

/**
 * Track state snapshot for history
 */
export interface TrackStateSnapshot {
  /** Snapshot timestamp */
  timestamp: number;

  /** Snapshot description */
  description: string;

  /** Track state at this point */
  state: Partial<Track>;

  /** Changed properties */
  changedProperties: string[];
}

/**
 * Track creation configuration
 */
export interface TrackConfig {
  /** Optional track ID (will be auto-generated if not provided) */
  id?: string;

  /** Track name */
  name: string;

  /** Instrument type */
  instrumentType: InstrumentType;

  /** Initial mixing state */
  mixing?: Partial<TrackMixingState>;

  /** Initial routing configuration */
  routing?: Partial<TrackRouting>;

  /** Initial sync configuration */
  sync?: Partial<TrackSyncConfig>;

  /** Initial plugins */
  plugins?: PluginConfig[];

  /** Track color */
  color?: string;

  /** Track index */
  index?: number;
}

/**
 * Track manager interface for track operations
 */
export interface TrackManager {
  /** Create a new track */
  createTrack(config: TrackConfig): Promise<Track>;

  /** Get track by ID */
  getTrack(id: string): Track | undefined;

  /** Get all tracks */
  getAllTracks(): Track[];

  /** Update track */
  updateTrack(id: string, updates: Partial<Track>): void;

  /** Delete track */
  deleteTrack(id: string): Promise<void>;

  /** Reorder tracks */
  reorderTracks(trackIds: string[]): void;

  /** Get tracks by instrument type */
  getTracksByType(type: InstrumentType): Track[];

  /** Validate track dependencies */
  validateDependencies(): boolean;

  /** Resolve timing dependencies */
  resolveDependencies(): void;
}

/**
 * Track serialization for persistence
 */
export interface SerializedTrack {
  /** Track data */
  data: Track;

  /** Serialization version */
  version: string;

  /** Serialization timestamp */
  timestamp: number;

  /** Checksum for validation */
  checksum: string;
}

/**
 * Track import/export utilities
 */
export interface TrackSerializer {
  /** Serialize track to JSON */
  serialize(track: Track): SerializedTrack;

  /** Deserialize track from JSON */
  deserialize(data: SerializedTrack): Track;

  /** Validate serialized data */
  validate(data: unknown): data is SerializedTrack;

  /** Migrate old track format */
  migrate(data: unknown): SerializedTrack;
}
