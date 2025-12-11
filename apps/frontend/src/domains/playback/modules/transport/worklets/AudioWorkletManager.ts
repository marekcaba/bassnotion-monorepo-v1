/**
 * AudioWorkletManager - Manages AudioWorklet initialization and communication
 *
 * Handles:
 * - AudioWorklet module loading
 * - Node creation and connection
 * - Message passing with validation
 * - Session management
 * - Silent oscillator hack for graph activation
 */

import { EventEmitter } from 'events';
import { createStructuredLogger } from '../../shared/index.js';
import type { TimingMessage, ControlMessage } from './TimingProcessor.js';

const logger = createStructuredLogger('AudioWorkletManager');

export interface AudioWorkletConfig {
  updateInterval: number;
  lookAheadTime: number;
  workletPath?: string;
}

export interface TimingUpdate {
  time: number;
  audioContextTime: number;
  frame: number;
  playbackFrame: number;
  isPlaying: boolean;
  updateCount: number;
}

export class AudioWorkletManager extends EventEmitter {
  private audioContext: AudioContext | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private moduleLoaded = false;
  private silentOscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;

  // Session tracking
  private currentSessionId = 0;
  private expectedMessageSequence = -1;
  private lastValidTime = 0;
  private lastValidFrame = 0;
  private lastStopTime = 0; // Track when we last stopped to suppress expected stale warnings

  // Configuration
  private config: Required<AudioWorkletConfig>;

  // Message handler reference for cleanup
  private messageHandler: ((event: MessageEvent) => void) | null = null;

  constructor(config: AudioWorkletConfig) {
    super();

    this.config = {
      updateInterval: config.updateInterval,
      lookAheadTime: config.lookAheadTime,
      workletPath: config.workletPath || '/worklets/timing-processor.js',
    };

    logger.info('AudioWorkletManager initialized', this.config);
  }

  /**
   * Initialize the AudioWorklet with the provided AudioContext
   */
  async initialize(audioContext: AudioContext): Promise<void> {
    try {
      this.audioContext = audioContext;

      // Ensure AudioContext is running
      if (audioContext.state === 'suspended') {
        logger.warn('AudioContext is suspended, attempting to resume...');
        try {
          await audioContext.resume();
          logger.info('AudioContext resumed successfully', {
            state: audioContext.state,
          });
        } catch (error) {
          logger.warn('Could not resume AudioContext', error as Error);
          logger.warn('AudioWorklet will not process until user interaction');
        }
      }

      // Check if AudioWorklet is available
      if (!audioContext.audioWorklet) {
        logger.warn('AudioWorklet API not available, skipping initialization');
        return;
      }

      // Load the worklet module if not already loaded
      if (!this.moduleLoaded) {
        logger.debug('Loading AudioWorklet module...', {
          path: this.config.workletPath,
        });
        await audioContext.audioWorklet.addModule(this.config.workletPath);
        this.moduleLoaded = true;
        logger.info('AudioWorklet module loaded successfully');
      }

      // Create the worklet node
      this.audioWorkletNode = new AudioWorkletNode(
        audioContext,
        'timing-processor',
        {
          numberOfInputs: 0,
          numberOfOutputs: 1, // Need at least 1 output to process
          outputChannelCount: [1], // Single channel is enough
          processorOptions: {
            updateInterval: this.config.updateInterval,
            lookAheadTime: this.config.lookAheadTime,
          },
        },
      );

      // Connect to destination to start processing
      this.audioWorkletNode.connect(audioContext.destination);

      // Create silent oscillator to ensure audio graph is running
      this.createSilentOscillator();

      // Set up message handling
      this.setupMessageHandler();

      // Send initial stats request to verify communication
      this.sendControlMessage({ type: 'get-stats' });

      logger.info('AudioWorklet initialized successfully', {
        contextState: audioContext.state,
        sampleRate: audioContext.sampleRate,
        baseLatency: audioContext.baseLatency,
        outputLatency: audioContext.outputLatency,
      });
    } catch (error) {
      logger.error('Failed to initialize AudioWorklet', error as Error);
      throw error;
    }
  }

  /**
   * Create a silent oscillator to keep the audio graph running
   */
  private createSilentOscillator(): void {
    if (!this.audioContext) return;

    this.silentOscillator = this.audioContext.createOscillator();
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = 0; // Silent

    this.silentOscillator.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);
    this.silentOscillator.start();

