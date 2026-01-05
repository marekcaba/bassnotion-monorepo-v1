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
import { getLogger } from '@/utils/logger.js';
import type { MusicalPosition } from '@bassnotion/contracts/types/musical-time';
import type { Exercise } from '@bassnotion/contracts';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry.js';
import { GlobalSampleCache } from '@/domains/playback/modules/storage/cache/GlobalSampleCache';
import { isVerboseDebugEnabled } from '@/config/debug';

// Bass articulation types
const BassArticulation = {
  FINGERSTYLE: 'fingerstyle',
  SLAP: 'slap',
  PICK: 'pick',
  MUTE: 'mute',
  HARMONIC: 'harmonic',
} as const;

type BassArticulationType =
  (typeof BassArticulation)[keyof typeof BassArticulation];

interface BassLineWidgetProps {
  pattern: string;
  isVisible: boolean;
  isPlaying: boolean;
  exercise?: Exercise;
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

// Bass patterns for quick selection
const bassPatterns = {
  'Root-Fifth': [
    { note: 28, string: 1, fret: 0, beat: 0 }, // E1
    { note: 33, string: 2, fret: 0, beat: 1 }, // A1
    { note: 28, string: 1, fret: 0, beat: 2 }, // E1
    { note: 33, string: 2, fret: 0, beat: 3 }, // A1
  ],
  'Walking Bass': [
    { note: 38, string: 2, fret: 5, beat: 0 }, // D2
    { note: 41, string: 2, fret: 8, beat: 1 }, // F2
    { note: 43, string: 3, fret: 0, beat: 2 }, // G2
    { note: 45, string: 3, fret: 2, beat: 3 }, // A2
  ],
  'Chromatic Walk': [
    { note: 28, string: 1, fret: 0, beat: 0 }, // E1
    { note: 29, string: 1, fret: 1, beat: 0.5 }, // F1
    { note: 30, string: 1, fret: 2, beat: 1 }, // F#1
    { note: 31, string: 1, fret: 3, beat: 1.5 }, // G1
    { note: 32, string: 1, fret: 4, beat: 2 }, // G#1
    { note: 33, string: 2, fret: 0, beat: 2.5 }, // A1
    { note: 34, string: 2, fret: 1, beat: 3 }, // Bb1
    { note: 35, string: 2, fret: 2, beat: 3.5 }, // B1
  ],
  Octaves: [
    { note: 38, string: 2, fret: 5, beat: 0 }, // D2
    { note: 50, string: 3, fret: 7, beat: 1 }, // D3
    { note: 38, string: 2, fret: 5, beat: 2 }, // D2
    { note: 50, string: 3, fret: 7, beat: 3 }, // D3
  ],
  'Funky Slap': [
    { note: 28, string: 1, fret: 0, beat: 0, articulation: 'slap' }, // E1 slap
    { note: 40, string: 1, fret: 12, beat: 0.25, articulation: 'slap' }, // E2 ghost
    { note: 33, string: 2, fret: 0, beat: 0.5, articulation: 'slap' }, // A1 slap
    { note: 28, string: 1, fret: 0, beat: 1.5, articulation: 'slap' }, // E1 slap
    { note: 31, string: 1, fret: 3, beat: 2, articulation: 'pick' }, // G1 pop
    { note: 33, string: 2, fret: 0, beat: 3, articulation: 'slap' }, // A1 slap
  ],
};

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
  // Get tempo directly from Transport (single source of truth)
  const transport = useTransportContext();
  const tempo = transport.tempo;
  const [isExpanded, setIsExpanded] = useState(false);
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
  const [currentArticulation, setCurrentArticulation] =
    useState<BassArticulationType>(BassArticulation.FINGERSTYLE);
  const [selectedNotes, setSelectedNotes] = useState<any[]>([]);

  // Create a track for bass
  const track = useTrack({
    trackId: 'bass-widget-track',
    name: 'Bass',
    type: 'bass',
    debugMode: false,
  });

  // Bass sampler state
  const [samplerReady, setSamplerReady] = useState(false);
  const [samplesLoaded, setSamplesLoaded] = useState(0);
  const [totalSamples, setTotalSamples] = useState(0);
  const [currentlyPlayingNote, setCurrentlyPlayingNote] = useState<{
    midiNote: number;
    string: number;
    fret: number;
  } | null>(null);

  // State to track when samples are loaded (triggers re-registration) - SAME AS HarmonyWidget
  const [samplesLoadedTrigger, setSamplesLoadedTrigger] = useState(0);

  // Reference to audio buffers and context
  const audioContextRef = useRef<AudioContext | null>(null);
  const bassBuffersRef = useRef<Record<string, AudioBuffer>>({});
  const activeSources = useRef<Map<string, { source: AudioBufferSourceNode; gain: GainNode }>>(new Map());
  const lastScheduledTimeRef = useRef<number>(0);
  const currentPatternRef = useRef<any[]>([]);
  const gainNodeRef = useRef<GainNode | null>(null);

  // PERFORMANCE FIX: Use ref to track if registration has been done for this exercise
  // This prevents multiple re-registrations due to unstable dependencies
  const lastRegisteredExerciseIdRef = useRef<string | null>(null);
  const isRegisteringRef = useRef(false);

