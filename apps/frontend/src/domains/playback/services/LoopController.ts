/**
 * LoopController - Advanced Section Looping System
 *
 * Provides sophisticated loop management with seamless crossfades, intelligent boundary
 * detection, nested loops, practice progression tracking, and auto-punch recording.
 *
 * Aligned with Epic 2 architecture and integrated with PrecisionSynchronizationEngine
 * for microsecond-level timing accuracy.
 *
 * Part of Story 2.3: Real-time Playback Controls & Advanced Manipulation
 * Task 8: Develop Advanced Section Looping Core
 */

import { CorePlaybackEngine } from './CorePlaybackEngine.js';
import { PrecisionSynchronizationEngine } from './PrecisionSynchronizationEngine.js';
import { AnalyticsEngine } from './AnalyticsEngine.js';
import { ComprehensiveStateManager } from './ComprehensiveStateManager.js';
import { MixingConsole } from './MixingConsole.js';
import { AudioContextManager } from './AudioContextManager.js';

// ===============================
// Core Types and Interfaces
// ===============================

export type LoopState =
  | 'inactive'
  | 'setting'
  | 'active'
  | 'crossfading'
  | 'paused'
  | 'recording';

export type CrossfadeType = 'linear' | 'exponential' | 'equal-power' | 'custom';

export type BoundaryDetectionMode =
  | 'manual'
  | 'beat-aligned'
  | 'bar-aligned'
  | 'phrase-aligned'
  | 'intelligent';

export type LoopMasteryLevel =
  | 'learning'
  | 'practicing'
  | 'improving'
  | 'proficient'
  | 'mastered';

export type RecordingMode =
  | 'disabled'
  | 'auto-punch'
  | 'continuous'
  | 'overdub';

export interface MusicalTime {
  bars: number;
  beats: number;
  subdivisions: number;
  totalBeats: number;
  absoluteTime: number; // seconds
  transportTime: number; // Tone.js transport time
}

export interface LoopBoundary {
  start: MusicalTime;
  end: MusicalTime;
  confidence: number; // 0-1 confidence in boundary detection
  musicalStructure: {
    phraseType:
      | 'verse'
      | 'chorus'
      | 'bridge'
      | 'intro'
      | 'outro'
      | 'solo'
      | 'break';
    harmonicMovement: string[];
    rhythmicPattern: string;
    intensity: number; // 0-1
  };
}

export interface CrossfadeConfiguration {
  type: CrossfadeType;
  duration: number; // seconds
  curve: Float32Array; // Custom crossfade curve
  preRoll: number; // seconds before loop end to start crossfade
  postRoll: number; // seconds after loop start to complete crossfade
}

export interface LoopRegion {
  id: string;
  name: string;
  boundary: LoopBoundary;
  crossfade: CrossfadeConfiguration;
  state: LoopState;
  enabled: boolean;

  // Hierarchy support
  parentLoopId?: string;
  childLoopIds: string[];
  nestingLevel: number; // 0 = root level

  // Practice tracking
  practiceData: LoopPracticeData;

  // Recording support
  recordingConfig: LoopRecordingConfig;
  recordedData?: AudioBuffer[];

  // Metadata
  createdAt: number;
  lastModified: number;
  tags: string[];
  notes: string;
}

export interface LoopPracticeData {
  totalPlaythroughs: number;
  successfulPlaythroughs: number;
  averageAccuracy: number; // 0-1
  bestAccuracy: number; // 0-1
  practiceTime: number; // seconds
  masteryLevel: LoopMasteryLevel;
  mistakePatterns: MistakePattern[];
  progressionHistory: ProgressionEntry[];
  tempoProgression: TempoProgressionData;
}

export interface MistakePattern {
  location: MusicalTime;
  type: 'timing' | 'pitch' | 'rhythm' | 'technique';
  frequency: number; // occurrences per 100 playthroughs
  severity: 'minor' | 'moderate' | 'major';
  improvement: number; // trend: -1 (worsening) to 1 (improving)
}

export interface ProgressionEntry {
  timestamp: number;
  masteryLevel: LoopMasteryLevel;
  accuracy: number;
  tempo: number;
  confidence: number;
  notes: string;
}

