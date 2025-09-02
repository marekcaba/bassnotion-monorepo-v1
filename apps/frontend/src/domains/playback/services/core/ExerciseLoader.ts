/**
 * ExerciseLoader - Production MIDI Pipeline
 *
 * Loads exercise data from Supabase and converts MIDI files
 * into regions that can be loaded into tracks.
 *
 * Pipeline: MIDI File → MidiParserProcessor → MidiEvents → Region → Track → PatternScheduler
 */

import { createClient } from '@supabase/supabase-js';
import {
  Service,
  type ServiceConfig,
  type HealthCheckResult,
} from './ServiceRegistry.js';
import { EventBus } from './EventBus.js';
import {
  MidiParserProcessor,
  type ParsedMidiData,
  type ParsedNote,
} from '../plugins/MidiParserProcessor.js';
import {
  SessionManager,
  type SessionModel,
  type TrackModel,
  type RegionModel,
  type MidiDataModel,
} from '../../models/SessionModel.js';
import type { ExerciseData } from '@bassnotion/contracts/types/exercise';
import type { MusicalPosition } from '@bassnotion/contracts/types/musical-time';
import { getLogger } from '@/utils/logger.js';

export interface ExerciseLoaderConfig {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  autoLoadSamples?: boolean;
  cacheEnabled?: boolean;
}

export class ExerciseLoader implements Service {
  private supabase: any;
  private eventBus: EventBus | null = null;
  private midiParser: MidiParserProcessor;
  private sessionManager: SessionManager;
  private isInitialized = false;
  private loadingCache = new Map<string, Promise<SessionModel>>();

  // Logger
  private logger = getLogger('exercise-loader');

  constructor(private config: ExerciseLoaderConfig = {}) {
    this.midiParser = new MidiParserProcessor();
    this.sessionManager = new SessionManager();

    // Initialize Supabase client if credentials provided
    if (config.supabaseUrl && config.supabaseAnonKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Get EventBus from registry if not already set
    if (!this.eventBus) {
      const { serviceRegistry } = await import('./ServiceRegistry.js');
      const { EventBus } = await import('./EventBus.js');
      this.eventBus = serviceRegistry.get<EventBus>('eventBus');
    }

    // MidiParserProcessor doesn't need initialization
    // It's created in the constructor and ready to use

    this.isInitialized = true;
    this.logger.info('ExerciseLoader initialized');
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('ExerciseLoader not initialized');
    }

    this.logger.info('ExerciseLoader started');
  }

  async stop(): Promise<void> {
    // Clear cache
    this.loadingCache.clear();
    this.logger.info('ExerciseLoader stopped');
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  async dispose(): Promise<void> {
    await this.stop();
    await this.midiParser.dispose();
    this.isInitialized = false;
    this.logger.info('ExerciseLoader disposed');
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return {
      status: this.isInitialized ? 'healthy' : 'unhealthy',
      message: this.isInitialized
        ? 'ExerciseLoader is operating normally'
        : 'ExerciseLoader not initialized',
      details: {
        isInitialized: this.isInitialized,
        cacheSize: this.loadingCache.size,
        hasSupabase: !!this.supabase,
      },
      timestamp: Date.now(),
    };
  }

  getConfig(): ServiceConfig {
    return {
      ...this.config,
      isInitialized: this.isInitialized,
    };
  }

  /**
   * Load exercise from Supabase by ID
   */
  async loadExercise(exerciseId: string): Promise<SessionModel> {
    // Check cache first
    if (this.config.cacheEnabled && this.loadingCache.has(exerciseId)) {
      this.logger.info(`Loading exercise ${exerciseId} from cache`);
      return this.loadingCache.get(exerciseId)!;
    }

    // Create loading promise
    const loadingPromise = this.loadExerciseInternal(exerciseId);

    // Cache the promise
    if (this.config.cacheEnabled) {
      this.loadingCache.set(exerciseId, loadingPromise);
    }

    try {
      const session = await loadingPromise;
      return session;
    } catch (error) {
      // Remove from cache on error
      this.loadingCache.delete(exerciseId);
      throw error;
    }
  }

  /**
   * Internal exercise loading logic
   */
  private async loadExerciseInternal(
    exerciseId: string,
  ): Promise<SessionModel> {
    this.logger.info(`Loading exercise ${exerciseId} from Supabase`);

    // Fetch exercise data from Supabase
    const exerciseData = await this.fetchExerciseData(exerciseId);

    // Create session from exercise data
    const session = await this.sessionManager.loadFromExercise(exerciseData);

    // Process MIDI files for each track
    for (const track of session.tracks) {
      for (const region of track.regions) {
        if (region.midiData?.sourceUrl) {
          await this.loadMidiForRegion(region);
        }
      }
    }

    // Emit event that exercise is loaded
    if (this.eventBus) {
      this.eventBus.emit('exercise:loaded', {
        exerciseId,
        session,
        timestamp: Date.now(),
      });
    }

    this.logger.info(
      `Exercise ${exerciseId} loaded successfully with ${session.tracks.length} tracks`,
    );
    return session;
  }

  /**
   * Fetch exercise data from Supabase
   */
  private async fetchExerciseData(exerciseId: string): Promise<ExerciseData> {
    if (!this.supabase) {
      throw new Error('Supabase client not initialized');
    }

    const { data, error } = await this.supabase
      .from('exercises')
      .select(
        `
        *,
        tracks:exercise_tracks(*)
      `,
      )
      .eq('id', exerciseId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch exercise: ${error.message}`);
    }

    return data;
  }

  /**
   * Load MIDI file and convert to events for a region
   */
  private async loadMidiForRegion(region: RegionModel): Promise<void> {
    if (!region.midiData?.sourceUrl) {
      return;
    }

    this.logger.info(
      `Loading MIDI file for region ${region.id} from ${region.midiData.sourceUrl}`,
    );

    try {
      // Fetch MIDI file
      const midiData = await this.fetchMidiFile(region.midiData.sourceUrl);

      // Parse MIDI file
      // Note: MidiParserProcessor is designed for WebMIDI input, not file parsing
      // For now, we'll use a simple MIDI parser approach
      const parsedMidi = await this.parseMidiFileSimple(midiData);

      // Convert to region events
      const midiEvents = this.convertParsedMidiToEvents(
        parsedMidi,
        region.startPosition,
      );

      // Update region with parsed events
      region.midiData.events = midiEvents;

      this.logger.info(
        `Loaded ${midiEvents.length} MIDI events for region ${region.id}`,
      );
    } catch (error) {
      this.logger.error(`Failed to load MIDI for region ${region.id}:`, error);
      throw error;
    }
  }

  /**
   * Fetch MIDI file from URL (Supabase storage)
   */
  private async fetchMidiFile(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch MIDI file: ${response.statusText}`);
    }
    return response.arrayBuffer();
  }

