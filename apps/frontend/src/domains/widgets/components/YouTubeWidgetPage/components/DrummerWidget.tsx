'use client';

import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { VolumeKnob } from './VolumeKnob';
import { useTrack } from '@/domains/playback/hooks/useTrack';
import { useTransportContext } from '@/domains/playback/contexts/TransportContext';
import {
  ensureAudioContext,
  withAudioContext,
} from '@/domains/playback/utils/ensureAudioContext';
import { getLogger } from '@/utils/logger.js';
import type { Exercise, DrumHit, MidiDrumType } from '@bassnotion/contracts';
import type {
  DrumPattern,
  DrumPatternEvent,
} from '@/domains/playback/types/pattern';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { usePatternSelector } from '@/domains/patterns/hooks/usePatternSelector';
import { useAtomicBeat } from '@/domains/widgets/hooks/useAtomicBeat';
import { useBeatGridSync } from '@/domains/widgets/hooks/useBeatGridSync';
import { Settings2, Music2 } from 'lucide-react';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry.js';
import { lifecycle } from '@/domains/playback/utils/InitializationLifecycleLogger.js';

interface DrummerWidgetProps {
  pattern: string;
  isVisible: boolean;
  isPlaying: boolean;
  exercise?: Exercise;
  tutorialId?: string;
  onPatternChange: (pattern: string) => void;
  onToggleVisibility?: () => void;
  onTogglePlay?: () => void;
  isAdminMode?: boolean;
  /** Controlled volume (0-100). If provided, widget uses this instead of local state */
  volume?: number;
  /** Controlled mute state. If provided, widget uses this instead of local state */
  isMuted?: boolean;
  /** Callback when volume changes (for controlled mode) */
  onVolumeChange?: (volume: number) => void;
  /** Callback when mute state changes (for controlled mode) */
  onMuteToggle?: () => void;
}

// Helper to convert simple array to GridCell array (for preset patterns)
const toPresetGridCells = (arr: number[]): { main: number; sixteenth: number }[] =>
  arr.map((v) => ({ main: v, sixteenth: 0 }));

// Drum pattern presets with GridCell format
const drumPatterns = {
  'Rock Steady': {
    kick: toPresetGridCells([1, 0, 0, 0, 1, 0, 0, 0]),
    snare: toPresetGridCells([0, 0, 1, 0, 0, 0, 1, 0]),
    hihat: toPresetGridCells([1, 1, 1, 1, 1, 1, 1, 1]),
  },
  'Jazz Swing': {
    kick: toPresetGridCells([1, 0, 0, 0, 0, 0, 1, 0]),
    snare: toPresetGridCells([0, 0, 0, 0, 1, 0, 0, 0]),
    hihat: toPresetGridCells([1, 0, 1, 1, 0, 1, 1, 0]),
  },
  'Bossa Nova': {
    kick: toPresetGridCells([1, 0, 0, 1, 0, 0, 1, 0]),
    snare: toPresetGridCells([0, 0, 1, 0, 0, 1, 0, 0]),
    hihat: toPresetGridCells([1, 0, 1, 0, 1, 0, 1, 0]),
  },
  'Funk Groove': {
    kick: toPresetGridCells([1, 0, 0, 1, 0, 0, 1, 0]),
    snare: toPresetGridCells([0, 1, 0, 1, 0, 0, 1, 0]),
    hihat: toPresetGridCells([1, 1, 0, 1, 1, 0, 1, 1]),
  },
  Latin: {
    kick: toPresetGridCells([1, 0, 0, 1, 0, 1, 0, 0]),
    snare: toPresetGridCells([0, 0, 1, 0, 1, 0, 1, 0]),
    hihat: toPresetGridCells([1, 1, 1, 0, 1, 1, 1, 0]),
  },
  Shuffle: {
    kick: toPresetGridCells([1, 0, 1, 0, 1, 0, 1, 0]),
    snare: toPresetGridCells([0, 0, 1, 0, 0, 0, 1, 0]),
    hihat: toPresetGridCells([1, 0, 1, 1, 0, 1, 1, 0]),
  },
};

const logger = getLogger('drummer-widget');

/**
 * Map MIDI note numbers to drum types (General MIDI drum map)
 */
const MIDI_DRUM_MAP: Record<number, 'kick' | 'snare' | 'hihat'> = {
  36: 'kick', // Bass Drum 1
  35: 'kick', // Acoustic Bass Drum
  38: 'snare', // Acoustic Snare
  40: 'snare', // Electric Snare
  42: 'hihat', // Closed Hi-Hat
  44: 'hihat', // Pedal Hi-Hat
  46: 'hihat', // Open Hi-Hat
};

/**
 * Map MidiDrumType to the 3 basic grid types (kick, snare, hihat)
 * Groups various drum types into the three main categories for the compact grid
 */
const DRUM_TYPE_TO_GRID: Record<
  MidiDrumType,
  'kick' | 'snare' | 'hihat' | null
> = {
  kick: 'kick',
  snare: 'snare',
  snare_rimshot: 'snare',
  hihat: 'hihat',
  hihat_closed: 'hihat',
  hihat_open: 'hihat',
  hihat_pedal: 'hihat',
  crash: null, // Not displayed in compact grid
  ride: null, // Not displayed in compact grid
  ride_bell: null,
  tom_low: null,
  tom_mid: null,
  tom_high: null,
  floor_tom: null,
  cowbell: null,
  tambourine: null,
  clap: 'snare', // Map clap to snare row
  unknown: null,
};

/**
 * Empty grid pattern (all zeros) - used when no drum data exists
 * Each cell has main (8th note) and sixteenth (16th subdivision) properties
 */
const EMPTY_GRID_PATTERN: GridPatternWithSixteenths = {
  kick: Array.from({ length: 8 }, () => ({ main: 0, sixteenth: 0 })),
  snare: Array.from({ length: 8 }, () => ({ main: 0, sixteenth: 0 })),
  hihat: Array.from({ length: 8 }, () => ({ main: 0, sixteenth: 0 })),
};

/**
 * Get the number of unique measures in a drum pattern
 * Used to determine if we need to dynamically switch grid display during playback
 *
 * @param hits - Array of DrumHit from the converted MIDI data
 * @returns Number of measures (1-based count)
 */
function getPatternMeasureCount(hits: DrumHit[]): number {
  if (!hits || hits.length === 0) return 1;
  const maxMeasure = Math.max(...hits.map((h) => h.position.measure || 0));
  return maxMeasure + 1; // Convert 0-based max to count
}

/**
 * Grid cell data structure that tracks main 8th note hits and 16th note subdivisions
 * - main: 1 if there's a hit on the 8th note position (tick 0-119 or 240-359)
 * - sixteenth: 1 if there's a hit on the "e" or "a" subdivision (tick 120-239 or 360-479)
 */
interface GridCell {
  main: number;      // Hit on the main 8th note position
  sixteenth: number; // Hit on the 16th note subdivision after this position
}

/**
 * Grid pattern with 8 cells per row, each tracking main hit and 16th subdivision
 */
interface GridPatternWithSixteenths {
  kick: GridCell[];
  snare: GridCell[];
  hihat: GridCell[];
}

/**
 * Convert DrumHit[] (from exercise.drumPattern) to the compact 3x8 grid format
 * Maps drum hits to their beat positions in an 8-beat (1 bar) grid
 * Tracks both main 8th note positions and 16th note subdivisions
 *
 * @param hits - Array of DrumHit from the converted MIDI data
 * @param beatsPerBar - Number of beats per bar (default 4 for 4/4 time)
 * @param targetMeasure - Which measure to display (0-based, default 0)
 * @returns Grid pattern with kick[], snare[], hihat[] arrays containing GridCell objects
 */
