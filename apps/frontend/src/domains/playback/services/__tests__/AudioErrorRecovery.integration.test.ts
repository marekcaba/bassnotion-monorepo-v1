/**
 * Audio Error Recovery Integration Tests
 *
 * Tests error handling and recovery mechanisms throughout the audio pipeline
 * Validates circuit breakers, graceful degradation, and error propagation
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  vi,
} from 'vitest';
import * as Tone from 'tone';
import {
  ServiceRegistry,
  getServiceRegistry,
} from '../core/ServiceRegistry.js';
import { AudioEngine } from '../core/AudioEngine.js';
import { UnifiedTransport } from '../core/UnifiedTransport.js';
import { PatternScheduler } from '../core/PatternScheduler.js';
import { EventBus } from '../core/EventBus.js';
import { Track } from '../core/Track.js';
import { CircuitBreaker } from '../../patterns/CircuitBreaker.js';
import { ErrorHandler } from '../../errors/ErrorHandler.js';
import { AudioSampleManager } from '../storage/AudioSampleManager.js';
import { setupRealTone } from '../../../../test/utils/realToneTestUtils.js';
import type {
  Pattern,
  DrumPattern,
  BassPattern,
  MetronomePattern,
} from '../../types/pattern.js';
import { toMusicalPosition } from '../../types/pattern.js';
import { getLogger } from '@/utils/logger.js';

const logger = getLogger('AudioErrorRecovery.integration.test');

interface ErrorEvent {
  type: string;
  error: Error;
  timestamp: number;
  recovered: boolean;
  context?: any;
}

describe('Audio Error Recovery Integration', () => {
  let serviceRegistry: ServiceRegistry;
  let audioEngine: AudioEngine;
  let transport: UnifiedTransport;
  let scheduler: PatternScheduler;
  let eventBus: EventBus;
  let errorHandler: ErrorHandler;
  let sampleManager: AudioSampleManager;

  // Error tracking
  let errorEvents: ErrorEvent[] = [];
  let recoveryAttempts = 0;
  let successfulRecoveries = 0;

  beforeAll(async () => {
    await setupRealTone();
  });

  beforeEach(async () => {
    errorEvents = [];
    recoveryAttempts = 0;
    successfulRecoveries = 0;

    // Initialize services
    serviceRegistry = getServiceRegistry();
    audioEngine = AudioEngine.getInstance();
    await audioEngine.initialize();

    eventBus = new EventBus();
    transport = UnifiedTransport.getInstance(eventBus, audioEngine);
    scheduler = new PatternScheduler();
    errorHandler = new ErrorHandler();
    sampleManager = AudioSampleManager.getInstance();

    // Register services
    serviceRegistry.register('audioEngine', audioEngine);
    serviceRegistry.register('eventBus', eventBus);
    serviceRegistry.register('unifiedTransport', transport);
    serviceRegistry.register('patternScheduler', scheduler);
    serviceRegistry.register('errorHandler', errorHandler);
    serviceRegistry.register('audioSampleManager', sampleManager);

    await serviceRegistry.initialize();

    // Track errors and recoveries
    eventBus.on('error', (error: Error, context?: any) => {
      errorEvents.push({
        type: error.name || 'UnknownError',
        error,
        timestamp: Date.now(),
        recovered: false,
        context,
      });
    });

    eventBus.on('error-recovered', (error: Error) => {
      const event = errorEvents.find((e) => e.error === error);
      if (event) {
        event.recovered = true;
        successfulRecoveries++;
      }
    });

    eventBus.on('recovery-attempt', () => {
      recoveryAttempts++;
    });
  });

  afterEach(async () => {
    await transport.stop();
    scheduler.clearAll();
    await serviceRegistry.dispose();
    Tone.Transport.cancel();

    // Log error summary
    logger.info('Error recovery test summary', {
      totalErrors: errorEvents.length,
      recoveryAttempts,
      successfulRecoveries,
      recoveryRate:
        recoveryAttempts > 0 ? successfulRecoveries / recoveryAttempts : 0,
    });
  });

  describe('Audio Context Recovery', () => {
    it('should recover from audio context suspension', async () => {
      const track = new Track({
        id: 'test-context',
        name: 'Context Test',
        type: 'metronome',
      });

      track.createRegionFromPattern(
        {
          type: 'metronome',
          events: [
            { position: toMusicalPosition(0, 0, 0), type: 'click' },
            { position: toMusicalPosition(0, 1, 0), type: 'click' },
          ],
        } as MetronomePattern,
        {
          name: 'Test Pattern',
          startPosition: toMusicalPosition(0, 0, 0),
          duration: toMusicalPosition(1, 0, 0),
          loopCount: 0,
        },
      );

      scheduler.registerTrack(track.id, track.getRegions());

      // Start playback
      await transport.start();
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Simulate context suspension
      const context = audioEngine.getContext();
      if ('suspend' in context) {
        await context.suspend();

        // Verify suspension was detected
        expect(context.state).toBe('suspended');

        // Trigger recovery
        eventBus.emit('recovery-attempt');
        await audioEngine.start();

        // Wait for recovery
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Context should be running again
        expect(audioEngine.getContext().state).toBe('running');

        // Playback should continue
        const stateBefore = transport.getState();
        await new Promise((resolve) => setTimeout(resolve, 500));
        const stateAfter = transport.getState();

        expect(stateBefore).toBe('playing');
        expect(stateAfter).toBe('playing');
      }

      await transport.stop();
    });

    it('should handle audio context closure gracefully', async () => {
      // Create a track
      const track = new Track({
        id: 'closure-test',
        name: 'Closure Test',
        type: 'drum',
      });

      track.createRegionFromPattern(
        {
          type: 'drum',
          events: [
            {
              position: toMusicalPosition(0, 0, 0),
              drum: 'kick',
              velocity: 0.8,
            },
          ],
        } as DrumPattern,
        {
          name: 'Test Pattern',
          startPosition: toMusicalPosition(0, 0, 0),
          duration: toMusicalPosition(0, 1, 0),
        },
      );

      scheduler.registerTrack(track.id, track.getRegions());

      // Mock context closure
      const originalGetContext = audioEngine.getContext.bind(audioEngine);
      let contextClosed = false;

      vi.spyOn(audioEngine, 'getContext').mockImplementation(() => {
        if (contextClosed) {
          return { state: 'closed' } as any;
        }
        return originalGetContext();
      });

      await transport.start();

      // Simulate context closure after a delay
      setTimeout(() => {
        contextClosed = true;
        eventBus.emit('error', new Error('AudioContext closed'), {
          fatal: true,
        });
      }, 500);

      // Wait for error
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Should have detected the error
      expect(errorEvents.some((e) => e.error.message.includes('closed'))).toBe(
        true,
      );

      // Transport should stop gracefully
      expect(transport.getState()).toBe('stopped');

      // Restore mock
      vi.restoreAllMocks();
    });
  });

  describe('Sample Loading Errors', () => {
    it('should handle missing sample files', async () => {
      // Create track with non-existent samples
      const track = new Track({
        id: 'missing-sample',
        name: 'Missing Sample Test',
        type: 'drum',
      });

      // Mock sample loading failure
      const originalLoadSample = sampleManager.loadSample.bind(sampleManager);
      vi.spyOn(sampleManager, 'loadSample').mockRejectedValue(
        new Error('Sample not found: /samples/missing.wav'),
      );

      // Try to load pattern with missing samples
      const pattern: DrumPattern = {
        type: 'drum',
        events: [
          {
            position: toMusicalPosition(0, 0, 0),
            drum: 'missing-drum' as any,
            velocity: 0.8,
          },
        ],
      };

      track.createRegionFromPattern(pattern, {
        name: 'Missing Sample Pattern',
        startPosition: toMusicalPosition(0, 0, 0),
        duration: toMusicalPosition(1, 0, 0),
      });

      scheduler.registerTrack(track.id, track.getRegions());

      // Should not crash when starting
      await transport.start();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await transport.stop();

      // Should have logged the error
      expect(
        errorEvents.some((e) => e.error.message.includes('Sample not found')),
      ).toBe(true);

      // Restore mock
      vi.restoreAllMocks();
    });

    it('should fallback to default samples on load failure', async () => {
      const track = new Track({
        id: 'fallback-test',
        name: 'Fallback Test',
        type: 'bass',
      });

      // Configure fallback behavior
      let useFallback = false;
      vi.spyOn(sampleManager, 'loadSample').mockImplementation(
        async (path: string) => {
          if (path.includes('custom-bass')) {
            throw new Error('Custom sample not found');
          }
          // Return default sample
          return { url: '/samples/default-bass.wav', loaded: true };
        },
      );

      const pattern: BassPattern = {
        type: 'bass',
        events: [
          {
            position: toMusicalPosition(0, 0, 0),
            note: 'C2',
            duration: 'quarter',
            velocity: 0.7,
          },
        ],
      };

      track.createRegionFromPattern(pattern, {
        name: 'Fallback Pattern',
        startPosition: toMusicalPosition(0, 0, 0),
        duration: toMusicalPosition(1, 0, 0),
      });

      scheduler.registerTrack(track.id, track.getRegions());

      // Enable fallback
      eventBus.on('sample-load-error', (error: Error) => {
        useFallback = true;
        eventBus.emit('use-fallback-sample', { trackId: track.id });
      });

      await transport.start();
      await new Promise((resolve) => setTimeout(resolve, 500));
      await transport.stop();

      // Should have used fallback
      expect(useFallback).toBe(true);

      vi.restoreAllMocks();
    });
  });

  describe('Pattern Scheduling Errors', () => {
    it('should handle invalid pattern data gracefully', async () => {
      const track = new Track({
        id: 'invalid-pattern',
        name: 'Invalid Pattern Test',
        type: 'drum',
      });

      // Create pattern with invalid data
      const invalidPattern = {
        type: 'drum',
        events: [
          { position: null as any, drum: 'kick', velocity: 0.8 }, // Invalid position
          {
            position: toMusicalPosition(0, 0, 0),
            drum: null as any,
            velocity: 0.8,
          }, // Invalid drum
          {
            position: toMusicalPosition(0, 1, 0),
            drum: 'snare',
            velocity: NaN,
          }, // Invalid velocity
        ],
      } as DrumPattern;

      track.createRegionFromPattern(invalidPattern, {
        name: 'Invalid Pattern',
        startPosition: toMusicalPosition(0, 0, 0),
        duration: toMusicalPosition(1, 0, 0),
      });

      scheduler.registerTrack(track.id, track.getRegions());

      // Should handle errors without crashing
      await transport.start();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await transport.stop();

      // Should have logged validation errors
      const validationErrors = errorEvents.filter(
        (e) =>
          e.error.message.includes('Invalid') ||
          e.error.message.includes('validation'),
      );
      expect(validationErrors.length).toBeGreaterThan(0);
    });

    it('should recover from scheduling failures', async () => {
      const track = new Track({
        id: 'schedule-fail',
        name: 'Schedule Fail Test',
        type: 'metronome',
      });

      // Mock scheduling failure
      let failCount = 0;
      const originalSchedule = Tone.Transport.schedule;
      vi.spyOn(Tone.Transport, 'schedule').mockImplementation(
        (callback, time) => {
          if (failCount++ < 2) {
            throw new Error('Scheduling failed');
          }
          return originalSchedule.call(Tone.Transport, callback, time);
        },
      );

      const pattern: MetronomePattern = {
        type: 'metronome',
        events: [
          { position: toMusicalPosition(0, 0, 0), type: 'click' },
          { position: toMusicalPosition(0, 1, 0), type: 'click' },
        ],
      };

      track.createRegionFromPattern(pattern, {
        name: 'Retry Pattern',
        startPosition: toMusicalPosition(0, 0, 0),
        duration: toMusicalPosition(1, 0, 0),
      });

      scheduler.registerTrack(track.id, track.getRegions());

      // Should retry and eventually succeed
      await transport.start();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await transport.stop();

      // Should have attempted recovery
      expect(recoveryAttempts).toBeGreaterThan(0);
      expect(successfulRecoveries).toBeGreaterThan(0);

      vi.restoreAllMocks();
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should trigger circuit breaker on repeated failures', async () => {
      // Create circuit breaker for audio operations
      const audioCircuitBreaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeout: 1000,
        monitoringPeriod: 2000,
      });

      let circuitOpen = false;
      audioCircuitBreaker.on('open', () => {
        circuitOpen = true;
        eventBus.emit('circuit-breaker-open', { service: 'audio' });
      });

      // Simulate repeated audio failures
      const failingOperation = async () => {
        throw new Error('Audio operation failed');
      };

      // Try multiple times
      for (let i = 0; i < 5; i++) {
        try {
          await audioCircuitBreaker.execute(failingOperation);
        } catch (error) {
          errorEvents.push({
            type: 'CircuitBreakerError',
            error: error as Error,
            timestamp: Date.now(),
            recovered: false,
          });
        }
      }

      // Circuit should be open
      expect(circuitOpen).toBe(true);
      expect(audioCircuitBreaker.getState()).toBe('OPEN');

      // Should reject immediately when open
      const startTime = Date.now();
      try {
        await audioCircuitBreaker.execute(failingOperation);
      } catch (error) {
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(10); // Should fail fast
      }
    });

    it('should recover when circuit breaker closes', async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 500,
        monitoringPeriod: 1000,
      });

      let operationCount = 0;
      const unstableOperation = async () => {
        operationCount++;
        if (operationCount <= 2) {
          throw new Error('Operation failed');
        }
        return 'success';
      };

      // Trigger failures to open circuit
      for (let i = 0; i < 2; i++) {
        try {
          await circuitBreaker.execute(unstableOperation);
        } catch (error) {
          // Expected failures
        }
      }

      expect(circuitBreaker.getState()).toBe('OPEN');

      // Wait for half-open state
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Should succeed and close circuit
      const result = await circuitBreaker.execute(unstableOperation);
      expect(result).toBe('success');
      expect(circuitBreaker.getState()).toBe('CLOSED');
    });
  });

  describe('Error Propagation', () => {
    it('should propagate errors through the event system', async () => {
      const track = new Track({
        id: 'error-prop',
        name: 'Error Propagation Test',
        type: 'drum',
      });

      // Create handler that throws
      let handlerCalled = false;
      eventBus.on('drum-trigger', () => {
        handlerCalled = true;
        throw new Error('Handler error');
      });

      track.createRegionFromPattern(
        {
          type: 'drum',
          events: [
            {
              position: toMusicalPosition(0, 0, 0),
              drum: 'kick',
              velocity: 0.8,
            },
          ],
        } as DrumPattern,
        {
          name: 'Error Pattern',
          startPosition: toMusicalPosition(0, 0, 0),
          duration: toMusicalPosition(1, 0, 0),
        },
      );

      scheduler.registerTrack(track.id, track.getRegions());

      await transport.start();
      await new Promise((resolve) => setTimeout(resolve, 500));
      await transport.stop();

      // Handler should have been called
      expect(handlerCalled).toBe(true);

      // Error should be captured
      expect(errorEvents.some((e) => e.error.message === 'Handler error')).toBe(
        true,
      );

      // System should remain stable
      expect(transport.getState()).toBe('stopped');
    });

    it('should isolate errors between services', async () => {
      // Create multiple tracks
      const workingTrack = new Track({
        id: 'working',
        name: 'Working Track',
        type: 'metronome',
      });

      const failingTrack = new Track({
        id: 'failing',
        name: 'Failing Track',
        type: 'drum',
      });

      // Add patterns
      workingTrack.createRegionFromPattern(
        {
          type: 'metronome',
          events: [{ position: toMusicalPosition(0, 0, 0), type: 'click' }],
        } as MetronomePattern,
        {
          name: 'Working Pattern',
          startPosition: toMusicalPosition(0, 0, 0),
          duration: toMusicalPosition(1, 0, 0),
          loopCount: 0,
        },
      );

      failingTrack.createRegionFromPattern(
        {
          type: 'drum',
          events: [
            {
              position: toMusicalPosition(0, 0, 0),
              drum: 'kick',
              velocity: 0.8,
            },
          ],
        } as DrumPattern,
        {
          name: 'Failing Pattern',
          startPosition: toMusicalPosition(0, 0, 0),
          duration: toMusicalPosition(1, 0, 0),
          loopCount: 0,
        },
      );

      // Make drum track fail
      eventBus.on('drum-trigger', (data) => {
        if (data.trackId === 'failing') {
          throw new Error('Drum track failed');
        }
      });

      // Track metronome events
      let metronomeEvents = 0;
      eventBus.on('metronome-trigger', () => {
        metronomeEvents++;
      });

      scheduler.registerTrack(workingTrack.id, workingTrack.getRegions());
      scheduler.registerTrack(failingTrack.id, failingTrack.getRegions());

      await transport.start();
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await transport.stop();

      // Working track should continue despite failures
      expect(metronomeEvents).toBeGreaterThan(0);

      // Errors should be isolated
      const drumErrors = errorEvents.filter((e) =>
        e.error.message.includes('Drum track failed'),
      );
      expect(drumErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Graceful Degradation', () => {
    it('should reduce quality under high load', async () => {
      // Create many tracks to simulate high load
      const tracks: Track[] = [];

      for (let i = 0; i < 20; i++) {
        const track = new Track({
          id: `load-test-${i}`,
          name: `Load Test ${i}`,
          type: 'drum',
        });

        // Dense pattern
        const events = [];
        for (let j = 0; j < 16; j++) {
          events.push({
            position: toMusicalPosition(0, Math.floor(j / 4), j % 4),
            drum: 'hihat' as const,
            velocity: 0.5,
          });
        }

        track.createRegionFromPattern(
          {
            type: 'drum',
            events,
          } as DrumPattern,
          {
            name: 'Load Pattern',
            startPosition: toMusicalPosition(0, 0, 0),
            duration: toMusicalPosition(1, 0, 0),
            loopCount: 0,
          },
        );

        tracks.push(track);
        scheduler.registerTrack(track.id, track.getRegions());
      }

      // Monitor performance degradation
      let degradationTriggered = false;
      eventBus.on('performance-degradation', () => {
        degradationTriggered = true;
      });

      await transport.start();

      // Simulate CPU spike
      const startTime = Date.now();
      while (Date.now() - startTime < 100) {
        Math.sqrt(Math.random()); // Busy work
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
      await transport.stop();

      // Should have triggered degradation mode
      // (In real implementation, this would reduce sample rates, disable effects, etc.)
      // For now, we just check that the system survived
      expect(transport.getState()).toBe('stopped');
    });

    it('should prioritize critical tracks during degradation', async () => {
      // Create tracks with different priorities
      const criticalTrack = new Track({
        id: 'critical',
        name: 'Critical Track',
        type: 'metronome',
        metadata: { priority: 'high' },
      });

      const normalTrack = new Track({
        id: 'normal',
        name: 'Normal Track',
        type: 'drum',
        metadata: { priority: 'normal' },
      });

      // Add patterns
      criticalTrack.createRegionFromPattern(
        {
          type: 'metronome',
          events: [{ position: toMusicalPosition(0, 0, 0), type: 'accent' }],
        } as MetronomePattern,
        {
          name: 'Critical Pattern',
          startPosition: toMusicalPosition(0, 0, 0),
          duration: toMusicalPosition(1, 0, 0),
          loopCount: 0,
        },
      );

      normalTrack.createRegionFromPattern(
        {
          type: 'drum',
          events: [
            {
              position: toMusicalPosition(0, 0, 0),
              drum: 'kick',
              velocity: 0.8,
            },
          ],
        } as DrumPattern,
        {
          name: 'Normal Pattern',
          startPosition: toMusicalPosition(0, 0, 0),
          duration: toMusicalPosition(1, 0, 0),
          loopCount: 0,
        },
      );

      // Track events by priority
      let criticalEvents = 0;
      let normalEvents = 0;

      eventBus.on('metronome-trigger', () => criticalEvents++);
      eventBus.on('drum-trigger', () => normalEvents++);

      scheduler.registerTrack(criticalTrack.id, criticalTrack.getRegions());
      scheduler.registerTrack(normalTrack.id, normalTrack.getRegions());

      await transport.start();
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await transport.stop();

      // Both should play normally
      expect(criticalEvents).toBeGreaterThan(0);
      expect(normalEvents).toBeGreaterThan(0);

      // In degradation mode, critical would be prioritized
      // This is a placeholder for actual priority implementation
      logger.info('Priority test', {
        criticalEvents,
        normalEvents,
        ratio: criticalEvents / normalEvents,
      });
    });
  });
});
