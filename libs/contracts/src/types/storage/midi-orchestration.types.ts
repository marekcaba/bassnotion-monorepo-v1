/**
 * MIDI Orchestration and Audio Analysis Types
 * Story 2.4 Task 5: Intelligent MIDI Orchestration System
 *
 * Enterprise-grade MIDI asset management with version control,
 * collaborative features, real-time synchronization, and audio analysis.
 *
 * @module storage/midi-orchestration
 */

import type { AssetMetadata } from './base.types.js';
import type { AudioSampleFormat } from './audio-samples.types.js';

// ============================================================================
// Audio Analysis Types
// ============================================================================

/**
 * Audio metadata for comprehensive audio analysis
 */
export interface AudioMetadata {
  filename: string;
  duration: number;
  sampleRate: number;
  channels: number;
  size: number;
  format: AudioSampleFormat;
  bitDepth?: number;
  bitRate?: number;
  createdAt: number;
  modifiedAt: number;
  checksum?: string;
}

/**
 * Configuration for audio analysis operations
 */
export interface AnalysisConfig {
  enableTempoDetection: boolean;
  enableKeyDetection: boolean;
  enableSpectralAnalysis: boolean;
  enableQualityAssessment: boolean;
  enableMusicalFeatures: boolean;
  highPrecision: boolean;
  maxAnalysisDuration: number;
  customParameters?: Record<string, unknown>;
}

/**
 * Tempo detection result
 */
export interface TempoDetectionResult {
  bpm: number;
  confidence: number;
  candidates: Array<{ bpm: number; confidence: number }>;
  method: 'autocorrelation' | 'beat_tracking' | 'onset_detection';
}

/**
 * Key detection result
 */
export interface KeyDetectionResult {
  key: string;
  mode: 'major' | 'minor';
  confidence: number;
  alternatives: Array<{ key: string; mode: string; confidence: number }>;
}

/**
 * Frequency bin data for spectral analysis
 */
export interface FrequencyBinData {
  subBass: number; // 0-60 Hz
  bass: number; // 60-250 Hz
  lowMids: number; // 250-500 Hz
  mids: number; // 500-2000 Hz
  highMids: number; // 2000-4000 Hz
  highs: number; // 4000-8000 Hz
  airFreqs: number; // 8000+ Hz
}

/**
 * Harmonic content analysis
 */
export interface HarmonicContent {
  harmonicRatio: number;
  fundamentalStrength: number;
  harmonicDistribution: number[];
}

/**
 * Spectral analysis result
 */
export interface SpectralAnalysisResult {
  spectralCentroid: number;
  spectralRolloff: number;
  spectralFlux: number;
  zeroCrossingRate: number;
  frequencyBins: FrequencyBinData;
  dynamicRange: number;
  harmonicContent: HarmonicContent;
}

/**
 * Quality assessment result
 */
export interface QualityAssessmentResult {
  snr: number; // Signal-to-noise ratio in dB
  thd: number; // Total harmonic distortion
  peakLevel: number; // Peak level in dB
  rmsLevel: number; // RMS level in dB
  crestFactor: number; // Crest factor in dB
  clipping: {
    detected: boolean;
    percentage: number;
    samples: number[];
  };
  qualityScore: number; // Overall quality score (0-100)
  recommendations: string[];
}

/**
 * Musical features extraction result
 */
export interface MusicalFeatures {
  onsetDensity: number;
  rhythmComplexity: number;
  harmonicRatio: number;
  energyDistribution: {
    attack: number;
    sustain: number;
    decay: number;
    overall: 'percussive' | 'sustained' | 'mixed';
  };
  musicalGenre: string;
  instrumentClassification: string;
}

/**
 * Onset detection result
 */
export interface OnsetDetectionResult {
  onsets: number[]; // Onset times in seconds
  onsetDensity: number; // Onsets per second
  confidence: number[];
  method: 'spectral_flux' | 'complex_domain' | 'high_frequency_content';
}

/**
 * Comprehensive audio analysis result
 */