  /**
   * Simple MIDI file parser for basic note extraction
   * Made public for testing purposes
   */
  async parseMidiFileSimple(data: ArrayBuffer): Promise<any> {
    const view = new DataView(data);
    let offset = 0;

    // Read MThd header
    const headerChunk = this.readString(view, offset, 4);
    if (headerChunk !== 'MThd') {
      throw new Error('Invalid MIDI file: missing MThd header');
    }
    offset += 8; // Skip chunk type and size

    const format = view.getUint16(offset, false);
    const trackCount = view.getUint16(offset + 2, false);
    const ticksPerQuarter = view.getUint16(offset + 4, false);
    offset += 6;

    const tracks: any[] = [];

    // Read tracks
    for (let i = 0; i < trackCount; i++) {
      const trackChunk = this.readString(view, offset, 4);
      if (trackChunk !== 'MTrk') {
        throw new Error('Invalid MIDI file: missing MTrk header');
      }
      offset += 4;

      const trackSize = view.getUint32(offset, false);
      offset += 4;

      const trackEnd = offset + trackSize;
      const events: any[] = [];
      let currentTicks = 0;

      while (offset < trackEnd) {
        // Read delta time
        const deltaResult = this.readVariableLength(view, offset);
        currentTicks += deltaResult.value;
        offset = deltaResult.offset;

        // Read event
        const statusByte = view.getUint8(offset++);

        if ((statusByte & 0xf0) === 0x90 || (statusByte & 0xf0) === 0x80) {
          // Note on/off
          const noteNumber = view.getUint8(offset++);
          const velocity = view.getUint8(offset++);

          events.push({
            type:
              (statusByte & 0xf0) === 0x90 && velocity > 0
                ? 'noteOn'
                : 'noteOff',
            ticks: currentTicks,
            noteNumber,
            velocity,
          });
        } else {
          // Skip other events for now
          if (statusByte === 0xff) {
            // Meta event
            offset++; // Skip meta type
            const lengthResult = this.readVariableLength(view, offset);
            offset = lengthResult.offset + lengthResult.value;
          } else if (
            (statusByte & 0xf0) === 0xc0 ||
            (statusByte & 0xf0) === 0xd0
          ) {
            // Program change or channel pressure - 1 byte
            offset += 1;
          } else {
            // Most other events have 2 bytes of data
            offset += 2;
          }
        }
      }

      tracks.push({ events });
    }

    return { format, ticksPerQuarter, tracks };
  }

