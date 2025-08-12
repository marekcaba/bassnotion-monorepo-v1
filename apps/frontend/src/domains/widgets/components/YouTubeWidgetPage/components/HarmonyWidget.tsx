'use client';

import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { SyncedWidget } from '../../base';
import type { SyncedWidgetRenderProps } from '../../base';
import { VolumeKnob } from './VolumeKnob';
import { ChordSlotSelector } from './ChordSlotSelector';
import { ProfessionalKeyboardSelector } from './ProfessionalKeyboardSelector';
import { useWidgetAudioRegistration } from '../../../hooks/useWidgetAudioRegistration';
import { useAudio, useTransport, usePlugins } from '@/domains/playback/hooks';
import { MusicalTimeConverter } from '@bassnotion/contracts/services/MusicalTimeConverter';
import type {
  HarmonyChange,
  TimeSignature,
  MusicalPosition,
} from '@bassnotion/contracts/types/musical-time';
import {
  TransportWidgetAdapter,
  createTransportAdapter,
} from '../../../services/TransportWidgetAdapter';
import { usePatternRegistration } from '../../../hooks/usePatternRegistration';
import { widgetSingleton } from '../../../utils/widgetSingleton';
import type { HarmonyPattern, ChordPatternEvent } from '@/domains/playback/types/pattern';
import { toMusicalPosition as toPosition } from '@/domains/playback/types/pattern';
// Import from ChordInstrumentProcessor
// NOTE: This will cause Tone.js to be loaded statically, triggering AudioContext initialization
// The proper fix would require refactoring all audio processors to use dynamic imports
import { ChordPreset } from '@/domains/playback/services/plugins/ChordInstrumentProcessor';

interface HarmonyWidgetProps {
  progression: string[];
  currentChord: number;
  isPlaying: boolean;
  isVisible: boolean;
  onNextChord: () => void;
  onProgressionChange: (progression: string[]) => void;
  onToggleVisibility: () => void;
  onTogglePlay?: () => void;
  tempo?: number;
}

// Professional chord progressions with musical timing
const chordProgressions = {
  'Jazz Standard': [
    { chord: 'Dm7', duration: 1 },
    { chord: 'G7', duration: 1 },
    { chord: 'CMaj7', duration: 1 },
    { chord: 'Am7', duration: 1 },
  ],
  'Blues in C': [
    { chord: 'C7', duration: 4 },
    { chord: 'F7', duration: 2 },
    { chord: 'C7', duration: 2 },
    { chord: 'G7', duration: 1 },
    { chord: 'F7', duration: 1 },
    { chord: 'C7', duration: 2 },
  ],
  'Pop Progression': [
    { chord: 'C', duration: 1 },
    { chord: 'G', duration: 1 },
    { chord: 'Am', duration: 1 },
    { chord: 'F', duration: 1 },
  ],
  'Modal Jazz': [
    { chord: 'Dm7', duration: 2 },
    { chord: 'Em7', duration: 2 },
    { chord: 'FMaj7', duration: 2 },
    { chord: 'G7', duration: 2 },
  ],
  'Bossa Nova': [
    { chord: 'CMaj7', duration: 2 },
    { chord: 'Dm7', duration: 1 },
    { chord: 'G7', duration: 1 },
    { chord: 'Em7', duration: 1 },
    { chord: 'A7', duration: 1 },
    { chord: 'Dm7', duration: 1 },
    { chord: 'G7', duration: 1 },
  ],
  'Funk Groove': [
    { chord: 'Dm7', duration: 2 },
    { chord: 'Dm7', duration: 2 },
    { chord: 'G7', duration: 2 },
    { chord: 'G7', duration: 2 },
  ],
};

// Convert simple chord array to professional harmony changes
const convertToHarmonyChanges = (
  chords: string[],
  barsPerChord = 1,
): HarmonyChange[] => {
  let currentBar = 1;
  return chords.map((chord) => {
    const change: HarmonyChange = {
      measure: currentBar,
      chord,
      duration: barsPerChord,
    };
    currentBar += barsPerChord;
    return change;
  });
};

// Legacy props interface for backward compatibility
export function HarmonyWidget({
  progression,
  currentChord,
  isPlaying,
  isVisible,
  onNextChord,
  onProgressionChange,
  onToggleVisibility,
  onTogglePlay,
}: HarmonyWidgetProps) {
  return (
    <SyncedWidget
      widgetId="harmony-widget"
      widgetName="Harmony"
      debugMode={false}
      syncOptions={{
        subscribeTo: [
          'PLAYBACK_STATE', // For isPlaying
          'PLAY', // For play event
          'PAUSE', // For pause event
          'STOP', // For immediate stop of all sounds
          'EXERCISE_CHANGE', // For exercise data
          'TEMPO_CHANGE', // For tempo updates
          'BAR_CHANGE', // For bar changes to trigger chord progression
          'BEAT_CHANGE', // For beat changes for visual timing
          'MUSICAL_TIME_UPDATE', // For musical timing updates
          'SEEK', // For position seeking
        ],
      }}
    >
      {(syncProps: SyncedWidgetRenderProps) => (
        <HarmonyWidgetContent
          progression={progression}
          currentChord={currentChord}
          isPlaying={isPlaying}
          isVisible={isVisible}
          onNextChord={onNextChord}
          onProgressionChange={onProgressionChange}
          onToggleVisibility={onToggleVisibility}
          onTogglePlay={onTogglePlay}
          syncProps={syncProps}
          debugMode={false}
        />
      )}
    </SyncedWidget>
  );
}

// Internal content component that handles sync events
interface HarmonyWidgetContentProps extends HarmonyWidgetProps {
  syncProps: SyncedWidgetRenderProps;
  debugMode?: boolean;
}

