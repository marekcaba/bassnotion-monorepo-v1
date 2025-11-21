/**
 * TrackManager - Handles track registration and dynamic updates
 *
 * Responsibilities:
 * - Register new tracks to the tracks Map
 * - Replace existing tracks with same instrumentType
 * - Clear scheduled events when replacing tracks
 * - Handle harmony-specific cleanup (activeHarmonySources, CC64 timeline)
 * - Load Grand Piano keyboard map when needed
 * - Coordinate dynamic track updates while playback is running
 *
 * This module ensures clean track lifecycle management and prevents
 * duplicate tracks from causing audio conflicts.
 */

import { getLogger } from '@/utils/logger.js';

const logger = getLogger('RegionProcessor');

// Types
interface PatternEvent {
  position: string | { measure: number; beat: number; subdivision?: number; tick?: number };
  type: string;
  velocity?: number;
  duration?: string | number;
  data?: any;
}

interface Region {
  id: string;
  startTime: number;
  duration: number;
  skipCountdownOffset?: boolean;
  pattern?: {
    events: PatternEvent[];
  };
  events?: PatternEvent[];
}

interface Track {
  id?: string;
  name?: string;
  track?: { id: string };
  regions: Region[];
  instrumentType?: string;
  exerciseId?: string;
}

export class TrackManager {
  private instanceId: string;

  constructor(instanceId: string) {
    this.instanceId = instanceId;
  }

  /**
   * Register tracks - adds tracks to the Map, replacing any existing tracks
   * with the same instrumentType
   *
   * CRITICAL: Replaces tracks by instrumentType to prevent duplicates
   * (e.g., prevents two metronome tracks from playing simultaneously)
   */
  registerTracks(
    tracks: Track[],
    tracksMap: Map<string, Track>,
    scheduledEvents: Map<string, Set<string>>,

    // Dependencies
    clearTrackEvents: (trackId: string) => void,
    clearHarmonyState: () => void,
    logDebugMessage: (category: string, message: string, data?: any) => void,
  ): void {
    console.log('🔍 [REGISTER-DEBUG] registerTracks() called with:', {
      trackCount: tracks.length,
      currentTracksInMap: tracksMap.size,
      currentTrackIds: Array.from(tracksMap.keys()),
      incomingTracks: tracks.map((t) => ({
        id: t.id || t.track?.id || t.name || 'unknown',
        instrumentType: t.instrumentType,
        regions: t.regions.length,
      })),
    });

    // DIAGNOSTIC: Log harmony track registration with full details
    const harmonyTracks = tracks.filter((t) => t.instrumentType === 'harmony');
    if (harmonyTracks.length > 0) {
      console.log('🚨🚨🚨 HARMONY TRACK DETECTED IN REGISTRATION', {
        count: harmonyTracks.length,
        harmonyTracks: harmonyTracks.map((t) => ({
          id: t.id || t.name,
          regions: t.regions.length,
          regionsData: t.regions.map((r) => ({
            id: r.id,
            eventsCount: r.events?.length || 0,
            firstEvents: (r.events || []).slice(0, 3).map((e) => ({
              type: e.type,
              position: e.position,
              hasData: !!e.data,
            })),
          })),
        })),
      });
    }

    tracks.forEach((track) => {
      const trackId = track.id || track.track?.id || track.name || 'unknown';
      const instrumentType = track.instrumentType;

      console.log('🔍 [REGISTER-DEBUG] Processing track:', {
        trackId,
        instrumentType,
        hasInstrumentType: !!instrumentType,
      });

      // CRITICAL: Remove any existing track with the same instrument type
      // This prevents duplicate tracks (e.g., two metronome tracks)
      if (instrumentType) {
        const existingEntry = Array.from(tracksMap.entries()).find(
          ([, t]) => t.instrumentType === instrumentType,
        );
        const existingTrackId = existingEntry?.[0];
        const existingTrack = existingEntry?.[1];

        console.log('🔍 [REGISTER-DEBUG] Checking for existing track:', {
          instrumentType,
          existingTrackId,
          newTrackId: trackId,
          existingExerciseId: existingTrack?.exerciseId,
          newExerciseId: track.exerciseId,
          shouldReplace: !!existingTrackId,
        });

        // CRITICAL FIX: Replace if ANY existing track found with same instrumentType
        // Track IDs may be identical (e.g., 'harmony-widget-track') but exercise changed
        if (existingTrackId) {
          const exerciseChanged =
            existingTrack?.exerciseId !== track.exerciseId;

          console.log('⚠️ [REGISTER-DEBUG] REPLACEMENT TRIGGERED:', {
            replacing: existingTrackId,
            with: trackId,
            instrumentType,
            exerciseChanged,
            oldExerciseId: existingTrack?.exerciseId,
            newExerciseId: track.exerciseId,
          });

          logger.warn(
            `⚠️ Replacing existing ${instrumentType} track "${existingTrackId}" with "${trackId}"${exerciseChanged ? ' (exercise changed)' : ''}`,
          );

          // CRITICAL FIX: Clear scheduled events for the old track
          // Without this, old instrument's audio sources remain scheduled and play alongside new instrument
          clearTrackEvents(existingTrackId);

          // CRITICAL FIX: Clear harmony-specific state when replacing harmony track
          // This ensures old sustain pedal state and active sources don't carry over
          if (instrumentType === 'harmony') {
            clearHarmonyState();
            console.log('✅ [REGISTER-DEBUG] Cleared harmony state');
            logger.info(
              '✅ Cleared harmony-specific state during track replacement',
            );
          }

          tracksMap.delete(existingTrackId);
          console.log('✅ [REGISTER-DEBUG] Old track deleted from Map');
        }
      }

      tracksMap.set(trackId, track);
      console.log('✅ [REGISTER-DEBUG] New track added to Map:', {
        trackId,
        totalTracksNow: tracksMap.size,
      });

      logger.info(
        `Registered track: ${trackId} with ${track.regions.length} regions`,
      );
      logDebugMessage('RegionProcessor', `registered-track: ${trackId}`, {
        regions: track.regions.length,
        instrumentType: track.instrumentType,
      });
    });

    console.log('🔍 [REGISTER-DEBUG] registerTracks() complete:', {
      totalTracks: tracksMap.size,
      trackIds: Array.from(tracksMap.keys()),
    });
  }