export interface AnalysisResult {
  filename: string;
  duration: number;
  sampleRate: number;
  channels: number;
  tempo: TempoDetectionResult;
  key: KeyDetectionResult;
  spectral: SpectralAnalysisResult;
  quality: QualityAssessmentResult;
  musical: MusicalFeatures;
  analyzedAt: string;
  version: string;
}

// ============================================================================
// MIDI Format Type Aliases
// ============================================================================

/**
 * MIDI file formats
 */
export type MIDIFormat = 'mid' | 'midi' | 'smf' | 'rmi' | 'kar';

/**
 * MIDI file types
 */
export type MIDIType =
  | 'type_0' // Single track
  | 'type_1' // Multi-track synchronous
  | 'type_2'; // Multi-track asynchronous

/**
 * MIDI track types
 */
export type MIDITrackType =
  | 'bass'
  | 'drums'
  | 'harmony'
  | 'melody'
  | 'percussion'
  | 'vocals'
  | 'effects'
  | 'control'
  | 'meta'
  | 'tempo'
  | 'time_signature'
  | 'key_signature';

/**
 * MIDI instrument categories
 */
export type MIDIInstrumentCategory =
  | 'piano'
  | 'chromatic_percussion'
  | 'organ'
  | 'guitar'
  | 'bass'
  | 'strings'
  | 'ensemble'
  | 'brass'
  | 'reed'
  | 'pipe'
  | 'synth_lead'
  | 'synth_pad'
  | 'synth_effects'
  | 'ethnic'
  | 'percussive'
  | 'sound_effects';

/**
 * MIDI conflict resolution strategy
 */
export type MIDIConflictResolutionStrategy =
  | 'latest_wins'
  | 'manual_merge'
  | 'track_priority'
  | 'user_preference'
  | 'intelligent_merge';

/**
 * MIDI permission levels
 */
export type MIDIPermissionLevel =
  | 'read'
  | 'comment'
  | 'edit_tracks'
  | 'edit_metadata'
  | 'manage_versions'
  | 'admin';

/**
 * MIDI update types
 */
export type MIDIUpdateType =
  | 'track_update'
  | 'event_update'
  | 'metadata_update'
  | 'cursor_update'
  | 'presence_update'
  | 'lock_update'
  | 'comment_update';

/**
 * MIDI tagging strategies
 */
export type MIDITaggingStrategy =
  | 'instrument_based'
  | 'genre_based'
  | 'complexity_based'
  | 'key_based'
  | 'tempo_based'
  | 'duration_based'
  | 'structure_based';

/**
 * MIDI complexity metrics
 */
export type MIDIComplexityMetric =
  | 'harmonic_complexity'
  | 'rhythmic_complexity'
  | 'melodic_complexity'
  | 'polyphonic_complexity'
  | 'temporal_complexity'
  | 'structural_complexity';

/**
 * MIDI optimization categories
 */
export type MIDIOptimizationCategory =
  | 'performance'
  | 'file_size'
  | 'compatibility'
  | 'musical_quality'
  | 'accessibility'
  | 'collaboration';

// ============================================================================
// MIDI Core Configuration
// ============================================================================

/**
 * Core MIDI orchestration configuration
 */
export interface MIDIAssetOrchestratorConfig {
  enabled: boolean;

  // Version control settings
  versioningConfig: MIDIVersionControlConfig;

  // Collaborative editing configuration
  collaborativeConfig: MIDICollaborativeConfig;

  // Real-time synchronization
  realTimeSyncConfig: MIDIRealTimeSyncConfig;

  // Metadata processing
  metadataProcessingConfig: MIDIMetadataProcessingConfig;

  // Analytics configuration
  analyticsConfig: MIDIAnalyticsConfig;

  // Integration settings
  storageClientConfig: SupabaseAssetClientConfig;
  cdnOptimizationEnabled: boolean;
  predictiveLoadingEnabled: boolean;

  // Performance settings
  maxConcurrentOperations: number;
  operationTimeout: number; // ms
  enableBackgroundProcessing: boolean;

  // Error handling
  enableErrorRecovery: boolean;
  maxRetryAttempts: number;
  retryBackoffMs: number;
}

