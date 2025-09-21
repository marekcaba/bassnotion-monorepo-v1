/**
 * WorkerTimingManager - Manages Web Worker-based timing
 *
 * Provides a high-level interface to the TimingWorker,
 * handling communication and state synchronization.
 */

import { EventEmitter } from '../shared/index.js';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('WorkerTimingManager');

export interface WorkerTimingConfig {
  workerPath?: string;
  tempo?: number;
  beatsPerBar?: number;
  updateInterval?: number;
  useDriftCompensation?: boolean;
}

export interface WorkerTimingState {
  currentTime: number;
  currentBeat: number;
  currentBar: number;
  isPlaying: boolean;
  isPaused: boolean;
  tempo: number;
  drift: number;
}

export interface WorkerTimingUpdate {
  currentTime: number;
  currentBeat: number;
  currentBar: number;
  timestamp: DOMHighResTimeStamp;
  drift: number;
}

export class WorkerTimingManager extends EventEmitter {
  private worker: Worker | null = null;
  private config: Required<WorkerTimingConfig>;
  private state: WorkerTimingState;

  // Timing tracking
  private startTime = 0;
  private lastUpdateTime = 0;

  // Callbacks
  private onTick?: (time: number, beat: number) => void;
  private onError?: (error: Error) => void;

  // Worker status
  private isInitialized = false;
  private workerReady = false;

  constructor(config: WorkerTimingConfig = {}) {
    super();

    this.config = {
      workerPath: config.workerPath ?? '/worklets/timing-worker.js',
      tempo: config.tempo ?? 120,
      beatsPerBar: config.beatsPerBar ?? 4,
      updateInterval: config.updateInterval ?? 10,
      useDriftCompensation: config.useDriftCompensation ?? true,
    };

    this.state = {
      currentTime: 0,
      currentBeat: 0,
      currentBar: 0,
      isPlaying: false,
      isPaused: false,
      tempo: this.config.tempo,
      drift: 0,
    };

    logger.info('WorkerTimingManager created', this.config);
  }

  /**
   * Initialize the timing worker
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Already initialized');
      return;
    }

    try {
      // Check if Worker is available
      if (typeof Worker === 'undefined') {
        logger.warn(
          'Worker API not available, skipping WorkerTimingManager initialization',
        );
        return;
      }

      // Create worker
      this.worker = new Worker(this.config.workerPath);

      // Set up message handling
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.onerror = this.handleWorkerError.bind(this);

      // Send initial configuration
      this.worker.postMessage({
        type: 'config',
        config: {
          beatsPerBar: this.config.beatsPerBar,
          updateInterval: this.config.updateInterval,
          useDriftCompensation: this.config.useDriftCompensation,
        },
      });

      // Wait for worker to be ready
      await this.waitForWorkerReady();

      this.isInitialized = true;
      logger.info('TimingWorker initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize TimingWorker', error as Error);
      throw error;
    }
  }

  /**
   * Start timing updates
   */
  start(): void {
    if (!this.isInitialized || !this.worker) {
      logger.warn('Cannot start - not initialized');
      return;
    }

    if (this.state.isPlaying) {
      logger.warn('Already playing');
      return;
    }

    this.startTime = performance.now();

    this.worker.postMessage({
      type: 'start',
      startTime: this.startTime,
      tempo: this.state.tempo,
      updateInterval: this.config.updateInterval,
    });

    logger.debug('Started timing updates');
  }

  /**
   * Stop timing updates
   */
  stop(): void {
    if (!this.worker) {
      return;
    }

    this.worker.postMessage({ type: 'stop' });
    logger.debug('Stopped timing updates');
  }

  /**
   * Pause timing updates
   */
  pause(): void {
    if (!this.worker) {
      return;
    }

    this.worker.postMessage({ type: 'pause' });
    logger.debug('Paused timing updates');
  }

  /**
   * Resume timing updates
   */
  resume(): void {
    if (!this.worker) {
      return;
    }

    this.worker.postMessage({ type: 'resume' });
    logger.debug('Resumed timing updates');
  }

  /**
   * Seek to position
   */
  seek(seconds: number): void {
    if (!this.worker) {
      return;
    }

    this.worker.postMessage({
      type: 'seek',
      position: seconds,
    });

    logger.debug('Seeked to', { seconds });
  }

  /**
   * Set tempo
   */
  setTempo(bpm: number): void {
    if (!this.worker || bpm <= 0) {
      return;
    }

    this.state.tempo = bpm;

    this.worker.postMessage({
      type: 'setTempo',
      tempo: bpm,
    });

    logger.debug('Set tempo to', { bpm });
  }

