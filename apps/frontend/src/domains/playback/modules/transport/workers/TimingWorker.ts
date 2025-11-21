/**
 * TimingWorker - Web Worker for high-precision timing
 *
 * Provides isolated timing updates free from main thread interference.
 * Uses high-resolution timers and requestAnimationFrame for accurate timing.
 */

// Type definitions for worker messages
interface StartMessage {
  type: 'start';
  startTime: number;
  tempo: number;
  updateInterval: number;
}

interface StopMessage {
  type: 'stop';
}

interface PauseMessage {
  type: 'pause';
}

interface ResumeMessage {
  type: 'resume';
}

interface SeekMessage {
  type: 'seek';
  position: number;
}

interface SetTempoMessage {
  type: 'setTempo';
  tempo: number;
}

interface ConfigMessage {
  type: 'config';
  config: TimingConfig;
}

interface ReadyMessage {
  type: 'ready';
}

type WorkerMessage =
  | StartMessage
  | StopMessage
  | PauseMessage
  | ResumeMessage
  | SeekMessage
  | SetTempoMessage
  | ConfigMessage
  | ReadyMessage;

interface TimingUpdate {
  type: 'timing';
  currentTime: number;
  currentBeat: number;
  currentBar: number;
  timestamp: DOMHighResTimeStamp;
  drift: number;
}

interface StatusUpdate {
  type: 'status';
  isPlaying: boolean;
  isPaused: boolean;
}

interface TimingConfig {
  beatsPerBar?: number;
  updateInterval?: number;
  useDriftCompensation?: boolean;
  maxDrift?: number;
}

// Worker state
class TimingWorkerState {
  // Timing state
  private startTime = 0;
  private pauseTime = 0;
  private totalPausedTime = 0;
  private currentPosition = 0;

  // Playback state
  private isPlaying = false;
  private isPaused = false;

  // Musical state
  private tempo = 120;
  private beatsPerBar = 4;

  // Update control
  private updateInterval = 10; // 10ms default
  private animationFrameId: number | null = null;
  private intervalId: number | null = null;
  private lastUpdateTime = 0;

  // Drift compensation
  private useDriftCompensation = true;
  private driftHistory: number[] = [];
  private maxDriftHistorySize = 100;
  private maxDrift = 5; // Maximum drift in ms

  constructor() {
    // Initialize worker
    self.onmessage = this.handleMessage.bind(this);
    // SUPPRESSED: TimingWorker logging disabled
    // console.log('[TimingWorker] Initialized');
  }

  private handleMessage(event: MessageEvent<WorkerMessage>): void {
    const message = event.data;

    switch (message.type) {
      case 'start':
        this.start(message.startTime, message.tempo, message.updateInterval);
        break;

      case 'stop':
        this.stop();
        break;

      case 'pause':
        this.pause();
        break;

      case 'resume':
        this.resume();
        break;

      case 'seek':
        this.seek(message.position);
        break;

      case 'setTempo':
        this.setTempo(message.tempo);
        break;

      case 'config':
        this.updateConfig(message.config);
        break;

      case 'ready':
        // Respond to ready probe
        self.postMessage({ type: 'ready' });
        break;
    }
  }

  private start(
    startTime: number,
    tempo: number,
    updateInterval: number,
  ): void {
    if (this.isPlaying) {
      return;
    }

    this.startTime = startTime || performance.now();
    this.tempo = tempo || 120;
    this.updateInterval = updateInterval || 10;
    this.currentPosition = 0;
    this.totalPausedTime = 0;
    this.isPlaying = true;
    this.isPaused = false;

    this.startUpdates();
    this.sendStatus();

    // SUPPRESSED: TimingWorker start logging disabled
    // console.log('[TimingWorker] Started', {
    //   tempo: this.tempo,
    //   updateInterval: this.updateInterval,
    // });
  }

  private stop(): void {
    if (!this.isPlaying) {
      return;
    }

    this.stopUpdates();
    this.isPlaying = false;
    this.isPaused = false;
    this.currentPosition = 0;
    this.totalPausedTime = 0;

    this.sendStatus();
    // SUPPRESSED: TimingWorker stop logging disabled
    // console.log('[TimingWorker] Stopped');
  }

  private pause(): void {
    if (!this.isPlaying || this.isPaused) {
      return;
    }

    this.pauseTime = performance.now();
    this.isPaused = true;
    this.stopUpdates();

    // Calculate current position at pause
    const elapsed = this.pauseTime - this.startTime - this.totalPausedTime;
    this.currentPosition = elapsed / 1000; // Convert to seconds

    this.sendStatus();
    // SUPPRESSED: TimingWorker pause logging disabled
    // console.log('[TimingWorker] Paused at', this.currentPosition);
  }