  // Listen for bass-samples-loaded event to re-trigger registration (SAME PATTERN AS HarmonyWidget)
  useEffect(() => {
    const handleBassSamplesLoaded = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (isVerboseDebugEnabled()) {
        console.log('🎸 [BASS-WIDGET] Received bass-samples-loaded event:', customEvent.detail);
      }
      // Increment trigger to force registration effect to re-run
      setSamplesLoadedTrigger(prev => prev + 1);
    };

    const handleSamplesReady = () => {
      if (isVerboseDebugEnabled()) {
        console.log('🎸 [BASS-WIDGET] Received samplesReady event from ScrollTriggerLoader');
      }
      setSamplesLoadedTrigger(prev => prev + 1);
    };

    window.addEventListener('bass-samples-loaded', handleBassSamplesLoaded);
    window.addEventListener('samplesReady', handleSamplesReady);

    return () => {
      window.removeEventListener('bass-samples-loaded', handleBassSamplesLoaded);
      window.removeEventListener('samplesReady', handleSamplesReady);
    };
  }, []);

  // PERFORMANCE FIX: Track if audio is already initialized to prevent re-runs
  const audioInitializedRef = useRef(false);

  // CRITICAL: Clear bass buffers ready flag when exercise changes
  // This ensures we wait for new buffers before playback starts on exercise switch
  const prevExerciseIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (exercise?.id !== prevExerciseIdRef.current) {
      if (isVerboseDebugEnabled()) {
        console.log('🎸 [BASS-WIDGET] Exercise changed, clearing bass buffers ready flag', {
          prevExerciseId: prevExerciseIdRef.current,
          newExerciseId: exercise?.id,
        });
      }
      WindowRegistry.clearBassBuffersReady();
      prevExerciseIdRef.current = exercise?.id;
    }
  }, [exercise?.id]);

  // Initialize bass audio context and gain node (buffer injection is handled by registerBassWithPlaybackEngine)
  // PERFORMANCE FIX: Removed volume/isMuted from dependencies - those are handled in a separate effect
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initializeBass = async () => {
      // PERFORMANCE FIX: Skip if already initialized
      if (audioInitializedRef.current && audioContextRef.current?.state === 'running') {
        return;
      }

      logger.debug('🎸 Initializing bass audio context...');

      // Get CoreServices
      const coreServices = WindowRegistry.getCoreServices();
      if (!coreServices) {
        logger.debug('CoreServices not ready, will retry...');
        return;
      }

      const audioEngine = coreServices.getAudioEngine?.();
      if (!audioEngine || !audioEngine.isReady()) {
        logger.debug('AudioEngine not ready, will retry...');
        return;
      }

      const context = audioEngine.getContext();
      if (!context || context.state !== 'running') {
        logger.debug('AudioContext not running, waiting for user gesture...');
        return;
      }

      audioContextRef.current = context;

      // Create gain node for volume control
      if (!gainNodeRef.current) {
        gainNodeRef.current = context.createGain();
        gainNodeRef.current.gain.value = isMuted ? 0 : volume / 100;
        gainNodeRef.current.connect(context.destination);
      }

      // PERFORMANCE FIX: Mark as initialized to prevent re-runs
      audioInitializedRef.current = true;

      // Mark sampler as ready - buffer injection is handled by registerBassWithPlaybackEngine
      setSamplerReady(true);
      logger.info('🎸 Bass audio context initialized, ready for buffer injection');
    };

    initializeBass();

    // Listen for audio services ready event
    const handleAudioReady = () => {
      logger.debug('Audio services ready event received');
      initializeBass();
    };

    const handleAudioContextStarted = () => {
      logger.debug('AudioContext started event received');
      initializeBass();
    };

    window.addEventListener('audioServicesReady', handleAudioReady);
    window.addEventListener('audioContextStarted', handleAudioContextStarted);

    return () => {
      window.removeEventListener('audioServicesReady', handleAudioReady);
      window.removeEventListener('audioContextStarted', handleAudioContextStarted);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // PERFORMANCE FIX: Run only once on mount - volume/mute handled separately

  // Handle volume changes
  useEffect(() => {
    const effectiveVolume = isMuted ? 0 : volume / 100;

    // Update local gain node (legacy path)
    if (gainNodeRef.current && audioContextRef.current) {
      gainNodeRef.current.gain.setTargetAtTime(
        effectiveVolume,
        audioContextRef.current.currentTime,
        0.05 // 50ms transition
      );
    }

    // Update PlaybackEngine bass volume (new path)
    const coreServices = WindowRegistry.getCoreServices();
    const playbackEngine = coreServices?.getPlaybackEngine?.();
    if (playbackEngine) {
      playbackEngine.setInstrumentVolume('bass', effectiveVolume);
      playbackEngine.setInstrumentMuted('bass', isMuted);
    }
  }, [volume, isMuted]);

  // Play a bass note using the sampler
  const playBassNote = useCallback((
    midiNote: number,
    velocity: number = 0.7,
    duration: number = 0.5,
    scheduledTime?: number
  ) => {
    const context = audioContextRef.current;
    if (!context || !gainNodeRef.current) {
      logger.warn('Cannot play bass note: audio context not ready');
      return;
    }

    // Get buffer for this MIDI note - check preloaded buffers first
    const bufferKey = String(midiNote);
    let buffer = bassBuffersRef.current[bufferKey];

    // If not in local cache, try to get from PlaybackEngine's bass scheduler
    if (!buffer) {
      const coreServices = WindowRegistry.getCoreServices();
      const playbackEngine = coreServices?.getPlaybackEngine?.();
      if (playbackEngine?.bassScheduler) {
        const buffers = (playbackEngine.bassScheduler as any).buffers;
        if (buffers instanceof Map) {
          buffer = buffers.get(bufferKey);
        }
      }
    }

    if (!buffer) {
      logger.warn('No buffer found for MIDI note', { midiNote, bufferKey });
      return;
    }

    const startTime = scheduledTime ?? context.currentTime;

    // Create source and gain nodes
    const source = context.createBufferSource();
    source.buffer = buffer;

    const noteGain = context.createGain();
    noteGain.gain.setValueAtTime(velocity, startTime);

    // Connect: source → noteGain → masterGain → destination
    source.connect(noteGain);
    noteGain.connect(gainNodeRef.current);

    // Schedule the note
    source.start(startTime);

    // Store for cleanup
    const sourceKey = `${midiNote}-${startTime}`;
    activeSources.current.set(sourceKey, { source, gain: noteGain });

    // Schedule fadeout and cleanup
    const fadeOutTime = startTime + duration - 0.05;
    noteGain.gain.setTargetAtTime(0, fadeOutTime, 0.03);

    source.onended = () => {
      noteGain.disconnect();
      activeSources.current.delete(sourceKey);
    };

    logger.debug('🎸 Playing bass note', { midiNote, velocity, duration, startTime });
  }, []);

  // Stop all active bass notes
  const stopAllNotes = useCallback((graceful = false) => {
    const context = audioContextRef.current;
    if (!context) return;

    const currentTime = context.currentTime;
    const fadeTime = graceful ? 0.1 : 0.02;

    activeSources.current.forEach(({ source, gain }, key) => {
      try {
        gain.gain.cancelScheduledValues(currentTime);
        gain.gain.setTargetAtTime(0, currentTime, fadeTime);
        source.stop(currentTime + fadeTime * 3);
      } catch (e) {
        // Source may have already stopped
      }
    });

    if (!graceful) {
      activeSources.current.clear();
    }
  }, []);

  // CRITICAL: Register bass buffers with PlaybackEngine (copied from HarmonyWidget pattern)
  // This ensures buffers are injected BEFORE playback starts
  const registerBassWithPlaybackEngine = useCallback(async () => {
    // PERFORMANCE FIX: Prevent multiple simultaneous registrations
    if (isRegisteringRef.current) {
      if (isVerboseDebugEnabled()) {
        console.log('🎸 [BASS-WIDGET] Registration already in progress, skipping');
      }
      return;
    }

    // PERFORMANCE FIX: Skip if already registered for this exercise + trigger combo
    const registrationKey = `${exercise?.id}-${samplesLoadedTrigger}`;
    if (lastRegisteredExerciseIdRef.current === registrationKey) {
      if (isVerboseDebugEnabled()) {
        console.log('🎸 [BASS-WIDGET] Already registered for this exercise+trigger, skipping', {
          registrationKey,
        });
      }
      return;
    }

    isRegisteringRef.current = true;

    if (isVerboseDebugEnabled()) {
      const timestamp = new Date().toISOString();
      console.log('🎸🎸🎸 [BASS-WIDGET] registerBassWithPlaybackEngine CALLED', {
        timestamp,
        exerciseId: exercise?.id,
        hasNotes: !!exercise?.notes?.length,
      });
    }

    // Get CoreServices and PlaybackEngine
    const coreServices = WindowRegistry.getCoreServices();
    if (!coreServices) {
      console.error('❌ [BASS-WIDGET] No core services available');
      return;
    }

    const playbackEngine = coreServices.getPlaybackEngine?.();
    if (!playbackEngine) {
      console.error('❌ [BASS-WIDGET] No PlaybackEngine available');
      return;
    }

    if (isVerboseDebugEnabled()) {
      console.log('✅ [BASS-WIDGET] PlaybackEngine available, starting buffer injection...');
    }

    try {
      const sampleCache = GlobalSampleCache.getInstance();

      // Get cached bass metadata to know which notes we need
      const metadata = sampleCache.getMetadata('bass-required-notes');

      // CRITICAL FIX: Check if metadata is for the CURRENT exercise!
      // When multiple exercises are preloaded, metadata gets overwritten by the last one.
      // If metadata.exerciseId doesn't match current exercise, derive notes from exercise.notes directly.
      let midiNotesToLoad: number[] = [];

      if (metadata && metadata.exerciseId === exercise?.id && metadata.midiNotes?.length > 0) {
        // Metadata matches current exercise - use it
        midiNotesToLoad = metadata.midiNotes;
        if (isVerboseDebugEnabled()) {
          console.log('✅ [BASS-WIDGET] Using cached metadata for current exercise:', {
            exerciseId: exercise?.id,
            noteCount: midiNotesToLoad.length,
            midiNotes: midiNotesToLoad,
          });
        }
      } else if (exercise?.notes && exercise.notes.length > 0) {
        // Metadata is for wrong exercise OR missing - derive from exercise.notes
        // Bass strings are 1-5 (5-string bass) or 1-4 (4-string bass)
        const bassNotes = exercise.notes.filter(
          (note: any) => note.string >= 1 && note.string <= 5
        );

        // Convert to MIDI notes using standard bass tuning
        // String numbers are from HIGH to LOW: string 1 = G (highest), string 4 = E (lowest)
        // 4-string bass: E1=28, A1=33, D2=38, G2=43
        // 5-string bass adds: B0=23 (low B, string 5)
        const stringToBaseMidi: Record<number, number> = {
          1: 43, // G2 (highest string on 4-string)
          2: 38, // D2
          3: 33, // A1
          4: 28, // E1 (lowest string on 4-string)
          5: 23, // B0 (5-string bass low B)
        };

        const midiNoteSet = new Set<number>();
        bassNotes.forEach((note: any) => {
          const baseMidi = stringToBaseMidi[note.string];
          if (baseMidi !== undefined) {
            const midiNote = baseMidi + (note.fret || 0);
            midiNoteSet.add(midiNote);
          }
        });

        midiNotesToLoad = Array.from(midiNoteSet).sort((a, b) => a - b);
        if (isVerboseDebugEnabled()) {
          console.log('✅ [BASS-WIDGET] Derived MIDI notes from exercise.notes:', {
            exerciseId: exercise?.id,
            cachedExerciseId: metadata?.exerciseId,
            bassNotesCount: bassNotes.length,
            uniqueMidiNotes: midiNotesToLoad.length,
            midiNotes: midiNotesToLoad,
          });
        }
      }

      if (midiNotesToLoad.length === 0) {
        console.warn('⚠️ [BASS-WIDGET] No bass notes to load, skipping buffer injection');
        return;
      }

      // Get AudioContext for decoding
      const audioEngine = coreServices.getAudioEngine?.();

      // Check if AudioEngine is initialized before trying to get context
      // This prevents the "AudioContext not available. Call initialize() first." error
      // which happens when the effect runs before user interaction initializes AudioEngine
      if (!audioEngine?.isInitialized) {
        if (isVerboseDebugEnabled()) {
          console.log('⏳ [BASS-WIDGET] AudioEngine not initialized yet, will retry when user interacts');
        }
        return;
      }

      const audioContext = audioEngine.getContext();

      if (!audioContext?.destination) {
        console.error('❌ [BASS-WIDGET] No audioContext.destination available');
        return;
      }

      if (isVerboseDebugEnabled()) {
        console.log('🎧 [BASS-WIDGET] AudioContext info:', {
          hasAudioEngine: !!audioEngine,
          hasAudioContext: !!audioContext,
          hasDestination: !!audioContext.destination,
          state: audioContext.state,
        });
      }

      // Decode cached ArrayBuffers and collect into a Record
      const bassBuffers: Record<string, AudioBuffer> = {};
      let buffersDecoded = 0;

      for (const midiNote of midiNotesToLoad) {
        const cacheKey = `bass-${midiNote}`;

        // Try to get raw ArrayBuffer and decode it
        const rawBuffer = await sampleCache.getCachedRawBuffer(cacheKey);
        if (rawBuffer) {
          try {
            if (isVerboseDebugEnabled()) {
              console.log(`🔍 [BASS DECODE] Decoding ${cacheKey}`, {
                rawBufferSize: rawBuffer.byteLength,
                audioContextSampleRate: audioContext.sampleRate,
                audioContextState: audioContext.state,
              });
            }

            const buffer = await audioContext.decodeAudioData(rawBuffer.slice(0));

            // 🔊 DIAGNOSTIC: Analyze decoded buffer
            const channelData = buffer.getChannelData(0);
            let maxAmplitude = 0;
            let rmsSum = 0;
            for (let i = 0; i < Math.min(4800, channelData.length); i++) { // First 100ms at 48kHz
              const sample = Math.abs(channelData[i]);
              if (sample > maxAmplitude) maxAmplitude = sample;
              rmsSum += sample * sample;
            }
            const rmsLevel = Math.sqrt(rmsSum / Math.min(4800, channelData.length));

            if (isVerboseDebugEnabled()) {
              console.log(`✅ [BASS DECODE] Decoded ${cacheKey}`, {
                midiNote,
                duration: buffer.duration.toFixed(2) + 's',
                sampleRate: buffer.sampleRate,
                channels: buffer.numberOfChannels,
                first100msMaxAmplitude: maxAmplitude.toFixed(4),
                first100msRMSLevel: rmsLevel.toFixed(4),
                // Check if buffer has actual attack content
                hasStrongAttack: maxAmplitude > 0.1 ? 'YES' : 'WEAK/MISSING',
              });
            }

            bassBuffers[String(midiNote)] = buffer;
            buffersDecoded++;
          } catch (decodeError) {
            console.error(`❌ [BASS-WIDGET] Failed to decode ${cacheKey}:`, decodeError);
          }
        } else {
          console.warn(`⚠️ [BASS-WIDGET] No cached buffer for ${cacheKey} - sample may not have been preloaded`);
        }
      }

      if (isVerboseDebugEnabled()) {
        console.log('✅ [BASS-WIDGET] Buffer decoding complete:', {
          exerciseId: exercise?.id,
          totalNotes: midiNotesToLoad.length,
          buffersDecoded,
          bufferKeys: Object.keys(bassBuffers),
        });
      }

      if (buffersDecoded > 0) {
        // Use instrument gain node for volume control, fallback to destination
        const bassGainNode = playbackEngine.getOrCreateInstrumentGainNode('bass');
        const destination = bassGainNode || audioContext.destination;

        // Inject bass buffers into PlaybackEngine
        playbackEngine.setBassBuffers(bassBuffers, destination);

        // Apply initial volume/mute state
        const effectiveVolume = isMuted ? 0 : volume / 100;
        playbackEngine.setInstrumentVolume('bass', effectiveVolume);
        playbackEngine.setInstrumentMuted('bass', isMuted);

        // Also store locally for test playback
        bassBuffersRef.current = bassBuffers;

        if (isVerboseDebugEnabled()) {
          console.log('✅ [BASS-WIDGET] Bass buffers injected into PlaybackEngine', {
            exerciseId: exercise?.id,
            buffersInjected: buffersDecoded,
            midiNoteRange: `${Math.min(...midiNotesToLoad)}-${Math.max(...midiNotesToLoad)}`,
            audioContextState: audioContext.state,
          });
        }

        // CRITICAL: Set the bass buffers ready flag so GlobalControls knows playback can start
        WindowRegistry.setBassBuffersReady(true, exercise?.id);

        // Update state for UI feedback (DON'T update samplesLoadedTrigger to avoid infinite loop)
        setSamplesLoaded(buffersDecoded);
        setTotalSamples(midiNotesToLoad.length);
        setSamplerReady(true);
      } else if (midiNotesToLoad.length > 0) {
        // NO BUFFERS DECODED - Need to trigger the preload strategy!
        if (isVerboseDebugEnabled()) {
          console.log('🔄 [BASS-WIDGET] No cached buffers - triggering BassPreloadStrategy...', {
            exerciseId: exercise?.id,
            midiNotesToLoad,
          });
        }

        try {
          // Dynamically import BassPreloadStrategy
          const { BassPreloadStrategy } = await import(
            '@/domains/playback/modules/preloading/strategies/BassPreloadStrategy.js'
          );
          const bassStrategy = new BassPreloadStrategy();

          // Load samples for this exercise
          if (isVerboseDebugEnabled()) {
            console.log('📥 [BASS-WIDGET] Calling BassPreloadStrategy.loadFullSamples()...');
          }
          const result = await bassStrategy.loadFullSamples(undefined, exercise);

          if (isVerboseDebugEnabled()) {
            console.log('✅ [BASS-WIDGET] BassPreloadStrategy result:', {
              success: result.success,
              loaded: result.loaded,
              total: result.total,
            });
          }

          if (result.success && result.loaded > 0) {
            // Samples are now cached - try again to decode and inject
            if (isVerboseDebugEnabled()) {
              console.log('🔄 [BASS-WIDGET] Samples loaded, retrying buffer injection...');
            }

            // Use loadFromCachedMetadata to decode and inject
            const loadResult = await bassStrategy.loadFromCachedMetadata(audioContext);

            if (loadResult.success && loadResult.loaded > 0) {
              const loadedBuffers = bassStrategy.getLoadedBuffers();
              if (loadedBuffers) {
                bassBuffersRef.current = loadedBuffers;
                setSamplesLoaded(loadResult.loaded);
                setTotalSamples(loadResult.total);
                setSamplerReady(true);

                // CRITICAL: Set the bass buffers ready flag
                WindowRegistry.setBassBuffersReady(true, exercise?.id);

                if (isVerboseDebugEnabled()) {
                  console.log('✅ [BASS-WIDGET] Bass buffers loaded via preload strategy', {
                    exerciseId: exercise?.id,
                    buffersLoaded: Object.keys(loadedBuffers).length,
                  });
                }
              }
            }
          } else {
            if (isVerboseDebugEnabled()) {
              console.warn('⚠️ [BASS-WIDGET] BassPreloadStrategy failed to load samples');
            }
          }
        } catch (preloadError) {
          console.error('❌ [BASS-WIDGET] Failed to trigger BassPreloadStrategy:', preloadError);
        }
      } else {
        console.warn('⚠️ [BASS-WIDGET] No bass buffers decoded');
      }

      // PERFORMANCE FIX: Mark registration complete for this exercise+trigger
      lastRegisteredExerciseIdRef.current = `${exercise?.id}-${samplesLoadedTrigger}`;
    } catch (error) {
      console.error('❌ [BASS-WIDGET] Failed to inject bass buffers', error);
    } finally {
      isRegisteringRef.current = false;
    }
  }, [exercise?.id, samplesLoadedTrigger]);

  // PERFORMANCE FIX: Extract track.isReady as a stable primitive
  // The track object changes reference on every render, but isReady is a boolean
  const trackIsReady = track.isReady;

  // PERFORMANCE FIX: Calculate bass note count as a stable number
  const bassNoteCount = useMemo(() => {
    return exercise?.notes?.filter(
      (note) => note.string >= 1 && note.string <= 5
    )?.length || 0;
  }, [exercise?.notes]);

  // CRITICAL EFFECT: Register bass buffers when conditions are met
  // This triggers buffer injection BEFORE playback starts
  // PERFORMANCE FIX: Use stable primitives (trackIsReady, bassNoteCount) instead of object references
  useEffect(() => {
    const shouldRegister = trackIsReady && bassNoteCount > 0;

    if (isVerboseDebugEnabled()) {
      console.log('🔍 [BASS-CHECKPOINT] Should register bass:', {
        shouldRegister,
        trackIsReady,
        bassNoteCount,
        exerciseId: exercise?.id,
      });
    }

    if (shouldRegister) {
      if (isVerboseDebugEnabled()) {
        console.log(
          '🔥🔥🔥 [BASS-WIDGET] ALL CONDITIONS MET - Registering bass buffers!',
          {
            exerciseId: exercise?.id,
            bassNoteCount,
            reason: 'exercise loaded or samples ready',
          },
        );
      }

      // Register bass events and buffers for this exercise
      registerBassWithPlaybackEngine();
    }
  }, [
    trackIsReady,           // FIXED: stable boolean, not object reference
    bassNoteCount,          // FIXED: stable number via useMemo
    exercise?.id,
    samplesLoadedTrigger,
    registerBassWithPlaybackEngine,
  ]);
  // CRITICAL: Include exercise?.id to re-register when switching exercises
  // CRITICAL: Include samplesLoadedTrigger to re-register when samples finish loading
  // NOTE: Do NOT include isPlaying - that would cause duplicate calls

  // Handle articulation changes
  const handleArticulationChange = useCallback(
    (articulation: BassArticulationType) => {
      setCurrentArticulation(articulation);
      // Articulation affects future notes - for now just store the preference
      // In future phases, we could load articulation-specific samples
    },
    [],
  );

  // Get pattern notes
  const patternNotes = useMemo(() => {
    // If we have exercise notes, use those
    if (exercise?.notes && exercise.notes.length > 0) {
      return exercise.notes.filter(
        (note) =>
          // Filter for bass strings (assuming strings 1-4 are bass in a 6-string system)
          note.string >= 1 && note.string <= 4,
      );
    }

    // Otherwise use predefined patterns
    return (
      bassPatterns[pattern as keyof typeof bassPatterns] ||
      bassPatterns['Root-Fifth']
    );
  }, [pattern, exercise]);

  // Schedule bass pattern (for standalone pattern playback)
  const schedulePattern = useCallback(() => {
    const context = audioContextRef.current;
    if (!context || !track.isPlaying) return;

    // Clear any existing pattern
    currentPatternRef.current = [];

    // Calculate timing
    const currentTime = context.currentTime;
    const beatDuration = 60 / tempo;

    // Schedule pattern notes
    const scheduleTime = currentTime + 0.1; // Small lookahead

    patternNotes.forEach((noteInfo, index) => {
      const beat = noteInfo.beat ?? index;
      const noteTime = scheduleTime + beat * beatDuration;
      const duration = beatDuration * 0.9; // Slightly shorter for separation

      // Play the note using the sampler
      playBassNote(noteInfo.note, 0.7, duration, noteTime);

      // Store pattern info for visualization
      currentPatternRef.current.push({
        ...noteInfo,
        time: noteTime,
        duration,
      });
    });

    // Update visual selection to show all pattern notes
    setSelectedNotes(patternNotes);

    lastScheduledTimeRef.current = scheduleTime + 4 * beatDuration; // Assume 4/4 measure
  }, [patternNotes, tempo, track.isPlaying, playBassNote]);

  // Handle play state changes
  useEffect(() => {
    if (isPlaying && track.isReady && samplerReady) {
      // Only schedule pattern for standalone mode (not exercise playback)
      // Exercise playback uses EventBus bass-trigger events
      if (!exercise) {
        schedulePattern();

        // Set up interval to schedule next measures
        const measureDuration = (60 / tempo) * 4; // 4/4 time
        const interval = setInterval(
          () => {
            if (track.isPlaying) {
              schedulePattern();
            }
          },
          measureDuration * 1000 * 0.9,
        ); // Schedule slightly early

        return () => clearInterval(interval);
      }
    } else if (!isPlaying) {
      // Stop all notes and clear visualization
      stopAllNotes(true); // Graceful stop
      setSelectedNotes([]);
      setCurrentlyPlayingNote(null);
    }
  }, [isPlaying, track.isReady, samplerReady, exercise, schedulePattern, stopAllNotes, tempo]);

  // Listen for bass trigger events from the transport/track system
  useEffect(() => {
    if (!samplerReady) return;

    // Get EventBus instance
    const eventBus = WindowRegistry.getCoreServices()?.getEventBus?.();
    if (!eventBus) {
      logger.warn('EventBus not available for bass triggers');
      return;
    }

    // Handle bass trigger events from RegionProcessor/BassScheduler
    const handleBassTrigger = (event: any) => {
      logger.debug('🎸 Bass received trigger event:', event);

      const context = audioContextRef.current;
      if (!context) return;

      // Extract event data
      const midiNote = event.midiNote ?? event.note ?? 28; // MIDI note number
      const velocity = (event.velocity ?? 80) / 127; // Normalize to 0-1
      const duration = event.duration ?? 0.5;
      const audioTime = event.audioTime ?? context.currentTime;
      const stringNum = event.string;
      const fret = event.fret;

      // Play the note at the scheduled time using sampler
      // Note: The RegionProcessor/BassScheduler handles the actual audio playback
      // We only need to update the visual feedback here

      // Update visual feedback with precise timing
      const currentTime = context.currentTime;
      const delay = Math.max(0, (audioTime - currentTime) * 1000);

      setTimeout(() => {
        if (track.isPlaying) {
          // Set currently playing note for highlight animation
          setCurrentlyPlayingNote({
            midiNote,
            string: stringNum,
            fret,
          });

          // Update selected notes for visual feedback
          if (stringNum !== undefined && fret !== undefined) {
            setSelectedNotes([
              {
                note: midiNote,
                string: stringNum,
                fret,
                beat: event.beat || 0,
              },
            ]);
          }

          // Clear visual after note duration
          setTimeout(() => {
            setCurrentlyPlayingNote(null);
            if (!track.isPlaying) {
              setSelectedNotes([]);
            }
          }, duration * 1000);
        }
      }, delay);
    };

    // Subscribe to bass trigger events
    const unsubscribe = eventBus.on('bass-trigger', handleBassTrigger);
    logger.info('✅ Bass widget subscribed to trigger events');

    return () => {
      unsubscribe();
      logger.debug('🔴 Bass widget unsubscribed from trigger events');
    };
  }, [samplerReady, track.isPlaying]);

  // Handle exercise changes - clear scheduled events and prepare for new samples
  useEffect(() => {
    if (!exercise) return;

    logger.info('🎸 Exercise changed, clearing bass state', {
      exerciseId: exercise.id,
      hasNotes: !!exercise.notes?.length,
    });

    // Stop any currently playing notes
    stopAllNotes(false);
    setSelectedNotes([]);
    setCurrentlyPlayingNote(null);

    // CRITICAL: Clear bass buffers from PlaybackEngine when switching exercises
    // This prevents old exercise's buffers from contaminating new exercise
    const coreServices = WindowRegistry.getCoreServices();
    const playbackEngine = coreServices?.getPlaybackEngine?.();
    if (playbackEngine?.clearBassBuffers) {
      playbackEngine.clearBassBuffers();
      if (isVerboseDebugEnabled()) {
        console.log('🎸 [BASS-WIDGET] Cleared bass buffers for exercise switch', {
          newExerciseId: exercise.id,
        });
      }
    }

    // Also clear local buffer cache
    bassBuffersRef.current = {};

    // Check for new bass metadata/buffers that may have been loaded
    const metadata = GlobalSampleCache.getInstance().getMetadata('bass-required-notes');
    if (metadata && metadata.exerciseId === exercise.id) {
      logger.info('🎸 Bass metadata available for exercise', {
        noteCount: metadata.midiNotes?.length || 0,
      });
      setTotalSamples(metadata.midiNotes?.length || 0);
    }
  }, [exercise?.id, stopAllNotes]);

  // Test note function
  const testNote = useCallback(() => {
    if (samplerReady) {
      // Play open E string (E1 = MIDI 28)
      playBassNote(28, 0.7, 0.5);

      // Visual feedback
      setCurrentlyPlayingNote({ midiNote: 28, string: 1, fret: 0 });
      setSelectedNotes([{ note: 28, string: 1, fret: 0, beat: 0 }]);

      setTimeout(() => {
        setCurrentlyPlayingNote(null);
        setSelectedNotes([]);
      }, 500);
    } else {
      logger.warn('Bass sampler not ready for test');
    }
  }, [samplerReady, playBassNote]);

  // 🔊 DIAGNOSTIC: Direct test playback - bypasses all layers, plays raw buffer to destination
  const testDirectPlayback = useCallback(async () => {
    const context = audioContextRef.current;
    if (!context) {
      console.error('❌ [BASS TEST] No AudioContext');
      return;
    }

    // Get first available buffer from cache
    const availableKeys = Object.keys(bassBuffersRef.current);
    if (isVerboseDebugEnabled()) {
      console.log('🎸 [BASS TEST] Available buffers:', availableKeys);
    }

    const bufferKey = availableKeys[0] || '34'; // Use first available, fallback to 34
    let buffer = bassBuffersRef.current[bufferKey];

    if (!buffer) {
      // Try to get from scheduler
      const coreServices = WindowRegistry.getCoreServices();
      const playbackEngine = coreServices?.getPlaybackEngine?.();
      if (playbackEngine?.bassScheduler) {
        const buffers = (playbackEngine.bassScheduler as any).buffers;
        if (buffers instanceof Map) {
          buffer = buffers.get(bufferKey);
        }
      }
    }

    if (!buffer) {
      console.error('❌ [BASS TEST] No buffer for MIDI 28');
      return;
    }

    // Analyze buffer
    const channelData = buffer.getChannelData(0);
    let maxAmp = 0;
    for (let i = 0; i < Math.min(4800, channelData.length); i++) {
      maxAmp = Math.max(maxAmp, Math.abs(channelData[i]));
    }

    if (isVerboseDebugEnabled()) {
      console.log('🎸 [BASS TEST] Direct Playback Test', {
        bufferDuration: buffer.duration.toFixed(2) + 's',
        sampleRate: buffer.sampleRate,
        channels: buffer.numberOfChannels,
        first100msMaxAmplitude: maxAmp.toFixed(4),
        contextSampleRate: context.sampleRate,
        contextState: context.state,
      });
    }

    // Play DIRECTLY to destination - no gain nodes, no effects
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start(context.currentTime);

    if (isVerboseDebugEnabled()) {
      console.log('🎸 [BASS TEST] Playing raw buffer directly to destination (no processing)');

      // Also expose to window for manual testing
      (window as any).__testBassBuffer = buffer;
      (window as any).__testBassContext = context;
      console.log('🎸 [BASS TEST] Buffer exposed as window.__testBassBuffer, context as window.__testBassContext');
      console.log('🎸 [BASS TEST] To test manually: const s = window.__testBassContext.createBufferSource(); s.buffer = window.__testBassBuffer; s.connect(window.__testBassContext.destination); s.start();');
    }
  }, []);

  // Expose test function to window for console access
  useEffect(() => {
    (window as any).__testBassDirectPlayback = testDirectPlayback;
    if (isVerboseDebugEnabled()) {
      console.log('🎸 [BASS-WIDGET] Direct test function exposed as window.__testBassDirectPlayback()');
    }
  }, [testDirectPlayback]);

  // Fretboard visualization helpers
  const fretWindow = useMemo(() => {
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

  if (!isVisible) return null;

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
                    className={`font-semibold text-sm ${volume === 0 ? 'text-slate-600' : 'text-white'}`}
                  >
                    Bass Track
                  </h3>
                  <p
                    className={`text-xs ${volume === 0 ? 'text-slate-600' : 'text-slate-400'}`}
                  >
                    {pattern} | {currentArticulation}
                  </p>
                </div>

                <button
                  onClick={() => setIsExpanded(true)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-800 shadow-[5px_5px_10px_rgba(0,0,0,0.5),-5px_-5px_10px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300 cursor-pointer ${
                    volume === 0 ? 'opacity-50' : ''
                  }`}
                >
                  {/* Mini fretboard visualization - 4 strings */}
                  <div className="space-y-px">
                    {[4, 3, 2, 1].map((string) => (
                      <div key={`string-${string}`} className="flex gap-px">
                        {Array.from({ length: 8 }, (_, fretIndex) => {
                          const fret = fretWindow.start + fretIndex;
                          const hasNote = selectedNotes.some(
                            (note) =>
                              note.string === string && note.fret === fret,
                          );
                          const isPlaying =
                            currentlyPlayingNote?.string === string &&
                            currentlyPlayingNote?.fret === fret;
                          const isFretMarker = [
                            3, 5, 7, 9, 12, 15, 17, 19,
                          ].includes(fret);

                          return (
                            <div
                              key={`s${string}-f${fret}`}
                              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                                isPlaying
                                  ? 'bg-purple-400 animate-pulse scale-125'
                                  : hasNote
                                    ? 'bg-purple-500'
                                    : isFretMarker
                                      ? 'bg-slate-500'
                                      : 'bg-slate-600'
                              }`}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-4 w-full">
                <div className="flex-1">
                  <div className="flex flex-col gap-2">
                    {/* Pattern Selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-16">
                        Pattern:
                      </span>
                      <select
                        value={pattern}
                        onChange={(e) => onPatternChange(e.target.value)}
                        className="flex-1 bg-slate-700 text-white text-xs rounded px-2 py-1"
                      >
                        {Object.keys(bassPatterns).map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Articulation Selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-16">
                        Style:
                      </span>
                      <div className="flex gap-1">
                        {Object.entries(BassArticulation).map(
                          ([key, value]) => (
                            <button
                              key={value}
                              onClick={() => handleArticulationChange(value)}
                              className={`px-2 py-1 text-xs rounded ${
                                currentArticulation === value
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-slate-700 text-slate-400'
                              }`}
                            >
                              {key.charAt(0) + key.slice(1).toLowerCase()}
                            </button>
                          ),
                        )}
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-16">
                        Status:
                      </span>
                      {samplerReady ? (
                        samplesLoaded > 0 ? (
                          <span className="text-xs text-green-500">
                            ✅ {samplesLoaded} samples loaded
                          </span>
                        ) : totalSamples > 0 ? (
                          <span className="text-xs text-blue-400">
                            🎵 Ready ({totalSamples} notes)
                          </span>
                        ) : (
                          <span className="text-xs text-blue-400">
                            🎵 Ready (on-demand loading)
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-yellow-500">
                          ⏳ Initializing sampler...
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={testNote}
                    className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!samplerReady}
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

// Phase 5.1: Wrap in React.memo to prevent unnecessary re-renders
export const BassLineWidget = React.memo(BassLineWidgetComponent);
