/**
 * AudioWorklet Processor for Sample-Accurate Timing
 *
 * Provides ultra-low latency timing updates at 128-sample intervals
 * matching professional DAW performance (2.67ms @ 48kHz)
 */

class TimingProcessor extends AudioWorkletProcessor {
  constructor(options) {
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
    this.messageSequence = 0; // Track message order within session

    // Debug tracking
    this.processStarted = false;

    console.log(`TimingProcessor[${this.processorId}] initialized`, {
      sampleRate,
      updateInterval: this.updateInterval,
      samplesPerUpdate: this.samplesPerUpdate,
      theoreticalLatency: `${((128 / sampleRate) * 1000).toFixed(2)}ms`,
    });

    // Set up message handler on the port
    this.port.onmessage = this.handleMessage.bind(this);
  }

  /**
   * Process method called every 128 samples
   * This provides sample-accurate timing
   */
  process(inputs, outputs, parameters) {
    // Debug log only the very first process call for THIS processor instance
    if (!this.processStarted) {
      this.processStarted = true;
      console.log(
        `TimingProcessor[${this.processorId}].process() started, isPlaying: ${this.isPlaying}, updateCount: ${this.updateCount}`,
      );
    }

    // IMPORTANT: Fill output with silence to avoid audio artifacts
    // This is a timing processor, not an audio processor
    const output = outputs[0];
    if (output && output[0]) {
      output[0].fill(0);
    }

    // Track continuous position when playing
    // CRITICAL: Only increment frames after we've received the start message
    if (this.isPlaying) {
      this.totalFrames += 128;

      // Removed verbose frame increment logging - only log on errors
    }

    // Track samples for updates
    this.samplesSinceLastUpdate += 128;

    // Check if it's time for an update
    if (this.samplesSinceLastUpdate >= this.samplesPerUpdate) {
      // In AudioWorklet, currentTime is a global property
      const contextTime = currentTime;
      const playbackFrames = this.isPlaying
        ? this.totalFrames
        : this.pauseFrame;

      // Only send timing updates when playing or paused (not stopped)
      if (this.isPlaying || this.pauseFrame > 0) {
        // Send timing update to main thread with position info
        // IMPORTANT: Send playback time (totalFrames), not AudioContext time
        const playbackTime = playbackFrames / sampleRate;

        // Reduced verbose logging - only log first 2 updates for verification
        if (this.updateCount < 2) {
          console.log(
            `TimingProcessor[${this.processorId}] TIMING UPDATE ${this.updateCount + 1}: playbackFrames=${playbackFrames}, totalFrames=${this.totalFrames}, contextTime=${contextTime.toFixed(6)}, playbackTime=${playbackTime.toFixed(6)}`,
          );
        }

        this.port.postMessage({
          type: 'timing-update',
          time: playbackTime, // This is the actual playback position in seconds
          audioContextTime: contextTime, // AudioContext's currentTime for reference
          frame: currentFrame,
          playbackFrame: playbackFrames,
          isPlaying: this.isPlaying,
          updateCount: ++this.updateCount,
          processorId: this.processorId, // Include processor ID for debugging
          sessionId: this.sessionId, // Include session ID to detect stale updates
          messageSequence: ++this.messageSequence, // Strict message ordering within session
        });
      }

      // Reset sample counter
      this.samplesSinceLastUpdate = 0;

      // Track timing accuracy
      if (this.lastUpdateTime > 0) {
        const actualInterval = contextTime - this.lastUpdateTime;
        const expectedInterval = this.updateInterval;
        const drift = Math.abs(actualInterval - expectedInterval);

        // Warn if drift is too high (increased threshold for stability)
        if (drift > 0.005) {
          // 5ms threshold - more reasonable for web audio
          this.missedUpdates++;
          this.port.postMessage({
            type: 'timing-warning',
            message: `High drift detected: ${(drift * 1000).toFixed(2)}ms`,
            missedUpdates: this.missedUpdates,
          });
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
  handleMessage(event) {
    // Reduced verbose logging - only log start/stop messages
    if (event.data.type === 'start' || event.data.type === 'stop') {
      console.log(
        `TimingProcessor[${this.processorId}] received message:`,
        event.data,
      );
    }

    switch (event.data.type) {
      case 'start':
        this.isPlaying = true;
        this.startFrame = currentFrame;
        if (event.data.fromFrame !== undefined) {
          // When resuming from pause, set totalFrames to the exact pause position
          this.totalFrames = event.data.fromFrame;
          // Reset pauseFrame to ensure continuity
          this.pauseFrame = event.data.fromFrame;
        }
        console.log(
          `TimingProcessor[${this.processorId}] STARTED: isPlaying=${this.isPlaying}, totalFrames=${this.totalFrames}, updateCount=${this.updateCount}, currentFrame=${currentFrame}`,
        );
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
        this.updateCount = 0; // Reset update count as well for fresh start
        this.sessionId++; // Increment session ID to invalidate old timing updates
        this.messageSequence = 0; // Reset message sequence for new session
        console.log(
          `TimingProcessor[${this.processorId}] STOPPED: totalFrames=${this.totalFrames}, isPlaying=${this.isPlaying}, sessionId=${this.sessionId}`,
        );
        break;

      case 'seek':
        const seconds = event.data.position;
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
        this.port.postMessage({
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
        });
        break;
    }
  }
}

// Register the processor
registerProcessor('timing-processor', TimingProcessor);