export interface TempoProgressionData {
  startTempo: number;
  currentTempo: number;
  targetTempo: number;
  progressionStrategy: 'gradual' | 'step' | 'adaptive';
  incrementSize: number; // BPM per advancement
  masteryThreshold: number; // accuracy required to advance
}

export interface LoopRecordingConfig {
  mode: RecordingMode;
  inputSource: 'microphone' | 'line-in' | 'virtual';
  quality: {
    sampleRate: number;
    bitDepth: number;
    channels: number;
  };
  punchConfig: {
    preRoll: number; // seconds before loop to start monitoring
    postRoll: number; // seconds after loop to keep recording
    threshold: number; // amplitude threshold to trigger recording
    sensitivity: number; // 0-1 sensitivity
  };
  overdubConfig: {
    enabled: boolean;
    mixLevel: number; // 0-1 mix with existing recording
    fadeIn: number; // seconds
    fadeOut: number; // seconds
  };
}

export interface LoopAnalysis {
  musicalStructure: {
    keySignature: string;
    timeSignature: string;
    harmonicComplexity: number; // 0-1
    rhythmicComplexity: number; // 0-1
    phraseStructure: string[];
  };
  difficulty: {
    technical: number; // 0-1
    musical: number; // 0-1
    overall: number; // 0-1
    factors: string[];
  };
  recommendations: {
    practiceApproach: string;
    tempoProgression: TempoProgressionData;
    focusAreas: string[];
    estimatedMasteryTime: number; // hours
  };
}

export interface LoopControllerConfig {
  // Crossfade settings
  defaultCrossfadeDuration: number; // seconds
  defaultCrossfadeType: CrossfadeType;
  adaptiveCrossfading: boolean;

  // Boundary detection
  boundaryDetectionMode: BoundaryDetectionMode;
  intelligentDetectionSensitivity: number; // 0-1
  beatAlignmentPrecision: number; // subdivision precision

  // Practice progression
  enableProgressionTracking: boolean;
  masteryThresholds: {
    learning: number; // accuracy threshold
    practicing: number;
    improving: number;
    proficient: number;
    mastered: number;
  };

  // Recording settings
  recordingEnabled: boolean;
  defaultRecordingMode: RecordingMode;
  autoSaveRecordings: boolean;
  maxRecordingDuration: number; // seconds

  // Performance settings
  maxNestedLoops: number;
  maxActiveLoops: number;
  lookaheadTime: number; // seconds for predictive processing

  // Audio processing
  highQualityMode: boolean;
  realtimeProcessing: boolean;
  bufferSize: number;
}

export interface LoopControllerEvents {
  // Loop lifecycle events
  loopCreated: (loop: LoopRegion) => void;
  loopDeleted: (loopId: string) => void;
  loopStateChanged: (
    loopId: string,
    oldState: LoopState,
    newState: LoopState,
  ) => void;

  // Playback events
  loopStarted: (loopId: string, iteration: number) => void;
  loopEnded: (loopId: string, iteration: number) => void;
  crossfadeStarted: (loopId: string, crossfadeType: CrossfadeType) => void;
  crossfadeCompleted: (loopId: string) => void;

  // Practice progression events
  masteryLevelChanged: (
    loopId: string,
    oldLevel: LoopMasteryLevel,
    newLevel: LoopMasteryLevel,
  ) => void;
  practiceGoalAchieved: (
    loopId: string,
    goal: string,
    achievement: any,
  ) => void;
  mistakePatternDetected: (loopId: string, pattern: MistakePattern) => void;

  // Recording events
  recordingStarted: (loopId: string, mode: RecordingMode) => void;
  recordingCompleted: (
    loopId: string,
    duration: number,
    quality: number,
  ) => void;
  recordingFailed: (loopId: string, error: Error) => void;

  // Boundary detection events
  boundaryDetected: (boundary: LoopBoundary, confidence: number) => void;
  boundaryRefined: (
    loopId: string,
    oldBoundary: LoopBoundary,
    newBoundary: LoopBoundary,
  ) => void;

