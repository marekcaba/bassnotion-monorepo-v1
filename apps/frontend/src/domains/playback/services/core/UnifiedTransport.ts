/**
 * UnifiedTransport - The ONE Master Clock
 * 
 * Professional-grade transport system achieving Logic Pro X/Ableton-level timing stability.
 * Merges the best of TransportController and ProfessionalTimingEngine.
 * 
 * Features:
 * - Sample-accurate timing with AudioWorklet support
 * - Advanced drift compensation with predictive algorithms
 * - Web Worker fallback for consistent timing
 * - Triple buffering for smooth playback
 * - Adaptive performance optimization
 * - Musical time representation (bars:beats:sixteenths)
 * 
 * Performance Targets:
 * - Timing Stability: >99.5%
 * - Maximum Drift: <1ms
 * - Jitter: <0.5ms RMS
 * - Update Resolution: 2.67ms (128 samples @ 48kHz)
 * - Total Latency: <10ms
 */

import { Service } from './ServiceRegistry.js';
import { EventBus } from './EventBus.js';
import { AudioEngine } from './AudioEngine.js';
import { CommandQueue } from '../../commands/CommandQueue.js';
import { EnhancedCircuitBreaker, CircuitBreakerFactory } from '../../patterns/CircuitBreaker.js';
import * as Tone from 'tone';

// Types
export interface MusicalPosition {
  bars: number;
  beats: number;
  sixteenths: number;
  ticks: number;
}

// Backward compatibility alias
export interface TransportPosition extends MusicalPosition {
  seconds: number;
  frame?: number; // Current frame count from AudioWorklet
  sampleRate?: number; // Sample rate for frame calculations
}

export interface TimeSignature {
  numerator: number;
  denominator: number;
}

export type TransportState = 'stopped' | 'playing' | 'paused';

export class TransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransportError';
  }
}

export interface TimingEvent {
  id: string;
  time: number; // in seconds
  musicalTime?: MusicalPosition;
  callback: (time: number) => void;
  priority: 'high' | 'normal' | 'low';
  metadata?: Record<string, any>;
}

export interface TimingMetrics {
  stability: number; // 0-100%
  avgDrift: number; // ms
  maxDrift: number; // ms
  jitter: number; // ms RMS
  updateRate: number; // Hz
  bufferHealth: number; // 0-100%
  cpuLoad: number; // 0-100%
  totalEvents: number;
  missedEvents: number;
}

export interface TransportConfig {
  tempo: number;
  timeSignature: TimeSignature;
  lookAheadTime: number; // seconds
  scheduleInterval: number; // seconds
  enableAudioWorklet: boolean;
  enableWebWorker: boolean;
  driftCompensation: 'off' | 'basic' | 'adaptive';
  bufferStrategy: 'fixed' | 'adaptive';
}

// Default configuration matching professional DAWs
const DEFAULT_CONFIG: TransportConfig = {
  tempo: 120,
  timeSignature: { numerator: 4, denominator: 4 },
  lookAheadTime: 0.2, // 200ms for stability
  scheduleInterval: 0.00267, // 2.67ms (128 samples @ 48kHz)
  enableAudioWorklet: true,
  enableWebWorker: true, // Only used as fallback if AudioWorklet fails
  driftCompensation: 'adaptive',
  bufferStrategy: 'adaptive'
};

export class UnifiedTransport implements Service {
  private static instance: UnifiedTransport | null = null;
  
  // Core state
  private state: TransportState = 'stopped';
  private config: TransportConfig;
  private isInitialized = false;
  
  // Service dependencies
  private eventBus: EventBus;
  private audioEngine: AudioEngine;
  private commandQueue: CommandQueue;
  private circuitBreaker: EnhancedCircuitBreaker;
  
  // Timing core
  private audioContext: AudioContext | null = null;
  private startTime: number = 0;
  private pauseTime: number = 0;
  private pausePosition: string = '0:0:0'; // Store musical position as well
  private pauseSampleTime: number = 0; // Sample-accurate pause time
  private pauseQuantum: string = '128n'; // Quantum for pause/resume (128th note for ultra-precision)
  private scheduledUntil: number = 0;
  
  // Pre-buffer mechanism
  private preBufferTime: number = 0.1; // 100ms pre-buffer (configurable)
  private preBufferedEvents: Array<{time: number, callback: () => void}> = [];
  private isPreBuffering: boolean = false;
  
  // Hardware clock synchronization
  private useHardwareClock: boolean = true;
  private hardwareClockOffset: number = 0;
  private clockSyncInterval: number | null = null;
  private clockSyncHistory: number[] = [];
  private readonly clockSyncHistorySize = 10;
  
  // Event management
  private eventQueue: TimingEvent[] = [];
  private scheduledEvents = new Map<string, number>(); // eventId -> Tone scheduleId
  private eventIdCounter = 0;
  
  // High-precision timing
  private timingWorker: Worker | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private audioWorkletMessageHandler: ((event: MessageEvent) => void) | null = null;
  private updateTimer: number | null = null;
  private lastAudioWorkletTime: number = 0;
  private lastAudioWorkletFrame: number = 0;
  private audioWorkletStartTime: number = 0; // Store the Transport.seconds when AudioWorklet starts
  private audioWorkletModuleLoaded = false; // Track if module is preloaded
  private audioWorkletReady = false; // Track if AudioWorklet is ready for use
  private audioWorkletBaselineTime: number = 0; // Store baseline time for sync
  private skipInitialSyncUpdates: number = 0; // Skip updates during initial sync
  private audioWorkletTimeOffset: number = 0; // Offset between AudioWorklet and Transport time
  private expectedSessionId: number = 0; // Track expected AudioWorklet session ID to reject stale updates
  private expectedMessageSequence: number = 0; // Track expected message sequence within session
  private useAudioWorkletAsMasterClock = true; // Use AudioWorklet as master clock when available
  private lastReinitializationTime: number = 0; // Prevent rapid reinitialization loops
  private smoothedDrift?: number; // For exponential moving average in fallback mode
  
  // Drift compensation
  private driftHistory: number[] = [];
  private readonly driftHistorySize = 100;
  private currentDrift = 0;
  private driftPredictor: DriftPredictor | null = null;
  
  // Performance monitoring
  private metrics: TimingMetrics = {
    stability: 100,
    avgDrift: 0,
    maxDrift: 0,
    jitter: 0,
    updateRate: 0,
    bufferHealth: 100,
    cpuLoad: 0,
    totalEvents: 0,
    missedEvents: 0
  };
  private lastUpdateTime = 0;
  private lastTransportTime: number | undefined;
  private updateCount = 0;
  private skipDriftChecks = 0; // Number of drift checks to skip after resume
  
  // Musical timing
  private musicalPosition: MusicalPosition = { bars: 0, beats: 0, sixteenths: 0, ticks: 0 };
  private loopEnabled = false;
  private loopStart: MusicalPosition = { bars: 0, beats: 0, sixteenths: 0, ticks: 0 };
  private loopEnd: MusicalPosition = { bars: 4, beats: 0, sixteenths: 0, ticks: 0 };
  
  private constructor(
    eventBus: EventBus,
    audioEngine: AudioEngine,
    config: Partial<TransportConfig> = {}
  ) {
    console.log('UnifiedTransport constructor called with:', {
      hasEventBus: !!eventBus,
      hasAudioEngine: !!audioEngine,
      audioEngineType: audioEngine?.constructor?.name
    });
    this.eventBus = eventBus;
    this.audioEngine = audioEngine;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.commandQueue = new CommandQueue();
    
    // Create CircuitBreakerFactory instance first
    const circuitBreakerFactory = new CircuitBreakerFactory(this.eventBus);
    this.circuitBreaker = circuitBreakerFactory.create('UnifiedTransport', 'critical', {
      failureThreshold: 5,
      recoveryTimeout: 5000,
      timeout: 3000,
      retryPolicy: {
        maxRetries: 3,
        retryDelay: 1000,
        retryableErrors: ['TimeoutError', 'NetworkError', 'TransientError']
      }
    });
    
    if (this.config.driftCompensation === 'adaptive') {
      this.driftPredictor = new DriftPredictor();
    }
  }
  
  static getInstance(
    eventBus?: EventBus,
    audioEngine?: AudioEngine,
    config?: Partial<TransportConfig>
  ): UnifiedTransport {
    console.log('UnifiedTransport.getInstance called:', {
      hasExistingInstance: !!UnifiedTransport.instance,
      hasEventBus: !!eventBus,
      hasAudioEngine: !!audioEngine,
      audioEngineType: audioEngine?.constructor?.name
    });
    
    if (!UnifiedTransport.instance) {
      // If no instance exists, we need both dependencies
      if (!eventBus || !audioEngine) {
        throw new Error('UnifiedTransport: Cannot create instance without EventBus and AudioEngine');
      }
      console.log('UnifiedTransport: Creating new singleton instance');
      UnifiedTransport.instance = new UnifiedTransport(eventBus, audioEngine, config);
    } else {
      // DEFENSIVE: Update references if they've changed or are missing
      // This handles cases where getInstance is called without dependencies
      if (eventBus && UnifiedTransport.instance.eventBus !== eventBus) {
        console.warn('UnifiedTransport: EventBus reference changed - updating singleton');
        UnifiedTransport.instance.eventBus = eventBus;
      }
      
      if (audioEngine && UnifiedTransport.instance.audioEngine !== audioEngine) {
        console.warn('UnifiedTransport: AudioEngine reference changed - updating singleton');
        UnifiedTransport.instance.audioEngine = audioEngine;
      }
      
      // EXTRA DEFENSIVE: Check if references are somehow null
      if (!UnifiedTransport.instance.audioEngine && audioEngine) {
        console.warn('UnifiedTransport: AudioEngine was null in singleton - fixing!');
        UnifiedTransport.instance.audioEngine = audioEngine;
      }
      if (!UnifiedTransport.instance.eventBus && eventBus) {
        console.warn('UnifiedTransport: EventBus was null in singleton - fixing!');
        UnifiedTransport.instance.eventBus = eventBus;
      }
    }
    
    console.log('UnifiedTransport.getInstance returning instance:', {
      hasAudioEngine: !!UnifiedTransport.instance.audioEngine,
      hasEventBus: !!UnifiedTransport.instance.eventBus
    });
    
    return UnifiedTransport.instance;
  }
  
  /**
   * Pre-buffer upcoming events for seamless resume
   */
  private preBufferUpcomingEvents(fromTime: number): void {
    this.preBufferedEvents = [];
    const tone = this.audioEngine.getTone();
    
    // Look ahead for events in the pre-buffer window
    const bufferEndTime = fromTime + this.preBufferTime;
    
    // Store events that would play during the pre-buffer period
    this.eventQueue.forEach(event => {
      if (event.time >= fromTime && event.time <= bufferEndTime) {
        this.preBufferedEvents.push({
          time: event.time,
          callback: () => event.callback(event.time)
        });
      }
    });
    
    console.log(`📦 Pre-buffered ${this.preBufferedEvents.length} events for resume`);
  }
  
