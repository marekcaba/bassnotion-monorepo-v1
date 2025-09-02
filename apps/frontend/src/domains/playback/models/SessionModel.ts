/**
 * SessionModel - Pure data model for DAW session
 *
 * This is completely independent of audio engine and can exist
 * without any audio services initialized. It represents the
 * musical data and structure of a session/project.
 */

import type {
  MusicalPosition,
  TimeSignature,
} from '@bassnotion/contracts/types/musical-time';

// Pure data models - no audio dependencies
export interface SessionModel {
  id: string;
  name: string;
  tempo: number;
  timeSignature: TimeSignature;
  duration: MusicalPosition;
  tracks: TrackModel[];
  metadata?: {
    exerciseId?: string;
    createdAt: Date;
    updatedAt: Date;
    description?: string;
  };
}

export interface TrackModel {
  id: string;
  name: string;
  type: 'bass' | 'drums' | 'metronome' | 'harmony' | 'melody';
  regions: RegionModel[];
  muted: boolean;
  solo: boolean;
  volume: number; // 0-1
  pan: number; // -1 to 1
  color?: string;
  order: number; // Track order in UI
}

export interface RegionModel {
  id: string;
  name: string;
  trackId: string;
  startPosition: MusicalPosition;
  duration: MusicalPosition;
  loopCount: number; // 0 = infinite
  muted: boolean;
  color?: string;

  // Content - one of these
  midiData?: MidiDataModel;
  pattern?: PatternModel;
  audioClip?: AudioClipModel;
}

export interface MidiDataModel {
  events: MidiEventModel[];
  sourceUrl?: string; // Original MIDI file URL in Supabase
  channelInfo?: {
    instrument?: string;
    program?: number;
  };
}

export interface MidiEventModel {
  type: 'noteOn' | 'noteOff' | 'cc' | 'pitchBend' | 'programChange';
  time: MusicalPosition; // Relative to region start
  // Note events
  note?: number; // MIDI note number
  velocity?: number; // 0-127
  duration?: MusicalPosition; // For noteOn events
  // Control events
  controller?: number;
  value?: number;
  // Pitch bend
  bendValue?: number; // -8192 to 8191
}

export interface PatternModel {
  type: 'drum' | 'bass' | 'chord' | 'metronome';
  events: any[]; // Pattern-specific event types
  timeSignature?: TimeSignature;
}

export interface AudioClipModel {
  url: string;
  duration: number; // seconds
  fadeIn?: number;
  fadeOut?: number;
}

/**
 * Session Manager - Manages session data without audio
 */
export class SessionManager {
  private currentSession: SessionModel | null = null;

  /**
   * Create a new session
   */
  createSession(config: Partial<SessionModel>): SessionModel {
    const session: SessionModel = {
      id: this.generateId(),
      name: config.name || 'New Session',
      tempo: config.tempo || 120,
      timeSignature: config.timeSignature || { numerator: 4, denominator: 4 },
      duration: config.duration || '16:0:0', // 16 bars default
      tracks: config.tracks || [],
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        ...config.metadata,
      },
    };

    this.currentSession = session;
    return session;
  }

  /**
   * Load session from exercise data
   */
  async loadFromExercise(exerciseData: any): Promise<SessionModel> {
    const tracks: TrackModel[] = [];

    // Convert exercise tracks to track models
    for (const [index, exerciseTrack] of exerciseData.tracks.entries()) {
      const track: TrackModel = {
        id: this.generateId(),
        name: exerciseTrack.name || exerciseTrack.type,
        type: exerciseTrack.type,
        regions: [],
        muted: false,
        solo: false,
        volume: 0.7,
        pan: 0,
        order: index,
      };

      // Create regions from exercise data
      if (exerciseTrack.midiUrl) {
        // MIDI-based region
        const region: RegionModel = {
          id: this.generateId(),
          name: `${track.type} Region`,
          trackId: track.id,
          startPosition: '0:0:0',
          duration: exerciseData.duration || '4:0:0',
          loopCount: exerciseData.loopCount || 0,
          muted: false,
          midiData: {
            events: [], // Will be populated by MIDI loader
            sourceUrl: exerciseTrack.midiUrl,
          },
        };
        track.regions.push(region);
      } else if (exerciseTrack.pattern) {
        // Pattern-based region
        const region: RegionModel = {
          id: this.generateId(),
          name: `${track.type} Pattern`,
          trackId: track.id,
          startPosition: '0:0:0',
          duration: exerciseData.duration || '4:0:0',
          loopCount: exerciseData.loopCount || 0,
          muted: false,
          pattern: exerciseTrack.pattern,
        };
        track.regions.push(region);
      }

      tracks.push(track);
    }

    return this.createSession({
      name: exerciseData.name,
      tempo: exerciseData.tempo,
      timeSignature: exerciseData.timeSignature,
      duration: exerciseData.duration,
      tracks,
      metadata: {
        exerciseId: exerciseData.id,
      },
    });
  }

  /**
   * Add track to session
   */
  addTrack(track: TrackModel): void {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    track.order = this.currentSession.tracks.length;
    this.currentSession.tracks.push(track);
    this.updateTimestamp();
  }

  /**
   * Add region to track
   */
  addRegion(trackId: string, region: RegionModel): void {
    const track = this.findTrack(trackId);
    if (!track) {
      throw new Error(`Track ${trackId} not found`);
    }

    region.trackId = trackId;
    track.regions.push(region);
    this.updateTimestamp();
  }

  /**
   * Get current session
   */
  getSession(): SessionModel | null {
    return this.currentSession;
  }

  /**
   * Export session for saving
   */
  exportSession(): string {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    return JSON.stringify(this.currentSession, null, 2);
  }

  /**
   * Import session from JSON
   */
  importSession(json: string): SessionModel {
    const session = JSON.parse(json) as SessionModel;
    this.currentSession = session;
    return session;
  }

  private findTrack(trackId: string): TrackModel | undefined {
    return this.currentSession?.tracks.find((t) => t.id === trackId);
  }

  private updateTimestamp(): void {
    if (this.currentSession?.metadata) {
      this.currentSession.metadata.updatedAt = new Date();
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}