  /**
   * Update tracks - handle dynamic track addition/replacement
   *
   * CRITICAL: When running, adds tracks WITHOUT stopping/restarting
   * This prevents interrupting countdown and causing abrupt restarts
   *
   * @param tracks - New tracks to add
   * @param exerciseMetadata - Optional metadata (harmony instrument, etc.)
   * @param isRunning - Whether RegionProcessor is currently running
   * @param tracksMap - The tracks Map to update
   * @param scheduledEvents - Map of scheduled events
   * @param clearTrackEvents - Function to clear track events
   * @param clearHarmonyState - Function to clear harmony state
   * @param registerTracks - Function to register tracks normally
   * @param scheduleAllRegions - Function to schedule all regions
   * @param loadGrandPianoKeyboardMap - Function to load Grand Piano keyboard map
   * @param getGrandPianoKeyboardMap - Function to get current keyboard map
   * @param setHarmonyInstrument - Function to set current harmony instrument
   * @param logDebugMessage - Function to log debug messages
   */
  updateTracks(
    tracks: Track[],
    exerciseMetadata: { harmonyInstrument?: string } | undefined,
    isRunning: boolean,
    tracksMap: Map<string, Track>,
    scheduledEvents: Map<string, Set<string>>,

    // Dependencies
    clearTrackEvents: (trackId: string) => void,
    clearHarmonyState: () => void,
    registerTracksFunc: (tracks: Track[]) => void,
    scheduleAllRegions: () => void,
    loadGrandPianoKeyboardMap: () => Promise<void>,
    getGrandPianoKeyboardMap: () => any,
    setHarmonyInstrument: (instrument: string) => void,
    logDebugMessage: (category: string, message: string, data?: any) => void,
  ): void {
    // Early harmony instrument detection
    if (exerciseMetadata?.harmonyInstrument) {
      setHarmonyInstrument(exerciseMetadata.harmonyInstrument);

      // Load keyboard map for Grand Piano
      if (exerciseMetadata.harmonyInstrument === 'grandpiano' && !getGrandPianoKeyboardMap()) {
        loadGrandPianoKeyboardMap().then(() => {
          logger.info('✅ Grand Piano keyboard map loaded for dynamic track update');
        }).catch((error) => {
          logger.error('Failed to load Grand Piano keyboard map', error);
        });
      }
    }

    if (isRunning) {
      // Dynamic track addition without stopping playback
      tracks.forEach((track) => {
        const existingTrack = tracksMap.get(track.id || track.name || 'unknown');

        if (existingTrack) {
          // Clear scheduled events for the existing track
          clearTrackEvents(track.id || track.name || 'unknown');

          // Clear harmony-specific state if replacing harmony track
          if (track.instrumentType === 'harmony') {
            // Clear WamKeyboard events if available
            const harmonyAudioNode = existingTrack as any;
            if (harmonyAudioNode?.audioNode?.clearEvents) {
              harmonyAudioNode.audioNode.clearEvents();
              logger.info('✅ Cleared WamKeyboard events');
            }

            clearHarmonyState();
            logger.info('✅ Cleared active harmony sources and CC64 timeline');
          }
        }
      });

      // Add new tracks to the registry
      tracks.forEach((track) => {
        tracksMap.set(track.id || track.name || 'unknown', track);
        logger.info(
          `📝 [RegionProcessor] Added track dynamically: ${track.id || track.name}`,
        );
      });

      // CRITICAL FIX: Actually schedule the new track's events!
      // scheduleAllRegions() already has guard to skip already-scheduled events
      // This ensures all events get scheduled, not just the ones in lookahead window
      logger.info(
        '🔄 [RegionProcessor] Scheduling events for newly added tracks',
      );
      scheduleAllRegions();

      const totalScheduledEvents = Array.from(scheduledEvents.values())
        .reduce((sum, set) => sum + set.size, 0);
      logger.info('✅ [RegionProcessor] Dynamic track scheduling complete', {
        totalScheduledEvents,
      });
    } else {
      // Not running yet - just register normally
      registerTracksFunc(tracks);
    }
  }

  /**
   * Clear events for a specific track
   *
   * Used when switching exercises to prevent old exercise events from playing
   *
   * @param trackId - ID of the track to clear
   * @param scheduledEvents - Map of scheduled events
   */
  clearTrackEvents(
    trackId: string,
    scheduledEvents: Map<string, Set<string>>,
  ): void {
    logger.info(`🧹 Clearing scheduled events for track: ${trackId}`);

    // Remove track from scheduledEvents Map
    const cleared = scheduledEvents.delete(trackId);

    if (cleared) {
      logger.info(`✅ Cleared track events for ${trackId}`);
    } else {
      logger.info(`ℹ️ No events found for track ${trackId}`);
    }

    // Note: We don't clear scheduledIds or scheduledAudioSources here
    // Those are global and will be cleared on stop()
    // This method only clears the event tracking to allow re-scheduling
  }
}
