'use client';

/**
 * HarmonyWidget Component (Refactored)
 *
 * A compact harmony widget for displaying and playing chord progressions.
 * Uses extracted hooks and components for clean separation of concerns.
 *
 * This refactored version serves as a minimal orchestrator (~200 lines),
 * delegating complex logic to specialized hooks and rendering to sub-components.
 */

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { VolumeKnob } from '../components/VolumeKnob.js';
import { useTrack } from '@/domains/playback/hooks/useTrack';
import { useTransportControls } from '@/domains/playback/contexts/TransportContext';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { usePatternSelector } from '@/domains/patterns/hooks/usePatternSelector';
import { useSyncContext } from '../../base/SyncProvider.js';
import { useVisualBeat } from '@/domains/widgets/hooks/useVisualBeat';
import { useMeasureSync } from '@/domains/widgets/hooks/useBeatGridSync';
import { lifecycle } from '@/domains/playback/utils/InitializationLifecycleLogger.js';

// Local module imports
import type { HarmonyWidgetProps, HarmonyExercise } from './types.js';
import { useVolumeControl } from './hooks/useVolumeControl.js';
import { useHarmonyInstrument } from './hooks/useHarmonyInstrument.js';
import { useChordProgression } from './hooks/useChordProgression.js';
import { useHarmonyPlugin } from './hooks/useHarmonyPlugin.js';
import { useSampleLoadingSync } from './hooks/useSampleLoadingSync.js';
import { useHarmonyRegistration } from './hooks/useHarmonyRegistration.js';
import {
  HarmonyDisplay,
  InstrumentSelector,
  ChordProgressionView,
  PatternLibraryButton,
} from './components/index.js';