/**
 * Supabase asset client configuration (referenced by MIDI orchestrator)
 */
export interface SupabaseAssetClientConfig {
  supabaseUrl: string;
  supabaseKey: string;
  bucket: string;
  maxRetries: number;
  timeout: number;
  enableCaching: boolean;
  cacheMaxAge: number;
}

// ============================================================================
// MIDI Metadata Interfaces
// ============================================================================

/**
 * Enhanced MIDI metadata extending existing AssetMetadata
 */
export interface MIDIMetadata extends AssetMetadata {
  // Basic MIDI properties
  format: MIDIFormat;
  type: MIDIType;
  ticksPerQuarter: number;

  // Musical information
  trackCount: number;
  instrumentCount: number;
  tempo: number; // BPM
  tempoChanges: MIDITempoChange[];
  timeSignature: string;
  timeSignatureChanges: MIDITimeSignatureChange[];
  keySignature: string;
  keySignatureChanges: MIDIKeySignatureChange[];

  // Track information
  tracks: MIDITrackInfo[];
  channels: MIDIChannelInfo[];

  // Timing and duration
  duration: number; // seconds
  totalTicks: number;

  // Musical analysis
  musicalComplexity: MIDIComplexityAnalysis;
  harmonicAnalysis: MIDIHarmonicAnalysis;
  rhythmicAnalysis: MIDIRhythmicAnalysis;

  // Technical properties
  fileSize: number;
  checksum: string;
  encoding?: string;

  // Usage and analytics
  playCount: number;
  lastPlayed?: number;
  averageRating?: number;
  popularityScore: number;

  // Collaborative metadata
  collaborators: MIDICollaborator[];
  lastModified: number;
  lastModifiedBy: string;

  // Version information
  version: string;
  versionHistory: MIDIVersionInfo[];

  // Custom metadata
  customProperties: Record<string, unknown>;
}

// ============================================================================
// MIDI Track and Channel Interfaces
// ============================================================================

/**
 * MIDI track information
 */
export interface MIDITrackInfo {
  trackId: string;
  trackNumber: number;
  name: string;
  type: MIDITrackType;
  channel: number;
  instrument: MIDIInstrument;

  // Musical properties
  noteCount: number;
  noteRange: MIDINoteRange;
  velocity: MIDIVelocityInfo;

  // Timing information
  startTime: number; // ticks
  endTime: number; // ticks
  duration: number; // ticks

  // Events
  eventCount: number;
  eventTypes: string[];

  // Analysis
  complexity: number; // 0-1
  density: number; // notes per beat

  // Status
  isActive: boolean;
  isMuted: boolean;
  volume: number; // 0-127

  // Collaborative properties
  lockedBy?: string;
  lastEditedBy: string;
  lastEditedAt: number;
}

/**
 * MIDI channel information
 */
export interface MIDIChannelInfo {
  channel: number;
  instrument: MIDIInstrument;
  volume: number; // 0-127
  pan: number; // 0-127
  bankSelect: number;
  programChange: number;

  // Effects
  reverb: number; // 0-127
  chorus: number; // 0-127
  pitchBend: number; // -8192 to 8191

  // Status
  isActive: boolean;
  isMuted: boolean;

  // Associated tracks
  trackIds: string[];
}

/**
 * MIDI instrument information
 */
export interface MIDIInstrument {
  programNumber: number; // 0-127
  bankNumber: number; // 0-16383
  name: string;
  category: MIDIInstrumentCategory;
  family: string;

  // Properties
  isPercussion: boolean;
  isDrumKit: boolean;

  // Technical info
  polyphony: number;
  channels: number[];
}

// ============================================================================
// Musical Analysis Interfaces
// ============================================================================

/**
 * MIDI complexity analysis
 */
export interface MIDIComplexityAnalysis {
  overallComplexity: number; // 0-1
  harmonicComplexity: number; // 0-1
  rhythmicComplexity: number; // 0-1
  melodicComplexity: number; // 0-1

  // Factors contributing to complexity
  factors: MIDIComplexityFactor[];

