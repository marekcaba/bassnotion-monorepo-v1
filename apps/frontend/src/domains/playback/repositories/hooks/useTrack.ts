/**
 * React Hook for Track Repository
 *
 * Provides convenient access to track data and operations
 */

import { useEffect } from 'react';
import { useTrackRepositoryStore } from '../track/index.js';
import { TrackId } from '../value-objects/index.js';

/**
 * Hook to get a single track by ID
 */
export function useTrack(trackId: string | TrackId | null) {
  const { tracks, findTrackById, loadTracks, isLoading, error } =
    useTrackRepositoryStore();

  useEffect(() => {
    if (tracks.length === 0 && !isLoading) {
      loadTracks();
    }
  }, [tracks.length, isLoading, loadTracks]);

  const id = typeof trackId === 'string' ? TrackId.create(trackId) : trackId;
  const track = id ? findTrackById(id) : null;

  return {
    track,
    isLoading,
    error,
    refetch: loadTracks,
  };
}

/**
 * Hook to get all tracks
 */
export function useTracks() {
  const {
    tracks,
    loadTracks,
    isLoading,
    error,
    createTrack,
    deleteTrack,
    deleteAllTracks,
    reorderTracks,
  } = useTrackRepositoryStore();

  useEffect(() => {
    if (tracks.length === 0 && !isLoading) {
      loadTracks();
    }
  }, [tracks.length, isLoading, loadTracks]);

  return {
    tracks,
    isLoading,
    error,
    refetch: loadTracks,
    createTrack,
    deleteTrack,
    deleteAllTracks,
    reorderTracks,
  };
}

/**
 * Hook for track selection management
 */
export function useTrackSelection() {
  const { selectedTrackId, selectTrack, getSelectedTrack } =
    useTrackRepositoryStore();

  const selectedTrack = getSelectedTrack();

  const handleSelectTrack = (trackId: string | TrackId | null) => {
    const id = typeof trackId === 'string' ? TrackId.create(trackId) : trackId;
    selectTrack(id);
  };

  return {
    selectedTrackId,
    selectedTrack,
    selectTrack: handleSelectTrack,
  };
}

/**
 * Hook for track mute/solo management
 */
export function useTrackMuteSolo() {
  const {
    tracks,
    soloedTrackIds,
    toggleSolo,
    clearAllSolo,
    muteTrack,
    toggleMute,
  } = useTrackRepositoryStore();

  const handleToggleSolo = (trackId: string | TrackId) => {
    const id = typeof trackId === 'string' ? TrackId.create(trackId) : trackId;
    toggleSolo(id);
  };

  const handleToggleMute = async (trackId: string | TrackId) => {
    const id = typeof trackId === 'string' ? TrackId.create(trackId) : trackId;
    await toggleMute(id);
  };

  const handleMuteTrack = async (trackId: string | TrackId, muted: boolean) => {
    const id = typeof trackId === 'string' ? TrackId.create(trackId) : trackId;
    await muteTrack(id, muted);
  };

  // Determine effective mute state for each track
  const getEffectiveMuteState = (trackId: TrackId): boolean => {
    const track = tracks.find((t) => t.id.equals(trackId));
    if (!track) return false;

    // If any track is soloed and this isn't one of them, it's effectively muted
    if (
      soloedTrackIds.length > 0 &&
      !soloedTrackIds.some((id) => id.equals(trackId))
    ) {
      return true;
    }

    return track.isMuted;
  };

  return {
    soloedTrackIds,
    toggleSolo: handleToggleSolo,
    clearAllSolo,
    toggleMute: handleToggleMute,
    muteTrack: handleMuteTrack,
    getEffectiveMuteState,
  };
}

/**
 * Hook for track volume and pan control
 */
export function useTrackMixing(trackId: string | TrackId) {
  const { findTrackById, setTrackVolume, setTrackPan } =
    useTrackRepositoryStore();

  const id = typeof trackId === 'string' ? TrackId.create(trackId) : trackId;
  const track = findTrackById(id);

  const handleSetVolume = async (volume: number) => {
    await setTrackVolume(id, volume);
  };

  const handleSetPan = async (pan: number) => {
    await setTrackPan(id, pan);
  };

  return {
    volume: track?.volume.value || 0,
    pan: track?.pan.value || 0,
    setVolume: handleSetVolume,
    setPan: handleSetPan,
  };
}

/**
 * Hook to get tracks by instrument type
 */
export function useTracksByType(instrumentType: string) {
  const { tracks, findTracksByType, loadTracks, isLoading } =
    useTrackRepositoryStore();

  useEffect(() => {
    if (tracks.length === 0 && !isLoading) {
      loadTracks();
    }
  }, [tracks.length, isLoading, loadTracks]);

  const filteredTracks = findTracksByType(instrumentType as any);

  return {
    tracks: filteredTracks,
    isLoading,
    refetch: loadTracks,
  };
}