  // System events
  configurationChanged: (newConfig: LoopControllerConfig) => void;
  performanceAlert: (alert: {
    type: string;
    message: string;
    severity: 'warning' | 'critical';
  }) => void;
  analysisCompleted: (loopId: string, analysis: LoopAnalysis) => void;
}

// ===============================
// Main LoopController Class
// ===============================

export class LoopController {
  private static instance: LoopController;

  // Core dependencies
  private coreEngine: CorePlaybackEngine;
  private syncEngine: PrecisionSynchronizationEngine;
  private analyticsEngine: AnalyticsEngine;
  private stateManager: ComprehensiveStateManager;
  private mixingConsole: MixingConsole;
  private audioContextManager: AudioContextManager;

  // Audio processing components
  private audioContext!: AudioContext;
  private crossfadeProcessor!: CrossfadeProcessor;
  private boundaryDetector!: MusicalBoundaryDetector;
  private progressionTracker!: LoopProgressionTracker;
  private recordingEngine!: AutoPunchRecordingEngine;
  private analysisEngine!: LoopAnalysisEngine;

  // State management
  private loops: Map<string, LoopRegion> = new Map();
  private activeLoops: Set<string> = new Set();
  private currentLoop: string | null = null;
  private isInitialized = false;
  private config: LoopControllerConfig;

  // Event handling
  private eventHandlers: Map<
    keyof LoopControllerEvents,
    Set<(...args: any[]) => void>
  > = new Map();

  // Performance monitoring
  private performanceMetrics = {
    totalLoopsCreated: 0,
    totalPlaythroughs: 0,
    averageCrossfadeTime: 0,
    boundaryDetectionAccuracy: 0,
    systemLatency: 0,
    lastMeasurement: 0,
  };

  private constructor() {
    this.coreEngine = CorePlaybackEngine.getInstance();
    this.syncEngine = PrecisionSynchronizationEngine.getInstance();
    this.analyticsEngine = new AnalyticsEngine();
    this.stateManager = ComprehensiveStateManager.getInstance();
    this.mixingConsole = MixingConsole.getInstance();
    this.audioContextManager = AudioContextManager.getInstance();

    this.config = {
      defaultCrossfadeDuration: 0.1, // 100ms
      defaultCrossfadeType: 'equal-power',
      adaptiveCrossfading: true,
      boundaryDetectionMode: 'intelligent',
      intelligentDetectionSensitivity: 0.7,
      beatAlignmentPrecision: 16, // 16th note precision
      enableProgressionTracking: true,
      masteryThresholds: {
        learning: 0.6,
        practicing: 0.7,
        improving: 0.8,
        proficient: 0.9,
        mastered: 0.95,
      },
      recordingEnabled: true,
      defaultRecordingMode: 'auto-punch',
      autoSaveRecordings: true,
      maxRecordingDuration: 300, // 5 minutes
      maxNestedLoops: 5,
      maxActiveLoops: 3,
      lookaheadTime: 0.2, // 200ms
      highQualityMode: true,
      realtimeProcessing: true,
      bufferSize: 512,
    };

    this.setupEventHandlers();
  }

  public static getInstance(): LoopController {
    if (!LoopController.instance) {
      LoopController.instance = new LoopController();
    }
    return LoopController.instance;
  }

  // ===============================
  // Initialization and Setup
  // ===============================

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Ensure core dependencies are initialized
      await this.coreEngine.initialize();
      await this.syncEngine.initialize(this.audioContextManager.getContext());

      // Get audio context
      this.audioContext = this.audioContextManager.getContext();

      // Initialize audio processing components
      this.crossfadeProcessor = new CrossfadeProcessor(
        this.audioContext,
        this.config,
      );
      this.boundaryDetector = new MusicalBoundaryDetector(
        this.syncEngine,
        this.config,
      );
      this.progressionTracker = new LoopProgressionTracker(this.config);
      this.recordingEngine = new AutoPunchRecordingEngine(
        this.audioContext,
        this.config,
      );
      this.analysisEngine = new LoopAnalysisEngine(
        this.syncEngine,
        this.analyticsEngine,
      );