  /**
   * Apply pre-buffered events on resume
   */
  private applyPreBufferedEvents(resumeTime: number): void {
    const tone = this.audioEngine.getTone();
    
    this.preBufferedEvents.forEach(event => {
      // Reschedule the event relative to resume time
      const relativeTime = event.time - this.pauseTime;
      const scheduleTime = resumeTime + relativeTime;
      
      tone.Transport.schedule((time) => {
        event.callback();
      }, scheduleTime);
    });
    
    console.log(`📦 Applied ${this.preBufferedEvents.length} pre-buffered events`);
    this.preBufferedEvents = [];
  }
  
  /**
   * Set the pre-buffer time for seamless resume
   * @param seconds - Pre-buffer time in seconds (0.05 - 0.5)
   */
  setPreBufferTime(seconds: number): void {
    this.preBufferTime = Math.max(0.05, Math.min(0.5, seconds));
    console.log(`📦 Pre-buffer time set to ${this.preBufferTime}s`);
  }
  
  /**
   * Enable hardware clock synchronization
   * @param enable - Enable or disable hardware clock sync
   */
  enableHardwareClockSync(enable: boolean): void {
    this.useHardwareClock = enable;
    
    if (enable) {
      this.startClockSync();
      console.log('🔧 Hardware clock synchronization enabled');
    } else {
      this.stopClockSync();
      console.log('🔧 Hardware clock synchronization disabled');
    }
  }
  
  /**
   * Start hardware clock synchronization
   */
  private startClockSync(): void {
    if (this.clockSyncInterval) return;
    
    // Sync every 100ms
    this.clockSyncInterval = window.setInterval(() => {
      this.syncHardwareClock();
    }, 100);
    
    // Initial sync
    this.syncHardwareClock();
  }
  
  /**
   * Stop hardware clock synchronization
   */
  private stopClockSync(): void {
    if (this.clockSyncInterval) {
      clearInterval(this.clockSyncInterval);
      this.clockSyncInterval = null;
    }
    this.clockSyncHistory = [];
    this.hardwareClockOffset = 0;
  }
  
  /**
   * Sync with hardware clock
   */
  private syncHardwareClock(): void {
    if (!this.audioContext) return;
    
    // Get high-resolution timestamps
    const perfTime = performance.now();
    const audioTime = this.audioContext.currentTime * 1000; // Convert to ms
    const offset = perfTime - audioTime;
    
    // Add to history
    this.clockSyncHistory.push(offset);
    if (this.clockSyncHistory.length > this.clockSyncHistorySize) {
      this.clockSyncHistory.shift();
    }
    
    // Calculate average offset for stability
    const avgOffset = this.clockSyncHistory.reduce((a, b) => a + b, 0) / this.clockSyncHistory.length;
    const oldOffset = this.hardwareClockOffset;
    this.hardwareClockOffset = avgOffset;
    
    // Log significant changes (the offset is the normal difference between performance.now() and AudioContext time)
    const adjustment = avgOffset - oldOffset;
    if (Math.abs(adjustment) > 1 && this.clockSyncHistory.length > 1 && !this.audioWorkletNode) {
      // Only log for non-AudioWorklet mode since it's not relevant with AudioWorklet
      console.log(`🔧 Clock sync adjustment: ${adjustment.toFixed(2)}ms (offset: ${avgOffset.toFixed(2)}ms)`);
    }
  }
  
  /**
   * Get hardware-synced time
   */
  private getHardwareSyncedTime(): number {
    if (!this.useHardwareClock || !this.audioContext) {
      return performance.now() / 1000;
    }
    
    // Use AudioContext time with offset compensation
    return this.audioContext.currentTime + (this.hardwareClockOffset / 1000);
  }
  
  /**
   * Set the quantum for pause/resume operations
   * @param quantum - Subdivision for quantization ('1n', '4n', '8n', '16n', '32n', '64n', '128n')
   */
  setPauseResumeQuantum(quantum: string): void {
    const validQuantums = ['1n', '2n', '4n', '8n', '16n', '32n', '64n', '128n'];
    if (!validQuantums.includes(quantum)) {
      console.warn(`Invalid quantum: ${quantum}. Using default '16n'`);
      return;
    }
    
    this.pauseQuantum = quantum;
    console.log(`🎯 Pause/Resume quantum set to: ${quantum}`);
  }
  
  /**
   * Get current pause/resume quantum
   */
  getPauseResumeQuantum(): string {
    return this.pauseQuantum;
  }
  
  /**
   * Get hardware clock sync status
   */
  get isHardwareClockSyncEnabled(): boolean {
    return this.useHardwareClock;
  }
  
  /**
   * Get current pre-buffer time
   */
  get currentPreBufferTime(): number {
    return this.preBufferTime;
  }
  
  /**
   * Initialize the transport system
   */
  async initialize(): Promise<void> {
    console.log('🚀 UnifiedTransport.initialize() called, isInitialized:', this.isInitialized);
    
    if (this.isInitialized) {
      console.log('UnifiedTransport.initialize(): Already initialized, returning early');
      return;
    }
    
    console.log('🚀 UnifiedTransport.initialize() proceeding with initialization');
    
    // DEFENSIVE: Try to get dependencies from ServiceRegistry if they're missing
    if (!this.audioEngine || !this.eventBus) {
      console.log('UnifiedTransport.initialize(): Missing dependencies, attempting to retrieve from ServiceRegistry');
      
      // Try to get from global service registry
      const registry = (window as any).__serviceRegistry;
      if (registry) {
        if (!this.audioEngine) {
          const audioEngineService = registry.get('audioEngine');
          if (audioEngineService) {
            this.audioEngine = audioEngineService;
            console.log('UnifiedTransport.initialize(): Retrieved AudioEngine from ServiceRegistry');
          }
        }
        
        if (!this.eventBus) {
          const eventBusService = registry.get('eventBus');
          if (eventBusService) {
            this.eventBus = eventBusService;
            console.log('UnifiedTransport.initialize(): Retrieved EventBus from ServiceRegistry');
          }
        }
      }
    }
    
    // Final check - ensure we have audioEngine reference
    if (!this.audioEngine) {
      console.error('UnifiedTransport.initialize(): AudioEngine is still null after recovery attempt!', {
        instance: this,
        hasEventBus: !!this.eventBus,
        hasAudioEngine: !!this.audioEngine,
        isSingleton: this === UnifiedTransport.instance
      });
      throw new Error('UnifiedTransport: AudioEngine reference is missing. This indicates a dependency injection issue.');
    }
    
    try {
      // Get audio context from audio engine
      const tone = this.audioEngine.getTone();
      console.log('UnifiedTransport.initialize(): Got Tone from AudioEngine:', !!tone);
      
      // Get the raw AudioContext - Tone.js wraps it, we need the native one
      const toneContext = tone.getContext();
      
      // Get the actual native AudioContext instance (Tone.js GitHub issue #1298)
      if ((toneContext as any).rawContext?._nativeAudioContext instanceof AudioContext) {
        this.audioContext = (toneContext as any).rawContext._nativeAudioContext;
      } else {
        // Fallback to AudioEngine's context which should already have the native one
        this.audioContext = this.audioEngine.getContext();
      }
      
      console.log('UnifiedTransport.initialize(): Got AudioContext:', this.audioContext?.state);
      
      // Check audio context state but don't block initialization
      if (this.audioContext.state === 'suspended') {
        console.warn('UnifiedTransport: AudioContext is suspended. Transport features will be limited until audio context is resumed.');
        // Continue initialization - we can still set up everything except actual playback
      }
      
      // Configure Tone.js for professional timing
      tone.context.lookAhead = this.config.lookAheadTime;
      tone.context.updateInterval = this.config.scheduleInterval;
      
      // Pattern scheduler initialization removed - now handled by tracks
      tone.Transport.PPQ = 960; // Professional PPQ for accurate MIDI timing
      
      // Preload AudioWorklet module for faster startup if available
      if (this.config.enableAudioWorklet && this.audioContext && 'audioWorklet' in this.audioContext) {
        try {
          // Preload the worklet module even if context is suspended
          console.log('🚀 Preloading AudioWorklet module for faster startup...');
          await this.audioContext.audioWorklet.addModule('/worklets/timing-processor.js');
          this.audioWorkletModuleLoaded = true;
          console.log('✅ AudioWorklet module preloaded successfully');
        } catch (error) {
          console.warn('Failed to preload AudioWorklet module:', error);
          // Don't fail initialization, AudioWorklet will be loaded on demand
        }
      }
      
      // AudioWorklet node will be created when transport starts
      this.audioWorkletReady = false;
      
      // Initialize WebWorker as backup timing source
      if (this.config.enableWebWorker) {
        await this.initializeWebWorker();
        console.log('⚡ Web Worker initialized as backup timing source');
      } else {
        this.initializeIntervalTiming();
        console.log('⏱️ Using setInterval fallback timing');
      }
      
      // Set initial tempo and time signature
      tone.Transport.bpm.value = this.config.tempo;
      tone.Transport.timeSignature = [
        this.config.timeSignature.numerator,
        this.config.timeSignature.denominator
      ];
      
      this.isInitialized = true;
      console.log('UnifiedTransport.initialize(): Setting isInitialized = true');
      
      console.log('🎯 UnifiedTransport initialized', {
        mode: this.audioWorkletNode ? 'AudioWorklet' : this.timingWorker ? 'WebWorker' : 'Interval',
        audioWorkletNode: !!this.audioWorkletNode,
        timingWorker: !!this.timingWorker,
        lookAhead: `${this.config.lookAheadTime * 1000}ms`,
        updateRate: `${1 / this.config.scheduleInterval}Hz`,
        driftCompensation: this.config.driftCompensation,
        audioContextState: this.audioContext?.state,
        isInitialized: this.isInitialized
      });
      
      console.log('UnifiedTransport.initialize() completed successfully! isInitialized:', this.isInitialized);
      
    } catch (error) {
      console.error('Failed to initialize UnifiedTransport:', error);
      throw error;
    }
  }
  
