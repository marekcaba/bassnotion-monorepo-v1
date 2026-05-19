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
import {
  MidiFileParser,
  type ParsedMidiFile,
  type MidiEvent as MidiFileEvent,
} from '../../midi/parser/MidiFileParser.js';
import type {
  MidiEvent,
  BassMidiEvent,
  DrumMidiEvent,
  ExerciseNoteWithDuration,
} from '../../midi/types.js';
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
      const parsedMidiFile: ParsedMidiFile =
        await this.midiParser.parseMidiFile(midiData);

      // Convert MidiFileParser events to MidiEvent format
      // IMPORTANT: each MIDI track has its OWN deltaTime sequence — we must
      // reset currentTime to 0 at the start of every track. The previous
      // code accumulated currentTime across tracks, which was harmless when
      // there was only one track but would put downstream tracks at wildly
      // wrong absolute times.
      const midiEvents: MidiEvent[] = [];
      const ticksPerQuarterNote = parsedMidiFile.header.ticksPerQuarterNote;

      // Track open notes per channel+note so we can compute per-note
      // durations by pairing noteOn → noteOff (or noteOn-with-velocity-0).
      // Without this, every note's `duration` stays undefined and the
      // bass scheduler defaults to 0.5s for every note — making slow
      // passages ring over each other and fast passages overlap.
      type OpenNote = {
        time: number;
        velocity: number;
        eventIndex: number; // index into midiEvents so we can backfill duration
      };

      for (const track of parsedMidiFile.tracks) {
        let currentTime = 0;
        const openNotes = new Map<string, OpenNote>();
        const keyOf = (channel: number, note: number) => `${channel}:${note}`;

        const closeNote = (channel: number, note: number, time: number) => {
          const key = keyOf(channel, note);
          const open = openNotes.get(key);
          if (!open) return;
          const duration = Math.max(0, time - open.time);
          // Backfill duration on the original noteOn event so downstream
          // consumers (ExerciseLoader's region/event mapping, BassScheduler)
          // can read it without a second pass.
          const onEvent = midiEvents[open.eventIndex];
          if (onEvent && onEvent.type === 'noteOn') {
            onEvent.duration = duration;
          }
          openNotes.delete(key);
        };

        for (const event of track.events) {
          // Update current time based on delta time
          currentTime += event.deltaTime / ticksPerQuarterNote;

          // Convert to MidiEvent format
          // MidiFileParser uses 'channelNoteOn' and 'channelNoteOff' event types
          if (event.type === 'channelNoteOn' && event.channel !== undefined) {
            const note = event.data?.[0] || 0;
            const velocity = event.data?.[1] || 127;
            // Note On with velocity 0 is actually Note Off
            if (velocity === 0) {
              closeNote(event.channel, note, currentTime);
              midiEvents.push({
                type: 'noteOff',
                time: currentTime,
                channel: event.channel,
                note,
                velocity: 0,
              } as MidiEvent);
            } else {
              const eventIndex = midiEvents.length;
              midiEvents.push({
                type: 'noteOn',
                time: currentTime,
                channel: event.channel,
                note,
                velocity,
              } as MidiEvent);
              openNotes.set(keyOf(event.channel, note), {
                time: currentTime,
                velocity,
                eventIndex,
              });
            }
          } else if (
            event.type === 'channelNoteOff' &&
            event.channel !== undefined
          ) {
            const note = event.data?.[0] || 0;
            closeNote(event.channel, note, currentTime);
            midiEvents.push({
              type: 'noteOff',
              time: currentTime,
              channel: event.channel,
              note,
              velocity: event.data?.[1] || 0,
            } as MidiEvent);
          }
        }

        // Any notes still open at end-of-track: assume they sustain to
        // the last event time. Better than leaving them undefined and
        // falling back to the 0.5s default.
        if (openNotes.size > 0) {
          logger.warn(
            `MIDI track has ${openNotes.size} unterminated notes — assuming sustain to track end`,
          );
          for (const [, open] of openNotes) {
            const onEvent = midiEvents[open.eventIndex];
            if (onEvent && onEvent.type === 'noteOn') {
              onEvent.duration = Math.max(0, currentTime - open.time);
            }
          }
        }
      }

      const notesWithDuration = midiEvents.filter(
        (e) => e.type === 'noteOn' && e.duration !== undefined,
      ).length;
      const notesWithoutDuration = midiEvents.filter(
        (e) => e.type === 'noteOn' && e.duration === undefined,
      ).length;

      logger.info('MIDI file parsed', {
        trackCount: parsedMidiFile.tracks.length,
        ticksPerQuarterNote: parsedMidiFile.header.ticksPerQuarterNote,
        eventCount: midiEvents.length,
        notesWithDuration,
        notesWithoutDuration,
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
      0: 'metronome', // Channel 1
      1: 'drums', // Channel 2
      2: 'bass', // Channel 3
      3: 'harmony', // Channel 4
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
      logger.warn('Creating region with no events', {
        trackId,
        exerciseTitle: exercise.title,
      });
      return {
        id: `region-${trackId}-${Date.now()}`,
        trackId,
        name: `${exercise.title} - ${trackId}`,
        startPosition: { bars: 0, beats: 0, sixteenths: 0, ticks: 0 },
        duration: { bars: 0, beats: 0, sixteenths: 0, ticks: 0 },
        loopCount: 1,
        muted: false,
        pattern: {
          id: `pattern-${trackId}-${Date.now()}`,
          name: `${exercise.title} - ${trackId} Pattern`,
          type: trackId === 'drums' ? 'drum' : 'midi',
          events: [],
        },
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

    // Convert MIDI events to pattern events format expected by RegionScheduler
    const patternEvents = events.map((e) => {
      // Calculate position as string for Tone.js format: "bars:beats:sixteenths"
      // - bars: 0-based measure number
      // - beats: 0-3 (beat within the measure for 4/4 time)
      // - sixteenths: 0-3 (sixteenth note subdivision within the beat)
      const normalizedTime = e.time - startTime;
      const beatsPerSecond = exercise.bpm / 60;
      const totalBeats = normalizedTime * beatsPerSecond;

      // Use integer math to avoid floating point issues
      // Round to nearest 16th note for precision
      const totalSixteenths = Math.round(totalBeats * 4);
      const beatsPerBar = 4; // Assuming 4/4 time
      const sixteenthsPerBar = beatsPerBar * 4; // 16 sixteenths per bar

      const bars = Math.floor(totalSixteenths / sixteenthsPerBar);
      const sixteenthsInBar = totalSixteenths % sixteenthsPerBar;
      const beats = Math.floor(sixteenthsInBar / 4);
      const sixteenths = sixteenthsInBar % 4;

      // Determine event type based on track type
      // Bass events need type: 'bass' for EventRouter to route to BassScheduler
      // Drum events use normalized drum types (kick, snare, hihat)
      const isBassTrack = trackId.includes('bass');

      if (isBassTrack) {
        // Bass event - EventRouter routes to BassScheduler based on type: 'bass'
        // TEMPO FIX: Calculate durationInBeats for live tempo recalculation
        const bassDurationSeconds = e.duration || 0.5;
        const bassDurationInBeats = bassDurationSeconds * (exercise.bpm / 60);
        // Cast to BassMidiEvent for type-safe access to bass-specific properties
        const bassEvent = e as BassMidiEvent;
        return {
          position: `${bars}:${beats}:${sixteenths}`,
          type: 'bass',
          velocity: (e.velocity || 100) / 127, // Normalize to 0-1
          duration: e.duration ? `${e.duration}s` : '0.5s', // Duration in Tone.js format
          data: {
            midiNote: e.note,
            string: bassEvent.string,
            fret: bassEvent.fret,
            noteName: bassEvent.noteName,
            // TEMPO FIX: Store duration in beats + original BPM for live tempo recalculation
            // This allows SimpleInstrumentScheduler to adjust duration when user changes tempo
            durationInBeats: bassDurationInBeats,
            originalBpm: exercise.bpm,
          },
        };
      } else {
        // Drum event - use drumType for proper scheduling
        // Cast to DrumMidiEvent for type-safe access to drumType
        const drumEvent = e as DrumMidiEvent;
        const drumType =
          drumEvent.drumType || this.getMidiNoteDrumType(e.note || 36);
        const normalizedDrumType = this.normalizeDrumType(drumType);

        return {
          position: `${bars}:${beats}:${sixteenths}`,
          type: normalizedDrumType,
          drum: normalizedDrumType,
          velocity: (e.velocity || 100) / 127, // Normalize to 0-1
          midiNote: e.note,
        };
      }
    });

    // Calculate loopCount for drum patterns based on exercise.total_bars
    // This enables automatic pattern repetition to fill the exercise duration
    let loopCount = 1; // Default: play pattern once
    let patternMeasureCount = 1; // Track pattern length for duration calculation
    const beatsPerBar = exercise.timeSignature?.numerator || 4;

    if (
      trackId === 'drums' &&
      exercise.total_bars &&
      exercise.total_bars > 0 &&
      events.length > 0
    ) {
      // Calculate pattern measure span from event times
      // Find the highest measure number to determine pattern length
      const maxMeasure = events.reduce((max, e) => {
        const normalizedTime = e.time - startTime;
        const beatsPerSecond = exercise.bpm / 60;
        const totalBeats = normalizedTime * beatsPerSecond;
        const measure = Math.floor(totalBeats / beatsPerBar);
        return Math.max(max, measure);
      }, 0);

      patternMeasureCount = maxMeasure + 1; // Convert 0-based to count

      if (patternMeasureCount > 0) {
        loopCount = Math.ceil(exercise.total_bars / patternMeasureCount);
        // eslint-disable-next-line no-console
        console.log(
          `[DRUM LOOPING] 🔄 loopCount=${loopCount} (total_bars=${exercise.total_bars}, patternMeasures=${patternMeasureCount})`,
        );
        logger.info('🔄 Calculated drum pattern loopCount', {
          exerciseTitle: exercise.title,
          exerciseTotalBars: exercise.total_bars,
          patternMeasureCount,
          loopCount,
        });
      }
    }

    // CRITICAL FIX: For drum patterns with looping, use the full pattern length
    // (patternMeasures × beatsPerBar) not the last event time.
    // This ensures loops start at correct bar boundaries, not at the last hit position.
    let regionDuration = length;
    if (trackId === 'drums' && loopCount > 1) {
      // Calculate duration as full bars (patternMeasureCount × beatsPerBar beats)
      const durationInBeats = patternMeasureCount * beatsPerBar;
      regionDuration = {
        bars: patternMeasureCount,
        beats: 0,
        sixteenths: 0,
        ticks: 0,
      };
      // eslint-disable-next-line no-console
      console.log(
        `[DRUM LOOPING] 🔄 Region duration fixed: ${durationInBeats} beats (${patternMeasureCount} bars × ${beatsPerBar} beats/bar)`,
      );
    }

    return {
      id: `region-${trackId}-${Date.now()}`,
      trackId,
      name: `${exercise.title} - ${trackId}`,
      startPosition,
      startTime: 0, // Start at beat 0 - display offset handles countdown timing
      duration: regionDuration, // Use full bar duration for looping patterns
      loopCount, // Pattern repetition count (default 1, calculated for drums)
      muted: false, // Required by RegionModel
      // ✅ FIX: RegionScheduler expects region.pattern.events, not region.events
      pattern: {
        id: `pattern-${trackId}-${Date.now()}`,
        name: `${exercise.title} - ${trackId} Pattern`,
        type: trackId === 'drums' ? 'drum' : 'midi',
        events: patternEvents,
      },
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
      metronome: '#FFA07A', // Orange for metronome
      drums: '#4ECDC4', // Teal for drums
      bass: '#FF6B6B', // Red for bass
      harmony: '#45B7D1', // Blue for harmony
      unknown: '#95A5A6',
    };

    const trackType = trackId.split('-')[0];
    return colors[trackType] || colors.unknown;
  }

  /**
   * Convert MIDI note number to drum type string
   * Uses General MIDI drum mapping
   *
   * IMPORTANT: Buffer keys used by DrumScheduler are simplified:
   * 'kick', 'snare', 'hihat' - so all hi-hat variants map to 'hihat'
   */
  private getMidiNoteDrumType(midiNote: number): string {
    // General MIDI drum mapping - simplified to match buffer keys
    // DrumScheduler only has: kick, snare, hihat buffers
    const drumMap: Record<number, string> = {
      35: 'kick', // Acoustic Bass Drum
      36: 'kick', // Bass Drum 1
      38: 'snare', // Acoustic Snare
      40: 'snare', // Electric Snare
      42: 'hihat', // Closed Hi-Hat -> maps to 'hihat' buffer
      44: 'hihat', // Pedal Hi-Hat -> maps to 'hihat' buffer
      46: 'hihat', // Open Hi-Hat -> maps to 'hihat' buffer
      49: 'kick', // Crash Cymbal 1 -> fallback to kick (no crash buffer yet)
      51: 'hihat', // Ride Cymbal 1 -> fallback to hihat (no ride buffer yet)
      53: 'hihat', // Ride Bell -> fallback to hihat
      41: 'kick', // Low Floor Tom -> fallback to kick (no tom buffer yet)
      43: 'kick', // High Floor Tom -> fallback to kick
      45: 'snare', // Low Tom -> fallback to snare
      47: 'snare', // Low-Mid Tom -> fallback to snare
      48: 'snare', // Hi-Mid Tom -> fallback to snare
      50: 'snare', // High Tom -> fallback to snare
    };

    return drumMap[midiNote] || 'kick'; // Default to kick if unknown
  }

  /**
   * Normalize drum type from DrumPatternEditor to simplified buffer keys
   * DrumScheduler only has: 'kick', 'snare', 'hihat' buffers
   */
  private normalizeDrumType(drumType: string): string {
    // Map various drum type names to the 3 available buffer keys
    const normalizeMap: Record<string, string> = {
      // Kicks
      kick: 'kick',
      bass_drum: 'kick',
      // Snares
      snare: 'snare',
      snare_rimshot: 'snare',
      rimshot: 'snare',
      clap: 'snare',
      // Hi-hats
      hihat: 'hihat',
      hihat_closed: 'hihat',
      hihat_open: 'hihat',
      hihat_pedal: 'hihat',
      // Cymbals -> hihat (no separate buffer)
      crash: 'hihat',
      ride: 'hihat',
      // Toms -> kick or snare based on pitch
      tom_low: 'kick',
      tom_mid: 'snare',
      tom_high: 'snare',
    };

    return normalizeMap[drumType] || 'kick'; // Default to kick if unknown
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
        url: midiUrl,
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
        error,
      });
      throw error;
    }
  }

  /**
   * Load MIDI from URL or raw data directly (without Supabase)
   * Useful when MIDI data is already available in the exercise object
   */
  public async loadMidiDirect(
    exercise: Exercise & {
      midiFileUrl?: string;
      midi_data?: ArrayBuffer;
      midi_file_path?: string;
    },
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
        error,
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
      const midiEvents: MidiEvent[] = drumPattern.map((hit, index) => {
        // Calculate absolute time from musical position
        // DrumPatternEditor uses 0-based indexing for measure and beat
        const beatsPerBar = exercise.timeSignature?.numerator || 4;
        const PPQ = 480; // Pulses per quarter note

        // Use tick-based calculation for precision when available
        // tick: 0-479 represents position within the beat at 480 PPQ
        const tickWithinBeat =
          hit.position.tick ?? hit.position.subdivision * (PPQ / 4);
        const fractionalBeat = tickWithinBeat / PPQ;

        // Total beats from start (0-based measure and beat)
        const totalBeats =
          hit.position.measure * beatsPerBar + // 0-based measure
          hit.position.beat +
          fractionalBeat;
        const timeInSeconds = totalBeats * (60 / exercise.bpm);

        // General MIDI drum channel is 9 (index 9)
        // CRITICAL: Preserve drum type from DrumHit for proper scheduling
        return {
          type: 'noteOn',
          time: timeInSeconds,
          channel: 9, // MIDI drum channel
          note: hit.midiNote,
          velocity: hit.velocity,
          duration: (hit.durationTicks / 480) * (60 / exercise.bpm), // Convert ticks to seconds (480 PPQ)
          drumType: hit.drum, // Preserve drum type (kick, snare_rimshot, hihat_closed, etc.)
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
        timeSignature: exercise.timeSignature || {
          numerator: 4,
          denominator: 4,
        },
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
   * Load from exercise bass notes (ExerciseNote[] from fretboard data)
   *
   * Converts exercise notes to bass regions for playback.
   * Each note has string/fret position which is converted to MIDI note.
   *
   * @param bassNotes - ExerciseNote[] containing fretboard positions
   * @param exercise - Exercise metadata for context
   * @returns LoadResult with session, regions, and MIDI events
   */
  public async loadFromBassNotes(
    bassNotes: import('@bassnotion/contracts').ExerciseNote[],
    exercise: Exercise,
  ): Promise<LoadResult> {
    try {
      logger.info('Loading from bass notes', {
        exerciseId: exercise.id,
        exerciseTitle: exercise.title,
        noteCount: bassNotes.length,
      });

      // Bass string tuning (open string MIDI notes)
      // String numbers are from HIGH to LOW: string 1 = G (highest), string 4 = E (lowest)
      // 4-string bass: E1=28, A1=33, D2=38, G2=43
      // 5-string bass adds: B0=23 (low B, string 5)
      const STRING_TO_OPEN_MIDI: Record<number, number> = {
        1: 43, // G2 (highest string on 4-string)
        2: 38, // D2
        3: 33, // A1
        4: 28, // E1 (lowest string on 4-string)
        5: 23, // B0 (5-string bass low B)
      };

      // Convert ExerciseNote[] to MidiEvent[]
      const midiEvents: MidiEvent[] = bassNotes.map((note) => {
        // Calculate MIDI note from string + fret
        const openStringMidi = STRING_TO_OPEN_MIDI[note.string] || 28; // Default to E string
        const midiNote = openStringMidi + note.fret;

        // Calculate absolute time from musical position
        const beatsPerBar = exercise.timeSignature?.numerator || 4;
        const PPQ = 480; // Pulses per quarter note

        // Use tick for precision (0-479 represents position within the beat at 480 PPQ)
        // If tick is not available, fall back to subdivision (0-3 represents 16th note position)
        const tickWithinBeat =
          note.position?.tick ?? (note.position?.subdivision || 0) * (PPQ / 4);
        const fractionalBeat = tickWithinBeat / PPQ;

        // Total beats from start
        // ExerciseNote position is 0-based: measure 0 = bar 1, beat 0 = first beat
        const totalBeats =
          (note.position?.measure || 0) * beatsPerBar + // 0-based measure
          (note.position?.beat || 0) + // 0-based beat
          fractionalBeat;
        const timeInSeconds = totalBeats * (60 / exercise.bpm);

        // Calculate duration in seconds
        // Support both formats: "quarter-dotted" and "dotted-quarter"
        const durationMap: Record<string, number> = {
          // Standard names
          whole: 4,
          half: 2,
          'half-dotted': 3,
          'dotted-half': 3,
          quarter: 1,
          'quarter-dotted': 1.5,
          'dotted-quarter': 1.5,
          eighth: 0.5,
          'eighth-dotted': 0.75,
          'dotted-eighth': 0.75,
          sixteenth: 0.25,
          '8th-triplet': 1 / 3,
          '16th-triplet': 1 / 6,
        };
        // Also try using durationTicks if available for more precision
        // Cast to ExerciseNoteWithDuration for optional extended properties
        const extendedNote = note as ExerciseNoteWithDuration;
        let durationInBeats = 1;
        if (extendedNote.durationTicks) {
          // durationTicks at 480 PPQ: 480 = quarter note, 960 = half, etc.
          durationInBeats = extendedNote.durationTicks / PPQ;
        } else {
          durationInBeats =
            durationMap[extendedNote.noteDuration || note.duration] || 1;
        }
        const durationInSeconds = durationInBeats * (60 / exercise.bpm);

        return {
          type: 'noteOn',
          time: timeInSeconds,
          channel: 0, // Bass channel
          note: midiNote,
          velocity: 100, // Default velocity
          duration: durationInSeconds,
          // Bass-specific data for BassScheduler lookup
          midiNote,
          string: note.string,
          fret: note.fret,
          noteName: note.note,
          // TEMPO FIX: Store duration in beats + original BPM for live tempo recalculation
          // This allows SimpleInstrumentScheduler to adjust duration when user changes tempo
          durationInBeats,
          originalBpm: exercise.bpm,
        };
      });

      // Create region from events
      const trackId = 'bass-widget-track';
      const region = this.createRegionFromEvents(trackId, midiEvents, exercise);

      // Create track with region
      const track: import('@/domains/playback/models/SessionModel').TrackModel =
        {
          id: trackId,
          name: 'Bass',
          type: 'bass',
          regions: [region],
          muted: false,
          solo: false,
          volume: 0.7,
          pan: 0,
          order: 1,
          color: this.getColorForTrack(trackId),
        };

      // Create session with track
      const session = this.sessionManager.createSession({
        id: `session-${exercise.id}-bass-${Date.now()}`,
        name: exercise.title,
        tempo: exercise.bpm,
        timeSignature: exercise.timeSignature || {
          numerator: 4,
          denominator: 4,
        },
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

      logger.info('Loaded from bass notes successfully', {
        exerciseId: exercise.id,
        midiEventCount: midiEvents.length,
        trackCount: session.tracks.length,
        regionCount: allRegions.length,
      });

      return { session, regions: allRegions, midiEvents };
    } catch (error) {
      logger.error('Failed to load from bass notes', {
        exerciseId: exercise.id,
        exerciseTitle: exercise.title,
        noteCount: bassNotes.length,
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
