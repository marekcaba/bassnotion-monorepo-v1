'use client';

/**
 * BassLineWidget Component (Refactored)
 *
 * A compact bass widget for displaying and playing bass patterns.
 * Uses extracted hooks and components for clean separation of concerns.
 *
 * This refactored version serves as a minimal orchestrator (~250 lines),
 * delegating complex logic to specialized hooks and rendering to sub-components.
 */

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { VolumeKnob } from '../components/VolumeKnob.js';
import { useTrack } from '@/domains/playback/hooks/useTrack';
import { useTransportControls } from '@/domains/playback/contexts/TransportContext';
import { getLogger } from '@/utils/logger.js';
import { GlobalSampleCache } from '@/domains/playback/modules/storage/cache/GlobalSampleCache';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry.js';
import { isVerboseDebugEnabled } from '@/config/debug';

// Local module imports
import type {
  BassLineWidgetProps,
  BassArticulationType,
  BassNote,
  CurrentlyPlayingNote,
  FretWindow,
} from './types.js';
import { BassArticulation, BASS_PATTERNS } from './types.js';
import { useVolumeControl } from './hooks/useVolumeControl.js';
import { useBassAudioContext } from './hooks/useBassAudioContext.js';
import { useSampleLoadingSync } from './hooks/useSampleLoadingSync.js';
import { useBassBufferRegistration } from './hooks/useBassBufferRegistration.js';
import { useBassPlayback } from './hooks/useBassPlayback.js';
import { useBassEventBus } from './hooks/useBassEventBus.js';
import { MiniFretboard, ExpandedControls } from './components/index.js';

const logger = getLogger('bassline-widget');