  /**
   * Initialize AudioWorklet for sample-accurate timing
   */
  private async initializeAudioWorklet(): Promise<void> {
    try {
      // Get the AudioContext from AudioEngine (which is the same one Tone.js uses)
      const audioContext = this.audioEngine.getContext();
      
      if (!audioContext || !(audioContext instanceof AudioContext)) {
        throw new Error('Could not get AudioContext from AudioEngine');
      }
      
      // Ensure AudioContext is running - CRITICAL for AudioWorklet
      if (audioContext.state === 'suspended') {
        console.warn('AudioContext is suspended, trying to resume...');
        try {
          await audioContext.resume();
          console.log('AudioContext resumed, state:', audioContext.state);
        } catch (e) {
          console.warn('Could not resume AudioContext:', e);
          console.warn('AudioWorklet will not process until AudioContext is resumed from user gesture');
        }
      }
      
      // Load the worklet processor if not already loaded
      if (!this.audioWorkletModuleLoaded) {
        console.log('Loading AudioWorklet module from /worklets/timing-processor.js...');
        await audioContext.audioWorklet.addModule('/worklets/timing-processor.js');
        this.audioWorkletModuleLoaded = true;
        console.log('AudioWorklet module loaded successfully');
      } else {
        console.log('AudioWorklet module already preloaded');
      }
      
      // Create the worklet node
      // IMPORTANT: Need at least 1 output to ensure process() is called
      this.audioWorkletNode = new AudioWorkletNode(audioContext, 'timing-processor', {
        numberOfInputs: 0,
        numberOfOutputs: 1,  // Need at least 1 output to process
        outputChannelCount: [1],  // Single channel is enough
        processorOptions: {
          updateInterval: this.config.scheduleInterval,
          lookAheadTime: this.config.lookAheadTime
        }
      });
      
      // CRITICAL: Connect to destination to start processing
      // Without this, the AudioWorklet won't run its process() method
      this.audioWorkletNode.connect(audioContext.destination);
      
      // HACK: Create a silent oscillator to ensure the audio graph is running
      // This forces the AudioWorklet to start processing
      const silentOsc = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0; // Silent
      silentOsc.connect(gainNode);
      gainNode.connect(audioContext.destination);
      silentOsc.start();
      console.log('🔊 Started silent oscillator to ensure audio graph is running');
      
      // Final check of audio context state
      console.log('AudioContext state after setup:', audioContext.state);
      // AudioWorklet connected
      
      // Send a test message to verify communication
      this.audioWorkletNode.port.postMessage({ type: 'get-stats' });
      
      // Create a bound message handler so we can remove it later
      this.audioWorkletMessageHandler = (event: MessageEvent) => {
        if (event.data.type === 'timing-update') {
          // Debug sessionId validation for first few updates (reduced)
          if (event.data.updateCount <= 2) {
            console.log(`🔍 SessionId check: received=${event.data.sessionId}, expected=${this.expectedSessionId}, updateCount=${event.data.updateCount}`);
          }
          
          // Validate session ID to reject stale timing updates
          if (event.data.sessionId !== this.expectedSessionId) {
            console.warn(`🚫 Rejecting stale AudioWorklet[${event.data.processorId}] update: sessionId=${event.data.sessionId}, expected=${this.expectedSessionId}`);
            return;
          }
          
          // Validate message sequence to reject out-of-order timing updates
          if (event.data.messageSequence <= this.expectedMessageSequence) {
            console.warn(`🚫 Rejecting out-of-order AudioWorklet[${event.data.processorId}] update: sequence=${event.data.messageSequence}, expected>${this.expectedMessageSequence}, time=${event.data.time.toFixed(6)}s`);
            return;
          }
          this.expectedMessageSequence = event.data.messageSequence;
          
          
          // Log first timing update for debugging
          if (event.data.updateCount === 1) {
            console.log(`🎵 AudioWorklet[${event.data.processorId}] timing started: time=${event.data.time.toFixed(4)}s, frame=${event.data.playbackFrame || event.data.frame}`);
            
            // Store the baseline time for reference
            this.audioWorkletBaselineTime = event.data.time;
            
            // In master clock mode, AudioWorklet IS the source of truth
            // No offset calculation needed - Transport will follow AudioWorklet
          }
          
          // CRITICAL: Reject stale timing updates from message queue
          // Check if this timing update shows an unreasonable jump from the last good update
          if (this.lastAudioWorkletTime > 0) {
            const timingSinceLastUpdate = event.data.time - this.lastAudioWorkletTime;
            const expectedMaxInterval = 0.01; // 10ms max expected between updates (way more than 2.67ms normal)
            
            if (timingSinceLastUpdate > expectedMaxInterval) {
              // This looks like a stale accumulated update - reject it
              console.warn(`🚫 Rejecting stale AudioWorklet[${event.data.processorId}] update: time=${event.data.time.toFixed(6)}s, last=${this.lastAudioWorkletTime.toFixed(6)}s, gap=${(timingSinceLastUpdate * 1000).toFixed(0)}ms`);
              return; // Skip this stale update
            }
          }
          
          // Store sample-accurate timing from AudioWorklet AFTER all validation passes
          this.lastAudioWorkletTime = event.data.time;
          this.lastAudioWorkletFrame = event.data.playbackFrame || event.data.frame || 0;
          
          // Debug log frame updates periodically - expand to show more frequently
          if (event.data.updateCount <= 20 || event.data.updateCount % 10 === 0) {
            console.log(`🎯 Frame tracking update ${event.data.updateCount}: playbackFrame=${event.data.playbackFrame}, frame=${event.data.frame}, stored=${this.lastAudioWorkletFrame}`);
          }
          
          this.handleTimingUpdate('AudioWorklet');
        } else if (event.data.type === 'timing-warning') {
          console.warn('⚠️ AudioWorklet timing warning:', event.data.message);
        } else if (event.data.type === 'stats') {
          console.log('📊 AudioWorklet stats:', event.data);
        }
      };
      
      // Handle messages from the worklet
      this.audioWorkletNode.port.onmessage = this.audioWorkletMessageHandler;
      
      // Connect to destination (required for processing)
      this.audioWorkletNode.connect(audioContext.destination);
      
      // AudioWorklet timing initialized - sample-accurate timing enabled
    } catch (error) {
      console.error('AudioWorklet initialization error:', error);
      console.warn('AudioWorklet initialization failed, falling back to WebWorker');
      await this.initializeWebWorker();
    }
  }
  
