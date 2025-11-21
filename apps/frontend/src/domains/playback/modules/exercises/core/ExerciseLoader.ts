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

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/infrastructure/supabase/client.js';
import type { EventBus } from '../../shared/index.js';
import {
  SessionManager,
  type SessionModel,
  type RegionModel,
} from '../../../models/SessionModel.js';
import type { Exercise } from '@bassnotion/contracts';
import type { MusicalPosition } from '@bassnotion/contracts';
import { createStructuredLogger } from '../../shared/index.js';
import { MidiFileParser, type ParsedMidiFile, type MidiEvent as MidiFileEvent } from '../../midi/parser/MidiFileParser.js';
import type { MidiEvent } from '../../midi/types.js';
import type { Track } from '../../tracks/core/Track.js';

export interface ExerciseLoaderConfig {
  // supabaseUrl and supabaseAnonKey no longer needed - we use the singleton
  autoLoadSamples?: boolean;
  cacheEnabled?: boolean;
  midiBucketName?: string; // Name of the Supabase storage bucket for MIDI files
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
  private midiParser: MidiFileParser;
  private isInitialized = false;
  private loadingCache = new Map<string, Promise<SessionModel>>();

  constructor(private config: ExerciseLoaderConfig = {}) {
    this.sessionManager = new SessionManager();
    this.midiParser = new MidiFileParser();

    // Use the Supabase singleton instead of creating a new client
    // This prevents "Multiple GoTrueClient instances" warning
    this.supabase = supabase;
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
      const parsedMidiFile: ParsedMidiFile = await this.midiParser.parseMidiFile(midiData);

      // Convert MidiFileParser events to MidiEvent format
      const midiEvents: MidiEvent[] = [];
      let currentTime = 0;
      const ticksPerQuarterNote = parsedMidiFile.header.ticksPerQuarterNote;

      for (const track of parsedMidiFile.tracks) {
        for (const event of track.events) {
          // Update current time based on delta time
          currentTime += event.deltaTime / ticksPerQuarterNote;

          // Convert to MidiEvent format
          // MidiFileParser uses 'channelNoteOn' and 'channelNoteOff' event types
          if (event.type === 'channelNoteOn' && event.channel !== undefined) {
            const velocity = event.data?.[1] || 127;
            // Note On with velocity 0 is actually Note Off
            if (velocity === 0) {
              midiEvents.push({
                type: 'noteOff',
                time: currentTime,
                channel: event.channel,
                note: event.data?.[0] || 0,
                velocity: 0,
              } as MidiEvent);
            } else {
              midiEvents.push({
                type: 'noteOn',
                time: currentTime,
                channel: event.channel,
                note: event.data?.[0] || 0,
                velocity,
              } as MidiEvent);
            }
          } else if (event.type === 'channelNoteOff' && event.channel !== undefined) {
            midiEvents.push({
              type: 'noteOff',
              time: currentTime,
              channel: event.channel,
              note: event.data?.[0] || 0,
              velocity: event.data?.[1] || 0,
            } as MidiEvent);
          }
        }
      }

      logger.info('MIDI file parsed', {
        trackCount: parsedMidiFile.tracks.length,
        ticksPerQuarterNote: parsedMidiFile.header.ticksPerQuarterNote,
        eventCount: midiEvents.length,
      });

      return midiEvents;
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

    // Create tracks with regions
    const tracks: import('@/domains/playback/models/SessionModel').TrackModel[] =
      [];

    for (const [trackId, events] of trackMap.entries()) {
      const region = this.createRegionFromEvents(trackId, events, exercise);

      // Create track with region
      const track: import('@/domains/playback/models/SessionModel').TrackModel =
        {
          id: trackId,
          name: trackId,
          type: trackId === 'drums' ? 'drums' : 'bass',
          regions: [region],
          muted: false,
          solo: false,
          volume: 0.7,
          pan: 0,
          order: tracks.length,
          color: this.getColorForTrack(trackId),
        };

      tracks.push(track);
    }

    // Create session with tracks
    const session = this.sessionManager.createSession({
      name: exercise.title,
      tempo: exercise.bpm,
      timeSignature: exercise.timeSignature,
      tracks,
    });

    logger.info('Session created', {
      sessionId: session.id,
      name: session.name,
      trackCount: tracks.length,
      regionCount: tracks.reduce((sum, t) => sum + t.regions.length, 0),
    });

    return session;
  }