const BassLineWidgetComponent = ({
  pattern,
  isVisible,
  isPlaying,
  exercise,
  onPatternChange,
  onToggleVisibility,
  onTogglePlay,
  isAdminMode = false,
  volume: controlledVolume,
  isMuted: controlledMuted,
  onVolumeChange,
  onMuteToggle,
}: BassLineWidgetProps) => {
  // Get tempo from Transport controls (stable - no position re-renders)
  const transport = useTransportControls();
  const tempo = transport.tempo;

  // UI state
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentArticulation, setCurrentArticulation] =
    useState<BassArticulationType>(BassArticulation.FINGERSTYLE);
  const [selectedNotes, setSelectedNotes] = useState<BassNote[]>([]);
  const [currentlyPlayingNote, setCurrentlyPlayingNote] =
    useState<CurrentlyPlayingNote | null>(null);

  // Bass buffers ref (shared across hooks)
  const bassBuffersRef = useRef<Record<string, AudioBuffer>>({});

  // Create track for bass
  const track = useTrack({
    trackId: 'bass-widget-track',
    name: 'Bass',
    type: 'bass',
    debugMode: false,
  });
  const trackIsReady = track.isReady;

  // Audio context hook
  const {
    audioContextRef,
    gainNodeRef,
    samplerReady,
    samplesLoaded,
    totalSamples,
    setSamplesLoaded,
    setTotalSamples,
    setSamplerReady,
  } = useBassAudioContext({
    isMuted: controlledMuted ?? false,
    volume: controlledVolume ?? 80,
  });

  // Volume control hook
  const { volume, isMuted, handleVolumeChange, handleMuteToggle } = useVolumeControl({
    controlledVolume,
    controlledMuted,
    onVolumeChange,
    onMuteToggle,
    gainNodeRef,
    audioContextRef,
  });

  // Sample loading sync hook
  const { samplesLoadedTrigger } = useSampleLoadingSync();

  // Calculate bass note count (stable primitive for dependency arrays)
  const bassNoteCount = useMemo(() => {
    return (
      exercise?.notes?.filter(
        (note: { string: number }) => note.string >= 1 && note.string <= 5
      )?.length || 0
    );
  }, [exercise?.notes]);

  // Callbacks for buffer registration
  const handleSamplesLoaded = useCallback((loaded: number, total: number) => {
    setSamplesLoaded(loaded);
    setTotalSamples(total);
  }, [setSamplesLoaded, setTotalSamples]);

  const handleSamplerReady = useCallback((ready: boolean) => {
    setSamplerReady(ready);
  }, [setSamplerReady]);

  // Buffer registration hook
  useBassBufferRegistration({
    exercise,
    samplesLoadedTrigger,
    trackIsReady,
    bassNoteCount,
    volume,
    isMuted,
    bassBuffersRef,
    onSamplesLoaded: handleSamplesLoaded,
    onSamplerReady: handleSamplerReady,
  });

  // Playback hook
  const { playBassNote, stopAllNotes, patternNotes, testNote } = useBassPlayback({
    audioContextRef,
    gainNodeRef,
    bassBuffersRef,
    tempo,
    isPlaying,
    trackIsReady,
    samplerReady,
    exercise,
    pattern,
  });

  // Callbacks for event bus
  const handleNoteTrigger = useCallback(
    (note: CurrentlyPlayingNote, duration: number) => {
      setCurrentlyPlayingNote(note);
      // Clear visual after note duration
      setTimeout(() => {
        setCurrentlyPlayingNote(null);
        if (!isPlaying) {
          setSelectedNotes([]);
        }
      }, duration * 1000);
    },
    [isPlaying]
  );

  const handleSelectedNotesChange = useCallback((notes: BassNote[]) => {
    setSelectedNotes(notes);
  }, []);

  // Event bus hook
  useBassEventBus({
    audioContextRef,
    samplerReady,
    trackIsPlaying: track.isPlaying,
    onNoteTrigger: handleNoteTrigger,
    onSelectedNotesChange: handleSelectedNotesChange,
  });

  // Track previous exercise ID to detect exercise changes
  const prevExerciseIdRef = useRef<string | undefined>(undefined);

  // Handle exercise changes - clear state ONLY when switching between exercises
  // (not on first mount - that would clear the buffers that were just registered)
  useEffect(() => {
    const exerciseId =
      typeof exercise?.id === 'object' ? exercise?.id?.value : exercise?.id;

    // Skip if no exercise or same exercise
    if (!exerciseId || exerciseId === prevExerciseIdRef.current) {
      prevExerciseIdRef.current = exerciseId;
      return;
    }

    // Only clear buffers if there was a PREVIOUS exercise
    // On first mount, prevExerciseIdRef.current is undefined, so we skip clearing
    // This prevents wiping out freshly-registered buffers
    if (prevExerciseIdRef.current !== undefined) {
      logger.info('Exercise changed, clearing bass state', {
        previousExerciseId: prevExerciseIdRef.current,
        newExerciseId: exerciseId,
        hasNotes: !!exercise?.notes?.length,
      });

      stopAllNotes(false);
      setSelectedNotes([]);
      setCurrentlyPlayingNote(null);

      // Clear bass buffers from PlaybackEngine
      const coreServices = WindowRegistry.getCoreServices();
      const playbackEngine = coreServices?.getPlaybackEngine?.();
      if (playbackEngine?.clearBassBuffers) {
        playbackEngine.clearBassBuffers();
        logger.debug('[BASS-WIDGET] Cleared bass buffers for exercise switch');
      }

      // Clear local buffer cache
      bassBuffersRef.current = {};
    } else {
      logger.debug('[BASS-WIDGET] First mount with exercise, skipping buffer clear', {
        exerciseId,
      });
    }

    prevExerciseIdRef.current = exerciseId;

    // Check for new bass metadata (always do this, even on first mount)
    const metadata = GlobalSampleCache.getInstance().getMetadata('bass-required-notes');
    if (metadata && metadata.exerciseId === exerciseId) {
      logger.info('Bass metadata available for exercise', {
        noteCount: metadata.midiNotes?.length || 0,
      });
      setTotalSamples(metadata.midiNotes?.length || 0);
    }
  }, [exercise?.id, stopAllNotes, setTotalSamples]);

  // Handle articulation changes
  const handleArticulationChange = useCallback((articulation: BassArticulationType) => {
    setCurrentArticulation(articulation);
  }, []);

  // Handle test note with visual feedback
  const handleTestNote = useCallback(() => {
    if (samplerReady) {
      testNote();
      // Visual feedback
      setCurrentlyPlayingNote({ midiNote: 28, string: 1, fret: 0 });
      setSelectedNotes([{ note: 28, string: 1, fret: 0, beat: 0 }]);
      setTimeout(() => {
        setCurrentlyPlayingNote(null);
        setSelectedNotes([]);
      }, 500);
    }
  }, [samplerReady, testNote]);

  // Fretboard visualization helpers
  const fretWindow = useMemo((): FretWindow => {
    const windowSize = 8;

    if (selectedNotes.length === 0) {
      return { start: 0, end: 7, showOpenString: true };
    }

    const fretPositions = selectedNotes
      .map((note) => note.fret)
      .filter((fret) => typeof fret === 'number' && fret > 0)
      .sort((a, b) => a - b);

    if (fretPositions.length === 0) {
      return { start: 0, end: 7, showOpenString: true };
    }

    const minFret = Math.max(0, fretPositions[0] - 1);
    const maxFret = fretPositions[fretPositions.length - 1];

    // Try to include 12th fret if possible
    if (minFret <= 12 && maxFret >= 12) {
      return { start: Math.max(0, 12 - 4), end: 12 + 3, showOpenString: false };
    }

    return {
      start: minFret,
      end: Math.min(minFret + windowSize - 1, 24),
      showOpenString: minFret === 0,
    };
  }, [selectedNotes]);

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
            color="bg-purple-400"
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
                    Bass Track
                  </h3>
                  <p
                    className={`text-xs ${
                      isMutedOrZero ? 'text-slate-600' : 'text-slate-400'
                    }`}
                  >
                    {pattern} | {currentArticulation}
                  </p>
                </div>

                <MiniFretboard
                  selectedNotes={selectedNotes}
                  currentlyPlayingNote={currentlyPlayingNote}
                  fretWindow={fretWindow}
                  volume={volume}
                  onClick={() => setIsExpanded(true)}
                />
              </>
            ) : (
              <ExpandedControls
                pattern={pattern}
                currentArticulation={currentArticulation}
                samplerReady={samplerReady}
                samplesLoaded={samplesLoaded}
                totalSamples={totalSamples}
                availablePatterns={Object.keys(BASS_PATTERNS)}
                onPatternChange={onPatternChange}
                onArticulationChange={handleArticulationChange}
                onTestNote={handleTestNote}
                onClose={() => setIsExpanded(false)}
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
            className={`px-3 py-1 text-xs rounded font-medium transition-colors disabled:opacity-50 ${
              isPlaying
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
            disabled={!samplerReady}
          >
            {isPlaying ? 'Stop' : 'Play'}
          </button>
        </div>
      )}
    </div>
  );
};

// Wrap in React.memo to prevent unnecessary re-renders
export const BassLineWidget = React.memo(BassLineWidgetComponent);