  // Difficulty rating
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';

  // Technical requirements
  technicalRequirements: string[];
}

/**
 * MIDI complexity factor
 */
export interface MIDIComplexityFactor {
  factor: string;
  weight: number; // 0-1
  value: number; // 0-1
  description: string;
}

/**
 * MIDI harmonic analysis
 */
export interface MIDIHarmonicAnalysis {
  keyChanges: number;
  chordProgression: MIDIChord[];
  modalityShifts: number;
  chromaticism: number; // 0-1
  dissonanceLevel: number; // 0-1

  // Harmonic rhythm
  harmonicRhythm: number; // chord changes per measure

  // Tonal analysis
  tonalCenter: string;
  modulations: MIDIModulation[];

  // Chord statistics
  uniqueChords: number;
  chordDensity: number; // chords per beat
}

/**
 * MIDI chord
 */
export interface MIDIChord {
  startTime: number; // ticks
  duration: number; // ticks
  root: string;
  quality: string; // major, minor, diminished, etc.
  inversion: number;
  notes: number[]; // MIDI note numbers
  voicing: string;
}

/**
 * MIDI modulation
 */
export interface MIDIModulation {
  startTime: number; // ticks
  fromKey: string;
  toKey: string;
  type: 'direct' | 'pivot' | 'common_tone' | 'chromatic';
  strength: number; // 0-1
}

/**
 * MIDI rhythmic analysis
 */
export interface MIDIRhythmicAnalysis {
  timeSignatureChanges: number;
  tempoChanges: number;
  tempoStability: number; // 0-1

  // Rhythmic patterns
  patterns: MIDIRhythmicPattern[];
  syncopation: number; // 0-1
  complexity: number; // 0-1

  // Beat analysis
  strongBeats: number[];
  weakBeats: number[];
  offBeats: number[];

  // Groove characteristics
  groove: MIDIGroove;
}

/**
 * MIDI rhythmic pattern
 */
export interface MIDIRhythmicPattern {
  pattern: number[]; // beat positions
  frequency: number; // occurrences
  strength: number; // 0-1
  description: string;
}

/**
 * MIDI groove characteristics
 */
export interface MIDIGroove {
  swing: number; // 0-1
  shuffle: number; // 0-1
  straightness: number; // 0-1
  tightness: number; // 0-1
  humanization: number; // 0-1
}

// ============================================================================
// Timing and Range Interfaces
// ============================================================================

/**
 * MIDI note range
 */
export interface MIDINoteRange {
  lowest: number; // MIDI note number
  highest: number; // MIDI note number
  range: number; // semitones
  mostCommon: number; // MIDI note number
}

/**
 * MIDI velocity info
 */
export interface MIDIVelocityInfo {
  min: number; // 0-127
  max: number; // 0-127
  average: number; // 0-127
  variance: number;
  dynamics: 'ppp' | 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff' | 'fff';
}

/**
 * MIDI tempo change
 */
export interface MIDITempoChange {
  time: number; // ticks
  tempo: number; // BPM
  microsecondsPerQuarter: number;
}

/**
 * MIDI time signature change
 */
export interface MIDITimeSignatureChange {
  time: number; // ticks
  numerator: number;
  denominator: number;
  clocksPerClick: number;
  notesPerQuarter: number;
}

/**
 * MIDI key signature change
 */
export interface MIDIKeySignatureChange {
  time: number; // ticks
  key: string;
  sharpsFlats: number; // -7 to 7
  major: boolean;
}

// ============================================================================
// Version Control Interfaces
// ============================================================================

/**
 * MIDI version control configuration
 */
export interface MIDIVersionControlConfig {
  enabled: boolean;
  maxVersionsPerFile: number;
  versionRetentionDays: number;
  automaticVersioning: boolean;

  // Diff and merge settings
  enableDiffTracking: boolean;
  diffAlgorithm: 'binary' | 'musical' | 'track_based' | 'event_based';

  // Branching and merging
  enableBranching: boolean;
  mergeStrategy: 'automatic' | 'manual' | 'intelligent';
  conflictResolution: MIDIConflictResolutionStrategy;

