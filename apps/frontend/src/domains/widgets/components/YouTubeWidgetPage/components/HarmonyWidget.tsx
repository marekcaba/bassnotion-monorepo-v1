'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { VolumeKnob } from './VolumeKnob';
import { ChordSlotSelector } from './ChordSlotSelector';
import { ProfessionalKeyboardSelector } from './ProfessionalKeyboardSelector';
import { useTrack } from '@/domains/playback/hooks/useTrack';
import { ensureAudioContext, withAudioContext } from '@/domains/playback/utils/ensureAudioContext';
import { getPersistentAudioContext } from '@/domains/playback/utils/audioContext';
import type { MusicalPosition } from '@bassnotion/contracts/types/musical-time';
import { wamPluginSingleton } from '@/domains/widgets/utils/wamPluginSingleton';
import { GlobalSampleCache } from '@/domains/playback/services/storage/GlobalSampleCache';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
// Dynamic import to avoid SSR issues
const KeyboardInstrument = {
  SALAMANDER_PIANO: 'salamander',
  FENDER_RHODES: 'rhodes',
  WURLITZER: 'wurlitzer'
} as const;

type KeyboardInstrumentType = typeof KeyboardInstrument[keyof typeof KeyboardInstrument];

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

export function HarmonyWidget({
  progression = ['CMaj7', 'Am7', 'Dm7', 'G7'], // Default progression
  currentChord = 0,
  isPlaying,
  isVisible,
  onNextChord = () => {}, // Default no-op
  onProgressionChange,
  onToggleVisibility,
  onTogglePlay,
  tempo = 120,
}: HarmonyWidgetProps) {
  const { correlationId, logger } = useCorrelation('HarmonyWidget');
  const [volume, setVolume] = useState(80);
  const [selectedProgression, setSelectedProgression] = useState('Jazz Standard');
  const [currentInstrument, setCurrentInstrument] = useState<KeyboardInstrumentType>(KeyboardInstrument.SALAMANDER_PIANO);
  const [isMuted, setIsMuted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [localCurrentChord, setLocalCurrentChord] = useState(currentChord);
  
  // Create a track for harmony
  const track = useTrack({
    trackId: 'harmony-widget-track',
    name: 'Harmony',
    type: 'harmony',
    debugMode: true
  });
  
  // Track the plugin attached to our track
  const trackPluginRef = useRef<any>(null);
  
  // Log track state changes
  useEffect(() => {
    logger.info('🎹 HarmonyWidget: Track state changed:', {
      isReady: track.isReady,
      trackId: track.track?.id,
      trackState: track.track?.state
    });
  }, [track.isReady]);
  
  // We don't need useWAMPlugin since we're loading manually
  // Just track if the plugin has been loaded
  const [wamPluginLoaded, setWamPluginLoaded] = useState(false);
  const [pluginClassLoaded, setPluginClassLoaded] = useState(false);
  const [audioServicesReady, setAudioServicesReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  // Reference to the actual plugin instance
  const keyboardPluginRef = useRef<any>(null);
  const lastScheduledTimeRef = useRef<number>(0);
  const currentPatternRef = useRef<any[]>([]);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isCreatingPluginRef = useRef<boolean>(false);
  
  // Log initial component state
  useEffect(() => {
    logger.info('🎹 HarmonyWidget: Component mounted with initial state:', {
      audioServicesReady,
      wamPluginLoaded,
      pluginClassLoaded,
      trackIsReady: track.isReady
    });
  }, []);
  
  // Phase 1: Check for pre-loaded instrument first, then load plugin class
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (pluginClassLoaded) return;
    
    const checkPreloadedAndLoadClass = async () => {
      logger.info('🎹 HarmonyWidget: Checking for pre-loaded instrument...');
      
      // Check if there's a pre-loaded harmony instrument
      const preloadedHarmony = GlobalSampleCache.getCachedInstrument('harmony-preloaded');
      if (preloadedHarmony) {
        logger.info('🎹 Found pre-loaded harmony instrument!', {
          hasAudioNode: !!preloadedHarmony.audioNode,
          audioNodeType: preloadedHarmony.audioNode?.constructor?.name,
          isConnected: preloadedHarmony.audioNode?.isConnected
        });
      } else {
        logger.info('❌ NO pre-loaded harmony instrument found!');
        // Check cache stats
        const stats = GlobalSampleCache.getStats();
        logger.info('🎹 GlobalSampleCache stats:', stats);
        const instrumentNames = GlobalSampleCache.getCachedInstrumentNames();
        logger.info('🎹 Cached instrument names:', instrumentNames);
      }
      
      // The singleton will handle checking for pre-loaded instruments
      // We just need to mark that we're ready to create the plugin
      setPluginClassLoaded(true);
      logger.info('✅ Ready to use WAM plugin singleton');
    };
    
    checkPreloadedAndLoadClass();
  }, [pluginClassLoaded, wamPluginLoaded, isMuted, volume]);
  
  // Extract audio node creation to a separate function so we can call it from retry
  const createAudioNodeAttempt = useCallback(async () => {
    // Prevent multiple simultaneous creation attempts
    if (isCreatingPluginRef.current || keyboardPluginRef.current || wamPluginLoaded) {
      logger.info('🎹 HarmonyWidget: Plugin creation already in progress or completed, skipping...');
      return;
    }
    
    logger.info('🎹 HarmonyWidget: Attempting to create audio node...', {
      trackIsReady: track.isReady,
      wamPluginLoaded,
      pluginClassLoaded
    });
    
    // Mark that we're creating a plugin
    isCreatingPluginRef.current = true;
    
    // Get audio context - prioritize persistent context
    let context = getPersistentAudioContext();
    
    // If no persistent context, try to get from global audio services
    if (!context) {
      const globalServices = (window as any).__globalCoreServices || (window as any).__coreServices;
      if (globalServices && globalServices.getAudioEngine) {
        const audioEngine = globalServices.getAudioEngine();
        if (audioEngine && audioEngine.getContext) {
          try {
            context = audioEngine.getContext();
          } catch (e) {
            logger.info('🎹 HarmonyWidget: AudioEngine not ready yet, will retry...');
            isCreatingPluginRef.current = false;
            return; // Context not ready yet, will retry
          }
        } else {
          const Tone = audioEngine.getTone();
          if (Tone && Tone.context) {
            // Tone.context might be a wrapper, try to get the raw AudioContext
            context = Tone.context.rawContext || Tone.context._context || Tone.context;
          }
        }
      }
    }
    
    // Check if context needs to be resumed
    if (context && context.state === 'suspended') {
      logger.info('🎹 HarmonyWidget: Audio context is suspended, resuming...');
      await context.resume();
      logger.info('🎹 HarmonyWidget: Audio context resumed successfully');
    }
    
    logger.info('🎹 HarmonyWidget: Got context:', context, {
      type: context?.constructor?.name,
      isAudioContext: context instanceof AudioContext,
      contextState: context?.state
    });
    
    if (context && context instanceof AudioContext) {
      // Check if context is running or needs to be resumed
      if (context.state === 'suspended') {
        logger.info('🎹 HarmonyWidget: AudioContext is suspended, waiting for user gesture...');
        // Don't create the audio node yet, wait for audioContextStarted event
        isCreatingPluginRef.current = false;
        return;
      }
      
      try {
        // Use singleton to get or create plugin instance
        const plugin = await wamPluginSingleton.getOrCreateKeyboardPlugin(context);
        logger.info('🎹 HarmonyWidget: Got plugin from singleton:', plugin);
        
        // Store the plugin instance
        keyboardPluginRef.current = plugin;
        
        // The plugin should already have an audio node from the singleton
        const audioNode = plugin.audioNode;
        logger.info('🎹 HarmonyWidget: Got audio node from plugin:', audioNode);
        
        // For now, connect directly to destination until proper track routing is implemented
        // The issue is that the track system expects specific plugin types and routing
        audioNode.connect(context.destination);
        logger.info('🎹 HarmonyWidget: Connected to audio destination');
        
        // Check the gain node value
        if (audioNode.gainNode) {
          logger.info('🎹 HarmonyWidget: Gain node value:', audioNode.gainNode.gain.value);
        }
        
        // CRITICAL: Load the instrument samples if not already loaded!
        if (audioNode.hasInstrumentLoaded && !audioNode.hasInstrumentLoaded()) {
          logger.info('🎹 HarmonyWidget: Loading instrument samples...');
          await audioNode.loadInstrument(currentInstrument);
          logger.info('🎹 HarmonyWidget: Instrument samples loaded!');
        } else if (audioNode.hasInstrumentLoaded && audioNode.hasInstrumentLoaded()) {
          logger.info('🎹 HarmonyWidget: Instrument already loaded, skipping sample loading');
        } else {
          // Fallback if hasInstrumentLoaded method doesn't exist
          logger.info('🎹 HarmonyWidget: Loading instrument samples (no check method)...');
          await audioNode.loadInstrument(currentInstrument);
          logger.info('🎹 HarmonyWidget: Instrument samples loaded!');
        }
        
        setWamPluginLoaded(true);
        logger.info('✅ WAM Keyboard plugin loaded and connected for HarmonyWidget');
        
        // Set initial volume and ensure gain is not zero
        await audioNode.setParameterValues({
          volume: isMuted ? 0 : volume / 100
        });
        
        // Force gain node to proper value if needed
        if (audioNode.gainNode && !isMuted) {
          audioNode.gainNode.gain.value = volume / 100;
          logger.info('🎹 HarmonyWidget: Set gain node to:', volume / 100);
        }
        
        // Successfully created, reset the flag
        isCreatingPluginRef.current = false;
      } catch (error) {
        logger.error('❌ Failed to create WAM Keyboard plugin:', error);
        isCreatingPluginRef.current = false;
      }
    } else {
      logger.info('🎹 HarmonyWidget: AudioContext not ready yet', {
        hasContext: !!context,
        contextState: context?.state
      });
      isCreatingPluginRef.current = false;
    }
  }, [track.isReady, wamPluginLoaded, pluginClassLoaded, isMuted, volume]);
  
  // Phase 2: Create the audio node when AudioContext is available
  useEffect(() => {
    logger.info('🎹 HarmonyWidget: Phase 2 effect check:', {
      window: typeof window !== 'undefined',
      pluginClassLoaded,
      trackIsReady: track.isReady,
      wamPluginLoaded,
      hasPlugin: !!keyboardPluginRef.current,
      shouldRun: typeof window !== 'undefined' && pluginClassLoaded && track.isReady && !wamPluginLoaded
    });
    
    if (typeof window === 'undefined') return;
    if (!pluginClassLoaded || !track.isReady || wamPluginLoaded) return;
    
    // Add guard to prevent multiple instances
    if (keyboardPluginRef.current) {
      logger.info('🎹 HarmonyWidget: Plugin already loaded, skipping creation');
      return;
    }
    
    createAudioNodeAttempt();
  }, [track.isReady, wamPluginLoaded, pluginClassLoaded, createAudioNodeAttempt]);
  
  // Cleanup effect - dispose plugin when component unmounts
  useEffect(() => {
    return () => {
      logger.info('🎹 HarmonyWidget: Component unmounting, cleaning up...');
      
      // Reset the creation flag
      isCreatingPluginRef.current = false;
      
      // Release our reference to the plugin via the singleton
      if (keyboardPluginRef.current) {
        try {
          // Disconnect audio node
          if (keyboardPluginRef.current.audioNode) {
            keyboardPluginRef.current.audioNode.clearEvents();
            keyboardPluginRef.current.audioNode.disconnect();
          }
          
          // Release the plugin reference in the singleton
          // This will handle cleanup if this is the last reference
          wamPluginSingleton.releasePlugin('wam-keyboard');
          
          keyboardPluginRef.current = null;
          logger.info('✅ HarmonyWidget plugin cleaned up');
        } catch (error) {
          logger.error('Error cleaning up HarmonyWidget plugin:', error);
        }
      }
      
      // Clear any retry timeouts
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, []);
  
  // Handle volume changes
  useEffect(() => {
    if (keyboardPluginRef.current) {
      keyboardPluginRef.current.audioNode?.setParameterValues({
        volume: isMuted ? 0 : volume / 100
      });
    }
  }, [volume, isMuted]);
  
  // Listen for audio services ready event
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    logger.info('🎹 HarmonyWidget: Setting up audio service listeners...');
    
    // Check if services are already ready
    const globalServices = (window as any).__globalCoreServices || (window as any).__coreServices;
    if (globalServices && globalServices.getAudioEngine) {
      try {
        const audioEngine = globalServices.getAudioEngine();
        if (audioEngine && audioEngine.isReady && audioEngine.isReady()) {
          logger.info('🎹 HarmonyWidget: Audio services already ready');
          setAudioServicesReady(true);
          
          // Check audio context state
          const context = audioEngine.getContext ? audioEngine.getContext() : null;
          if (context) {
            logger.info('🎹 HarmonyWidget: Audio context state:', context.state);
            if (context.state === 'suspended') {
              logger.info('🎹 HarmonyWidget: Audio context is suspended, waiting for user gesture...');
            }
          }
        }
      } catch (e) {
        logger.info('🎹 HarmonyWidget: Audio services not ready yet');
      }
    }
    
    const handleAudioReady = () => {
      logger.info('🎹 HarmonyWidget: Audio services ready event received');
      setAudioServicesReady(true);
      
      // Force check if we can create plugin now
      if (!wamPluginLoaded && pluginClassLoaded && track.isReady) {
        logger.info('🎹 HarmonyWidget: Audio ready, attempting to create plugin...');
        createAudioNodeAttempt();
      }
    };
    
    const handleAudioContextStarted = () => {
      logger.info('🎹 HarmonyWidget: AudioContext started event received');
      setAudioServicesReady(true);
      // Trigger a retry by incrementing the counter
      setRetryCount(prev => prev + 1);
      
      // Force check if we can create plugin now
      if (!wamPluginLoaded && pluginClassLoaded && track.isReady) {
        logger.info('🎹 HarmonyWidget: Audio context started, attempting to create plugin...');
        createAudioNodeAttempt();
      }
    };
    
    window.addEventListener('audioServicesReady', handleAudioReady);
    window.addEventListener('audioContextStarted', handleAudioContextStarted);
    
    return () => {
      window.removeEventListener('audioServicesReady', handleAudioReady);
      window.removeEventListener('audioContextStarted', handleAudioContextStarted);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [wamPluginLoaded]);
  
  // Retry plugin loading when audio services become ready
  useEffect(() => {
    logger.info('🎹 HarmonyWidget: Retry effect check:', {
      audioServicesReady,
      trackIsReady: track.isReady,
      wamPluginLoaded,
      pluginClassLoaded,
      shouldRetry: audioServicesReady && track.isReady && !wamPluginLoaded && pluginClassLoaded
    });
    
    if (audioServicesReady && track.isReady && !wamPluginLoaded && pluginClassLoaded) {
      logger.info('🎹 HarmonyWidget: Audio services ready, retrying plugin load...', {
        audioServicesReady,
        trackIsReady: track.isReady,
        wamPluginLoaded,
        pluginClassLoaded,
        hasPlugin: !!keyboardPluginRef.current
      });
      // Force a new attempt to create the audio node
      createAudioNodeAttempt();
    }
  }, [audioServicesReady, track.isReady, wamPluginLoaded, pluginClassLoaded, createAudioNodeAttempt, retryCount]);
  
  // Handle instrument changes - wrapped with audio context initialization
  const handleInstrumentChange = useCallback(withAudioContext(async (instrument: KeyboardInstrumentType) => {
    setCurrentInstrument(instrument);
    if (keyboardPluginRef.current) {
      const instrumentIndex = Object.values(KeyboardInstrument).indexOf(instrument);
      await keyboardPluginRef.current.audioNode?.setParameterValues({
        instrument: instrumentIndex
      });
    }
  }), []);

  // Test chord function - wrapped with audio context initialization
  const testChord = useCallback(withAudioContext(async () => {
    logger.info('🎹 testChord called:', { 
      plugin: keyboardPluginRef.current,
      audioServicesReady,
      trackIsReady: track.isReady,
      wamPluginLoaded,
      pluginClassLoaded
    });
    
    // Ensure audio services are ready
    if (!audioServicesReady) {
      logger.info('🎹 Audio services not ready yet, waiting for audio context to start...');
      // The withAudioContext wrapper should handle this, but let's make sure
    }
    
    // If plugin isn't loaded, try to use pre-loaded instrument first
    if (!keyboardPluginRef.current) {
      logger.info('🎹 Plugin not loaded, checking for pre-loaded instrument...');
      
      // Check for pre-loaded instrument
      const preloadedInstrument = GlobalSampleCache.getCachedInstrument('harmony-preloaded');
      if (preloadedInstrument && preloadedInstrument.audioNode) {
        logger.info('🎹 ✅ Found pre-loaded harmony instrument! Using it for TEST.');
        keyboardPluginRef.current = preloadedInstrument;
        setWamPluginLoaded(true);
        
        // Ensure proper volume is set
        await preloadedInstrument.audioNode.setParameterValues({
          volume: isMuted ? 0 : volume / 100,
        });
      } else {
        // No pre-loaded instrument, check if we have cached URLs
        const testNote = 'Keyboards/salamander/v10/C4.mp3';
        const cachedUrl = GlobalSampleCache.getCachedUrl(testNote);
        if (cachedUrl && cachedUrl.includes('supabase')) {
          logger.info('🎹 ✅ Found cached URLs from Phase 2! Samples will load from cache.');
        } else {
          logger.warn('🎹 ⚠️ No cached URLs found. Samples will load fresh (6+ seconds).');
        }
        
        // Try to create new instrument
        if (!wamPluginLoaded && pluginClassLoaded) {
          logger.info('🎹 Creating new instrument...');
          await createAudioNodeAttempt();
          
          // Wait a bit for the plugin to initialize
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
    
    if (keyboardPluginRef.current && keyboardPluginRef.current.audioNode) {
      const audioNode = keyboardPluginRef.current.audioNode;
      // Play a C major chord (C3, E3, G3) with staggered timing for a nice sound
      const notes = [
        { note: 60, velocity: 80 }, // C3
        { note: 64, velocity: 80 }, // E3
        { note: 67, velocity: 80 }  // G3
      ];
      
      const context = audioNode.context;
      const currentTime = context.currentTime;
      
      // Check Tone.js master volume
      const Tone = (window as any).Tone;
      if (Tone) {
        logger.info('🎹 Tone.js Master check:', {
          destinationVolume: Tone.Destination?.volume?.value,
          destinationMuted: Tone.Destination?.mute,
          masterVolume: Tone.Master?.volume?.value,
          masterMuted: Tone.Master?.mute,
          toneContext: Tone.context,
          toneContextState: Tone.context?.state,
          rawContext: Tone.context?.rawContext || Tone.context?._context
        });
        
        // Ensure Tone.Destination is not muted
        if (Tone.Destination && Tone.Destination.mute) {
          logger.warn('🎹 WARNING: Tone.Destination is muted! Unmuting...');
          Tone.Destination.mute = false;
        }
        
        // Ensure volume is reasonable
        if (Tone.Destination?.volume && Tone.Destination.volume.value < -40) {
          logger.warn('🎹 WARNING: Tone.Destination volume too low! Setting to 0dB');
          Tone.Destination.volume.value = 0;
        }
        
        // CRITICAL: Ensure Tone.js is connected to the actual AudioContext destination
        const toneRawContext = Tone.context?.rawContext || Tone.context?._context || Tone.context;
        if (toneRawContext && toneRawContext !== context) {
          logger.error('🎹 CRITICAL: Tone.js is using a different AudioContext!', {
            toneContext: toneRawContext,
            wamContext: context,
            same: toneRawContext === context
          });
          
          // This is the problem - Tone.js is not outputting to our AudioContext
          // We need to ensure the sampler connects properly
          logger.warn('🎹 Audio contexts mismatch - this may cause no sound!');
          
          // CRITICAL FIX: Connect Tone.Destination to the actual audio output
          logger.info('🎹 Attempting to fix audio routing...');
          try {
            // Get Tone's internal destination node
            const toneDestNode = Tone.Destination._internalChannels?.[0] || 
                               Tone.Destination._volume || 
                               Tone.Destination.input ||
                               Tone.Destination;
            
            if (toneDestNode && context.destination) {
              // Try to get the native node
              let nativeNode = toneDestNode;
              if (toneDestNode._gainNode) {
                nativeNode = toneDestNode._gainNode;
              } else if (toneDestNode.gain) {
                nativeNode = toneDestNode;
              }
              
              // Disconnect and reconnect to proper destination
              try {
                nativeNode.disconnect();
              } catch (e) {
                // Already disconnected
              }
              
              nativeNode.connect(context.destination);
              logger.info('✅ FIXED: Connected Tone.Destination to actual audio output!');
              
              // Also ensure Tone's master volume is reasonable
              if (Tone.Destination.volume) {
                Tone.Destination.volume.value = 0; // 0dB = unity gain
              }
            }
          } catch (fixError) {
            logger.error('Failed to fix audio routing:', fixError);
          }
        }
      }
      
      logger.info('🎹 Audio context state:', {
        state: context.state,
        sampleRate: context.sampleRate,
        currentTime: currentTime,
        destination: context.destination,
        numberOfOutputs: audioNode.numberOfOutputs
      });
      
      notes.forEach((noteData, index) => {
        // Stagger notes by 10ms for a more natural sound, with 50ms delay to ensure future scheduling
        const noteTime = currentTime + 0.05 + (index * 0.01);
        audioNode.triggerNote(noteData.note, noteData.velocity, noteTime);
        logger.info(`🎹 Triggering note ${noteData.note} at time ${noteTime}`);
        
        // Check if we can hear the audio by checking gain values
        if (audioNode.gainNode) {
          logger.info('🎹 Audio chain check:', {
            gainNodeValue: audioNode.gainNode.gain.value,
            contextDestination: context.destination,
            isMuted: isMuted,
            volumeSliderValue: volume,
            effectiveVolume: isMuted ? 0 : volume / 100
          });
        }
      });
      
      logger.info('🎹 Test chord triggered');
      
      // Release notes after 1 second
      setTimeout(() => {
        notes.forEach(noteData => {
          audioNode.releaseNote(noteData.note);
        });
      }, 1000);
    } else {
      logger.info('❌ Cannot play test chord - plugin not ready');
    }
  }), [wamPluginLoaded, pluginClassLoaded, createAudioNodeAttempt]);
  
  // Schedule chord progression
  const scheduleProgression = useCallback(() => {
    const plugin = keyboardPluginRef.current;
    if (!plugin || !track.isPlaying) return;
    
    const selectedProg = chordProgressions[selectedProgression as keyof typeof chordProgressions];
    if (!selectedProg) return;
    
    const context = track.track?.audioContext;
    if (!context) return;
    
    // Get current transport time
    const currentTime = context.currentTime;
    const beatDuration = 60 / tempo; // Duration of one beat in seconds
    
    // Clear any existing pattern
    currentPatternRef.current = [];
    
    // Schedule the progression
    let scheduleTime = currentTime + 0.1; // Small lookahead
    
    selectedProg.forEach((item) => {
      const chordDuration = item.duration * beatDuration;
      
      // Play the chord
      plugin.playChord(item.chord, 70, chordDuration - 0.05, 4); // Slightly shorter for note separation
      
      // Store pattern info
      currentPatternRef.current.push({
        chord: item.chord,
        time: scheduleTime,
        duration: chordDuration
      });
      
      // Update current chord indicator
      setTimeout(() => {
        if (track.isPlaying) {
          onNextChord();
        }
      }, (scheduleTime - currentTime) * 1000);
      
      scheduleTime += chordDuration;
    });
    
    lastScheduledTimeRef.current = scheduleTime;
  }, [selectedProgression, tempo, track.isPlaying, onNextChord]);
  
  // Handle play state changes
  useEffect(() => {
    if (isPlaying && track.isReady && keyboardPluginRef.current) {
      scheduleProgression();
    } else if (!isPlaying && keyboardPluginRef.current) {
      // Stop all notes
      keyboardPluginRef.current.audioNode?.clearEvents();
    }
  }, [isPlaying, track.isReady, scheduleProgression]);
  
  // Handle progression changes
  const handleProgressionChange = useCallback((newProgression: string) => {
    setSelectedProgression(newProgression);
    const prog = chordProgressions[newProgression as keyof typeof chordProgressions];
    if (prog) {
      onProgressionChange(prog.map(item => item.chord));
    }
  }, [onProgressionChange]);
  
  // Component visibility
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
            onChange={setVolume}
            color="bg-blue-400"
            size={45}
            isMuted={isMuted}
            onMuteToggle={() => setIsMuted(!isMuted)}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <div className="flex items-center justify-between px-4 py-2">
            {!isExpanded ? (
              <>
                <div className="flex-1">
                  <h3 className={`font-semibold text-sm ${volume === 0 ? 'text-slate-600' : 'text-white'}`}>
                    Harmony Track
                  </h3>
                  <p className={`text-xs ${volume === 0 ? 'text-slate-600' : 'text-slate-400'}`}>
                    {currentInstrument} | {selectedProgression}
                  </p>
                </div>

                <button
                  onClick={() => setIsExpanded(true)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 shadow-[5px_5px_10px_rgba(0,0,0,0.5),-5px_-5px_10px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300 cursor-pointer ${
                    volume === 0 ? 'opacity-50' : ''
                  }`}
                >
                  {/* Chord progression dots */}
                  <div className="flex gap-1">
                    {progression.slice(0, 4).map((chord, idx) => (
                      <div
                        key={idx}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium transition-all duration-200 ${
                          idx === localCurrentChord && isPlaying
                            ? 'bg-blue-400 text-white shadow-lg shadow-blue-400/50'
                            : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        {chord?.split('/')[0] || 'C'}
                      </div>
                    ))}
                  </div>
                  <span className={`text-sm font-medium ${volume === 0 ? 'text-slate-600' : 'text-blue-400'}`}>
                    {progression[localCurrentChord] || 'C'}
                  </span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-4 w-full">
                <div className="flex-1">
                  <div className="flex flex-col gap-2">
                    {/* Instrument Selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-16">Sound:</span>
                      <select
                        value={currentInstrument}
                        onChange={(e) => handleInstrumentChange(e.target.value as KeyboardInstrumentType)}
                        className="flex-1 bg-slate-700 text-white text-xs rounded px-2 py-1"
                      >
                        {Object.entries(KeyboardInstrument).map(([key, value]) => (
                          <option key={value} value={value}>
                            {key.split('_').map(word => 
                              word.charAt(0) + word.slice(1).toLowerCase()
                            ).join(' ')}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Progression Selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-16">Pattern:</span>
                      <select
                        value={selectedProgression}
                        onChange={(e) => handleProgressionChange(e.target.value)}
                        className="flex-1 bg-slate-700 text-white text-xs rounded px-2 py-1"
                      >
                        {Object.keys(chordProgressions).map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Current Chord Display */}
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-400 w-16">Chords:</span>
                      <div className="flex gap-1">
                        {progression.map((chord, idx) => (
                          <div
                            key={idx}
                            className={`w-8 h-6 rounded text-xs flex items-center justify-center font-medium transition-all duration-200 cursor-default ${
                              idx === localCurrentChord && isPlaying
                                ? 'bg-blue-400 text-white shadow-lg shadow-blue-400/50'
                                : 'bg-slate-700 text-slate-400'
                            }`}
                          >
                            {chord?.split('/')[0] || 'C'}
                          </div>
                        ))}
                      </div>
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

        {/* Status and Close Button */}
        <div className="flex items-center gap-2 ml-4">
          <span className="text-xs text-gray-400">
            {track.isReady ? '🟢' : '🟡'}
          </span>
          <button
            onClick={onToggleVisibility}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
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
}

