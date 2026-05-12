'use client';

/**
 * useExerciseLoader Hook
 *
 * Manages exercise loading state and MIDI data loading including:
 * - Loading MIDI data from various sources (Supabase, URLs, raw data)
 * - Creating track regions for metronome, drums, and bass
 * - Registering tracks with PlaybackEngine
 * - Fallback pattern generation when no MIDI data is available
 *
 * @example
 * const { isLoading, lastLoadedExerciseId } = useExerciseLoader({
 *   selectedExercise,
 *   transport,
 *   metronomeTrackRef,
 *   drumTrackRef,
 *   bassTrackRef,
 *   lastUserTempoRef,
 * });
 */

import { useEffect, useRef, useState } from 'react';
import type { MusicalExercise as Exercise, TimeSignature } from '@bassnotion/contracts';
import { ExerciseLoader } from '@/domains/playback/modules/exercises/core/ExerciseLoader.js';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry.js';
import { musicalTruth } from '@/domains/playback/modules/tempo/MusicalTruthAuthority';
import { getLogger } from '@/utils/logger.js';
import { normalizeDrumTypeToBufferKey } from '../utils/drum-utilities.js';
import type { RegionModel } from '@/domains/playback/models/SessionModel.js';

const logger = getLogger('useExerciseLoader');

/**
 * Debounce window in ms - prevents double-firing within this window
 * React Strict Mode and unstable dependencies can cause rapid re-fires
 */
const LOAD_DEBOUNCE_MS = 100;

/**
 * Minimal exercise info needed for ExerciseLoader methods
 * This allows passing a subset of Exercise fields to loader methods
 */
interface ExerciseLoaderInfo {
  id: string;
  title: string;
  bpm: number;
  timeSignature?: TimeSignature;
  total_bars?: number;
}

/**
 * Region data type for addRegion calls - partial RegionModel compatible
 */
type RegionData = Partial<RegionModel> & {
  id: string;
  trackId: string;
  pattern?: {
    id: string;
    name: string;
    type: string;
    events: unknown[];
    timeSignature?: TimeSignature;
  };
};

/**
 * Track reference interface for exercise loading
 */
export interface ExerciseLoaderTrack {
  isInitialized: boolean;
  track: {
    id?: string;
    name?: string;
    regions?: Array<{ id: string }>;
  } | null;
  regions?: Array<{ id: string }>;
  addRegion: (region: RegionData) => void;
  clearRegions: () => void;
}

/**
 * Transport interface subset for exercise loading
 */
export interface ExerciseLoaderTransport {
  tempo: number;
  isPlaying: boolean;
  stop: () => void;
}

/**
 * Options for the useExerciseLoader hook
 */
export interface UseExerciseLoaderOptions {
  /** Currently selected exercise */
  selectedExercise: Exercise | null | undefined;
  /** Transport context for playback state */
  transport: ExerciseLoaderTransport;
  /** Ref to metronome track */
  metronomeTrackRef: React.MutableRefObject<ExerciseLoaderTrack>;
  /** Ref to drum track */
  drumTrackRef: React.MutableRefObject<ExerciseLoaderTrack>;
  /** Ref to bass track */
  bassTrackRef: React.MutableRefObject<ExerciseLoaderTrack>;
  /** Ref to track last user-set tempo */
  lastUserTempoRef: React.MutableRefObject<number | null>;
}

/**
 * Return type for the useExerciseLoader hook
 */
export interface UseExerciseLoaderReturn {
  /** Whether an exercise is currently being loaded */
  isLoadingExercise: boolean;
  /** ID of the last successfully loaded exercise */
  lastLoadedExerciseId: string | null;
}

/**
 * Helper function to wait for track initialization
 */
async function waitForTrackInit(
  trackRef: React.MutableRefObject<ExerciseLoaderTrack>,
  trackName: string,
  maxWaitMs: number = 3000
): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    if (trackRef.current.isInitialized && trackRef.current.track) {
      logger.debug(`🎮 ${trackName} track ready after ${Date.now() - startTime}ms`);
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  logger.warn(`🎮 ${trackName} track not ready after ${maxWaitMs}ms`);
  return false;
}

/**
 * Hook for managing exercise loading and MIDI data
 */