  private resume(): void {
    if (!this.isPlaying || !this.isPaused) {
      return;
    }

    const now = performance.now();
    this.totalPausedTime += now - this.pauseTime;
    this.isPaused = false;

    this.startUpdates();
    this.sendStatus();
    // SUPPRESSED: TimingWorker resume logging disabled
    // console.log('[TimingWorker] Resumed');
  }

  private seek(position: number): void {
    this.currentPosition = position;

    if (this.isPlaying && !this.isPaused) {
      // Recalculate start time to match new position
      const now = performance.now();
      this.startTime = now - position * 1000 - this.totalPausedTime;
    }

    // Send immediate update
    this.sendTimingUpdate();
    // SUPPRESSED: TimingWorker seek logging disabled
    // console.log('[TimingWorker] Seeked to', position);
  }

  private setTempo(tempo: number): void {
    if (tempo > 0 && tempo !== this.tempo) {
      // Calculate current beat position before tempo change
      const currentBeat = this.getCurrentBeat();

      this.tempo = tempo;

      // Adjust timing to maintain beat position
      if (this.isPlaying && !this.isPaused) {
        const beatDuration = 60 / tempo;
        const newPosition = currentBeat * beatDuration;
        this.seek(newPosition);
      }

      // SUPPRESSED: TimingWorker tempo logging disabled
      // console.log('[TimingWorker] Tempo changed to', tempo);
    }
  }

  private updateConfig(config: TimingConfig): void {
    if (config.beatsPerBar !== undefined) {
      this.beatsPerBar = config.beatsPerBar;
    }
    if (config.updateInterval !== undefined) {
      this.updateInterval = config.updateInterval;
      // Restart updates with new interval
      if (this.isPlaying && !this.isPaused) {
        this.stopUpdates();
        this.startUpdates();
      }
    }
    if (config.useDriftCompensation !== undefined) {
      this.useDriftCompensation = config.useDriftCompensation;
    }
    if (config.maxDrift !== undefined) {
      this.maxDrift = config.maxDrift;
    }
  }

  private startUpdates(): void {
    // Use both RAF and interval for maximum precision
    this.lastUpdateTime = performance.now();

    // High-precision updates with RAF
    const rafUpdate = () => {
      if (this.isPlaying && !this.isPaused) {
        this.sendTimingUpdate();
        this.animationFrameId = requestAnimationFrame(rafUpdate);
      }
    };

    // Fallback updates with interval
    this.intervalId = self.setInterval(() => {
      if (this.isPlaying && !this.isPaused) {
        this.sendTimingUpdate();
      }
    }, this.updateInterval);

    // Start RAF updates
    this.animationFrameId = requestAnimationFrame(rafUpdate);
  }

  private stopUpdates(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private sendTimingUpdate(): void {
    const now = performance.now();

    // Calculate current time
    let currentTime: number;
    if (this.isPaused) {
      currentTime = this.currentPosition;
    } else {
      const elapsed = now - this.startTime - this.totalPausedTime;
      currentTime = elapsed / 1000; // Convert to seconds
    }

    // Apply drift compensation
    const drift = this.calculateDrift(now);
    if (this.useDriftCompensation && Math.abs(drift) < this.maxDrift) {
      currentTime -= drift / 1000; // Apply compensation
    }

    // Calculate musical position
    const beatDuration = 60 / this.tempo;
    const currentBeat = currentTime / beatDuration;
    const currentBar = Math.floor(currentBeat / this.beatsPerBar);

    // Send update
    const update: TimingUpdate = {
      type: 'timing',
      currentTime,
      currentBeat,
      currentBar,
      timestamp: now,
      drift,
    };

    self.postMessage(update);
    this.lastUpdateTime = now;
  }

  private sendStatus(): void {
    const status: StatusUpdate = {
      type: 'status',
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
    };

    self.postMessage(status);
  }

  private getCurrentBeat(): number {
    const currentTime = this.isPaused
      ? this.currentPosition
      : (performance.now() - this.startTime - this.totalPausedTime) / 1000;

    const beatDuration = 60 / this.tempo;
    return currentTime / beatDuration;
  }

  private calculateDrift(now: number): number {
    if (this.lastUpdateTime === 0) {
      return 0;
    }

    // Calculate expected vs actual time delta
    const actualDelta = now - this.lastUpdateTime;
    const expectedDelta = this.updateInterval;
    const drift = actualDelta - expectedDelta;

    // Add to history
    this.driftHistory.push(drift);
    if (this.driftHistory.length > this.maxDriftHistorySize) {
      this.driftHistory.shift();
    }

    // Calculate average drift
    if (this.driftHistory.length === 0) {
      return 0;
    }

    const avgDrift =
      this.driftHistory.reduce((sum, d) => sum + d, 0) /
      this.driftHistory.length;
    return avgDrift;
  }
}

// Initialize worker
new TimingWorkerState();

// Export for TypeScript
export {};
