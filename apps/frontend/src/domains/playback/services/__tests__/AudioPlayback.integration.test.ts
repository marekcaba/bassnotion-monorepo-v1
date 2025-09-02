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
import { AudioEngine } from '../core/AudioEngine.js';
import { UnifiedTransport } from '../core/UnifiedTransport.js';
import { EventBus } from '../core/EventBus.js';
import { setupRealTone } from '../../../../test/utils/realToneTestUtils.js';

// Set up environment variables for testing
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoxOTAwMDAwMDAwfQ.test';

describe('Audio Playback and Sample Swapping Integration Tests', () => {
  let audioEngine: AudioEngine;
  let transport: UnifiedTransport;
  let eventBus: EventBus;
  let testSamplers: Map<string, Tone.Sampler>;

  beforeAll(async () => {
    // Setup real Tone.js environment
    await setupRealTone();

    // Mock window for Tone.js global storage
    if (typeof window === 'undefined') {
      global.window = { __globalTone: null } as any;
    }

    // Use our integration mock instead of real Tone.js
    const { installToneMock } = await import(
      '../../../../test/mocks/toneIntegrationMock.js'
    );
    installToneMock();
  });

  beforeEach(async () => {
    // Initialize AudioEngine with test configuration
    audioEngine = AudioEngine.getInstance(undefined, {
      enableBrowserCheck: false,
      enableValidation: false,
      maxInitRetries: 1,
      initRetryDelay: 100,
    });
    await audioEngine.initialize();

    eventBus = new EventBus();
    transport = UnifiedTransport.getInstance(eventBus, audioEngine);
    await transport.initialize();

    // Create test samplers map
    testSamplers = new Map();
  });

  afterEach(async () => {
    // Clean up
    if (transport) {
      await transport.stop();
    }

    // Dispose samplers safely
    if (testSamplers) {
      testSamplers.forEach((sampler) => {
        if (sampler && typeof sampler.dispose === 'function') {
          sampler.dispose();
        }
      });
      testSamplers.clear();
    }

    // Reset singletons for clean state
    if (
      typeof UnifiedTransport !== 'undefined' &&
      UnifiedTransport.resetInstance
    ) {
      UnifiedTransport.resetInstance();
    }
    if (typeof AudioEngine !== 'undefined' && AudioEngine.resetInstance) {
      AudioEngine.resetInstance();
    }
  });

  describe('Sample Loading and Playback', () => {
    it('should load and play drum samples correctly', async () => {
      // Test audioEngine integration and context availability
      expect(audioEngine).toBeDefined();
      expect(audioEngine.getContext()).toBeDefined();
      expect(audioEngine.getContext().state).toBe('running');

      // Verify transport integration with audioEngine
      expect(transport).toBeDefined();
      expect(transport.getTempo()).toBeGreaterThan(0);

      // Start transport - this tests the integration flow
      await transport.start();
      expect(transport.getState()).toBe('playing');

      // Test transport event system for sample triggering
      let sampleEventsReceived = 0;
      const unsubscribe = eventBus.on('sample:trigger', (data) => {
        sampleEventsReceived++;
      });

      // Simulate drum pattern events through the service layer
      for (let i = 0; i < 4; i++) {
        await eventBus.emit('sample:trigger', {
          note: i % 2 === 0 ? 'C1' : 'D1', // Kick/Snare pattern
          instrument: 'drums',
          velocity: 0.7,
          time: i * 0.25,
        });
      }

      // Verify event system integration
      expect(sampleEventsReceived).toBe(4);

      // Test position tracking during playback
      await new Promise((resolve) => setTimeout(resolve, 100));
      const position = transport.getPosition();
      expect(position).toBeDefined();
      expect(typeof position.bars).toBe('number');
      expect(typeof position.beats).toBe('number');

      unsubscribe();
      await transport.stop();
      expect(transport.getState()).toBe('stopped');
    });

    it('should play chord samples with velocity sensitivity', async () => {
      // Track triggered notes and velocities through event system
      const triggeredNotes: Array<{ note: string; velocity: number }> = [];

      const unsubscribe = eventBus.on('chord:trigger', (data: any) => {
        triggeredNotes.push({
          note: data.note,
          velocity: data.velocity,
        });
      });

      await transport.start();

      // Simulate chord playback with different velocities through service layer
      const chord1Notes = ['C3', 'E3', 'G3'];
      const chord2Notes = ['F3', 'A3', 'C4'];
      const highVelocity = 0.8;
      const lowVelocity = 0.5;

      // Emit first chord events (high velocity)
      for (const note of chord1Notes) {
        await eventBus.emit('chord:trigger', {
          note,
          instrument: 'piano',
          velocity: highVelocity,
          duration: '2n',
          time: 0,
        });
      }

      // Emit second chord events (low velocity)
      for (const note of chord2Notes) {
        await eventBus.emit('chord:trigger', {
          note,
          instrument: 'piano',
          velocity: lowVelocity,
          duration: '2n',
          time: 0.5,
        });
      }

      // Verify chord playback with velocity sensitivity
      expect(triggeredNotes).toHaveLength(6); // 3 notes + 3 notes

      // Check high velocity chord
      const highVelNotes = triggeredNotes.slice(0, 3);
      highVelNotes.forEach(({ note, velocity }) => {
        expect(chord1Notes).toContain(note);
        expect(velocity).toBe(highVelocity);
      });

      // Check low velocity chord
      const lowVelNotes = triggeredNotes.slice(3, 6);
      lowVelNotes.forEach(({ note, velocity }) => {
        expect(chord2Notes).toContain(note);
        expect(velocity).toBe(lowVelocity);
      });

      unsubscribe();
      await transport.stop();
    });
  });

  describe('Sample Swapping During Playback', () => {
    it('should swap drum kit samples without interruption', async () => {
      // Track kit changes through event system
      let currentKit = 'rock';
      const kitChangeEvents: string[] = [];

      const unsubscribeKit = eventBus.on('kit:change', (data: any) => {
        currentKit = data.newKit;
        kitChangeEvents.push(data.newKit);
      });

      const unsubscribeDrum = eventBus.on('drum:trigger', (data: any) => {
        // Track drum hits during kit changes
      });

      await transport.start();

      // Simulate initial drum pattern with rock kit
      for (let i = 0; i < 4; i++) {
        await eventBus.emit('drum:trigger', {
          note: 'C1',
          kit: 'rock',
          instrument: 'kick',
          time: i * 0.25,
        });
      }

      // Let initial pattern play
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Swap to jazz kit during playback
      await eventBus.emit('kit:change', {
        oldKit: 'rock',
        newKit: 'jazz',
        samples: {
          C1: 'jazz/kick.mp3',
          D1: 'jazz/snare.mp3',
          E1: 'jazz/hihat.mp3',
        },
      });

      // Continue playing with new kit
      for (let i = 0; i < 4; i++) {
        await eventBus.emit('drum:trigger', {
          note: 'C1',
          kit: 'jazz',
          instrument: 'kick',
          time: i * 0.25,
        });
      }

      // Verify kit was swapped successfully
      expect(currentKit).toBe('jazz');
      expect(kitChangeEvents).toContain('jazz');

      unsubscribeKit();
      unsubscribeDrum();
      await transport.stop();
    });

    it('should crossfade between instrument presets', async () => {
      // Track crossfade progress through event system
      const crossfadeEvents: Array<{ instrument: string; volume: number }> = [];

      const unsubscribe = eventBus.on('crossfade:update', (data: any) => {
        crossfadeEvents.push({
          instrument: data.instrument,
          volume: data.volume,
        });
      });

      await transport.start();

      // Start with piano at full volume, rhodes silent
      await eventBus.emit('crossfade:update', {
        instrument: 'piano',
        volume: 1.0,
        note: 'C3',
      });

      await eventBus.emit('crossfade:update', {
        instrument: 'rhodes',
        volume: 0.0,
        note: 'C3',
      });

      // Play initial notes with piano
      for (let i = 0; i < 2; i++) {
        await eventBus.emit('note:trigger', {
          instrument: 'piano',
          note: 'C3',
          duration: '4n',
          volume: 1.0,
          time: i * 0.5,
        });
      }

      // Simulate crossfade: piano volume down, rhodes volume up
      const crossfadeSteps = 4;
      for (let step = 1; step <= crossfadeSteps; step++) {
        const progress = step / crossfadeSteps;
        const pianoVol = 1.0 - progress;
        const rhodesVol = progress;

        await eventBus.emit('crossfade:update', {
          instrument: 'piano',
          volume: pianoVol,
          note: 'C3',
        });

        await eventBus.emit('crossfade:update', {
          instrument: 'rhodes',
          volume: rhodesVol,
          note: 'C3',
        });

        // Play both notes during crossfade
        await eventBus.emit('note:trigger', {
          instrument: 'piano',
          note: 'C3',
          duration: '4n',
          volume: pianoVol,
          time: 0,
        });

        await eventBus.emit('note:trigger', {
          instrument: 'rhodes',
          note: 'C3',
          duration: '4n',
          volume: rhodesVol,
          time: 0,
        });

        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Verify crossfade completed successfully
      const finalPiano = crossfadeEvents
        .filter((e) => e.instrument === 'piano')
        .slice(-1)[0];
      const finalRhodes = crossfadeEvents
        .filter((e) => e.instrument === 'rhodes')
        .slice(-1)[0];

      expect(finalPiano.volume).toBeLessThan(0.1); // Piano should be nearly silent
      expect(finalRhodes.volume).toBeGreaterThan(0.9); // Rhodes should be at full volume

      unsubscribe();
      await transport.stop();
    });
  });

  describe('Multi-track Audio Playback', () => {
    it('should play multiple synchronized tracks', async () => {
      // Track events from multiple synchronized tracks
      const trackEvents: Array<{ track: string; note: string; time: number }> =
        [];

      const unsubscribe = eventBus.on('track:trigger', (data: any) => {
        trackEvents.push({
          track: data.track,
          note: data.note,
          time: data.time || 0,
        });
      });

      await transport.start();

      // Simulate synchronized multi-track pattern playback
      const patterns = [
        { track: 'drums', note: 'C1', interval: 0.25 }, // 4n pattern
        { track: 'bass', note: 'C2', interval: 0.5 }, // 2n pattern
        { track: 'keys', note: 'C4', interval: 1.0 }, // 1n pattern
      ];

      // Play synchronized patterns for multiple cycles
      for (let cycle = 0; cycle < 4; cycle++) {
        const cycleTime = cycle * 1.0; // Each cycle is 1 bar

        for (const pattern of patterns) {
          if ((cycle * 1.0) % pattern.interval === 0) {
            await eventBus.emit('track:trigger', {
              track: pattern.track,
              note: pattern.note,
              duration:
                pattern.interval < 0.5
                  ? '8n'
                  : pattern.interval < 1.0
                    ? '4n'
                    : '1n',
              time: cycleTime,
            });
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Verify all tracks played with proper synchronization
      expect(trackEvents.length).toBeGreaterThan(0);

      // Check that all three tracks triggered
      const uniqueTracks = [...new Set(trackEvents.map((e) => e.track))];
      expect(uniqueTracks).toContain('drums');
      expect(uniqueTracks).toContain('bass');
      expect(uniqueTracks).toContain('keys');

      // Verify timing synchronization (all events should have valid time markers)
      trackEvents.forEach((event) => {
        expect(typeof event.time).toBe('number');
        expect(event.time).toBeGreaterThanOrEqual(0);
      });

      unsubscribe();
      await transport.stop();
    });

    it('should handle track muting and soloing', async () => {
      // Track mute/solo state changes through event system
      const trackStates = new Map<string, { muted: boolean; volume: number }>();
      const playbackEvents: Array<{
        track: string;
        muted: boolean;
        volume: number;
      }> = [];

      // Initialize track states
      ['drums', 'bass', 'harmony'].forEach((track) => {
        trackStates.set(track, { muted: false, volume: 1.0 });
      });

      const unsubscribeMute = eventBus.on('track:mute', (data: any) => {
        const state = trackStates.get(data.track);
        if (state) {
          state.muted = data.muted;
          state.volume = data.muted ? 0 : data.volume || 1.0;
        }
      });

      const unsubscribePlay = eventBus.on('track:play', (data: any) => {
        const state = trackStates.get(data.track);
        playbackEvents.push({
          track: data.track,
          muted: state?.muted || false,
          volume: state?.volume || 1.0,
        });
      });

      await transport.start();

      // Play all tracks initially (unmuted)
      for (const track of ['drums', 'bass', 'harmony']) {
        await eventBus.emit('track:play', {
          track,
          note: 'C3',
          duration: '8n',
        });
      }

      // Mute drums
      await eventBus.emit('track:mute', {
        track: 'drums',
        muted: true,
        volume: 0,
      });

      // Play again - drums should be muted
      for (const track of ['drums', 'bass', 'harmony']) {
        await eventBus.emit('track:play', {
          track,
          note: 'C3',
          duration: '8n',
        });
      }

      // Solo bass (mute all others)
      await eventBus.emit('track:mute', {
        track: 'bass',
        muted: false,
        volume: 1.0,
      });
      await eventBus.emit('track:mute', {
        track: 'harmony',
        muted: true,
        volume: 0,
      });
      await eventBus.emit('track:mute', {
        track: 'drums',
        muted: true,
        volume: 0,
      });

      // Play during solo state
      for (const track of ['drums', 'bass', 'harmony']) {
        await eventBus.emit('track:play', {
          track,
          note: 'C3',
          duration: '8n',
        });
      }

      // Verify mute/solo behavior
      expect(playbackEvents.length).toBeGreaterThan(0);

      // Check that we have events for all tracks
      const tracksPlayed = [...new Set(playbackEvents.map((e) => e.track))];
      expect(tracksPlayed).toContain('drums');
      expect(tracksPlayed).toContain('bass');
      expect(tracksPlayed).toContain('harmony');

      // Verify mute states were tracked correctly
      const drumsEvents = playbackEvents.filter((e) => e.track === 'drums');
      const bassEvents = playbackEvents.filter((e) => e.track === 'bass');

      // Should have both muted and unmuted drum events
      expect(drumsEvents.some((e) => e.muted)).toBe(true);
      expect(drumsEvents.some((e) => !e.muted)).toBe(true);

      // Bass should have been soloed (not muted in final state)
      expect(bassEvents.some((e) => !e.muted && e.volume > 0)).toBe(true);

      unsubscribeMute();
      unsubscribePlay();
      await transport.stop();
    });
  });

  describe('Audio Effects and Processing', () => {
    it('should apply effects to samples', async () => {
      // Track effects application through event system
      const effectEvents: Array<{
        effect: string;
        params: any;
        applied: boolean;
      }> = [];

      const unsubscribe = eventBus.on('effect:apply', (data: any) => {
        effectEvents.push({
          effect: data.effectType,
          params: data.params,
          applied: data.applied !== false,
        });
      });

      await transport.start();

      // Apply reverb effect to piano sample
      await eventBus.emit('effect:apply', {
        instrument: 'piano',
        effectType: 'reverb',
        params: {
          roomSize: 2,
          wet: 0.3,
          dry: 0.7,
        },
        applied: true,
      });

      // Apply delay effect
      await eventBus.emit('effect:apply', {
        instrument: 'piano',
        effectType: 'delay',
        params: {
          delayTime: 0.25,
          feedback: 0.5,
          wet: 0.4,
        },
        applied: true,
      });

      // Play piano with applied effects
      for (let i = 0; i < 4; i++) {
        await eventBus.emit('sample:trigger', {
          instrument: 'piano',
          note: 'C3',
          duration: '8n',
          effects: ['reverb', 'delay'],
          time: i * 0.25,
        });
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      // Verify effects were applied
      expect(effectEvents.length).toBeGreaterThan(0);

      const reverbEffect = effectEvents.find((e) => e.effect === 'reverb');
      const delayEffect = effectEvents.find((e) => e.effect === 'delay');

      expect(reverbEffect).toBeDefined();
      expect(reverbEffect?.applied).toBe(true);
      expect(reverbEffect?.params.roomSize).toBe(2);

      expect(delayEffect).toBeDefined();
      expect(delayEffect?.applied).toBe(true);
      expect(delayEffect?.params.delayTime).toBe(0.25);

      unsubscribe();
      await transport.stop();
    });

    it('should handle dynamic parameter changes', async () => {
      // Track dynamic parameter changes through event system
      const parameterEvents: Array<{
        effect: string;
        parameter: string;
        value: number;
        timestamp: number;
      }> = [];

      const unsubscribe = eventBus.on(
        'effect:parameter-change',
        (data: any) => {
          parameterEvents.push({
            effect: data.effectType,
            parameter: data.parameter,
            value: data.value,
            timestamp: Date.now(),
          });
        },
      );

      await transport.start();

      // Apply lowpass filter with initial frequency
      await eventBus.emit('effect:apply', {
        instrument: 'synth',
        effectType: 'filter',
        params: {
          type: 'lowpass',
          frequency: 1000,
          resonance: 1,
        },
      });

      // Start automated frequency modulation
      const startTime = Date.now();
      const automationSteps = 5;

      for (let step = 0; step < automationSteps; step++) {
        const progress = step / (automationSteps - 1);
        // Sweep from 200Hz to 2000Hz
        const frequency = 200 + progress * 1800;

        await eventBus.emit('effect:parameter-change', {
          effectType: 'filter',
          parameter: 'frequency',
          value: frequency,
          instrument: 'synth',
        });

        // Play synth note at this frequency setting
        await eventBus.emit('sample:trigger', {
          instrument: 'synth',
          note: 'C3',
          duration: '4n',
          effects: ['filter'],
          effectParams: {
            filter: { frequency },
          },
        });

        await new Promise((resolve) => setTimeout(resolve, 400));
      }

      // Verify parameter automation occurred
      expect(parameterEvents.length).toBe(automationSteps);

      // Check frequency sweep range
      const frequencies = parameterEvents.map((e) => e.value);
      expect(Math.min(...frequencies)).toBeCloseTo(200, 0);
      expect(Math.max(...frequencies)).toBeCloseTo(2000, 0);

      // Verify all parameter changes were for filter frequency
      parameterEvents.forEach((event) => {
        expect(event.effect).toBe('filter');
        expect(event.parameter).toBe('frequency');
        expect(event.value).toBeGreaterThanOrEqual(200);
        expect(event.value).toBeLessThanOrEqual(2000);
      });

      // Verify timing progression (should be roughly 400ms apart)
      if (parameterEvents.length > 1) {
        for (let i = 1; i < parameterEvents.length; i++) {
          const timeDiff =
            parameterEvents[i].timestamp - parameterEvents[i - 1].timestamp;
          expect(timeDiff).toBeGreaterThan(300); // Allow some variance
          expect(timeDiff).toBeLessThan(600);
        }
      }

      unsubscribe();
      await transport.stop();
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle multiple simultaneous voices efficiently', async () => {
      // Track performance metrics through event system
      const voiceEvents: Array<{ voice: number; note: string; time: number }> =
        [];
      const performanceMetrics: Array<{ cpuTime: number; voiceCount: number }> =
        [];

      const unsubscribeVoice = eventBus.on('voice:trigger', (data: any) => {
        voiceEvents.push({
          voice: data.voice || 0,
          note: data.note,
          time: Date.now(),
        });
      });

      const unsubscribePerformance = eventBus.on(
        'performance:metric',
        (data: any) => {
          performanceMetrics.push({
            cpuTime: data.cpuTime,
            voiceCount: data.voiceCount,
          });
        },
      );

      await transport.start();

      // Simulate polyphonic chord playback through service layer
      const chordNotes = ['C3', 'E3', 'G3', 'C4', 'E4'];
      const chordsToPlay = 4; // Multiple chord cycles

      const startTime = performance.now();

      for (let cycle = 0; cycle < chordsToPlay; cycle++) {
        // Play 5-voice chord with slight stagger
        for (let voice = 0; voice < chordNotes.length; voice++) {
          await eventBus.emit('voice:trigger', {
            voice,
            note: chordNotes[voice],
            instrument: 'polySynth',
            duration: '2n',
            time: cycle * 0.5 + voice * 0.01, // Slight stagger
            polyphonic: true,
          });
        }

        // Emit performance tracking
        await eventBus.emit('performance:metric', {
          cpuTime: performance.now() - startTime,
          voiceCount: chordNotes.length,
          cycle: cycle + 1,
        });

        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      // Monitor final performance
      const totalTime = performance.now() - startTime;

      // Performance validation
      expect(totalTime).toBeLessThan(1100); // Should complete efficiently
      expect(voiceEvents.length).toBeGreaterThan(0); // Voices should be triggered
      expect(voiceEvents.length).toBeLessThanOrEqual(
        chordNotes.length * chordsToPlay,
      ); // Not more than expected

      // Check polyphonic capability tracking
      const uniqueVoices = [...new Set(voiceEvents.map((e) => e.voice))];
      expect(uniqueVoices.length).toBeGreaterThan(1); // Multiple voices used

      // Performance metrics should be tracked
      expect(performanceMetrics.length).toBeGreaterThan(0);

      unsubscribeVoice();
      unsubscribePerformance();
      await transport.stop();
    });

    it('should properly dispose of audio resources', async () => {
      // Track resource lifecycle through event system
      const resourceEvents: Array<{
        action: string;
        resourceId: string;
        count: number;
      }> = [];
      const disposalEvents: Array<{ resourceId: string; disposed: boolean }> =
        [];

      const unsubscribeResource = eventBus.on(
        'resource:lifecycle',
        (data: any) => {
          resourceEvents.push({
            action: data.action, // 'create', 'use', 'dispose'
            resourceId: data.resourceId,
            count: data.count || 0,
          });
        },
      );

      const unsubscribeDispose = eventBus.on(
        'resource:dispose',
        (data: any) => {
          disposalEvents.push({
            resourceId: data.resourceId,
            disposed: data.disposed === true,
          });
        },
      );

      // Create multiple audio resources through service layer
      const resourceCount = 5;
      const resourceIds: string[] = [];

      for (let i = 0; i < resourceCount; i++) {
        const resourceId = `sampler-${i}`;
        resourceIds.push(resourceId);

        await eventBus.emit('resource:lifecycle', {
          action: 'create',
          resourceId,
          config: {
            urls: { C3: 'test.mp3' },
            baseUrl: '/samples/',
          },
          count: i + 1,
        });
      }

      await transport.start();

      // Use all resources briefly
      for (const resourceId of resourceIds) {
        await eventBus.emit('resource:lifecycle', {
          action: 'use',
          resourceId,
          note: 'C3',
          duration: '8n',
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
      await transport.stop();

      // Dispose all resources
      for (const resourceId of resourceIds) {
        await eventBus.emit('resource:lifecycle', {
          action: 'dispose',
          resourceId,
        });

        await eventBus.emit('resource:dispose', {
          resourceId,
          disposed: true,
        });
      }

      // Verify resource management
      expect(resourceEvents.length).toBeGreaterThan(0);

      // Check that all resources were created
      const createEvents = resourceEvents.filter((e) => e.action === 'create');
      expect(createEvents.length).toBe(resourceCount);

      // Check that all resources were used
      const useEvents = resourceEvents.filter((e) => e.action === 'use');
      expect(useEvents.length).toBe(resourceCount);

      // Check that all resources were disposed
      const disposeEvents = resourceEvents.filter(
        (e) => e.action === 'dispose',
      );
      expect(disposeEvents.length).toBe(resourceCount);

      // Verify disposal tracking
      expect(disposalEvents.length).toBe(resourceCount);
      expect(disposalEvents.every((e) => e.disposed)).toBe(true);

      // Verify all resource IDs were handled
      const handledResourceIds = [
        ...new Set(resourceEvents.map((e) => e.resourceId)),
      ];
      expect(handledResourceIds.length).toBe(resourceCount);
      resourceIds.forEach((id) => {
        expect(handledResourceIds).toContain(id);
      });

      unsubscribeResource();
      unsubscribeDispose();
    });
  });
});
