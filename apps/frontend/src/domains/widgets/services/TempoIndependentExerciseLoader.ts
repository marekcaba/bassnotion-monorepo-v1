/**
 * Tempo-Independent Exercise Loader
 *
 * Handles loading exercises with professional musical time support.
 * Provides tempo-independent exercise loading and real-time tempo changes.
 *
 * Part of Story 3.15: Professional Musical Time System
 * Task 5: Playback Engine Integration
 */

import { MusicalTimeConverter } from '@bassnotion/contracts/services/MusicalTimeConverter';
import { playbackOrchestrator } from './PlaybackOrchestrator';
import { musicalTimeEngine } from '@/domains/playback/services/MusicalTimeEngine';
import type {
  MusicalPosition,
  TimeSignature,
  BassNote,
  DrumPattern,
  HarmonyChange,
} from '@bassnotion/contracts/types/musical-time';

export interface ExerciseData {
  id: string;
  title: string;
  total_bars: number;
  tempo: number;
  key_signature: string;
  time_signature: TimeSignature;
  musical_content: {
    bass: {
      enabled: boolean;
      notes: BassNote[];
    };
    drums: {
      enabled: boolean;
      resolution: number;
      patterns: DrumPattern[];
      arrangement: string[];
    };
    harmony: {
      enabled: boolean;
      progression: HarmonyChange[];
    };
  };
  mix_settings: {
    levels: {
      bass: number;
      drums: number;
      harmony: number;
    };
    master: number;
  };
}

export interface LoadedExercise {
  data: ExerciseData;
  duration: number; // Duration in milliseconds at current tempo
  totalTicks: number; // Total ticks for the exercise
  scheduledEvents: Map<string, number[]>; // widgetType -> tick positions
}

export class TempoIndependentExerciseLoader {
  private static instance: TempoIndependentExerciseLoader | null = null;

  private currentExercise: LoadedExercise | null = null;
  private registeredWidgets: Map<string, string> = new Map(); // widgetId -> widgetType
  private exerciseCache: Map<string, LoadedExercise> = new Map();

  private constructor() {}

  public static getInstance(): TempoIndependentExerciseLoader {
    if (!TempoIndependentExerciseLoader.instance) {
      TempoIndependentExerciseLoader.instance =
        new TempoIndependentExerciseLoader();
    }
    return TempoIndependentExerciseLoader.instance;
  }

  /**
   * Load exercise with tempo-independent processing
   */
  public async loadExercise(
    exerciseData: ExerciseData,
    userTempo?: number,
  ): Promise<LoadedExercise> {
    const cacheKey = `${exerciseData.id}-${userTempo || exerciseData.tempo}`;

    // Check cache first
    if (this.exerciseCache.has(cacheKey)) {
      const cached = this.exerciseCache.get(cacheKey)!;
      this.currentExercise = cached;
      return cached;
    }

    console.log(
      `[TempoIndependentExerciseLoader] Loading exercise: ${exerciseData.title}`,
    );

    // Use user tempo if provided, otherwise use exercise tempo
    const targetTempo = userTempo || exerciseData.tempo;

    // Calculate total duration and ticks
    const totalTicks =
      exerciseData.total_bars * exerciseData.time_signature.numerator * 480;
    const duration = MusicalTimeConverter.tickToMilliseconds(
      totalTicks,
      targetTempo,
    );

    // Process musical content for each widget type
    const scheduledEvents = new Map<string, number[]>();

    // Process bass notes
    if (exerciseData.musical_content.bass.enabled) {
      const bassTicks = this.processBassNotes(
        exerciseData.musical_content.bass.notes,
        exerciseData.time_signature,
      );
      scheduledEvents.set('bass', bassTicks);
    }

    // Process drum patterns
    if (exerciseData.musical_content.drums.enabled) {
      const drumTicks = this.processDrumPatterns(
        exerciseData.musical_content.drums.patterns,
        exerciseData.musical_content.drums.arrangement,
        exerciseData.time_signature,
        exerciseData.total_bars,
      );
      scheduledEvents.set('drums', drumTicks);
    }

    // Process harmony progression
    if (exerciseData.musical_content.harmony.enabled) {
      const harmonyTicks = this.processHarmonyProgression(
        exerciseData.musical_content.harmony.progression,
        exerciseData.time_signature,
      );
      scheduledEvents.set('harmony', harmonyTicks);
    }

    const loadedExercise: LoadedExercise = {
      data: exerciseData,
      duration,
      totalTicks,
      scheduledEvents,
    };

    // Cache the loaded exercise
    this.exerciseCache.set(cacheKey, loadedExercise);
    this.currentExercise = loadedExercise;

    // Update musical time engine with exercise settings
    musicalTimeEngine.setTempo(targetTempo);
    musicalTimeEngine.setTimeSignature(exerciseData.time_signature);

    // Update orchestrator with exercise settings
    playbackOrchestrator.setGlobalTempo(targetTempo);
    playbackOrchestrator.setGlobalTimeSignature(exerciseData.time_signature);

    console.log(
      `[TempoIndependentExerciseLoader] Exercise loaded successfully:`,
      {
        title: exerciseData.title,
        totalBars: exerciseData.total_bars,
        tempo: targetTempo,
        duration: `${(duration / 1000).toFixed(2)}s`,
        totalTicks,
        scheduledEvents: Array.from(scheduledEvents.entries()).map(
          ([type, ticks]) => ({
            type,
            eventCount: ticks.length,
          }),
        ),
      },
    );

    return loadedExercise;
  }

