/**
 * ExerciseLoader - Production MIDI Pipeline
 *
 * Loads exercise data from Supabase and converts MIDI files
 * into regions that can be loaded into tracks.
 *
 * Pipeline: MIDI File → MidiParserProcessor → MidiEvents → Region → Track
 *
 * Extracted from services/core with all functionality preserved.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { EventBus } from '../../shared/index.js';
import {
  SessionManager,
  type SessionModel,
  type RegionModel,
} from '../../../models/SessionModel.js';
import type { Exercise } from '@bassnotion/contracts';
import type { MusicalPosition } from '@bassnotion/contracts';
import { createStructuredLogger } from '../../shared/index.js';
import { MidiParserProcessor } from '../../midi/MidiParserProcessor.js';
import type { MidiEvent } from '../../midi/types.js';
import type { Track } from '../../tracks/core/Track.js';

export interface ExerciseLoaderConfig {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  autoLoadSamples?: boolean;
  cacheEnabled?: boolean;
}

export interface LoadResult {
  session: SessionModel;
  regions: RegionModel[];
  midiEvents: MidiEvent[];
}

const logger = createStructuredLogger('ExerciseLoader');

export class ExerciseLoader {
  private static instance: ExerciseLoader | null = null;

  private supabase: SupabaseClient | null = null;
  private eventBus: EventBus | null = null;
  private sessionManager: SessionManager;
  private midiParser: MidiParserProcessor;
  private isInitialized = false;
  private loadingCache = new Map<string, Promise<SessionModel>>();

  constructor(private config: ExerciseLoaderConfig = {}) {
    this.sessionManager = new SessionManager();
    this.midiParser = new MidiParserProcessor();

    // Initialize Supabase client if credentials provided
    if (config.supabaseUrl && config.supabaseAnonKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
    }
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: ExerciseLoaderConfig): ExerciseLoader {
    if (!ExerciseLoader.instance) {
      ExerciseLoader.instance = new ExerciseLoader(config);
    }
    return ExerciseLoader.instance;
  }

  /**
   * Initialize with dependencies
   */
  public async initialize(eventBus?: EventBus): Promise<void> {
    if (this.isInitialized) return;

    if (eventBus) {
      this.eventBus = eventBus;
    }

    this.isInitialized = true;
    logger.info('ExerciseLoader initialized');
  }

  /**
   * Load exercise from database or URL
   */
  public async loadExercise(exerciseId: string): Promise<LoadResult> {
    // Check cache first
    if (this.config.cacheEnabled && this.loadingCache.has(exerciseId)) {
      const session = await this.loadingCache.get(exerciseId)!;
      return {
        session,
        regions: session.regions,
        midiEvents: [],
      };
    }

    // Create loading promise
    const loadingPromise = this.performLoad(exerciseId);

    if (this.config.cacheEnabled) {
      this.loadingCache.set(
        exerciseId,
        loadingPromise.then((r) => r.session),
      );
    }

    try {
      const result = await loadingPromise;

      // Emit success event
      this.eventBus?.emit('exercise:loaded', {
        exerciseId,
        sessionId: result.session.id,
        regionCount: result.regions.length,
      });

      return result;
    } catch (error) {
      // Remove from cache on error
      this.loadingCache.delete(exerciseId);

      // Emit error event
      this.eventBus?.emit('exercise:loadError', {
        exerciseId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Perform the actual loading
   */
  private async performLoad(exerciseId: string): Promise<LoadResult> {
    // 1. Fetch exercise data
    const exercise = await this.fetchExercise(exerciseId);

    // 2. Download MIDI file
    const midiData = await this.downloadMidiFile(exercise.midiFileUrl);

    // 3. Parse MIDI file
    const midiEvents = await this.parseMidiFile(midiData);

    // 4. Create session and regions
    const session = this.createSession(exercise, midiEvents);

    return {
      session,
      regions: session.regions,
      midiEvents,
    };
  }

  /**
   * Fetch exercise from database
   */
  private async fetchExercise(exerciseId: string): Promise<Exercise> {
    if (!this.supabase) {
      throw new Error('Supabase client not initialized');
    }

    logger.info('Fetching exercise', { exerciseId });

    const { data, error } = await this.supabase
      .from('exercises')
      .select('*')
      .eq('id', exerciseId)
      .single();

    if (error || !data) {
      throw new Error(
        `Failed to fetch exercise: ${error?.message || 'Not found'}`,
      );
    }

    return data as Exercise;
  }

  /**
   * Download MIDI file
   */
  private async downloadMidiFile(url: string): Promise<ArrayBuffer> {
    logger.info('Downloading MIDI file', { url });

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.arrayBuffer();
    } catch (error) {
      logger.error('Failed to download MIDI file', { url, error });
      throw new Error(
        `Failed to download MIDI file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Parse MIDI file
   */
  private async parseMidiFile(midiData: ArrayBuffer): Promise<MidiEvent[]> {
    try {
      const result = await this.midiParser.process({
        file: new Blob([midiData]),
        options: {
          quantize: true,
          detectTempo: true,
          detectTimeSignature: true,
        },
      });

      logger.info('MIDI file parsed', {
        eventCount: result.events.length,
        tempo: result.metadata?.tempo,
        timeSignature: result.metadata?.timeSignature,
      });

      return result.events;
    } catch (error) {
      logger.error('Failed to parse MIDI file', { error });
      throw new Error(
        `Failed to parse MIDI file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Create session from exercise and MIDI events
   */
  private createSession(
    exercise: Exercise,
    midiEvents: MidiEvent[],
  ): SessionModel {
    // Group events by track
    const trackMap = new Map<string, MidiEvent[]>();

    for (const event of midiEvents) {
      const trackId = this.getTrackIdForEvent(event, exercise);
      if (!trackMap.has(trackId)) {
        trackMap.set(trackId, []);
      }
      trackMap.get(trackId)!.push(event);
    }

    // Create regions for each track
    const regions: RegionModel[] = [];

    for (const [trackId, events] of trackMap.entries()) {
      const region = this.createRegionFromEvents(trackId, events, exercise);
      regions.push(region);
    }

    // Create session
    const session = this.sessionManager.createSession({
      name: exercise.title,
      tempo: exercise.bpm,
      timeSignature: exercise.timeSignature,
      regions,
    });

    logger.info('Session created', {
      sessionId: session.id,
      name: session.name,
      regionCount: regions.length,
    });

    return session;
  }

  /**
   * Determine track ID for a MIDI event
   */
  private getTrackIdForEvent(event: MidiEvent, exercise: Exercise): string {
    // Map MIDI channels to track types
    const channelMapping: Record<number, string> = {
      0: 'bass',
      1: 'drums',
      2: 'harmony',
      3: 'metronome',
    };

    const trackType = channelMapping[event.channel] || 'unknown';
    return `${trackType}-${event.channel}`;
  }

  /**
   * Create region from MIDI events
   */
  private createRegionFromEvents(
    trackId: string,
    events: MidiEvent[],
    exercise: Exercise,
  ): RegionModel {
    // Find start and end times
    let startTime = Infinity;
    let endTime = 0;

    for (const event of events) {
      if (event.time < startTime) startTime = event.time;
      if (event.time + (event.duration || 0) > endTime) {
        endTime = event.time + (event.duration || 0);
      }
    }

    // Convert to musical position
    const startPosition = this.timeToMusicalPosition(startTime, exercise.bpm);
    const length = this.timeToMusicalPosition(
      endTime - startTime,
      exercise.bpm,
    );

    return {
      id: `region-${trackId}-${Date.now()}`,
      trackId,
      name: `${exercise.title} - ${trackId}`,
      startPosition,
      length,
      events: events.map((e) => ({
        ...e,
        time: e.time - startTime, // Normalize to region start
      })),
      color: this.getColorForTrack(trackId),
    };
  }

  /**
   * Convert time in seconds to musical position
   */
  private timeToMusicalPosition(
    timeInSeconds: number,
    bpm: number,
  ): MusicalPosition {
    const beatsPerSecond = bpm / 60;
    const totalBeats = timeInSeconds * beatsPerSecond;

    const bars = Math.floor(totalBeats / 4); // Assuming 4/4 time
    const beats = Math.floor(totalBeats % 4);
    const sixteenths = Math.floor(((totalBeats % 1) * 4) % 4);

    return {
      bars,
      beats,
      sixteenths,
      ticks: 0, // Can be calculated more precisely if needed
    };
  }

  /**
   * Get color for track type
   */
  private getColorForTrack(trackId: string): string {
    const colors: Record<string, string> = {
      bass: '#FF6B6B',
      drums: '#4ECDC4',
      harmony: '#45B7D1',
      metronome: '#FFA07A',
      unknown: '#95A5A6',
    };

    const trackType = trackId.split('-')[0];
    return colors[trackType] || colors.unknown;
  }

  /**
   * Load exercise into tracks
   */
  public async loadExerciseIntoTracks(
    exerciseId: string,
    tracks: Map<string, Track>,
  ): Promise<void> {
    const { session, regions } = await this.loadExercise(exerciseId);

    // Clear existing regions
    for (const track of tracks.values()) {
      track.clearRegions();
    }

    // Add regions to tracks
    for (const region of regions) {
      const track = tracks.get(region.trackId);
      if (track) {
        track.addRegion(region);
        logger.info('Region added to track', {
          trackId: region.trackId,
          regionId: region.id,
        });
      } else {
        logger.warn('Track not found for region', {
          trackId: region.trackId,
          regionId: region.id,
        });
      }
    }

    // Emit completion event
    this.eventBus?.emit('exercise:loadedIntoTracks', {
      exerciseId,
      sessionId: session.id,
      trackCount: tracks.size,
      regionCount: regions.length,
    });
  }

  /**
   * Preload exercise (download and cache without loading into tracks)
   */
  public async preloadExercise(exerciseId: string): Promise<void> {
    if (this.loadingCache.has(exerciseId)) {
      return; // Already loading or loaded
    }

    try {
      await this.loadExercise(exerciseId);
      logger.info('Exercise preloaded', { exerciseId });
    } catch (error) {
      logger.error('Failed to preload exercise', { exerciseId, error });
      throw error;
    }
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.loadingCache.clear();
    logger.info('Exercise cache cleared');
  }

  /**
   * Get cache size
   */
  public getCacheSize(): number {
    return this.loadingCache.size;
  }

  /**
   * Check if exercise is cached
   */
  public isExerciseCached(exerciseId: string): boolean {
    return this.loadingCache.has(exerciseId);
  }

  /**
   * Destroy the loader
   */
  public destroy(): void {
    this.clearCache();
    this.isInitialized = false;
    ExerciseLoader.instance = null;
    logger.info('ExerciseLoader destroyed');
  }
}
