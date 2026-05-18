'use client';

/**
 * DrummerWidget Component (Refactored)
 *
 * A compact drum pattern visualizer and editor widget.
 * Uses extracted hooks and components for clean separation of concerns.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { VolumeKnob } from '../components/VolumeKnob.js';
import { useTrack } from '@/domains/playback/hooks/useTrack';
import { useTransportControls } from '@/domains/playback/contexts/TransportContext';
import { withAudioContext } from '@/domains/playback/utils/ensureAudioContext';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { usePatternSelector } from '@/domains/patterns/hooks/usePatternSelector';
import { useAtomicBeat } from '@/domains/widgets/hooks/useAtomicBeat';
import { useBeatGridSync } from '@/domains/widgets/hooks/useBeatGridSync';
import { lifecycle } from '@/domains/playback/utils/InitializationLifecycleLogger.js';
import { getLogger } from '@/utils/logger.js';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry.js';

// Local module imports
import type { DrummerWidgetProps, PatternLibraryItem } from './types.js';
import { useDrumPatternGrid } from './hooks/useDrumPatternGrid.js';
import { useDrumPlugin } from './hooks/useDrumPlugin.js';
import { CompactBeatGrid } from './components/CompactBeatGrid.js';
import { ExpandedPatternEditor } from './components/ExpandedPatternEditor.js';
import {
  createDrumPatternFromPreset,
  convertMidiToDrumPattern,
  createFallbackPatternByGenre,
} from './utils/drum-pattern-utils.js';

const logger = getLogger('drummer-widget');

const DrummerWidgetComponent = ({
  pattern,
  isVisible,
  isPlaying: isPlayingProp,
  exercise,
  tutorialId,
  onPatternChange,
  onToggleVisibility,
  onTogglePlay,
  isAdminMode = false,
  volume: controlledVolume,
  isMuted: controlledMuted,
  onVolumeChange,
  onMuteToggle,
}: DrummerWidgetProps) => {
  const { correlationId, logger: componentLogger } =
    useCorrelation('DrummerWidget');

  // Lifecycle checkpoint
  useEffect(() => {
    lifecycle.checkpoint('DRUMMER_WIDGET_MOUNTED');
  }, []);

  // Get transport controls (stable - no position re-renders)
  const transport = useTransportControls();
  const tempo = transport.tempo;
  const transportRef = useRef(transport);
  useEffect(() => {
    transportRef.current = transport;
  }, [transport]);

  // Atomic beat tracking for jitter-free visuals
  const { eighthNoteIndex: currentBeat, measureIndex: hookMeasure } =
    useAtomicBeat(4, transport.isPlaying, isVisible);

  // Direct DOM beat synchronization
  const { registerIndicator, getEighthNoteDurationMs } = useBeatGridSync({
    rows: 3,
    columns: 8,
    isPlaying: transport.isPlaying,
    activeClass: 'opacity-100',
    inactiveClass: 'opacity-0',
    isVisible,
  });

  // UI state
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPatternLibrary, setShowPatternLibrary] = useState(false);
  const [localVolume, setLocalVolume] = useState(80);
  const [localMuted, setLocalMuted] = useState(false);

  // Controlled/uncontrolled volume handling
  const volume =
    controlledVolume !== undefined ? controlledVolume : localVolume;
  const isMuted = controlledMuted !== undefined ? controlledMuted : localMuted;

  const handleVolumeChange = useCallback(
    (newVolume: number) => {
      if (onVolumeChange) {
        onVolumeChange(newVolume);
      } else {
        setLocalVolume(newVolume);
      }
    },
    [onVolumeChange],
  );

  const handleMuteToggle = useCallback(() => {
    if (onMuteToggle) {
      onMuteToggle();
    } else {
      setLocalMuted(!localMuted);
    }
  }, [onMuteToggle, localMuted]);

  // Create track for drums
  const track = useTrack({
    trackId: 'drummer-widget-track',
    name: 'Drums',
    type: 'drums',
    debugMode: false,
  });
  const trackIsReady = track.isReady;
  const trackRef = useRef(track);
  useEffect(() => {
    trackRef.current = track;
  }, [track]);

  // Track previous exercise ID to detect exercise changes
  const prevExerciseIdRef = useRef<string | undefined>(undefined);
  // Region ref for track pattern management (declared early for cleanup effect)
  const currentRegionRef = useRef<string | null>(null);

  // Handle exercise changes - reset local state only
  // FAANG FIX: Track/region cleanup is now handled centrally by PlaybackEngine.switchExercise()
  // We just need to reset our local region reference here
  useEffect(() => {
    const handleExerciseSwitched = () => {
      logger.debug(
        '[DRUMMER-WIDGET] exercise:switched event received, resetting local state',
      );
      currentRegionRef.current = null;
    };

    window.addEventListener('exercise:switched', handleExerciseSwitched);

    return () => {
      window.removeEventListener('exercise:switched', handleExerciseSwitched);
    };
  }, []);

  // Track exercise ID for logging (not for triggering cleanup)
  useEffect(() => {
    const exerciseId = exercise?.id?.value || exercise?.id;
    if (exerciseId !== prevExerciseIdRef.current) {
      logger.debug('[DRUMMER-WIDGET] Exercise ID changed', {
        previousExerciseId: prevExerciseIdRef.current,
        newExerciseId: exerciseId,
      });
      prevExerciseIdRef.current = exerciseId;
    }
  }, [exercise?.id]);

  // Use TransportContext's isPlaying as authoritative source
  const isPlaying = transport.isPlaying;

  // Calculate current measure for pattern grid
  const { exercisePatternMeasureCount } = useDrumPatternGrid({
    exercise,
    presetPattern: pattern,
    currentMeasure: hookMeasure,
    isPlaying,
  });

  const currentMeasure =
    exercisePatternMeasureCount > 0
      ? hookMeasure % exercisePatternMeasureCount
      : 0;

  // Drum pattern grid hook
  const {
    currentPattern,
    setCurrentPattern,
    isExercisePattern,
    toggleDrum: baseToggleDrum,
  } = useDrumPatternGrid({
    exercise,
    presetPattern: pattern,
    currentMeasure,
    isPlaying,
  });

  // Drum plugin hook
  const { wamPluginLoaded, drummerPluginRef, testDrumSound } = useDrumPlugin({
    trackIsReady,
    exercise,
    volume,
    isMuted,
  });

  // Pattern selector for library
  const patternSelector = tutorialId
    ? usePatternSelector({
        tutorialId,
        onPatternChange: (type, libraryPattern) => {
          if (type === 'drums' && libraryPattern.midiData) {
            handlePatternLibraryChange(libraryPattern);
          }
        },
      })
    : null;

  // Update pattern in track when it changes
  useEffect(() => {
    const currentTrack = trackRef.current;
    if (
      currentTrack &&
      currentTrack.regions &&
      wamPluginLoaded &&
      currentRegionRef.current
    ) {
      const drumPattern = createDrumPatternFromPreset(pattern);
      try {
        const regionExists = currentTrack.regions.some(
          (r: { id: string }) => r.id === currentRegionRef.current,
        );
        if (regionExists) {
          currentTrack.removeRegion(currentRegionRef.current);
        }
      } catch (e) {
        logger.debug('Region already removed, skipping');
      }
      const region = currentTrack.createRegionFromPattern(drumPattern, {
        name: 'Drum Pattern',
        startPosition: '0:0:0',
        duration: `${drumPattern.loopLength}:0:0`,
        loopCount: 0,
      });
      currentRegionRef.current = region.id;
      logger.debug('Updated drum pattern', { pattern, drumPattern });
    }
  }, [pattern, wamPluginLoaded]);

  // Toggle drum with sound feedback
  const toggleDrum = useCallback(
    withAudioContext(
      async (drum: 'kick' | 'snare' | 'hihat', index: number) => {
        baseToggleDrum(drum, index);
        const padMap = { kick: 1, snare: 3, hihat: 5 };
        await testDrumSound(padMap[drum]);
      },
    ),
    [baseToggleDrum, testDrumSound],
  );

  // Handle pattern library change
  const handlePatternLibraryChange = useCallback(
    async (libraryPattern: PatternLibraryItem) => {
      if (libraryPattern.midiFileUrl) {
        try {
          componentLogger.info('Loading pattern from MIDI:', {
            name: libraryPattern.name,
            url: libraryPattern.midiFileUrl,
            correlationId,
          });

          const { useMidiParsing } =
            await import('@/domains/admin/hooks/useMidiParsing');
          const midiParsing = useMidiParsing();

          const parsedData = await midiParsing.parseMidi('drums-midi', {
            midiUrl: libraryPattern.midiFileUrl,
            bpm: tempo,
            timeSignature: { numerator: 4, denominator: 4 },
            totalBars: 2,
          });

          const drumPattern = convertMidiToDrumPattern(parsedData);

          const currentTrack = trackRef.current;
          if (
            currentTrack &&
            currentTrack.createRegionFromPattern &&
            currentRegionRef.current
          ) {
            try {
              if (
                currentTrack.regions?.some(
                  (r: { id: string }) => r.id === currentRegionRef.current,
                )
              ) {
                currentTrack.removeRegion(currentRegionRef.current);
              }
            } catch (e) {
              // Ignore
            }
            const region = currentTrack.createRegionFromPattern(drumPattern, {
              name: libraryPattern.name || 'Drum Pattern',
              startPosition: '0:0:0',
              duration: `${drumPattern.loopLength}:0:0`,
              loopCount: 0,
            });
            currentRegionRef.current = region.id;

            componentLogger.info('Updated drum pattern from MIDI', {
              name: libraryPattern.name,
              events: drumPattern.events.length,
              correlationId,
            });
          }

          onPatternChange(libraryPattern.name);
        } catch (error) {
          componentLogger.error(
            'Failed to load pattern',
            error instanceof Error ? error : new Error(String(error)),
            { correlationId },
          );

          // Fallback to genre-based pattern
          const newPattern = createFallbackPatternByGenre(
            libraryPattern.genre || '',
          );
          setCurrentPattern(newPattern);
          onPatternChange(libraryPattern.name);
        }
      }
    },
    [onPatternChange, componentLogger, correlationId, tempo, setCurrentPattern],
  );

  // Test all drums
  const handleTestAll = useCallback(async () => {
    await testDrumSound(1); // kick
    await new Promise((resolve) => setTimeout(resolve, 200));
    await testDrumSound(3); // snare
    await new Promise((resolve) => setTimeout(resolve, 200));
    await testDrumSound(5); // hihat
  }, [testDrumSound]);

  // Don't return null when not visible - effects need to run
  if (!isVisible) {
    return <div style={{ display: 'none' }} />;
  }

  return (
    <div
      className={`relative bg-gradient-to-br from-slate-800/80 via-slate-800/60 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-white/10 px-4 py-1 h-24 shadow-2xl shadow-black/20 transition-all duration-300 select-none overflow-hidden ${
        volume === 0 || isMuted ? 'grayscale brightness-100' : ''
      }`}
    >
      {/* Glassmorphism overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/10 pointer-events-none" />
      <div className="relative flex items-center justify-between h-full">
        {/* Volume Knob */}
        <div className="flex justify-center items-center w-20 h-16">
          <VolumeKnob
            value={volume}
            onChange={handleVolumeChange}
            color="bg-orange-400"
            size={45}
            isMuted={isMuted}
            onMuteToggle={handleMuteToggle}
            defaultValue={80}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <div className="flex items-center justify-between px-4 py-2">
            {!isExpanded ? (
              <>
                <div className="flex-1">
                  <h3
                    className={`font-semibold text-sm ${
                      volume === 0 ? 'text-slate-600' : 'text-white'
                    }`}
                  >
                    Drums Track
                  </h3>
                  <p
                    className={`text-xs ${
                      volume === 0 ? 'text-slate-600' : 'text-slate-400'
                    }`}
                  >
                    {isExercisePattern
                      ? 'Exercise Pattern'
                      : `${pattern} | ${wamPluginLoaded ? 'Ready' : 'Loading...'}`}
                  </p>
                </div>

                <button
                  onClick={() => setIsExpanded(true)}
                  className={`flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800 shadow-[5px_5px_10px_rgba(0,0,0,0.5),-5px_-5px_10px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300 cursor-pointer ${
                    volume === 0 ? 'opacity-50' : ''
                  }`}
                >
                  <CompactBeatGrid
                    pattern={currentPattern}
                    registerIndicator={registerIndicator}
                    getEighthNoteDurationMs={getEighthNoteDurationMs}
                  />
                </button>
              </>
            ) : (
              <ExpandedPatternEditor
                patternName={pattern}
                currentPattern={currentPattern}
                currentBeat={currentBeat}
                isPlaying={isPlaying}
                tutorialId={tutorialId}
                showPatternLibrary={showPatternLibrary}
                isPatternLibraryLoading={patternSelector?.isLoading ?? false}
                availableDrumPatterns={
                  patternSelector?.availableDrumPatterns ?? []
                }
                selectedDrumPattern={patternSelector?.selectedDrumPattern}
                onPatternChange={onPatternChange}
                onTogglePatternLibrary={() =>
                  setShowPatternLibrary(!showPatternLibrary)
                }
                onSelectLibraryPattern={(p) => {
                  patternSelector?.selectDrumPattern(p);
                  handlePatternLibraryChange(p);
                  setShowPatternLibrary(false);
                }}
                onToggleDrum={toggleDrum}
                onTestDrum={testDrumSound}
                onClose={() => setIsExpanded(false)}
                onTestAll={handleTestAll}
                trackIsReady={trackIsReady}
              />
            )}
          </div>
        </div>
      </div>

      {/* Play Control (if provided) */}
      {onTogglePlay && isExpanded && (
        <div className="absolute bottom-2 right-2">
          <button
            onClick={onTogglePlay}
            className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
              isPlaying
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
            disabled={!trackIsReady}
          >
            {isPlaying ? 'Stop' : 'Play'}
          </button>
        </div>
      )}
    </div>
  );
};

// Wrap in React.memo to prevent unnecessary re-renders
export const DrummerWidget = React.memo(DrummerWidgetComponent);
