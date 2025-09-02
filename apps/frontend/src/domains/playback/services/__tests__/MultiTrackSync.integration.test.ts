// Mock Canvas API for JSDOM before any imports
if (typeof global !== 'undefined') {
  if (!global.HTMLCanvasElement) {
    global.HTMLCanvasElement = function () {};
  }
  global.HTMLCanvasElement.prototype.getContext = () => ({
    fillRect: () => {},
    clearRect: () => {},
    getImageData: () => ({ data: [] }),
    putImageData: () => {},
    createImageData: () => [],
    setTransform: () => {},
    drawImage: () => {},
    save: () => {},
    fillText: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    stroke: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    arc: () => {},
    fill: () => {},
    measureText: () => ({ width: 0 }),
    transform: () => {},
    rect: () => {},
    clip: () => {},
    toDataURL: () => 'data:image/png;base64,mock',
  });
  global.HTMLCanvasElement.prototype.toDataURL = () =>
    'data:image/png;base64,mock';

  // Mock URL.createObjectURL for Web Worker support
  if (!global.URL) {
    global.URL = { createObjectURL: () => 'blob:mock-url' } as any;
  } else if (!global.URL.createObjectURL) {
    global.URL.createObjectURL = () => 'blob:mock-url';
  }

  // Mock Worker for test environment
  if (!global.Worker) {
    global.Worker = class MockWorker {
      postMessage = () => {};
      terminate = () => {};
      addEventListener = () => {};
      removeEventListener = () => {};
    } as any;
  }
}