  // Rollback settings
  enableRollback: boolean;
  rollbackGracePeriod: number; // ms

  // Backup and archival
  enableBackup: boolean;
  backupStrategy: 'incremental' | 'full' | 'differential';
}

/**
 * MIDI version info
 */
export interface MIDIVersionInfo {
  versionId: string;
  versionNumber: string;
  parentVersionId?: string;
  branchName?: string;

  // Metadata
  createdAt: number;
  createdBy: string;
  commitMessage: string;
  tags: string[];

  // Changes
  changes: MIDIVersionChange[];
  diffSummary: MIDIVersionDiff;

  // File properties
  size: number;
  checksum: string;

  // Status
  isActive: boolean;
  isSnapshot: boolean;
  isMerged: boolean;
}

/**
 * MIDI version change
 */
export interface MIDIVersionChange {
  changeId: string;
  type:
    | 'track_added'
    | 'track_removed'
    | 'track_modified'
    | 'event_added'
    | 'event_removed'
    | 'event_modified'
    | 'metadata_changed';
  trackId?: string;
  eventId?: string;

  // Change details
  oldValue?: unknown;
  newValue?: unknown;
  description: string;
  impact: 'minor' | 'major' | 'breaking';

  // Musical impact
  musicalImpact: MIDIMusicalImpact;

  // Timestamp
  timestamp: number;
  author: string;
}

/**
 * MIDI musical impact
 */
export interface MIDIMusicalImpact {
  affects: string[]; // tracks, harmony, rhythm, etc.
  severity: 'cosmetic' | 'minor' | 'significant' | 'major';
  category: 'performance' | 'arrangement' | 'composition' | 'technical';
  description: string;
}

/**
 * MIDI version diff
 */
export interface MIDIVersionDiff {
  fromVersion: string;
  toVersion: string;
  diffType: 'track_based' | 'event_based' | 'musical';

  // Statistics
  tracksAdded: number;
  tracksRemoved: number;
  tracksModified: number;
  eventsAdded: number;
  eventsRemoved: number;
  eventsModified: number;

  // Musical changes
  tempoChanges: number;
  keyChanges: number;
  instrumentChanges: number;

  // Similarity metrics
  similarity: number; // 0-1
  musicalSimilarity: number; // 0-1
  structuralSimilarity: number; // 0-1

  // Generation metadata
  generatedAt: number;
  algorithm: string;
  processingTime: number; // ms
}

// ============================================================================
// Collaborative Editing Interfaces
// ============================================================================

/**
 * MIDI collaborative configuration
 */
export interface MIDICollaborativeConfig {
  enabled: boolean;
  maxCollaborators: number;

  // Real-time features
  enableRealTimeEditing: boolean;
  enablePresenceIndicators: boolean;
  enableCursorSharing: boolean;

  // Locking and conflict prevention
  enableTrackLocking: boolean;
  lockTimeout: number; // ms
  enableConflictPrevention: boolean;

  // Change tracking
  enableChangeTracking: boolean;
  changeTrackingInterval: number; // ms

  // Permissions
  enablePermissions: boolean;
  permissionLevels: MIDIPermissionLevel[];

  // Communication
  enableChat: boolean;
  enableComments: boolean;
  enableAnnotations: boolean;

  // Synchronization
  syncInterval: number; // ms
  conflictDetectionEnabled: boolean;
  autoSaveInterval: number; // ms
}

/**
 * MIDI collaborator
 */
export interface MIDICollaborator {
  userId: string;
  username: string;
  displayName: string;

  // Permissions
  permissions: MIDIPermissionLevel[];
  canEdit: boolean;
  canComment: boolean;
  canManageVersions: boolean;

  // Status
  isOnline: boolean;
  isActive: boolean;
  lastActivity: number;
  currentTrack?: string;

  // Contribution tracking
  contributions: MIDIContribution[];
  totalEdits: number;
  joinedAt: number;

  // Preferences
  preferences: MIDICollaboratorPreferences;
}

