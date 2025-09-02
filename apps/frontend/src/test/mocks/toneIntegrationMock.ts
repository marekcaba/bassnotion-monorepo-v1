/**
 * Tone.js Mock for Integration Testing
 *
 * Provides a functional mock of Tone.js that allows testing audio pipeline
 * integration without requiring actual Web Audio API.
 */

import { vi } from 'vitest';

interface MockTransportPosition {
  bars: number;
  beats: number;
  sixteenths: number;
}

class MockTransport {
  state: 'started' | 'stopped' | 'paused' = 'stopped';
  position = 0;
  seconds = 0;
  bpm = {
    value: 120,
    rampTo: vi.fn(),
    setValueAtTime: vi.fn(),
  };
  timeSignature: number | number[] = 4;
  loop = false;
  loopStart = 0;
  loopEnd = '4m';
  PPQ = 192;

  private scheduledEvents: Array<{
    id: number;
    callback: (time: number) => void;
    interval: string | number;
    startTime: number;
  }> = [];
  private nextId = 1;
  private intervalId: NodeJS.Timeout | null = null;
  private startTime = 0;

  start(time?: number | string, offset?: number | string) {
    this.state = 'started';
    this.startTime = Date.now();
    if (offset) {
      this.position =
        typeof offset === 'string' ? this.parseTime(offset) : offset;
    }

    // Simulate transport progression
    this.intervalId = setInterval(() => {
      if (this.state === 'started') {
        const elapsed = (Date.now() - this.startTime) / 1000;
        this.seconds = elapsed;
        this.position = elapsed * (this.bpm.value / 60);

        // Trigger scheduled events
        this.scheduledEvents.forEach((event) => {
          const interval =
            typeof event.interval === 'string'
              ? this.parseTime(event.interval)
              : event.interval;
          const shouldTrigger =
            Math.floor(this.seconds / interval) >
            Math.floor((this.seconds - 0.01) / interval);

          if (shouldTrigger) {
            event.callback(this.seconds);
          }
        });
      }
    }, 10); // 10ms resolution

    return this;
  }

  stop(time?: number | string) {
    this.state = 'stopped';
    this.position = 0;
    this.seconds = 0;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    return this;
  }

  pause(time?: number | string) {
    this.state = 'paused';
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    return this;
  }

  cancel(after?: number) {
    this.scheduledEvents =
      after !== undefined
        ? this.scheduledEvents.filter((e) => e.startTime < after)
        : [];
    return this;
  }

  scheduleRepeat(
    callback: (time: number) => void,
    interval: string | number,
    startTime?: string | number,
  ) {
    const id = this.nextId++;
    this.scheduledEvents.push({
      id,
      callback,
      interval,
      startTime: startTime
        ? typeof startTime === 'string'
          ? this.parseTime(startTime)
          : startTime
        : 0,
    });
    return id;
  }

  scheduleOnce(callback: (time: number) => void, time: string | number) {
    const id = this.nextId++;
    const triggerTime = typeof time === 'string' ? this.parseTime(time) : time;

    setTimeout(() => {
      if (this.state === 'started') {
        callback(this.seconds);
      }
    }, triggerTime * 1000);

    return id;
  }

  schedule(callback: (time: number) => void, time: string | number) {
    // Alias for scheduleOnce
    return this.scheduleOnce(callback, time);
  }

  clear(id: number) {
    this.scheduledEvents = this.scheduledEvents.filter((e) => e.id !== id);
    return this;
  }

  on(event: string, callback: Function) {
    // Mock event subscription - store callbacks for later triggering if needed
    // For 'position' events, we can simulate by calling the callback occasionally
    if (event === 'position') {
      // Store position callback for potential simulation
      setTimeout(() => {
        if (this.state === 'started') {
          callback({
            bars: 0,
            beats: 0,
            sixteenths: 0,
            ticks: 0,
          });
        }
      }, 50);
    }
    return this;
  }

  off(event: string, callback?: Function) {
    // Mock event unsubscription
    return this;
  }

  private parseTime(time: string): number {
    // Simple time parsing (supports "1m", "4n", etc.)
    const match = time.match(/^(\d+)([a-z]+)$/);
    if (!match) return 0;

    const [, value, unit] = match;
    const num = parseInt(value);

    switch (unit) {
      case 'm':
        return num * 4 * (60 / this.bpm.value); // measures
      case 'n':
        return (4 / num) * (60 / this.bpm.value); // notes
      default:
        return 0;
    }
  }

  getSecondsAtTime(time: string | number): number {
    return typeof time === 'string' ? this.parseTime(time) : time;
  }

  nextSubdivision(subdivision: string): number {
    const subdivTime = this.parseTime(subdivision);
    return Math.ceil(this.seconds / subdivTime) * subdivTime;
  }
}

class MockContext {
  state: 'running' | 'suspended' | 'closed' = 'running';
  currentTime = 0;
  sampleRate = 44100;
  lookAhead = 0.1;
  latencyHint: string | number = 'interactive';