function HarmonyWidgetContent({
  progression: initialProgression,
  currentChord: initialCurrentChord,
  isPlaying,
  isVisible,
  onNextChord,
  onProgressionChange,
  onToggleVisibility,
  onTogglePlay,
  syncProps,
  tempo = 120,
  debugMode = false,
}: HarmonyWidgetContentProps) {
  // Get synchronized playback state from sync props
  const syncIsPlaying = syncProps.isPlaying;
  const syncTempo = syncProps.tempo || syncProps.sync?.tempo || tempo;

  // Local state for progression and current chord that can be updated by sync events
  const [progression, setProgression] = useState(initialProgression);
  const [currentChord, setCurrentChord] = useState(initialCurrentChord);

  // Refs for audio components
  const loopRef = useRef<any>(null);
  const ToneRef = useRef<typeof import('tone') | null>(null);
  const transportAdapterRef = useRef<TransportWidgetAdapter | null>(null);

  // Store chord durations and positions from exercise
  const chordDurationsRef = useRef<number[] | null>(null);
  const chordPositionsRef = useRef<MusicalPosition[] | null>(null);

  // Use exercise chord progression if available
  useEffect(() => {
    if (
      syncProps.exercise?.chord_progression &&
      syncProps.exercise.chord_progression.length > 0
    ) {
      console.log(
        '🎵 HarmonyWidget: Using exercise chord progression:',
        syncProps.exercise.chord_progression,
      );
      setProgression(syncProps.exercise.chord_progression);

      // Store chord durations and positions if available
      if (syncProps.exercise.chord_durations) {
        chordDurationsRef.current = syncProps.exercise.chord_durations;
        console.log(
          '🎵 HarmonyWidget: Using chord durations:',
          syncProps.exercise.chord_durations,
        );
      }

      if (syncProps.exercise.chord_positions) {
        chordPositionsRef.current = syncProps.exercise.chord_positions;
        console.log(
          '🎵 HarmonyWidget: Using chord positions:',
          syncProps.exercise.chord_positions,
        );
      }

      // Store exercise duration info
      exerciseDurationBeatsRef.current =
        syncProps.exercise.duration_beats || null;
      timeSignatureRef.current = syncProps.exercise.timeSignature || {
        numerator: 4,
        denominator: 4,
      };
    }
  }, [syncProps.exercise]);

  // Get audio services from new hooks
  const { isReady: audioReady, getTone, createSampler } = useAudio();
  const { start: startTransport, stop: stopTransport, tempo: transportTempo, setTempo: setTransportTempo } = useTransport();
  const { getPlugin } = usePlugins();
  
  // Get Tone instance for backward compatibility
  const Tone = audioReady ? getTone() : null;
  const Transport = Tone?.Transport;
  const toneReady = audioReady;
  
  // CRITICAL LOGGING: Track Transport instance identity
  useEffect(() => {
    console.log('🎵🔍 HarmonyWidget: Transport Instance Check', {
      hasTransport: !!Transport,
      transportIdentity: Transport ? Object.prototype.toString.call(Transport) : 'null',
      transportState: Transport?.state,
      transportConstructor: Transport?.constructor?.name,
      transportId: Transport ? (Transport as any)._id || 'no-id' : 'no-transport',
      audioReady,
      hasTone: !!Tone,
    });
  }, [Transport, Tone, audioReady]);
  
  const chordProcessorRef = useRef<any | null>(null);
  const chordSynthRef = useRef<any>(null); // Legacy ref for compatibility
  const [isInitialized, setIsInitialized] = useState(false);
  const [localAudioReady, setLocalAudioReady] = useState(false);

  // Handle STOP event to immediately stop all sounds
  useEffect(() => {
    const handleStopEvent = () => {
      console.log(
        '🎵 HarmonyWidget: Received STOP event, stopping all sounds...',
      );

      // Stop the schedule immediately
      if (loopRef.current && loopRef.current.scheduleId) {
        try {
          const tone = getTone();
          if (tone) {
            tone.Transport.clear(loopRef.current.scheduleId);
          }
          loopRef.current = null;
          console.log('🎵 HarmonyWidget: Schedule cleared');
        } catch (error) {
          console.warn('Failed to clear schedule:', error);
        }
      }

      // PROFESSIONAL DAW BEHAVIOR: Execute MIDI Panic on harmony instruments
      // This ensures all chord sounds stop immediately like Logic Pro and Ableton Live
      if (chordProcessorRef.current) {
        try {
          // Use the most aggressive panic method available
          if (typeof chordProcessorRef.current.midiPanic === 'function') {
            chordProcessorRef.current.midiPanic();
            console.log('✅ Harmony Emergency MIDI Panic executed successfully');
          } else if (typeof chordProcessorRef.current.panic === 'function') {
            chordProcessorRef.current.panic();
            console.log('✅ Harmony MIDI Panic executed successfully');
          } else {
            // Fallback to old stopChord method
            chordProcessorRef.current.stopChord();
            console.log('🎵 HarmonyWidget: Called stopChord() for immediate silence');
            
            // Also try to release all if available
            if (chordProcessorRef.current.releaseAll) {
              chordProcessorRef.current.releaseAll(Tone.immediate());
            }
          }
        } catch (error) {
          console.error('❌ Harmony MIDI Panic failed:', error);
        }
      }

      // Cancel all scheduled Transport events
      if (Transport) {
        // Cancel all future events (but this might affect other widgets)
        // Instead, we should track our own scheduled events
        try {
          // Clear any scheduled chord events in the next few seconds
          const now = Transport.seconds;
          const clearUntil = now + 10; // Clear next 10 seconds of events
          Transport.cancel(now);
          console.log('🎵 HarmonyWidget: Cancelled Transport events from now');
        } catch (error) {
          console.warn('Failed to cancel transport events:', error);
        }
      }

      // Clear the current chord index
      setCurrentChord(0);
    };

    // Handle SEEK event to jump to a new position
    const handleSeekEvent = () => {
      const seekData = syncProps.sync?.lastEvent?.payload;
      if (seekData && typeof seekData.position === 'number') {
        console.log(
          `🎵 HarmonyWidget: Received SEEK event to position ${seekData.position}s`,
        );

        // Calculate which chord we should be on based on the seek position
        const beatsPerSecond = syncTempo / 60;
        const currentBeat = Math.floor(seekData.position * beatsPerSecond);
        
        // Use chord durations if available, otherwise default to 4 beats per chord
        let newChordIndex = 0;
        if (chordDurationsRef.current && chordDurationsRef.current.length > 0) {
          let accumulatedBeats = 0;
          for (let i = 0; i < chordDurationsRef.current.length; i++) {
            accumulatedBeats += chordDurationsRef.current[i];
            if (currentBeat < accumulatedBeats) {
              newChordIndex = i;
              break;
            }
          }
          // If we've gone past all chords, wrap around
          if (currentBeat >= accumulatedBeats) {
            const totalDuration = accumulatedBeats;
            const beatInCycle = currentBeat % totalDuration;
            accumulatedBeats = 0;
            for (let i = 0; i < chordDurationsRef.current.length; i++) {
              accumulatedBeats += chordDurationsRef.current[i];
              if (beatInCycle < accumulatedBeats) {
                newChordIndex = i;
                break;
              }
            }
          }
        } else {
          // Fallback to 4 beats per chord
          const beatsPerChord = 4;
          const currentMeasure = Math.floor(currentBeat / beatsPerChord);
          newChordIndex = currentMeasure % progression.length;
        }

        setCurrentChord(newChordIndex);

        // If we have a running loop, it will automatically sync on the next iteration
        if (loopRef.current && syncIsPlaying) {
          console.log(
            `🎵 HarmonyWidget: Synced to chord ${newChordIndex} at beat ${currentBeat}`,
          );
        }
      }
    };

    // Listen for STOP and SEEK events from sync props
    if (syncProps.sync?.lastEvent?.type === 'STOP') {
      handleStopEvent();
    } else if (syncProps.sync?.lastEvent?.type === 'SEEK') {
      handleSeekEvent();
    }
  }, [syncProps.sync?.lastEvent, syncTempo, progression.length, syncIsPlaying]);

  // Debug: Log the playing state only when it changes (reduced logging)
  useEffect(() => {
    if (debugMode) {
      console.log('🎵 HarmonyWidget state change:', {
        syncIsPlaying,
        progression: initialProgression.slice(0, 3),
        currentChord,
        syncTempo,
        hasSynth: !!chordSynthRef.current,
      });
    }
  }, [syncIsPlaying, currentChord, debugMode]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [canAddLeft] = useState(true);
  const [canAddRight] = useState(true);
  const [currentBar, setCurrentBar] = useState(1);
  const [currentBeat, setCurrentBeat] = useState(1);

  // Audio registration with the CorePlaybackEngine
  const { controls: audioControls } = useWidgetAudioRegistration({
    widgetId: 'harmony-widget',
    widgetType: 'harmony',
    displayName: 'Harmony',
    audioConfig: {
      type: 'harmony',
      volume: volume / 100,
      pan: 0,
      muted: isMuted,
      solo: false,
    },
    autoRegister: false, // Disable auto-registration to prevent loops
  });

  // Professional chord processor for high-quality chord playback
  const [selectedPreset, setSelectedPreset] = useState<ChordPreset>(
    ChordPreset.PIANO, // Default to Salamander Piano
  );

  // Story 3.16: Professional keyboard selector state
  const [showKeyboardSelector, setShowKeyboardSelector] = useState(false);
  const [availableInstruments, setAvailableInstruments] = useState<any[]>([
    {
      id: 'salamander-piano',
      name: 'Salamander Grand Piano',
      description: 'Studio-quality grand piano with 16 velocity layers',
      category: 'piano' as const,
      preset: ChordPreset.PIANO,
      quality: 'exceptional' as const,
      size: 1200 * 1024 * 1024, // 1.2GB
      sampleCount: 88,
      brand: 'Salamander',
      isDefault: true,
    },
    {
      id: 'wurlitzer-electric',
      name: 'Wurlitzer Electric Piano',
      description: 'Vintage Wurlitzer 200A with mechanical key sounds',
      category: 'electric-piano' as const,
      preset: ChordPreset.WURLITZER,
      quality: 'professional' as const,
      size: 350 * 1024 * 1024, // 350MB
      sampleCount: 88,
      brand: 'Wurlitzer',
    },
    {
      id: 'rhodes-velocity',
      name: 'Rhodes Electric Piano',
      description: 'Classic Fender Rhodes with 4 velocity layers',
      category: 'electric-piano' as const,
      preset: ChordPreset.RHODES_VELOCITY,
      quality: 'professional' as const,
      size: 100 * 1024 * 1024, // 100MB
      sampleCount: 73,
      brand: 'Rhodes',
    },
    {
      id: 'long-pad',
      name: 'Long Pad',
      description: 'Lush pad synthesizer with ADSR control',
      category: 'synthesizer' as const,
      preset: ChordPreset.LONG_PAD,
      quality: 'professional' as const,
      size: 50 * 1024 * 1024, // 50MB
      sampleCount: 61,
      brand: 'Custom',
    },
    {
      id: 'the-saw',
      name: 'The Saw',
      description: 'Powerful saw wave synthesizer with filter control',
      category: 'synthesizer' as const,
      preset: ChordPreset.THE_SAW,
      quality: 'professional' as const,
      size: 20 * 1024 * 1024, // 20MB
      sampleCount: 11,
      brand: 'JiKay',
    },
    {
      id: 'rhodes-synth',
      name: 'Rhodes (Synthesis)',
      description: 'Synthesized Rhodes electric piano',
      category: 'electric-piano' as const,
      preset: ChordPreset.RHODES,
      quality: 'good' as const,
      size: 0, // Synthesis
      sampleCount: 0,
      brand: 'Tone.js',
    },
    {
      id: 'organ-synth',
      name: 'Organ (Synthesis)',
      description: 'Synthesized Hammond B3 organ',
      category: 'organ' as const,
      preset: ChordPreset.ORGAN,
      quality: 'good' as const,
      size: 0, // Synthesis
      sampleCount: 0,
      brand: 'Tone.js',
    },
    {
      id: 'pad-synth',
      name: 'Pad (Synthesis)',
      description: 'Synthesized warm pad',
      category: 'synthesizer' as const,
      preset: ChordPreset.PAD,
      quality: 'good' as const,
      size: 0, // Synthesis
      sampleCount: 0,
      brand: 'Tone.js',
    },
  ]);
  const [isLoadingInstrument, setIsLoadingInstrument] = useState(false);
  
  // Note: We don't need to track isActiveWidget state here since
  // usePatternRegistration handles singleton validation internally
  
  // Widget singleton management
  const [widgetInstanceId] = useState(() => {
    return widgetSingleton.register('harmony', () => {
      // Cleanup function will be called by singleton manager
      console.log('🧹 Singleton cleanup: Harmony widget');
      if (chordProcessorRef.current) {
        try {
          chordProcessorRef.current.dispose();
        } catch (error) {
          console.error('Error disposing chord processor:', error);
        }
      }
    });
  });
  
  // Track if pattern is registered
  const patternRegisteredRef = useRef<boolean>(false);
  
  // Hook for pattern registration with transport
  const { registerPattern, updatePattern, setEnabled } = usePatternRegistration({
    widgetId: widgetInstanceId,
    widgetType: 'harmony',
    enabled: !isMuted
  });
  
  // Update pattern enable state when mute changes
  useEffect(() => {
    if (patternRegisteredRef.current) {
      try {
        setEnabled(!isMuted);
        console.log(`🎧 HarmonyWidget[${widgetInstanceId}]: Pattern enabled = ${!isMuted}`);
      } catch (error) {
        console.error(`❌ HarmonyWidget[${widgetInstanceId}]: Failed to set enabled:`, error);
        patternRegisteredRef.current = false;
      }
    } else {
      console.log(`⚠️ HarmonyWidget[${widgetInstanceId}]: Skipping setEnabled - pattern not registered`);
    }
  }, [isMuted, setEnabled, widgetInstanceId]);

  // Initialize chord processor when context is ready
  // NOTE: Commented out to avoid duplicate initialization - the next useEffect handles this
  /*
  useEffect(() => {
    const initializeChordProcessor = async () => {
      try {
        const isReady = localAudioReady || audioReady;
        if (!Tone || !isReady) {
          console.warn(
            '🎵 Tone.js not ready yet, cannot create chord processor',
          );
          return;
        }

        if (Tone.context.state === 'closed') {
          console.warn(
            '🎵 Tone.js context is closed, cannot create chord processor',
          );
          return;
        }

        // For now, always initialize early to ensure processor is ready
        // TODO: Optimize this to use smart loading with exercise context
        
        // Check if there's a preloaded processor available
        let processor;
        if ((window as any).__preloadedChordProcessor) {
          console.log('🎵 Using preloaded ChordInstrumentProcessor!');
          processor = (window as any).__preloadedChordProcessor;
          // Don't delete - let other widgets use it too
        } else {
          // Dynamically import ChordInstrumentProcessor to avoid early AudioContext init
          const { ChordInstrumentProcessor } = await import(
            '@/domains/playback/services/plugins/ChordInstrumentProcessor'
          );
          processor = new ChordInstrumentProcessor();
        }

        // Only pre-activate if context is running
        if (Tone.context.state === 'running') {
          try {
            await processor.preActivateAudioContext();
          } catch (error) {
            console.warn('🎵 Could not pre-activate AudioContext:', error);
            // Continue anyway - it will be activated on first user interaction
          }
        } else {
          console.log(
            '🎵 AudioContext not running, will activate on user interaction',
          );
        }

        await processor.setPreset(selectedPreset);
        chordProcessorRef.current = processor;

        // Set initialized immediately - processor.setPreset is async and waits for samples
        setIsInitialized(true);
        if (debugMode)
          console.log(
            '🎵 Professional chord processor initialized and ready with preset:',
            selectedPreset,
          );
      } catch (error) {
        console.warn('Failed to initialize chord processor:', error);
        chordProcessorRef.current = null;
        // Don't throw - just log the error and continue
        // The processor will fallback to synthesis mode
      }
    };

    // Initialize only when Tone is ready
    if (Tone && audioReady) {
      initializeChordProcessor();
    }

    // Cleanup on unmount
    return () => {
      if (chordProcessorRef.current) {
        chordProcessorRef.current.dispose();
        chordProcessorRef.current = null;
      }
    };
  }, [Tone, audioReady, selectedPreset, debugMode]);
  */

  // CRITICAL: Load samples IMMEDIATELY on mount - don't wait for anything!
  useEffect(() => {
    const initWhenReady = async () => {
      console.log('🎵 HarmonyWidget initWhenReady check:', {
        syncIsPlaying,
        hasProcessor: !!chordProcessorRef.current,
        hasTone: !!Tone,
        audioReady,
        hasPreloaded: !!(window as any).__preloadedChordProcessor,
        hasExercise: !!syncProps.exercise
      });
      
      // IMMEDIATE INIT: Create processor as soon as we have Tone, don't wait for audioReady
      if (!chordProcessorRef.current && Tone) {
        console.log('🎵🚀 IMMEDIATELY LOADING HARMONY SAMPLES (not waiting for play or audioReady)...');
        const initProcessor = async () => {
          try {
            // First check BackgroundSampleLoader for preloaded samples
            const { getBackgroundLoader } = await import('@/domains/playback/services/BackgroundSampleLoader');
            const loader = getBackgroundLoader();
            const preloadedSamples = loader.getPreloadedSamples('harmony');
            
            if (preloadedSamples) {
              const status = loader.getSampleStatus('harmony');
              console.log(`🎵✅ Using preloaded harmony samples (${status.quality} quality)!`);
              chordProcessorRef.current = preloadedSamples;
              setIsInitialized(true);
              setLocalAudioReady(true); // Mark as ready immediately when we have preloaded samples
              
              // Listen for sample upgrades
              const handleUpgrade = (event: CustomEvent) => {
                if (event.detail.instrument === 'harmony') {
                  const newSamples = loader.getPreloadedSamples('harmony');
                  if (newSamples && newSamples !== chordProcessorRef.current) {
                    console.log(`✨ Upgrading harmony to ${event.detail.quality} quality`);
                    chordProcessorRef.current = newSamples;
                  }
                }
              };
              window.addEventListener('samplesUpgraded', handleUpgrade as EventListener);
              
              return;
            }
            
            // Fallback: Check legacy preloaded samples
            if ((window as any).__preloadedChordProcessor) {
              console.log('🎵✅ Using legacy preloaded ChordInstrumentProcessor!');
              chordProcessorRef.current = (window as any).__preloadedChordProcessor;
              setIsInitialized(true);
              setLocalAudioReady(true); // Mark as ready immediately
              return;
            }
            
            // Check if on-demand loading is enabled
            if ((window as any).__samplesLoadOnDemand) {
              console.log('🎵 On-demand loading enabled, creating processor immediately...');
            } else {
              // Legacy wait logic (shouldn't happen with new strategy)
              console.warn('⚠️ No preload strategy detected, creating processor...');
            }
            // AudioContext will be started by CorePlaybackEngine when needed
            if (Tone.context.state !== 'running') {
              if (debugMode)
                console.log(
                  '🎵 AudioContext not running yet - will be started by CorePlaybackEngine',
                );
            }

            console.log('🎵 Creating ChordInstrumentProcessor immediately (not waiting for play)...');
            
            // Already checked for preloaded processor above, so create new one
            // Dynamically import to avoid early AudioContext init
            const { ChordInstrumentProcessor } = await import(
              '@/domains/playback/services/plugins/ChordInstrumentProcessor'
            );
            const processor = new ChordInstrumentProcessor();
            
            // Set the processor ref immediately so it's available for playback
            chordProcessorRef.current = processor;
            console.log('🎵 Processor ref set, initializing...');
            
            // Set exercise context for smart loading
            // Use syncProps.exercise directly (not syncProps.sync.exercise.selectedExercise)
            const exercise = syncProps.exercise;
            if (exercise) {
              console.log('🎵 Setting exercise context for smart loading...', {
                title: exercise.title,
                chords: exercise.chord_progression
              });
              processor.setExerciseContext(exercise);
            } else {
              console.log('🎵 No exercise context available yet', {
                syncPropsKeys: Object.keys(syncProps),
                hasExercise: !!syncProps.exercise
              });
            }
            
            // Set preset - this will use smart loading if exercise context is available
            console.log('🎵 Setting preset and loading samples immediately...');
            await processor.setPreset(selectedPreset);
            
            // CRITICAL: Force immediate sample loading - don't wait for play!
            if (selectedPreset === ChordPreset.PIANO) {
              console.log('🎵 Force loading Salamander piano samples NOW...');
              try {
                // Ensure the processor loads samples immediately
                await processor.ensureSamplesLoaded();
                console.log('✅ Salamander samples loaded and ready!');
              } catch (error) {
                console.error('Failed to load Salamander samples:', error);
                // Still continue - processor will use fallback if needed
              }
            }
            
            // Mark as initialized after samples are loaded
            setIsInitialized(true);
            console.log(
              '🎵 Harmony chord processor ready with preset:',
              selectedPreset,
              'processor assigned:',
              !!chordProcessorRef.current,
              'isInitialized:',
              true
            );
          } catch (error) {
            console.warn('Failed to initialize chord processor:', error);
          }
        };

        initProcessor();
      }
    };

    initWhenReady();
    
    // Cleanup on unmount
    return () => {
      if (chordProcessorRef.current) {
        chordProcessorRef.current.dispose();
        chordProcessorRef.current = null;
      }
    };
  }, [Tone, selectedPreset, debugMode]); // Only depend on Tone - load immediately when available!
  
  // Create harmony pattern from chord progression
  const createHarmonyPattern = useCallback((): HarmonyPattern => {
    const events: ChordPatternEvent[] = [];
    let currentBar = 0;
    let currentBeat = 0;
    
    // Use chord durations if available, otherwise default to 4 beats per chord
    for (let i = 0; i < progression.length; i++) {
      const chord = progression[i];
      const duration = chordDurationsRef.current?.[i] || 4; // beats
      
      // Add chord event at the current position
      events.push({
        position: toPosition(currentBar, currentBeat, 0),
        chord: chord || 'C', // Default to C if no chord
        velocity: 0.7,
        duration: `${duration * 4}n` // Convert beats to 16th notes
      });
      
      // Calculate next position
      currentBeat += duration;
      while (currentBeat >= 4) { // Assuming 4/4 time
        currentBeat -= 4;
        currentBar++;
      }
    }
    
    // Calculate total loop length in bars
    const totalBeats = chordDurationsRef.current?.reduce((sum, dur) => sum + dur, 0) || (progression.length * 4);
    const loopLength = Math.ceil(totalBeats / 4);
    
    return {
      id: `harmony-${widgetInstanceId}`,
      events,
      loopLength
    };
  }, [progression, widgetInstanceId]);
  
  // Pattern trigger callback - called by transport at exact timing
  const handlePatternTrigger = useCallback((event: ChordPatternEvent, time: number) => {
    if (!chordProcessorRef.current) return;
    
    // Log once per chord to avoid spam
    console.log(`🎵 HarmonyWidget: Pattern trigger for chord ${event.chord} at ${event.position}`);
    
    try {
      // Apply volume
      const actualVolume = (volume / 100) * 0.6;
      chordProcessorRef.current.setVolume(actualVolume);
      
      // Play chord at exact time with duration
      const durationMs = parseInt(event.duration || '4n') * (60000 / syncTempo) / 4;
      chordProcessorRef.current.playChord(event.chord, {
        duration: durationMs,
        velocity: event.velocity || 0.7,
        time: time
      });
    } catch (error) {
      console.error(`❌ Error playing chord ${event.chord}:`, error);
    }
  }, [volume, syncTempo]);
  
  // Register pattern when chord processor is initialized - only for active widget instances
  useEffect(() => {
    if (!chordProcessorRef.current || !isInitialized) return;
    
    // Pattern registration handles singleton validation internally
    console.log(`🎧 HarmonyWidget[${widgetInstanceId}]: Attempting pattern registration`);
    
    const pattern = createHarmonyPattern();
    
    if (!patternRegisteredRef.current) {
      const registrationSucceeded = registerPattern(pattern, handlePatternTrigger);
      patternRegisteredRef.current = registrationSucceeded;
      
      if (registrationSucceeded) {
        console.log(`✅ HarmonyWidget[${widgetInstanceId}]: Pattern registered with transport`);
      } else {
        console.error(`❌ HarmonyWidget[${widgetInstanceId}]: Pattern registration failed - widget may not be active`);
      }
    } else {
      // Update pattern if progression changed
      updatePattern(pattern);
      console.log(`🎵 HarmonyWidget[${widgetInstanceId}]: Pattern updated`);
    }
    
    return () => {
      patternRegisteredRef.current = false;
    };
  }, [createHarmonyPattern, registerPattern, updatePattern, handlePatternTrigger, progression, isInitialized, widgetInstanceId]);

  // REMOVED: Complex Transport monitoring logic - now handled by pattern scheduler
  /*
  // Monitor actual Transport state and play chords when transport starts
  useEffect(() => {
    // Use localAudioReady when we have preloaded samples, otherwise wait for audioReady
    const isReady = localAudioReady || audioReady;
    if (!Transport || !Tone || !isReady || !chordProcessorRef.current) return;
    
    let loopRef: any = null;
    
    const checkTransportState = () => {
      const state = Transport.state;
      console.log('🎵 HarmonyWidget: Transport state check:', state);
      
      if (state === 'started' && !loopRef) {
        console.log('🎵 HarmonyWidget: Transport is started, creating chord loop');
        
        // Create a loop that follows the chord progression
        loopRef = new Tone.Loop((time) => {
          if (!progression || progression.length === 0) return;
          
          // Get current transport position from fresh Tone reference
          const transportPosition = actualTransport?.position?.toString() || '0:0:0';
          const [bar, beat, sixteenth] = transportPosition.split(':').map(Number);
          const currentBeat = bar * 4 + beat; // Assuming 4/4 time
          
          // Calculate which chord to play based on current beat
          let beatsElapsed = 0;
          let chordIndex = 0;
          
          for (let i = 0; i < progression.length; i++) {
            const chordDuration = chordDurationsRef.current?.[i] || 4;
            if (currentBeat >= beatsElapsed && currentBeat < beatsElapsed + chordDuration) {
              chordIndex = i;
              break;
            }
            beatsElapsed += chordDuration;
          }
          
          // Only play on the first sixteenth of the chord change
          if (sixteenth === 0) {
            const currentChord = progression[chordIndex];
            const isFirstBeatOfChord = currentBeat === (chordPositionsRef.current?.[chordIndex]?.start_beat || beatsElapsed);
            
            if (isFirstBeatOfChord && currentChord) {
              console.log(`🎵 HarmonyWidget: Playing chord ${currentChord} at beat ${currentBeat}`);
              try {
                chordProcessorRef.current.playChord(currentChord, {
                  duration: (chordDurationsRef.current?.[chordIndex] || 4) * (60000 / (transportTempo || 120)),
                  velocity: 0.7,
                  time: time
                });
              } catch (error) {
                console.error('🎵 HarmonyWidget: Error playing chord:', error);
              }
            }
          }
        }, '16n'); // Check every 16th note
        
        loopRef.start('+0.05');
      } else if (state === 'stopped' && loopRef) {
        console.log('🎵 HarmonyWidget: Transport is stopped, stopping chord loop');
        loopRef.stop();
        loopRef.dispose();
        loopRef = null;
      }
    };
    
    // Check immediately
    checkTransportState();
    
    // Check periodically
    const interval = setInterval(checkTransportState, 100);
    
    return () => {
      clearInterval(interval);
      if (loopRef) {
        loopRef.stop();
        loopRef.dispose();
        loopRef = null;
      }
    };
  }, [Transport, Tone, audioReady, progression, transportTempo]);
  */

  // Initialize transport adapter for synchronized timing
  useEffect(() => {
    if (!transportAdapterRef.current) {
      transportAdapterRef.current = createTransportAdapter({
        widgetId: 'harmony-widget',
        widgetType: 'harmony',
        priority: 30, // Lower priority than drums and metronome
        enableBeatTracking: false, // Harmony doesn't need beat tracking
        onStart: () => {
          console.log('🎵 HarmonyWidget: Transport started');
          setCurrentChord(0);

          // Harmony loop creation will be handled by the main effect
          // to ensure all dependencies are properly available
        },
        onStop: () => {
          console.log('🎵 HarmonyWidget: Transport stopped');
          setCurrentChord(0);

          // Clean up schedule
          if (loopRef.current && loopRef.current.scheduleId) {
            try {
              const tone = getTone();
              if (tone) {
                tone.Transport.clear(loopRef.current.scheduleId);
              }
            } catch (e) {
              console.warn('Error clearing harmony schedule:', e);
            }
            loopRef.current = null;
          }

          // Stop all chord sounds
          if (chordProcessorRef.current) {
            chordProcessorRef.current.stopChord();
          }
        },
        onPause: () => {
          console.log('🎵 HarmonyWidget: Transport paused');
          // Transport.scheduleRepeat pauses automatically with Transport
        },
      });

      // Initialize the adapter
      transportAdapterRef.current.initialize().catch(console.error);
    }

    return () => {
      if (transportAdapterRef.current) {
        transportAdapterRef.current.dispose();
        transportAdapterRef.current = null;
      }
    };
  }, []);

  // Use refs to track previous values and prevent infinite loops
  const prevSelectedExerciseRef = useRef<any>(null);
  const prevProgressionRef = useRef<string[]>(initialProgression);
  const previousChordRef = useRef<number>(-1);
  const exerciseDurationBeatsRef = useRef<number | null>(null);
  const timeSignatureRef = useRef<TimeSignature>({
    numerator: 4,
    denominator: 4,
  });

  // Convert progression to professional harmony changes
  const harmonyChanges = useMemo(() => {
    return convertToHarmonyChanges(progression, 1);
  }, [progression]);

  // Calculate current chord based on musical time
  const currentChordFromTime = useMemo(() => {
    if (!harmonyChanges.length) return 0;

    for (let i = 0; i < harmonyChanges.length; i++) {
      const change = harmonyChanges[i];
      if (!change) continue;
      const changeEndBar = change.measure + change.duration;

      if (currentBar >= change.measure && currentBar < changeEndBar) {
        return i;
      }
    }

    return 0;
  }, [currentBar, harmonyChanges]);

  // Professional chord progression patterns
  const professionalProgressions = useMemo(() => {
    const progs: Record<string, HarmonyChange[]> = {};

    Object.entries(chordProgressions).forEach(([name, pattern]) => {
      let currentBar = 1;
      progs[name] = pattern.map(({ chord, duration }) => {
        const change: HarmonyChange = {
          measure: currentBar,
          chord,
          duration,
        };
        currentBar += duration;
        return change;
      });
    });

    return progs;
  }, []);

  // Listen for exercise timeline events
  useEffect(() => {
    if (
      syncProps.sync?.type === 'WIDGET_TIMELINE_EVENTS' &&
      syncProps.sync?.payload?.widgetType === 'harmony'
    ) {
      const events = syncProps.sync.payload.events;
      if (events && events.length > 0) {
        // Update progression from exercise timeline
        const exerciseProgression = events
          .filter((e: any) => e.data?.chord)
          .map((e: any) => e.data.chord);

        if (exerciseProgression.length > 0) {
          setProgression(exerciseProgression);
          console.log(
            '🎵 HarmonyWidget: Updated progression from exercise timeline:',
            exerciseProgression,
          );
        }
      }
    }
  }, [syncProps.sync]);

  // Watch for exercise changes in sync state
  useEffect(() => {
    const selectedExercise = syncProps.sync.selectedExercise;

    // Only update if the exercise actually changed
    if (
      selectedExercise &&
      selectedExercise !== prevSelectedExerciseRef.current
    ) {
      prevSelectedExerciseRef.current = selectedExercise;

      // Store time signature if available
      if (selectedExercise.timeSignature) {
        timeSignatureRef.current = selectedExercise.timeSignature;
      }

      // Store chord durations and positions if available
      if (selectedExercise.chord_durations) {
        chordDurationsRef.current = selectedExercise.chord_durations;
        console.log(
          '🎵 HarmonyWidget: Exercise chord durations set to',
          selectedExercise.chord_durations,
        );
      } else {
        chordDurationsRef.current = null;
      }

      if (selectedExercise.chord_positions) {
        chordPositionsRef.current = selectedExercise.chord_positions;
        console.log(
          '🎵 HarmonyWidget: Exercise chord positions set to',
          selectedExercise.chord_positions,
        );
      } else {
        chordPositionsRef.current = null;
      }

      // Store exercise duration in beats
      if (selectedExercise.duration_beats) {
        exerciseDurationBeatsRef.current = selectedExercise.duration_beats;
        console.log(
          '🎵 HarmonyWidget: Exercise duration set to',
          selectedExercise.duration_beats,
          'beats',
        );
      } else if (
        selectedExercise.total_bars &&
        selectedExercise.timeSignature
      ) {
        // Fallback: calculate from total_bars if available
        const beatsPerBar = selectedExercise.timeSignature.numerator || 4;
        exerciseDurationBeatsRef.current =
          selectedExercise.total_bars * beatsPerBar;
        console.log(
          '🎵 HarmonyWidget: Calculated duration from total_bars:',
          exerciseDurationBeatsRef.current,
          'beats',
        );
      } else {
        // Default: if no duration info, assume 1 bar per chord
        const beatsPerBar = timeSignatureRef.current.numerator;
        exerciseDurationBeatsRef.current = progression.length * beatsPerBar;
        console.log(
          '🎵 HarmonyWidget: No duration info, assuming 1 bar per chord:',
          exerciseDurationBeatsRef.current,
          'beats',
        );
      }

      if (
        selectedExercise?.chord_progression &&
        Array.isArray(selectedExercise.chord_progression)
      ) {
        const newProgression = selectedExercise.chord_progression;

        // Only update if the progression is actually different
        if (
          JSON.stringify(newProgression) !==
          JSON.stringify(prevProgressionRef.current)
        ) {
          setProgression(newProgression);
          setCurrentChord(0); // Reset to first chord
          prevProgressionRef.current = newProgression;

          // Only call onProgressionChange if it's different from current progression
          if (JSON.stringify(newProgression) !== JSON.stringify(progression)) {
            onProgressionChange?.(newProgression);
          }
        }
      }
    } else if (!selectedExercise && prevSelectedExerciseRef.current) {
      // No exercise selected, clear the duration and chord timing data
      exerciseDurationBeatsRef.current = null;
      chordDurationsRef.current = null;
      chordPositionsRef.current = null;
      prevSelectedExerciseRef.current = null;
      console.log('🎵 HarmonyWidget: No exercise selected, cleared all timing data');
    }
  }, [syncProps.sync.selectedExercise]); // Removed onProgressionChange from dependencies

  // Update local state when props change (for backward compatibility)
  useEffect(() => {
    if (
      JSON.stringify(initialProgression) !==
      JSON.stringify(prevProgressionRef.current)
    ) {
      setProgression(initialProgression);
      prevProgressionRef.current = initialProgression;
    }
  }, [initialProgression]);

  useEffect(() => {
    setCurrentChord(initialCurrentChord);
  }, [initialCurrentChord]);

  // Enhanced progression change that emits sync events
  const handleSyncProgressionChange = useCallback(
    (newProgression: string[]) => {
      setProgression(newProgression);
      setCurrentChord(0);
      onProgressionChange?.(newProgression);

      // Emit sync event for other widgets
      syncProps.sync.actions.emitEvent(
        'CUSTOM_BASSLINE',
        {
          chordProgression: newProgression,
          currentChord: 0,
          source: 'harmony-widget',
          reason: 'progression-change',
        },
        'normal',
      );
    },
    [onProgressionChange, syncProps.sync.actions],
  );

  const currentProgressionName =
    Object.keys(chordProgressions).find(
      (key) =>
        JSON.stringify(
          chordProgressions[key as keyof typeof chordProgressions],
        ) === JSON.stringify(progression),
    ) || 'Custom';

  // Professional chord triggering using fixed ChordInstrumentProcessor
  const triggerChordSound = useCallback(
    (chordSymbol: string, chordIndex: number) => {
      if (!chordProcessorRef.current) return;

      try {
        // Restore and set volume before playing
        const actualVolume = (volume / 100) * 0.6; // Good volume for harmony
        chordProcessorRef.current.setVolume(actualVolume);

        // NOTE: Do NOT call stopChord() here - it triggers PANIC behavior
        // The ChordInstrumentProcessor handles note duration automatically

        // Calculate chord duration based on chord_durations if available
        let beatsForChord = 4; // Default to 4 beats
        if (chordDurationsRef.current && chordDurationsRef.current[chordIndex] !== undefined) {
          beatsForChord = chordDurationsRef.current[chordIndex];
        }

        // Use the professional chord processor to play the chord
        const chordDuration = (60000 / syncTempo) * beatsForChord;
        chordProcessorRef.current.playChord(chordSymbol, {
          duration: chordDuration,
          velocity: 0.7,
        });
      } catch (error) {
        console.warn('Professional chord playback error:', error);
      }
    },
    [volume, syncTempo],
  );

  // REMOVED: Complex Tone.js Loop logic - now handled by pattern scheduler
  /*
  // Harmony timing using Tone.js Loop synchronized with global Transport
  useEffect(() => {
    // Clean up existing schedule
    if (loopRef.current && loopRef.current.scheduleId) {
      const tone = getTone();
      if (tone) {
        tone.Transport.clear(loopRef.current.scheduleId);
      }
      loopRef.current = null;
    }

    if (!syncIsPlaying || !progression.length) {
      // When playback stops, immediately stop all chord sounds
      if (!syncIsPlaying && chordProcessorRef.current) {
        console.log(
          '🎵 HarmonyWidget: Playback stopped, stopping all chord sounds',
        );
        chordProcessorRef.current.stopChord();
      }
      setCurrentChord(0);
      return;
    }
    
    // Log if we're starting before initialization completes
    if (syncIsPlaying && !isInitialized) {
      console.log(
        '🎵 HarmonyWidget: Starting playback while processor initializes...',
      );
    }

    // Use a flag to prevent multiple loop creation attempts
    let isCreatingLoop = false;

    const startHarmonySequence = async () => {
      // Ensure we don't create multiple loops
      if (loopRef.current || isCreatingLoop) {
        console.log(
          '🎵 HarmonyWidget: Loop already exists or being created, skipping',
        );
        return;
      }

      isCreatingLoop = true;

      try {
        // CRITICAL: Pre-activate AudioContext with user gesture before starting sequence
        if (chordProcessorRef.current) {
          await chordProcessorRef.current.preActivateAudioContext();
        }

        // Check AudioContext state but don't start it - CorePlaybackEngine handles that
        if (Tone && audioReady && Tone.context.state !== 'running') {
          if (debugMode)
            console.log(
              '🎵 Harmony: AudioContext not running yet - CorePlaybackEngine will start it',
            );
        }

        if (debugMode)
          console.log(
            '🎵 Starting harmony sequence with Tone.Transport for progression:',
            progression,
          );

        // Set Transport BPM to match global tempo
        if (Transport) {
          Transport.bpm.value = syncTempo;
        }

        // Clean up any existing loop
        if (loopRef.current) {
          loopRef.current.dispose();
          loopRef.current = null;
        }

        const isReady = localAudioReady || audioReady;
        if (!Tone || !isReady) {
          console.warn('🎵 Tone.js not ready, cannot create harmony loop');
          return;
        }

        // Track loop iteration and chord timing
        let loopStartTime: number | null = null;
        let loopIteration = 0;
        let currentChordIndex = 0;
        let beatsElapsed = 0;
        let nextChordChangeBeat = 0;
        let hasPlayedFirstChord = false;

        // Calculate total duration in beats for the entire progression
        const calculateTotalBeats = () => {
          if (chordDurationsRef.current && chordDurationsRef.current.length > 0) {
            return chordDurationsRef.current.reduce((sum, dur) => sum + dur, 0);
          }
          return progression.length * 4; // Default: 4 beats per chord
        };

        // Get duration for a specific chord
        const getChordDuration = (index: number) => {
          if (chordDurationsRef.current && chordDurationsRef.current[index] !== undefined) {
            return chordDurationsRef.current[index];
          }
          return 4; // Default to 4 beats
        };

        // Calculate when the next chord change should happen
        const updateNextChordChangeBeat = () => {
          nextChordChangeBeat = beatsElapsed + getChordDuration(currentChordIndex);
        };

        // Set initial next chord change beat based on first chord duration
        nextChordChangeBeat = getChordDuration(0);

        if (debugMode) {
          console.log('🎵 Harmony Transport setup:', {
            syncTempo,
            transportBPM: Tone?.Transport?.bpm?.value || syncTempo,
            progression: progression.slice(0, 3),
            chordDurations: chordDurationsRef.current,
            totalBeats: calculateTotalBeats(),
          });
        }

        // Create Tone.js Loop that runs every beat (quarter note)
        const interval = '4n'; // Run every quarter note (beat)

        // CRITICAL FIX: Use fresh Tone reference to create the loop
        const currentTone = getTone();
        if (!currentTone) {
          console.error('🎵 HarmonyWidget: Cannot create loop - Tone not available');
          return;
        }
        
        console.log('🎵 HarmonyWidget: Creating loop with Tone instance:', {
          hasTone: !!currentTone,
          hasLoop: !!currentTone.Loop,
          toneType: typeof currentTone,
          contextState: currentTone.context?.state
        });
        
        // CRITICAL FIX: If Transport is not started, wait for it to start
        if (currentTone.Transport.state !== 'started') {
          console.log('🎵 HarmonyWidget: Transport not started yet, waiting...');
          setTimeout(() => {
            if (currentTone.Transport.state === 'started' && !loopRef.current) {
              console.log('🎵 HarmonyWidget: Transport now started, creating harmony loop');
              startHarmonySequence();
            }
          }, 200);
          return;
        }
        
        // CRITICAL FIX: Align harmony to start at the beginning of the next measure
        // This ensures chords start on beat 1, not beat 2
        // Always start at position 0:0:0 to align with the beginning of the exercise
        const startTime = '0:0:0';
        
        console.log('🎵 HarmonyWidget: Aligning schedule to start of exercise', {
          transportPosition: currentTone.Transport.position,
          startTime
        });
        
        // Try using Transport.scheduleRepeat instead of Loop
        // CRITICAL: Pass startTime as third parameter to align with bar boundaries
        const scheduleId = currentTone.Transport.scheduleRepeat((time) => {
          console.log('🎵🎹 HARMONY TRANSPORT SCHEDULE EXECUTED!', {
            time,
            loopIteration: loopIteration++,
            transportState: getTone()?.Transport?.state
          });
          // CRITICAL FIX: Always get fresh Tone reference from getTone()
          // The closure-captured Tone might be stale
          const currentTone = getTone();
          const actualTransport = currentTone?.Transport;
          const transportState = actualTransport?.state || 'stopped';
          
          // CRITICAL LOGGING: Track which Transport we're accessing
          const transportDebug = {
            providerTransportState: Transport?.state,
            providerTransportId: Transport ? (Transport as any)._id || 'no-id' : 'no-transport',
            actualTransportState: actualTransport?.state,
            actualTransportId: actualTransport ? (actualTransport as any)._id || 'no-id' : 'no-transport',
            areTheSame: Transport === actualTransport,
            transportSeconds: Transport?.seconds,
            actualTransportSeconds: actualTransport?.seconds,
          };
          
          // Log once per bar to avoid spam
          if (beatsElapsed === 0) {
            console.log('🎵🔍 HarmonyWidget Loop: Transport Instance Debug', transportDebug);
          }
          
          // CRITICAL FIX: Check the actual current Tone.Transport state
          const isTransportStarted = transportState === 'started';
          const shouldPlay = loopRef.current && (isTransportStarted || syncIsPlaying);
          
          if (!shouldPlay) {
            console.log(`🔴 HarmonyWidget Loop: Skipping - loopRef: ${!!loopRef.current}, syncIsPlaying: ${syncIsPlaying}, Transport.state: ${transportState}, shouldPlay: ${shouldPlay}`, transportDebug);
            return;
          }

          // Track when the loop actually starts
          if (loopStartTime === null) {
            loopStartTime = time;
            console.log(`🎵 HarmonyWidget: Loop started at time ${time.toFixed(3)}`);
          }

          // Play the first chord immediately on beat 0
          if (!hasPlayedFirstChord && beatsElapsed === 0) {
            hasPlayedFirstChord = true;
            const firstChord = progression[0];
            
            console.log(
              `🎵 Harmony: Playing FIRST chord at beat 0 (${firstChord}), next change at beat ${nextChordChangeBeat}`,
            );

            console.log('🎵🎹 First chord check:', {
              firstChord,
              isMuted,
              volume,
              hasProcessor: !!chordProcessorRef.current,
              isInitialized,
              processorType: chordProcessorRef.current?.constructor?.name
            });
            
            if (firstChord && !isMuted && volume > 0 && chordProcessorRef.current) {
              try {
                const actualVolume = (volume / 100) * 0.6;
                chordProcessorRef.current.setVolume(actualVolume);
                // NOTE: Do NOT call stopChord() here - only call it on actual STOP event
                
                const chordDuration = (60000 / syncTempo) * getChordDuration(0);
                
                // CRITICAL FIX: Get fresh Tone reference to check current state
                const currentTone = getTone();
                const currentTransportState = currentTone?.Transport?.state || 'stopped';
                
                if (currentTransportState === 'started') {
                  // CRITICAL FIX: For the first chord at position 0:0:0, always use the loop callback time
                  // This ensures the chord plays exactly when the loop fires at beat 0
                  console.log(`🎵🎹 ATTEMPTING TO PLAY FIRST CHORD: ${firstChord} at loop time ${time}, Transport.state: ${currentTransportState}, hasProcessor: ${!!chordProcessorRef.current}`);
                  
                  // Check if processor is loaded
                  const isLoaded = chordProcessorRef.current.isLoaded?.() ?? true;
                  console.log(`🎵🎹 Processor loaded state: ${isLoaded}`);
                  
                  try {
                    chordProcessorRef.current.playChord(firstChord, {
                      duration: chordDuration,
                      velocity: 0.7,
                      time: time, // Use the loop callback time for tight synchronization
                    });
                    console.log(`🎵🎹 SUCCESS: playChord called for ${firstChord}`);
                  } catch (playError) {
                    console.error(`🎵🎹 ERROR playing first chord ${firstChord}:`, playError);
                  }
                  
                  if (debugMode)
                    console.log(
                      `🎵 Harmony playing FIRST chord "${firstChord}" at synchronized start time, duration: ${chordDuration}ms`,
                    );
                } else {
                  console.log(`🎵 Harmony: Skipping first chord - Transport not started (state: ${currentTransportState})`);
                }
              } catch (error) {
                console.warn('Failed to play first chord:', error);
                triggerChordSound(firstChord, 0);
              }
            } else if (firstChord && !isInitialized) {
              // Skipping first chord - processor not initialized yet
            }
            
            setCurrentChord(0);
          }
          // Check if it's time to change to the next chord
          // CRITICAL FIX: Check for chord changes after the first beat has been played
          else if (beatsElapsed > 0 && beatsElapsed >= nextChordChangeBeat) {
            // Move to next chord
            currentChordIndex = (currentChordIndex + 1) % progression.length;
            
            // If we wrapped around, reset beat counter
            if (currentChordIndex === 0) {
              beatsElapsed = 0;
              nextChordChangeBeat = getChordDuration(0);
              hasPlayedFirstChord = false; // Reset for next loop
            } else {
              updateNextChordChangeBeat();
            }

            const chord = progression[currentChordIndex];

            // Log chord changes
            console.log(
              `🎵 Harmony: Changing to chord ${currentChordIndex} (${chord}) at beat ${beatsElapsed}, next change at beat ${nextChordChangeBeat}`,
            );

            if (debugMode) {
              console.log('🎵 Harmony Transport tick:', {
                chord,
                chordIndex: currentChordIndex,
                beatsElapsed,
                nextChordChangeBeat,
                time,
                transportPosition: (() => {
                  if (!actualTransport) return '0:0:0';
                  // CRITICAL FIX: Use heartbeat position if main position is stale
                  const mainPosition = actualTransport.position.toString();
                  if (mainPosition === '0:0:0' && (actualTransport as any)._lastHeartbeatPosition) {
                    return (actualTransport as any)._lastHeartbeatPosition;
                  }
                  return mainPosition;
                })(),
                muted: isMuted,
                volume,
              });
            }

            if (chord && !isMuted && volume > 0 && chordProcessorRef.current) {
              try {
                // Ensure volume is restored (in case it was muted during stop)
                const actualVolume = (volume / 100) * 0.6;
                chordProcessorRef.current.setVolume(actualVolume);

                // NOTE: Do NOT call stopChord() here during normal chord progression
                // The ChordInstrumentProcessor handles note duration automatically
                // Calling stopChord() triggers PANIC behavior which causes stuttering

                // Calculate duration for this specific chord
                const chordDuration = (60000 / syncTempo) * getChordDuration(currentChordIndex);

                // CRITICAL FIX: Check current transport state, not stale syncIsPlaying
                const freshTone = getTone();
                const isTransportRunning = freshTone?.Transport?.state === 'started';
                
                if (isTransportRunning) {
                  console.log(`🎵🎹 ATTEMPTING TO PLAY CHORD: ${chord} at time ${time}, Transport.state: ${freshTone?.Transport?.state}, beatsElapsed: ${beatsElapsed}, hasProcessor: ${!!chordProcessorRef.current}`);
                  
                  // Check if processor is loaded
                  const isLoaded = chordProcessorRef.current.isLoaded?.() ?? true;
                  console.log(`🎵🎹 Processor loaded state: ${isLoaded}`);
                  
                  // Pass the loop callback time for proper Transport synchronization
                  try {
                    chordProcessorRef.current.playChord(chord, {
                      duration: chordDuration,
                      velocity: 0.7,
                      time: time, // Use the Transport time for sync
                    });
                    console.log(`🎵🎹 SUCCESS: playChord called for ${chord}`);
                  } catch (playError) {
                    console.error(`🎵🎹 ERROR playing chord ${chord}:`, playError);
                  }

                  if (debugMode)
                    console.log(
                      `🎵 Harmony playing chord "${chord}" immediately, duration: ${chordDuration}ms`,
                    );
                }
              } catch (error) {
                console.warn(
                  'ChordProcessor.playChord failed in transport loop:',
                  error,
                );
                triggerChordSound(chord, currentChordIndex);
              }
            } else if (chord && !isInitialized) {
              // Skipping chord - processor not initialized yet
            }

            // Update visual state
            setCurrentChord(currentChordIndex);
          }

          // Increment beat counter
          beatsElapsed++;

          // Wrap beat counter if we've gone through the entire progression
          const totalBeats = calculateTotalBeats();
          if (beatsElapsed >= totalBeats) {
            beatsElapsed = 0;
            currentChordIndex = 0;
            nextChordChangeBeat = getChordDuration(0);
            hasPlayedFirstChord = false; // Reset so first chord plays again on loop
          }
        }, interval, startTime); // CRITICAL: Pass startTime to align with bar boundaries
        
        // Store the schedule ID for cleanup
        loopRef.current = { scheduleId };
        
        console.log('🎵 HarmonyWidget: Transport schedule created', {
          hasSchedule: !!scheduleId,
          scheduleId,
          interval
        });

        // Transport.scheduleRepeat starts automatically when Transport starts
        console.log('🎵 HarmonyWidget: Schedule will start when Transport starts');
        
        // Test with a simpler approach
        setTimeout(() => {
          console.log('🎵 HarmonyWidget: Testing direct Transport schedule...');
          const testId = currentTone.Transport.scheduleRepeat((time) => {
            console.log('🎵 TEST SCHEDULE WORKS!', time);
          }, '1n');
          
          // Clean up after 3 seconds
          setTimeout(() => {
            currentTone.Transport.clear(testId);
            console.log('🎵 Test schedule cleaned up');
          }, 3000);
        }, 500);

        // Don't start transport here - let CorePlaybackEngine handle it
        if (debugMode) {
          console.log(
            '🎵 Harmony loop created, transport state:',
            Transport?.state || 'unknown',
          );
        }
      } catch (error) {
        console.warn('Failed to start harmony sequence:', error);
      } finally {
        isCreatingLoop = false;
      }
    };

    // Start harmony sequence immediately
    startHarmonySequence();

    return () => {
      // Clean up Transport schedule
      if (loopRef.current && loopRef.current.scheduleId) {
        try {
          const tone = getTone();
          if (tone) {
            tone.Transport.clear(loopRef.current.scheduleId);
            console.log('🎵 HarmonyWidget: Cleared transport schedule');
          }
        } catch (e) {
          console.warn('Error clearing harmony schedule:', e);
        }
        loopRef.current = null;
      }

      // Stop all chord notes when playback stops
      if (chordProcessorRef.current) {
        try {
          console.log('🎵 HarmonyWidget cleanup: Executing MIDI panic for immediate silence...');
          // Use midiPanic for most aggressive stopping
          if (typeof chordProcessorRef.current.midiPanic === 'function') {
            chordProcessorRef.current.midiPanic();
          } else if (typeof chordProcessorRef.current.panic === 'function') {
            chordProcessorRef.current.panic();
          } else {
            chordProcessorRef.current.stopChord();
          }
        } catch (error) {
          console.warn('Failed to stop chord notes:', error);
        }
      }

      // Don't cancel all transport events - other widgets might be using them
      console.log('🎵 HarmonyWidget cleanup: Complete');
    };
  }, [
    syncIsPlaying,
    progression,
    syncTempo,
    isMuted,
    volume,
    triggerChordSound,
    debugMode,
    isInitialized,
    Tone,
    audioReady,
    localAudioReady, // Also trigger when localAudioReady changes
    Transport,
  ]);
  */
  
  // Simple visual update based on playback state
  useEffect(() => {
    
    if (syncIsPlaying && progression.length > 0) {
      console.log('🎵 HarmonyWidget: Transport started - pattern will play');
      
      // Simple visual update based on tempo and chord durations
      let currentChordIndex = 0;
      let beatsElapsed = 0;
      const beatDuration = 60000 / syncTempo; // ms per beat
      
      const visualInterval = setInterval(() => {
        // Calculate which chord should be active based on beats elapsed
        if (chordDurationsRef.current) {
          let totalBeats = 0;
          for (let i = 0; i < chordDurationsRef.current.length; i++) {
            totalBeats += chordDurationsRef.current[i];
            if (beatsElapsed < totalBeats) {
              currentChordIndex = i;
              break;
            }
          }
          // Wrap around if we've completed the progression
          if (beatsElapsed >= totalBeats) {
            beatsElapsed = 0;
            currentChordIndex = 0;
          }
        } else {
          // Default: 4 beats per chord
          currentChordIndex = Math.floor(beatsElapsed / 4) % progression.length;
        }
        
        setCurrentChord(currentChordIndex);
        beatsElapsed++;
      }, beatDuration);
      
      return () => clearInterval(visualInterval);
    } else {
      console.log('⏹️ HarmonyWidget: Transport stopped');
      // Reset visual
      setCurrentChord(0);
    }
  }, [syncIsPlaying, widgetInstanceId, syncTempo, progression.length]);
  
  // Cleanup on unmount and singleton management
  useEffect(() => {
    // Listen for singleton cleanup events
    const handleSingletonCleanup = (event: CustomEvent) => {
      const { type, activeId } = event.detail;
      if (type === 'harmony' && activeId !== widgetInstanceId) {
        console.log(`🚫 HarmonyWidget[${widgetInstanceId}]: Deactivating inactive instance (active: ${activeId})`);
        setIsActiveWidget(false);
      }
    };
    
    window.addEventListener('widget-singleton-cleanup', handleSingletonCleanup as EventListener);
    
    return () => {
      window.removeEventListener('widget-singleton-cleanup', handleSingletonCleanup as EventListener);
      if (chordProcessorRef.current) {
        chordProcessorRef.current.dispose();
      }
    };
  }, [widgetInstanceId]);

  const handleProgressionDropdownChange = (progressionName: string) => {
    if (progressionName in professionalProgressions) {
      const harmonyPattern = professionalProgressions[progressionName];
      if (!harmonyPattern) return;
      const newProgression = harmonyPattern.map((change) => change.chord);
      handleSyncProgressionChange(newProgression);
    }
  };

  // Story 3.16: Professional keyboard instrument selection handlers
  const handleInstrumentSelect = async (instrumentId: string) => {
    const instrument = availableInstruments.find(
      (instr) => instr.id === instrumentId,
    );
    if (!instrument) return;

    setIsLoadingInstrument(true);
    try {
      // Update the preset to match the selected professional instrument
      setSelectedPreset(instrument.preset);

      // Update the chord processor with the new preset
      if (chordProcessorRef.current) {
        await chordProcessorRef.current.setPreset(instrument.preset);
        console.log(
          `🎹 Switched to professional instrument: ${instrument.name}`,
        );
      }

      // TODO: Load actual professional soundfont when implemented
      console.log(
        `🎹 Selected professional keyboard instrument: ${instrument.name} (${instrument.category})`,
      );
    } catch (error) {
      console.error(
        'Failed to switch professional keyboard instrument:',
        error,
      );
    } finally {
      setIsLoadingInstrument(false);
    }
  };

  const handleInstrumentPreview = (instrumentId: string) => {
    const instrument = availableInstruments.find(
      (instr) => instr.id === instrumentId,
    );
    if (!instrument || !chordProcessorRef.current) return;

    try {
      // Play a brief chord to preview the instrument sound
      const previewChord = 'CMaj7'; // Nice chord for previewing
      chordProcessorRef.current.playChord(previewChord, {
        duration: 1000, // 1 second preview
        velocity: 0.7,
      });
      console.log(`🎹 Previewing ${instrument.name} with ${previewChord}`);
    } catch (error) {
      console.error('Failed to preview instrument:', error);
    }
  };

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
            onChange={(val) => {
              setVolume(val);
              if (val > 0) {
                setIsMuted(false);
              }
              // Update audio engine volume
              if (audioControls) {
                audioControls.setVolume(val / 100);
              }
              // Update chord processor volume
              if (chordProcessorRef.current) {
                chordProcessorRef.current.setVolume((val / 100) * 0.6);
              }
            }}
            color="bg-blue-400"
            size={45}
            isMuted={isMuted}
            onMuteToggle={() => {
              const newMuted = !isMuted;
              setIsMuted(newMuted);
              // Update audio engine mute
              if (audioControls) {
                audioControls.setMute(newMuted);
              }
            }}
          />
        </div>

        {/* Title/Subtitle OR Settings Panel */}
        <div className="flex-1">
          <div className="flex items-center justify-between px-4 py-2">
            {!isExpanded ? (
              <>
                {/* Title and Subtitle */}
                <div className="flex-1">
                  <h3
                    className={`font-semibold text-sm transition-all duration-300 ${
                      volume === 0 ? 'text-slate-600' : 'text-white'
                    }`}
                  >
                    Harmony
                  </h3>
                  <p
                    className={`text-xs transition-all duration-300 ${
                      volume === 0 ? 'text-slate-600' : 'text-slate-400'
                    }`}
                  >
                    {progression[currentChord]} •{' '}
                    {currentProgressionName.length > 8
                      ? currentProgressionName.substring(0, 8) + '...'
                      : currentProgressionName}
                  </p>
                </div>

                {/* Clickable Indicator */}
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 shadow-[5px_5px_10px_rgba(0,0,0,0.5),-5px_-5px_10px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300 cursor-pointer ${
                    volume === 0 ? 'opacity-50' : ''
                  }`}
                >
                  {/* Simple chord symbols */}
                  <div className="flex gap-2 text-sm font-mono">
                    {progression.map((chord, idx) => (
                      <span
                        key={idx}
                        className={`transition-all duration-200 ${
                          idx === currentChord
                            ? 'text-blue-400 font-bold'
                            : 'text-slate-500'
                        }`}
                      >
                        {chord || '—'}
                      </span>
                    ))}
                  </div>
                </button>
              </>
            ) : (
              <>
                {/* Settings content - professional keyboard selector and chord slots */}
                <div className="flex items-center gap-3 flex-1 justify-center">
                  {/* Professional Keyboard Selector - Simple Dropdown */}
                  <div className="flex flex-col items-center gap-1">
                    <label className="text-xs text-slate-400">Instrument</label>
                    <select
                      value={selectedPreset}
                      onChange={async (e) => {
                        const newPreset = e.target.value as ChordPreset;
                        setSelectedPreset(newPreset);

                        // Find the instrument for this preset
                        const instrument = availableInstruments.find(
                          (instr) => instr.preset === newPreset,
                        );
                        if (instrument) {
                          await handleInstrumentSelect(instrument.id);
                        }
                      }}
                      className="bg-slate-700 text-white text-xs rounded px-3 py-1 border border-slate-600 hover:bg-slate-600 transition-colors"
                    >
                      <option value={ChordPreset.PIANO}>
                        🎹 Salamander Piano
                      </option>
                      <option value={ChordPreset.WURLITZER}>
                        ⚡ Wurlitzer Electric
                      </option>
                      <option value={ChordPreset.RHODES_VELOCITY}>
                        🎸 Rhodes Electric
                      </option>
                      <option value={ChordPreset.LONG_PAD}>🌊 Long Pad</option>
                      <option value={ChordPreset.THE_SAW}>
                        🎛️ The Saw Synth
                      </option>
                      <option value={ChordPreset.RHODES}>
                        🎵 Rhodes (Synthesis)
                      </option>
                      <option value={ChordPreset.ORGAN}>
                        🎹 Organ (Synthesis)
                      </option>
                      <option value={ChordPreset.PAD}>
                        🎛️ Pad (Synthesis)
                      </option>
                    </select>
                  </div>

                  {/* Divider */}
                  <div className="w-px h-8 bg-slate-600"></div>

                  {/* Add button - left side */}
                  {canAddLeft && progression.length < 6 && (
                    <button
                      onClick={() => {
                        const newProgression = ['', ...progression];
                        handleSyncProgressionChange(newProgression);
                        setCurrentChord(0);
                      }}
                      className="w-6 h-6 rounded-full bg-slate-800 text-blue-400 text-xs font-bold shadow-[2px_2px_4px_rgba(0,0,0,0.5),-2px_-2px_4px_rgba(255,255,255,0.1)] hover:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] transition-all duration-200 flex items-center justify-center"
                      title="Add chord at beginning"
                    >
                      +
                    </button>
                  )}

                  {/* Chord Input Slots */}
                  <div className="flex gap-2">
                    {progression.map((chord, slotIndex) => (
                      <div
                        key={slotIndex}
                        className="flex flex-col items-center gap-1"
                      >
                        <ChordSlotSelector
                          value={chord || ''}
                          onChange={(newChord) => {
                            const newProgression = [...progression];
                            newProgression[slotIndex] = newChord;
                            handleSyncProgressionChange(newProgression);
                          }}
                          onFocus={() => setCurrentChord(slotIndex)}
                          isActive={slotIndex === currentChord}
                        />
                        <div className="flex items-center gap-1">
                          <div
                            className={`w-2 h-2 rounded-full transition-all duration-200 ${
                              slotIndex === currentChord && syncIsPlaying
                                ? 'bg-blue-400 shadow-lg shadow-blue-400/50'
                                : 'bg-slate-700'
                            }`}
                          />
                          {(chordDurationsRef.current && chordDurationsRef.current[slotIndex] !== undefined) ? (
                            <span className="text-xs text-slate-400">
                              {chordDurationsRef.current[slotIndex]}b
                            </span>
                          ) : harmonyChanges[slotIndex] ? (
                            <span className="text-xs text-slate-400">
                              {harmonyChanges[slotIndex].duration}b
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add button - right side */}
                  {canAddRight && progression.length < 6 && (
                    <button
                      onClick={() => {
                        const newProgression = [...progression, ''];
                        handleSyncProgressionChange(newProgression);
                        setCurrentChord(progression.length);
                      }}
                      className="w-6 h-6 rounded-full bg-slate-800 text-blue-400 text-xs font-bold shadow-[2px_2px_4px_rgba(0,0,0,0.5),-2px_-2px_4px_rgba(255,255,255,0.1)] hover:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] transition-all duration-200 flex items-center justify-center"
                      title="Add chord at end"
                    >
                      +
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setIsExpanded(false)}
                  className="w-5 h-5 rounded-md bg-slate-800 shadow-[2px_2px_4px_rgba(0,0,0,0.5),-2px_-2px_4px_rgba(255,255,255,0.1)] hover:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] transition-all duration-200 text-slate-400 text-xs flex items-center justify-center ml-4"
                  title="Close settings"
                >
                  ×
                </button>

                {/* Story 3.16: Professional Keyboard Selector */}
                {showKeyboardSelector && (
                  <div className="mt-4 p-4 bg-slate-900 rounded-lg border border-slate-700">
                    <ProfessionalKeyboardSelector
                      availableInstruments={availableInstruments}
                      currentInstrument={
                        availableInstruments.find(
                          (instr) => instr.preset === selectedPreset,
                        ) || null
                      }
                      isLoading={isLoadingInstrument}
                      onInstrumentSelect={(instrument) =>
                        handleInstrumentSelect(instrument.id)
                      }
                      onInstrumentPreview={(instrument) =>
                        handleInstrumentPreview(instrument.id)
                      }
                      className="max-h-64 overflow-y-auto"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