    logger.debug('Silent oscillator started to ensure audio graph is running');
  }

  /**
   * Set up message handling from the AudioWorklet
   */
  private setupMessageHandler(): void {
    if (!this.audioWorkletNode) return;

    this.messageHandler = (event: MessageEvent<TimingMessage>) => {
      const data = event.data;

      switch (data.type) {
        case 'timing-update':
          this.handleTimingUpdate(data);
          break;

        case 'timing-warning':
          logger.warn('AudioWorklet timing warning', { message: data.message });
          this.emit('timing-warning', data);
          break;

        case 'stats':
          logger.debug('AudioWorklet stats', data);
          this.emit('stats', data);
          break;
      }
    };

    this.audioWorkletNode.port.onmessage = this.messageHandler;
  }

  /**
   * Handle timing update with validation
   */
  private handleTimingUpdate(data: TimingMessage): void {
    // Validate session ID
    if (data.sessionId !== this.currentSessionId) {
      // Suppress expected stale warnings for 200ms after stop (race condition cleanup)
      const timeSinceStop = performance.now() - this.lastStopTime;
      const isExpectedStaleMessage =
        this.lastStopTime > 0 && timeSinceStop < 200;

      if (!isExpectedStaleMessage) {
        logger.warn('Rejecting stale timing update', {
          received: data.sessionId,
          expected: this.currentSessionId,
        });
      }
      return;
    }

    // Validate message sequence
    if (data.messageSequence! <= this.expectedMessageSequence) {
      logger.warn('Rejecting out-of-order timing update', {
        received: data.messageSequence,
        expected: this.expectedMessageSequence,
      });
      return;
    }

    // Check for stale updates (large time jumps backward in time)
    if (this.lastValidTime > 0 && data.time! < this.lastValidTime) {
      const timeDelta = this.lastValidTime - data.time!;
      const maxBackwardJump = 0.001; // 1ms max backward jump

      if (timeDelta > maxBackwardJump) {
        logger.warn('Rejecting stale timing update (backward time jump)', {
          time: data.time,
          lastTime: this.lastValidTime,
          backwardDelta: timeDelta * 1000,
        });
        return;
      }
    }

    // Update tracking
    this.expectedMessageSequence = data.messageSequence!;
    this.lastValidTime = data.time!;
    this.lastValidFrame = data.playbackFrame!;

    // Log first few updates for debugging
    if (data.updateCount! <= 5 || data.updateCount! % 100 === 0) {
      logger.debug('Timing update', {
        time: data.time?.toFixed(4),
        frame: data.playbackFrame,
        updateCount: data.updateCount,
      });
    }

    // Emit validated timing update
    const update: TimingUpdate = {
      time: data.time!,
      audioContextTime: data.audioContextTime!,
      frame: data.frame!,
      playbackFrame: data.playbackFrame!,
      isPlaying: data.isPlaying!,
      updateCount: data.updateCount!,
    };

    this.emit('timing-update', update);
  }

  /**
   * Send control message to the AudioWorklet
   */
  private sendControlMessage(message: ControlMessage): void {
    if (!this.audioWorkletNode) {
      logger.warn('Cannot send message - AudioWorklet not initialized');
      return;
    }

    this.audioWorkletNode.port.postMessage(message);
    logger.debug('Sent control message', { type: message.type });
  }

  /**
   * Start playback
   */
  start(fromFrame?: number): void {
    this.sendControlMessage({
      type: 'start',
      fromFrame,
    });
    logger.info('Started AudioWorklet timing', { fromFrame });
  }

  /**
   * Pause playback
   */
  pause(): void {
    this.sendControlMessage({ type: 'pause' });
    logger.info('Paused AudioWorklet timing');
  }

  /**
   * Stop playback
   */
  stop(): void {
    // Increment session ID to invalidate old timing updates
    this.currentSessionId++;
    this.expectedMessageSequence = -1;
    this.lastValidTime = 0;
    this.lastValidFrame = 0;
    this.lastStopTime = performance.now(); // Track stop time to suppress expected stale warnings

    this.sendControlMessage({ type: 'stop' });
    logger.info('Stopped AudioWorklet timing', {
      newSessionId: this.currentSessionId,
    });
  }

  /**
   * Seek to position
   */
  seek(seconds: number): void {
    this.sendControlMessage({
      type: 'seek',
      position: seconds,
    });
    logger.info('Seeked AudioWorklet timing', { position: seconds });
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AudioWorkletConfig>): void {
    if (config.updateInterval !== undefined) {
      this.config.updateInterval = config.updateInterval;
    }
    if (config.lookAheadTime !== undefined) {
      this.config.lookAheadTime = config.lookAheadTime;
    }

    this.sendControlMessage({
      type: 'update-config',
      updateInterval: config.updateInterval,
      lookAheadTime: config.lookAheadTime,
    });

    logger.info('Updated AudioWorklet config', config);
  }

  /**
   * Get current stats
   */
  getStats(): void {
    this.sendControlMessage({ type: 'get-stats' });
  }

  /**
   * Get current timing info
   */
  getCurrentTiming(): { time: number; frame: number } {
    return {
      time: this.lastValidTime,
      frame: this.lastValidFrame,
    };
  }

  /**
   * Check if AudioWorklet is active
   */
  isActive(): boolean {
    return (
      this.audioWorkletNode !== null && this.audioContext?.state === 'running'
    );
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    logger.info('Destroying AudioWorkletManager...');

    // Remove message handler
    if (this.audioWorkletNode && this.messageHandler) {
      this.audioWorkletNode.port.onmessage = null;
    }

    // Disconnect and cleanup nodes
    if (this.audioWorkletNode) {
      this.audioWorkletNode.disconnect();
      this.audioWorkletNode = null;
    }

    if (this.silentOscillator) {
      this.silentOscillator.stop();
      this.silentOscillator.disconnect();
      this.silentOscillator = null;
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    // Remove all listeners
    this.removeAllListeners();

    logger.info('AudioWorkletManager destroyed');
  }
}