export function useExerciseLoader(
  options: UseExerciseLoaderOptions
): UseExerciseLoaderReturn {
  const {
    selectedExercise,
    transport,
    metronomeTrackRef,
    drumTrackRef,
    bassTrackRef,
    lastUserTempoRef,
  } = options;

  const [isLoadingExercise, setIsLoadingExercise] = useState(false);
  const loadingRef = useRef(false);
  const lastLoadedExerciseRef = useRef<string | null>(null);
  const lastLoadTimestampRef = useRef<number>(0);

  // Load exercise data when selected
  useEffect(() => {
    logger.debug('🔄 useExerciseLoader: useEffect TRIGGERED', {
      selectedExerciseId: selectedExercise?.id,
      selectedExerciseBpm: selectedExercise?.bpm,
      metronomeInitialized: metronomeTrackRef.current.isInitialized,
      drumInitialized: drumTrackRef.current.isInitialized,
      lastLoadedId: lastLoadedExerciseRef.current,
      isLoading: loadingRef.current,
      transportTempo: transport?.tempo,
    });

    if (!selectedExercise) {
      logger.warn(
        '🎮 useExerciseLoader: No exercise selected - useEffect returning early',
      );
      return;
    }

    logger.info('🎮 useExerciseLoader: Exercise found, will proceed to load', {
      exerciseId: selectedExercise.id,
      hasDrumPattern: !!selectedExercise.drumPattern,
      drumPatternLength: selectedExercise.drumPattern?.length || 0,
      hasDrummerMidiUrl: !!selectedExercise.drummerMidiUrl,
    });

    // Extract exercise ID for comparison
    const selectedExerciseId =
      typeof selectedExercise.id === 'object'
        ? selectedExercise.id.value
        : String(selectedExercise.id);

    // Check if this is a different exercise or a re-run
    const exerciseIdChanged =
      lastLoadedExerciseRef.current !== selectedExerciseId;

    // Skip if already loading
    if (loadingRef.current) {
      logger.debug(
        '🎮 useExerciseLoader: Already loading, skipping duplicate call',
      );
      return;
    }

    // Debounce: Skip if same exercise was loaded within the debounce window
    // This prevents double-firing from React Strict Mode or unstable dependencies
    const now = Date.now();
    const timeSinceLastLoad = now - lastLoadTimestampRef.current;
    if (!exerciseIdChanged && timeSinceLastLoad < LOAD_DEBOUNCE_MS) {
      logger.debug(
        '🎮 useExerciseLoader: Skipping duplicate load within debounce window',
        {
          currentId: selectedExerciseId,
          timeSinceLastLoad,
          debounceMs: LOAD_DEBOUNCE_MS,
        },
      );
      return;
    }

    // Skip if same exercise AND we already loaded it (prevent re-loading on other state changes)
    if (!exerciseIdChanged && lastLoadedExerciseRef.current === selectedExerciseId) {
      logger.debug(
        '🎮 useExerciseLoader: Same exercise already loaded, skipping',
        {
          currentId: selectedExerciseId,
          hasDrumPattern: !!selectedExercise.drumPattern,
        },
      );
      return;
    }

    loadingRef.current = true;
    lastLoadTimestampRef.current = now;
    setIsLoadingExercise(true);

    // Helper function to load exercise
    const loadExercise = async () => {
      try {
        logger.info('🎮 useExerciseLoader: Starting exercise load', {
          exerciseId: selectedExercise.id,
          exerciseBpm: selectedExercise.bpm,
          exerciseTimeSignature: selectedExercise.timeSignature,
        });

        // Update last loaded ID
        lastLoadedExerciseRef.current = selectedExerciseId;

        // Set tempo from exercise using musicalTruth
        // This ensures consistent tempo handling across the app
        musicalTruth.setFromExercise(selectedExercise);

        // Clear existing regions from tracks
        logger.info('🎮 useExerciseLoader: Clearing existing track regions');
        metronomeTrackRef.current.clearRegions();
        drumTrackRef.current.clearRegions();
        bassTrackRef.current.clearRegions();

        // Create exercise loader
        const exerciseLoader = new ExerciseLoader();

        // Track MIDI loading status
        let midiLoaded = false;
        const allRegions: RegionModel[] = [];

        // Load MIDI data from exercise-specific URLs (per-widget MIDI)
        const hasPerWidgetMidi =
          selectedExercise.drummerMidiUrl ||
          selectedExercise.drumPattern ||
          selectedExercise.harmonyMidiUrl ||
          selectedExercise.metronomeMidiUrl ||
          (selectedExercise.notes && selectedExercise.notes.length > 0);

        if (hasPerWidgetMidi) {
          logger.info(
            '🎮 useExerciseLoader: Loading per-widget MIDI files',
            {
              drummerMidiUrl: selectedExercise.drummerMidiUrl,
              hasDrumPattern: !!selectedExercise.drumPattern,
              harmonyMidiUrl: selectedExercise.harmonyMidiUrl,
              metronomeMidiUrl: selectedExercise.metronomeMidiUrl,
              bassNotesCount: selectedExercise.notes?.length || 0,
            },
          );

          try {
            // Priority 1: Load drums from pre-converted drumPattern (DrumHit[]) - preferred!
            if (
              selectedExercise.drumPattern &&
              selectedExercise.drumPattern.length > 0
            ) {
              logger.info(
                '🎮 useExerciseLoader: Loading drummer from pre-converted drumPattern array',
                { patternLength: selectedExercise.drumPattern.length },
              );
              try {
                const exerciseInfo: ExerciseLoaderInfo = {
                  id:
                    typeof selectedExercise.id === 'object'
                      ? selectedExercise.id.value
                      : String(selectedExercise.id),
                  title: selectedExercise.title,
                  bpm: selectedExercise.bpm,
                  timeSignature: selectedExercise.timeSignature || {
                    numerator: 4,
                    denominator: 4,
                  },
                  total_bars: selectedExercise.total_bars,
                };
                const drumResult = await exerciseLoader.loadFromDrumPattern(
                  selectedExercise.drumPattern,
                  exerciseInfo as Exercise,
                );

                // Wait for drum track initialization, then add regions
                const drumTrackReady = await waitForTrackInit(
                  drumTrackRef,
                  'Drummer',
                );
                if (drumTrackReady) {
                  for (const region of drumResult.regions) {
                    drumTrackRef.current.addRegion(region as RegionData);
                    allRegions.push(region);
                    logger.info(
                      '🎮 useExerciseLoader: Added drum region from pre-converted pattern',
                    );
                  }
                } else {
                  // Track not ready yet - this is expected during Act 1 (understanding phase)
                  // Tracks will initialize when user transitions to Act 2 (practice phase)
                  logger.warn(
                    '🎮 useExerciseLoader: Drummer track not ready yet, regions will be added when track initializes',
                  );
                }
              } catch (error) {
                logger.error(
                  '🎮 useExerciseLoader: Error loading drummer from pattern:',
                  error,
                );
              }
            } else if (selectedExercise.drummerMidiUrl) {
              // Fallback: Download and parse MIDI file (for backwards compatibility)
              logger.info(
                '🎮 useExerciseLoader: Loading drummer MIDI from URL (fallback):',
                selectedExercise.drummerMidiUrl,
              );
              try {
                const drumMidiInfo = {
                  id: typeof selectedExercise.id === 'object'
                    ? selectedExercise.id.value
                    : String(selectedExercise.id),
                  title: selectedExercise.title,
                  bpm: selectedExercise.bpm,
                  timeSignature: selectedExercise.timeSignature,
                  midiFileUrl: selectedExercise.drummerMidiUrl,
                };
                const drumResult = await exerciseLoader.loadMidiDirect(drumMidiInfo as Exercise & { midiFileUrl: string });

                // Wait for drum track initialization, then add regions
                const drumTrackReady = await waitForTrackInit(
                  drumTrackRef,
                  'Drummer',
                );
                if (drumTrackReady) {
                  for (const region of drumResult.regions) {
                    drumTrackRef.current.addRegion(region as RegionData);
                    allRegions.push(region);
                    logger.info(
                      '🎮 useExerciseLoader: Added drum region from MIDI URL',
                    );
                  }
                } else {
                  // Track not ready yet - this is expected during Act 1 (understanding phase)
                  // Tracks will initialize when user transitions to Act 2 (practice phase)
                  logger.warn(
                    '🎮 useExerciseLoader: Drummer track not ready yet (MIDI URL), regions will be added when track initializes',
                  );
                }
              } catch (error) {
                logger.error(
                  '🎮 useExerciseLoader: Error loading drummer MIDI:',
                  error,
                );
              }
            }

            // Load bass notes from exercise.notes (fretboard data)
            const activeExercise = selectedExercise;
            const bassNotes = activeExercise?.notes || [];
            if (bassNotes.length > 0) {
              logger.info(
                '🎮 useExerciseLoader: Loading bass from exercise notes',
                {
                  noteCount: bassNotes.length,
                },
              );
              try {
                const bassExerciseInfo: ExerciseLoaderInfo = {
                  id:
                    typeof selectedExercise.id === 'object'
                      ? selectedExercise.id.value
                      : String(selectedExercise.id),
                  title: selectedExercise.title,
                  bpm: selectedExercise.bpm,
                  timeSignature: selectedExercise.timeSignature || {
                    numerator: 4,
                    denominator: 4,
                  },
                  total_bars: selectedExercise.total_bars,
                };
                const bassResult = await exerciseLoader.loadFromBassNotes(
                  bassNotes,
                  bassExerciseInfo as Exercise,
                );

                // Wait for bass track initialization, then add regions
                // FIX: On tutorial switch, track may remount - check if it's already in PlaybackEngine
                const coreServicesForBass = WindowRegistry.getCoreServices();
                const playbackEngineForBass = coreServicesForBass?.getPlaybackEngine?.();
                const existingBassTrack = playbackEngineForBass?.getTrack?.('bass-widget-track');

                let bassTrackReady = false;
                if (existingBassTrack) {
                  // Track already exists in PlaybackEngine - use it directly
                  logger.info('🎮 useExerciseLoader: Bass track exists in PlaybackEngine, using directly');
                  // Clear old regions and add new ones
                  if (existingBassTrack.clearRegions) {
                    existingBassTrack.clearRegions();
                  }
                  for (const region of bassResult.regions) {
                    existingBassTrack.addRegion(region as RegionData);
                    allRegions.push(region);
                    logger.info('🎮 useExerciseLoader: Added bass region to existing track');
                  }
                  bassTrackReady = true;
                } else {
                  // No existing track - wait for ref initialization
                  bassTrackReady = await waitForTrackInit(bassTrackRef, 'Bass');
                  if (bassTrackReady) {
                    for (const region of bassResult.regions) {
                      bassTrackRef.current.addRegion(region as RegionData);
                      allRegions.push(region);
                      logger.info(
                        '🎮 useExerciseLoader: Added bass region from exercise notes',
                      );
                    }
                  } else {
                    // Track not ready yet - this is expected during Act 1 (understanding phase)
                    // Tracks will initialize when user transitions to Act 2 (practice phase)
                    logger.warn(
                      '🎮 useExerciseLoader: Bass track not ready yet, regions will be added when track initializes',
                    );
                  }
                }
              } catch (error) {
                logger.error(
                  '🎮 useExerciseLoader: Error loading bass notes:',
                  error,
                );
              }
            }

            // Load harmony MIDI if available
            if (selectedExercise.harmonyMidiUrl) {
              logger.info(
                '🎮 useExerciseLoader: Harmony MIDI detected but harmony track not yet implemented',
              );
              // TODO: Load harmony when harmony track is ready
            }

            // Load metronome MIDI if available (though metronome is usually generated)
            if (selectedExercise.metronomeMidiUrl) {
              logger.info(
                '🎮 useExerciseLoader: Loading metronome MIDI from:',
                selectedExercise.metronomeMidiUrl,
              );
              try {
                const metronomeMidiInfo = {
                  id: typeof selectedExercise.id === 'object'
                    ? selectedExercise.id.value
                    : String(selectedExercise.id),
                  title: selectedExercise.title,
                  bpm: selectedExercise.bpm,
                  timeSignature: selectedExercise.timeSignature,
                  midiFileUrl: selectedExercise.metronomeMidiUrl,
                };
                const metronomeResult = await exerciseLoader.loadMidiDirect(
                  metronomeMidiInfo as Exercise & { midiFileUrl: string }
                );

                // Wait for metronome track initialization, then add regions
                const metronomeTrackReady = await waitForTrackInit(
                  metronomeTrackRef,
                  'Metronome',
                );
                if (metronomeTrackReady) {
                  for (const region of metronomeResult.regions) {
                    metronomeTrackRef.current.addRegion(region as RegionData);
                    allRegions.push(region);
                    logger.info(
                      '🎮 useExerciseLoader: Added metronome region from metronomeMidiUrl',
                    );
                  }
                } else {
                  // Track not ready yet - this is expected during Act 1 (understanding phase)
                  // Tracks will initialize when user transitions to Act 2 (practice phase)
                  logger.warn(
                    '🎮 useExerciseLoader: Metronome track not ready yet, regions will be added when track initializes',
                  );
                }
              } catch (error) {
                logger.error(
                  '🎮 useExerciseLoader: Error loading metronome MIDI:',
                  error,
                );
              }
            }

            // Register tracks with PlaybackEngine if we loaded any regions
            if (allRegions.length > 0) {
              const coreServicesForWidgetMidi =
                WindowRegistry.getCoreServices();
              const playbackEngine =
                coreServicesForWidgetMidi?.getPlaybackEngine?.();
              const tracks = [];

              // Use track.regions (synchronous) instead of hook's regions state (asynchronous)
              if ((metronomeTrackRef.current.track?.regions?.length || 0) > 0) {
                tracks.push(metronomeTrackRef.current.track);
              }

              if ((drumTrackRef.current.track?.regions?.length || 0) > 0) {
                tracks.push(drumTrackRef.current.track);
              }

              if ((bassTrackRef.current.track?.regions?.length || 0) > 0) {
                tracks.push(bassTrackRef.current.track);
              }

              if (tracks.length > 0 && playbackEngine) {
                playbackEngine.registerTracks(tracks);
                logger.info(
                  '🎮 useExerciseLoader: Registered',
                  tracks.length,
                  'tracks from per-widget MIDI files',
                );
              } else if (tracks.length > 0 && !playbackEngine) {
                logger.warn(
                  '🎮 useExerciseLoader: PlaybackEngine not available for per-widget MIDI tracks',
                );
              }

              midiLoaded = true;
              logger.info(
                '🎮 useExerciseLoader: Per-widget MIDI files loaded successfully, added',
                allRegions.length,
                'regions',
              );
            }
          } catch (error) {
            logger.error(
              '🎮 useExerciseLoader: Error loading per-widget MIDI files:',
              error,
            );
          }
        }

        // If no MIDI was loaded, fall back to creating patterns from exercise data
        if (!midiLoaded) {
          logger.info(
            '🎮 useExerciseLoader: No MIDI data, using structured patterns',
          );

          // Create metronome pattern
          const metronome = metronomeTrackRef.current;
          logger.debug('🎮 useExerciseLoader: Metronome track state:', {
            isInitialized: metronome.isInitialized,
            hasTrack: !!metronome.track,
            trackId: metronome.track?.id,
            trackName: metronome.track?.name,
          });
          if (metronome.isInitialized && metronome.track) {
            // Get time signature from exercise or use default 4/4
            const exerciseTimeSignature = selectedExercise.timeSignature || {
              numerator: 4,
              denominator: 4,
            };
            const beatsPerBar = exerciseTimeSignature.numerator;

            // Calculate total beats from total_bars and time signature
            const totalBars =
              selectedExercise.total_bars ||
              Math.ceil((selectedExercise.duration_beats || 16) / beatsPerBar);
            const totalBeats = totalBars * beatsPerBar;

            logger.info('🎮 useExerciseLoader: Creating metronome pattern:', {
              timeSignature: exerciseTimeSignature,
              totalBars,
              beatsPerBar,
              totalBeats,
              exerciseBpm: selectedExercise.bpm,
            });

            const events = [];
            for (let i = 0; i < totalBeats; i++) {
              // Accent on the first beat of each bar
              const isAccent = i % beatsPerBar === 0;
              events.push({
                id: `metronome-${i}`,
                type: 'metronome-trigger' as const,
                time: i,
                data: { accent: isAccent },
              });
            }

            const metronomeRegion = {
              id: 'metronome-region',
              trackId: metronome.track?.id || 'metronome',
              name: 'Metronome',
              startTime: 0,
              duration: totalBeats,
              pattern: {
                id: 'metronome-pattern',
                name: 'Click Track',
                type: 'metronome',
                timeSignature: exerciseTimeSignature,
                events: events.map((evt, idx) => ({
                  position: `0:${idx}:0`,
                  type: evt.data.accent ? 'accent' : 'click',
                  velocity: evt.data.accent ? 0.9 : 0.7,
                })),
              },
            };
            metronome.addRegion(metronomeRegion as RegionData);
            logger.info(
              '🎮 useExerciseLoader: Added metronome pattern with',
              events.length,
              'clicks',
            );
          }

          // Create drum pattern if enabled
          const drum = drumTrackRef.current;
          const hasDrumPatternData = !!(
            selectedExercise.drumPattern &&
            selectedExercise.drumPattern.length > 0
          );
          logger.debug('🎮 useExerciseLoader: Drum track state:', {
            isInitialized: drum.isInitialized,
            hasTrack: !!drum.track,
            trackId: drum.track?.id,
            trackName: drum.track?.name,
            hasDrumPattern: hasDrumPatternData,
            drumPatternHits: selectedExercise.drumPattern?.length || 0,
            regionsBeforeAdd: drum.regions?.length || 0,
          });

          // Check drum pattern conditions
          const hasDrumPattern = !!(
            selectedExercise?.drumPattern &&
            selectedExercise.drumPattern.length > 0
          );
          const willSkip = midiLoaded;

          logger.info('🔍 DRUM REGIONS CHECK:', {
            midiLoaded,
            hasDrumPattern,
            willSkip,
            drumPatternLength: selectedExercise?.drumPattern?.length || 0,
            drumPatternType: typeof selectedExercise?.drumPattern,
            exerciseId: selectedExercise?.id,
            message: willSkip
              ? '✅ SKIPPING - MIDI already loaded by ExerciseLoader'
              : hasDrumPattern
                ? '🎵 Using pre-converted drumPattern array'
                : '⚠️ No drum pattern data found',
          });

          if (
            drum.isInitialized &&
            drum.track &&
            !midiLoaded &&
            hasDrumPattern
          ) {
            // Generate drum events from exercise drumPattern data (pre-converted DrumHit[])
            const drumEvents: any[] = [];

            if (
              selectedExercise.drumPattern &&
              Array.isArray(selectedExercise.drumPattern)
            ) {
              // Convert DrumHit[] to the event format expected by regions
              const convertedEvents = selectedExercise.drumPattern.map(
                (hit: any) => {
                  const timeSignature = selectedExercise.timeSignature || {
                    numerator: 4,
                    denominator: 4,
                  };

                  // Calculate total beats from the start (0-based)
                  const totalBeats =
                    (hit.position.measure || 0) * timeSignature.numerator +
                    (hit.position.beat || 0);

                  // Use tick for precise subdivision
                  const PPQ = 480;
                  const tick =
                    hit.position.tick ??
                    (hit.position.subdivision || 0) * (PPQ / 4);
                  const sixteenthSubdivision = Math.floor((tick / PPQ) * 4);

                  // Normalize drum type to buffer key
                  const normalizedDrum = normalizeDrumTypeToBufferKey(
                    hit.drum || 'kick',
                  );
                  return {
                    position: `0:${totalBeats}:${sixteenthSubdivision}`,
                    type: normalizedDrum,
                    drum: normalizedDrum,
                    velocity: hit.velocity ? hit.velocity / 127 : 0.7,
                    midiNote: hit.midiNote,
                  };
                },
              );

              drumEvents.push(...convertedEvents);
              logger.info(
                `🎮 useExerciseLoader: Using ${drumEvents.length} drum hits from pre-converted drumPattern`,
              );
            }

            // If no drum hits were found, log warning and use default pattern
            if (drumEvents.length === 0) {
              logger.warn(
                '🎮 useExerciseLoader: No drum pattern data found, using default pattern',
              );
              const measures = Math.ceil(
                (selectedExercise.duration_beats || 16) / 4,
              );
              for (let measure = 0; measure < measures; measure++) {
                drumEvents.push(
                  {
                    position: `0:${measure * 4 + 0}:0`,
                    drum: 'kick',
                    type: 'kick',
                    velocity: 0.8,
                  },
                  {
                    position: `0:${measure * 4 + 1}:0`,
                    drum: 'snare',
                    type: 'snare',
                    velocity: 0.7,
                  },
                  {
                    position: `0:${measure * 4 + 2}:0`,
                    drum: 'kick',
                    type: 'kick',
                    velocity: 0.8,
                  },
                  {
                    position: `0:${measure * 4 + 3}:0`,
                    drum: 'snare',
                    type: 'snare',
                    velocity: 0.7,
                  },
                );
              }
            }

            const drumRegion = {
              id: `drum-region-${selectedExercise.id}`,
              trackId: drum.track?.id || 'drums',
              name: selectedExercise.drum_pattern?.name || 'Drum Pattern',
              startTime: 0,
              duration: selectedExercise.duration || 8,
              pattern: {
                id: `drum-pattern-${selectedExercise.id}`,
                name: selectedExercise.drum_pattern?.name || 'Exercise Drums',
                type: 'drum' as const,
                events: drumEvents,
              },
            };

            drum.addRegion(drumRegion as RegionData);
            logger.debug(
              `🎮 useExerciseLoader: Added drum pattern with ${drumEvents.length} events`,
            );

            // Verify the region was added
            const regionsAfterAdd = drum.track?.regions?.length || 0;
            logger.debug(
              `🎮 useExerciseLoader: Drum track now has ${regionsAfterAdd} regions`,
            );

            if (regionsAfterAdd === 0) {
              logger.error(
                '🎮 useExerciseLoader: Failed to add drum region to track!',
              );
            }
          }

          // Register tracks with PlaybackEngine for fallback patterns
          const coreServicesRefFallback = WindowRegistry.getCoreServices();
          if (coreServicesRefFallback?.getPlaybackEngine) {
            const playbackEngine = coreServicesRefFallback.getPlaybackEngine();

            // Build tracks array with regions
            const tracks = [];
            if ((metronomeTrackRef.current.track?.regions?.length || 0) > 0) {
              tracks.push(metronomeTrackRef.current.track);
            }
            if ((drumTrackRef.current.track?.regions?.length || 0) > 0) {
              tracks.push(drumTrackRef.current.track);
            }
            if ((bassTrackRef.current.track?.regions?.length || 0) > 0) {
              tracks.push(bassTrackRef.current.track);
            }

            if (tracks.length > 0 && playbackEngine) {
              playbackEngine.registerTracks(tracks);
              logger.info(
                '🎮 useExerciseLoader: Registered',
                tracks.length,
                'tracks with PlaybackEngine (fallback)',
              );
            }
          }
        } // End of fallback pattern creation (if !midiLoaded)

        // Update lastUserTempo ref to prevent sync conflicts on exercise change
        if (exerciseIdChanged || !musicalTruth.hasUserModifiedTempo()) {
          if (selectedExercise.bpm) {
            lastUserTempoRef.current = selectedExercise.bpm;
          }
        }

        logger.debug('🎮 useExerciseLoader: Exercise loaded successfully');
      } catch (error) {
        logger.error('🎮 useExerciseLoader: Error loading exercise:', error);
      } finally {
        loadingRef.current = false;
        setIsLoadingExercise(false);
      }
    };

    loadExercise();
    // Dependencies: Use stable string values instead of object references
    // to prevent spurious re-fires from array/object reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // Use the string ID, not the object reference
    typeof selectedExercise?.id === 'object'
      ? selectedExercise?.id?.value
      : selectedExercise?.id,
    // Use drumPattern length as a stable proxy for content changes
    // (actual content validation happens in the effect body)
    selectedExercise?.drumPattern?.length,
    selectedExercise?.drummerMidiUrl,
    // Don't include transport - it changes every render
  ]);

  return {
    isLoadingExercise,
    lastLoadedExerciseId: lastLoadedExerciseRef.current,
  };
}