  /**
   * Reinitialize AudioWorklet after context is resumed
   * This is needed because AudioWorklet won't process if created while context is suspended
   */
  async reinitializeAudioWorklet(): Promise<void> {
    // Get fresh context from audioEngine in case our reference is stale
    if (!this.audioEngine) {
      console.error('Cannot reinitialize AudioWorklet - audioEngine is null');
      return;
    }
    
    // Get the raw AudioContext - Tone.js wraps it, we need the native one
    const tone = this.audioEngine.getTone();
    let audioContext: AudioContext;
    
    // Try to get the raw AudioContext from Tone.js (GitHub issue #1298)
    const toneContext = tone?.getContext();
    if ((toneContext as any)?.rawContext?._nativeAudioContext instanceof AudioContext) {
      audioContext = (toneContext as any).rawContext._nativeAudioContext;
    } else {
      // Fallback to AudioEngine's context which should already have the native one
      audioContext = this.audioEngine.getContext();
    }
    
    if (!audioContext) {
      console.error('Cannot reinitialize AudioWorklet - no AudioContext available');
      return;
    }
    
    // Debug: check what type we actually got
    console.log('AudioContext type check:', {
      constructor: audioContext.constructor.name,
      isAudioContext: audioContext instanceof AudioContext,
      isBaseAudioContext: audioContext instanceof BaseAudioContext,
      hasAudioWorklet: 'audioWorklet' in audioContext
    });
    
    // Update our reference
    this.audioContext = audioContext;
    
    if (!this.config.enableAudioWorklet || !audioContext.audioWorklet) {
      console.log('AudioWorklet not enabled or not supported');
      return;
    }

    // Check if context is now running
    if (audioContext.state !== 'running') {
      console.warn('Cannot reinitialize AudioWorklet - context still not running:', audioContext.state);
      return;
    }

    // Prevent rapid reinitialization loops (minimum 100ms between reinitializations)
    const now = performance.now();
    if (now - this.lastReinitializationTime < 100) {
      console.warn('🚫 Preventing rapid AudioWorklet reinitialization - too soon after last attempt');
      return;
    }
    this.lastReinitializationTime = now;

    console.log('🔄 Reinitializing AudioWorklet with running context...', {
      hasAudioWorklet: !!audioContext?.audioWorklet,
      currentNode: !!this.audioWorkletNode,
      moduleLoaded: this.audioWorkletModuleLoaded
    });
    
    // CRITICAL: Always disconnect and clean up old node completely
    if (this.audioWorkletNode) {
      console.log('🧹 Cleaning up old AudioWorklet node...');
      // Send stop message to old processor first
      try {
        this.audioWorkletNode.port.postMessage({ type: 'stop' });
      } catch (e) {
        console.warn('Failed to send stop message to old AudioWorklet:', e);
      }
      
      // Disconnect and nullify
      this.audioWorkletNode.disconnect();
      // CRITICAL: Remove the old message handler to prevent duplicate processing
      if (this.audioWorkletMessageHandler) {
        this.audioWorkletNode.port.onmessage = null;
        this.audioWorkletMessageHandler = null;
      }
      this.audioWorkletNode = null;
      
      // Give it a moment to fully cleanup
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Create new AudioWorklet node with proper setup
    try {
      // Use the audioContext we already validated above
      // (removed duplicate const declaration that was shadowing the outer audioContext)
      
      if (!audioContext) {
        console.error('Cannot create AudioWorklet - no AudioContext available');
        return;
      }
      
      // Update our reference
      this.audioContext = audioContext;
      
      // Load the worklet module if not already loaded
      if (!this.audioWorkletModuleLoaded) {
        console.log('Loading AudioWorklet module...');
        await audioContext.audioWorklet.addModule('/worklets/timing-processor.js');
        this.audioWorkletModuleLoaded = true;
      }
      
      // CRITICAL: Reset AudioWorklet timing state for clean initialization
      this.audioWorkletStartTime = 0; // Keep for compatibility but not used in master clock mode
      this.lastAudioWorkletTime = 0; // Reset timing tracking
      this.lastAudioWorkletFrame = 0;
      
      // Create the AudioWorklet node
      this.audioWorkletNode = new AudioWorkletNode(audioContext, 'timing-processor', {
        outputChannelCount: [1],
        processorOptions: {
          updateInterval: this.config.scheduleInterval,
          lookAheadTime: this.config.lookAheadTime
        }
      });
      
      // Configure output to ensure it runs
      if (this.audioWorkletNode.numberOfOutputs > 0) {
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 0; // Mute the output
        this.audioWorkletNode.connect(gainNode);
        gainNode.connect(audioContext.destination);
      }
      
      // Create a new bound message handler for the reinitialized node
      this.audioWorkletMessageHandler = (event: MessageEvent) => {
        if (event.data.type === 'timing-update') {
          // Debug sessionId validation for first few updates (reduced)
          if (event.data.updateCount <= 2) {
            console.log(`🔍 SessionId check: received=${event.data.sessionId}, expected=${this.expectedSessionId}, updateCount=${event.data.updateCount}`);
          }
          
          // Validate session ID to reject stale timing updates
          if (event.data.sessionId !== this.expectedSessionId) {
            console.warn(`🚫 Rejecting stale AudioWorklet[${event.data.processorId}] update: sessionId=${event.data.sessionId}, expected=${this.expectedSessionId}`);
            return;
          }
          
          // Validate message sequence to reject out-of-order timing updates
          if (event.data.messageSequence <= this.expectedMessageSequence) {
            console.warn(`🚫 Rejecting out-of-order AudioWorklet[${event.data.processorId}] update: sequence=${event.data.messageSequence}, expected>${this.expectedMessageSequence}, time=${event.data.time.toFixed(6)}s`);
            return;
          }
          this.expectedMessageSequence = event.data.messageSequence;
          
          
          // Log first timing update for debugging
          if (event.data.updateCount === 1) {
            console.log(`🎵 AudioWorklet[${event.data.processorId}] timing started: time=${event.data.time.toFixed(4)}s, frame=${event.data.playbackFrame || event.data.frame}`);
            
            // Store the baseline time for reference
            this.audioWorkletBaselineTime = event.data.time;
            
            // In master clock mode, AudioWorklet IS the source of truth
            // No offset calculation needed - Transport will follow AudioWorklet
          }
          
          // CRITICAL: Reject stale timing updates from message queue
          // Check if this timing update shows an unreasonable jump from the last good update
          if (this.lastAudioWorkletTime > 0) {
            const timingSinceLastUpdate = event.data.time - this.lastAudioWorkletTime;
            const expectedMaxInterval = 0.01; // 10ms max expected between updates (way more than 2.67ms normal)
            
            if (timingSinceLastUpdate > expectedMaxInterval) {
              // This looks like a stale accumulated update - reject it
              console.warn(`🚫 Rejecting stale AudioWorklet[${event.data.processorId}] update: time=${event.data.time.toFixed(6)}s, last=${this.lastAudioWorkletTime.toFixed(6)}s, gap=${(timingSinceLastUpdate * 1000).toFixed(0)}ms`);
              return; // Skip this stale update
            }
          }
          
          // Store sample-accurate timing from AudioWorklet AFTER validation passes
          this.lastAudioWorkletTime = event.data.time;
          this.lastAudioWorkletFrame = event.data.playbackFrame || event.data.frame || 0;
          
          // Debug log frame updates periodically (reduced logging)
          if (event.data.updateCount <= 5) {
            console.log(`🎯 Frame tracking update ${event.data.updateCount}: playbackFrame=${event.data.playbackFrame}, frame=${event.data.frame}, stored=${this.lastAudioWorkletFrame}`);
          }
          
          // Forward timing update to handler
          this.handleTimingUpdate('AudioWorklet-reinit');
        } else if (event.data.type === 'timing-warning') {
          console.warn('⚠️ AudioWorklet timing warning:', event.data.message);
        } else if (event.data.type === 'stats') {
          console.log('📊 AudioWorklet stats:', event.data);
        }
      };
      
      // IMPORTANT: Set up message handler for the new node
      this.audioWorkletNode.port.onmessage = this.audioWorkletMessageHandler;
      
      this.audioWorkletReady = true;
      console.log('✅ AudioWorklet reinitialized successfully with message handler');
      
      // If we're already playing, send start message
      if (this.state === 'playing') {
        const tone = this.audioEngine.getTone();
        const currentSeconds = tone.Transport.seconds;
        const currentFrames = Math.floor(currentSeconds * this.audioContext.sampleRate);
        
        // CRITICAL: Reset AudioWorklet timing state for clean sync
        // AudioWorklet will track absolute position, so we reset our tracking
        this.audioWorkletStartTime = 0; // Keep for compatibility but not used in master clock mode
        this.lastAudioWorkletTime = 0; // Reset to start fresh timing tracking
        this.lastAudioWorkletFrame = currentFrames;
        
        // Ensure we're starting from a clean state when Transport is at 0
        const startFrame = currentSeconds < 0.001 ? 0 : currentFrames;
        
        console.log('🎵 Sending start message to reinitialized AudioWorklet', {
          state: this.state,
          fromFrame: startFrame,
          startTime: currentSeconds
        });
        this.audioWorkletNode.port.postMessage({ 
          type: 'start',
          fromFrame: startFrame
        });
      }
      
      console.log('✅ AudioWorklet reinitializtion completed successfully', {
        nodeCreated: !!this.audioWorkletNode,
        ready: this.audioWorkletReady
      });
    } catch (error) {
      console.error('Failed to reinitialize AudioWorklet:', error);
      this.audioWorkletReady = false;
      // Fall back to Web Worker timing
      await this.initializeWebWorker();
    }
  }

  /**
   * Initialize Web Worker for consistent timing
   */
  private async initializeWebWorker(): Promise<void> {
    try {
      // Create inline worker for timing
      const workerCode = `
        let intervalId = null;
        let updateInterval = ${this.config.scheduleInterval * 1000}; // Convert to ms
        
        self.onmessage = function(e) {
          if (e.data.type === 'start') {
            if (intervalId) clearInterval(intervalId);
            intervalId = setInterval(() => {
              self.postMessage({ type: 'tick', time: performance.now() });
            }, updateInterval);
          } else if (e.data.type === 'stop') {
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
          } else if (e.data.type === 'updateInterval') {
            updateInterval = e.data.interval;
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = setInterval(() => {
                self.postMessage({ type: 'tick', time: performance.now() });
              }, updateInterval);
            }
          }
        };
      `;
      
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      this.timingWorker = new Worker(workerUrl);
      
      // Handle worker messages
      this.timingWorker.onmessage = (event) => {
        if (event.data.type === 'tick') {
          this.handleTimingUpdate('WebWorker');
        }
      };
      
      // Don't start the worker until transport starts
      // this.timingWorker.postMessage({ type: 'start' });
      
      console.log('✅ WebWorker timing initialized');
    } catch (error) {
      console.warn('WebWorker initialization failed, falling back to interval timing:', error);
      this.initializeIntervalTiming();
    }
  }
  
  /**
   * Fallback to standard interval timing
   */
  private initializeIntervalTiming(): void {
    // Clear any existing timer first
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    
    console.log(`🕐 Creating interval timer with ${this.config.scheduleInterval * 1000}ms interval`);
    this.updateTimer = window.setInterval(() => {
      // Only process if transport is actually initialized and playing
      if (this.isInitialized && this.state === 'playing') {
        this.handleTimingUpdate('Interval');
      }
    }, this.config.scheduleInterval * 1000);
    
    console.log('✅ Interval timing initialized, timer ID:', this.updateTimer);
  }
  
  /**
   * Core timing update handler
   */
  private handleTimingUpdate(source?: string): void {
    if (!this.isInitialized || this.state !== 'playing') {
      return;
    }
    
    // Debug log the source of timing updates (reduced)
    if (this.updateCount <= 5 || this.updateCount % 100 === 0) {
      console.log(`⏱️ handleTimingUpdate called from: ${source || 'unknown'}, updateCount: ${this.updateCount}`);
    }
    
    // Update timing
    const tone = this.audioEngine.getTone();
    const currentTime = tone.Transport.seconds;
    
    // Detect and compensate for drift
    if (this.config.driftCompensation !== 'off') {
      this.detectAndCompensateDrift();
    }
    
    // Schedule events
    this.scheduleEvents(currentTime);
    
    // Update metrics
    this.updateMetrics();
    
    // Update musical position
    this.updateMusicalPosition();
    
    // Emit timing update event
    this.eventBus.emit('transport:timing-update', {
      time: currentTime,
      position: this.musicalPosition,
      state: this.state,
      metrics: this.metrics
    });
  }
  
  /**
   * Detect timing drift and apply compensation
   */
  private detectAndCompensateDrift(): void {
    if (!this.audioContext) return;
    
    // Skip drift checks after resume
    if (this.skipDriftChecks > 0) {
      this.skipDriftChecks--;
      this.lastUpdateTime = performance.now();
      this.lastTransportTime = this.audioEngine.getTone().Transport.seconds;
      return;
    }
    
    // Get actual transport position
    const tone = this.audioEngine.getTone();
    const transportTime = tone.Transport.seconds;
    
    // For the first update, just record the time
    if (this.lastTransportTime === undefined) {
      this.lastTransportTime = transportTime;
      this.lastUpdateTime = performance.now();
      return;
    }
    
    // Calculate drift using sample-accurate timing
    let drift = 0;
    let actualDifference = 0; // Track actual difference for metrics
    
    // Debug log drift compensation mode selection (reduced)
    if (this.updateCount === 10 || this.updateCount % 200 === 0) {
      console.log(`🎯 Drift mode check: audioWorkletNode=${!!this.audioWorkletNode}, lastAudioWorkletTime=${this.lastAudioWorkletTime}, useAudioWorkletAsMasterClock=${this.useAudioWorkletAsMasterClock}`);
    }
    
    if (this.audioWorkletNode && this.lastAudioWorkletTime > 0 && this.useAudioWorkletAsMasterClock) {
      // MASTER CLOCK MODE: AudioWorklet is the ONLY source of truth
      // We completely ignore Transport's internal timing and force it to match AudioWorklet
      const audioWorkletPosition = this.lastAudioWorkletTime;
      
      // Always set Transport to match AudioWorklet exactly
      // This ensures Transport is just a follower, not trying to maintain its own timing
      tone.Transport.seconds = audioWorkletPosition;
      
      // Update our tracked position
      this.lastTransportTime = audioWorkletPosition;
      
      // No drift in master clock mode - AudioWorklet IS the time
      drift = 0;
    } else if (this.audioWorkletNode && this.lastAudioWorkletTime > 0) {
      // HYBRID MODE: Use drift compensation (for testing/comparison)
      // lastAudioWorkletTime is already an absolute position, no need to add baseline
      const expectedTransportTime = this.lastAudioWorkletTime;
      drift = transportTime - expectedTransportTime;
      
      // Apply exponential moving average
      const DRIFT_SMOOTHING = 0.1;
      if (!this.smoothedDrift) {
        this.smoothedDrift = drift;
      } else {
        this.smoothedDrift = this.smoothedDrift * (1 - DRIFT_SMOOTHING) + drift * DRIFT_SMOOTHING;
      }
      
      // Apply correction if needed
      if (Math.abs(this.smoothedDrift) > 0.001) {
        const correction = this.smoothedDrift * 0.1;
        tone.Transport.seconds = tone.Transport.seconds - correction;
        
        if (Math.abs(this.smoothedDrift) > 0.005) {
          console.log(`🎯 Drift correction (hybrid mode): ${(this.smoothedDrift * 1000).toFixed(2)}ms`);
        }
        
        drift = drift - correction;
      }
      
      this.lastTransportTime = tone.Transport.seconds;
    } else {
      // FALLBACK MODE: Use performance.now() timing with drift compensation
      const currentTime = performance.now();
      const deltaTime = (currentTime - this.lastUpdateTime) / 1000;
      const actualDelta = transportTime - this.lastTransportTime;
      drift = actualDelta - deltaTime;
      
      // Apply drift compensation only in fallback mode
      if (Math.abs(drift) > 0.005) { // 5ms threshold
        const correction = drift * 0.5; // 50% correction factor
        tone.Transport.seconds = tone.Transport.seconds - correction;
        drift = drift - correction;
        console.log(`🎯 Fallback drift correction: ${(drift * 1000).toFixed(2)}ms`);
      }
      
      this.lastTransportTime = tone.Transport.seconds;
    }
    
    // Update timing reference
    this.lastUpdateTime = performance.now();
    
    // Add to drift history
    this.driftHistory.push(drift);
    if (this.driftHistory.length > this.driftHistorySize) {
      this.driftHistory.shift();
    }
    
    // Calculate metrics
    const avgDrift = this.driftHistory.length > 0 
      ? this.driftHistory.reduce((a, b) => a + b, 0) / this.driftHistory.length 
      : 0;
    const maxDrift = this.driftHistory.length > 0 
      ? Math.max(...this.driftHistory.map(Math.abs)) 
      : 0;
    
    // Calculate jitter (RMS of drift variations)
    const jitter = this.driftHistory.length > 0
      ? Math.sqrt(
          this.driftHistory
            .map(d => Math.pow(d - avgDrift, 2))
            .reduce((a, b) => a + b, 0) / this.driftHistory.length
        )
      : 0;
    
    // Calculate stability based on how many samples are within tolerance
    const driftTolerance = 0.001; // 1ms tolerance
    const samplesWithinTolerance = this.driftHistory.filter(d => Math.abs(d) <= driftTolerance).length;
    const stability = this.driftHistory.length > 0 
      ? (samplesWithinTolerance / this.driftHistory.length) * 100 
      : 100; // Default to 100% if no data
    
    // Update metrics
    this.metrics.avgDrift = avgDrift * 1000; // Convert to ms
    this.metrics.maxDrift = maxDrift * 1000;
    this.metrics.jitter = jitter * 1000;
    this.metrics.stability = stability;
    
    // With AudioWorklet, we shouldn't need drift compensation
    if (!this.audioWorkletNode) {
      // Apply drift compensation only for fallback modes
      if (this.config.driftCompensation === 'adaptive' && this.driftPredictor) {
        this.currentDrift = this.driftPredictor.predict(drift);
      } else if (this.config.driftCompensation === 'basic') {
        // Simple exponential smoothing
        const alpha = 0.1;
        this.currentDrift = alpha * drift + (1 - alpha) * this.currentDrift;
      }
    } else {
      // With AudioWorklet, drift should be negligible
      this.currentDrift = 0;
    }
    
    // Only warn if drift is significant and we're not using AudioWorklet
    if (!this.audioWorkletNode && Math.abs(avgDrift) > 0.020) { // 20ms threshold
      console.warn(`⚠️ High timing drift detected: ${(avgDrift * 1000).toFixed(2)}ms`);
    }
  }
  
  /**
   * Schedule events within the lookahead window
   */
  private scheduleEvents(currentTime: number): void {
    const scheduleUntil = currentTime + this.config.lookAheadTime;
    
    // Filter events to schedule
    const eventsToSchedule = this.eventQueue.filter(event => 
      event.time > currentTime && 
      event.time <= scheduleUntil &&
      !this.scheduledEvents.has(event.id)
    );
    
    // Sort by priority and time
    eventsToSchedule.sort((a, b) => {
      if (a.priority !== b.priority) {
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return a.time - b.time;
    });
    
    // Schedule each event
    const tone = this.audioEngine.getTone();
    for (const event of eventsToSchedule) {
      try {
        // Apply drift compensation
        const compensatedTime = event.time - this.currentDrift;
        
        // Schedule with Tone.js
        const scheduleId = tone.Transport.schedule((time) => {
          try {
            event.callback(time);
            this.metrics.totalEvents++;
          } catch (error) {
            console.error('Event callback error:', error);
            this.metrics.missedEvents++;
          }
          this.scheduledEvents.delete(event.id);
        }, compensatedTime);
        
        this.scheduledEvents.set(event.id, scheduleId);
      } catch (error) {
        console.error('Failed to schedule event:', error);
        this.metrics.missedEvents++;
      }
    }
    
    // Clean up old events
    this.cleanupOldEvents(currentTime);
    
    this.scheduledUntil = scheduleUntil;
  }
  
  /**
   * Clean up events that have passed
   */
  private cleanupOldEvents(currentTime: number): void {
    this.eventQueue = this.eventQueue.filter(event => {
      if (event.time <= currentTime) {
        // Remove from scheduled map if still there (shouldn't happen)
        if (this.scheduledEvents.has(event.id)) {
          console.warn(`Event ${event.id} passed without execution`);
          this.scheduledEvents.delete(event.id);
          this.metrics.missedEvents++;
        }
        return false;
      }
      return true;
    });
  }
  
  /**
   * Update performance metrics
   */
  private updateMetrics(): void {
    const now = performance.now();
    
    if (this.lastUpdateTime > 0) {
      const actualInterval = now - this.lastUpdateTime;
      
      // Calculate update rate (protect against division by zero)
      if (actualInterval > 0) {
        this.metrics.updateRate = 1000 / actualInterval;
      } else {
        this.metrics.updateRate = 0; // Avoid Infinity
      }
    }
    
    // Note: stability is now calculated in detectAndCompensateDrift() based on drift history
    this.updateCount++;
    
    // Estimate CPU load (simplified)
    const processingTime = performance.now() - now;
    this.metrics.cpuLoad = Math.min(100, (processingTime / (this.config.scheduleInterval * 1000)) * 100);
    
    // Buffer health (based on lookahead utilization)
    const tone = this.audioEngine.getTone();
    const bufferedTime = this.scheduledUntil - tone.Transport.seconds;
    this.metrics.bufferHealth = Math.min(100, (bufferedTime / this.config.lookAheadTime) * 100);
  }
  
  /**
   * Update musical position from transport
   */
  private updateMusicalPosition(): void {
    const tone = this.audioEngine.getTone();
    let calculatedSeconds = 0; // Define at method scope
    
    // Use AudioWorklet frame position for continuous updates if available
    if (this.audioWorkletNode && this.lastAudioWorkletFrame > 0) {
      // Calculate position from sample-accurate frame count
      const audioContext = this.audioEngine.getContext();
      const sampleRate = audioContext?.sampleRate || 48000;
      calculatedSeconds = this.lastAudioWorkletFrame / sampleRate;
      const bpm = tone.Transport.bpm.value;
      const beatsPerSecond = bpm / 60;
      const totalBeats = calculatedSeconds * beatsPerSecond;
      const beatsPerBar = this.config.timeSignature.numerator;
      
      const bars = Math.floor(totalBeats / beatsPerBar);
      const beatsInBar = totalBeats % beatsPerBar;
      const beats = Math.floor(beatsInBar);
      const fractionalBeat = beatsInBar % 1;
      const sixteenthsInBeat = fractionalBeat * 4;
      const sixteenths = Math.floor(sixteenthsInBeat);
      const fractionalSixteenth = sixteenthsInBeat % 1;
      
      // Calculate ticks with sub-sixteenth precision
      // 960 ticks per quarter note, so 240 ticks per sixteenth
      const ticksPerSixteenth = 240;
      const ticks = Math.floor(sixteenthsInBeat * ticksPerSixteenth);
      
      this.musicalPosition = {
        bars,
        beats,
        sixteenths,
        ticks // Now includes fractional sixteenth precision
      };
      
      // Update Tone.js transport to match our position (prevents freezing)
      const newPosition = `${bars}:${beats}:${sixteenths}`;
      if (tone.Transport.position !== newPosition) {
        tone.Transport.position = newPosition;
      }
    } else {
      // Fallback to Tone.js position
      const position = tone.Transport.position as string; // "bars:beats:sixteenths"
      const [bars, beats, sixteenths] = position.split(':').map(Number);
      
      this.musicalPosition = {
        bars: bars || 0,
        beats: beats || 0,
        sixteenths: sixteenths || 0,
        ticks: Math.floor((sixteenths || 0) * (960 / 16)) // Convert to MIDI ticks
      };
    }
    
    // Emit position update event for UI
    const currentPosition = this.getCurrentPosition();
    
    // Debug: Log tick changes to verify smooth updates
    if (this.updateCount <= 10) {
      console.log('🎯 Position update:', {
        bars: this.musicalPosition.bars,
        beats: this.musicalPosition.beats, 
        sixteenths: this.musicalPosition.sixteenths,
        ticks: this.musicalPosition.ticks,
        frameBasedSeconds: calculatedSeconds
      });
    }
    
    if (this.updateCount <= 5 || this.updateCount % 100 === 0) {
      console.log('📡 Emitting transport:position-updated event:', currentPosition, 'EventBus ID:', (this.eventBus as any)._instanceId || 'no-id');
    }
    this.eventBus.emit('transport:position-updated', {
      position: currentPosition
    });
    
    // Debug log every 200th update to avoid spam
    if (this.updateCount % 200 === 0) {
      console.log('updateMusicalPosition:', {
        usingAudioWorklet: !!this.audioWorkletNode,
        lastAudioWorkletFrame: this.lastAudioWorkletFrame,
        calculatedSeconds: this.lastAudioWorkletFrame > 0 ? (this.lastAudioWorkletFrame / (this.audioContext?.sampleRate || 48000)) : 0,
        position: this.musicalPosition,
        transportPosition: tone.Transport.position,
        seconds: tone.Transport.seconds
      });
    }
    
    // Handle looping
    if (this.loopEnabled) {
      const currentTotalSixteenths = this.positionToSixteenths(this.musicalPosition);
      const loopEndSixteenths = this.positionToSixteenths(this.loopEnd);
      
      if (currentTotalSixteenths >= loopEndSixteenths) {
        this.seek(this.loopStart);
      }
    }
  }
  
  /**
   * Convert musical position to total sixteenths
   */
  private positionToSixteenths(position: MusicalPosition): number {
    const beatsPerBar = this.config.timeSignature.numerator;
    const sixteenthsPerBeat = 4; // Always 4 sixteenths per beat
    
    return position.bars * beatsPerBar * sixteenthsPerBeat +
           position.beats * sixteenthsPerBeat +
           position.sixteenths;
  }
  
  // Public API
  
  /**
   * Start transport playback
   */
  async start(): Promise<void> {
    // CRITICAL: Ensure transport is initialized before starting
    if (!this.isInitialized) {
      console.error('UnifiedTransport.start(): Transport not initialized! Call initialize() first.');
      await this.initialize();
    }
    
    await this.circuitBreaker.execute(async () => {
      if (this.state === 'playing') return;
      
      const tone = this.audioEngine.getTone();
      
      // CRITICAL: Use AudioEngine's context directly, not tone.context
      // Tone.js context should be the same, but let's be explicit
      const audioEngineContext = this.audioEngine.getContext();
      const toneContext = tone.context;
      
      // Debug context references
      // Note: toneContext is a Tone.Context wrapper, get the raw AudioContext for comparison
      const toneRawContext = (toneContext as any)._context || (toneContext as any).rawContext || toneContext;
      console.log('UnifiedTransport.start() context check:', {
        audioEngineContext: audioEngineContext?.state,
        toneContext: toneContext.state,
        sameInstance: audioEngineContext === toneRawContext,
        audioEngineCtx: audioEngineContext,
        toneRawCtx: toneRawContext
      });
      
      // Use AudioEngine's context as the source of truth
      if (audioEngineContext?.state === 'suspended') {
        console.log('UnifiedTransport: AudioEngine context is suspended, attempting to resume...');
        try {
          // Use AudioEngine's start method which handles context resume properly
          await this.audioEngine.start();
          
          // Give it a moment to actually start
          await new Promise(resolve => setTimeout(resolve, 50));
          console.log(`UnifiedTransport: AudioContext state after AudioEngine.start(): ${audioEngineContext.state}`);
          
          // If still suspended, we have a problem
          if (audioEngineContext.state === 'suspended') {
            throw new Error('AudioContext could not be resumed - ensure this is called from a user gesture');
          }
        } catch (error) {
          console.error('UnifiedTransport: Failed to resume AudioContext:', error);
          throw new Error('AudioContext suspended - could not resume from current context');
        }
      }
      
      // CRITICAL: Ensure Tone.js context is also started
      if (toneContext.state === 'suspended') {
        console.log('UnifiedTransport: Tone.js context is suspended, starting...');
        await tone.start();
        console.log(`UnifiedTransport: Tone.js context state after start: ${toneContext.state}`);
      }
      
      // CRITICAL: Reset transport position FIRST to ensure clean state
      if (tone.Transport.seconds > 0.01) {
        tone.Transport.stop();
        tone.Transport.position = 0;
        tone.Transport.seconds = 0;
        tone.Transport.cancel(); // Clear all scheduled events
      }
      
      // CRITICAL: Reset AudioWorklet timing state BEFORE starting
      this.audioWorkletBaselineTime = 0;
      this.lastAudioWorkletTime = 0;
      this.lastAudioWorkletFrame = 0;
      this.skipInitialSyncUpdates = 0;
      
      // CRITICAL: If AudioContext is now running but we don't have a working AudioWorklet, reinitialize it
      // This must happen AFTER transport reset to ensure both start from the same baseline
      console.log('🔍 AudioWorklet check:', {
        audioEngineContextState: audioEngineContext?.state,
        toneContextState: toneContext.state,
        enableAudioWorklet: this.config.enableAudioWorklet,
        audioWorkletNode: !!this.audioWorkletNode,
        shouldInitialize: audioEngineContext?.state === 'running' && this.config.enableAudioWorklet && !this.audioWorkletNode
      });
      
      if (audioEngineContext?.state === 'running' && this.config.enableAudioWorklet && !this.audioWorkletNode) {
        console.log('🎯 AudioContext is running but AudioWorklet not initialized - reinitializing...');
        await this.reinitializeAudioWorklet();
      }
      
      // Update state
      this.state = 'playing';
      this.startTime = tone.context.currentTime;
      
      // Pattern scheduling now handled by individual tracks
      
      // Reset ALL timing state to prevent drift
      this.lastUpdateTime = performance.now();
      this.lastTransportTime = undefined; // Will be set on first update
      this.currentDrift = 0;
      this.driftHistory = [];
      this.skipDriftChecks = 0; // No need to skip on fresh start
      this.lastAudioWorkletTime = 0;
      this.lastAudioWorkletFrame = 0;
      
      // Reset metrics
      this.metrics.avgDrift = 0;
      this.metrics.maxDrift = 0;
      this.metrics.jitter = 0;
      
      // FINAL AudioWorklet check right before starting transport
      if (audioEngineContext?.state === 'running' && this.config.enableAudioWorklet && !this.audioWorkletNode) {
        console.log('🎯 FINAL CHECK: AudioContext is running but AudioWorklet still not initialized - last attempt...');
        await this.reinitializeAudioWorklet();
      }

      // Start timing updates BEFORE starting transport to ensure synchronization
      if (this.audioWorkletNode) {
        // CRITICAL: First send stop to reset AudioWorklet internal state
        this.audioWorkletNode.port.postMessage({ type: 'stop' });
        
        // Reset our tracking variables immediately
        this.lastAudioWorkletTime = 0;
        this.lastAudioWorkletFrame = 0;
        this.audioWorkletStartTime = 0; // Fresh start from 0
        this.audioWorkletTimeOffset = 0; // Reset offset - will be recalculated on first update
        this.expectedSessionId++; // Increment expected session ID
        this.expectedMessageSequence = 0; // Reset expected sequence for new session
        
        // Add a small delay to ensure stop message is processed before start
        // AudioWorklet processes messages asynchronously from the audio thread
        await new Promise(resolve => setTimeout(resolve, 5)); // 5ms delay
        
        // Start AudioWorklet BEFORE Transport to minimize timing offset
        this.audioWorkletNode.port.postMessage({ 
          type: 'start',
          fromFrame: 0
        });
        
        // Small delay to let AudioWorklet start processing
        await new Promise(resolve => setTimeout(resolve, 10)); // 10ms delay
      }
      
      // Now start transport - both should be synchronized
      tone.Transport.start();
      
      if (!this.audioWorkletNode && this.timingWorker) {
        this.timingWorker.postMessage({ 
          type: 'start',
          startTime: performance.now()
        });
      } else if (!this.audioWorkletNode && !this.timingWorker && !this.updateTimer) {
        // Fallback: Create interval timer if no other timing source is available
        console.log('⚠️ No timing source available, creating fallback interval timer');
        this.initializeIntervalTiming();
      }
      
      // Restart hardware clock sync if enabled
      if (this.useHardwareClock) {
        this.startClockSync();
      }
      
      // Emit event
      this.eventBus.emit('transport:start', {
        position: this.musicalPosition,
        tempo: this.config.tempo,
        timeSignature: this.config.timeSignature
      });
      
      console.log('▶️ UnifiedTransport started');
    });
  }
  
  /**
   * Stop transport playback
   */
  async stop(): Promise<void> {
    await this.circuitBreaker.execute(async () => {
      if (this.state === 'stopped') return;
      
      const tone = this.audioEngine.getTone();
      
      // Stop transport and reset position to 0
      tone.Transport.stop();
      tone.Transport.position = 0;
      tone.Transport.seconds = 0;
      
      // Clear all scheduled events
      for (const [eventId, scheduleId] of this.scheduledEvents) {
        tone.Transport.clear(scheduleId);
      }
      this.scheduledEvents.clear();
      this.eventQueue = [];
      
      // Update state
      this.state = 'stopped';
      this.musicalPosition = { bars: 0, beats: 0, sixteenths: 0, ticks: 0 };
      
      // Pattern scheduling stopped with tracks
      
      // Reset timing state
      this.lastUpdateTime = 0;
      this.lastTransportTime = undefined;
      this.currentDrift = 0;
      this.driftHistory = [];
      this.pauseTime = 0;
      this.pausePosition = '0:0:0';
      this.lastAudioWorkletTime = 0;
      this.lastAudioWorkletFrame = 0;
      this.audioWorkletStartTime = 0;
      this.audioWorkletTimeOffset = 0; // Reset offset
      // Increment expected session ID to match AudioWorklet's behavior
      this.expectedSessionId++;
      this.expectedMessageSequence = 0; // Reset message sequence for new session
      console.log(`🔄 UnifiedTransport stop: Incremented expectedSessionId to ${this.expectedSessionId}`)
      
      // Stop timing updates
      if (this.audioWorkletNode) {
        // First increment expected session ID before sending stop
        // This ensures we ignore any remaining messages from the current session
        this.audioWorkletNode.port.postMessage({ type: 'stop' });
        
        // Clear any pending messages by temporarily removing the message handler
        // This prevents processing stale timing updates that might still be in flight
        if (this.audioWorkletMessageHandler) {
          const originalHandler = this.audioWorkletMessageHandler;
          this.audioWorkletNode.port.onmessage = null;
          
          // Restore handler after a brief delay to allow clearing of message queue
          setTimeout(() => {
            if (this.audioWorkletNode && originalHandler === this.audioWorkletMessageHandler) {
              this.audioWorkletNode.port.onmessage = originalHandler;
            }
          }, 50); // 50ms should be enough to clear any pending messages
        }
      } else if (this.timingWorker) {
        this.timingWorker.postMessage({ type: 'stop' });
      } else if (this.updateTimer) {
        // Clear interval timer if it's being used
        clearInterval(this.updateTimer);
        this.updateTimer = null;
      }
      
      // Stop hardware clock sync if enabled
      if (this.useHardwareClock) {
        this.stopClockSync();
      }
      
      // Emit event
      this.eventBus.emit('transport:stop', {
        position: this.musicalPosition
      });
      
      console.log('⏹️ UnifiedTransport stopped');
    });
  }
  
  /**
   * Pause transport playback immediately (<2ms response)
   */
  async pauseImmediate(): Promise<void> {
    await this.circuitBreaker.execute(async () => {
      if (this.state !== 'playing') return;
      
      const tone = this.audioEngine.getTone();
      
      // Immediate pause - no quantum scheduling
      const currentPosition = tone.Transport.position as string;
      const currentSeconds = tone.Transport.seconds;
      
      // Immediate pause with <2ms latency
      
      // Stop transport immediately
      tone.Transport.pause();
      
      // Store exact pause position
      this.pauseTime = currentSeconds;
      this.pausePosition = currentPosition;
      this.pauseSampleTime = this.audioContext?.currentTime || 0;
      
      // Pre-buffer upcoming events for seamless resume
      this.preBufferUpcomingEvents(currentSeconds);
      
      // Update state
      this.state = 'paused';
      
      // Stop timing updates
      if (this.audioWorkletNode) {
        this.audioWorkletNode.port.postMessage({ type: 'pause' });
      } else if (this.timingWorker) {
        this.timingWorker.postMessage({ type: 'stop' });
      }
      
      // Stop hardware clock sync during pause
      if (this.useHardwareClock) {
        this.stopClockSync();
      }
      
      // Emit event
      this.eventBus.emit('transport:pause', {
        position: this.musicalPosition,
        immediate: true
      });
      
      console.log('⏸️ UnifiedTransport paused immediately');
    });
  }

  /**
   * Pause transport playback with sample-accurate scheduling (legacy method)
   */
  async pause(): Promise<void> {
    // For backward compatibility, use immediate pause by default
    return this.pauseImmediate();
  }
  
  /**
   * Pause transport at quantum boundary (original behavior)
   */
  async pauseAtQuantum(quantum?: string): Promise<void> {
    await this.circuitBreaker.execute(async () => {
      if (this.state !== 'playing') return;
      
      const tone = this.audioEngine.getTone();
      
      // Professional approach: Schedule pause at next quantum boundary
      const nextQuantum = tone.Transport.nextSubdivision(quantum || this.pauseQuantum);
      
      // Store the exact position we'll pause at
      const currentPosition = tone.Transport.position as string;
      const currentSeconds = tone.Transport.seconds;
      const currentSampleTime = this.useHardwareClock ? 
        this.getHardwareSyncedTime() : 
        tone.context.currentTime;
      
      // Calculate exact pause position
      const quantumOffset = nextQuantum - currentSeconds;
      const pauseAtSeconds = currentSeconds + quantumOffset;
      
      console.log('🎯 Professional PAUSE scheduling:', {
        currentPosition,
        currentSeconds,
        nextQuantum,
        quantumOffset,
        willPauseAt: pauseAtSeconds,
        sampleTime: currentSampleTime
      });
      
      // Schedule the pause at the quantum boundary
      tone.Transport.pause(nextQuantum);
      
      // Store sample-accurate position data
      this.pauseTime = pauseAtSeconds;
      this.pauseSampleTime = currentSampleTime + quantumOffset;
      
      // Pre-buffer upcoming events for seamless resume
      this.preBufferUpcomingEvents(pauseAtSeconds);
      
      // Calculate the musical position at pause time
      const beatsPerBar = this.config.timeSignature.numerator;
      const secondsPerBeat = 60 / tone.Transport.bpm.value;
      const totalBeats = pauseAtSeconds / secondsPerBeat;
      const bars = Math.floor(totalBeats / beatsPerBar);
      const beats = Math.floor(totalBeats % beatsPerBar);
      const sixteenths = Math.floor((totalBeats % 1) * 4);
      
      this.pausePosition = `${bars}:${beats}:${sixteenths}`;
      
      console.log('🔍 PAUSE scheduled:', {
        pauseTime: this.pauseTime,
        pausePosition: this.pausePosition,
        pauseSampleTime: this.pauseSampleTime,
        transportState: tone.Transport.state
      });
      
      // Update state
      this.state = 'paused';
      
      // Stop timing updates
      if (this.audioWorkletNode) {
        this.audioWorkletNode.port.postMessage({ type: 'pause' });
      } else if (this.timingWorker) {
        this.timingWorker.postMessage({ type: 'stop' });
      }
      
      // Stop hardware clock sync during pause
      if (this.useHardwareClock) {
        this.stopClockSync();
      }
      
      // Emit event
      this.eventBus.emit('transport:pause', {
        position: this.musicalPosition,
        scheduledAt: pauseAtSeconds
      });
      
      console.log('⏸️ UnifiedTransport pause scheduled');
    });
  }
  
  /**
   * Resume from pause immediately (<2ms response)
   */
  async resumeImmediate(): Promise<void> {
    if (this.state !== 'paused') return;
    
    await this.circuitBreaker.execute(async () => {
      const tone = this.audioEngine.getTone();
      
      // Immediate resume with <2ms latency
      
      // Stop transport to reset state
      tone.Transport.stop();
      
      // Set transport to exact pause position
      tone.Transport.seconds = this.pauseTime;
      tone.Transport.position = this.pausePosition;
      
      // Start immediately
      tone.Transport.start('+0', this.pauseTime);
      
      // Apply pre-buffered events for seamless resume
      const currentTime = tone.context.currentTime;
      this.applyPreBufferedEvents(currentTime);
      
      // Reset drift tracking immediately
      this.lastUpdateTime = performance.now();
      this.lastTransportTime = this.pauseTime;
      this.driftHistory = [];
      this.currentDrift = 0;
      this.skipDriftChecks = 10;
      // Don't reset AudioWorklet timing - it needs to continue from pause position
      // this.lastAudioWorkletTime = 0;  // REMOVED - was breaking continuous timing
      // this.lastAudioWorkletFrame = 0; // REMOVED - was breaking continuous timing
      
      // Update state
      this.state = 'playing';
      
      // Restart timing updates
      if (this.audioWorkletNode) {
        const pauseFrames = Math.floor(this.pauseTime * this.audioContext!.sampleRate);
        this.audioWorkletNode.port.postMessage({ 
          type: 'start',
          fromFrame: pauseFrames
        });
      } else if (this.timingWorker) {
        this.timingWorker.postMessage({ type: 'start' });
      }
      
      // Restart hardware clock sync if enabled
      if (this.useHardwareClock) {
        this.startClockSync();
      }
      
      // Emit event
      this.eventBus.emit('transport:resume', {
        position: this.musicalPosition,
        immediate: true
      });
      
      console.log('▶️ UnifiedTransport resumed immediately');
    });
  }

  /**
   * Resume from pause with sample-accurate scheduling (legacy method)
   */
  async resume(): Promise<void> {
    // For backward compatibility, use immediate resume by default
    return this.resumeImmediate();
  }
  
  /**
   * Resume at quantum boundary (original behavior)
   */
  async resumeAtQuantum(quantum?: string): Promise<void> {
    if (this.state !== 'paused') return;
    
    await this.circuitBreaker.execute(async () => {
      const tone = this.audioEngine.getTone();
      
      console.log('🎯 Professional RESUME scheduling:', {
        pauseTime: this.pauseTime,
        pausePosition: this.pausePosition,
        pauseSampleTime: this.pauseSampleTime,
        currentSampleTime: tone.context.currentTime
      });
      
      // Professional approach: Pre-calculate exact resume timing
      const currentTime = this.useHardwareClock ? 
        this.getHardwareSyncedTime() : 
        tone.context.currentTime;
      const resumeQuantum = tone.Transport.nextSubdivision(quantum || this.pauseQuantum);
      
      // Stop transport to reset state
      tone.Transport.stop();
      
      // Set transport to exact pause position
      tone.Transport.seconds = this.pauseTime;
      tone.Transport.position = this.pausePosition;
      
      // Calculate sample-accurate offset
      const sampleOffset = this.pauseSampleTime - currentTime;
      
      // Schedule the start with sample accuracy
      // Use AudioContext time for perfect synchronization
      const resumeTime = Math.max(currentTime + 0.005, resumeQuantum); // 5ms minimum buffer
      
      console.log('🎯 Scheduling resume:', {
        resumeAt: resumeTime,
        currentContextTime: currentTime,
        offset: resumeTime - currentTime,
        transportPosition: this.pausePosition
      });
      
      // Schedule the transport start at the precise time
      tone.Transport.start(resumeTime, this.pauseTime);
      
      // Apply pre-buffered events for seamless resume
      this.applyPreBufferedEvents(resumeTime);
      
      // Reset drift tracking immediately
      this.lastUpdateTime = performance.now();
      this.lastTransportTime = this.pauseTime;
      this.driftHistory = [];
      this.currentDrift = 0;
      this.skipDriftChecks = 10; // Skip the next 10 drift checks after resume
      // Don't reset AudioWorklet timing - it needs to continue from pause position
      // this.lastAudioWorkletTime = 0;  // REMOVED - was breaking continuous timing
      // this.lastAudioWorkletFrame = 0; // REMOVED - was breaking continuous timing
      
      console.log('📍 Position tracking reset at resume');
      
      // Update state
      this.state = 'playing';
      
      // Restart timing updates
      if (this.audioWorkletNode) {
        // Resume from the exact pause frame
        const pauseFrames = Math.floor(this.pauseTime * this.audioContext!.sampleRate);
        this.audioWorkletNode.port.postMessage({ 
          type: 'start',
          fromFrame: pauseFrames
        });
      } else if (this.timingWorker) {
        this.timingWorker.postMessage({ type: 'start' });
      }
      
      // Restart hardware clock sync if enabled
      if (this.useHardwareClock) {
        this.startClockSync();
      }
      
      // Emit event with scheduled time
      this.eventBus.emit('transport:resume', {
        position: this.musicalPosition,
        scheduledAt: resumeTime
      });
      
      console.log('▶️ UnifiedTransport resume scheduled');
    });
  }
  
  /**
   * Seek to a specific position
   */
  async seek(position: MusicalPosition): Promise<void> {
    await this.circuitBreaker.execute(async () => {
      const tone = this.audioEngine.getTone();
      
      // Convert to transport position string
      const transportPosition = `${position.bars}:${position.beats}:${position.sixteenths}`;
      tone.Transport.position = transportPosition;
      
      // Update internal position
      this.musicalPosition = { ...position };
      
      // Update AudioWorklet position
      if (this.audioWorkletNode) {
        // Convert musical position to seconds
        const bpm = tone.Transport.bpm.value;
        const beatsPerSecond = bpm / 60;
        const beatsPerBar = this.config.timeSignature.numerator;
        const totalBeats = position.bars * beatsPerBar + position.beats + position.sixteenths / 4;
        const seconds = totalBeats / beatsPerSecond;
        
        this.audioWorkletNode.port.postMessage({ 
          type: 'seek',
          position: seconds
        });
      }
      
      // Clear and reschedule events if playing
      if (this.state === 'playing') {
        // Clear current events
        for (const [eventId, scheduleId] of this.scheduledEvents) {
          tone.Transport.clear(scheduleId);
        }
        this.scheduledEvents.clear();
        
        // Force immediate reschedule
        this.handleTimingUpdate('Seek');
      }
      
      // Emit event
      this.eventBus.emit('transport:seek', {
        position: this.musicalPosition
      });
    });
  }
  
  /**
   * Set tempo (BPM)
   */
  setTempo(bpm: number): void {
    if (bpm < 20 || bpm > 999) {
      throw new Error(`Invalid tempo: ${bpm}. Must be between 20 and 999 BPM.`);
    }
    
    this.config.tempo = bpm;
    const tone = this.audioEngine.getTone();
    tone.Transport.bpm.value = bpm;
    
    this.eventBus.emit('transport:tempo-change', { tempo: bpm });
  }
  
  /**
   * Set time signature
   */
  setTimeSignature(numerator: number, denominator: number): void {
    this.config.timeSignature = { numerator, denominator };
    const tone = this.audioEngine.getTone();
    tone.Transport.timeSignature = [numerator, denominator];
    
    this.eventBus.emit('transport:time-signature-change', { 
      timeSignature: this.config.timeSignature 
    });
  }
  
  /**
   * Enable/disable loop with musical positions
   */
  setLoopMusical(enabled: boolean, start?: MusicalPosition, end?: MusicalPosition): void {
    this.loopEnabled = enabled;
    
    if (start) this.loopStart = { ...start };
    if (end) this.loopEnd = { ...end };
    
    // Note: We handle looping manually in updateMusicalPosition()
    // instead of using Tone.Transport.loop to have more control
    
    this.eventBus.emit('transport:loop-change', {
      enabled,
      start: this.loopStart,
      end: this.loopEnd
    });
  }
  
  /**
   * Schedule a timing event
   */
  scheduleEvent(event: Omit<TimingEvent, 'id'>): string {
    const id = `event_${++this.eventIdCounter}`;
    const fullEvent: TimingEvent = { ...event, id };
    
    this.eventQueue.push(fullEvent);
    
    // If we're playing and the event is within lookahead, schedule immediately
    if (this.state === 'playing') {
      const tone = this.audioEngine.getTone();
      const currentTime = tone.Transport.seconds;
      if (event.time <= currentTime + this.config.lookAheadTime) {
        this.scheduleEvents(currentTime);
      }
    }
    
    return id;
  }
  
  /**
   * Cancel a scheduled event
   */
  cancelEvent(eventId: string): void {
    // Remove from queue
    this.eventQueue = this.eventQueue.filter(e => e.id !== eventId);
    
    // Cancel if already scheduled
    const scheduleId = this.scheduledEvents.get(eventId);
    if (scheduleId !== undefined) {
      const tone = this.audioEngine.getTone();
      tone.Transport.clear(scheduleId);
      this.scheduledEvents.delete(eventId);
    }
  }
  
  /**
   * Schedule a repeating event
   */
  scheduleRepeat(
    callback: (time: number) => void,
    interval: string | number,
    startTime?: number,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): string {
    const tone = this.audioEngine.getTone();
    const id = `repeat_${++this.eventIdCounter}`;
    
    // Use Tone's scheduleRepeat for efficiency
    const scheduleId = tone.Transport.scheduleRepeat((time) => {
      try {
        callback(time);
        this.metrics.totalEvents++;
      } catch (error) {
        console.error('Repeat callback error:', error);
        this.metrics.missedEvents++;
      }
    }, interval, startTime);
    
    this.scheduledEvents.set(id, scheduleId);
    
    return id;
  }
  
  /**
   * Get current state
   */
  getState(): TransportState {
    return this.state;
  }
  
  /**
   * Get current position
   */
  getPosition(): MusicalPosition {
    return { ...this.musicalPosition };
  }
  
  /**
   * Get current tempo
   */
  getTempo(): number {
    return this.config.tempo;
  }
  
  /**
   * Get timing metrics
   */
  getMetrics(): TimingMetrics {
    return { ...this.metrics };
  }
  
  /**
   * @deprecated Pattern scheduling is now handled by the track system
   * This method has been removed as part of the track system migration
   */
  
  /**
   * Get transport response latency
   * @returns Latency in milliseconds (<2ms with AudioWorklet)
   */
  getTransportLatency(): number {
    if (this.audioWorkletNode) {
      // AudioWorklet provides 128-sample buffer latency
      const sampleRate = this.audioContext?.sampleRate || 48000;
      return (128 / sampleRate) * 1000; // ~2.67ms at 48kHz
    } else if (this.timingWorker) {
      // WebWorker timing interval
      return this.config.scheduleInterval * 1000;
    } else {
      // Fallback interval timing
      return this.config.scheduleInterval * 1000;
    }
  }
  
  /**
   * Get configuration
   */
  getConfig(): Readonly<TransportConfig> {
    return { ...this.config };
  }
  
  /**
   * Get current time signature (backward compatibility)
   */
  getTimeSignature(): TimeSignature {
    return { ...this.config.timeSignature };
  }
  
  /**
   * Get current position (backward compatibility - returns TransportPosition format)
   */
  getCurrentPosition(): TransportPosition {
    const tone = this.audioEngine.getTone();
    const audioContext = this.audioEngine.getContext();
    const sampleRate = audioContext?.sampleRate || 48000;
    
    // Calculate seconds from frames for consistency
    const frameBasedSeconds = this.lastAudioWorkletFrame > 0 
      ? this.lastAudioWorkletFrame / sampleRate
      : tone.Transport.seconds;
    
    return {
      bars: this.musicalPosition.bars,
      beats: this.musicalPosition.beats,
      sixteenths: this.musicalPosition.sixteenths,
      ticks: this.musicalPosition.ticks,
      seconds: frameBasedSeconds,
      // Add frame data for widgets to use
      frame: this.lastAudioWorkletFrame,
      sampleRate: sampleRate
    };
  }
  
  /**
   * Check if loop is enabled (backward compatibility)
   */
  isLoopEnabled(): boolean {
    return this.loopEnabled;
  }
  
  /**
   * Seek to position (backward compatibility - synchronous wrapper)
   */
  seekTo(position: MusicalPosition | number): void {
    if (typeof position === 'number') {
      // Seek to seconds
      const tone = this.audioEngine.getTone();
      tone.Transport.seconds = position;
      
      // Update musical position
      this.updateMusicalPosition();
      
      // Emit event
      this.eventBus.emit('transport:seeked', {
        position: this.musicalPosition
      });
    } else {
      // Seek to musical position - use async seek but don't await
      this.seek(position).catch(error => {
        console.error('Seek error:', error);
      });
    }
  }
  
  /**
   * Schedule a callback (backward compatibility)
   */
  schedule(callback: (time: number) => void, time: number): void {
    const tone = this.audioEngine.getTone();
    tone.Transport.schedule(callback, time);
  }
  
  /**
   * Clear a scheduled event (backward compatibility)
   */
  clear(id: number): void {
    const tone = this.audioEngine.getTone();
    tone.Transport.clear(id);
  }
  
  /**
   * Get next beat time (backward compatibility)
   */
  getNextBeatTime(): number {
    const currentPos = this.musicalPosition;
    const nextBeat = currentPos.beats + 1;
    const beatsPerBar = this.config.timeSignature.numerator;
    
    let nextPosition: MusicalPosition;
    if (nextBeat >= beatsPerBar) {
      nextPosition = {
        bars: currentPos.bars + 1,
        beats: 0,
        sixteenths: 0,
        ticks: 0
      };
    } else {
      nextPosition = {
        bars: currentPos.bars,
        beats: nextBeat,
        sixteenths: 0,
        ticks: 0
      };
    }
    
    // Convert to seconds (simplified - assumes 4/4 time)
    const bpm = this.config.tempo;
    const beatDuration = 60 / bpm;
    const barDuration = beatDuration * beatsPerBar;
    
    return nextPosition.bars * barDuration + nextPosition.beats * beatDuration;
  }
  
  /**
   * Get next bar time (backward compatibility)
   */
  getNextBarTime(): number {
    const currentPos = this.musicalPosition;
    const nextBar = currentPos.bars + 1;
    
    // Convert to seconds
    const bpm = this.config.tempo;
    const beatDuration = 60 / bpm;
    const beatsPerBar = this.config.timeSignature.numerator;
    const barDuration = beatDuration * beatsPerBar;
    
    return nextBar * barDuration;
  }
  
  // Additional backward compatibility methods
  
  /**
   * Check if transport is playing (backward compatibility)
   */
  isPlaying(): boolean {
    return this.state === 'playing';
  }
  
  /**
   * Get position in seconds (backward compatibility)
   */
  getPositionInSeconds(): number {
    const tone = this.audioEngine.getTone();
    return tone.Transport.seconds;
  }
  
  /**
   * Set position in seconds (backward compatibility - async wrapper)
   */
  async setPosition(seconds: number): Promise<void> {
    this.seekTo(seconds);
  }
  
  /**
   * Get BPM (backward compatibility)
   */
  getBPM(): number {
    return this.getTempo();
  }
  
  /**
   * Set BPM (backward compatibility - async wrapper)
   */
  async setBPM(bpm: number): Promise<void> {
    this.setTempo(bpm);
  }
  
  /**
   * Get loop start in seconds (backward compatibility)
   */
  getLoopStart(): number {
    // Convert musical position to seconds
    const bpm = this.config.tempo;
    const beatDuration = 60 / bpm;
    const beatsPerBar = this.config.timeSignature.numerator;
    return this.loopStart.bars * beatsPerBar * beatDuration + 
           this.loopStart.beats * beatDuration +
           this.loopStart.sixteenths * (beatDuration / 4);
  }
  
  /**
   * Get loop end in seconds (backward compatibility)
   */
  getLoopEnd(): number {
    // Convert musical position to seconds
    const bpm = this.config.tempo;
    const beatDuration = 60 / bpm;
    const beatsPerBar = this.config.timeSignature.numerator;
    return this.loopEnd.bars * beatsPerBar * beatDuration + 
           this.loopEnd.beats * beatDuration +
           this.loopEnd.sixteenths * (beatDuration / 4);
  }
  
  /**
   * Disable loop (backward compatibility)
   */
  async disableLoop(): Promise<void> {
    this.setLoop(false);
  }
  
  /**
   * Set loop with start/end in seconds (backward compatibility override)
   */
  async setLoop(startOrEnabled: boolean | number, end?: number): Promise<void> {
    if (typeof startOrEnabled === 'boolean') {
      // Original setLoop(enabled) call
      this.loopEnabled = startOrEnabled;
      this.eventBus.emit('transport:loop-change', {
        enabled: startOrEnabled,
        start: this.loopStart,
        end: this.loopEnd
      });
    } else {
      // Backward compatibility: setLoop(start, end) with seconds
      const start = startOrEnabled;
      if (end === undefined) {
        throw new Error('End time required when setting loop with start time');
      }
      
      // Convert seconds to musical position
      const bpm = this.config.tempo;
      const beatDuration = 60 / bpm;
      const beatsPerBar = this.config.timeSignature.numerator;
      
      // Convert start seconds to musical position
      const startBars = Math.floor(start / (beatsPerBar * beatDuration));
      const startBeatsRemainder = (start % (beatsPerBar * beatDuration)) / beatDuration;
      const startBeats = Math.floor(startBeatsRemainder);
      const startSixteenths = Math.floor((startBeatsRemainder % 1) * 4);
      
      // Convert end seconds to musical position
      const endBars = Math.floor(end / (beatsPerBar * beatDuration));
      const endBeatsRemainder = (end % (beatsPerBar * beatDuration)) / beatDuration;
      const endBeats = Math.floor(endBeatsRemainder);
      const endSixteenths = Math.floor((endBeatsRemainder % 1) * 4);
      
      this.loopStart = {
        bars: startBars,
        beats: startBeats,
        sixteenths: startSixteenths,
        ticks: 0
      };
      
      this.loopEnd = {
        bars: endBars,
        beats: endBeats,
        sixteenths: endSixteenths,
        ticks: 0
      };
      
      this.loopEnabled = true;
      
      this.eventBus.emit('transport:loop-change', {
        enabled: true,
        start: this.loopStart,
        end: this.loopEnd
      });
    }
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<TransportConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Apply relevant changes
    if (config.lookAheadTime !== undefined) {
      const tone = this.audioEngine.getTone();
      tone.context.lookAhead = config.lookAheadTime;
    }
    
    if (config.scheduleInterval !== undefined) {
      const tone = this.audioEngine.getTone();
      tone.context.updateInterval = config.scheduleInterval;
      
      // Update worker interval if using web worker
      if (this.timingWorker) {
        this.timingWorker.postMessage({ 
          type: 'updateInterval', 
          interval: config.scheduleInterval * 1000 
        });
      }
    }
    
    if (config.driftCompensation === 'adaptive' && !this.driftPredictor) {
      this.driftPredictor = new DriftPredictor();
    }
  }
  
  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    // Stop playback
    if (this.state !== 'stopped') {
      await this.stop();
    }
    
    // Cleanup timing resources
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
    
    if (this.timingWorker) {
      this.timingWorker.terminate();
    }
    
    if (this.audioWorkletNode) {
      if (this.audioWorkletMessageHandler) {
        this.audioWorkletNode.port.onmessage = null;
        this.audioWorkletMessageHandler = null;
      }
      this.audioWorkletNode.disconnect();
      this.audioWorkletNode = null;
    }
    
    // DON'T clear instance - UnifiedTransport is a singleton that should survive
    // UnifiedTransport.instance = null; // This breaks the singleton pattern!
  }
  
  // Service interface implementation
  getName(): string {
    return 'UnifiedTransport';
  }
  
  getHealth(): { status: 'healthy' | 'degraded' | 'unhealthy'; message?: string } {
    if (this.metrics.stability < 90) {
      return { status: 'degraded', message: `Low timing stability: ${this.metrics.stability.toFixed(1)}%` };
    }
    
    if (this.metrics.avgDrift > 5) {
      return { status: 'degraded', message: `High timing drift: ${this.metrics.avgDrift.toFixed(1)}ms` };
    }
    
    if (this.metrics.missedEvents > 10) {
      return { status: 'unhealthy', message: `Too many missed events: ${this.metrics.missedEvents}` };
    }
    
    return { status: 'healthy' };
  }
}

/**
 * Drift Predictor using Kalman filter for adaptive compensation
 */
class DriftPredictor {
  private kalmanFilter: KalmanFilter;
  
