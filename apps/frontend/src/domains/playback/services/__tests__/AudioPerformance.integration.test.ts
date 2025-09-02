/**
 * Audio Performance Integration Tests
 *
 * Stress tests the audio pipeline with complex patterns and multiple tracks
 * Measures CPU usage, memory consumption, and timing accuracy under load
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
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
import { TrackStateContainer } from '../core/TrackStateContainer.js';
import { setupRealTone } from '../../../../test/utils/realToneTestUtils.js';
import type {
  DrumPattern,
  BassPattern,
  ChordPattern,
  MetronomePattern,
  MusicalPosition,
  PatternEvent,
} from '../../types/pattern.js';
import { toMusicalPosition } from '../../types/pattern.js';
import { getLogger } from '@/utils/logger.js';

const logger = getLogger('AudioPerformance.integration.test');

interface PerformanceMetrics {
  startTime: number;
  endTime: number;
  eventCount: number;
  missedEvents: number;
  maxDrift: number;
  avgDrift: number;
  cpuUsage?: number;
  memoryUsed?: number;
  audioGlitches: number;
}

describe('Audio Performance Stress Tests', () => {
  let serviceRegistry: ServiceRegistry;
  let audioEngine: AudioEngine;
  let transport: UnifiedTransport;
  let scheduler: PatternScheduler;
  let eventBus: EventBus;
  let trackStateContainer: TrackStateContainer;

  // Performance tracking
  let metrics: PerformanceMetrics;
  let scheduledEvents: Map<string, number>;
  let actualEvents: Map<string, number>;
  let timingDrifts: number[] = [];

  beforeAll(async () => {
    await setupRealTone();
  });

  beforeEach(async () => {
    // Initialize metrics
    metrics = {
      startTime: 0,
      endTime: 0,
      eventCount: 0,
      missedEvents: 0,
      maxDrift: 0,
      avgDrift: 0,
      audioGlitches: 0,
    };

    scheduledEvents = new Map();
    actualEvents = new Map();
    timingDrifts = [];

    // Initialize services
    serviceRegistry = getServiceRegistry();
    audioEngine = AudioEngine.getInstance();
    await audioEngine.initialize();

    eventBus = new EventBus();
    transport = UnifiedTransport.getInstance(eventBus, audioEngine);
    scheduler = new PatternScheduler();
    trackStateContainer = new TrackStateContainer();

    // Register services
    serviceRegistry.register('audioEngine', audioEngine);
    serviceRegistry.register('eventBus', eventBus);
    serviceRegistry.register('unifiedTransport', transport);
    serviceRegistry.register('patternScheduler', scheduler);
    serviceRegistry.register('trackStateContainer', trackStateContainer);

    await serviceRegistry.initialize();

    // Track all events for performance analysis
    const trackPerformance = (type: string, data: any) => {
      const eventKey = `${type}-${data.trackId}-${data.position?.bar || 0}-${data.position?.beat || 0}`;
      actualEvents.set(eventKey, (actualEvents.get(eventKey) || 0) + 1);

      if (data.audioTime && data.timestamp) {
        const drift = Math.abs(data.timestamp - data.audioTime);
        timingDrifts.push(drift);
      }

      metrics.eventCount++;
    };

    eventBus.on('drum-trigger', (data) => trackPerformance('drum', data));
    eventBus.on('bass-trigger', (data) => trackPerformance('bass', data));
    eventBus.on('chord-trigger', (data) => trackPerformance('chord', data));
    eventBus.on('metronome-trigger', (data) =>
      trackPerformance('metronome', data),
    );

    // Monitor audio glitches
    eventBus.on('audio-glitch', () => metrics.audioGlitches++);
  });

  afterEach(async () => {
    await transport.stop();
    scheduler.clearAll();
    await serviceRegistry.dispose();
    Tone.Transport.cancel();

    // Calculate final metrics
    if (timingDrifts.length > 0) {
      metrics.maxDrift = Math.max(...timingDrifts);
      metrics.avgDrift =
        timingDrifts.reduce((a, b) => a + b, 0) / timingDrifts.length;
    }

    // Log performance summary
    logger.info('Performance test completed', {
      duration: metrics.endTime - metrics.startTime,
      eventCount: metrics.eventCount,
      missedEvents: metrics.missedEvents,
      maxDrift: metrics.maxDrift * 1000, // Convert to ms
      avgDrift: metrics.avgDrift * 1000,
      audioGlitches: metrics.audioGlitches,
    });
  });

  describe('High Track Count', () => {
    it('should handle 16 simultaneous tracks', async () => {
      const tracks: Track[] = [];

      // Create diverse track types
      const trackConfigs = [
        // Rhythm section
        { id: 'kick', type: 'drum' as const, pattern: 'kick' },
        { id: 'snare', type: 'drum' as const, pattern: 'snare' },
        { id: 'hihat', type: 'drum' as const, pattern: 'hihat' },
        { id: 'crash', type: 'drum' as const, pattern: 'crash' },

        // Bass lines
        { id: 'bass1', type: 'bass' as const, pattern: 'root' },
        { id: 'bass2', type: 'bass' as const, pattern: 'walking' },
        { id: 'bass3', type: 'bass' as const, pattern: 'synth' },
        { id: 'bass4', type: 'bass' as const, pattern: 'sub' },

        // Harmony
        { id: 'chord1', type: 'chord' as const, pattern: 'triad' },
        { id: 'chord2', type: 'chord' as const, pattern: 'seventh' },
        { id: 'chord3', type: 'chord' as const, pattern: 'extended' },
        { id: 'chord4', type: 'chord' as const, pattern: 'voicing' },

        // Utility
        { id: 'metro1', type: 'metronome' as const, pattern: 'quarter' },
        { id: 'metro2', type: 'metronome' as const, pattern: 'eighth' },
        { id: 'metro3', type: 'metronome' as const, pattern: 'sixteenth' },
        { id: 'click', type: 'metronome' as const, pattern: 'accent' },
      ];

      // Create tracks with patterns
      trackConfigs.forEach((config) => {
        const track = new Track({
          id: config.id,
          name: `${config.type} - ${config.pattern}`,
          type: config.type,
        });

        // Generate appropriate pattern
        let pattern: any;

        switch (config.type) {
          case 'drum':
            pattern = generateDrumPattern(config.pattern);
            break;
          case 'bass':
            pattern = generateBassPattern(config.pattern);
            break;
          case 'chord':
            pattern = generateChordPattern(config.pattern);
            break;
          case 'metronome':
            pattern = generateMetronomePattern(config.pattern);
            break;
        }

        track.createRegionFromPattern(pattern, {
          name: 'Performance Test Pattern',
          startPosition: toMusicalPosition(0, 0, 0),
          duration: toMusicalPosition(4, 0, 0), // 4 bars
          loopCount: 1, // Play twice (8 bars total)
        });

        tracks.push(track);
        scheduler.registerTrack(track.id, track.getRegions());
      });

      // Start performance monitoring
      metrics.startTime = performance.now();
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Run the stress test
      await transport.start();

      // Wait for 8 bars at 120 BPM (16 seconds)
      await new Promise((resolve) => setTimeout(resolve, 16500));

      await transport.stop();

      // End performance monitoring
      metrics.endTime = performance.now();
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      metrics.memoryUsed = finalMemory - initialMemory;

      // Verify all tracks played
      expect(metrics.eventCount).toBeGreaterThan(100); // Should have many events

      // Check timing accuracy under load
      expect(metrics.avgDrift).toBeLessThan(0.005); // 5ms average drift
      expect(metrics.maxDrift).toBeLessThan(0.02); // 20ms max drift

      // No audio glitches
      expect(metrics.audioGlitches).toBe(0);

      logger.info('16-track stress test', {
        tracksCreated: tracks.length,
        totalEvents: metrics.eventCount,
        memoryUsed: (metrics.memoryUsed / 1024 / 1024).toFixed(2) + ' MB',
      });
    });

    it('should handle rapid pattern changes across multiple tracks', async () => {
      // Create 8 dynamic tracks
      const dynamicTracks: Track[] = [];

      for (let i = 0; i < 8; i++) {
        const track = new Track({
          id: `dynamic-${i}`,
          name: `Dynamic Track ${i}`,
          type: i % 2 === 0 ? 'drum' : 'bass',
        });

        // Initial simple pattern
        const initialPattern =
          i % 2 === 0
            ? {
                type: 'drum' as const,
                events: [
                  {
                    position: toMusicalPosition(0, 0, 0),
                    drum: 'kick' as const,
                    velocity: 0.8,
                  },
                ],
              }
            : {
                type: 'bass' as const,
                events: [
                  {
                    position: toMusicalPosition(0, 0, 0),
                    note: 'C2',
                    duration: 'quarter' as const,
                    velocity: 0.7,
                  },
                ],
              };

        track.createRegionFromPattern(initialPattern, {
          name: 'Dynamic Pattern',
          startPosition: toMusicalPosition(0, 0, 0),
          duration: toMusicalPosition(1, 0, 0),
          loopCount: 0, // Infinite
        });

        dynamicTracks.push(track);
        scheduler.registerTrack(track.id, track.getRegions());
      }

      // Start playback
      metrics.startTime = performance.now();
      await transport.start();

      // Perform rapid pattern updates
      const updateCount = 20;
      const updateInterval = 500; // Every 500ms

      for (let update = 0; update < updateCount; update++) {
        await new Promise((resolve) => setTimeout(resolve, updateInterval));

        // Update half the tracks with new patterns
        for (let i = 0; i < dynamicTracks.length; i += 2) {
          const track = dynamicTracks[i];
          const region = track.getRegions()[0];

          // Generate progressively complex patterns
          const complexity = Math.min(update + 1, 8);
          const newPattern =
            track.type === 'drum'
              ? generateComplexDrumPattern(complexity)
              : generateComplexBassPattern(complexity);

          track.updateRegionPattern(region.id, newPattern);
          scheduler.updateTrackRegions(track.id, track.getRegions());
        }
      }

      await transport.stop();
      metrics.endTime = performance.now();

      // System should remain stable despite rapid updates
      expect(metrics.audioGlitches).toBeLessThan(3); // Allow minimal glitches
      expect(metrics.avgDrift).toBeLessThan(0.01); // 10ms average acceptable under stress

      logger.info('Rapid pattern update test', {
        updateCount,
        totalDuration: metrics.endTime - metrics.startTime,
        averageUpdateTime: updateInterval,
      });
    });
  });

  describe('Complex Pattern Performance', () => {
    it('should handle dense 32nd note patterns', async () => {
      // Create tracks with very dense patterns
      const tracks = [
        new Track({ id: 'drums-32nd', name: '32nd Drums', type: 'drum' }),
        new Track({ id: 'bass-32nd', name: '32nd Bass', type: 'bass' }),
      ];

      // Generate 32nd note patterns (8 per beat, 32 per bar)
      const drum32ndPattern: DrumPattern = {
        type: 'drum',
        events: [],
      };

      const bass32ndPattern: BassPattern = {
        type: 'bass',
        events: [],
      };

      // Fill with 32nd notes
      for (let bar = 0; bar < 2; bar++) {
        for (let thirty2nd = 0; thirty2nd < 32; thirty2nd++) {
          const beat = Math.floor(thirty2nd / 8);
          const subdivision = thirty2nd % 8;
          const sixteenth = Math.floor(subdivision / 2);

          drum32ndPattern.events.push({
            position: toMusicalPosition(bar, beat, sixteenth),
            drum: thirty2nd % 8 === 0 ? 'kick' : 'hihat',
            velocity: thirty2nd % 8 === 0 ? 0.8 : 0.3,
          });

          if (thirty2nd % 2 === 0) {
            // Bass on 16th notes
            bass32ndPattern.events.push({
              position: toMusicalPosition(bar, beat, sixteenth),
              note: `${['C', 'D', 'E', 'F', 'G', 'A', 'B'][thirty2nd % 7]}2`,
              duration: 'sixteenth',
              velocity: 0.5,
            });
          }
        }
      }

      tracks[0].createRegionFromPattern(drum32ndPattern, {
        name: '32nd Drum Pattern',
        startPosition: toMusicalPosition(0, 0, 0),
        duration: toMusicalPosition(2, 0, 0),
      });

      tracks[1].createRegionFromPattern(bass32ndPattern, {
        name: '32nd Bass Pattern',
        startPosition: toMusicalPosition(0, 0, 0),
        duration: toMusicalPosition(2, 0, 0),
      });

      tracks.forEach((track) =>
        scheduler.registerTrack(track.id, track.getRegions()),
      );

      // Test at high tempo (160 BPM)
      transport.setTempo(160);

      metrics.startTime = performance.now();
      await transport.start();

      // Play 2 bars at 160 BPM (~3 seconds)
      await new Promise((resolve) => setTimeout(resolve, 3200));

      await transport.stop();
      metrics.endTime = performance.now();

      // Should handle dense patterns without breaking
      expect(metrics.eventCount).toBeGreaterThan(100); // Many rapid events
      expect(metrics.maxDrift).toBeLessThan(0.015); // 15ms max drift for dense patterns
      expect(metrics.audioGlitches).toBe(0);

      // Calculate events per second
      const duration = (metrics.endTime - metrics.startTime) / 1000;
      const eventsPerSecond = metrics.eventCount / duration;

      logger.info('32nd note pattern test', {
        tempo: 160,
        totalEvents: metrics.eventCount,
        eventsPerSecond: eventsPerSecond.toFixed(1),
        processingLoad: 'heavy',
      });
    });

    it('should handle polyphonic chord voicings', async () => {
      // Create multiple chord tracks with complex voicings
      const chordTracks: Track[] = [];

      const voicings = [
        { name: 'Jazz Piano', notes: 6, spread: true },
        { name: 'String Section', notes: 8, spread: false },
        { name: 'Synth Pad', notes: 5, spread: true },
        { name: 'Organ', notes: 7, spread: false },
      ];

      voicings.forEach((voicing, index) => {
        const track = new Track({
          id: `chord-${index}`,
          name: voicing.name,
          type: 'chord',
        });

        const pattern: ChordPattern = {
          type: 'chord',
          events: [],
        };

        // Create complex chord progressions
        const chordProgression = [
          ['C', 'E', 'G', 'B', 'D', 'F#'], // Cmaj13
          ['D', 'F', 'A', 'C', 'E', 'G'], // Dm11
          ['G', 'B', 'D', 'F', 'A', 'C'], // G13
          ['C', 'E', 'G', 'Bb', 'D', 'F'], // C7(9,11)
        ];

        chordProgression.forEach((chord, beat) => {
          const notes = chord.slice(0, voicing.notes).map((note, i) => {
            const octave = voicing.spread ? 3 + Math.floor(i / 3) : 4;
            return `${note}${octave}`;
          });

          pattern.events.push({
            position: toMusicalPosition(0, beat, 0),
            notes,
            duration: 'quarter',
            velocity: 0.6 - index * 0.1, // Layer velocities
          });
        });

        track.createRegionFromPattern(pattern, {
          name: 'Chord Progression',
          startPosition: toMusicalPosition(0, 0, 0),
          duration: toMusicalPosition(1, 0, 0),
          loopCount: 3,
        });

        chordTracks.push(track);
        scheduler.registerTrack(track.id, track.getRegions());
      });

      metrics.startTime = performance.now();
      await transport.start();

      // Play 4 bars
      await new Promise((resolve) => setTimeout(resolve, 8200));

      await transport.stop();
      metrics.endTime = performance.now();

      // Should handle polyphony without issues
      expect(metrics.audioGlitches).toBe(0);
      expect(metrics.avgDrift).toBeLessThan(0.005);

      // Calculate polyphony level
      const totalNotes = voicings.reduce((sum, v) => sum + v.notes, 0);

      logger.info('Polyphonic performance test', {
        voiceCount: chordTracks.length,
        totalPolyphony: totalNotes,
        averageNotesPerChord: totalNotes / voicings.length,
      });
    });
  });

  describe('Memory and CPU Stress', () => {
    it('should handle extended playback without memory leaks', async () => {
      // Create a moderate load that runs for extended time
      const tracks = [
        new Track({
          id: 'drums-extended',
          name: 'Extended Drums',
          type: 'drum',
        }),
        new Track({ id: 'bass-extended', name: 'Extended Bass', type: 'bass' }),
        new Track({
          id: 'keys-extended',
          name: 'Extended Keys',
          type: 'chord',
        }),
      ];

      // Standard patterns
      tracks[0].createRegionFromPattern(generateDrumPattern('standard'), {
        name: 'Drum Loop',
        startPosition: toMusicalPosition(0, 0, 0),
        duration: toMusicalPosition(1, 0, 0),
        loopCount: 0, // Infinite
      });

      tracks[1].createRegionFromPattern(generateBassPattern('walking'), {
        name: 'Bass Loop',
        startPosition: toMusicalPosition(0, 0, 0),
        duration: toMusicalPosition(2, 0, 0),
        loopCount: 0,
      });

      tracks[2].createRegionFromPattern(generateChordPattern('progression'), {
        name: 'Chord Loop',
        startPosition: toMusicalPosition(0, 0, 0),
        duration: toMusicalPosition(4, 0, 0),
        loopCount: 0,
      });

      tracks.forEach((track) =>
        scheduler.registerTrack(track.id, track.getRegions()),
      );

      // Memory snapshots
      const memorySnapshots: number[] = [];
      const startMemory = (performance as any).memory?.usedJSHeapSize || 0;

      metrics.startTime = performance.now();
      await transport.start();

      // Run for 30 seconds, taking memory snapshots
      for (let i = 0; i < 6; i++) {
        await new Promise((resolve) => setTimeout(resolve, 5000)); // 5 second intervals
        const currentMemory = (performance as any).memory?.usedJSHeapSize || 0;
        memorySnapshots.push(currentMemory - startMemory);
      }

      await transport.stop();
      metrics.endTime = performance.now();

      // Analyze memory growth
      const memoryGrowth =
        memorySnapshots[memorySnapshots.length - 1] - memorySnapshots[0];
      const avgMemoryGrowth = memoryGrowth / memorySnapshots.length;

      // Should not have significant memory growth
      expect(avgMemoryGrowth).toBeLessThan(1024 * 1024); // Less than 1MB growth per snapshot

      // Timing should remain stable
      expect(metrics.avgDrift).toBeLessThan(0.005);

      logger.info('Extended playback test', {
        duration: (metrics.endTime - metrics.startTime) / 1000,
        memorySnapshots: memorySnapshots.map(
          (m) => (m / 1024 / 1024).toFixed(2) + ' MB',
        ),
        totalMemoryGrowth: (memoryGrowth / 1024 / 1024).toFixed(2) + ' MB',
      });
    });

    it('should recover from performance spikes', async () => {
      // Create baseline tracks
      const tracks = [
        new Track({
          id: 'stable-1',
          name: 'Stable Track 1',
          type: 'metronome',
        }),
        new Track({
          id: 'stable-2',
          name: 'Stable Track 2',
          type: 'metronome',
        }),
      ];

      // Simple patterns
      const clickPattern: MetronomePattern = {
        type: 'metronome',
        events: [
          { position: toMusicalPosition(0, 0, 0), type: 'click' },
          { position: toMusicalPosition(0, 1, 0), type: 'click' },
          { position: toMusicalPosition(0, 2, 0), type: 'click' },
          { position: toMusicalPosition(0, 3, 0), type: 'click' },
        ],
      };

      tracks.forEach((track) => {
        track.createRegionFromPattern(clickPattern, {
          name: 'Click Pattern',
          startPosition: toMusicalPosition(0, 0, 0),
          duration: toMusicalPosition(1, 0, 0),
          loopCount: 0,
        });
        scheduler.registerTrack(track.id, track.getRegions());
      });

      await transport.start();

      // Baseline measurement
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const baselineDrift = [...timingDrifts];
      timingDrifts = [];

      // Simulate CPU spike by creating heavy computation
      const heavyComputation = () => {
        const start = Date.now();
        let result = 0;
        while (Date.now() - start < 100) {
          // Block for 100ms
          result += Math.sqrt(Math.random());
        }
        return result;
      };

      // Create spike
      heavyComputation();

      // Continue monitoring
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const postSpikeDrift = [...timingDrifts];

      await transport.stop();

      // System should recover after spike
      const baselineAvg =
        baselineDrift.reduce((a, b) => a + b, 0) / baselineDrift.length;
      const postSpikeAvg =
        postSpikeDrift.reduce((a, b) => a + b, 0) / postSpikeDrift.length;

      // Post-spike should return to near baseline
      expect(postSpikeAvg).toBeLessThan(baselineAvg * 2); // At most 2x baseline

      logger.info('Performance spike recovery', {
        baselineAvgDrift: baselineAvg * 1000,
        postSpikeAvgDrift: postSpikeAvg * 1000,
        recoveryRatio: postSpikeAvg / baselineAvg,
      });
    });
  });
});

// Helper functions to generate test patterns
function generateDrumPattern(type: string): DrumPattern {
  const pattern: DrumPattern = { type: 'drum', events: [] };

  switch (type) {
    case 'kick':
      pattern.events = [
        { position: toMusicalPosition(0, 0, 0), drum: 'kick', velocity: 0.8 },
        { position: toMusicalPosition(0, 2, 0), drum: 'kick', velocity: 0.6 },
      ];
      break;
    case 'snare':
      pattern.events = [
        { position: toMusicalPosition(0, 1, 0), drum: 'snare', velocity: 0.7 },
        { position: toMusicalPosition(0, 3, 0), drum: 'snare', velocity: 0.7 },
      ];
      break;
    case 'hihat':
      for (let i = 0; i < 16; i++) {
        pattern.events.push({
          position: toMusicalPosition(0, Math.floor(i / 4), i % 4),
          drum: 'hihat',
          velocity: i % 4 === 0 ? 0.6 : 0.3,
        });
      }
      break;
    case 'standard':
      pattern.events = [
        { position: toMusicalPosition(0, 0, 0), drum: 'kick', velocity: 0.8 },
        { position: toMusicalPosition(0, 1, 0), drum: 'snare', velocity: 0.7 },
        { position: toMusicalPosition(0, 2, 0), drum: 'kick', velocity: 0.6 },
        { position: toMusicalPosition(0, 3, 0), drum: 'snare', velocity: 0.7 },
      ];
      break;
    default:
      pattern.events = [
        { position: toMusicalPosition(0, 0, 0), drum: 'kick', velocity: 0.8 },
      ];
  }

  return pattern;
}

function generateBassPattern(type: string): BassPattern {
  const pattern: BassPattern = { type: 'bass', events: [] };

  switch (type) {
    case 'root':
      pattern.events = [
        {
          position: toMusicalPosition(0, 0, 0),
          note: 'C2',
          duration: 'whole',
          velocity: 0.7,
        },
      ];
      break;
    case 'walking':
      const notes = ['C2', 'E2', 'G2', 'A2'];
      notes.forEach((note, i) => {
        pattern.events.push({
          position: toMusicalPosition(0, i, 0),
          note,
          duration: 'quarter',
          velocity: 0.6,
        });
      });
      break;
    case 'synth':
      for (let i = 0; i < 8; i++) {
        pattern.events.push({
          position: toMusicalPosition(0, Math.floor(i / 2), (i % 2) * 2),
          note: i % 2 === 0 ? 'C2' : 'G2',
          duration: 'eighth',
          velocity: 0.5,
        });
      }
      break;
    default:
      pattern.events = [
        {
          position: toMusicalPosition(0, 0, 0),
          note: 'C2',
          duration: 'quarter',
          velocity: 0.7,
        },
      ];
  }

  return pattern;
}

function generateChordPattern(type: string): ChordPattern {
  const pattern: ChordPattern = { type: 'chord', events: [] };

  switch (type) {
    case 'triad':
      pattern.events = [
        {
          position: toMusicalPosition(0, 0, 0),
          notes: ['C3', 'E3', 'G3'],
          duration: 'whole',
          velocity: 0.5,
        },
      ];
      break;
    case 'progression':
      const chords = [
        ['C3', 'E3', 'G3'], // C
        ['A2', 'C3', 'E3'], // Am
        ['F3', 'A3', 'C4'], // F
        ['G3', 'B3', 'D4'], // G
      ];
      chords.forEach((notes, i) => {
        pattern.events.push({
          position: toMusicalPosition(i, 0, 0),
          notes,
          duration: 'whole',
          velocity: 0.5,
        });
      });
      break;
    default:
      pattern.events = [
        {
          position: toMusicalPosition(0, 0, 0),
          notes: ['C3', 'E3', 'G3'],
          duration: 'quarter',
          velocity: 0.5,
        },
      ];
  }

  return pattern;
}

function generateMetronomePattern(type: string): MetronomePattern {
  const pattern: MetronomePattern = { type: 'metronome', events: [] };

  switch (type) {
    case 'quarter':
      for (let beat = 0; beat < 4; beat++) {
        pattern.events.push({
          position: toMusicalPosition(0, beat, 0),
          type: beat === 0 ? 'accent' : 'click',
        });
      }
      break;
    case 'eighth':
      for (let eighth = 0; eighth < 8; eighth++) {
        pattern.events.push({
          position: toMusicalPosition(
            0,
            Math.floor(eighth / 2),
            (eighth % 2) * 2,
          ),
          type: eighth === 0 ? 'accent' : 'click',
        });
      }
      break;
    case 'sixteenth':
      for (let sixteenth = 0; sixteenth < 16; sixteenth++) {
        pattern.events.push({
          position: toMusicalPosition(
            0,
            Math.floor(sixteenth / 4),
            sixteenth % 4,
          ),
          type: sixteenth === 0 ? 'accent' : 'click',
        });
      }
      break;
    default:
      pattern.events = [
        { position: toMusicalPosition(0, 0, 0), type: 'accent' },
      ];
  }

  return pattern;
}

function generateComplexDrumPattern(complexity: number): DrumPattern {
  const pattern: DrumPattern = { type: 'drum', events: [] };
  const drums = ['kick', 'snare', 'hihat', 'crash', 'tom1', 'tom2', 'ride'];

  // Add more events based on complexity
  for (let i = 0; i < complexity * 4; i++) {
    const beat = Math.floor(Math.random() * 4);
    const sixteenth = Math.floor(Math.random() * 4);
    const drum =
      drums[Math.floor(Math.random() * Math.min(complexity, drums.length))];

    pattern.events.push({
      position: toMusicalPosition(0, beat, sixteenth),
      drum: drum as any,
      velocity: 0.3 + Math.random() * 0.5,
    });
  }

  return pattern;
}

function generateComplexBassPattern(complexity: number): BassPattern {
  const pattern: BassPattern = { type: 'bass', events: [] };
  const notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const durations: Array<
    'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth'
  > = ['whole', 'half', 'quarter', 'eighth', 'sixteenth'];

  for (let i = 0; i < complexity * 2; i++) {
    const beat = Math.floor(Math.random() * 4);
    const sixteenth = Math.floor(Math.random() * 4);
    const note = notes[Math.floor(Math.random() * notes.length)] + '2';
    const duration =
      durations[
        Math.min(Math.floor(Math.random() * complexity), durations.length - 1)
      ];

    pattern.events.push({
      position: toMusicalPosition(0, beat, sixteenth),
      note,
      duration,
      velocity: 0.4 + Math.random() * 0.4,
    });
  }

  return pattern;
}
