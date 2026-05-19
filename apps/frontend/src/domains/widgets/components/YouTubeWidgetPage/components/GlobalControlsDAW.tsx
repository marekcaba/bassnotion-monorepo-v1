/**
 * GlobalControlsDAW - Production DAW-integrated Global Controls
 *
 * Uses the tested DAW system from test-daw-integration:
 * - UnifiedTransport for timing
 * - Track system for audio data
 * - PatternScheduler for event coordination
 * - EventBus for communication
 * - CoreServices for initialization
 *
 * This replaces the old GlobalControls with proper DAW integration
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, Volume2, Music, RotateCw } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useTransportContext } from '@/domains/playback/contexts/TransportContext';
import { useTrack } from '@/domains/playback/hooks';
import type { MusicalExercise as Exercise } from '@bassnotion/contracts';
import type { CoreServices } from '@/domains/playback/services/core/CoreServices.js';

interface GlobalControlsDAWProps {
  selectedExercise?: Exercise;
  exercises?: Exercise[];
  duration: number;
  // Fretboard actions
  hasSelectedDots?: boolean;
  onResetFretboard?: () => void;
  // Loop settings
  loopRegion?: {
    startMeasure: number;
    endMeasure: number;
    startBeat?: number;
    endBeat?: number;
  } | null;
  isLoopEnabled?: boolean;
}

export const GlobalControlsDAW: React.FC<GlobalControlsDAWProps> = ({
  selectedExercise,
  exercises: _exercises = [],
  duration: _duration,
  hasSelectedDots = false,
  onResetFretboard,
  loopRegion,
  isLoopEnabled = false,
}) => {
  // Core DAW state
  const [coreServices, setCoreServices] = useState<CoreServices | null>(null);
  const [systemInitialized, setSystemInitialized] = useState(false);
  const [isLoadingExercise, setIsLoadingExercise] = useState(false);
  const loadingRef = useRef(false);

  // Transport hook
  const transport = useTransportContext();

  // Create tracks using hooks (same as test-daw-integration)
  const metronomeTrack = useTrack({
    trackId: 'metronome',
    name: 'Metronome',
    type: 'metronome',
  });

  const drumTrack = useTrack({
    trackId: 'drums',
    name: 'Drums',
    type: 'drums',
  });

  const keyboardTrack = useTrack({
    trackId: 'keyboard',
    name: 'Keyboard',
    type: 'harmony',
  });

  // Local state for UI
  const [localTempo, setLocalTempo] = useState(transport.tempo || 120);
  const [localVolume, setLocalVolume] = useState(1.0);
  // isDraggingTempo: setter is called from drag handlers below for the
  // re-render side effect, but no consumer reads the value here.
  const [_isDraggingTempo, setIsDraggingTempo] = useState(false);
  const [isLooping, setIsLooping] = useState(isLoopEnabled);

  // Refs for tracking state changes
  const lastUserTempo = useRef(transport.tempo || 120);
  const lastUserVolume = useRef(1.0);
  const tempoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize DAW system
  useEffect(() => {
    const initializeDAW = async () => {
      logger.info('🎵 GlobalControlsDAW: Initializing DAW system...');

      // Get CoreServices
      const services = window.__globalCoreServices;
      if (!services) {
        logger.error('🎵 GlobalControlsDAW: CoreServices not available');
        return;
      }

      setCoreServices(services);

      // Check if tracks are initialized
      const tracksReady =
        metronomeTrack.isInitialized &&
        drumTrack.isInitialized &&
        keyboardTrack.isInitialized;

      if (tracksReady) {
        logger.info('🎵 GlobalControlsDAW: All tracks initialized');
        setSystemInitialized(true);
      }
    };

    initializeDAW();
  }, [
    metronomeTrack.isInitialized,
    drumTrack.isInitialized,
    keyboardTrack.isInitialized,
  ]);

  // Load exercise data when selected
  useEffect(() => {
    if (
      !selectedExercise ||
      !systemInitialized ||
      !coreServices ||
      loadingRef.current
    ) {
      return;
    }

    const loadExerciseData = async () => {
      if (loadingRef.current) return; // Prevent concurrent loads
      loadingRef.current = true;
      setIsLoadingExercise(true);

      logger.info(
        '🎵 GlobalControlsDAW: Loading exercise:',
        selectedExercise.title,
      );

      try {
        // Clear existing regions
        metronomeTrack.clearRegions();
        drumTrack.clearRegions();
        keyboardTrack.clearRegions();

        // For now, we'll create regions manually like in the test page
        // This matches what we did in test-daw-integration

        // Load MIDI data if available
        if (selectedExercise.midi_data) {
          logger.info('🎵 GlobalControlsDAW: Loading MIDI data...');

          try {
            // Parse MIDI using Tone.js MIDI library
            const { Midi } = await import('@tonejs/midi');
            const midi = new Midi(selectedExercise.midi_data);
            logger.info(
              `🎵 GlobalControlsDAW: Parsed MIDI: ${midi.tracks.length} tracks`,
            );

            // Find first track with notes
            const trackWithNotes = midi.tracks.find(
              (track) => track.notes.length > 0,
            );
            if (trackWithNotes) {
              // Create a region for the MIDI data
              const region = {
                id: `midi-${Date.now()}`,
                trackId: 'keyboard',
                name: selectedExercise.title,
                startTime: 0,
                duration: trackWithNotes.duration || 4,
                patterns: [
                  {
                    id: `pattern-${Date.now()}`,
                    name: 'MIDI Pattern',
                    events: trackWithNotes.notes.map(
                      (note: any, index: number) => ({
                        id: `event-${index}`,
                        type: 'note' as const,
                        time: note.time,
                        data: {
                          note: note.name,
                          velocity: note.velocity,
                          duration: note.duration,
                        },
                      }),
                    ),
                  },
                ],
              };

              if (keyboardTrack.isInitialized) {
                keyboardTrack.addRegion(region as any);
                logger.info(
                  `🎵 GlobalControlsDAW: Added MIDI region with ${trackWithNotes.notes.length} notes`,
                );
              }
            }
          } catch (error) {
            logger.error('🎵 GlobalControlsDAW: Error parsing MIDI:', error);
          }
        }

        // Create test drum pattern (same as test page)
        const hasDrumPattern = !!(
          selectedExercise.drumPattern &&
          selectedExercise.drumPattern.length > 0
        );
        if (drumTrack.isInitialized && hasDrumPattern) {
          const drumRegion = {
            id: 'drum-test-region',
            trackId: 'drums',
            name: 'Test Drum Pattern',
            startTime: 0,
            duration: 4,
            patterns: [
              {
                id: 'drum-pattern-1',
                name: 'Basic Beat',
                events: [
                  {
                    id: 'kick-1',
                    type: 'drum-trigger' as const,
                    time: 0,
                    data: { drum: 'kick' },
                  },
                  {
                    id: 'snare-1',
                    type: 'drum-trigger' as const,
                    time: 1,
                    data: { drum: 'snare' },
                  },
                  {
                    id: 'kick-2',
                    type: 'drum-trigger' as const,
                    time: 2,
                    data: { drum: 'kick' },
                  },
                  {
                    id: 'snare-2',
                    type: 'drum-trigger' as const,
                    time: 3,
                    data: { drum: 'snare' },
                  },
                ],
              },
            ],
          };
          drumTrack.addRegion(drumRegion as any);
          logger.info('🎵 GlobalControlsDAW: Added drum pattern');
        }

        // Create metronome pattern
        if (metronomeTrack.isInitialized) {
          const beats = selectedExercise.duration_beats || 16;
          const events = [];
          for (let i = 0; i < beats; i++) {
            events.push({
              id: `metronome-${i}`,
              type: 'metronome-trigger' as const,
              time: i,
              data: { accent: i % 4 === 0 },
            });
          }

          const metronomeRegion = {
            id: 'metronome-region',
            trackId: 'metronome',
            name: 'Metronome',
            startTime: 0,
            duration: beats,
            patterns: [
              {
                id: 'metronome-pattern',
                name: 'Click Track',
                events,
              },
            ],
          };
          metronomeTrack.addRegion(metronomeRegion as any);
          logger.info('🎵 GlobalControlsDAW: Added metronome pattern');
        }

        // Update tempo from exercise
        if (selectedExercise.bpm) {
          await transport.setTempo(selectedExercise.bpm);
          setLocalTempo(selectedExercise.bpm);
          lastUserTempo.current = selectedExercise.bpm;
        }

        logger.info('🎵 GlobalControlsDAW: Exercise loaded successfully');
      } catch (error) {
        logger.error('🎵 GlobalControlsDAW: Error loading exercise:', error);
      } finally {
        loadingRef.current = false;
        setIsLoadingExercise(false);
      }
    };

    loadExerciseData();
  }, [selectedExercise, systemInitialized, coreServices]);

  // Handle play/pause
  const handlePlayButtonClick = useCallback(async () => {
    if (!systemInitialized || !coreServices) {
      logger.info('🎵 GlobalControlsDAW: System not ready');
      return;
    }

    try {
      logger.info(
        `🎵 GlobalControlsDAW: Play button clicked. Current state: ${transport.isPlaying ? 'playing' : 'stopped'}`,
      );

      if (transport.isPlaying) {
        await transport.pause();
        logger.info('🎵 GlobalControlsDAW: Paused');
      } else {
        // Configure loop if enabled
        if (isLooping && loopRegion && selectedExercise) {
          const timeSignature = selectedExercise.timeSignature || {
            numerator: 4,
            denominator: 4,
          };
          const beatsPerMeasure = timeSignature.numerator;

          // Calculate loop points
          const startMeasure = loopRegion.startMeasure - 1; // 0-indexed
          const startBeat = (loopRegion.startBeat || 1) - 1; // 0-indexed
          const endMeasure = loopRegion.endMeasure - 1; // 0-indexed
          const endBeat = (loopRegion.endBeat || beatsPerMeasure) - 1; // 0-indexed

          await transport.setLoop(
            startMeasure * beatsPerMeasure + startBeat,
            endMeasure * beatsPerMeasure + endBeat,
          );
          logger.info('🎵 GlobalControlsDAW: Loop configured');
        }

        await transport.start();
        logger.info('🎵 GlobalControlsDAW: Started');
      }
    } catch (error) {
      logger.error('🎵 GlobalControlsDAW: Error toggling playback:', error);
    }
  }, [
    systemInitialized,
    coreServices,
    transport,
    isLooping,
    loopRegion,
    selectedExercise,
  ]);

  // Handle tempo change
  const handleTempoChange = useCallback(
    async (newTempo: number) => {
      setLocalTempo(newTempo);
      lastUserTempo.current = newTempo;

      // Clear any pending sync
      if (tempoTimeoutRef.current) {
        clearTimeout(tempoTimeoutRef.current);
      }

      // Debounce the actual tempo change
      tempoTimeoutRef.current = setTimeout(async () => {
        await transport.setTempo(newTempo);
        logger.info('🎵 GlobalControlsDAW: Tempo updated to', newTempo);
      }, 100);
    },
    [transport],
  );

  // Handle volume change
  const handleVolumeChange = useCallback((newVolume: number) => {
    setLocalVolume(newVolume);
    lastUserVolume.current = newVolume;

    // Volume control would be implemented through the audio processors
    logger.info('🎵 GlobalControlsDAW: Volume changed to', newVolume);
  }, []);

  // Get track status
  const getTrackStatus = () => {
    const status: string[] = [];
    if (metronomeTrack.isInitialized) {
      status.push(`metronome: ${metronomeTrack.regions.length} regions`);
    }
    if (drumTrack.isInitialized) {
      status.push(`drums: ${drumTrack.regions.length} regions`);
    }
    if (keyboardTrack.isInitialized) {
      status.push(`keyboard: ${keyboardTrack.regions.length} regions`);
    }
    return status;
  };

  return (
    <div className="bg-gray-900/95 rounded-xl p-4 backdrop-blur-sm border border-gray-800">
      {/* Main Controls Row */}
      <div className="flex items-center justify-between gap-4 mb-4">
        {/* Play/Pause Button */}
        <Button
          onClick={handlePlayButtonClick}
          disabled={!systemInitialized || isLoadingExercise}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center gap-2"
        >
          {transport.isPlaying ? (
            <>
              <Pause className="w-5 h-5" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              <span>Play</span>
            </>
          )}
        </Button>

        {/* Exercise Title */}
        <div className="flex-1 text-center">
          <h3 className="text-lg font-semibold text-white">
            {selectedExercise?.title || 'No Exercise Selected'}
          </h3>
          {isLoadingExercise && (
            <p className="text-sm text-gray-400">Loading exercise data...</p>
          )}
        </div>

        {/* Tempo Control */}
        <div className="flex items-center gap-2">
          <Music className="w-4 h-4 text-gray-400" />
          <input
            type="range"
            min="60"
            max="200"
            value={localTempo}
            onChange={(e) => handleTempoChange(Number(e.target.value))}
            onMouseDown={() => setIsDraggingTempo(true)}
            onMouseUp={() => setIsDraggingTempo(false)}
            className="w-24"
          />
          <span className="text-white text-sm w-12">{localTempo}</span>
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-gray-400" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={localVolume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            className="w-24"
          />
          <span className="text-white text-sm w-12">
            {Math.round(localVolume * 100)}%
          </span>
        </div>
      </div>

      {/* Secondary Controls Row */}
      <div className="flex items-center justify-between gap-4">
        {/* Loop Toggle */}
        <Button
          onClick={() => setIsLooping(!isLooping)}
          className={`px-4 py-2 rounded-lg ${
            isLooping
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-gray-700 hover:bg-gray-600'
          } text-white flex items-center gap-2`}
        >
          <RotateCw className="w-4 h-4" />
          <span>Loop</span>
        </Button>

        {/* Fretboard Controls */}
        {hasSelectedDots && onResetFretboard && (
          <Button
            onClick={onResetFretboard}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white"
          >
            Clear
          </Button>
        )}

        {/* Transport Position */}
        <div className="text-white text-sm">
          Position: {transport.position.bars}:{transport.position.beats}:
          {transport.position.sixteenths}
        </div>
      </div>

      {/* Track Status (for debugging) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-2 text-xs text-gray-400">
          Tracks: {getTrackStatus().join(' | ')}
        </div>
      )}
    </div>
  );
};