  /**
   * Read variable length value from MIDI file
   */
  private readVariableLength(
    view: DataView,
    offset: number,
  ): { value: number; offset: number } {
    let value = 0;
    let byte = 0;

    do {
      byte = view.getUint8(offset++);
      value = (value << 7) | (byte & 0x7f);
    } while (byte & 0x80);

    return { value, offset };
  }

  /**
   * Read string from DataView
   */
  private readString(view: DataView, offset: number, length: number): string {
    let str = '';
    for (let i = 0; i < length; i++) {
      str += String.fromCharCode(view.getUint8(offset + i));
    }
    return str;
  }

  /**
   * Convert parsed MIDI to region events
   */
  private convertParsedMidiToEvents(
    parsedMidi: any,
    startPosition: MusicalPosition,
  ): any[] {
    const events: any[] = [];

    // Extract events from each track
    for (const track of parsedMidi.tracks || []) {
      for (const event of track.events || []) {
        if (event.type === 'noteOn' || event.type === 'noteOff') {
          events.push({
            type: event.type,
            time: this.ticksToMusicalPosition(
              event.ticks,
              parsedMidi.ticksPerQuarter,
            ),
            note: event.noteNumber,
            velocity: event.velocity,
            duration:
              event.type === 'noteOn'
                ? this.calculateNoteDuration(event, track.events)
                : undefined,
          });
        } else if (event.type === 'controlChange') {
          events.push({
            type: 'cc',
            time: this.ticksToMusicalPosition(
              event.ticks,
              parsedMidi.ticksPerQuarter,
            ),
            controller: event.controllerType,
            value: event.value,
          });
        }
      }
    }

    // Sort events by time
    events.sort((a, b) => {
      const aTime = this.musicalPositionToTicks(a.time);
      const bTime = this.musicalPositionToTicks(b.time);
      return aTime - bTime;
    });

    return events;
  }

  /**
   * Convert MIDI ticks to musical position
   */
  private ticksToMusicalPosition(
    ticks: number,
    ticksPerQuarter: number,
  ): MusicalPosition {
    const quarters = ticks / ticksPerQuarter;
    const bars = Math.floor(quarters / 4);
    const beats = Math.floor(quarters % 4);
    const sixteenths = Math.round((quarters % 1) * 4);

    return `${bars}:${beats}:${sixteenths}`;
  }

  /**
   * Convert musical position to ticks (for sorting)
   */
  private musicalPositionToTicks(position: MusicalPosition): number {
    const parts = position.split(':').map(Number);
    const bars = parts[0] || 0;
    const beats = parts[1] || 0;
    const sixteenths = parts[2] || 0;

    return (bars * 4 + beats + sixteenths / 4) * 480; // Assuming 480 ticks per quarter
  }

  /**
   * Calculate note duration from noteOn/noteOff pairs
   */
  private calculateNoteDuration(
    noteOnEvent: any,
    events: any[],
  ): MusicalPosition | undefined {
    // Find corresponding noteOff
    const noteOffIndex = events.findIndex(
      (e, i) =>
        i > events.indexOf(noteOnEvent) &&
        e.type === 'noteOff' &&
        e.noteNumber === noteOnEvent.noteNumber,
    );

    if (noteOffIndex !== -1) {
      const noteOffEvent = events[noteOffIndex];
      const durationTicks = noteOffEvent.ticks - noteOnEvent.ticks;
      return this.ticksToMusicalPosition(durationTicks, 480); // Assuming 480 ticks per quarter
    }

    // Default to quarter note if no noteOff found
    return '0:1:0';
  }

  /**
   * Load exercise and apply to tracks
   */
  async loadExerciseToTracks(
    exerciseId: string,
    trackManager: any,
  ): Promise<void> {
    const session = await this.loadExercise(exerciseId);

    // Apply session to track manager
    for (const trackModel of session.tracks) {
      // Get or create track
      const track =
        trackManager.getTrack(trackModel.id) ||
        (await trackManager.createTrack({
          id: trackModel.id,
          name: trackModel.name,
          type: trackModel.type,
        }));

      // Apply track settings
      track.setVolume(trackModel.volume);
      track.setPan(trackModel.pan);
      track.setMuted(trackModel.muted);
      track.setSolo(trackModel.solo);

      // Clear existing regions
      track.clearRegions();

      // Add new regions
      for (const region of trackModel.regions) {
        track.addRegion(region);
      }
    }

    // Update transport tempo if specified
    if (session.tempo && this.eventBus) {
      this.eventBus.emit('transport:set-tempo', {
        tempo: session.tempo,
      });
    }

    this.logger.info(`Applied exercise ${exerciseId} to track manager`);
  }

  /**
   * Set EventBus for event emission
   */
  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
  }
}