  private intervalId: NodeJS.Timeout | null = null;
  private startTime = Date.now();

  constructor() {
    // Simulate time progression
    this.intervalId = setInterval(() => {
      this.currentTime = (Date.now() - this.startTime) / 1000;
    }, 10);
  }

  async resume() {
    this.state = 'running';
    return this;
  }

  async close() {
    this.state = 'closed';
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    return this;
  }

  now() {
    return this.currentTime;
  }

  get rawContext() {
    return {
      state: this.state,
      currentTime: this.currentTime,
      sampleRate: this.sampleRate,
      destination: {
        maxChannelCount: 2,
      },
    };
  }
}

class MockGainNode {
  gain = {
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  };

  connect = vi.fn().mockReturnThis();
  disconnect = vi.fn();
  dispose = vi.fn();
  toDestination = vi.fn().mockReturnThis();
}

class MockSampler {
  loaded = true;
  volume = {
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    linearRampTo: vi.fn(),
    exponentialRampTo: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  };

  triggerAttack = vi.fn();
  triggerRelease = vi.fn();
  triggerAttackRelease = vi.fn();
  releaseAll = vi.fn();
  dispose = vi.fn();
  connect = vi.fn().mockReturnThis();
  disconnect = vi.fn();
  toDestination = vi.fn().mockReturnThis();

  get(note?: string) {
    return {
      loaded: true,
      buffer: {
        duration: 1,
        length: 44100,
        sampleRate: 44100,
      },
    };
  }
}

class MockOscillator {
  frequency = {
    value: 440,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  type: OscillatorType = 'sine';
  volume = new MockGainNode();

  start = vi.fn().mockReturnThis();
  stop = vi.fn().mockReturnThis();
  connect = vi.fn().mockReturnThis();
  disconnect = vi.fn();
  dispose = vi.fn();
  toDestination = vi.fn().mockReturnThis();
}

class MockLimiter {
  threshold = {
    value: -12,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };

