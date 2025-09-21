/**
 * TransportAdapter - Migration adapter from UnifiedTransport to TransportController
 *
 * This adapter provides a UnifiedTransport-compatible interface while
 * internally using the new TransportController. It allows gradual migration
 * of all UnifiedTransport references.
 */

import { TransportController } from '../../modules/transport/core/TransportController.js';
import { EventBus } from './EventBus.js';
import { AudioEngine } from '../../modules/audio-engine/core/AudioEngine.js';
import { createStructuredLogger } from '../../modules/shared/index.js';
import type {
  TransportConfig,
  TransportState,
  MusicalPosition,
  TimeSignature,
  TimingMetrics,
  TimingEvent,
} from '../../modules/transport/types/index.js';

const logger = createStructuredLogger('TransportAdapter');

/**
 * Adapter class that provides UnifiedTransport API using TransportController
 */
export class TransportAdapter {
  private controller: TransportController;
  private eventBus: EventBus;
  private config: TransportConfig;
  private static instance: TransportAdapter | null = null;

  private constructor(
    eventBus: EventBus,
    audioEngine: AudioEngine,
    config: Partial<TransportConfig> = {},
  ) {
    this.eventBus = eventBus;
    this.config = {
      tempo: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      lookAheadTime: 0.1,
      scheduleInterval: 0.025,
      enableAudioWorklet: true,
      enableWebWorker: true,
      driftCompensation: 'adaptive',
      bufferStrategy: 'adaptive',
      ...config,
    };

    // Create TransportController with compatibility mode
    this.controller = TransportController.getInstance(eventBus, audioEngine, {
      ...this.config,
      enableLegacyCompatibility: true,
    });

    logger.info('TransportAdapter created - bridging to TransportController');
  }

  /**
   * Get singleton instance (UnifiedTransport compatibility)
   */
  static getInstance(
    eventBus?: EventBus,
    audioEngine?: AudioEngine,
    config?: Partial<TransportConfig>,
  ): TransportAdapter {
    if (!TransportAdapter.instance) {
      if (!eventBus || !audioEngine) {
        throw new Error(
          'EventBus and AudioEngine required for first initialization',
        );
      }
      TransportAdapter.instance = new TransportAdapter(
        eventBus,
        audioEngine,
        config,
      );
    }
    return TransportAdapter.instance;
  }

  /**
   * Initialize transport
   */
  async initialize(): Promise<void> {
    await this.controller.initialize();
  }

  /**
   * Start transport
   */
  async start(): Promise<void> {
    await this.controller.start();
  }

  /**
   * Stop transport
   */
  async stop(): Promise<void> {
    await this.controller.stop();
  }

  /**
   * Pause transport
   */
  async pause(): Promise<void> {
    await this.controller.pause();
  }

  /**
   * Resume transport
   */
  async resume(): Promise<void> {
    await this.controller.resume();
  }

  /**
   * Seek to position
   */
  async seek(position: MusicalPosition): Promise<void> {
    await this.controller.seek(position);
  }

  /**
   * Set tempo
   */
  setTempo(bpm: number): void {
    this.controller.setTempo(bpm).catch((error) => {
      logger.error('Failed to set tempo', error);
    });
  }

  /**
   * Set time signature
   */
  setTimeSignature(numerator: number, denominator: number): void {
    this.controller
      .setTimeSignature({ numerator, denominator })
      .catch((error) => {
        logger.error('Failed to set time signature', error);
      });
  }

  /**
   * Set loop
   */
  async setLoop(startOrEnabled: boolean | number, end?: number): Promise<void> {
    if (typeof startOrEnabled === 'boolean') {
      if (startOrEnabled) {
        // Enable loop with current settings
        const position = this.controller.getPosition();
        const loopEnd = { ...position, bars: position.bars + 4 };
        await this.controller.setLoop(position, loopEnd);
      } else {
        await this.controller.disableLoop();
      }
    } else {
      // Convert seconds to musical position
      const start =
        this.controller['positionManager'].secondsToPosition(startOrEnabled);
      const endPos = this.controller['positionManager'].secondsToPosition(end!);
      await this.controller.setLoop(start, endPos);
    }
  }

  /**
   * Set loop with musical positions
   */
  setLoopMusical(
    enabled: boolean,
    start?: MusicalPosition,
    end?: MusicalPosition,
  ): void {
    if (enabled && start && end) {
      this.controller.setLoop(start, end).catch((error) => {
        logger.error('Failed to set loop', error);
      });
    } else if (!enabled) {
      this.controller.disableLoop().catch((error) => {
        logger.error('Failed to disable loop', error);
      });
    }
  }

