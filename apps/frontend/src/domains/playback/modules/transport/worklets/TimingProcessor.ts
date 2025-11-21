/**
 * AudioWorklet Processor for Sample-Accurate Timing
 *
 * This file contains the TypeScript source for the AudioWorklet processor.
 * It needs to be compiled to JavaScript and served from the public directory.
 *
 * Provides ultra-low latency timing updates at 128-sample intervals
 * matching professional DAW performance (2.67ms @ 48kHz)
 */

// Note: This is the source TypeScript file. The actual worklet runs the compiled JS version.
// AudioWorklet global types
declare const AudioWorkletProcessor: any;
declare const registerProcessor: any;
declare const currentTime: number;
declare const currentFrame: number;
declare const sampleRate: number;

interface TimingProcessorOptions {
  processorOptions: {
    updateInterval?: number;
    lookAheadTime?: number;
  };
}

interface TimingMessage {
  type: 'timing-update' | 'timing-warning' | 'stats';
  time?: number;
  audioContextTime?: number;
  frame?: number;
  playbackFrame?: number;
  isPlaying?: boolean;
  updateCount?: number;
  processorId?: string;
  sessionId?: number;
  messageSequence?: number;
  message?: string;
  missedUpdates?: number;
  accuracy?: string;
  currentFrame?: number;
}

interface ControlMessage {
  type: 'start' | 'pause' | 'stop' | 'seek' | 'update-config' | 'get-stats';
  position?: number;
  fromFrame?: number;
  updateInterval?: number;
  lookAheadTime?: number;
}

class TimingProcessor extends AudioWorkletProcessor {
  private processorId: string;
  private updateInterval: number;
  private lookAheadTime: number;
  private lastUpdateTime: number;
  private samplesSinceLastUpdate: number;
  private samplesPerUpdate: number;
  private isPlaying: boolean;
  private startFrame: number;
  private pauseFrame: number;
  private totalFrames: number;
  private updateCount: number;
  private missedUpdates: number;
  private sessionId: number;
  private messageSequence: number;
  private processStarted: boolean;

  constructor(options: TimingProcessorOptions) {
    super();

    // Unique processor ID for debugging
    this.processorId = Math.random().toString(36).substr(2, 9);

    // Configuration from main thread
    this.updateInterval = options.processorOptions.updateInterval || 0.00267;
    this.lookAheadTime = options.processorOptions.lookAheadTime || 0.2;

    // Timing state
    this.lastUpdateTime = 0;
    this.samplesSinceLastUpdate = 0;
    this.samplesPerUpdate = Math.floor(sampleRate * this.updateInterval);

    // Position tracking
    this.isPlaying = false;
    this.startFrame = 0;
    this.pauseFrame = 0;
    this.totalFrames = 0;

    // Performance tracking
    this.updateCount = 0;
    this.missedUpdates = 0;

    // Session tracking to prevent stale timing updates
    this.sessionId = 0;
    this.messageSequence = 0;

    // Debug tracking
    this.processStarted = false;

    // SUPPRESSED: TimingProcessor logging disabled to reduce console noise
    // console.log(`TimingProcessor[${this.processorId}] initialized`, {
    //   sampleRate,
    //   updateInterval: this.updateInterval,
    //   samplesPerUpdate: this.samplesPerUpdate,
    //   theoreticalLatency: `${((128 / sampleRate) * 1000).toFixed(2)}ms`,
    // });

    // Set up message handler
    this.port.onmessage = this.handleMessage.bind(this);
  }