/**
 * MIDI contribution
 */
export interface MIDIContribution {
  contributionId: string;
  type: 'edit' | 'comment' | 'version' | 'review';
  trackId?: string;
  timestamp: number;
  description: string;
  impact: 'minor' | 'major';
}

/**
 * MIDI collaborator preferences
 */
export interface MIDICollaboratorPreferences {
  notificationsEnabled: boolean;
  showPresenceIndicators: boolean;
  autoSave: boolean;
  preferredView: 'track' | 'piano_roll' | 'score';
  colorScheme: string;
}

// ============================================================================
// Real-Time Synchronization Interfaces
// ============================================================================

/**
 * MIDI real-time sync configuration
 */
export interface MIDIRealTimeSyncConfig {
  enabled: boolean;

  // Connection settings
  connectionType: 'websocket' | 'webrtc' | 'polling';
  reconnectEnabled: boolean;
  reconnectInterval: number; // ms
  maxReconnectAttempts: number;

  // Synchronization strategy
  syncStrategy:
    | 'operational_transform'
    | 'conflict_free_replicated_data_type'
    | 'event_sourcing';

  // Performance settings
  batchUpdates: boolean;
  batchInterval: number; // ms
  maxBatchSize: number;

  // Conflict resolution
  enableConflictResolution: boolean;
  conflictResolutionTimeout: number; // ms

  // Change detection
  changeDetectionInterval: number; // ms
  enableChangeOptimization: boolean;

  // State management
  enableStateSnapshots: boolean;
  snapshotInterval: number; // ms
  maxStateHistory: number;
}

/**
 * MIDI realtime update
 */
export interface MIDIRealtimeUpdate {
  updateId: string;
  type: MIDIUpdateType;

  // Source information
  userId: string;
  trackId?: string;
  timestamp: number;

  // Update data
  operation: MIDIOperation;
  data: unknown;

  // Synchronization metadata
  sequenceNumber: number;
  dependencies: string[];

  // Conflict resolution
  priority: number;
  conflictStrategy?: MIDIConflictResolutionStrategy;
}

/**
 * MIDI operation
 */
export interface MIDIOperation {
  operationType: 'insert' | 'delete' | 'update' | 'move';
  target: string; // track, event, etc.
  position?: number;
  length?: number;
  content?: unknown;
  attributes?: Record<string, unknown>;
}

// ============================================================================
// Metadata Processing Interfaces
// ============================================================================

/**
 * MIDI metadata processing configuration
 */
export interface MIDIMetadataProcessingConfig {
  enabled: boolean;

  // Analysis settings
  enableMusicalAnalysis: boolean;
  enableComplexityAnalysis: boolean;
  enableHarmonicAnalysis: boolean;
  enableRhythmicAnalysis: boolean;

  // Auto-categorization
  enableAutoCategorization: boolean;
  categorizationModel: 'rule_based' | 'ml_based' | 'hybrid';

  // Tagging
  enableAutoTagging: boolean;
  taggingStrategies: MIDITaggingStrategy[];

  // Validation
  enableValidation: boolean;
  validationRules: MIDIValidationRule[];

  // Enrichment
  enableEnrichment: boolean;
  enrichmentSources: string[];

  // Performance
  processingTimeout: number; // ms
  enableBackgroundProcessing: boolean;
  batchProcessing: boolean;
  batchSize: number;
}

/**
 * MIDI validation rule
 */
export interface MIDIValidationRule {
  ruleId: string;
  name: string;
  description: string;

  // Rule definition
  category: 'format' | 'musical' | 'technical' | 'metadata';
  severity: 'error' | 'warning' | 'info';

  // Validation logic
  condition: string;
  validator: (midi: MIDIMetadata) => MIDIValidationResult;

  // Configuration
  enabled: boolean;
  autoFix: boolean;
  priority: number;
}

/**
 * MIDI validation result
 */
export interface MIDIValidationResult {
  passed: boolean;
  messages: MIDIValidationMessage[];
  autoFixApplied: boolean;
  suggestions: string[];
}

/**
 * MIDI validation message
 */
