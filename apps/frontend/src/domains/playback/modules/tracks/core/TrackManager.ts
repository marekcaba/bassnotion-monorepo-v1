/**
 * TrackManager - Manages collection of tracks and their relationships
 *
 * Responsibilities:
 * - Track lifecycle management (create, delete, reorder)
 * - Track routing and dependencies
 * - Solo/mute management
 * - Track group operations
 * - Track templates
 */

import { Track } from './Track.js';
import type { TrackConfig } from '../../../types/track.js';
import {
  EventBus,
  createStructuredLogger,
  type InstrumentType,
} from '../../shared/index.js';

const logger = createStructuredLogger('TrackManager');

export interface TrackGroup {
  id: string;
  name: string;
  trackIds: string[];
  color: string;
  isCollapsed?: boolean;
}

export interface TrackTemplate {
  id: string;
  name: string;
  description?: string;
  instrumentType: InstrumentType;
  config: Partial<TrackConfig>;
  tags?: string[];
}

export class TrackManager {
  private tracks = new Map<string, Track>();
  private trackOrder: string[] = [];
  private groups = new Map<string, TrackGroup>();
  private templates = new Map<string, TrackTemplate>();
  private soloTracks = new Set<string>();
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.setupEventHandlers();
    this.loadDefaultTemplates();
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Listen for track solo changes
    this.eventBus.on(
      'track:mixingUpdated',
      this.handleTrackMixingUpdate.bind(this),
    );
  }

  /**
   * Load default track templates
   */
  private loadDefaultTemplates(): void {
    const defaultTemplates: TrackTemplate[] = [
      {
        id: 'bass-track',
        name: 'Bass Track',
        description: 'Electric bass with compression and EQ',
        instrumentType: 'bass',
        config: {
          name: 'Bass',
          color: '#3B82F6',
          mixing: {
            volume: 0.75,
            pan: 0,
          },
        },
      },
      {
        id: 'drum-track',
        name: 'Drum Track',
        description: 'Drum kit with reverb send',
        instrumentType: 'drums',
        config: {
          name: 'Drums',
          color: '#EF4444',
          mixing: {
            volume: 0.8,
            pan: 0,
          },
        },
      },
      {
        id: 'harmony-track',
        name: 'Harmony Track',
        description: 'Piano/keyboard with chorus',
        instrumentType: 'chords',
        config: {
          name: 'Keys',
          color: '#10B981',
          mixing: {
            volume: 0.6,
            pan: 0,
          },
        },
      },
    ];

    defaultTemplates.forEach((template) => {
      this.templates.set(template.id, template);
    });
  }

  /**
   * Create a new track
   */
  async createTrack(config: TrackConfig): Promise<Track> {
    const track = new Track(config);

    // Add to collection
    this.tracks.set(track.id, track);
    this.trackOrder.push(track.id);

    // Update indices
    this.updateTrackIndices();

    // Initialize track
    await track.initialize();

    // Emit event
    this.eventBus.emit('trackManager:trackCreated', {
      trackId: track.id,
      instrumentType: track.instrumentType,
    });

    logger.info('Track created', {
      trackId: track.id,
      name: track.name,
      type: track.instrumentType,
    });

    return track;
  }

  /**
   * Create track from template
   */
  async createTrackFromTemplate(templateId: string): Promise<Track> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const config: TrackConfig = {
      ...template.config,
      name: this.generateUniqueTrackName(template.config.name || template.name),
      instrumentType: template.instrumentType,
    };

    return this.createTrack(config);
  }

  /**
   * Delete a track
   */
  async deleteTrack(trackId: string): Promise<void> {
    const track = this.tracks.get(trackId);
    if (!track) {
      throw new Error(`Track not found: ${trackId}`);
    }

    // Dispose track
    await track.dispose();

    // Remove from collections
    this.tracks.delete(trackId);
    this.trackOrder = this.trackOrder.filter((id) => id !== trackId);
    this.soloTracks.delete(trackId);

    // Remove from groups
    this.groups.forEach((group) => {
      group.trackIds = group.trackIds.filter((id) => id !== trackId);
    });

    // Update indices
    this.updateTrackIndices();

    // Emit event
    this.eventBus.emit('trackManager:trackDeleted', {
      trackId,
    });

    logger.info('Track deleted', { trackId });
  }

  /**
   * Get track by ID
   */
  getTrack(trackId: string): Track | undefined {
    return this.tracks.get(trackId);
  }

  /**
   * Get all tracks in order
   */
  getTracks(): Track[] {
    return this.trackOrder
      .map((id) => this.tracks.get(id))
      .filter((track): track is Track => track !== undefined);
  }

  /**
   * Get tracks by instrument type
   */
  getTracksByType(instrumentType: InstrumentType): Track[] {
    return this.getTracks().filter(
      (track) => track.instrumentType === instrumentType,
    );
  }

  /**
   * Reorder tracks
   */
  reorderTracks(trackIds: string[]): void {
    // Validate all track IDs exist
    const validIds = trackIds.filter((id) => this.tracks.has(id));
    if (validIds.length !== trackIds.length) {
      logger.warn('Some track IDs not found during reorder');
    }

    this.trackOrder = validIds;
    this.updateTrackIndices();

    this.eventBus.emit('trackManager:tracksReordered', {
      trackIds: this.trackOrder,
    });
  }

  /**
   * Move track to new position
   */
  moveTrack(trackId: string, newIndex: number): void {
    const currentIndex = this.trackOrder.indexOf(trackId);
    if (currentIndex === -1) {
      throw new Error(`Track not found: ${trackId}`);
    }

    // Remove from current position
    this.trackOrder.splice(currentIndex, 1);

    // Insert at new position
    const targetIndex = Math.max(0, Math.min(newIndex, this.trackOrder.length));
    this.trackOrder.splice(targetIndex, 0, trackId);

    this.updateTrackIndices();

    this.eventBus.emit('trackManager:trackMoved', {
      trackId,
      oldIndex: currentIndex,
      newIndex: targetIndex,
    });
  }

  /**
   * Create track group
   */
  createGroup(name: string, trackIds: string[], color?: string): string {
    const groupId = `group-${Date.now()}`;
    const group: TrackGroup = {
      id: groupId,
      name,
      trackIds: trackIds.filter((id) => this.tracks.has(id)),
      color: color || '#6B7280',
      isCollapsed: false,
    };

    this.groups.set(groupId, group);

    this.eventBus.emit('trackManager:groupCreated', {
      groupId,
      trackIds: group.trackIds,
    });

    return groupId;
  }

  /**
   * Delete track group
   */
  deleteGroup(groupId: string): void {
    if (!this.groups.has(groupId)) {
      throw new Error(`Group not found: ${groupId}`);
    }

    this.groups.delete(groupId);

    this.eventBus.emit('trackManager:groupDeleted', {
      groupId,
    });
  }

  /**
   * Handle solo logic when track mixing is updated
   */
  private handleTrackMixingUpdate(event: any): void {
    const { trackId, oldMixing, newMixing } = event;

    // Handle solo state changes
    if (oldMixing.solo !== newMixing.solo) {
      if (newMixing.solo) {
        this.soloTracks.add(trackId);
      } else {
        this.soloTracks.delete(trackId);
      }

      // Update mute states for all tracks based on solo
      this.updateSoloMuteStates();
    }
  }

  /**
   * Update track mute states based on solo tracks
   */
  private updateSoloMuteStates(): void {
    const hasSoloTracks = this.soloTracks.size > 0;

    this.tracks.forEach((track) => {
      if (hasSoloTracks && !this.soloTracks.has(track.id)) {
        // Implicit mute when other tracks are soloed
        track.updateMixing({ mute: true });
      } else if (!hasSoloTracks && track.mixing.mute) {
        // Restore original mute state when no tracks are soloed
        // This is simplified - in production, we'd track original mute states
      }
    });
  }

  /**
   * Update track indices after reordering
   */
  private updateTrackIndices(): void {
    this.trackOrder.forEach((trackId, index) => {
      const track = this.tracks.get(trackId);
      if (track) {
        track.index = index;
      }
    });
  }

  /**
   * Generate unique track name
   */
  private generateUniqueTrackName(baseName: string): string {
    const existingNames = Array.from(this.tracks.values()).map((t) => t.name);
    let name = baseName;
    let counter = 1;

    while (existingNames.includes(name)) {
      name = `${baseName} ${counter}`;
      counter++;
    }

    return name;
  }

  /**
   * Get track templates
   */
  getTemplates(): TrackTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Add custom template
   */
  addTemplate(template: TrackTemplate): void {
    this.templates.set(template.id, template);

    this.eventBus.emit('trackManager:templateAdded', {
      templateId: template.id,
    });
  }

  /**
   * Remove template
   */
  removeTemplate(templateId: string): void {
    if (!this.templates.has(templateId)) {
      throw new Error(`Template not found: ${templateId}`);
    }

    this.templates.delete(templateId);

    this.eventBus.emit('trackManager:templateRemoved', {
      templateId,
    });
  }

  /**
   * Get track count
   */
  getTrackCount(): number {
    return this.tracks.size;
  }

  /**
   * Get group by ID
   */
  getGroup(groupId: string): TrackGroup | undefined {
    return this.groups.get(groupId);
  }

  /**
   * Get all groups
   */
  getGroups(): TrackGroup[] {
    return Array.from(this.groups.values());
  }

  /**
   * Clear all tracks
   */
  async clear(): Promise<void> {
    // Dispose all tracks
    const disposals = Array.from(this.tracks.values()).map((track) =>
      track.dispose(),
    );
    await Promise.all(disposals);

    // Clear collections
    this.tracks.clear();
    this.trackOrder = [];
    this.groups.clear();
    this.soloTracks.clear();

    this.eventBus.emit('trackManager:cleared');

    logger.info('All tracks cleared');
  }
}