/**
 * Multi-Track Synchronization Integration Tests
 *
 * Tests precise synchronization between multiple tracks playing simultaneously
 * Validates sub-millisecond timing accuracy and audio mixing
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  vi,
} from 'vitest';
import * as Tone from 'tone';
import {
  ServiceRegistry,
  getServiceRegistry,
  resetServiceRegistry,
} from '../core/ServiceRegistry.js';
import { AudioEngine } from '../core/AudioEngine.js';
import { UnifiedTransport } from '../core/UnifiedTransport.js';
import { PatternScheduler } from '../core/PatternScheduler.js';
import { EventBus } from '../core/EventBus.js';
import { Track } from '../core/Track.js';
import { TrackMixingEngine } from '../core/TrackMixingEngine.js';
import { MultiTrackTimingSynchronizer } from '../core/MultiTrackTimingSynchronizer.js';
import {
  installAudioMocks,
  cleanupAudioMocks,
} from '../../../../test/mocks/setupAudioMocks.js';
import { simulateTransportTiming } from '../../../../test/mocks/toneIntegrationMock.js';
import {
  setupAudioTestEnvironment,
  resetAudioEngine,
  getTestAudioEngineConfig,
} from '../../../../test/utils/audioTestSetup.js';
import { PatternConverter } from '../core/PatternConverter.js';

// Set up environment variables for testing
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoxOTAwMDAwMDAwfQ.test';
import type {
  DrumPattern,
  BassPattern,
  HarmonyPattern,
  MetronomePattern,
  MusicalPosition,
} from '../../types/pattern.js';
import {
  toMusicalPosition,
  parseMusicalPosition,
} from '../../types/pattern.js';
import { getLogger } from '@/utils/logger.js';

const logger = getLogger('MultiTrackSync.integration.test');

interface TimingEvent {
  trackId: string;
  type: string;
  scheduledTime: number;
  actualTime: number;
  drift: number;
  position: MusicalPosition;
}

describe('Multi-Track Synchronization', () => {
  let serviceRegistry: ServiceRegistry;
  let audioEngine: AudioEngine;
  let transport: UnifiedTransport;
  let scheduler: PatternScheduler;
  let eventBus: EventBus;
  let mixingEngine: TrackMixingEngine;
  let timingSynchronizer: MultiTrackTimingSynchronizer;

  // Timing analysis
  let timingEvents: TimingEvent[] = [];
  const performanceMarks: Map<string, DOMHighResTimeStamp> = new Map();
  let cleanupTiming: (() => void) | null = null;

  beforeAll(async () => {
    // Install comprehensive audio mocks first
    installAudioMocks();

    // Mock window for Tone.js global storage
    if (typeof window === 'undefined') {
      global.window = { ...global.window, __globalTone: null } as any;
    }
  });

  afterAll(() => {
    // Clean up mocks
    cleanupAudioMocks();
  });

  beforeEach(async () => {
    timingEvents = [];
    performanceMarks.clear();

    // Initialize AudioEngine with test configuration that bypasses browser checks
    audioEngine = AudioEngine.getInstance(
      undefined,
      getTestAudioEngineConfig(),
    );
    await audioEngine.preInitialize();
    await audioEngine.initialize();

    // Initialize services
    serviceRegistry = getServiceRegistry();

    eventBus = new EventBus();

    // Register EventBus first so other services can find it
    serviceRegistry.register('eventBus', eventBus);
    serviceRegistry.register('audioEngine', audioEngine);

    // Now create services that depend on EventBus
    transport = UnifiedTransport.getInstance(eventBus, audioEngine);
    scheduler = new PatternScheduler();
    mixingEngine = new TrackMixingEngine();

    // Register remaining services
    serviceRegistry.register('unifiedTransport', transport);
    serviceRegistry.register('patternScheduler', scheduler);
    serviceRegistry.register('trackMixingEngine', mixingEngine);

    // Initialize services before creating MultiTrackTimingSynchronizer
    await serviceRegistry.initialize();

    // Now create MultiTrackTimingSynchronizer after EventBus is registered
    timingSynchronizer = MultiTrackTimingSynchronizer.getInstance();
    serviceRegistry.register(
      'multiTrackTimingSynchronizer',
      timingSynchronizer,
    );

    // Initialize MultiTrackTimingSynchronizer separately since it wasn't in the initial batch
    await timingSynchronizer.initialize();

    await serviceRegistry.start();

    // Configure PatternConverter to use the same EventBus instance as the test
    PatternConverter.setEventBus(eventBus);

    // Debug EventBus instances
    console.log(`🔍 TEST: EventBus instance ID: ${eventBus.getInstanceId()}`);
    console.log(`🔍 TEST: PatternConverter EventBus access test`);

    // Setup precise timing tracking
    const trackEvent = (trackId: string, type: string, data: any) => {
      console.log(
        `🔥 TEST: trackEvent called! trackId=${trackId}, type=${type}, data=`,
        data,
      );

      try {
        const now = Tone.now();

        // Parse position string into object for filtering
        const positionStr = data.position || toMusicalPosition(0, 0, 0);
        console.log(
          `🔍 TEST: positionStr=${positionStr}, type=${typeof positionStr}`,
        );

        const positionObj =
          typeof positionStr === 'string'
            ? parseMusicalPosition(positionStr)
            : positionStr;
        console.log(`🔍 TEST: positionObj=`, positionObj);

        const event = {
          trackId,
          type,
          scheduledTime: data.audioTime || now,
          actualTime: now,
          drift: now - (data.audioTime || now),
          position: positionObj, // Store as object, not string
        };

        console.log(`🔍 TEST: About to push event:`, event);
        timingEvents.push(event);
        console.log(
          `🔍 TEST: Successfully pushed event. Array length: ${timingEvents.length}`,
        );

        // Debug: Log captured events
        console.log(`🎯 TEST: Captured ${type} event for track ${trackId}:`, {
          scheduledTime: event.scheduledTime,
          actualTime: event.actualTime,
          position: event.position,
          dataReceived: data,
          totalEventsNow: timingEvents.length,
        });

        console.log(
          `🔍 TEST: timingEvents array now has ${timingEvents.length} events`,
        );
        console.log(`🔍 TEST: Last added event:`, event);
      } catch (error) {
        console.error(`❌ TEST: Error in trackEvent:`, error);
        throw error;
      }
    };

    // Track all audio events
    console.log(
      `🔍 TEST: Attaching event listeners to EventBus ${eventBus.getInstanceId()}`,
    );
    eventBus.on('drum-trigger', (data) => {
      console.log(
        `🔥 TEST: drum-trigger received on EventBus ${eventBus.getInstanceId()}`,
      );
      trackEvent(data.trackId, 'drum', data);
    });
    eventBus.on('bass-trigger', (data) => {
      console.log(
        `🔥 TEST: bass-trigger received on EventBus ${eventBus.getInstanceId()}`,
      );
      trackEvent(data.trackId, 'bass', data);
    });
    eventBus.on('chord-trigger', (data) => {
      console.log(
        `🔥 TEST: chord-trigger received on EventBus ${eventBus.getInstanceId()}`,
      );
      trackEvent(data.trackId, 'chord', data);
    });
    eventBus.on('metronome-trigger', (data) => {
      console.log(
        `🔥 TEST: metronome-trigger received on EventBus ${eventBus.getInstanceId()}`,
      );
      trackEvent(data.trackId, 'metronome', data);
    });
  });

  afterEach(async () => {
    // Clean up safely and thoroughly
    try {
      // Stop timing simulation first
      if (cleanupTiming) {
        cleanupTiming();
        cleanupTiming = null;
      }

      if (transport) {
        try {
          await transport.stop();
        } catch (error) {
          // Ignore transport stop errors in test cleanup
        }
      }

      if (scheduler) {
        // PatternScheduler uses dispose() method instead of clearAll()
        try {
          await scheduler.dispose();
        } catch (error) {
          // Ignore scheduler disposal errors
        }
      }

      if (serviceRegistry) {
        try {
          await serviceRegistry.dispose();
        } catch (error) {
          // Ignore registry disposal errors
        }
      }
    } catch (error) {
      // Ignore cleanup errors but log them
      console.warn('Test cleanup error:', error);
    }

    // Reset singletons for clean state
    try {
      if (
        typeof UnifiedTransport !== 'undefined' &&
        UnifiedTransport.resetInstance
      ) {
        UnifiedTransport.resetInstance();
      }
      if (typeof AudioEngine !== 'undefined' && AudioEngine.resetInstance) {
        AudioEngine.resetInstance();
      }
      if (
        typeof MultiTrackTimingSynchronizer !== 'undefined' &&
        (MultiTrackTimingSynchronizer as any).resetInstance
      ) {
        (MultiTrackTimingSynchronizer as any).resetInstance();
      }
    } catch (error) {
      console.warn('Singleton reset error:', error);
    }

    // Clear any global service state
    if (typeof window !== 'undefined') {
      delete (window as any).__globalEventBus;
      delete (window as any).__globalCoreServices;
    }

    // Reset global ServiceRegistry to get fresh instance for each test
    resetServiceRegistry();

    // Reset variables to avoid cross-test pollution
    timingEvents = [];
    performanceMarks.clear();
    serviceRegistry = null as any;
    audioEngine = null as any;
    transport = null as any;
    scheduler = null as any;
    eventBus = null as any;
    mixingEngine = null as any;
    timingSynchronizer = null as any;
  });

  describe('Basic Multi-Track Sync', () => {
    it('should start all tracks at exactly the same time', async () => {
      // Create 4 tracks that all play on beat 1
      const tracks = [
        { id: 'drums', name: 'Drums', instrumentType: 'drum' as const },
        { id: 'bass', name: 'Bass', instrumentType: 'bass' as const },
        { id: 'harmony', name: 'Harmony', instrumentType: 'chord' as const },
        { id: 'click', name: 'Click', instrumentType: 'metronome' as const },
      ].map((config) => new Track(config));

      // Add synchronized patterns (all start at 0:0:0)
      tracks[0].createRegionFromPattern(
        {
          type: 'drum',
          id: 'test-drum',
          events: [
            {
              position: toMusicalPosition(0, 0, 0),
              drum: 'kick',
              velocity: 0.8,
            },
          ],
          loopLength: 1,
        } as DrumPattern,
        {
          name: 'Kick',
          startPosition: toMusicalPosition(0, 0, 0),
          duration: toMusicalPosition(1, 0, 0),
        },
      );

      tracks[1].createRegionFromPattern(
        {
          type: 'bass',
          id: 'test-bass',
          events: [
            {
              position: toMusicalPosition(0, 0, 0),
              note: 'C2',
              duration: 'quarter',
              velocity: 0.7,
            },
          ],
          loopLength: 1,
        } as BassPattern,
        {
          name: 'Root',
          startPosition: toMusicalPosition(0, 0, 0),
          duration: toMusicalPosition(1, 0, 0),
        },
      );

      tracks[2].createRegionFromPattern(
        {
          type: 'chord',
          id: 'test-chord',
          events: [
            {
              position: toMusicalPosition(0, 0, 0),
              chord: 'Cmaj',
              notes: ['C3', 'E3', 'G3'],
              duration: 'quarter',
              velocity: 0.6,
            },
          ],
          loopLength: 1,
        } as HarmonyPattern,
        {
          name: 'C Major',
          startPosition: toMusicalPosition(0, 0, 0),
          duration: toMusicalPosition(1, 0, 0),
        },
      );

      tracks[3].createRegionFromPattern(
        {
          type: 'metronome',
          id: 'test-metronome',
          events: [{ position: toMusicalPosition(0, 0, 0), type: 'accent' }],
          loopLength: 1,
        } as MetronomePattern,
        {
          name: 'Downbeat',
          startPosition: toMusicalPosition(0, 0, 0),
          duration: toMusicalPosition(1, 0, 0),
        },
      );

      // Register all tracks
      tracks.forEach((track) =>
        scheduler.registerTrack(track.id, track.getRegions()),
      );

      // Start playback
      performanceMarks.set('start', performance.now());
      await transport.start();

      // Start timing simulation to trigger events
      cleanupTiming = simulateTransportTiming(eventBus, 200, transport);

      // Wait for first beat
      await new Promise((resolve) => setTimeout(resolve, 200));

      await transport.stop();
      performanceMarks.set('stop', performance.now());

      // Analyze synchronization
      console.log(
        `🔍 TEST: Total timingEvents before filtering: ${timingEvents.length}`,
      );
      console.log(
        `🔍 TEST: All timingEvents:`,
        timingEvents.map((e) => ({
          trackId: e.trackId,
          type: e.type,
          position: e.position,
        })),
      );

      const firstBeatEvents = timingEvents.filter(
        (e) =>
          e.position.bar === 0 &&
          e.position.beat === 0 &&
          e.position.sixteenth === 0,
      );

      console.log(
        `🔍 TEST: Filtered firstBeatEvents: ${firstBeatEvents.length}`,
      );
      console.log(`🔍 TEST: firstBeatEvents details:`, firstBeatEvents);

      expect(firstBeatEvents.length).toBe(4); // All 4 tracks should trigger

      // Calculate timing spread
      const times = firstBeatEvents.map((e) => e.actualTime);
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      const spread = maxTime - minTime;

      // Professional standard: < 1ms spread
      expect(spread).toBeLessThan(0.001);

      logger.info('Track sync analysis', {
        trackCount: tracks.length,
        eventCount: firstBeatEvents.length,
        timingSpread: spread * 1000, // Convert to ms
        individualDrifts: firstBeatEvents.map((e) => ({
          track: e.trackId,
          drift: e.drift * 1000,
        })),
      });
    });

    it(
      'should maintain synchronization over multiple bars',
      { timeout: 10000 },
      async () => {
        // Create complementary rhythm patterns
        const drumTrack = new Track({
          id: 'drums-sync',
          name: 'Drums',
          instrumentType: 'drum',
        });
        const bassTrack = new Track({
          id: 'bass-sync',
          name: 'Bass',
          instrumentType: 'bass',
        });

        // 4-bar drum pattern
        const drumPattern: DrumPattern = {
          type: 'drum',
          events: [],
        };

        // Add events for 4 bars
        for (let bar = 0; bar < 4; bar++) {
          drumPattern.events.push(
            {
              position: toMusicalPosition(bar, 0, 0),
              drum: 'kick',
              velocity: 0.8,
            },
            {
              position: toMusicalPosition(bar, 1, 0),
              drum: 'snare',
              velocity: 0.7,
            },
            {
              position: toMusicalPosition(bar, 2, 0),
              drum: 'kick',
              velocity: 0.6,
            },
            {
              position: toMusicalPosition(bar, 3, 0),
              drum: 'snare',
              velocity: 0.7,
            },
          );
        }

        // Complementary bass pattern
        const bassPattern: BassPattern = {
          type: 'bass',
          events: [],
        };

        for (let bar = 0; bar < 4; bar++) {
          bassPattern.events.push(
            {
              position: toMusicalPosition(bar, 0, 0),
              note: 'C2',
              duration: 'eighth',
              velocity: 0.7,
            },
            {
              position: toMusicalPosition(bar, 0, 8),
              note: 'C2',
              duration: 'eighth',
              velocity: 0.5,
            },
            {
              position: toMusicalPosition(bar, 2, 0),
              note: 'G2',
              duration: 'quarter',
              velocity: 0.6,
            },
          );
        }

        // Create regions
        drumTrack.createRegionFromPattern(drumPattern, {
          name: '4-Bar Drums',
          startPosition: toMusicalPosition(0, 0, 0),
          duration: toMusicalPosition(4, 0, 0),
        });

        bassTrack.createRegionFromPattern(bassPattern, {
          name: '4-Bar Bass',
          startPosition: toMusicalPosition(0, 0, 0),
          duration: toMusicalPosition(4, 0, 0),
        });

        // Register and play
        scheduler.registerTrack(drumTrack.id, drumTrack.getRegions());
        scheduler.registerTrack(bassTrack.id, bassTrack.getRegions());

        await transport.start();

        // Start timing simulation to trigger events
        cleanupTiming = simulateTransportTiming(eventBus, 8500, transport);

        // Wait for 4 bars at 120 BPM (8 seconds)
        await new Promise((resolve) => setTimeout(resolve, 8200));

        await transport.stop();

        // Debug: Check what events we captured
        console.log(
          `🔍 Multi-bar test: Total events captured: ${timingEvents.length}`,
        );
        console.log(
          `🔍 Multi-bar test: Event types:`,
          timingEvents.map((e) => ({
            trackId: e.trackId,
            type: e.type,
            position: e.position,
          })),
        );

        // Analyze synchronization at each downbeat
        const downbeats: TimingEvent[][] = [];
        for (let bar = 0; bar < 4; bar++) {
          const barEvents = timingEvents.filter(
            (e) =>
              e.position.bar === bar &&
              e.position.beat === 0 &&
              e.position.sixteenth === 0,
          );
          console.log(
            `🔍 Multi-bar test: Bar ${bar} downbeat events: ${barEvents.length}`,
          );
          if (barEvents.length > 0) {
            downbeats.push(barEvents);
          }
        }

        // Check sync at each downbeat
        const syncErrors: number[] = [];
        downbeats.forEach((events, barIndex) => {
          if (events.length >= 2) {
            const drumTime = events.find(
              (e) => e.trackId === 'drums-sync',
            )?.actualTime;
            const bassTime = events.find(
              (e) => e.trackId === 'bass-sync',
            )?.actualTime;

            if (drumTime && bassTime) {
              const syncError = Math.abs(drumTime - bassTime);
              syncErrors.push(syncError);

              // Each downbeat should be synchronized within 1ms
              expect(syncError).toBeLessThan(0.001);
            }
          }
        });

        // Average sync error should be very low
        console.log(`🔍 Multi-bar test: syncErrors array:`, syncErrors);
        console.log(`🔍 Multi-bar test: downbeats count:`, downbeats.length);

        // Check if we have any sync errors to analyze
        if (syncErrors.length === 0) {
          console.warn(
            `⚠️ Multi-bar test: No sync errors recorded. Downbeats: ${downbeats.length}`,
          );
          // If no events were captured, the test should fail with a meaningful message
          expect(timingEvents.length).toBeGreaterThan(0);
          expect(downbeats.length).toBeGreaterThan(0);
          expect(syncErrors.length).toBeGreaterThan(0);
        }

        const avgSyncError =
          syncErrors.reduce((a, b) => a + b, 0) / syncErrors.length;
        expect(avgSyncError).toBeLessThan(0.0005); // 0.5ms average

        logger.info('Multi-bar sync analysis', {
          bars: downbeats.length,
          avgSyncError: avgSyncError * 1000,
          maxSyncError: Math.max(...syncErrors) * 1000,
        });
      },
    );
  });

  describe('Complex Pattern Synchronization', () => {
    it('should handle polyrhythmic patterns', { timeout: 10000 }, async () => {
      // 3 against 4 polyrhythm
      const track3 = new Track({
        id: 'poly-3',
        name: '3-Beat',
        instrumentType: 'drum',
      });
      const track4 = new Track({
        id: 'poly-4',
        name: '4-Beat',
        instrumentType: 'drum',
      });

      // 3-beat pattern (triplets over 4/4)
      const pattern3: DrumPattern = {
        type: 'drum',
        events: [],
      };

      // Add 3 evenly spaced hits per bar
      const tripletDuration = 16 / 3; // 16 sixteenths / 3
      for (let i = 0; i < 3; i++) {
        const sixteenth = Math.round(i * tripletDuration);
        pattern3.events.push({
          position: toMusicalPosition(
            0,
            Math.floor(sixteenth / 4),
            sixteenth % 4,
          ),
          drum: 'clave',
          velocity: 0.7,
        });
      }

      // Standard 4-beat pattern
      const pattern4: DrumPattern = {
        type: 'drum',
        events: [
          { position: toMusicalPosition(0, 0, 0), drum: 'kick', velocity: 0.8 },
          { position: toMusicalPosition(0, 1, 0), drum: 'kick', velocity: 0.6 },
          { position: toMusicalPosition(0, 2, 0), drum: 'kick', velocity: 0.6 },
          { position: toMusicalPosition(0, 3, 0), drum: 'kick', velocity: 0.6 },
        ],
      };

      // Create looping regions
      track3.createRegionFromPattern(pattern3, {
        name: 'Triplet Pattern',
        startPosition: toMusicalPosition(0, 0, 0),
        duration: toMusicalPosition(1, 0, 0),
        loopCount: 4,
      });

      track4.createRegionFromPattern(pattern4, {
        name: 'Quarter Pattern',
        startPosition: toMusicalPosition(0, 0, 0),
        duration: toMusicalPosition(1, 0, 0),
        loopCount: 4,
      });

      scheduler.registerTrack(track3.id, track3.getRegions());
      scheduler.registerTrack(track4.id, track4.getRegions());

      await transport.start();

      // Start timing simulation to trigger events
      cleanupTiming = simulateTransportTiming(eventBus, 9000, transport);

      await new Promise((resolve) => setTimeout(resolve, 8500)); // 4 bars
      await transport.stop();

      // Verify both patterns played
      const track3Events = timingEvents.filter((e) => e.trackId === 'poly-3');
      const track4Events = timingEvents.filter((e) => e.trackId === 'poly-4');

      expect(track3Events.length).toBeGreaterThan(0);
      expect(track4Events.length).toBeGreaterThan(0);

      // They should align at the start of each bar
      for (let bar = 0; bar < 4; bar++) {
        const bar3Start = track3Events.find(
          (e) => e.position.bar === bar && e.position.beat === 0,
        );
        const bar4Start = track4Events.find(
          (e) => e.position.bar === bar && e.position.beat === 0,
        );

        if (bar3Start && bar4Start) {
          const alignment = Math.abs(
            bar3Start.actualTime - bar4Start.actualTime,
          );
          expect(alignment).toBeLessThan(0.002); // 2ms tolerance for polyrhythms
        }
      }
    });

    it(
      'should synchronize fast 16th note patterns',
      { timeout: 10000 },
      async () => {
        // Create high-resolution timing test
        const hihatTrack = new Track({
          id: 'hihats',
          name: 'Hi-Hats',
          instrumentType: 'drum',
        });
        const bassTrack = new Track({
          id: 'bass-16th',
          name: 'Bass 16ths',
          instrumentType: 'bass',
        });

        // Continuous 16th note patterns
        const hihatPattern: DrumPattern = {
          type: 'drum',
          events: [],
        };

        const bassPattern: BassPattern = {
          type: 'bass',
          events: [],
        };

        // Fill with 16th notes
        for (let sixteenth = 0; sixteenth < 16; sixteenth++) {
          const position = toMusicalPosition(
            0,
            Math.floor(sixteenth / 4),
            sixteenth % 4,
          );

          hihatPattern.events.push({
            position,
            drum: 'hihat',
            velocity: sixteenth % 4 === 0 ? 0.7 : 0.4, // Accent on beats
          });

          // Bass plays on off-beats
          if (sixteenth % 2 === 1) {
            bassPattern.events.push({
              position,
              note: sixteenth < 8 ? 'C2' : 'G2',
              duration: 'sixteenth',
              velocity: 0.5,
            });
          }
        }

        hihatTrack.createRegionFromPattern(hihatPattern, {
          name: '16th Hi-Hats',
          startPosition: toMusicalPosition(0, 0, 0),
          duration: toMusicalPosition(1, 0, 0),
          loopCount: 2,
        });

        bassTrack.createRegionFromPattern(bassPattern, {
          name: '16th Bass',
          startPosition: toMusicalPosition(0, 0, 0),
          duration: toMusicalPosition(1, 0, 0),
          loopCount: 2,
        });

        scheduler.registerTrack(hihatTrack.id, hihatTrack.getRegions());
        scheduler.registerTrack(bassTrack.id, bassTrack.getRegions());

        // Use high-precision timing
        const startMark = performance.now();
        await transport.start();

        // Start timing simulation to trigger events
        cleanupTiming = simulateTransportTiming(eventBus, 4500, transport);

        // Wait for 2 bars
        await new Promise((resolve) => setTimeout(resolve, 4100));

        await transport.stop();
        const endMark = performance.now();

        // Analyze 16th note timing
        const hihatEvents = timingEvents.filter((e) => e.trackId === 'hihats');
        const expectedSixteenth = 60 / 120 / 4; // 0.125s at 120 BPM

        // Check timing consistency
        const intervals: number[] = [];
        for (let i = 1; i < hihatEvents.length; i++) {
          intervals.push(
            hihatEvents[i].actualTime - hihatEvents[i - 1].actualTime,
          );
        }

        const avgInterval =
          intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const intervalErrors = intervals.map((i) =>
          Math.abs(i - expectedSixteenth),
        );
        const maxError = Math.max(...intervalErrors);

        // Very tight timing requirements for 16th notes
        expect(avgInterval).toBeCloseTo(expectedSixteenth, 3); // Within 1ms
        expect(maxError).toBeLessThan(0.003); // Max 3ms deviation

        logger.info('16th note sync test', {
          eventCount: hihatEvents.length,
          avgInterval: avgInterval * 1000,
          expectedInterval: expectedSixteenth * 1000,
          maxError: maxError * 1000,
          totalDuration: endMark - startMark,
        });
      },
    );
  });

  describe('Track Mixing and Routing', () => {
    it('should maintain sync through mixing engine', async () => {
      // Create tracks with different routing
      const tracks = [
        new Track({
          id: 'drum-bus',
          name: 'Drums',
          type: 'drum',
          outputBus: 'drums',
        }),
        new Track({
          id: 'bass-main',
          name: 'Bass',
          type: 'bass',
          outputBus: 'main',
        }),
        new Track({
          id: 'keys-fx',
          name: 'Keys',
          type: 'chord',
          outputBus: 'effects',
        }),
      ];

      // Simple test pattern for each
      tracks[0].createRegionFromPattern(
        {
          type: 'drum',
          events: [
            {
              position: toMusicalPosition(0, 0, 0),
              drum: 'kick',
              velocity: 0.8,
            },
            {
              position: toMusicalPosition(0, 2, 0),
              drum: 'snare',
              velocity: 0.7,
            },
          ],
        } as DrumPattern,
        {
          name: 'Drum Pattern',
          startPosition: toMusicalPosition(0, 0, 0),
          duration: toMusicalPosition(1, 0, 0),
        },
      );

      tracks[1].createRegionFromPattern(
        {
          type: 'bass',
          events: [
            {
              position: toMusicalPosition(0, 0, 0),
              note: 'C2',
              duration: 'half',
              velocity: 0.7,
            },
          ],
        } as BassPattern,
        {
          name: 'Bass Pattern',
          startPosition: toMusicalPosition(0, 0, 0),
          duration: toMusicalPosition(1, 0, 0),
        },
      );

      tracks[2].createRegionFromPattern(
        {
          type: 'chord',
          events: [
            {
              position: toMusicalPosition(0, 0, 0),
              notes: ['E3', 'G3', 'B3'],
              duration: 'whole',
              velocity: 0.5,
            },
          ],
        } as ChordPattern,
        {
          name: 'Chord Pattern',
          startPosition: toMusicalPosition(0, 0, 0),
          duration: toMusicalPosition(1, 0, 0),
        },
      );

      // Register all tracks
      tracks.forEach((track) => {
        scheduler.registerTrack(track.id, track.getRegions());
        mixingEngine.createTrackChannel(track);
      });

      // Setup mixing buses
      mixingEngine.createSubBus('drums', 'Drum Bus');
      mixingEngine.createSubBus('effects', 'Effects Bus');

      await transport.start();
      await new Promise((resolve) => setTimeout(resolve, 500));
      await transport.stop();

      // All tracks should trigger at beat 1 despite different routing
      const beat1Events = timingEvents.filter(
        (e) =>
          e.position.bar === 0 &&
          e.position.beat === 0 &&
          e.position.sixteenth === 0,
      );

      expect(beat1Events.length).toBe(3);

      // Verify routing didn't affect timing
      const times = beat1Events.map((e) => e.actualTime);
      const spread = Math.max(...times) - Math.min(...times);
      expect(spread).toBeLessThan(0.001); // Still < 1ms with routing
    });
  });

  describe('Tempo Changes and Sync', () => {
    it('should maintain sync during tempo changes', async () => {
      const track1 = new Track({
        id: 'tempo-1',
        name: 'Track 1',
        type: 'metronome',
      });
      const track2 = new Track({
        id: 'tempo-2',
        name: 'Track 2',
        type: 'metronome',
      });

      // Both play on every beat
      const pattern: MetronomePattern = {
        type: 'metronome',
        events: [
          { position: toMusicalPosition(0, 0, 0), type: 'click' },
          { position: toMusicalPosition(0, 1, 0), type: 'click' },
          { position: toMusicalPosition(0, 2, 0), type: 'click' },
          { position: toMusicalPosition(0, 3, 0), type: 'click' },
        ],
      };

      track1.createRegionFromPattern(pattern, {
        name: 'Clicks 1',
        startPosition: toMusicalPosition(0, 0, 0),
        duration: toMusicalPosition(4, 0, 0), // 4 bars
      });

      track2.createRegionFromPattern(pattern, {
        name: 'Clicks 2',
        startPosition: toMusicalPosition(0, 0, 0),
        duration: toMusicalPosition(4, 0, 0),
      });

      scheduler.registerTrack(track1.id, track1.getRegions());
      scheduler.registerTrack(track2.id, track2.getRegions());

      // Start at 120 BPM
      transport.setTempo(120);
      await transport.start();

      // Play 1 bar
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Change tempo to 140 BPM
      timingEvents = []; // Clear to analyze post-tempo change
      transport.setTempo(140);

      // Play another bar at new tempo
      await new Promise((resolve) => setTimeout(resolve, 1800)); // Faster at 140 BPM

      await transport.stop();

      // Analyze sync at new tempo
      const postTempoEvents = timingEvents;
      const beatPairs: Array<[TimingEvent, TimingEvent]> = [];

      // Find paired events (both tracks on same beat)
      for (const event1 of postTempoEvents) {
        if (event1.trackId === 'tempo-1') {
          const event2 = postTempoEvents.find(
            (e) =>
              e.trackId === 'tempo-2' &&
              e.position.bar === event1.position.bar &&
              e.position.beat === event1.position.beat,
          );
          if (event2) {
            beatPairs.push([event1, event2]);
          }
        }
      }

      // All paired beats should be synchronized
      beatPairs.forEach(([e1, e2]) => {
        const syncError = Math.abs(e1.actualTime - e2.actualTime);
        expect(syncError).toBeLessThan(0.001); // < 1ms even after tempo change
      });

      logger.info('Tempo change sync', {
        pairsAnalyzed: beatPairs.length,
        avgSync:
          (beatPairs.reduce(
            (sum, [e1, e2]) => sum + Math.abs(e1.actualTime - e2.actualTime),
            0,
          ) /
            beatPairs.length) *
          1000,
      });
    });
  });

  describe('Loop Region Synchronization', () => {
    it(
      'should keep tracks synchronized across loop boundaries',
      { timeout: 10000 },
      async () => {
        const shortTrack = new Track({
          id: 'loop-short',
          name: '1-Bar Loop',
          type: 'drum',
        });
        const longTrack = new Track({
          id: 'loop-long',
          name: '2-Bar Loop',
          type: 'bass',
        });

        // 1-bar drum loop
        shortTrack.createRegionFromPattern(
          {
            type: 'drum',
            events: [
              {
                position: toMusicalPosition(0, 0, 0),
                drum: 'kick',
                velocity: 0.8,
              },
              {
                position: toMusicalPosition(0, 2, 0),
                drum: 'snare',
                velocity: 0.7,
              },
            ],
          } as DrumPattern,
          {
            name: '1-Bar Drum',
            startPosition: toMusicalPosition(0, 0, 0),
            duration: toMusicalPosition(1, 0, 0),
            loopCount: 4, // Will play 4 times
          },
        );

        // 2-bar bass loop
        longTrack.createRegionFromPattern(
          {
            type: 'bass',
            events: [
              {
                position: toMusicalPosition(0, 0, 0),
                note: 'C2',
                duration: 'quarter',
                velocity: 0.7,
              },
              {
                position: toMusicalPosition(1, 0, 0),
                note: 'G2',
                duration: 'quarter',
                velocity: 0.7,
              },
            ],
          } as BassPattern,
          {
            name: '2-Bar Bass',
            startPosition: toMusicalPosition(0, 0, 0),
            duration: toMusicalPosition(2, 0, 0),
            loopCount: 2, // Will play 2 times (4 bars total)
          },
        );

        scheduler.registerTrack(shortTrack.id, shortTrack.getRegions());
        scheduler.registerTrack(longTrack.id, longTrack.getRegions());

        await transport.start();

        // Start timing simulation to trigger events
        cleanupTiming = simulateTransportTiming(eventBus, 9000, transport);

        await new Promise((resolve) => setTimeout(resolve, 8500)); // 4+ bars
        await transport.stop();

        // Check synchronization at loop boundaries
        // The drum kick should align with bass notes
        const drumKicks = timingEvents.filter(
          (e) => e.trackId === 'loop-short' && e.type === 'drum',
        );
        const bassNotes = timingEvents.filter(
          (e) => e.trackId === 'loop-long' && e.type === 'bass',
        );

        // At bars 0 and 2, both should play together
        const alignmentPoints = [
          { bar: 0, beat: 0 },
          { bar: 2, beat: 0 },
        ];

        alignmentPoints.forEach((point) => {
          const drumEvent = drumKicks.find(
            (e) =>
              e.position.bar === point.bar && e.position.beat === point.beat,
          );
          const bassEvent = bassNotes.find(
            (e) =>
              e.position.bar === point.bar && e.position.beat === point.beat,
          );

          if (drumEvent && bassEvent) {
            const alignment = Math.abs(
              drumEvent.actualTime - bassEvent.actualTime,
            );
            expect(alignment).toBeLessThan(0.001); // < 1ms at loop boundaries
          }
        });
      },
    );
  });
});