function drumHitsToGridPattern(
  hits: DrumHit[],
  beatsPerBar = 4,
  targetMeasure = 0, // Which measure to display (0-based)
): GridPatternWithSixteenths {
  // The compact 3x8 grid shows ONE bar only (8 eighth notes in 4/4)
  // 4 quarter note beats × 2 eighth notes per beat = 8 columns
  const GRID_COLUMNS = 8;
  const EIGHTH_NOTES_PER_BEAT = 2;

  // Initialize empty grid with GridCell objects
  const createEmptyRow = (): GridCell[] =>
    Array.from({ length: GRID_COLUMNS }, () => ({ main: 0, sixteenth: 0 }));

  const grid: GridPatternWithSixteenths = {
    kick: createEmptyRow(),
    snare: createEmptyRow(),
    hihat: createEmptyRow(),
  };

  if (!hits || hits.length === 0) {
    return grid;
  }

  // Process each drum hit - only show hits from the target measure
  // 480 PPQ timing breakdown per beat:
  // - tick 0-119: main downbeat (1st 16th note)
  // - tick 120-239: "e" subdivision (2nd 16th note) - shown as small tick after downbeat
  // - tick 240-359: main upbeat (3rd 16th note, the "and")
  // - tick 360-479: "a" subdivision (4th 16th note) - shown as small tick after upbeat
  const PPQ = 480;
  const TICKS_PER_16TH = PPQ / 4; // 120 ticks per 16th note

  for (const hit of hits) {
    // Only process hits from the target measure
    const measureIndex = hit.position.measure || 0;
    if (measureIndex !== targetMeasure) continue;

    // Map the drum type to one of the 3 grid rows
    const gridType = DRUM_TYPE_TO_GRID[hit.drum];
    if (!gridType) continue;

    const beat = hit.position.beat || 0;
    const tick = hit.position.tick ?? 0;

    // Determine which 16th note subdivision within the beat
    const sixteenthInBeat = Math.floor(tick / TICKS_PER_16TH); // 0, 1, 2, or 3

    // Map to grid column and position type:
    // sixteenthInBeat 0 -> column beat*2, main hit
    // sixteenthInBeat 1 -> column beat*2, sixteenth tick (the "e")
    // sixteenthInBeat 2 -> column beat*2+1, main hit (the "and")
    // sixteenthInBeat 3 -> column beat*2+1, sixteenth tick (the "a")
    const gridColumn = beat * EIGHTH_NOTES_PER_BEAT + Math.floor(sixteenthInBeat / 2);
    const isSixteenthSubdivision = sixteenthInBeat % 2 === 1;

    if (gridColumn >= 0 && gridColumn < GRID_COLUMNS) {
      if (isSixteenthSubdivision) {
        grid[gridType][gridColumn].sixteenth = 1;
      } else {
        grid[gridType][gridColumn].main = 1;
      }
    }
  }

  logger.debug('🥁 Converted drum hits to grid pattern with 16th notes', {
    totalHits: hits.length,
    gridKick: {
      main: grid.kick.filter((c) => c.main === 1).length,
      sixteenth: grid.kick.filter((c) => c.sixteenth === 1).length,
    },
    gridSnare: {
      main: grid.snare.filter((c) => c.main === 1).length,
      sixteenth: grid.snare.filter((c) => c.sixteenth === 1).length,
    },
    gridHihat: {
      main: grid.hihat.filter((c) => c.main === 1).length,
      sixteenth: grid.hihat.filter((c) => c.sixteenth === 1).length,
    },
  });

  return grid;
}

/**
 * Convert parsed MIDI data to DrumPattern format
 */