  constructor() {
    // Initialize Kalman filter for drift prediction
    this.kalmanFilter = new KalmanFilter({
      R: 0.01, // Measurement noise
      Q: 0.00001, // Process noise
      A: 1, // State transition
      B: 0, // Control transition
      C: 1, // Measurement
      x: 0, // Initial drift estimate
      P: 1, // Initial covariance
    });
  }
  
  predict(measuredDrift: number): number {
    // Update Kalman filter with new measurement
    const prediction = this.kalmanFilter.filter(measuredDrift);
    
    // Return predicted drift for compensation
    return prediction;
  }
}

/**
 * Simple Kalman filter implementation
 */
class KalmanFilter {
  private R: number; // Measurement noise
  private Q: number; // Process noise
  private A: number; // State transition
  private C: number; // Measurement
  private x: number; // State estimate
  private P: number; // Error covariance
  private K: number; // Kalman gain
  
  constructor(config: {
    R: number;
    Q: number;
    A: number;
    B: number;
    C: number;
    x: number;
    P: number;
  }) {
    this.R = config.R;
    this.Q = config.Q;
    this.A = config.A;
    this.C = config.C;
    this.x = config.x;
    this.P = config.P;
    this.K = 0;
  }
  
  filter(measurement: number): number {
    // Prediction step
    this.x = this.A * this.x;
    this.P = this.A * this.P * this.A + this.Q;
    
    // Update step
    this.K = this.P * this.C / (this.C * this.P * this.C + this.R);
    this.x = this.x + this.K * (measurement - this.C * this.x);
    this.P = (1 - this.K * this.C) * this.P;
    
    return this.x;
  }
}