export interface MIDIValidationMessage {
  level: 'error' | 'warning' | 'info';
  message: string;
  location?: string; // track, measure, etc.
  code?: string;
}

// ============================================================================
// Analytics Interfaces
// ============================================================================

/**
 * MIDI analytics configuration
 */
export interface MIDIAnalyticsConfig {
  enabled: boolean;

  // Data collection
  trackUsage: boolean;
  trackCollaboration: boolean;
  trackPerformance: boolean;
  trackComplexity: boolean;

  // Complexity analysis
  enableComplexityAnalysis: boolean;
  complexityMetrics: MIDIComplexityMetric[];

  // Usage analytics
  enableUsageAnalytics: boolean;
  usageTrackingInterval: number; // ms

  // Performance monitoring
  enablePerformanceMonitoring: boolean;
  performanceThresholds: MIDIPerformanceThresholds;

  // Optimization recommendations
  enableOptimizationSuggestions: boolean;
  suggestionCategories: MIDIOptimizationCategory[];

  // Reporting
  enableReporting: boolean;
  reportingInterval: number; // ms
  reportRetentionPeriod: number; // ms

  // Alerts
  enableAlerts: boolean;
  alertThresholds: MIDIAlertThresholds;
}

/**
 * MIDI performance thresholds
 */
export interface MIDIPerformanceThresholds {
  maxLoadTime: number; // ms
  maxProcessingTime: number; // ms
  maxMemoryUsage: number; // bytes
  maxFileSize: number; // bytes

  // Musical thresholds
  maxComplexity: number; // 0-1
  maxTracks: number;
  maxEvents: number;
  maxDuration: number; // seconds
}

/**
 * MIDI alert thresholds
 */
export interface MIDIAlertThresholds {
  complexityThreshold: number; // 0-1
  performanceDegradation: number; // 0-1
  errorRateIncrease: number; // 0-1
  collaborationConflicts: number; // conflicts per hour
  unusualUsagePatterns: number; // 0-1
}

/**
 * MIDI analytics data
 */
export interface MIDIAnalyticsData {
  midiId: string;
  timestamp: number;

  // Usage metrics
  usageMetrics: MIDIUsageMetrics;

  // Complexity metrics
  complexityMetrics: MIDIComplexityMetrics;

  // Performance metrics
  performanceMetrics: MIDIPerformanceMetrics;

  // Collaboration metrics
  collaborationMetrics: MIDICollaborationMetrics;

  // Quality metrics
  qualityMetrics: MIDIQualityMetrics;
}

/**
 * MIDI usage metrics
 */
export interface MIDIUsageMetrics {
  totalPlays: number;
  totalDuration: number; // total playback time in seconds
  averagePlayDuration: number;
  completionRate: number; // 0-1
  skipRate: number; // 0-1
  repeatRate: number; // 0-1

  // User engagement
  uniqueUsers: number;
  sessionsWithMIDI: number;
  averageSessionDuration: number;

  // Popularity
  popularityScore: number; // 0-1
  popularityRank: number;
  trendingScore: number; // 0-1

  // Temporal patterns
  peakUsageTime: number; // hour of day
  usageFrequency: number; // plays per day
  seasonalVariation: number; // 0-1
}

/**
 * MIDI complexity metrics
 */
export interface MIDIComplexityMetrics {
  overallComplexity: number; // 0-1
  harmonicComplexity: number; // 0-1
  rhythmicComplexity: number; // 0-1
  melodicComplexity: number; // 0-1
  polyphonicComplexity: number; // 0-1
  temporalComplexity: number; // 0-1
  structuralComplexity: number; // 0-1

  // Computed metrics
  complexityTrend: 'increasing' | 'stable' | 'decreasing';
  complexityDistribution: number[]; // per track
  complexityFactors: MIDIComplexityFactor[];

  // Comparisons
  relativeComplexity: number; // compared to similar files
  complexityPercentile: number; // 0-100
  difficultyRating: string;
}

/**
 * MIDI performance metrics
 */