      // Initialize components
      await Promise.all([
        this.crossfadeProcessor.initialize(),
        this.boundaryDetector.initialize(),
        this.progressionTracker.initialize(),
        this.recordingEngine.initialize(),
        this.analysisEngine.initialize(),
      ]);

      // Set up synchronization with core systems
      this.setupCoreSynchronization();

      // Set up analytics integration
      this.setupAnalyticsIntegration();

      // Set up state management integration
      this.setupStateManagementIntegration();

      this.isInitialized = true;

      console.log('LoopController initialized successfully');
    } catch (error) {
      console.error('Failed to initialize LoopController:', error);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    // Initialize event handler maps
    Object.keys({} as LoopControllerEvents).forEach((event) => {
      this.eventHandlers.set(event as keyof LoopControllerEvents, new Set());
    });
  }

  private setupCoreSynchronization(): void {
    // Synchronize with transport events
    this.syncEngine.on('positionChange', (position) => {
      this.handleTransportPositionChange(position);
    });

    this.syncEngine.on('tempoChange', (tempo) => {
      this.handleTempoChange(tempo);
    });

    // Synchronize with playback state changes
    this.coreEngine.on('stateChange', (state) => {
      this.handlePlaybackStateChange(state);
    });
  }

  private setupAnalyticsIntegration(): void {
    // Track loop interactions
    this.analyticsEngine.trackControlUsage('loop_controller_initialized', {
      timestamp: Date.now(),
      config: this.config,
    });
  }

  private setupStateManagementIntegration(): void {
    // Register with state manager for persistence
    // TODO: Implement registerComponent method in ComprehensiveStateManager
    // this.stateManager.registerComponent('loopController', {
    //   getState: () => this.getCurrentState(),
    //   setState: (state: any) => this.restoreState(state),
    //   validateState: (state: any) => this.validateState(state),
    // });
  }

  // ===============================
  // Loop Management Core Methods
  // ===============================

  public async createLoop(
    startTime: MusicalTime,
    endTime: MusicalTime,
    options: Partial<{
      name: string;
      crossfadeType: CrossfadeType;
      crossfadeDuration: number;
      boundaryDetectionMode: BoundaryDetectionMode;
      enableProgression: boolean;
      parentLoopId: string;
    }> = {},
  ): Promise<LoopRegion> {
    this.ensureInitialized();

    const startTimestamp = performance.now();

    try {
      // Validate loop boundaries
      this.validateLoopBoundaries(startTime, endTime);

      // Check nesting limits
      const nestingLevel = options.parentLoopId
        ? this.calculateNestingLevel(options.parentLoopId) + 1
        : 0;

      if (nestingLevel >= this.config.maxNestedLoops) {
        throw new Error(
          `Maximum nesting level (${this.config.maxNestedLoops}) exceeded`,
        );
      }

      // Generate unique loop ID
      const loopId = this.generateLoopId();

      // Detect or refine boundaries if intelligent detection is enabled
      let refinedBoundary: LoopBoundary;
      if (
        options.boundaryDetectionMode === 'intelligent' ||
        (options.boundaryDetectionMode === undefined &&
          this.config.boundaryDetectionMode === 'intelligent')
      ) {
        refinedBoundary = await this.boundaryDetector.refineBoundaries({
          start: startTime,
          end: endTime,
          confidence: 0.5,
          musicalStructure: {
            phraseType: 'verse',
            harmonicMovement: [],
            rhythmicPattern: '',
            intensity: 0.5,
          },
        });
      } else {
        refinedBoundary = {
          start: startTime,
          end: endTime,
          confidence: 1.0,
          musicalStructure: {
            phraseType: 'verse',
            harmonicMovement: [],
            rhythmicPattern: '',
            intensity: 0.5,
          },
        };
      }

      // Create crossfade configuration
      const crossfadeConfig: CrossfadeConfiguration = {
        type: options.crossfadeType || this.config.defaultCrossfadeType,
        duration:
          options.crossfadeDuration || this.config.defaultCrossfadeDuration,
        curve: this.crossfadeProcessor.generateCurve(
          options.crossfadeType || this.config.defaultCrossfadeType,
          options.crossfadeDuration || this.config.defaultCrossfadeDuration,
        ),
        preRoll:
          (options.crossfadeDuration || this.config.defaultCrossfadeDuration) *
          0.5,
        postRoll:
          (options.crossfadeDuration || this.config.defaultCrossfadeDuration) *
          0.5,
      };

      // Initialize practice data
      const practiceData: LoopPracticeData = {
        totalPlaythroughs: 0,
        successfulPlaythroughs: 0,
        averageAccuracy: 0,
        bestAccuracy: 0,
        practiceTime: 0,
        masteryLevel: 'learning',
        mistakePatterns: [],
        progressionHistory: [],
        tempoProgression: {
          startTempo: 120, // Default tempo
          currentTempo: 120, // Default tempo
          targetTempo: 144, // 20% faster
          progressionStrategy: 'gradual',
          incrementSize: 5, // 5 BPM increments
          masteryThreshold: 0.7, // Default practicing threshold
        },
      };

      // Initialize recording configuration
      const recordingConfig: LoopRecordingConfig = {
        mode: this.config.defaultRecordingMode,
        inputSource: 'microphone',
        quality: {
          sampleRate: this.audioContext.sampleRate,
          bitDepth: 24,
          channels: 1,
        },
        punchConfig: {
          preRoll: 1.0,
          postRoll: 0.5,
          threshold: 0.01,
          sensitivity: 0.7,
        },
        overdubConfig: {
          enabled: false,
          mixLevel: 0.5,
          fadeIn: 0.1,
          fadeOut: 0.1,
        },
      };

      // Create loop region
      const loop: LoopRegion = {
        id: loopId,
        name: options.name || `Loop ${this.loops.size + 1}`,
        boundary: refinedBoundary,
        crossfade: crossfadeConfig,
        state: 'inactive',
        enabled: true,
        parentLoopId: options.parentLoopId,
        childLoopIds: [],
        nestingLevel,
        practiceData,
        recordingConfig,
        createdAt: Date.now(),
        lastModified: Date.now(),
        tags: [],
        notes: '',
      };

      // Add to parent's children if nested
      if (options.parentLoopId) {
        const parentLoop = this.loops.get(options.parentLoopId);
        if (parentLoop) {
          parentLoop.childLoopIds.push(loopId);
          parentLoop.lastModified = Date.now();
        }
      }

      // Store loop
      this.loops.set(loopId, loop);

      // Perform initial analysis
      if (options.enableProgression !== false) {
        this.analysisEngine
          .analyzeLoop(loop)
          .then((analysis) => {
            this.emit('analysisCompleted', loopId, analysis);
          })
          .catch((error) => {
            console.warn('Loop analysis failed:', error);
          });
      }

      // Update performance metrics
      this.performanceMetrics.totalLoopsCreated++;
      this.performanceMetrics.lastMeasurement = Date.now();

      // Track analytics
      this.analyticsEngine.trackControlUsage('loop_created', {
        loopId,
        duration: endTime.absoluteTime - startTime.absoluteTime,
        nestingLevel,
        creationTime: performance.now() - startTimestamp,
      });

      // Emit event
      this.emit('loopCreated', loop);

      console.log(`Loop created: ${loopId} (${loop.name})`);
      return loop;
    } catch (error) {
      console.error('Failed to create loop:', error);
      throw error;
    }
  }

  public async enableLoop(loopId: string): Promise<void> {
    this.ensureInitialized();

    const loop = this.loops.get(loopId);
    if (!loop) {
      throw new Error(`Loop not found: ${loopId}`);
    }

    if (loop.state === 'active') {
      return; // Already active
    }

    // Check maximum active loops limit
    if (this.activeLoops.size >= this.config.maxActiveLoops) {
      throw new Error(
        `Maximum active loops (${this.config.maxActiveLoops}) limit reached`,
      );
    }

    const oldState = loop.state;

    try {
      // Prepare crossfade processor for this loop
      await this.crossfadeProcessor.prepareLoop(loop);

      // Set up boundary monitoring
      this.boundaryDetector.startMonitoring(loop);

      // Enable recording if configured
      if (loop.recordingConfig.mode !== 'disabled') {
        await this.recordingEngine.prepareLoop(loop);
      }

      // Update state
      loop.state = 'active';
      loop.lastModified = Date.now();
      this.activeLoops.add(loopId);

      // Set as current loop if none is set
      if (!this.currentLoop) {
        this.currentLoop = loopId;
      }

      // Track analytics
      this.analyticsEngine.trackControlUsage('loop_enabled', {
        loopId,
        previousState: oldState,
        activeLoopsCount: this.activeLoops.size,
      });

      // Emit events
      this.emit('loopStateChanged', loopId, oldState, 'active');

      console.log(`Loop enabled: ${loopId}`);
    } catch (error) {
      // Rollback on failure
      loop.state = oldState;
      console.error('Failed to enable loop:', error);
      throw error;
    }
  }

  public async disableLoop(loopId: string): Promise<void> {
    this.ensureInitialized();

    const loop = this.loops.get(loopId);
    if (!loop) {
      throw new Error(`Loop not found: ${loopId}`);
    }

    if (loop.state === 'inactive') {
      return; // Already inactive
    }

    const oldState = loop.state;

    try {
      // Stop any active crossfading
      if (loop.state === 'crossfading') {
        await this.crossfadeProcessor.cancelCrossfade(loopId);
      }

      // Stop boundary monitoring
      this.boundaryDetector.stopMonitoring(loopId);

      // Stop recording if active
      if (loop.state === 'recording') {
        await this.recordingEngine.stopRecording(loopId);
      }

      // Clean up crossfade processor resources
      this.crossfadeProcessor.cleanupLoop(loopId);

      // Update state
      loop.state = 'inactive';
      loop.lastModified = Date.now();
      this.activeLoops.delete(loopId);

      // Update current loop if this was it
      if (this.currentLoop === loopId) {
        this.currentLoop =
          this.activeLoops.size > 0
            ? Array.from(this.activeLoops)[0] || null
            : null;
      }

      // Track analytics
      this.analyticsEngine.trackControlUsage('loop_disabled', {
        loopId,
        previousState: oldState,
        activeLoopsCount: this.activeLoops.size,
      });

      // Emit events
      this.emit('loopStateChanged', loopId, oldState, 'inactive');

      console.log(`Loop disabled: ${loopId}`);
    } catch (error) {
      console.error('Failed to disable loop:', error);
      throw error;
    }
  }

  // ===============================
  // Utility and Helper Methods
  // ===============================

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error(
        'LoopController not initialized. Call initialize() first.',
      );
    }
  }

  private validateLoopBoundaries(start: MusicalTime, end: MusicalTime): void {
    if (start.absoluteTime >= end.absoluteTime) {
      throw new Error('Loop start time must be before end time');
    }

    if (end.absoluteTime - start.absoluteTime < 0.1) {
      throw new Error('Loop duration must be at least 100ms');
    }

    if (end.absoluteTime - start.absoluteTime > 300) {
      throw new Error('Loop duration cannot exceed 5 minutes');
    }
  }

  private calculateNestingLevel(parentLoopId: string): number {
    const parentLoop = this.loops.get(parentLoopId);
    if (!parentLoop) {
      return 0;
    }
    return parentLoop.nestingLevel;
  }

  private generateLoopId(): string {
    return `loop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private handleTransportPositionChange(position: any): void {
    // Handle transport position changes for active loops
    this.activeLoops.forEach((loopId) => {
      const loop = this.loops.get(loopId);
      if (loop && loop.state === 'active') {
        this.checkLoopBoundaries(loop, position);
      }
    });
  }

  private handleTempoChange(tempo: number): void {
    // Update tempo progression data for all loops
    this.loops.forEach((loop) => {
      if (loop.practiceData.tempoProgression.currentTempo !== tempo) {
        loop.practiceData.tempoProgression.currentTempo = tempo;
        loop.lastModified = Date.now();
      }
    });
  }

  private handlePlaybackStateChange(state: any): void {
    // Handle playback state changes
    if (state === 'stopped') {
      // Pause all active loops
      this.activeLoops.forEach((loopId) => {
        const loop = this.loops.get(loopId);
        if (loop && loop.state === 'active') {
          loop.state = 'paused';
          this.emit('loopStateChanged', loopId, 'active', 'paused');
        }
      });
    }
  }

  private checkLoopBoundaries(_loop: LoopRegion, _position: any): void {
    // Check if we need to trigger loop events based on position
    // This would be implemented based on the specific position format
    // from PrecisionSynchronizationEngine
  }

  // ===============================
  // State Management
  // ===============================

  private getCurrentState(): any {
    return {
      loops: Array.from(this.loops.entries()),
      activeLoops: Array.from(this.activeLoops),
      currentLoop: this.currentLoop,
      config: this.config,
      performanceMetrics: this.performanceMetrics,
    };
  }

  private restoreState(state: any): void {
    try {
      this.loops = new Map(state.loops || []);
      this.activeLoops = new Set(state.activeLoops || []);
      this.currentLoop = state.currentLoop || null;
      if (state.config) {
        this.config = { ...this.config, ...state.config };
      }
      if (state.performanceMetrics) {
        this.performanceMetrics = {
          ...this.performanceMetrics,
          ...state.performanceMetrics,
        };
      }
    } catch (error) {
      console.error('Failed to restore LoopController state:', error);
    }
  }

  private validateState(state: any): boolean {
    try {
      return (
        state &&
        typeof state === 'object' &&
        Array.isArray(state.loops) &&
        Array.isArray(state.activeLoops)
      );
    } catch {
      return false;
    }
  }

  // ===============================
  // Event System
  // ===============================

  public on<K extends keyof LoopControllerEvents>(
    event: K,
    handler: LoopControllerEvents[K],
  ): () => void {
    const handlers = this.eventHandlers.get(event) || new Set();
    handlers.add(handler);
    this.eventHandlers.set(event, handlers);

    // Return unsubscribe function
    return () => {
      handlers.delete(handler);
    };
  }

  private emit<K extends keyof LoopControllerEvents>(
    event: K,
    ...args: Parameters<LoopControllerEvents[K]>
  ): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          (handler as any)(...args);
        } catch (error) {
          console.error(`Error in ${event} event handler:`, error);
        }
      });
    }
  }

  // ===============================
  // Public API Methods
  // ===============================

  public getLoop(loopId: string): LoopRegion | undefined {
    return this.loops.get(loopId);
  }

  public getAllLoops(): LoopRegion[] {
    return Array.from(this.loops.values());
  }

  public getActiveLoops(): LoopRegion[] {
    return Array.from(this.activeLoops)
      .map((id) => this.loops.get(id)!)
      .filter(Boolean);
  }

  public getCurrentLoop(): LoopRegion | null {
    return this.currentLoop ? this.loops.get(this.currentLoop) || null : null;
  }

  public getConfig(): LoopControllerConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<LoopControllerConfig>): void {
    this.config = { ...this.config, ...updates };
    this.emit('configurationChanged', this.config);
  }

  public getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  // ===============================
  // Cleanup and Disposal
  // ===============================

  public async dispose(): Promise<void> {
    try {
      // Disable all active loops
      const activeLoopIds = Array.from(this.activeLoops);
      await Promise.all(activeLoopIds.map((id) => this.disableLoop(id)));

      // Dispose of audio processing components
      if (this.crossfadeProcessor) {
        await this.crossfadeProcessor.dispose();
      }

      if (this.boundaryDetector) {
        this.boundaryDetector.dispose();
      }

      if (this.progressionTracker) {
        this.progressionTracker.dispose();
      }

      if (this.recordingEngine) {
        await this.recordingEngine.dispose();
      }

      if (this.analysisEngine) {
        this.analysisEngine.dispose();
      }

      // Clear all data
      this.loops.clear();
      this.activeLoops.clear();
      this.currentLoop = null;

      // Clear event handlers
      this.eventHandlers.clear();

      this.isInitialized = false;

      console.log('LoopController disposed');
    } catch (error) {
      console.error('Error disposing LoopController:', error);
      throw error;
    }
  }
}

// ===============================
// Supporting Classes (Stubs for Implementation)
// ===============================

class CrossfadeProcessor {
  constructor(
    private audioContext: AudioContext,
    private config: LoopControllerConfig,
  ) {}

  async initialize(): Promise<void> {
    // Implementation for crossfade processor initialization
  }

  generateCurve(type: CrossfadeType, duration: number): Float32Array {
    // Implementation for crossfade curve generation
    const samples = Math.floor(duration * this.audioContext.sampleRate);
    const curve = new Float32Array(samples);

    for (let i = 0; i < samples; i++) {
      const progress = i / (samples - 1);
      switch (type) {
        case 'linear':
          curve[i] = progress;
          break;
        case 'exponential':
          curve[i] = Math.pow(progress, 2);
          break;
        case 'equal-power':
          curve[i] = Math.sin((progress * Math.PI) / 2);
          break;
        default:
          curve[i] = progress; // Linear fallback
      }
    }

    return curve;
  }

  async prepareLoop(_loop: LoopRegion): Promise<void> {
    // Implementation for loop preparation
  }

  async cancelCrossfade(_loopId: string): Promise<void> {
    // Implementation for crossfade cancellation
  }

  cleanupLoop(_loopId: string): void {
    // Implementation for loop cleanup
  }

  async dispose(): Promise<void> {
    // Implementation for disposal
  }
}

class MusicalBoundaryDetector {
  constructor(
    private syncEngine: PrecisionSynchronizationEngine,
    private config: LoopControllerConfig,
  ) {}

  async initialize(): Promise<void> {
    // Implementation for boundary detector initialization
  }

  async refineBoundaries(boundary: LoopBoundary): Promise<LoopBoundary> {
    // Implementation for intelligent boundary refinement
    return boundary; // Stub implementation
  }

  startMonitoring(_loop: LoopRegion): void {
    // Implementation for monitoring loop boundaries
  }

  stopMonitoring(_loopId: string): void {
    // Implementation for stopping boundary monitoring
  }

  dispose(): void {
    // Implementation for disposal
  }
}

class LoopProgressionTracker {
  constructor(private config: LoopControllerConfig) {}

  async initialize(): Promise<void> {
    // Implementation for progression tracker initialization
  }

  dispose(): void {
    // Implementation for disposal
  }
}

class AutoPunchRecordingEngine {
  constructor(
    private audioContext: AudioContext,
    private config: LoopControllerConfig,
  ) {}

  async initialize(): Promise<void> {
    // Implementation for recording engine initialization
  }

  async prepareLoop(_loop: LoopRegion): Promise<void> {
    // Implementation for recording preparation
  }

  async stopRecording(_loopId: string): Promise<void> {
    // Implementation for stopping recording
  }

  async dispose(): Promise<void> {
    // Implementation for disposal
  }
}

class LoopAnalysisEngine {
  constructor(
    private syncEngine: PrecisionSynchronizationEngine,
    private analyticsEngine: AnalyticsEngine,
  ) {}

  async initialize(): Promise<void> {
    // Implementation for analysis engine initialization
  }

  async analyzeLoop(_loop: LoopRegion): Promise<LoopAnalysis> {
    // Implementation for loop analysis
    return {
      musicalStructure: {
        keySignature: 'C major',
        timeSignature: '4/4',
        harmonicComplexity: 0.5,
        rhythmicComplexity: 0.5,
        phraseStructure: ['A', 'A', 'B', 'A'],
      },
      difficulty: {
        technical: 0.5,
        musical: 0.5,
        overall: 0.5,
        factors: ['tempo', 'rhythm'],
      },
      recommendations: {
        practiceApproach: 'Start slow and gradually increase tempo',
        tempoProgression: {
          startTempo: 120, // Default tempo
          currentTempo: 120, // Default tempo
          targetTempo: 144, // 20% faster
          progressionStrategy: 'gradual',
          incrementSize: 5, // 5 BPM increments
          masteryThreshold: 0.7, // Default practicing threshold
        },
        focusAreas: ['timing', 'rhythm'],
        estimatedMasteryTime: 2.5,
      },
    };
  }

  dispose(): void {
    // Implementation for disposal
  }
}

export default LoopController;
