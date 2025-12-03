/**
 * TrackInstrumentUtils - Track to Instrument Type Mapping
 *
 * Pure utility functions extracted from RegionProcessor to prevent duplication.
 * These helpers determine instrument types from track metadata.
 */

interface Track {
  id?: string;
  name?: string;
  instrumentType?: string;
  regions?: any[];
}

export class TrackInstrumentUtils {
  /**
   * Get instrument type from track
   * Logic extracted from RegionProcessor:1003-1013
   *
   * Priority:
   * 1. Explicit instrumentType property
   * 2. Track name inference
   * 3. Default to 'unknown'
   */
  static getInstrumentType(track: Track): string {
    // Use explicit instrumentType if available
    if (track.instrumentType) {
      return track.instrumentType;
    }

    // Infer from track name
    const name = track.name?.toLowerCase() || '';

    if (name.includes('metronome')) return 'metronome';
    if (name.includes('drum')) return 'drums';
    if (name.includes('bass')) return 'bass';
    if (name.includes('harmony') || name.includes('chord') || name.includes('piano')) {
      return 'harmony';
    }
    if (name.includes('voice') || name.includes('cue')) return 'voice-cue';

    return 'unknown';
  }

  /**
   * Validate harmony track uniqueness
   *
   * Architectural invariant: Only one harmony track allowed per playback session.
   * Multiple harmony tracks would cause CC64 sustain pedal timeline conflicts.
   *
   * @throws Error if multiple harmony tracks detected
   */
  static validateHarmonyTrackUniqueness(tracks: Map<string, Track>): void {
    const harmonyTracks = Array.from(tracks.values()).filter(
      (t) => TrackInstrumentUtils.getInstrumentType(t) === 'harmony',
    );

    if (harmonyTracks.length > 1) {
      throw new Error(
        `Multiple harmony tracks detected (${harmonyTracks.length}). Only one harmony track allowed per playback session.`,
      );
    }
  }
}