  /**
   * Get state
   */
  getState(): TransportState {
    return this.controller.getState();
  }

  /**
   * Get position (returns seconds for backward compatibility with commands)
   */
  getPosition(): number {
    return this.getCurrentTime();
  }

  /**
   * Get musical position
   */
  getMusicalPosition(): MusicalPosition {
    return this.controller.getPosition();
  }

  /**
   * Get current time in seconds
   */
  getCurrentTime(): number {
    return this.controller.getCurrentTime();
  }

  /**
   * Get tempo
   */
  getTempo(): number {
    return this.config.tempo;
  }

  /**
   * Get metrics
   */
  getMetrics(): TimingMetrics {
    const metrics = this.controller.getMetrics();
    return {
      stability: metrics.stability,
      avgDrift: metrics.avgDrift,
      maxDrift: metrics.maxDrift,
      jitter: metrics.jitter,
      updateRate: metrics.updateRate,
      bufferHealth: metrics.bufferHealth,
      cpuLoad: metrics.cpuLoad,
      totalEvents: metrics.totalEvents,
      missedEvents: metrics.missedEvents,
    };
  }

  /**
   * Schedule event
   */
  scheduleEvent(event: Omit<TimingEvent, 'id'>): string {
    const time = event.musicalTime
      ? this.controller['positionManager'].positionToSeconds(event.musicalTime)
      : event.time;

    return this.controller.scheduleEvent(
      time,
      () => event.callback(time),
      event.priority,
    );
  }

  /**
   * Cancel event
   */
  cancelEvent(eventId: string): void {
    this.controller.cancelEvent(eventId);
  }

  /**
   * Dispose transport
   */
  async dispose(): Promise<void> {
    await this.controller.dispose();
    if (TransportAdapter.instance === this) {
      TransportAdapter.instance = null;
    }
  }

  // Backward compatibility methods

  /**
   * Pause immediately (backward compatibility)
   */
  async pauseImmediate(): Promise<void> {
    await this.pause();
  }

  /**
   * Resume immediately (backward compatibility)
   */
  async resumeImmediate(): Promise<void> {
    await this.resume();
  }

  /**
   * Schedule callback (Tone.js compatibility)
   */
  schedule(callback: (time: number) => void, time: number): void {
    this.controller.scheduleEvent(time, () => callback(time));
  }

  /**
   * Get service info
   */
  getServiceInfo() {
    return {
      name: 'TransportAdapter',
      status: 'active',
      isInitialized: true,
      config: this.config,
      metrics: this.getMetrics(),
    };
  }

  // Properties for backward compatibility
  get isInitialized(): boolean {
    return true;
  }

  get state(): TransportState {
    return this.getState();
  }

  get tempo(): number {
    return this.getTempo();
  }

  get position(): MusicalPosition {
    return this.getMusicalPosition();
  }

  // Additional backward compatibility methods

  /**
   * Check if transport is playing
   */
  isPlaying(): boolean {
    return this.getState() === 'playing';
  }

  /**
   * Get BPM (backward compatibility)
   */
  getBPM(): number {
    return this.getTempo();
  }

  /**
   * Get loop start in seconds (backward compatibility)
   */
  getLoopStart(): number {
    // Default to 0 if no loop is set
    return 0;
  }

  /**
   * Get loop end in seconds (backward compatibility)
   */
  getLoopEnd(): number {
    // Default to 16 beats (4 bars in 4/4)
    const beatsPerSecond = this.getTempo() / 60;
    return 16 / beatsPerSecond;
  }

  /**
   * Check if loop is enabled (backward compatibility)
   */
  isLoopEnabled(): boolean {
    // TODO: Track loop state when setLoop is called
    return false;
  }

  /**
   * Restore transport state (backward compatibility)
   */
  async restoreState(state: any): Promise<void> {
    if (state.bpm) {
      this.setTempo(state.bpm);
    }
    if (state.position !== undefined) {
      const position = this.controller['positionManager'].secondsToPosition(
        state.position,
      );
      await this.seek(position);
    }
    if (
      state.loopEnabled &&
      state.loopStart !== undefined &&
      state.loopEnd !== undefined
    ) {
      const start = this.controller['positionManager'].secondsToPosition(
        state.loopStart,
      );
      const end = this.controller['positionManager'].secondsToPosition(
        state.loopEnd,
      );
      await this.controller.setLoop(start, end);
    }
    if (state.isPlaying) {
      await this.start();
    }
  }
}