  /**
   * Determine track ID for a MIDI event
   */
  private getTrackIdForEvent(event: MidiEvent, exercise: Exercise): string {
    // Map MIDI channels to track types
    // Channel 1 (index 0) = metronome
    // Channel 2 (index 1) = drums
    // Channel 3 (index 2) = bass
    // Channel 4 (index 3) = harmony
    const channelMapping: Record<number, string> = {
      0: 'metronome',  // Channel 1
      1: 'drums',      // Channel 2
      2: 'bass',       // Channel 3
      3: 'harmony',    // Channel 4
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
    // Defensive check for empty events array
    if (!events || events.length === 0) {
      logger.warn('Creating region with no events', { trackId, exerciseTitle: exercise.title });
      return {
        id: `region-${trackId}-${Date.now()}`,
        trackId,
        name: `${exercise.title} - ${trackId}`,
        startPosition: { bars: 0, beats: 0, sixteenths: 0, ticks: 0 },
        length: { bars: 0, beats: 0, sixteenths: 0, ticks: 0 },
        events: [],
        color: this.getColorForTrack(trackId),
      };
    }

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
      startTime: 0, // Start at beat 0 - display offset handles countdown timing
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
      metronome: '#FFA07A',  // Orange for metronome
      drums: '#4ECDC4',      // Teal for drums
      bass: '#FF6B6B',       // Red for bass
      harmony: '#45B7D1',    // Blue for harmony
      unknown: '#95A5A6',
    };

    const trackType = trackId.split('-')[0];
    return colors[trackType] || colors.unknown;
  }

  /**
   * Get Supabase storage URL for a MIDI file
   */
  public getMidiFileUrl(midiFilePath: string): string {
    if (!this.config.supabaseUrl) {
      throw new Error('Supabase URL not configured');
    }

    const bucketName = this.config.midiBucketName || 'midi-files';

    // If the path already includes the bucket name, use it as-is
    if (midiFilePath.includes(bucketName)) {
      return `${this.config.supabaseUrl}/storage/v1/object/public/${midiFilePath}`;
    }

    // Otherwise, construct the full URL
    return `${this.config.supabaseUrl}/storage/v1/object/public/${bucketName}/${midiFilePath}`;
  }

  /**
   * Load MIDI from Supabase storage using exercise's midi_file_path
   */
  public async loadMidiFromSupabase(
    exercise: Exercise & { midi_file_path?: string },
  ): Promise<LoadResult | null> {
    if (!exercise.midi_file_path) {
      logger.info('No MIDI file path in exercise', { exerciseId: exercise.id });
      return null;
    }

    try {
      const midiUrl = this.getMidiFileUrl(exercise.midi_file_path);
      logger.info('Loading MIDI from Supabase', {
        exerciseId: exercise.id,
        path: exercise.midi_file_path,
        url: midiUrl
      });

      const midiData = await this.downloadMidiFile(midiUrl);
      const midiEvents = await this.parseMidiFile(midiData);
      const session = this.createSession(exercise, midiEvents);

      logger.info('MIDI loaded from Supabase successfully', {
        exerciseId: exercise.id,
        eventCount: midiEvents.length,
        regionCount: session.regions.length,
      });

      return {
        session,
        regions: session.regions,
        midiEvents,
      };
    } catch (error) {
      logger.error('Failed to load MIDI from Supabase', {
        exerciseId: exercise.id,
        path: exercise.midi_file_path,
        error
      });
      throw error;
    }
  }

