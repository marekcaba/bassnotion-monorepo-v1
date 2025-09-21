/**
 * Track Integration Example
 *
 * Shows how to integrate the Track Repository with the existing Track module
 */

import { Track } from '../../modules/tracks/core/Track.js';
import { TrackEntity, TrackId, Volume, Pan } from '../index.js';
import { useTrackRepositoryStore } from '../track/index.js';
import type { TrackState } from '../../types/track.js';
import { createStructuredLogger } from '../../modules/shared/index.js';

const logger = createStructuredLogger('TrackIntegrationExample');

/**
 * Adapter to bridge between the existing Track class and TrackEntity
 */
export class TrackEntityAdapter {
  /**
   * Convert a Track instance to TrackEntity for persistence
   */
  static fromTrack(track: Track): TrackEntity {
    // Map track state to entity state
    const state = track.state as TrackState;

    // Create entity from track data
    const entity = TrackEntity.reconstitute(
      {
        id: TrackId.create(track.id),
        name: track.name,
        instrumentType: track.instrumentType,
        volume: Volume.create(track.mixing.volume),
        pan: Pan.create(track.mixing.pan),
        isMuted: track.mixing.mute,
        isSolo: track.mixing.solo,
        isRecordArmed: track.mixing.recordArm,
        color: track.color,
        index: track.index,
        createdAt: new Date(track.metadata.createdAt),
        updatedAt: new Date(track.metadata.modifiedAt),
      },
      state,
    );

    return entity;
  }

  /**
   * Apply TrackEntity state to an existing Track instance
   */
  static applyToTrack(entity: TrackEntity, track: Track): void {
    // Update track properties from entity
    track.name = entity.name;
    track.color = entity.color;
    track.index = entity.index;

    // Update mixing state
    track.updateMixing({
      volume: entity.volume.value,
      pan: entity.pan.value,
      mute: entity.isMuted,
      solo: entity.isSolo,
      recordArm: entity.isRecordArmed,
    });

    // Update state
    track.state = entity.state;
  }

  /**
   * Create a new Track instance from TrackEntity
   */
  static toTrack(entity: TrackEntity): Track {
    const track = new Track({
      id: entity.id.value,
      name: entity.name,
      instrumentType: entity.instrumentType,
      color: entity.color,
      index: entity.index,
      mixing: {
        volume: entity.volume.value,
        pan: entity.pan.value,
        mute: entity.isMuted,
        solo: entity.isSolo,
        recordArm: entity.isRecordArmed,
      },
    });

    // Set the state
    track.state = entity.state;

    return track;
  }
}

/**
 * Example: Using the Track Repository in a component
 */
export function TrackManagerExample() {
  const { tracks, createTrack, updateTrack } = useTrackRepositoryStore();

  // Create a new track
  const handleCreateTrack = async () => {
    const entity = await createTrack('New Bass Track', 'bass');
    logger.info('Created track', {
      trackId: entity.id.value,
      name: entity.name,
    });

    // Convert to Track instance if needed by the audio system
    const track = TrackEntityAdapter.toTrack(entity);
    // Initialize track with audio engine here
    void track; // Mark as used
    // ... initialize track with audio engine
  };

  // Update track volume
  const handleUpdateVolume = async (trackId: string, volume: number) => {
    const entity = tracks.find((t) => t.id.value === trackId);
    if (!entity) return;

    entity.setVolume(Volume.create(volume));
    await updateTrack(entity);
  };

  // Persist existing Track instance
  const persistTrack = async (track: Track) => {
    const entity = TrackEntityAdapter.fromTrack(track);
    await updateTrack(entity);
  };

  return {
    tracks,
    handleCreateTrack,
    handleUpdateVolume,
    persistTrack,
  };
}

/**
 * Example: Integrating with ServiceRegistry
 */
export async function initializeWithRepositories() {
  // Register repositories with ServiceRegistry
  const { registerPlaybackRepositories } = await import('../index.js');
  await registerPlaybackRepositories();

  // Get repository from service registry
  const { getTrackRepository } = await import('../index.js');
  const trackRepo = getTrackRepository();

  // Load all tracks on startup
  const tracks = await trackRepo.findAll();

  // Convert to Track instances for audio engine
  const audioTracks = tracks.map((entity: TrackEntity) =>
    TrackEntityAdapter.toTrack(entity),
  );

  return audioTracks;
}

/**
 * Example: Auto-save tracks on changes
 */
export class TrackPersistenceManager {
  private saveTimeout: NodeJS.Timeout | null = null;
  private pendingSaves = new Map<string, TrackEntity>();

  constructor(
    private repository = useTrackRepositoryStore.getState().repository,
  ) {}

  /**
   * Schedule a track save (debounced)
   */
  scheduleTrackSave(track: Track): void {
    const entity = TrackEntityAdapter.fromTrack(track);
    this.pendingSaves.set(track.id, entity);

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => this.savePendingTracks(), 1000);
  }

  /**
   * Save all pending tracks
   */
  private async savePendingTracks(): Promise<void> {
    const tracks = Array.from(this.pendingSaves.values());
    this.pendingSaves.clear();

    for (const track of tracks) {
      try {
        await this.repository.save(track);
      } catch (error) {
        logger.error('Failed to save track', error as Error, {
          trackId: track.id.value,
        });
      }
    }
  }
}
