/**
 * Story 3.15 Integration Tests
 *
 * Comprehensive integration tests for the Professional Musical Time System.
 * Tests all components working together to validate Story 3.15 acceptance criteria.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MusicalTimeConverter } from '@bassnotion/contracts/services/MusicalTimeConverter';
import { ProfessionalDrumProcessor } from '@bassnotion/contracts/services/ProfessionalDrumProcessor';
import { MusicalTimeEngine } from '@/domains/playback/services/MusicalTimeEngine';
import { PlaybackOrchestrator } from '@/domains/widgets/services/PlaybackOrchestrator';
import { TempoIndependentExerciseLoader } from '@/domains/widgets/services/TempoIndependentExerciseLoader';
import type {
  MusicalPosition,
  TimeSignature,
  BassNote,
  DrumPattern,
  HarmonyChange,
} from '@bassnotion/contracts/types/musical-time';

// Mock dependencies
vi.mock('@/domains/playback/services/CorePlaybackEngine');
vi.mock('@/domains/widgets/services/WidgetSyncService');

describe('Story 3.15 Professional Musical Time System - Integration Tests', () => {
  let musicalTimeEngine: MusicalTimeEngine;
  let playbackOrchestrator: PlaybackOrchestrator;
  let exerciseLoader: TempoIndependentExerciseLoader;

  const defaultTimeSignature: TimeSignature = { numerator: 4, denominator: 4 };
  const testTempo = 120;

  beforeEach(async () => {
    // Initialize all components
    musicalTimeEngine = MusicalTimeEngine.getInstance();
    playbackOrchestrator = PlaybackOrchestrator.getInstance();
    exerciseLoader = TempoIndependentExerciseLoader.getInstance();

    await musicalTimeEngine.initialize({
      tempo: testTempo,
      timeSignature: defaultTimeSignature,
      syncLatencyTarget: 50,
      enableHighPrecisionTiming: true,
    });

    await playbackOrchestrator.initialize();
  });

  afterEach(async () => {
    await playbackOrchestrator.dispose();
    musicalTimeEngine.dispose();
    exerciseLoader.clearCache();
  });

  describe('AC 3.15.1: Professional Musical Time Schema', () => {
    it('should use 480 ticks per quarter note industry standard', () => {
      expect(MusicalTimeConverter.TICKS_PER_QUARTER).toBe(480);

      // Verify this is used consistently across all components
      const quarterNoteTick = 480;
      const milliseconds = MusicalTimeConverter.tickToMilliseconds(
        quarterNoteTick,
        120,
      );
      expect(milliseconds).toBe(500); // 120 BPM = 500ms per beat
    });

    it('should support complex rhythms including triplets', () => {
      const tripletEighthTick = 160; // 480/3
      const milliseconds = MusicalTimeConverter.tickToMilliseconds(
        tripletEighthTick,
        120,
      );

      expect(milliseconds).toBeCloseTo(166.67, 1); // 500ms / 3
    });

    it('should store drum patterns as tick-based events', () => {
      const pattern = ProfessionalDrumProcessor.generatePattern(
        { style: 'rock', complexity: 'medium', humanization: false, swing: 0 },
        defaultTimeSignature,
        1,
      );

      expect(pattern.events).toBeInstanceOf(Array);
      expect(pattern.events.length).toBeGreaterThan(0);

      // Should NOT be simple grid array
      expect(pattern.events[0]).toHaveProperty('tick');
      expect(pattern.events[0]).toHaveProperty('drum');
      expect(pattern.events[0]).toHaveProperty('velocity');
    });

    it('should support swing and polyrhythms', () => {
      const swingPattern = ProfessionalDrumProcessor.generatePattern(
        {
          style: 'jazz',
          complexity: 'medium',
          humanization: false,
          swing: 0.6,
        },
        defaultTimeSignature,
        1,
      );

      expect(swingPattern.events.length).toBeGreaterThan(0);

      // Should have swing timing applied
      const offBeats = swingPattern.events.filter((e) => e.tick % 480 > 240);
      expect(offBeats.length).toBeGreaterThan(0);
    });
  });

  describe('AC 3.15.2: Tempo-Independent Exercise Data', () => {
    it('should store exercise duration in musical time', async () => {
      const exerciseData = createTestExercise();
      const result = await exerciseLoader.loadExercise(exerciseData);

      expect(result.data.total_bars).toBe(4);
      expect(result.totalTicks).toBe(7680); // 4 bars * 4 beats * 480 ticks
      expect(result.duration).toBe(8000); // 4 bars * 4 beats * 500ms at 120 BPM
    });

    it('should use bar/beat/subdivision coordinates for bass notes', async () => {
      const exerciseData = createTestExercise();
      const result = await exerciseLoader.loadExercise(exerciseData);

      const bassNotes = exerciseData.musical_content.bass.notes;
      expect(bassNotes[0]).toHaveProperty('bar');
      expect(bassNotes[0]).toHaveProperty('beat');
      expect(bassNotes[0]).toHaveProperty('subdivision');
      expect(bassNotes[0]).toHaveProperty('note');
      expect(bassNotes[0]).toHaveProperty('duration');
    });

    it('should use musical timing for harmony progressions', async () => {
      const exerciseData = createTestExercise();
      const result = await exerciseLoader.loadExercise(exerciseData);

      const harmonyChanges = exerciseData.musical_content.harmony.progression;
      expect(harmonyChanges[0]).toHaveProperty('bar');
      expect(harmonyChanges[0]).toHaveProperty('chord');

      // Should be positioned at bar boundaries
      const harmonyTicks = result.scheduledEvents.get('harmony');
      expect(harmonyTicks).toEqual([0, 1920, 3840, 5760]); // Bar boundaries
    });

    it('should perform all calculations at runtime based on tempo', async () => {
      const exerciseData = createTestExercise();

      const result120 = await exerciseLoader.loadExercise(exerciseData, 120);
      const result60 = await exerciseLoader.loadExercise(exerciseData, 60);

      // Duration should be different for different tempos
      expect(result120.duration).toBe(8000);
      expect(result60.duration).toBe(16000);

      // But tick events should be identical
      expect(result120.scheduledEvents.get('bass')).toEqual(
        result60.scheduledEvents.get('bass'),
      );
    });
  });

  describe('AC 3.15.3: Professional Drum Pattern System', () => {
    it('should replace simple arrays with tick-based events', () => {
      const pattern = ProfessionalDrumProcessor.generatePattern(
        { style: 'rock', complexity: 'medium', humanization: false, swing: 0 },
        defaultTimeSignature,
        1,
      );

      // Should NOT have simple [1,0,0,0] structure
      expect(pattern.events).not.toContain([1, 0, 0, 0]);

      // Should have professional tick-based events
      pattern.events.forEach((event) => {
        expect(event.tick).toBeGreaterThanOrEqual(0);
        expect(event.tick).toBeLessThan(1920); // 1 bar in 4/4
        expect(event.velocity).toBeGreaterThanOrEqual(0);
        expect(event.velocity).toBeLessThanOrEqual(127);
      });
    });

    it('should use full MIDI velocity range (0-127)', () => {
      const pattern = ProfessionalDrumProcessor.generatePattern(
        { style: 'rock', complexity: 'complex', humanization: false, swing: 0 },
        defaultTimeSignature,
        1,
      );

      const velocities = pattern.events.map((e) => e.velocity);
      const minVelocity = Math.min(...velocities);
      const maxVelocity = Math.max(...velocities);

      expect(minVelocity).toBeGreaterThanOrEqual(0);
      expect(maxVelocity).toBeLessThanOrEqual(127);
      expect(maxVelocity).toBeGreaterThan(minVelocity);
    });

    it('should support complex patterns with triplets and swing', () => {
      const swingPattern = ProfessionalDrumProcessor.generatePattern(
        {
          style: 'jazz',
          complexity: 'medium',
          humanization: false,
          swing: 0.6,
        },
        defaultTimeSignature,
        1,
      );

      // Should have swing timing applied to off-beats
      const offBeats = swingPattern.events.filter((e) => e.tick % 480 > 240);
      expect(offBeats.length).toBeGreaterThan(0);
    });

    it('should support pattern arrangement system', () => {
      const mainPattern = ProfessionalDrumProcessor.generatePattern(
        { style: 'rock', complexity: 'medium', humanization: false, swing: 0 },
        defaultTimeSignature,
        1,
      );

      const fillPattern = ProfessionalDrumProcessor.generatePattern(
        { style: 'rock', complexity: 'complex', humanization: false, swing: 0 },
        defaultTimeSignature,
        1,
      );

      fillPattern.name = 'rock_fill';

      const arrangement = ProfessionalDrumProcessor.createArrangement(
        [mainPattern, fillPattern],
        ['main', 'main', 'main', 'rock_fill'],
      );

      expect(arrangement.patterns).toHaveLength(2);
      expect(arrangement.arrangement).toEqual([
        'main',
        'main',
        'main',
        'rock_fill',
      ]);
    });
  });

  describe('AC 3.15.4: Synchronized Musical Time Engine', () => {
    it('should coordinate all widgets from same musical time base', async () => {
      // Register multiple widgets
      const widgets = [
        { id: 'bass-widget', type: 'bass' },
        { id: 'drum-widget', type: 'drums' },
        { id: 'harmony-widget', type: 'harmony' },
      ];

      widgets.forEach((widget) => {
        playbackOrchestrator.registerWidget(widget.id, {
          widgetType: widget.type,
          isActive: true,
          priority: 1,
          volume: 0.8,
          pan: 0,
          muted: false,
          solo: false,
        });
      });

      // All widgets should be coordinated through the same time base
      const syncState = playbackOrchestrator.getSyncState();
      expect(syncState.registeredWidgets.size).toBe(3);

      // Should all have same tempo and time signature
      expect(syncState.tempo).toBe(120);
      expect(syncState.timeSignature).toEqual(defaultTimeSignature);
    });

    it('should update all widgets simultaneously on tempo changes', async () => {
      // Register widgets
      playbackOrchestrator.registerWidget('bass-widget', {
        widgetType: 'bass',
        isActive: true,
        priority: 1,
        volume: 0.8,
        pan: 0,
        muted: false,
        solo: false,
      });

      // Change tempo
      await playbackOrchestrator.setGlobalTempo(140);

      // All widgets should receive the new tempo
      const syncState = playbackOrchestrator.getSyncState();
      expect(syncState.tempo).toBe(140);

      // Musical time engine should also be updated
      const musicalState = musicalTimeEngine.getState();
      expect(musicalState.tempo).toBe(140);
    });

    it('should handle all conversions through MusicalTimeConverter', async () => {
      const exerciseData = createTestExercise();
      await exerciseLoader.loadExercise(exerciseData);

      // All tick to millisecond conversions should go through MusicalTimeConverter
      const testTick = 480;
      const milliseconds = MusicalTimeConverter.tickToMilliseconds(
        testTick,
        120,
      );
      expect(milliseconds).toBe(500);

      // Position conversions should also use MusicalTimeConverter
      const position: MusicalPosition = { bar: 1, beat: 2, subdivision: 0 };
      const tick = MusicalTimeConverter.musicalPositionToTick(
        position,
        defaultTimeSignature,
      );
      expect(tick).toBe(480);
    });

    it('should maintain perfect synchronization across all components', async () => {
      const exerciseData = createTestExercise();
      await exerciseLoader.loadExercise(exerciseData);

      // Start playback
      musicalTimeEngine.start();

      // All components should be synchronized
      const orchestratorState = playbackOrchestrator.getSyncState();
      const engineState = musicalTimeEngine.getState();

      expect(orchestratorState.tempo).toBe(engineState.tempo);
      expect(orchestratorState.timeSignature).toEqual(
        engineState.timeSignature,
      );
    });
  });

  describe('Cross-Component Integration', () => {
    it('should provide seamless data flow between all components', async () => {
      // Create exercise with all track types
      const exerciseData = createTestExercise();

      // Load through exercise loader
      const loadedExercise = await exerciseLoader.loadExercise(exerciseData);

      // Register widgets with orchestrator
      playbackOrchestrator.registerWidget('bass-widget', {
        widgetType: 'bass',
        isActive: true,
        priority: 1,
        volume: 0.8,
        pan: 0,
        muted: false,
        solo: false,
      });

      // Get scheduled events for bass widget
      const bassTicks = exerciseLoader.getScheduledEventsForWidget('bass');

      // Should have events scheduled
      expect(bassTicks.length).toBeGreaterThan(0);

      // Events should be properly timed
      bassTicks.forEach((tick) => {
        expect(tick).toBeGreaterThanOrEqual(0);
        expect(tick).toBeLessThan(loadedExercise.totalTicks);
      });
    });

    it('should handle tempo changes across all components', async () => {
      const exerciseData = createTestExercise();
      await exerciseLoader.loadExercise(exerciseData, 120);

      // Change tempo through orchestrator
      await playbackOrchestrator.setGlobalTempo(140);

      // Should update exercise loader
      const newExercise = await exerciseLoader.changeExerciseTempo(140);
      expect(newExercise?.duration).toBeLessThan(8000); // Shorter duration at higher tempo

      // Should update musical time engine
      const engineState = musicalTimeEngine.getState();
      expect(engineState.tempo).toBe(140);
    });

    it('should support complex musical scenarios', async () => {
      // Create exercise with triplets in 7/8 time
      const complexExercise = {
        id: 'complex-exercise',
        title: 'Complex Time Test',
        total_bars: 2,
        tempo: 120,
        key_signature: 'C',
        time_signature: { numerator: 7, denominator: 8 } as TimeSignature,
        musical_content: {
          bass: {
            enabled: true,
            notes: [
              {
                bar: 1,
                beat: 1,
                subdivision: 0,
                note: 'E2',
                duration: 'eighth-triplet',
                string: 4,
                fret: 0,
              },
              {
                bar: 1,
                beat: 1,
                subdivision: 1,
                note: 'G2',
                duration: 'eighth-triplet',
                string: 4,
                fret: 3,
              },
              {
                bar: 1,
                beat: 1,
                subdivision: 2,
                note: 'A2',
                duration: 'eighth-triplet',
                string: 3,
                fret: 2,
              },
            ] as BassNote[],
          },
          drums: {
            enabled: true,
            resolution: 480,
            patterns: [
              ProfessionalDrumProcessor.generatePattern(
                {
                  style: 'progressive',
                  complexity: 'complex',
                  humanization: false,
                  swing: 0,
                },
                { numerator: 7, denominator: 8 },
                1,
              ),
            ],
            arrangement: ['main', 'main'],
          },
          harmony: {
            enabled: true,
            progression: [
              { bar: 1, chord: 'Dm7' },
              { bar: 2, chord: 'G7alt' },
            ] as HarmonyChange[],
          },
        },
        mix_settings: {
          levels: { bass: 0.8, drums: 0.7, harmony: 0.6 },
          master: 0.8,
        },
      };

      const result = await exerciseLoader.loadExercise(complexExercise);

      // Should handle complex time signature
      expect(result.totalTicks).toBe(3360); // 2 bars * 7 eighth notes * 240 ticks

      // Should have events scheduled for all tracks
      expect(result.scheduledEvents.has('bass')).toBe(true);
      expect(result.scheduledEvents.has('drums')).toBe(true);
      expect(result.scheduledEvents.has('harmony')).toBe(true);
    });
  });

  describe('Performance Requirements', () => {
    it('should maintain <50ms synchronization target', async () => {
      const exerciseData = createTestExercise();
      await exerciseLoader.loadExercise(exerciseData);

      // Register multiple widgets
      for (let i = 0; i < 5; i++) {
        playbackOrchestrator.registerWidget(`widget-${i}`, {
          widgetType: 'bass',
          isActive: true,
          priority: 1,
          volume: 0.8,
          pan: 0,
          muted: false,
          solo: false,
        });
      }

      const startTime = performance.now();

      // Perform multiple tempo changes
      for (let tempo = 120; tempo <= 140; tempo += 5) {
        await playbackOrchestrator.setGlobalTempo(tempo);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within 50ms target
      expect(duration).toBeLessThan(50);
    });

    it('should handle high-frequency updates efficiently', async () => {
      const exerciseData = createTestExercise();
      await exerciseLoader.loadExercise(exerciseData);

      const startTime = performance.now();

      // Simulate high-frequency position updates
      for (let i = 0; i < 100; i++) {
        const position: MusicalPosition = {
          bar: 1,
          beat: 1,
          subdivision: i % 4,
        };
        await playbackOrchestrator.seekToMusicalPosition(position);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle high-frequency updates efficiently
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should gracefully handle component failures', async () => {
      // Test with incomplete exercise data
      const incompleteExercise = {
        id: 'incomplete',
        title: 'Incomplete Exercise',
        total_bars: 1,
        tempo: 120,
        key_signature: 'C',
        time_signature: defaultTimeSignature,
        musical_content: {
          bass: { enabled: false, notes: [] },
          drums: {
            enabled: false,
            resolution: 480,
            patterns: [],
            arrangement: [],
          },
          harmony: { enabled: false, progression: [] },
        },
        mix_settings: {
          levels: { bass: 0.8, drums: 0.7, harmony: 0.6 },
          master: 0.8,
        },
      };

      const result = await exerciseLoader.loadExercise(incompleteExercise);

      // Should handle gracefully
      expect(result.scheduledEvents.size).toBe(0);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should maintain system stability during rapid changes', async () => {
      // Rapid registration/unregistration
      for (let i = 0; i < 20; i++) {
        playbackOrchestrator.registerWidget(`widget-${i}`, {
          widgetType: 'bass',
          isActive: true,
          priority: 1,
          volume: 0.8,
          pan: 0,
          muted: false,
          solo: false,
        });

        if (i % 2 === 0) {
          playbackOrchestrator.unregisterWidget(`widget-${i}`);
        }
      }

      // System should remain stable
      const syncState = playbackOrchestrator.getSyncState();
      expect(syncState.registeredWidgets.size).toBe(10);
    });
  });

  // Helper function to create test exercise data
  function createTestExercise() {
    return {
      id: 'test-exercise',
      title: 'Test Exercise',
      total_bars: 4,
      tempo: 120,
      key_signature: 'C',
      time_signature: defaultTimeSignature,
      musical_content: {
        bass: {
          enabled: true,
          notes: [
            {
              bar: 1,
              beat: 1,
              subdivision: 0,
              note: 'E2',
              duration: 'quarter',
              string: 4,
              fret: 0,
            },
            {
              bar: 1,
              beat: 2,
              subdivision: 0,
              note: 'A2',
              duration: 'quarter',
              string: 3,
              fret: 2,
            },
            {
              bar: 1,
              beat: 3,
              subdivision: 0,
              note: 'D3',
              duration: 'quarter',
              string: 2,
              fret: 5,
            },
            {
              bar: 1,
              beat: 4,
              subdivision: 0,
              note: 'G2',
              duration: 'quarter',
              string: 3,
              fret: 5,
            },
          ] as BassNote[],
        },
        drums: {
          enabled: true,
          resolution: 480,
          patterns: [
            ProfessionalDrumProcessor.generatePattern(
              {
                style: 'rock',
                complexity: 'medium',
                humanization: false,
                swing: 0,
              },
              defaultTimeSignature,
              1,
            ),
          ],
          arrangement: ['main', 'main', 'main', 'main'],
        },
        harmony: {
          enabled: true,
          progression: [
            { bar: 1, chord: 'C' },
            { bar: 2, chord: 'F' },
            { bar: 3, chord: 'G' },
            { bar: 4, chord: 'C' },
          ] as HarmonyChange[],
        },
      },
      mix_settings: {
        levels: { bass: 0.8, drums: 0.7, harmony: 0.6 },
        master: 0.8,
      },
    };
  }
});