export interface MIDIPerformanceMetrics {
  loadTime: number; // ms
  processingTime: number; // ms
  renderTime: number; // ms
  memoryUsage: number; // bytes

  // File metrics
  fileSize: number; // bytes
  compressionRatio: number;
  optimizationLevel: number; // 0-1

  // Playback metrics
  audioLatency: number; // ms
  midiLatency: number; // ms
  bufferUnderruns: number;
  dropouts: number;

  // Efficiency metrics
  cpuUsage: number; // 0-1
  gpuUsage: number; // 0-1
  networkUsage: number; // bytes/sec
  storageIops: number;

  // Error metrics
  errorRate: number; // 0-1
  warningCount: number;
  successRate: number; // 0-1
}

/**
 * MIDI collaboration metrics
 */
export interface MIDICollaborationMetrics {
  totalCollaborators: number;
  activeCollaborators: number;
  totalEdits: number;
  conflictCount: number;
  conflictResolutionTime: number; // average ms

  // Collaboration patterns
  editDistribution: Record<string, number>; // user -> edit count
  collaborationEfficiency: number; // 0-1
  communicationVolume: number;

  // Version control metrics
  totalVersions: number;
  branchCount: number;
  mergeCount: number;
  rollbackCount: number;

  // Real-time metrics
  simultaneousEditors: number;
  averageResponseTime: number; // ms
  syncSuccessRate: number; // 0-1

  // Quality metrics
  codeReviewCoverage: number; // 0-1
  approvalRate: number; // 0-1
  collaboratorSatisfaction: number; // 0-1
}

/**
 * MIDI quality metrics
 */
export interface MIDIQualityMetrics {
  musicalQuality: number; // 0-1
  technicalQuality: number; // 0-1
  structuralQuality: number; // 0-1

  // Validation results
  validationScore: number; // 0-1
  errorCount: number;
  warningCount: number;
  ruleCompliance: number; // 0-1

  // Musical coherence
  harmonicCoherence: number; // 0-1
  rhythmicCoherence: number; // 0-1
  melodicCoherence: number; // 0-1
  structuralCoherence: number; // 0-1

  // User feedback
  userRating: number; // 0-5
  ratingCount: number;
  feedbackScore: number; // 0-1

  // Automated assessment
  aiQualityScore: number; // 0-1
  professionalScore: number; // 0-1
  educationalValue: number; // 0-1
}

// ============================================================================
// Operation Result Interfaces
// ============================================================================

/**
 * MIDI orchestrator operation result
 */
export interface MIDIOperationResult {
  success: boolean;
  midiId: string;
  operation:
    | 'load'
    | 'save'
    | 'delete'
    | 'analyze'
    | 'version'
    | 'merge'
    | 'sync';

  // Result data
  data?: MIDIMetadata | MIDIAnalyticsData | MIDIVersionInfo;
  metadata?: MIDIMetadata;

  // Performance information
  duration: number; // ms
  size?: number; // bytes
  source: 'cache' | 'storage' | 'cdn' | 'collaboration';

  // Quality information
  qualityScore?: number; // 0-1
  validationResults?: MIDIValidationResult[];

  // Collaboration information
  collaborators?: string[];
  conflicts?: MIDIConflictInfo[];

  // Error information
  error?: Error;
  errorCode?: string;
  errorMessage?: string;
  warnings?: string[];

  // Additional metadata
  timestamp: number;
  userId?: string;
  sessionId?: string;
  context?: Record<string, unknown>;
}

/**
 * MIDI conflict info
 */
export interface MIDIConflictInfo {
  conflictId: string;
  type: 'track' | 'event' | 'metadata' | 'version';
  trackId?: string;
  eventId?: string;

  // Conflict details
  conflictingUsers: string[];
  conflictData: unknown;
  resolution?: 'automatic' | 'manual' | 'pending';

  // Timing
  detectedAt: number;
  resolvedAt?: number;

  // Impact
  severity: 'low' | 'medium' | 'high' | 'critical';
  impact: string;

  // Resolution
  resolutionStrategy?: MIDIConflictResolutionStrategy;
  resolutionData?: unknown;
}