function convertMidiToDrumPattern(parsedData: any): DrumPattern {
  const pattern: DrumPattern = {
    id: 'drum-pattern-from-midi',
    events: [],
    loopLength: parsedData.metadata?.totalBars || 2,
  };

  logger.info('🥁 Converting MIDI to drum pattern', {
    totalBars: parsedData.metadata?.totalBars,
    measureCount: parsedData.measures?.length,
    timeSignature: parsedData.metadata?.timeSignature,
  });

  // Process each measure
  parsedData.measures?.forEach((measure: any, measureIndex: number) => {
    measure.notes?.forEach((note: any) => {
      // Map MIDI note to drum type
      const drumType = MIDI_DRUM_MAP[note.pitch];

      if (drumType) {
        // Calculate position within the measure
        const timeInMeasure = note.time - measure.startTime;
        const measureDuration = measure.endTime - measure.startTime;
        const beatsPerMeasure =
          parsedData.metadata?.timeSignature?.numerator || 4;
        const beatDuration = measureDuration / beatsPerMeasure;

        const beat = Math.floor(timeInMeasure / beatDuration);
        const sixteenth = Math.floor(
          ((timeInMeasure % beatDuration) / beatDuration) * 16,
        );

        const event: DrumPatternEvent = {
          position: {
            measure: measureIndex,
            beat: beat,
            subdivision: sixteenth,
            tick: 0, // Drums typically use 16th note precision
          },
          drum: drumType,
          velocity: note.velocity / 127, // Normalize from 0-127 to 0-1
          duration: '16n',
        };

        pattern.events.push(event);
        logger.info(
          `🥁 Added drum event: ${drumType} at ${measureIndex}:${beat}:${sixteenth}`,
          {
            velocity: event.velocity.toFixed(2),
            position: event.position,
          },
        );
      }
    });
  });

  logger.info(`🥁 Drum pattern created with ${pattern.events.length} events`);
  return pattern;
}

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

  // Lifecycle checkpoint: Widget mounted
  useEffect(() => {
    lifecycle.checkpoint('DRUMMER_WIDGET_MOUNTED');
  }, []);

  // DEBUG: Log exercise object to understand what we're receiving
  useEffect(() => {
    if (exercise) {
      console.log('🥁 DrummerWidget received exercise:', {
        id: exercise.id,
        title: exercise.title,
        drummerMidiUrl: exercise.drummerMidiUrl,
        hasDrummerMidi: exercise.hasDrummerMidi?.(),
        fullExercise: exercise,
      });
    }
  }, [exercise?.id]);

  // Get tempo directly from Transport (single source of truth)
  const transport = useTransportContext();
  const tempo = transport.tempo;

  // Store transport in ref to prevent infinite loops (transport object changes every render)
  const transportRef = useRef(transport);
  useEffect(() => {
    transportRef.current = transport;
  }, [transport]);

  // 🎯 FAA-GRADE ATOMIC CLOCK: Use the AtomicPlaybackClock for jitter-free visual sync
  // This uses the SAME transportStartTime as PlaybackEngine with lookahead compensation,
  // ensuring visuals show ACTUAL audio position (not where audio WILL BE).
  // Note: Use transport.isPlaying directly since the derived isPlaying variable is defined later
  // Note: isCountdown and eighthNoteDurationMs are extracted but unused since beat indicator
  // is now handled by useBeatGridSync direct DOM updates (see jitter fix below)
  const {
    eighthNoteIndex: currentBeat,
    measureIndex: hookMeasure,
    isCountdown: _isCountdown,
    eighthNoteDurationMs: _eighthNoteDurationMs,
  } = useAtomicBeat(
    4, // beatsPerMeasure
    transport.isPlaying,
    isVisible,
  );

  // 🚀 JITTER FIX: Direct DOM beat synchronization (bypasses React state)
  // This hook subscribes directly to AtomicPlaybackClock and updates DOM via classList.toggle()
  // instead of React state, eliminating the +/-75-95ms jitter from React's batched updates.
  // Debug with: window.__DEBUG_DOM_TIMING = true
  const { registerIndicator, getEighthNoteDurationMs } = useBeatGridSync({
    rows: 3,       // hihat (0), snare (1), kick (2)
    columns: 8,    // 8 eighth notes per bar
    isPlaying: transport.isPlaying,
    activeClass: 'opacity-100',
    inactiveClass: 'opacity-0',
    isVisible,
  });

  // 🔬 RENDER TIMING DIAGNOSTIC: Measure when React actually commits the beat change to DOM
  // Enable in browser console: window.__DEBUG_RENDER_TIMING = true
  const lastRenderedBeatRef = useRef(-1);
  const lastRenderTimeRef = useRef(0);
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__DEBUG_RENDER_TIMING && transport.isPlaying) {
      const now = performance.now();
      const interval = lastRenderTimeRef.current > 0 ? now - lastRenderTimeRef.current : 0;

      if (currentBeat !== lastRenderedBeatRef.current) {
        console.log(`[RENDER_TIMING] Beat ${currentBeat} RENDERED at ${now.toFixed(1)}ms, interval: ${interval.toFixed(1)}ms`);
        lastRenderedBeatRef.current = currentBeat;
        lastRenderTimeRef.current = now;
      }
    }
  }, [currentBeat, transport.isPlaying]);

  // Track which measure to display in grid (wraps around exercisePatternMeasureCount)
  const [displayMeasure, setDisplayMeasure] = useState(0);
  // Note: currentMeasure is calculated below, after exercisePatternMeasureCount is defined

  // 🔧 FIX: REMOVED isTransportPlaying local state - now use TransportContext's isPlaying directly
  // The local state via EventBus was getting out of sync with TransportContext, causing the RAF loop
  // to continue running after playback stopped (because EventBus handler wasn't being called)
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPatternLibrary, setShowPatternLibrary] = useState(false);
  // Support both controlled and uncontrolled modes for volume/mute
  const [localVolume, setLocalVolume] = useState(80);
  const [localMuted, setLocalMuted] = useState(false);

  // Use controlled values if provided, otherwise use local state
  const volume = controlledVolume !== undefined ? controlledVolume : localVolume;
  const isMuted = controlledMuted !== undefined ? controlledMuted : localMuted;

  // Handler that works in both controlled and uncontrolled modes
  const handleVolumeChange = useCallback((newVolume: number) => {
    if (onVolumeChange) {
      onVolumeChange(newVolume);
    } else {
      setLocalVolume(newVolume);
    }
  }, [onVolumeChange]);

  const handleMuteToggle = useCallback(() => {
    if (onMuteToggle) {
      onMuteToggle();
    } else {
      setLocalMuted(!localMuted);
    }
  }, [onMuteToggle, localMuted]);
  // Initialize with empty pattern - useEffect will populate with correct data
  // This prevents showing stale preset pattern before exercise data loads
  const [currentPattern, setCurrentPattern] = useState(EMPTY_GRID_PATTERN);
  const [audioServicesReady, setAudioServicesReady] = useState(false);
  const [pluginLoadAttempts, setPluginLoadAttempts] = useState(0);

  // Calculate how many unique measures are in the exercise drum pattern
  // Used to determine if we need dynamic measure switching during playback
  const exercisePatternMeasureCount = useMemo(() => {
    const drumHits = (exercise as any)?.drumPattern;
    if (!drumHits || !Array.isArray(drumHits) || drumHits.length === 0) {
      return 1;
    }
    return getPatternMeasureCount(drumHits);
  }, [exercise?.id, (exercise as any)?.drumPattern]);

  // Calculate current measure index from unified beat indicator hook
  // Must be defined AFTER exercisePatternMeasureCount
  const currentMeasure = exercisePatternMeasureCount > 0
    ? hookMeasure % exercisePatternMeasureCount
    : 0;

  // Memoize exercise drum pattern to avoid recalculating on every render
  // This converts DrumHit[] or legacy DrumPattern from exercise to the compact 3x8 grid format
  // Now supports dynamic measure switching based on currentMeasure state
  const exerciseGridPattern = useMemo(() => {
    // Access drum pattern data - handle multiple possible field names and formats
    // 1. DrumHit[] from frontend entity (exercise.drumPattern)
    // 2. Legacy DrumPattern from contracts (exercise.drum_pattern with enabled + pattern[])
    const drumHits = (exercise as any)?.drumPattern; // DrumHit[] from frontend entity
    const legacyPattern = exercise?.drum_pattern; // Legacy { enabled, pattern[] } from contracts

    // Try DrumHit[] format first (new MIDI-converted format)
    if (drumHits && Array.isArray(drumHits) && drumHits.length > 0) {
      // Get time signature from exercise if available
      const beatsPerBar = exercise?.timeSignature?.numerator || 4;

      // For single-measure patterns, always show measure 0
      // For multi-measure patterns, show the display measure (with wrapping)
      // Use displayMeasure (not currentMeasure) to avoid RAF loop triggering recalculation
      const measureToShow =
        exercisePatternMeasureCount === 1
          ? 0
          : displayMeasure % exercisePatternMeasureCount;

      logger.debug('🥁 Converting DrumHit[] to grid', {
        exerciseId: exercise?.id,
        hitCount: drumHits.length,
        beatsPerBar,
        displayMeasure,
        measureToShow,
        totalMeasures: exercisePatternMeasureCount,
      });

      // Get the grid pattern for the target measure
      const pattern = drumHitsToGridPattern(drumHits, beatsPerBar, measureToShow);

      // 🔧 FIX: If the target measure has no hits, fallback to measure 0
      // This prevents grid wipe-out when switching to an empty measure
      const hasHits =
        pattern.kick.some(c => c.main === 1 || c.sixteenth === 1) ||
        pattern.snare.some(c => c.main === 1 || c.sixteenth === 1) ||
        pattern.hihat.some(c => c.main === 1 || c.sixteenth === 1);

      if (!hasHits && measureToShow !== 0) {
        logger.debug('🥁 Target measure has no hits, falling back to measure 0', {
          measureToShow,
        });
        return drumHitsToGridPattern(drumHits, beatsPerBar, 0);
      }

      return pattern;
    }

    // Try legacy DrumPattern format (enabled + pattern array)
    if (
      legacyPattern?.enabled &&
      legacyPattern?.pattern &&
      legacyPattern.pattern.length > 0
    ) {
      logger.info('🥁 Converting legacy drum pattern to grid', {
        exerciseId: exercise?.id,
        hitCount: legacyPattern.pattern.length,
      });

      // Convert legacy format to grid with GridCell format
      // Legacy format has: { timestamp, type, velocity }
      const createEmptyRow = (): GridCell[] =>
        Array.from({ length: 8 }, () => ({ main: 0, sixteenth: 0 }));

      const grid: GridPatternWithSixteenths = {
        kick: createEmptyRow(),
        snare: createEmptyRow(),
        hihat: createEmptyRow(),
      };

      // Get exercise duration to calculate beat positions
      const bpm = exercise?.bpm || 120;
      const msPerBeat = 60000 / bpm / 2; // ms per 8th note
      const msPerSixteenth = msPerBeat / 2; // ms per 16th note

      for (const hit of legacyPattern.pattern) {
        // Map legacy type to grid type
        const gridType =
          hit.type === 'kick'
            ? 'kick'
            : hit.type === 'snare'
              ? 'snare'
              : hit.type === 'hihat' ||
                  hit.type === 'crash' ||
                  hit.type === 'ride'
                ? 'hihat'
                : null;

        if (!gridType) continue;

        // Calculate position: which 16th note within the bar
        const sixteenthIndex = Math.floor(hit.timestamp / msPerSixteenth) % 16;
        // Map to grid column (8 columns for 8 eighth notes)
        const gridIndex = Math.floor(sixteenthIndex / 2);
        // Is this a 16th subdivision (odd 16th notes)?
        const isSixteenth = sixteenthIndex % 2 === 1;

        if (gridIndex >= 0 && gridIndex < 8) {
          if (isSixteenth) {
            grid[gridType][gridIndex].sixteenth = 1;
          } else {
            grid[gridType][gridIndex].main = 1;
          }
        }
      }

      return grid;
    }

    return null; // No exercise drum data available
  }, [
    exercise?.id,
    (exercise as any)?.drumPattern,
    exercise?.drum_pattern,
    exercise?.timeSignature?.numerator,
    exercise?.bpm,
    displayMeasure, // Re-calculate when DISPLAY measure changes (not RAF tracking measure)
    exercisePatternMeasureCount, // Re-calculate when pattern measure count changes
  ]);

  // Create a track for drums
  const track = useTrack({
    trackId: 'drummer-widget-track',
    name: 'Drums',
    type: 'drums',
    debugMode: false,
  });

  // Extract track.isReady to prevent infinite loops (track object changes every render)
  const trackIsReady = track.isReady;

  // Store track in ref to access methods without triggering re-renders
  const trackRef = useRef(track);
  useEffect(() => {
    trackRef.current = track;
  }, [track]);

  // We'll load the plugin manually - MUST be declared before any effects that use it
  const [wamPluginLoaded, setWamPluginLoaded] = useState(false);
  const [pluginClassLoaded, setPluginClassLoaded] = useState(false);

  // Reference to the plugin class and instance
  const wamPluginClassRef = useRef<any>(null);
  const drummerPluginRef = useRef<any>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentRegionRef = useRef<string | null>(null);

  // Use pattern selector hook if tutorialId is provided
  const patternSelector = tutorialId
    ? usePatternSelector({
        tutorialId,
        onPatternChange: (type, pattern) => {
          if (type === 'drums' && pattern.midiData) {
            // Convert pattern library format to widget format
            handlePatternLibraryChange(pattern);
          }
        },
      })
    : null;

  // DISABLED: DrummerWidget should NOT load MIDI independently
  // GlobalControls is responsible for loading exercise data and adding regions to tracks
  // This prevents race conditions and ensures the new architecture (pre-converted drum patterns) works correctly
  //
  // Previous behavior: Widget downloaded and parsed MIDI itself, creating regions independently
  // New behavior: Widget only displays regions created by GlobalControls
  //
  // Load MIDI from exercise when exercise prop changes
  // useEffect(() => {
  //   if (!exercise?.drummerMidiUrl || !wamPluginLoaded) return;
  //
  //   const loadExerciseMidi = async () => {
  //     try {
  //       componentLogger.info('Loading drum MIDI from exercise', {
  //         exerciseId: exercise.id,
  //         midiUrl: exercise.drummerMidiUrl,
  //         correlationId
  //       });
  //
  //       // Import MIDI parsing hook
  //       const { useMidiParsing } = await import('@/domains/admin/hooks/useMidiParsing');
  //
  //       // Create a temporary hook instance (not ideal but works outside React component)
  //       const parseMidi = async (midiUrl: string) => {
  //         const response = await fetch('/api/v1/midi/parse', {
  //           method: 'POST',
  //           headers: { 'Content-Type': 'application/json' },
  //           body: JSON.stringify({
  //             midiUrl,
  //             bpm: tempo,
  //             timeSignature: { numerator: 4, denominator: 4 },
  //             totalBars: 2,
  //           }),
  //         });
  //
  //         if (!response.ok) {
  //           throw new Error(`MIDI parsing failed: ${response.statusText}`);
  //         }
  //
  //         return response.json();
  //       };
  //
  //       const parsedData = await parseMidi(exercise.drummerMidiUrl);
  //
  //       // Convert parsed MIDI notes to drum pattern
  //       const drumPattern = convertMidiToDrumPattern(parsedData);
  //
  //       // Update track with new pattern
  //       const currentTrack = trackRef.current;
  //       if (currentTrack?.createRegionFromPattern && currentRegionRef.current) {
  //         currentTrack.removeRegion(currentRegionRef.current);
  //         const region = currentTrack.createRegionFromPattern(drumPattern, {
  //           name: 'Drum Pattern',
  //           startPosition: '0:0:0',
  //           duration: `${drumPattern.loopLength}:0:0`,
  //           loopCount: 0,
  //         });
  //         currentRegionRef.current = region.id;
  //
  //         // Update RegionProcessor with new MIDI-loaded pattern
  //         const globalServices = (window as any).__globalCoreServices || (window as any).__coreServices;
  //         if (globalServices && globalServices.getRegionProcessor) {
  //           const regionProcessor = globalServices.getRegionProcessor();
  //           regionProcessor.updateTracks([{
  //             id: 'drummer-widget-track',
  //             name: 'Drums',
  //             instrumentType: 'drums',
  //             regions: [{
  //               id: region.id,
  //               trackId: 'drummer-widget-track',
  //               startTime: 0,
  //               duration: drumPattern.loopLength * 4,
  //               pattern: {
  //                 id: 'drum-pattern-from-midi',
  //                 name: 'Drum Pattern',
  //                 type: 'drums',
  //                 events: drumPattern.events
  //               }
  //             }]
  //           }]);
  //         }
  //
  //         componentLogger.info('Loaded drum pattern from exercise MIDI', {
  //           exerciseId: exercise.id,
  //           events: drumPattern.events.length,
  //           loopLength: drumPattern.loopLength,
  //           correlationId
  //         });
  //       }
  //     } catch (error) {
  //       componentLogger.error('Failed to load exercise MIDI', error instanceof Error ? error : new Error(String(error)), {
  //         exerciseId: exercise.id,
  //         correlationId
  //       });
  //     }
  //   };
  //
  //   loadExerciseMidi();
  //   // Note: Removed track from dependencies to prevent infinite loops
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [exercise?.id, exercise?.drummerMidiUrl, wamPluginLoaded, tempo, componentLogger, correlationId]);

  // Create drum pattern from current preset
  const createDrumPattern = useCallback(() => {
    const selectedPattern =
      drumPatterns[pattern as keyof typeof drumPatterns] ||
      drumPatterns['Rock Steady'];
    const drumPattern: DrumPattern = {
      id: 'drum-pattern',
      events: [],
      loopLength: 2, // 2 bars (8 beats)
    };

    // Convert pattern arrays to events
    const drums = ['kick', 'snare', 'hihat'] as const;

    drums.forEach((drumType) => {
      const patternArray = selectedPattern[drumType];
      patternArray.forEach((cell, index) => {
        // Main 8th note hit
        if (cell.main === 1) {
          const bar = Math.floor(index / 4);
          const beat = index % 4;

          const event: DrumPatternEvent = {
            position: {
              measure: bar,
              beat: beat,
              subdivision: 0,
              tick: 0,
            },
            drum: drumType,
            velocity:
              drumType === 'kick' ? 0.9 : drumType === 'snare' ? 0.8 : 0.6,
            duration: '8n',
          };

          drumPattern.events.push(event);
        }

        // 16th note subdivision hit (the "e" or "a")
        if (cell.sixteenth === 1) {
          const bar = Math.floor(index / 4);
          const beat = index % 4;

          const event: DrumPatternEvent = {
            position: {
              measure: bar,
              beat: beat,
              subdivision: 1, // Indicate this is the 16th subdivision
              tick: 120, // 16th note after the 8th (120 ticks in 480 PPQ)
            },
            drum: drumType,
            velocity:
              drumType === 'kick' ? 0.85 : drumType === 'snare' ? 0.75 : 0.55,
            duration: '16n',
          };

          drumPattern.events.push(event);
        }
      });
    });

    return drumPattern;
  }, [pattern]);

  // Phase 1: Load the plugin class (can be done before AudioContext)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (pluginClassLoaded) return;

    const loadPluginClass = async () => {
      logger.debug('Loading plugin class...');
      lifecycle.checkpoint('DRUMMER_PLUGIN_LOADING');

      try {
        // Dynamic import to avoid SSR issues
        const { default: WamDrummer } =
          await import('@/domains/playback/modules/instruments/adapters/wam/WamDrummer');
        wamPluginClassRef.current = WamDrummer;
        setPluginClassLoaded(true);
        logger.debug('WAM Drummer plugin class loaded successfully');
      } catch (error) {
        logger.error('Failed to load WAM Drummer plugin class:', error);
      }
    };

    loadPluginClass();
  }, [pluginClassLoaded]);

  // Phase 2: Create the audio node when AudioContext is available
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!pluginClassLoaded || !trackIsReady || wamPluginLoaded) return;

    // Add guard to prevent multiple instances
    if (drummerPluginRef.current) {
      logger.debug('Plugin already loaded, skipping creation');
      return;
    }

    const createAudioNode = async () => {
      logger.debug('Attempting to create audio node...', {
        trackIsReady: track.isReady,
        wamPluginLoaded,
        pluginClassLoaded,
      });

      try {
        const WamDrummer = wamPluginClassRef.current;
        if (!WamDrummer) {
          logger.error('Plugin class not loaded');
          return;
        }

        // Get audio context from global audio system
        let context = null;

        // Try to get context from global audio services
        const globalServices = WindowRegistry.getCoreServices();
        if (globalServices && globalServices.getAudioEngine) {
          const audioEngine = globalServices.getAudioEngine();
          if (audioEngine && audioEngine.getContext) {
            try {
              context = audioEngine.getContext();
            } catch (e) {
              logger.debug('AudioEngine not ready yet, will retry...');
              return; // Context not ready yet, will retry
            }
          }
        }

        logger.debug('Got context:', context, {
          type: context?.constructor?.name,
          isAudioContext: context instanceof AudioContext,
          contextState: context?.state,
        });

        if (context && context instanceof AudioContext) {
          lifecycle.checkpoint('PLUGIN_AUDIOCONTEXT_CHECK', {
            widget: 'drummer',
            contextState: context.state,
          });

          // Check if context is running or needs to be resumed
          if (context.state === 'suspended') {
            logger.debug(
              'AudioContext is suspended, waiting for user gesture...',
            );
            lifecycle.checkpoint('PLUGIN_CREATION_BLOCKED', {
              widget: 'drummer',
              reason: 'AudioContext suspended',
              contextState: context.state,
            });
            // Don't create the audio node yet, wait for audioContextStarted event
            return;
          }

          // Create plugin instance
          const plugin = await WamDrummer.createInstance(context);
          logger.debug('Created plugin instance:', plugin);

          // Store the plugin instance for later use
          drummerPluginRef.current = plugin;

          // Create the audio node - this is required!
          const audioNode = await plugin.createAudioNode();
          logger.debug('Created audio node:', audioNode);

          // Connect to master bus for proper mixing (with fallback to destination)
          try {
            const { Mixer } = await import('@/domains/playback/modules/tracks/mixing/Mixer.js');
            const mixer = Mixer.getInstance();
            const masterBusInput = mixer.getMasterBusInputAsAudioNode();
            if (masterBusInput) {
              audioNode.connect(masterBusInput);
              logger.debug('Connected to master bus for mixing');
            } else {
              audioNode.connect(context.destination);
              logger.debug('Connected to destination (master bus not ready)');
            }
          } catch (e) {
            // Fallback to direct destination if mixer not available
            audioNode.connect(context.destination);
            logger.debug('Connected to destination (mixer not available)');
          }

          // Store the audio node on the plugin for easy access
          plugin.audioNode = audioNode;

          setWamPluginLoaded(true);

          logger.debug('WAM Drummer plugin loaded and connected');
          lifecycle.checkpoint('DRUMMER_PLUGIN_LOADED');

          // Load default kit using the correct method
          if (plugin.loadDefaultKit) {
            await plugin.loadDefaultKit();
            logger.debug('Default drum kit loaded');
          }

          // Register the plugin with InstrumentRegistry
          if (globalServices && globalServices.getInstrumentRegistry) {
            const instrumentRegistry = globalServices.getInstrumentRegistry();
            instrumentRegistry.setActive('drums', plugin);
            logger.debug('Registered WAM Drummer with InstrumentRegistry');
          }

          // CRITICAL FIX: Only register drum pattern if exercise actually has drums enabled
          // Previously this would unconditionally create a "Rock Steady" pattern with kick on beat 1,
          // causing intermittent kick drums on first beat even when exercise has no drum data
          const exerciseHasDrums =
            exercise &&
            (exercise.drummer_midi_url ||
              (exercise.drumPattern && exercise.drumPattern.length > 0) ||
              exercise.drum_pattern?.enabled);

          if (!exerciseHasDrums) {
            logger.debug(
              '🥁 Skipping default drum pattern - exercise has no drum data',
              {
                exerciseId: exercise?.id,
                drummerMidiUrl: exercise?.drummer_midi_url,
                drumPatternLength: exercise?.drumPattern?.length,
                drumPatternEnabled: exercise?.drum_pattern?.enabled,
              },
            );
          }

          // Register initial pattern with track ONLY if exercise has drums
          const currentTrack = trackRef.current;
          if (
            currentTrack &&
            currentTrack.createRegionFromPattern &&
            exerciseHasDrums
          ) {
            const pattern = createDrumPattern();
            const region = currentTrack.createRegionFromPattern(pattern, {
              name: 'Drum Pattern',
              startPosition: '0:0:0',
              duration: `${pattern.loopLength}:0:0`,
              loopCount: 0, // Infinite loop
            });
            currentRegionRef.current = region.id;
            logger.debug('Registered drum pattern with track', {
              pattern,
              region,
            });

            // 🚨 REMOVED: Track registration moved to GlobalControls to prevent duplicate drum tracks
            // GlobalControls is the single owner of drum track registration for exercise playback
            // This fixes the "Multiple drums tracks detected" error in SimpleInstrumentScheduler
            // If pattern library feature is needed, it should coordinate with GlobalControls
            logger.debug('Drum pattern region created (track registration handled by GlobalControls)', {
              regionId: region.id,
              patternEvents: pattern.events?.length || 0,
            });
          }
        } else {
          logger.debug('AudioContext not ready yet', {
            hasContext: !!context,
            contextState: context?.state,
          });
        }
      } catch (error) {
        logger.error('Failed to create WAM Drummer audio node:', error);
      }
    };

    createAudioNode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackIsReady, wamPluginLoaded, pluginClassLoaded, pluginLoadAttempts]);

  // Handle volume changes - apply to both WAM plugin and PlaybackEngine
  useEffect(() => {
    const effectiveVolume = isMuted ? 0 : volume / 100;

    // Update WAM plugin volume (legacy path)
    if (drummerPluginRef.current && drummerPluginRef.current.audioNode) {
      const audioNode = drummerPluginRef.current.audioNode;
      if (audioNode.setVolume) {
        audioNode.setVolume(effectiveVolume);
        audioNode.setMute(isMuted);
      }
    }

    // Update PlaybackEngine drums volume (new path)
    const coreServices = WindowRegistry.getCoreServices();
    const playbackEngine = coreServices?.getPlaybackEngine?.();
    if (playbackEngine) {
      playbackEngine.setInstrumentVolume('drums', effectiveVolume);
      playbackEngine.setInstrumentMuted('drums', isMuted);
    }
  }, [volume, isMuted]);

  // Listen for audio services ready event
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleAudioReady = () => {
      logger.debug('Audio services ready event received');
      setAudioServicesReady(true);
    };

    // Check if services are already ready
    const globalServices = WindowRegistry.getCoreServices();
    if (globalServices && globalServices.getAudioEngine) {
      try {
        const audioEngine = globalServices.getAudioEngine();
        if (audioEngine && audioEngine.isReady && audioEngine.isReady()) {
          logger.debug('Audio services already ready');
          setAudioServicesReady(true);
        }
      } catch (e) {
        // Not ready yet
      }
    }

    window.addEventListener('audioServicesReady', handleAudioReady);

    // Also listen for audioContext started event
    const handleAudioContextStarted = () => {
      logger.debug('AudioContext started event received');
      // Do nothing - the effect will handle retries
    };
    window.addEventListener('audioContextStarted', handleAudioContextStarted);

    return () => {
      window.removeEventListener('audioServicesReady', handleAudioReady);
      window.removeEventListener(
        'audioContextStarted',
        handleAudioContextStarted,
      );
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [wamPluginLoaded]);

  // Retry plugin loading when audio services become ready
  useEffect(() => {
    if (audioServicesReady && trackIsReady && !wamPluginLoaded) {
      logger.debug('Audio services ready, retrying plugin load...');
      // Small delay to ensure everything is fully initialized
      retryTimeoutRef.current = setTimeout(() => {
        setWamPluginLoaded(false); // Force a retry by changing the dependency
      }, 100);
    }
  }, [audioServicesReady, trackIsReady, wamPluginLoaded]);

  // Update pattern when selection changes or exercise drum data changes
  // Priority: 1) Exercise drum pattern (if available), 2) Preset pattern, 3) Empty grid
  useEffect(() => {
    let newPattern: GridPatternWithSixteenths;

    if (exerciseGridPattern) {
      // Use exercise drum pattern (converted from MIDI)
      newPattern = exerciseGridPattern;
      logger.info('🥁 Using exercise drum pattern for grid display', {
        exerciseId: exercise?.id,
        kicks: newPattern.kick.filter((c) => c.main === 1).length,
        snares: newPattern.snare.filter((c) => c.main === 1).length,
        hihats: newPattern.hihat.filter((c) => c.main === 1).length,
        sixteenths: {
          kick: newPattern.kick.filter((c) => c.sixteenth === 1).length,
          snare: newPattern.snare.filter((c) => c.sixteenth === 1).length,
          hihat: newPattern.hihat.filter((c) => c.sixteenth === 1).length,
        },
      });
    } else if (exercise) {
      // Exercise exists but has no drum data - show empty grid
      newPattern = EMPTY_GRID_PATTERN;
      logger.debug('🥁 Exercise has no drum data, showing empty grid', {
        exerciseId: exercise?.id,
      });
    } else {
      // No exercise - use preset pattern
      newPattern =
        drumPatterns[pattern as keyof typeof drumPatterns] ||
        drumPatterns['Rock Steady'];
      logger.debug('🥁 Using preset pattern for grid display', { pattern });
    }

    setCurrentPattern(newPattern);

    // Update pattern in track when drum pattern changes
    const currentTrack = trackRef.current;
    if (
      currentTrack &&
      currentTrack.regions &&
      wamPluginLoaded &&
      currentRegionRef.current
    ) {
      const drumPattern = createDrumPattern();
      // Remove old region and create new one - guard against region not existing
      try {
        // Check if region exists before attempting removal
        const regionExists = currentTrack.regions.some(
          (r: { id: string }) => r.id === currentRegionRef.current
        );
        if (regionExists) {
          currentTrack.removeRegion(currentRegionRef.current);
        }
      } catch (e) {
        // Region may have been removed already, ignore
        logger.debug('Region already removed, skipping', { regionId: currentRegionRef.current });
      }
      const region = currentTrack.createRegionFromPattern(drumPattern, {
        name: 'Drum Pattern',
        startPosition: '0:0:0',
        duration: `${drumPattern.loopLength}:0:0`,
        loopCount: 0, // Infinite loop
      });
      currentRegionRef.current = region.id;
      logger.debug('Updated drum pattern', { pattern, drumPattern });
    }
    // Note: createDrumPattern NOT in dependencies - it only depends on pattern prop which IS in deps
    // Including it would cause infinite loops as useCallback creates new ref when pattern changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pattern, wamPluginLoaded, exerciseGridPattern, exercise?.id]); // Added exerciseGridPattern and exercise?.id

  // Note: Drum triggering is handled by the AudioEventRouter service
  // The widget only handles visual updates based on transport position

  // 🔧 FIX: REMOVED EventBus subscription for transport state
  // Now using TransportContext's isPlaying directly (see useTransportContext() call below)
  // This ensures RAF loop stops immediately when transport stops, without EventBus sync delays

  // Cleanup on unmount - remove from InstrumentRegistry
  useEffect(() => {
    return () => {
      const globalServices =
        (window as any).__globalCoreServices || (window as any).__coreServices;
      if (globalServices && globalServices.getInstrumentRegistry) {
        const instrumentRegistry = globalServices.getInstrumentRegistry();
        if (
          instrumentRegistry.getActive('drums') === drummerPluginRef.current
        ) {
          instrumentRegistry.removeActive('drums');
          logger.debug(
            'Removed WAM Drummer from InstrumentRegistry on unmount',
          );
        }
      }
    };
  }, []);

  // Get position AND isPlaying from TransportContext (same source as TransportClock which works)
  const { position: transportPosition, isPlaying: isTransportContextPlaying } = useTransportContext();

  // 🔧 FIX: Use TransportContext's isPlaying as the AUTHORITATIVE source for RAF loop
  // The prop (isPlayingProp) indicates user INTENT to play, but TransportContext indicates ACTUAL playback state
  // When transport stops (auto-complete or manual), TransportContext.isPlaying becomes false immediately
  // This ensures RAF loop stops even if useWidgetPageState hasn't synced yet
  //
  // Previous bug: isPlaying = isPlayingProp || isTransportContextPlaying
  // - When transport stopped, isTransportContextPlaying became false
  // - But isPlayingProp stayed true (useWidgetPageState doesn't sync with transport:stop)
  // - Result: true || false = true, RAF loop never stopped
  //
  // Fix: For RAF loop control, ONLY use TransportContext's isPlaying
  // The prop can still be used for other purposes (like showing play button state)
  const isPlaying = isTransportContextPlaying;

  // Handle play state changes (simplified - beat indicator comes from hook)
  useEffect(() => {
    if (!isPlaying) {
      setDisplayMeasure(0); // Reset display measure when stopped
    }
  }, [isPlaying]);

  // Reset measure when exercise changes
  useEffect(() => {
    setDisplayMeasure(0);
  }, [exercise?.id]);

  // NOTE: Pattern trigger events are handled by AudioEventRouter
  // The widget only needs to create patterns and handle visual updates

  // Beat indicator timing is now handled by useBeatIndicator hook (single source of truth)
  // Update displayMeasure when measure changes (for multi-measure pattern display)
  const prevMeasureRef = useRef(currentMeasure);
  useEffect(() => {
    if (currentMeasure !== prevMeasureRef.current) {
      prevMeasureRef.current = currentMeasure;
      if (exercisePatternMeasureCount > 1) {
        setDisplayMeasure(currentMeasure);
      }
    }
  }, [currentMeasure, exercisePatternMeasureCount]);

  // Test drum function - wrapped with audio context initialization
  const testDrumSound = useCallback(
    withAudioContext(async (padNum: number) => {
      logger.debug('testDrumSound called:', {
        padNum,
        plugin: drummerPluginRef.current,
      });

      // If plugin isn't loaded, trigger a load attempt
      if (!drummerPluginRef.current && !wamPluginLoaded) {
        logger.debug('Plugin not loaded, triggering load attempt...');
        setPluginLoadAttempts((prev) => prev + 1);

        // Wait for plugin to load
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      if (drummerPluginRef.current && drummerPluginRef.current.audioNode) {
        const audioNode = drummerPluginRef.current.audioNode;
        if (audioNode.triggerPad) {
          logger.debug('Triggering pad:', padNum);
          audioNode.triggerPad(padNum, 0.8);
        } else {
          logger.warn(
            'Cannot trigger pad - audio node has no triggerPad method',
          );
        }
      } else {
        logger.warn('Cannot trigger pad - plugin not ready', {
          hasPlugin: !!drummerPluginRef.current,
          hasAudioNode: drummerPluginRef.current?.audioNode,
        });
      }
    }),
    [wamPluginLoaded],
  );

  // Toggle pattern functions - wrapped with audio context initialization
  const toggleDrum = useCallback(
    withAudioContext(
      async (drum: 'kick' | 'snare' | 'hihat', index: number) => {
        setCurrentPattern((prev) => ({
          ...prev,
          [drum]: prev[drum].map((cell, i) =>
            i === index
              ? { ...cell, main: cell.main ? 0 : 1 }
              : cell,
          ),
        }));

        // Play sound for feedback
        const padMap = { kick: 1, snare: 3, hihat: 5 };
        await testDrumSound(padMap[drum]);
      },
    ),
    [testDrumSound],
  );

  // Handle pattern change from pattern library
  const handlePatternLibraryChange = useCallback(
    async (libraryPattern: any) => {
      // Load MIDI file from URL
      if (libraryPattern.midiFileUrl) {
        try {
          componentLogger.info('Loading pattern from MIDI:', {
            name: libraryPattern.name,
            url: libraryPattern.midiFileUrl,
            correlationId,
          });

          // Load and parse MIDI file using backend API
          const { useMidiParsing } =
            await import('@/domains/admin/hooks/useMidiParsing');
          const midiParsing = useMidiParsing();

          const parsedData = await midiParsing.parseMidi(
            'drums-midi', // placeholder ID
            {
              midiUrl: libraryPattern.midiFileUrl,
              bpm: tempo,
              timeSignature: { numerator: 4, denominator: 4 },
              totalBars: 2,
            },
          );

          // Convert parsed MIDI notes to drum pattern
          const drumPattern = convertMidiToDrumPattern(parsedData);

          // Update track with new pattern
          const currentTrack = trackRef.current;
          if (
            currentTrack &&
            currentTrack.createRegionFromPattern &&
            currentRegionRef.current
          ) {
            // Guard against region not existing
            try {
              if (currentTrack.regions?.some((r: { id: string }) => r.id === currentRegionRef.current)) {
                currentTrack.removeRegion(currentRegionRef.current);
              }
            } catch (e) {
              // Ignore - region may have been removed already
            }
            const region = currentTrack.createRegionFromPattern(drumPattern, {
              name: libraryPattern.name || 'Drum Pattern',
              startPosition: '0:0:0',
              duration: `${drumPattern.loopLength}:0:0`,
              loopCount: 0,
            });
            currentRegionRef.current = region.id;

            // 🚨 REMOVED: Track registration moved to GlobalControls to prevent duplicate drum tracks
            // GlobalControls is the single owner of drum track registration for exercise playback
            // This fixes the "Multiple drums tracks detected" error in SimpleInstrumentScheduler
            componentLogger.debug('Pattern library MIDI loaded (track registration handled by GlobalControls)', {
              name: libraryPattern.name,
              events: drumPattern.events?.length || 0,
              correlationId,
            });

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

          // Fallback to genre-based pattern with GridCell format
          // Helper to convert simple array to GridCell array (no 16th notes in fallback)
          const toGridCells = (arr: number[]): GridCell[] =>
            arr.map((v) => ({ main: v, sixteenth: 0 }));

          const newPattern: GridPatternWithSixteenths = {
            kick: toGridCells([0, 0, 0, 0, 0, 0, 0, 0]),
            snare: toGridCells([0, 0, 0, 0, 0, 0, 0, 0]),
            hihat: toGridCells([0, 0, 0, 0, 0, 0, 0, 0]),
          };

          // Simple pattern generation based on genre
          if (libraryPattern.genre === 'rock') {
            newPattern.kick = toGridCells([1, 0, 0, 0, 1, 0, 0, 0]);
            newPattern.snare = toGridCells([0, 0, 1, 0, 0, 0, 1, 0]);
            newPattern.hihat = toGridCells([1, 1, 1, 1, 1, 1, 1, 1]);
          } else if (libraryPattern.genre === 'jazz') {
            newPattern.kick = toGridCells([1, 0, 0, 0, 0, 0, 1, 0]);
            newPattern.snare = toGridCells([0, 0, 0, 0, 1, 0, 0, 0]);
            newPattern.hihat = toGridCells([1, 0, 1, 1, 0, 1, 1, 0]);
          } else if (libraryPattern.genre === 'funk') {
            newPattern.kick = toGridCells([1, 0, 0, 1, 0, 0, 1, 0]);
            newPattern.snare = toGridCells([0, 1, 0, 1, 0, 0, 1, 0]);
            newPattern.hihat = toGridCells([1, 1, 0, 1, 1, 0, 1, 1]);
          }

          setCurrentPattern(newPattern);
          onPatternChange(libraryPattern.name);
        }
      }
      // Note: Removed track from dependencies to prevent infinite loops
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [onPatternChange, componentLogger, correlationId, tempo],
  );

  // Don't return null when not visible - we need effects to run for plugin loading
  // Just hide the UI
  if (!isVisible) {
    return <div style={{ display: 'none' }} />;
  }

  return (
    <div
      className={`relative bg-slate-800 rounded-2xl px-4 py-1 h-24 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300 select-none ${
        volume === 0 || isMuted ? 'bg-slate-850 grayscale brightness-100' : ''
      }`}
    >
      <div className="flex items-center justify-between h-full">
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
                    className={`font-semibold text-sm ${volume === 0 ? 'text-slate-600' : 'text-white'}`}
                  >
                    Drums Track
                  </h3>
                  <p
                    className={`text-xs ${volume === 0 ? 'text-slate-600' : 'text-slate-400'}`}
                  >
                    {exerciseGridPattern
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
                  {/* Compact beat dots in 3x8 grid with 16th note subdivisions */}
                  {/*
                    JITTER-FREE DIRECT DOM SOLUTION:
                    1. Beat indicators use ref registration (registerIndicator)
                    2. useBeatGridSync hook updates DOM directly via classList.toggle()
                    3. Bypasses React state entirely for beat position updates
                    4. GPU acceleration via will-change and transform: translateZ(0)
                    5. CSS custom property for fade duration (calculated once)

                    Debug timing: window.__DEBUG_DOM_TIMING = true
                  */}
                  <div
                    className="grid grid-rows-3 grid-cols-8 gap-1"
                    style={{
                      '--beat-fade-duration': `${Math.min(getEighthNoteDurationMs() * 0.4, 200)}ms`
                    } as React.CSSProperties}
                  >
                    {/* Hi-hat row (row index 0) */}
                    {currentPattern.hihat.map((cell, idx) => (
                      <div key={`hh-${idx}`} className="relative flex items-center justify-center">
                        {/* Main 8th note dot */}
                        <div
                          className={`w-2 h-2 rounded-full ${
                            cell.main ? 'bg-orange-500' : 'bg-slate-700'
                          }`}
                        />
                        {/* Highlight overlay - DIRECT DOM via ref, bypasses React state */}
                        <div
                          ref={(el) => registerIndicator(0, idx, el)}
                          style={{
                            // STABLE transition - only opacity changes, transition stays constant
                            transition: 'opacity var(--beat-fade-duration, 174ms) ease-out',
                            // GPU acceleration hints
                            willChange: 'opacity',
                            transform: 'translateZ(0)',
                          }}
                          className="absolute inset-0 w-2 h-2 rounded-full bg-green-400 shadow-lg shadow-green-400/50 opacity-0"
                        />
                        {/* 16th note subdivision tick - ONLY show if there's a hit */}
                        {cell.sixteenth === 1 && idx < 7 && (
                          <div className="absolute -right-1 w-1 h-1 rounded-full bg-orange-400" />
                        )}
                      </div>
                    ))}

                    {/* Snare row (row index 1) */}
                    {currentPattern.snare.map((cell, idx) => (
                      <div key={`sn-${idx}`} className="relative flex items-center justify-center">
                        {/* Main 8th note dot */}
                        <div
                          className={`w-2 h-2 rounded-full ${
                            cell.main ? 'bg-orange-500' : 'bg-slate-700'
                          }`}
                        />
                        {/* Highlight overlay - DIRECT DOM via ref, bypasses React state */}
                        <div
                          ref={(el) => registerIndicator(1, idx, el)}
                          style={{
                            transition: 'opacity var(--beat-fade-duration, 174ms) ease-out',
                            willChange: 'opacity',
                            transform: 'translateZ(0)',
                          }}
                          className="absolute inset-0 w-2 h-2 rounded-full bg-green-400 shadow-lg shadow-green-400/50 opacity-0"
                        />
                        {/* 16th note subdivision tick - ONLY show if there's a hit */}
                        {cell.sixteenth === 1 && idx < 7 && (
                          <div className="absolute -right-1 w-1 h-1 rounded-full bg-orange-400" />
                        )}
                      </div>
                    ))}

                    {/* Kick row (row index 2) */}
                    {currentPattern.kick.map((cell, idx) => (
                      <div key={`k-${idx}`} className="relative flex items-center justify-center">
                        {/* Main 8th note dot */}
                        <div
                          className={`w-2 h-2 rounded-full ${
                            cell.main ? 'bg-orange-500' : 'bg-slate-700'
                          }`}
                        />
                        {/* Highlight overlay - DIRECT DOM via ref, bypasses React state */}
                        <div
                          ref={(el) => registerIndicator(2, idx, el)}
                          style={{
                            transition: 'opacity var(--beat-fade-duration, 174ms) ease-out',
                            willChange: 'opacity',
                            transform: 'translateZ(0)',
                          }}
                          className="absolute inset-0 w-2 h-2 rounded-full bg-green-400 shadow-lg shadow-green-400/50 opacity-0"
                        />
                        {/* 16th note subdivision tick - ONLY show if there's a hit */}
                        {cell.sixteenth === 1 && idx < 7 && (
                          <div className="absolute -right-1 w-1 h-1 rounded-full bg-orange-400" />
                        )}
                      </div>
                    ))}
                  </div>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-4 w-full">
                <div className="flex-1">
                  <div className="flex flex-col gap-2">
                    {/* Pattern Selector with Library Button */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-16">
                        Pattern:
                      </span>
                      <select
                        value={pattern}
                        onChange={(e) => onPatternChange(e.target.value)}
                        className="flex-1 bg-slate-700 text-white text-xs rounded px-2 py-1"
                      >
                        {Object.keys(drumPatterns).map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                      {/* Pattern Library Button */}
                      {tutorialId && (
                        <button
                          onClick={() =>
                            setShowPatternLibrary(!showPatternLibrary)
                          }
                          className="p-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                          title="Browse Pattern Library"
                        >
                          <Music2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Pattern Library Selector */}
                    {showPatternLibrary && patternSelector && (
                      <div className="p-2 bg-slate-800 rounded-lg border border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-slate-300">
                            Pattern Library
                          </span>
                          <button
                            onClick={() => setShowPatternLibrary(false)}
                            className="text-xs text-slate-500 hover:text-slate-400"
                          >
                            ✕
                          </button>
                        </div>
                        {patternSelector.isLoading ? (
                          <div className="text-xs text-slate-500">
                            Loading patterns...
                          </div>
                        ) : (
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {patternSelector.availableDrumPatterns.map((p) => (
                              <button
                                key={p.id}
                                onClick={() => {
                                  patternSelector.selectDrumPattern(p);
                                  handlePatternLibraryChange(p);
                                  setShowPatternLibrary(false);
                                }}
                                className={`w-full text-left p-1.5 text-xs rounded hover:bg-slate-700 transition-colors ${
                                  patternSelector.selectedDrumPattern?.id ===
                                  p.id
                                    ? 'bg-slate-700 text-orange-400'
                                    : 'text-slate-300'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span>{p.name}</span>
                                  {p.genre && (
                                    <span className="text-xs text-slate-500">
                                      {p.genre}
                                    </span>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Drum pattern grid */}
                    <div className="space-y-1">
                      {/* Hi-hat row */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => testDrumSound(5)}
                          className="text-xs font-mono text-orange-400 w-6 hover:text-orange-300"
                        >
                          HH
                        </button>
                        <div className="grid grid-cols-8 gap-1">
                          {currentPattern.hihat.map((beat, i) => (
                            <button
                              key={i}
                              onClick={() => toggleDrum('hihat', i)}
                              className={`w-4 h-4 rounded-full transition-all duration-200 cursor-pointer hover:scale-110 ${
                                currentBeat === i && isPlaying
                                  ? 'bg-orange-300 shadow-lg shadow-orange-300/50'
                                  : beat
                                    ? 'bg-orange-500'
                                    : 'bg-slate-700'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Snare row */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => testDrumSound(3)}
                          className="text-xs font-mono text-orange-400 w-6 hover:text-orange-300"
                        >
                          SN
                        </button>
                        <div className="grid grid-cols-8 gap-1">
                          {currentPattern.snare.map((beat, i) => (
                            <button
                              key={i}
                              onClick={() => toggleDrum('snare', i)}
                              className={`w-4 h-4 rounded-full transition-all duration-200 cursor-pointer hover:scale-110 ${
                                currentBeat === i && isPlaying
                                  ? 'bg-orange-300 shadow-lg shadow-orange-300/50'
                                  : beat
                                    ? 'bg-orange-500'
                                    : 'bg-slate-700'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Kick row */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => testDrumSound(1)}
                          className="text-xs font-mono text-orange-400 w-6 hover:text-orange-300"
                        >
                          K
                        </button>
                        <div className="grid grid-cols-8 gap-1">
                          {currentPattern.kick.map((beat, i) => (
                            <button
                              key={i}
                              onClick={() => toggleDrum('kick', i)}
                              className={`w-4 h-4 rounded-full transition-all duration-200 cursor-pointer hover:scale-110 ${
                                currentBeat === i && isPlaying
                                  ? 'bg-orange-300 shadow-lg shadow-orange-300/50'
                                  : beat
                                    ? 'bg-orange-500'
                                    : 'bg-slate-700'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={async () => {
                      // Play drums in sequence with proper async handling
                      await testDrumSound(1); // kick
                      await new Promise((resolve) => setTimeout(resolve, 200));
                      await testDrumSound(3); // snare
                      await new Promise((resolve) => setTimeout(resolve, 200));
                      await testDrumSound(5); // hihat
                    }}
                    className="px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-500 transition-colors"
                    disabled={!trackIsReady}
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
            disabled={!trackIsReady}
          >
            {isPlaying ? 'Stop' : 'Play'}
          </button>
        </div>
      )}
    </div>
  );
};

// Phase 5.1: Wrap in React.memo to prevent unnecessary re-renders
// Only re-render when props actually change
export const DrummerWidget = React.memo(DrummerWidgetComponent);