  /**
   * Load MIDI from URL or raw data directly (without Supabase)
   * Useful when MIDI data is already available in the exercise object
   */
  public async loadMidiDirect(
    exercise: Exercise & { midiFileUrl?: string; midi_data?: ArrayBuffer; midi_file_path?: string },
  ): Promise<LoadResult> {
    try {
      let midiData: ArrayBuffer;

      // Get MIDI data from various sources
      if (exercise.midiFileUrl) {
        midiData = await this.downloadMidiFile(exercise.midiFileUrl);
      } else if (exercise.midi_file_path) {
        // Load from Supabase storage
        const midiUrl = this.getMidiFileUrl(exercise.midi_file_path);
        midiData = await this.downloadMidiFile(midiUrl);
      } else if (exercise.midi_data) {
        midiData = exercise.midi_data;
      } else {
        throw new Error('No MIDI data available');
      }

      // Parse MIDI file
      const midiEvents = await this.parseMidiFile(midiData);

      // Create session and regions
      const session = this.createSession(exercise, midiEvents);

      // Extract all regions from all tracks
      const allRegions: RegionModel[] = [];
      for (const track of session.tracks) {
        allRegions.push(...track.regions);
      }

      logger.info('MIDI loaded directly', {
        exerciseId: exercise.id,
        eventCount: midiEvents.length,
        regionCount: allRegions.length,
      });

      return {
        session,
        regions: allRegions,
        midiEvents,
      };
    } catch (error) {
      logger.error('Failed to load MIDI directly', {
        exerciseId: exercise.id,
        exerciseTitle: exercise.title,
        midiFileUrl: exercise.midiFileUrl,
        midi_file_path: exercise.midi_file_path,
        hasMidiData: !!exercise.midi_data,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
        error
      });
      throw error;
    }
  }

  /**
   * Load from pre-converted drum pattern (avoids downloading and parsing MIDI)
   *
   * @param drumPattern - Pre-converted drum hits from the API
   * @param exercise - Exercise metadata for context
   * @returns LoadResult with session, regions, and MIDI events
   */
  public async loadFromDrumPattern(
    drumPattern: import('@bassnotion/contracts').DrumHit[],
    exercise: Exercise,
  ): Promise<LoadResult> {
    try {
      logger.info('Loading from pre-converted drum pattern', {
        exerciseId: exercise.id,
        exerciseTitle: exercise.title,
        hitCount: drumPattern.length,
      });

      // Convert DrumHit[] to MidiEvent[]
      const midiEvents: MidiEvent[] = drumPattern.map((hit) => {
        // Calculate absolute time from musical position
        // CRITICAL FIX: Drum patterns use 1-based measure numbering, convert to 0-based for timing
        const beatsPerBar = exercise.timeSignature?.numerator || 4;
        const totalBeats =
          (hit.position.measure - 1) * beatsPerBar +  // Convert 1-based to 0-based measure
          hit.position.beat +
          hit.position.subdivision / 4;
        const timeInSeconds = (totalBeats / exercise.bpm) * 60;

        // General MIDI drum channel is 9 (index 9)
        return {
          type: 'noteOn',
          time: timeInSeconds,
          channel: 9, // MIDI drum channel
          note: hit.midiNote,
          velocity: hit.velocity,
          duration: (hit.durationTicks / 480) * (60 / exercise.bpm), // Convert ticks to seconds (480 PPQ)
        };
      });

      // Create region from events
      const trackId = 'drums';
      const region = this.createRegionFromEvents(trackId, midiEvents, exercise);

      // Create track with region
      const track: import('@/domains/playback/models/SessionModel').TrackModel =
        {
          id: trackId,
          name: 'Drums',
          type: 'drums',
          regions: [region],
          muted: false,
          solo: false,
          volume: 0.7,
          pan: 0,
          order: 0,
          color: this.getColorForTrack(trackId),
        };

      // Create session with track
      const session = this.sessionManager.createSession({
        id: `session-${exercise.id}-${Date.now()}`,
        name: exercise.title,
        tempo: exercise.bpm,
        timeSignature: exercise.timeSignature || { numerator: 4, denominator: 4 },
        tracks: [track],
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Extract regions from session tracks
      const allRegions: RegionModel[] = [];
      for (const sessionTrack of session.tracks) {
        allRegions.push(...sessionTrack.regions);
      }

      logger.info('Loaded from drum pattern successfully', {
        exerciseId: exercise.id,
        midiEventCount: midiEvents.length,
        trackCount: session.tracks.length,
        regionCount: allRegions.length,
      });

      return { session, regions: allRegions, midiEvents };
    } catch (error) {
      logger.error('Failed to load from drum pattern', {
        exerciseId: exercise.id,
        exerciseTitle: exercise.title,
        patternLength: drumPattern.length,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
        error,
      });
      throw error;
    }
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