  connect = vi.fn().mockReturnThis();
  disconnect = vi.fn();
  dispose = vi.fn();
  toDestination = vi.fn().mockReturnThis();
}

class MockCompressor {
  threshold = {
    value: -24,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  ratio = {
    value: 12,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  attack = {
    value: 0.003,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  release = {
    value: 0.1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };

  connect = vi.fn().mockReturnThis();
  disconnect = vi.fn();
  dispose = vi.fn();
  toDestination = vi.fn().mockReturnThis();
}

// Create the mock Tone object
export const createToneMock = () => {
  const Transport = new MockTransport();
  const context = new MockContext();

  return {
    Transport,
    context,

    // Core functions
    start: vi.fn().mockResolvedValue(undefined),
    now: () => context.currentTime,
    immediate: () => context.currentTime,

    // Audio nodes
    Gain: vi.fn(() => new MockGainNode()),
    Sampler: vi.fn(() => new MockSampler()),
    Oscillator: vi.fn(() => new MockOscillator()),
    Limiter: vi.fn(() => new MockLimiter()),
    Compressor: vi.fn(() => new MockCompressor()),

    // Utilities
    Frequency: vi.fn((freq: any) => ({
      toFrequency: () => (typeof freq === 'string' ? 440 : freq),
      toMidi: () => 69,
      toNote: () => 'A4',
    })),

    Time: vi.fn((time: any) => ({
      toSeconds: () =>
        typeof time === 'string' ? Transport.getSecondsAtTime(time) : time,
      toTicks: () => 960,
    })),

    // Get context
    getContext: () => context,
    setContext: vi.fn(),

    // Constants
    version: '15.1.22',
  };
};

// Helper to install the mock globally
export function installToneMock() {
  const toneMock = createToneMock();

  if (typeof window !== 'undefined') {
    (window as any).__globalTone = toneMock;
  } else if (typeof global !== 'undefined') {
    if (!global.window) {
      global.window = {} as any;
    }
    (global.window as any).__globalTone = toneMock;
  }

  return toneMock;
}

// Helper to simulate timing updates for UnifiedTransport
export function simulateTransportTiming(
  eventBus: any,
  duration = 2000,
  transport?: any,
) {
  const startTime = performance.now(); // Use performance.now() for higher precision
  let intervalId: NodeJS.Timeout | null = null;
  let lastUpdateTime = startTime;
  const scheduledEvents: Array<{
    time: number;
    callback: Function;
    executed: boolean;
  }> = [];
  let lastEventExecutionTime = 0;

  // Subscribe to scheduleEvent calls to capture scheduled events
  const transportInstance = transport || (eventBus as any).transport;
  const originalScheduleEvent = transportInstance?.scheduleEvent;
  console.log(
    `🔍 TIMING: Transport instance found: ${!!transportInstance}, has scheduleEvent: ${!!transportInstance?.scheduleEvent}`,
  );

  if (transportInstance) {
    transportInstance.scheduleEvent = (event: any) => {
      scheduledEvents.push({
        time: event.time,
        callback: event.callback,
        executed: false,
      });
      console.log(
        `🎵 CAPTURED: Scheduled event at time ${event.time.toFixed(3)}, total events: ${scheduledEvents.length}`,
      );
      return `mock-event-${scheduledEvents.length}`;
    };
    console.log(`🔍 TIMING: Replaced scheduleEvent method on transport`);
  } else {
    console.log(`⚠️ TIMING: No transport instance to mock scheduleEvent`);
  }

  const updateTiming = () => {
    const now = performance.now();
    const elapsed = (now - startTime) / 1000;
    const bpm = 120;
    const beatsPerSecond = bpm / 60;
    const totalBeats = elapsed * beatsPerSecond;

    // Calculate bars, beats, and sixteenths correctly
    const bars = Math.floor(totalBeats / 4);
    const beatsInBar = totalBeats % 4;
    const beats = Math.floor(beatsInBar);
    const fractionalBeat = beatsInBar - beats;
    const sixteenths = Math.floor(fractionalBeat * 4);
    const ticks = Math.floor(fractionalBeat * 4 * 240); // 240 ticks per sixteenth

    // Update the transport's musicalPosition directly for position tracking in tests
    if (transportInstance) {
      if (typeof transportInstance.updatePositionForTest === 'function') {
        transportInstance.updatePositionForTest({
          bars,
          beats,
          sixteenths,
          ticks,
        });

        // Debug: Verify position was updated
        if (
          elapsed > 0.5 &&
          elapsed < 1.0 &&
          Math.floor(elapsed * 10) % 5 === 0
        ) {
          const currentPos = transportInstance.getPosition?.();
          console.log(
            `🔍 Position after update: elapsed=${elapsed.toFixed(3)}`,
            currentPos,
          );
        }
      } else {
        // Fallback: Try to find and call the internal position update method
        if (typeof transportInstance.setPositionForTesting === 'function') {
          transportInstance.setPositionForTesting({
            bars,
            beats,
            sixteenths,
            ticks,
          });
        } else {
          // Debug: Log why update failed
          if (elapsed < 0.1) {
            console.log(
              '⚠️ Transport updatePositionForTest method not available:',
              {
                hasTransport: !!transportInstance,
                hasUpdateMethod: typeof transportInstance.updatePositionForTest,
                hasSetMethod: typeof transportInstance.setPositionForTesting,
                availableMethods: Object.getOwnPropertyNames(
                  Object.getPrototypeOf(transportInstance),
                ).filter((name) => name.includes('osition')),
              },
            );
          }
        }
      }
    }

    // Process scheduled events with high precision
    // Execute any events that should have triggered by now
    if (scheduledEvents.length > 0 && elapsed > 0.1 && elapsed < 0.2) {
      console.log(
        `🔍 TIMING: Processing ${scheduledEvents.length} scheduled events at elapsed=${elapsed.toFixed(3)}`,
      );
      scheduledEvents.forEach((event, index) => {
        console.log(
          `🔍 EVENT ${index}: time=${event.time.toFixed(3)}, executed=${event.executed}`,
        );
      });
    }

    scheduledEvents.forEach((event) => {
      // Allow events at time 0.0 to execute immediately, or events that are due
      const shouldExecute =
        !event.executed &&
        (event.time <= elapsed || (event.time === 0 && elapsed > 0));

      if (shouldExecute) {
        // Execute with the exact scheduled time to maintain precision
        const executionDelay = elapsed - event.time;
        if (executionDelay > 0.005) {
          console.log(
            `⚠️ Event scheduled for ${event.time.toFixed(3)} executed at ${elapsed.toFixed(3)} (${(executionDelay * 1000).toFixed(1)}ms late)`,
          );
        } else {
          console.log(
            `✅ Executing event scheduled for time ${event.time.toFixed(3)} at ${elapsed.toFixed(3)}`,
          );
        }
        event.callback(event.time); // Pass the scheduled time, not current time
        event.executed = true;
        lastEventExecutionTime = now;
      }
    });

    // Only emit timing update if enough time has passed (match UnifiedTransport's 2.67ms schedule interval)
    if (now - lastUpdateTime >= 2.67) {
      lastUpdateTime = now;

      eventBus.emit('transport:timing-update', {
        time: elapsed,
        position: {
          bars,
          beats,
          sixteenths,
          ticks,
        },
        state: 'playing',
      });
    }
  };

  // Use high-precision timing loop
  const scheduleNextUpdate = () => {
    updateTiming();
    if (intervalId !== null) {
      // Use 1ms interval for better event timing precision
      // The timing update emission is still controlled by the 2.67ms check
      intervalId = setTimeout(scheduleNextUpdate, 1);
    }
  };

  // Start timing updates
  intervalId = setTimeout(scheduleNextUpdate, 0);

  // Return cleanup function
  return () => {
    if (intervalId !== null) {
      clearTimeout(intervalId);
      intervalId = null;
    }
    // Restore original scheduleEvent if it was replaced
    if (originalScheduleEvent && transportInstance) {
      transportInstance.scheduleEvent = originalScheduleEvent;
    }
  };
}