  /**
   * Change tempo of current exercise
   */
  public async changeExerciseTempo(
    newTempo: number,
  ): Promise<LoadedExercise | null> {
    if (!this.currentExercise) {
      console.warn('[TempoIndependentExerciseLoader] No exercise loaded');
      return null;
    }

    // Reload exercise with new tempo
    return await this.loadExercise(this.currentExercise.data, newTempo);
  }

  /**
   * Get current loaded exercise
   */
  public getCurrentExercise(): LoadedExercise | null {
    return this.currentExercise;
  }

  /**
   * Get scheduled events for specific widget type
   */
  public getScheduledEventsForWidget(widgetType: string): number[] {
    if (!this.currentExercise) {
      return [];
    }

    return this.currentExercise.scheduledEvents.get(widgetType) || [];
  }

  /**
   * Register widget for exercise loading
   */
  public registerWidget(widgetId: string, widgetType: string): void {
    this.registeredWidgets.set(widgetId, widgetType);
    console.log(
      `[TempoIndependentExerciseLoader] Widget registered: ${widgetId} (${widgetType})`,
    );
  }

  /**
   * Unregister widget
   */
  public unregisterWidget(widgetId: string): void {
    this.registeredWidgets.delete(widgetId);
    console.log(
      `[TempoIndependentExerciseLoader] Widget unregistered: ${widgetId}`,
    );
  }

  /**
   * Clear exercise cache
   */
  public clearCache(): void {
    this.exerciseCache.clear();
    console.log('[TempoIndependentExerciseLoader] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; exercises: string[] } {
    return {
      size: this.exerciseCache.size,
      exercises: Array.from(this.exerciseCache.keys()),
    };
  }

  // Private methods for processing musical content

  private processBassNotes(
    notes: BassNote[],
    timeSignature: TimeSignature,
  ): number[] {
    const ticks: number[] = [];

    notes.forEach((note) => {
      const tick = MusicalTimeConverter.musicalPositionToTick(
        {
          measure: note.measure,
          beat: note.beat,
          subdivision: note.subdivision,
        },
        timeSignature,
      );
      ticks.push(tick);
    });

    return ticks.sort((a, b) => a - b);
  }

  private processDrumPatterns(
    patterns: DrumPattern[],
    arrangement: string[],
    timeSignature: TimeSignature,
    totalBars: number,
  ): number[] {
    const ticks: number[] = [];
    const ticksPerBar = timeSignature.numerator * 480;

    let currentBar = 0;

    // Process arrangement
    arrangement.forEach((patternName) => {
      const pattern = patterns.find((p) => p.name === patternName);
      if (!pattern) return;

      // Add events from this pattern
      pattern.events.forEach((event: any) => {
        const absoluteTick = currentBar * ticksPerBar + event.tick;
        ticks.push(absoluteTick);
      });

      currentBar += pattern.bars;
    });

    return ticks.sort((a, b) => a - b);
  }

  private processHarmonyProgression(
    progression: HarmonyChange[],
    timeSignature: TimeSignature,
  ): number[] {
    const ticks: number[] = [];

    progression.forEach((change) => {
      const tick = MusicalTimeConverter.musicalPositionToTick(
        { measure: change.measure, beat: 1, subdivision: 0 },
        timeSignature,
      );
      ticks.push(tick);
    });

    return ticks.sort((a, b) => a - b);
  }
}

// Singleton export
export const tempoIndependentExerciseLoader =
  TempoIndependentExerciseLoader.getInstance();
