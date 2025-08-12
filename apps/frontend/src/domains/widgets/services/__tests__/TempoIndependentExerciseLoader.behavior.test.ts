/**
 * Tempo Independent Exercise Loader - Behavior Tests
 *
 * Tests the tempo-independent exercise loading system.
 * Validates Story 3.15 implementation with professional musical time.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TempoIndependentExerciseLoader } from '../TempoIndependentExerciseLoader';
import type { ExerciseData } from '../TempoIndependentExerciseLoader';
import type {
  TimeSignature,
  BassNote,
  DrumPattern,
  HarmonyChange,
} from '@bassnotion/contracts/types/musical-time';

describe('TempoIndependentExerciseLoader - Story 3.15 Behavior Tests', () => {
  let loader: TempoIndependentExerciseLoader;
  let mockExerciseData: ExerciseData;

  beforeEach(() => {
    loader = TempoIndependentExerciseLoader.getInstance();

    // Create comprehensive mock exercise data
    mockExerciseData = {
      id: 'test-exercise-1',
      title: 'Test Rock Exercise',
      total_bars: 4,
      tempo: 120,
      key_signature: 'C',
      time_signature: { numerator: 4, denominator: 4 },
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
              techniques: ['slide_up'],
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
          ],
        },
        drums: {
          enabled: true,
          resolution: 480,
          patterns: [
            {
              name: 'main_groove',
              bars: 1,
              events: [
                { tick: 0, drum: 'kick', velocity: 127 },
                { tick: 240, drum: 'hihat', velocity: 80 },
                { tick: 480, drum: 'snare', velocity: 120 },
                { tick: 720, drum: 'hihat', velocity: 80 },
                { tick: 960, drum: 'kick', velocity: 100 },
                { tick: 1200, drum: 'hihat', velocity: 80 },
                { tick: 1440, drum: 'snare', velocity: 120 },
                { tick: 1680, drum: 'hihat', velocity: 80 },
              ],
            },
          ],
          arrangement: [
            'main_groove',
            'main_groove',
            'main_groove',
            'main_groove',
          ],
        },
        harmony: {
          enabled: true,
          progression: [
            { bar: 1, chord: 'C' },
            { bar: 2, chord: 'F' },
            { bar: 3, chord: 'G' },
            { bar: 4, chord: 'C' },
          ],
        },
      },
      mix_settings: {
        levels: {
          bass: 0.8,
          drums: 0.7,
          harmony: 0.6,
        },
        master: 0.8,
      },
    };
  });

  afterEach(() => {
    loader.clearCache();
  });

  describe('Exercise Loading', () => {
    it('should load exercise with correct structure', async () => {
      const result = await loader.loadExercise(mockExerciseData);

      expect(result.data).toEqual(mockExerciseData);
      expect(result.totalTicks).toBe(7680); // 4 bars * 4 beats * 480 ticks
      expect(result.duration).toBe(8000); // 4 bars * 4 beats * 500ms at 120 BPM
      expect(result.scheduledEvents).toBeInstanceOf(Map);
    });

    it('should process bass notes into scheduled events', async () => {
      const result = await loader.loadExercise(mockExerciseData);

      const bassTicks = result.scheduledEvents.get('bass');
      expect(bassTicks).toBeDefined();
      expect(bassTicks).toHaveLength(4); // 4 bass notes
      expect(bassTicks).toEqual([0, 480, 960, 1440]); // Quarter note spacing
    });

    it('should process drum patterns into scheduled events', async () => {
      const result = await loader.loadExercise(mockExerciseData);

      const drumTicks = result.scheduledEvents.get('drums');
      expect(drumTicks).toBeDefined();
      expect(drumTicks!.length).toBeGreaterThan(0);

      // Should have events from all 4 repetitions of the pattern
      const uniqueTicks = new Set(drumTicks);
      expect(uniqueTicks.size).toBeGreaterThan(8); // More than single pattern
    });

    it('should process harmony progression into scheduled events', async () => {
      const result = await loader.loadExercise(mockExerciseData);

      const harmonyTicks = result.scheduledEvents.get('harmony');
      expect(harmonyTicks).toBeDefined();
      expect(harmonyTicks).toEqual([0, 1920, 3840, 5760]); // Bar boundaries
    });

    it('should skip disabled tracks', async () => {
      const exerciseWithDisabledBass = {
        ...mockExerciseData,
        musical_content: {
          ...mockExerciseData.musical_content,
          bass: { ...mockExerciseData.musical_content.bass, enabled: false },
        },
      };

      const result = await loader.loadExercise(exerciseWithDisabledBass);

      expect(result.scheduledEvents.has('bass')).toBe(false);
      expect(result.scheduledEvents.has('drums')).toBe(true);
      expect(result.scheduledEvents.has('harmony')).toBe(true);
    });
  });

  describe('Tempo Independence', () => {
    it('should calculate different durations for different tempos', async () => {
      const result120 = await loader.loadExercise(mockExerciseData, 120);
      const result60 = await loader.loadExercise(mockExerciseData, 60);

      expect(result120.duration).toBe(8000); // 8 seconds at 120 BPM
      expect(result60.duration).toBe(16000); // 16 seconds at 60 BPM

      // Tick events should be the same
      expect(result120.scheduledEvents.get('bass')).toEqual(
        result60.scheduledEvents.get('bass'),
      );
    });

    it('should use user tempo over exercise tempo', async () => {
      const result = await loader.loadExercise(mockExerciseData, 140);

      // Duration should be calculated with 140 BPM, not 120
      expect(result.duration).toBeCloseTo(6857, 0); // 8000 * (120/140)
    });

    it('should handle tempo changes for loaded exercises', async () => {
      await loader.loadExercise(mockExerciseData, 120);

      const result = await loader.changeExerciseTempo(140);

      expect(result).toBeDefined();
      expect(result!.duration).toBeCloseTo(6857, 0);
    });
  });

  describe('Caching System', () => {
    it('should cache loaded exercises', async () => {
      await loader.loadExercise(mockExerciseData, 120);

      const cacheStats = loader.getCacheStats();
      expect(cacheStats.size).toBe(1);
      expect(cacheStats.exercises).toContain(`${mockExerciseData.id}-120`);
    });

    it('should return cached results for same exercise and tempo', async () => {
      const result1 = await loader.loadExercise(mockExerciseData, 120);
      const result2 = await loader.loadExercise(mockExerciseData, 120);

      expect(result1).toBe(result2); // Should be same object reference
    });

    it('should cache different tempo versions separately', async () => {
      await loader.loadExercise(mockExerciseData, 120);
      await loader.loadExercise(mockExerciseData, 140);

      const cacheStats = loader.getCacheStats();
      expect(cacheStats.size).toBe(2);
      expect(cacheStats.exercises).toContain(`${mockExerciseData.id}-120`);
      expect(cacheStats.exercises).toContain(`${mockExerciseData.id}-140`);
    });

    it('should clear cache correctly', async () => {
      await loader.loadExercise(mockExerciseData, 120);

      loader.clearCache();

      const cacheStats = loader.getCacheStats();
      expect(cacheStats.size).toBe(0);
    });
  });

  describe('Widget Registration', () => {
    it('should register widgets correctly', () => {
      loader.registerWidget('bass-widget', 'bass');
      loader.registerWidget('drum-widget', 'drums');

      expect(() => {
        loader.registerWidget('harmony-widget', 'harmony');
      }).not.toThrow();
    });

    it('should unregister widgets correctly', () => {
      loader.registerWidget('test-widget', 'bass');

      expect(() => {
        loader.unregisterWidget('test-widget');
      }).not.toThrow();
    });

    it('should provide scheduled events for registered widget types', async () => {
      loader.registerWidget('bass-widget', 'bass');
      await loader.loadExercise(mockExerciseData);

      const bassTicks = loader.getScheduledEventsForWidget('bass');
      expect(bassTicks).toHaveLength(4);
      expect(bassTicks).toEqual([0, 480, 960, 1440]);
    });

    it('should return empty array for unregistered widget types', async () => {
      await loader.loadExercise(mockExerciseData);

      const unknownTicks = loader.getScheduledEventsForWidget('unknown');
      expect(unknownTicks).toEqual([]);
    });
  });

  describe('Complex Time Signatures', () => {
    it('should handle 3/4 time signature', async () => {
      const threeFourExercise = {
        ...mockExerciseData,
        time_signature: { numerator: 3, denominator: 4 } as TimeSignature,
        musical_content: {
          ...mockExerciseData.musical_content,
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
            ] as BassNote[],
          },
        },
      };

      const result = await loader.loadExercise(threeFourExercise);

      expect(result.totalTicks).toBe(5760); // 4 bars * 3 beats * 480 ticks
      expect(result.duration).toBe(6000); // 4 bars * 3 beats * 500ms at 120 BPM

      const bassTicks = result.scheduledEvents.get('bass');
      expect(bassTicks).toEqual([0, 480, 960]); // 3 beats
    });

    it('should handle 7/8 time signature', async () => {
      const sevenEightExercise = {
        ...mockExerciseData,
        time_signature: { numerator: 7, denominator: 8 } as TimeSignature,
        total_bars: 2,
      };

      const result = await loader.loadExercise(sevenEightExercise);

      // 7/8 time: 7 eighth notes per bar = 7 * 240 ticks = 1680 ticks per bar
      expect(result.totalTicks).toBe(3360); // 2 bars * 1680 ticks
    });
  });

  describe('Multi-Bar Patterns', () => {
    it('should handle multi-bar drum patterns', async () => {
      const multiBarExercise = {
        ...mockExerciseData,
        musical_content: {
          ...mockExerciseData.musical_content,
          drums: {
            enabled: true,
            resolution: 480,
            patterns: [
              {
                name: 'two_bar_pattern',
                bars: 2,
                events: [
                  { tick: 0, drum: 'kick', velocity: 127 },
                  { tick: 1920, drum: 'kick', velocity: 100 }, // Second bar
                  { tick: 3840, drum: 'kick', velocity: 127 }, // Would be third bar
                ],
              },
            ],
            arrangement: ['two_bar_pattern', 'two_bar_pattern'],
          },
        },
      };

      const result = await loader.loadExercise(multiBarExercise);

      const drumTicks = result.scheduledEvents.get('drums');
      expect(drumTicks).toBeDefined();
      expect(drumTicks!.length).toBeGreaterThan(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing exercise data gracefully', async () => {
      const incompleteExercise = {
        ...mockExerciseData,
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
      };

      const result = await loader.loadExercise(incompleteExercise);

      expect(result.scheduledEvents.size).toBe(0);
      expect(result.duration).toBe(8000); // Still calculates total duration
    });

    it('should handle invalid tempo values', async () => {
      const result = await loader.loadExercise(mockExerciseData, -10);

      expect(result.duration).toBeGreaterThan(0); // Should use valid fallback
    });

    it('should handle null current exercise for tempo changes', async () => {
      const result = await loader.changeExerciseTempo(140);

      expect(result).toBeNull();
    });
  });

  describe('Performance Requirements', () => {
    it('should load exercises within performance limits', async () => {
      const startTime = performance.now();

      // Load same exercise multiple times
      for (let i = 0; i < 10; i++) {
        await loader.loadExercise(mockExerciseData, 120 + i);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within 100ms for 10 exercises
      expect(duration).toBeLessThan(100);
    });

    it('should handle large exercises efficiently', async () => {
      const largeExercise = {
        ...mockExerciseData,
        total_bars: 32,
        musical_content: {
          ...mockExerciseData.musical_content,
          bass: {
            enabled: true,
            notes: Array.from({ length: 128 }, (_, i) => ({
              bar: Math.floor(i / 4) + 1,
              beat: (i % 4) + 1,
              subdivision: 0,
              note: 'E2',
              duration: 'quarter',
              string: 4,
              fret: 0,
            })) as BassNote[],
          },
        },
      };

      const startTime = performance.now();
      const result = await loader.loadExercise(largeExercise);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(50);
      expect(result.scheduledEvents.get('bass')).toHaveLength(128);
    });
  });

  describe('Integration with Story 3.15 Components', () => {
    it('should provide data compatible with MusicalTimeEngine', async () => {
      const result = await loader.loadExercise(mockExerciseData);

      // All tick values should be non-negative and within exercise bounds
      result.scheduledEvents.forEach((ticks, widgetType) => {
        ticks.forEach((tick) => {
          expect(tick).toBeGreaterThanOrEqual(0);
          expect(tick).toBeLessThan(result.totalTicks);
        });
      });
    });

    it('should work with PlaybackOrchestrator widget registration', async () => {
      loader.registerWidget('bass-widget', 'bass');
      loader.registerWidget('drum-widget', 'drums');
      loader.registerWidget('harmony-widget', 'harmony');

      const result = await loader.loadExercise(mockExerciseData);

      expect(result.scheduledEvents.has('bass')).toBe(true);
      expect(result.scheduledEvents.has('drums')).toBe(true);
      expect(result.scheduledEvents.has('harmony')).toBe(true);
    });
  });
});