  /**
   * Process method called every 128 samples
   * This provides sample-accurate timing
   */
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: any,
  ): boolean {
    // Debug log only the very first process call
    if (!this.processStarted) {
      this.processStarted = true;
      // SUPPRESSED: Process logging disabled
      // console.log(
      //   `TimingProcessor[${this.processorId}].process() started, isPlaying: ${this.isPlaying}, updateCount: ${this.updateCount}`,
      // );
    }

    // Fill output with silence to avoid audio artifacts
    const output = outputs[0];
    if (output && output[0]) {
      output[0].fill(0);
    }

    // Track continuous position when playing
    if (this.isPlaying) {
      this.totalFrames += 128;

      // Debug log for first few increments
      if (this.totalFrames <= 1024) {
        // SUPPRESSED: Frame increment logging disabled
        // console.log(
        //   `TimingProcessor[${this.processorId}] INCREMENTED totalFrames to ${this.totalFrames} (${(this.totalFrames / sampleRate).toFixed(6)}s)`,
        // );
      }
    }

    // Track samples for updates
    this.samplesSinceLastUpdate += 128;

    // Check if it's time for an update
    if (this.samplesSinceLastUpdate >= this.samplesPerUpdate) {
      const contextTime = currentTime;
      const playbackFrames = this.isPlaying
        ? this.totalFrames
        : this.pauseFrame;

      // Only send timing updates when playing or paused (not stopped)
      if (this.isPlaying || this.pauseFrame > 0) {
        const playbackTime = playbackFrames / sampleRate;

        // Debug timing for first updates
        if (this.updateCount < 20) {
          // SUPPRESSED: Timing update logging disabled
          // console.log(
          //   `TimingProcessor[${this.processorId}] TIMING UPDATE ${this.updateCount + 1}: playbackFrames=${playbackFrames}, totalFrames=${this.totalFrames}, contextTime=${contextTime.toFixed(6)}, playbackTime=${playbackTime.toFixed(6)}`,
          // );
        }

        const message: TimingMessage = {
          type: 'timing-update',
          time: playbackTime,
          audioContextTime: contextTime,
          frame: currentFrame,
          playbackFrame: playbackFrames,
          isPlaying: this.isPlaying,
          updateCount: ++this.updateCount,
          processorId: this.processorId,
          sessionId: this.sessionId,
          messageSequence: ++this.messageSequence,
        };

        this.port.postMessage(message);
      }

      // Reset sample counter
      this.samplesSinceLastUpdate = 0;

      // Track timing accuracy
      if (this.lastUpdateTime > 0) {
        const actualInterval = contextTime - this.lastUpdateTime;
        const expectedInterval = this.updateInterval;
        const drift = Math.abs(actualInterval - expectedInterval);

        // Warn if drift is too high (increased threshold to reduce false positives)
        // NOTE: With FAANG direct scheduling, these warnings don't affect audio timing
        // which is scheduled directly to AudioContext bypassing JavaScript timing
        if (drift > 0.010) {
          // 10ms threshold (increased from 5ms)
          this.missedUpdates++;
          const warningMessage: TimingMessage = {
            type: 'timing-warning',
            message: `High drift detected: ${(drift * 1000).toFixed(2)}ms`,
            missedUpdates: this.missedUpdates,
          };
          this.port.postMessage(warningMessage);
        }
      }

      this.lastUpdateTime = contextTime;
    }

    // Keep processor alive
    return true;
  }

  /**
   * Handle messages from main thread
   */
  handleMessage(event: MessageEvent<ControlMessage>): void {
    // SUPPRESSED: Message handling logging disabled
    // console.log(
    //   `TimingProcessor[${this.processorId}] received message:`,
    //   event.data,
    // );

    switch (event.data.type) {
      case 'start':
        this.isPlaying = true;
        this.startFrame = currentFrame;
        if (event.data.fromFrame !== undefined) {
          this.totalFrames = event.data.fromFrame;
          this.pauseFrame = event.data.fromFrame;
        }
        // SUPPRESSED: Start logging disabled
        // console.log(
        //   `TimingProcessor[${this.processorId}] STARTED: isPlaying=${this.isPlaying}, totalFrames=${this.totalFrames}, updateCount=${this.updateCount}, currentFrame=${currentFrame}`,
        // );
        break;

      case 'pause':
        this.isPlaying = false;
        this.pauseFrame = this.totalFrames;
        break;

      case 'stop':
        this.isPlaying = false;
        this.totalFrames = 0;
        this.pauseFrame = 0;
        this.startFrame = 0;
        this.updateCount = 0;
        this.sessionId++;
        this.messageSequence = 0;
        // SUPPRESSED: Stop logging disabled
        // console.log(
        //   `TimingProcessor[${this.processorId}] STOPPED: totalFrames=${this.totalFrames}, isPlaying=${this.isPlaying}, sessionId=${this.sessionId}`,
        // );
        break;

      case 'seek':
        const seconds = event.data.position!;
        this.totalFrames = Math.floor(seconds * sampleRate);
        this.pauseFrame = this.totalFrames;
        break;

      case 'update-config':
        if (event.data.updateInterval) {
          this.updateInterval = event.data.updateInterval;
          this.samplesPerUpdate = Math.floor(sampleRate * this.updateInterval);
        }
        if (event.data.lookAheadTime) {
          this.lookAheadTime = event.data.lookAheadTime;
        }
        break;

      case 'get-stats':
        const statsMessage: TimingMessage = {
          type: 'stats',
          updateCount: this.updateCount,
          missedUpdates: this.missedUpdates,
          accuracy:
            (
              ((this.updateCount - this.missedUpdates) / this.updateCount) *
              100
            ).toFixed(2) + '%',
          currentFrame: this.totalFrames,
          isPlaying: this.isPlaying,
        };
        this.port.postMessage(statsMessage);
        break;
    }
  }
}

// Register the processor
registerProcessor('timing-processor', TimingProcessor);

// Export types for use in the main thread
export type { TimingMessage, ControlMessage };
