/**
 * Track Repository Store
 *
 * Zustand store for track repository state management
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { TrackId } from '../value-objects/index.js';
import { TrackEntity } from '../entities/index.js';
import { createTrackRepository } from './index.js';
import type { InstrumentType } from '../../services/plugins/TrackManagerProcessor.js';

export interface TrackRepositoryState {
  // State
  tracks: TrackEntity[];
  selectedTrackId: TrackId | null;
  soloedTrackIds: TrackId[];
  isLoading: boolean;
  error: Error | null;

  // Repository instance
  repository: ReturnType<typeof createTrackRepository>;

  // Actions
  loadTracks: () => Promise<void>;
  createTrack: (
    name: string,
    instrumentType: InstrumentType,
    color?: string,
  ) => Promise<TrackEntity>;
  updateTrack: (track: TrackEntity) => Promise<void>;
  deleteTrack: (id: TrackId) => Promise<void>;
  deleteAllTracks: () => Promise<void>;

  // Selection
  selectTrack: (id: TrackId | null) => void;
  getSelectedTrack: () => TrackEntity | null;

  // Solo management
  toggleSolo: (id: TrackId) => void;
  clearAllSolo: () => void;

  // Track queries
  findTrackById: (id: TrackId) => TrackEntity | null;
  findTracksByType: (type: InstrumentType) => TrackEntity[];
  getTrackCount: () => number;

  // Mute management
  muteTrack: (id: TrackId, muted: boolean) => Promise<void>;
  toggleMute: (id: TrackId) => Promise<void>;

  // Volume and pan
  setTrackVolume: (id: TrackId, volume: number) => Promise<void>;
  setTrackPan: (id: TrackId, pan: number) => Promise<void>;

  // Track ordering
  reorderTracks: (fromIndex: number, toIndex: number) => Promise<void>;

  // Utility
  clearError: () => void;
  refreshCache: () => void;
}

export const useTrackRepositoryStore = create<TrackRepositoryState>()(
  devtools(
    (set, get) => ({
      // Initial state
      tracks: [],
      selectedTrackId: null,
      soloedTrackIds: [],
      isLoading: false,
      error: null,
      repository: createTrackRepository(),

      // Load all tracks
      loadTracks: async () => {
        set({ isLoading: true, error: null });
        try {
          const tracks = await get().repository.findAll();
          set({ tracks, isLoading: false });
        } catch (error) {
          set({ error: error as Error, isLoading: false });
        }
      },

      // Create a new track
      createTrack: async (
        name: string,
        instrumentType: InstrumentType,
        color?: string,
      ) => {
        const { tracks, repository } = get();
        const nextIndex = Math.max(0, ...tracks.map((t) => t.index)) + 1;

        const track = TrackEntity.create(
          TrackId.generate(),
          name,
          instrumentType,
          nextIndex,
          color,
        );

        try {
          await repository.save(track);
          set({ tracks: [...tracks, track] });
          return track;
        } catch (error) {
          set({ error: error as Error });
          throw error;
        }
      },

      // Update a track
      updateTrack: async (track: TrackEntity) => {
        const { tracks, repository } = get();

        try {
          await repository.save(track);
          set({
            tracks: tracks.map((t) => (t.id.equals(track.id) ? track : t)),
          });
        } catch (error) {
          set({ error: error as Error });
          throw error;
        }
      },

      // Delete a track
      deleteTrack: async (id: TrackId) => {
        const { tracks, repository, selectedTrackId } = get();

        try {
          await repository.delete(id);
          set({
            tracks: tracks.filter((t) => !t.id.equals(id)),
            selectedTrackId: selectedTrackId?.equals(id)
              ? null
              : selectedTrackId,
            soloedTrackIds: get().soloedTrackIds.filter(
              (sid) => !sid.equals(id),
            ),
          });
        } catch (error) {
          set({ error: error as Error });
          throw error;
        }
      },

      // Delete all tracks
      deleteAllTracks: async () => {
        const { repository } = get();

        try {
          await repository.deleteAll();
          set({
            tracks: [],
            selectedTrackId: null,
            soloedTrackIds: [],
          });
        } catch (error) {
          set({ error: error as Error });
          throw error;
        }
      },

      // Select a track
      selectTrack: (id: TrackId | null) => {
        set({ selectedTrackId: id });
      },

      // Get selected track
      getSelectedTrack: () => {
        const { tracks, selectedTrackId } = get();
        if (!selectedTrackId) return null;
        return tracks.find((t) => t.id.equals(selectedTrackId)) || null;
      },

      // Toggle solo
      toggleSolo: (id: TrackId) => {
        const { soloedTrackIds } = get();
        const isSoloed = soloedTrackIds.some((sid) => sid.equals(id));

        if (isSoloed) {
          set({
            soloedTrackIds: soloedTrackIds.filter((sid) => !sid.equals(id)),
          });
        } else {
          set({ soloedTrackIds: [...soloedTrackIds, id] });
        }
      },

      // Clear all solo
      clearAllSolo: () => {
        set({ soloedTrackIds: [] });
      },

      // Find track by ID
      findTrackById: (id: TrackId) => {
        const { tracks } = get();
        return tracks.find((t) => t.id.equals(id)) || null;
      },

      // Find tracks by type
      findTracksByType: (type: InstrumentType) => {
        const { tracks } = get();
        return tracks.filter((t) => t.instrumentType === type);
      },

      // Get track count
      getTrackCount: () => {
        return get().tracks.length;
      },

      // Mute track
      muteTrack: async (id: TrackId, muted: boolean) => {
        const track = get().findTrackById(id);
        if (!track) throw new Error(`Track ${id.value} not found`);

        track.setMuted(muted);
        await get().updateTrack(track);
      },

      // Toggle mute
      toggleMute: async (id: TrackId) => {
        const track = get().findTrackById(id);
        if (!track) throw new Error(`Track ${id.value} not found`);

        track.toggleMute();
        await get().updateTrack(track);
      },

      // Set track volume
      setTrackVolume: async (id: TrackId, volume: number) => {
        const track = get().findTrackById(id);
        if (!track) throw new Error(`Track ${id.value} not found`);

        const { Volume } = await import('../value-objects/index.js');
        track.setVolume(Volume.create(volume));
        await get().updateTrack(track);
      },

      // Set track pan
      setTrackPan: async (id: TrackId, pan: number) => {
        const track = get().findTrackById(id);
        if (!track) throw new Error(`Track ${id.value} not found`);

        const { Pan } = await import('../value-objects/index.js');
        track.setPan(Pan.create(pan));
        await get().updateTrack(track);
      },

      // Reorder tracks
      reorderTracks: async (fromIndex: number, toIndex: number) => {
        const { tracks } = get();
        const reordered = [...tracks];
        const [moved] = reordered.splice(fromIndex, 1);

        // Check if move was successful
        if (!moved) {
          throw new Error('Invalid track index');
        }

        reordered.splice(toIndex, 0, moved);

        // Update indices
        const updated = reordered.map((track, index) => {
          if (track.index !== index) {
            track.setIndex(index);
            return track;
          }
          return track;
        });

        // Save all updated tracks
        const { repository } = get();
        try {
          await Promise.all(updated.map((t) => repository.save(t)));
          set({ tracks: updated });
        } catch (error) {
          set({ error: error as Error });
          throw error;
        }
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },

      // Refresh cache
      refreshCache: () => {
        const { repository } = get();
        if (
          'clearCache' in repository &&
          typeof repository.clearCache === 'function'
        ) {
          repository.clearCache();
        }
        // Reload tracks
        get().loadTracks();
      },
    }),
    {
      name: 'track-repository',
    },
  ),
);