  /**
   * Get current state
   */
  getState(): WorkerTimingState {
    return { ...this.state };
  }

  /**
   * Get current time
   */
  getCurrentTime(): number {
    return this.state.currentTime;
  }

  /**
   * Get current beat
   */
  getCurrentBeat(): number {
    return this.state.currentBeat;
  }

  /**
   * Get current bar
   */
  getCurrentBar(): number {
    return this.state.currentBar;
  }

  /**
   * Check if playing
   */
  isPlaying(): boolean {
    return this.state.isPlaying;
  }

  /**
   * Check if paused
   */
  isPaused(): boolean {
    return this.state.isPaused;
  }

  /**
   * Set tick callback
   */
  setOnTick(callback: (time: number, beat: number) => void): void {
    this.onTick = callback;
  }

  /**
   * Set error callback
   */
  setOnError(callback: (error: Error) => void): void {
    this.onError = callback;
  }

  /**
   * Get timing metrics
   */
  getMetrics(): {
    avgDrift: number;
    maxDrift: number;
    updateRate: number;
    stability: number;
  } {
    const updateRate =
      this.lastUpdateTime > 0
        ? 1000 / (performance.now() - this.lastUpdateTime)
        : 0;

    return {
      avgDrift: Math.abs(this.state.drift),
      maxDrift: Math.abs(this.state.drift) * 2, // Estimate
      updateRate,
      stability: this.state.drift < 1 ? 100 : 90,
    };
  }

  /**
   * Destroy the manager
   */
  destroy(): void {
    if (this.worker) {
      this.stop();
      this.worker.terminate();
      this.worker = null;
    }

    this.isInitialized = false;
    this.workerReady = false;

    this.removeAllListeners();
    logger.info('WorkerTimingManager destroyed');
  }

  /**
   * Handle worker messages
   */
  private handleWorkerMessage(event: MessageEvent): void {
    const message = event.data;

    switch (message.type) {
      case 'timing':
        this.handleTimingUpdate(message);
        break;

      case 'status':
        this.handleStatusUpdate(message);
        break;

      case 'ready':
        this.workerReady = true;
        break;

      default:
        logger.warn('Unknown worker message type', { type: message.type });
    }
  }

  /**
   * Handle timing updates
   */
  private handleTimingUpdate(update: WorkerTimingUpdate): void {
    // Update state
    this.state.currentTime = update.currentTime;
    this.state.currentBeat = update.currentBeat;
    this.state.currentBar = update.currentBar;
    this.state.drift = update.drift;

    // Track update time
    this.lastUpdateTime = performance.now();

    // Emit events
    this.emit('update', update);

    // Call tick callback
    this.onTick?.(update.currentTime, update.currentBeat);

    // Log significant drift
    if (Math.abs(update.drift) > 2) {
      logger.debug('Significant drift detected', {
        drift: update.drift.toFixed(3),
        time: update.currentTime.toFixed(3),
      });
    }
  }

  /**
   * Handle status updates
   */
  private handleStatusUpdate(status: {
    isPlaying: boolean;
    isPaused: boolean;
  }): void {
    const wasPlaying = this.state.isPlaying;
    const wasPaused = this.state.isPaused;

    this.state.isPlaying = status.isPlaying;
    this.state.isPaused = status.isPaused;

    // Emit state change events
    if (status.isPlaying && !wasPlaying) {
      this.emit('start');
    } else if (!status.isPlaying && wasPlaying) {
      this.emit('stop');
    }

    if (status.isPaused && !wasPaused) {
      this.emit('pause');
    } else if (!status.isPaused && wasPaused) {
      this.emit('resume');
    }

    logger.debug('Status update', status);
  }

  /**
   * Handle worker errors
   */
  private handleWorkerError(error: ErrorEvent): void {
    logger.error('Worker error', error);
    this.onError?.(new Error(error.message));
    this.emit('error', error);
  }

  /**
   * Wait for worker to be ready
   */
  private async waitForWorkerReady(): Promise<void> {
    const timeout = 5000; // 5 second timeout
    const startTime = performance.now();

    // Send ready probe
    this.worker!.postMessage({ type: 'ready' });

    return new Promise((resolve, reject) => {
      const checkReady = () => {
        if (this.workerReady) {
          resolve();
        } else if (performance.now() - startTime > timeout) {
          reject(new Error('Worker initialization timeout'));
        } else {
          setTimeout(checkReady, 10);
        }
      };

      checkReady();
    });
  }
}