const HarmonyWidgetComponent = ({
  progression = ['CMaj7', 'Am7', 'Dm7', 'G7'],
  currentChord: _currentChord = 0,
  isPlaying,
  isVisible,
  tutorialId,
  harmonyInstrument,
  exercise,
  onNextChord = () => {},
  onProgressionChange,
  onToggleVisibility: _onToggleVisibility,
  onTogglePlay,
  isAdminMode: _isAdminMode = false,
  volume: controlledVolume,
  isMuted: controlledMuted,
  onVolumeChange,
  onMuteToggle,
}: HarmonyWidgetProps) => {
  // useCorrelation was called for the side effect of generating a
  // correlation ID and binding it to logs; the value isn't read here.
  useCorrelation('HarmonyWidget');

  // Lifecycle checkpoint
  useEffect(() => {
    lifecycle.checkpoint('HARMONY_WIDGET_MOUNTED');
  }, []);

  // Get transport controls (stable - no position re-renders)
  const transport = useTransportControls();
  const tempo = transport.tempo;

  // UI state
  const [isExpanded, setIsExpanded] = useState(false);

  // Refs for stable references
  const exerciseRef = useRef<HarmonyExercise | undefined>(exercise);
  const isPlayingRef = useRef(isPlaying);

  useEffect(() => {
    exerciseRef.current = exercise;
  }, [exercise]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Calculate harmony note count (stable primitive for dependency arrays)
  const harmonyNoteCount = useMemo(() => {
    return exercise?.harmonyNotes?.length || 0;
  }, [exercise?.harmonyNotes]);

  // Create track for harmony
  const track = useTrack({
    trackId: 'harmony-widget-track',
    name: 'Harmony',
    type: 'harmony',
    debugMode: true,
  });
  const trackIsReady = track.isReady;

  // Get sync context
  const syncContext = useSyncContext();

  // Visual beat tracking for jitter-free UI — only measureIndex is
  // currently consumed (the indicator updates per measure, not per beat).
  const { measureIndex } = useVisualBeat(4, isPlaying, isVisible);

  // Direct DOM chord synchronization
  const { registerChordIndicator } = useMeasureSync({
    chordCount: progression.length,
    isPlaying,
    activeClass: 'bg-blue-400 text-white shadow-lg shadow-blue-400/50',
    inactiveClass: 'bg-slate-700 text-slate-400',
    isVisible,
  });

  // Sample loading sync hook
  const { samplesLoadedTrigger } = useSampleLoadingSync({
    subscribeToEvent: syncContext?.subscribeToEvent,
  });

  // Volume control hook
  const { volume, isMuted, handleVolumeChange, handleMuteToggle } =
    useVolumeControl({
      controlledVolume,
      controlledMuted,
      onVolumeChange,
      onMuteToggle,
    });

  // Instrument hook
  const {
    currentInstrument,
    currentInstrumentRef,
    setCurrentInstrument,
    handleInstrumentChange,
  } = useHarmonyInstrument({
    harmonyInstrumentProp: harmonyInstrument,
    exercise: exercise as HarmonyExercise,
  });

  // Chord progression hook
  const {
    selectedProgression,
    localCurrentChord,
    handleProgressionChange,
    handlePatternLibraryChange,
    showPatternLibrary,
    setShowPatternLibrary,
    availableProgressions,
  } = useChordProgression({
    progression,
    measureIndex,
    isPlaying,
    onProgressionChange,
    tempo,
  });

  // Plugin hook — pluginClassLoaded / audioServicesReady /
  // createAudioNodeAttempt are exposed for debugging/observability but
  // not consumed by the widget itself; underscore-prefix to silence
  // no-unused-vars while keeping the destructure intact for clarity
  // about what the hook returns.
  const {
    wamPluginLoaded,
    pluginClassLoaded: _pluginClassLoaded,
    audioServicesReady: _audioServicesReady,
    keyboardPluginRef,
    createAudioNodeAttempt: _createAudioNodeAttempt,
    testChord,
  } = useHarmonyPlugin({
    trackIsReady,
    currentInstrumentRef,
    currentInstrument,
    setCurrentInstrument,
    exercise: exercise as HarmonyExercise,
    volume,
    isMuted,
    samplesLoadedTrigger,
  });

  // Registration hook — kept calling for the side effects inside it
  // (registers the harmony track with PlaybackEngine + schedules the
  // chord progression on Transport). The returned imperative APIs
  // (registerHarmonyWithPlaybackEngine, scheduleProgression) are not
  // invoked from this file.
  const {
    registerHarmonyWithPlaybackEngine: _registerHarmonyWithPlaybackEngine,
    scheduleProgression: _scheduleProgression,
  } = useHarmonyRegistration({
    exercise: exercise as HarmonyExercise,
    exerciseRef: exerciseRef as React.RefObject<HarmonyExercise | undefined>,
    keyboardPluginRef,
    currentInstrument,
    setCurrentInstrument,
    trackIsReady,
    wamPluginLoaded,
    samplesLoadedTrigger,
    isPlaying,
    isPlayingRef,
    harmonyNoteCount,
    volume,
    isMuted,
    selectedProgression,
    onNextChord,
  });

  // Pattern selector for library
  const patternSelector = tutorialId
    ? usePatternSelector({
        tutorialId,
        onPatternChange: (type, pattern) => {
          if (type === 'harmony' && pattern.midiData) {
            handlePatternLibraryChange(pattern);
          }
        },
      })
    : null;

  // Don't render when not visible
  if (!isVisible) return null;

  const isMutedOrZero = volume === 0 || isMuted;

  return (
    <div
      className={`relative bg-gradient-to-br from-slate-800/80 via-slate-800/60 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-white/10 px-4 py-1 h-24 shadow-2xl shadow-black/20 transition-all duration-300 select-none overflow-hidden ${
        isMutedOrZero ? 'grayscale brightness-100' : ''
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
            color="bg-blue-400"
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
                      isMutedOrZero ? 'text-slate-600' : 'text-white'
                    }`}
                  >
                    Harmony Track
                  </h3>
                  <p
                    className={`text-xs ${
                      isMutedOrZero ? 'text-slate-600' : 'text-slate-400'
                    }`}
                  >
                    {currentInstrument} | {selectedProgression}
                  </p>
                </div>

                <button
                  onClick={() => setIsExpanded(true)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 shadow-[5px_5px_10px_rgba(0,0,0,0.5),-5px_-5px_10px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300 cursor-pointer ${
                    isMutedOrZero ? 'opacity-50' : ''
                  }`}
                >
                  <HarmonyDisplay
                    progression={progression}
                    currentChordIndex={localCurrentChord}
                    isMuted={isMuted}
                    volume={volume}
                    registerChordIndicator={registerChordIndicator}
                  />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-4 w-full">
                <div className="flex-1">
                  <div className="flex flex-col gap-2">
                    <InstrumentSelector
                      currentInstrument={currentInstrument}
                      onInstrumentChange={handleInstrumentChange}
                    />

                    <div className="flex items-center gap-2">
                      <ChordProgressionView
                        progression={progression}
                        selectedProgression={selectedProgression}
                        availableProgressions={availableProgressions}
                        onProgressionChange={handleProgressionChange}
                        registerChordIndicator={registerChordIndicator}
                      />
                      {tutorialId && (
                        <PatternLibraryButton
                          isOpen={showPatternLibrary}
                          onToggle={() =>
                            setShowPatternLibrary(!showPatternLibrary)
                          }
                          isLoading={patternSelector?.isLoading ?? false}
                          patterns={
                            patternSelector?.availableHarmonyPatterns ?? []
                          }
                          selectedPattern={
                            patternSelector?.selectedHarmonyPattern
                          }
                          onPatternSelect={(p) => {
                            patternSelector?.selectHarmonyPattern(p);
                            handlePatternLibraryChange(p);
                            setShowPatternLibrary(false);
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={testChord}
                    className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
                    disabled={!track.isReady}
                  >
                    Test
                  </button>
                  <button
                    onClick={() => setIsExpanded(false)}
                    className="px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
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
            disabled={!track.isReady}
          >
            {isPlaying ? 'Stop' : 'Play'}
          </button>
        </div>
      )}
    </div>
  );
};

// Wrap in React.memo to prevent unnecessary re-renders
export const HarmonyWidget = React.memo(HarmonyWidgetComponent);
