'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { VolumeKnob } from './VolumeKnob';
import { supabase } from '@/infrastructure/supabase/client';
// Removed useWidgetSync - part of old pattern registration system
// Removed widgetSingleton - not needed with track-based system
import { useTrack } from '@/domains/playback/hooks/useTrack';
import { UnifiedTransport } from '@/domains/playback/services/core/UnifiedTransport';
import { useSyncContext } from '../../base/SyncProvider';
import type { DrumPattern, DrumPatternEvent } from '@/domains/playback/types/pattern';
import { toMusicalPosition as toPosition } from '@/domains/playback/types/pattern';
import { useWamDrummer } from '@/domains/widgets/hooks/useWamDrummer';

const logger = {
  log: (...args: any[]) => console.log('🥁 DrummerWidget:', ...args),
  error: (...args: any[]) => console.error('🥁 DrummerWidget Error:', ...args),
};

// Default kit path in Supabase
const DEFAULT_KIT = 'drums/hydrogen-kits/mp3/electronic/boss-dr110';

// Boss DR-110 sample mapping to internal 16-pad MPC-style sampler
const BOSS_DR110_MAPPING = {
  1: { file: 'dr110kik.mp3', name: 'kick' },      // Pad 1: Main kick
  3: { file: 'dr110clp.mp3', name: 'snare' },     // Pad 3: Snare/clap
  5: { file: 'dr110cht.mp3', name: 'hihat' },     // Pad 5: Closed hihat
  // Pads 2,4,6-16 are available for additional samples
};

import type { Exercise } from '@bassnotion/contracts';

interface DrummerWidgetProps {
  pattern: string;
  isVisible: boolean;
  exercise?: Exercise;
  onPatternChange: (pattern: string) => void;
  onToggleVisibility: () => void;
  // REMOVED: isPlaying prop - we get it from sync service
  // REMOVED: onTogglePlay - widgets shouldn't control transport
  enableWamDrummer?: boolean; // Enable WAM-based drummer for track system
}

// Drum pattern data structure: 3 rows (HH, SN, K) x 8 columns
const drummerPatterns = {
  hihat: Array.from({ length: 8 }, (_, i) => ({
    beat: i + 1,
    isActive: true, // Hi-hats on all eighth notes
    intensity: 'medium',
  })),
  snare: Array.from({ length: 8 }, (_, i) => ({
    beat: i + 1,
    isActive: i === 2 || i === 6, // Beats 3 and 7 (0-indexed: 2 and 6)
    intensity: 'high',
  })),
  kick: Array.from({ length: 8 }, (_, i) => ({
    beat: i + 1,
    isActive: i === 0 || i === 4, // Beats 1 and 5 (0-indexed: 0 and 4)
    intensity: 'high',
  })),
};

const availablePatterns = [
  'Jazz Swing',
  'Rock Steady',
  'Bossa Nova',
  'Funk Groove',
  'Latin',
  'Shuffle',
];

export function DrummerWidget({
  pattern,
  isVisible,
  exercise,
  onPatternChange,
  onToggleVisibility,
  enableWamDrummer = false,
}: DrummerWidgetProps) {
  // DIRECT CONNECTION TO TRANSPORT STATE
  const syncResult = useWidgetSync({
    widgetId: 'drummer-widget',
    subscribeTo: ['PLAY', 'STOP', 'PAUSE', 'TEMPO_CHANGE', 'SEEK'],
    debugMode: false,
  });

  // Get transport state directly from sync service
  const isPlaying = syncResult.isPlaying;
  const tempo = syncResult.tempo;
  const isConnected = syncResult.state.isConnected;
  
  // WAM Drummer hook - always call but control with autoLoad
  const wamDrummer = useWamDrummer({
    widgetId: 'drummer-widget',
    autoLoad: enableWamDrummer, // Only load if WAM is enabled
    debugMode: false
  });
  
  const [currentBeat, setCurrentBeat] = useState(0);
  const [patterns, setPatterns] = useState(drummerPatterns);
  const [isExpanded, setIsExpanded] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [samplesLoaded, setSamplesLoaded] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('Not started');
  const [toneLoaded, setToneLoaded] = useState(false);
  const loadStartTimeRef = useRef<number>(Date.now());
  
  // Store Tone module after lazy loading
  const toneRef = useRef<typeof import('tone') | null>(null);
  
  // MPC-style 16 pad sampler (internal architecture - not visible to user)
  const drumPadsRef = useRef<Record<number, any>>({});
  
  // Refs to avoid stale closures in callbacks
  const volumeRef = useRef(volume);
  const isMutedRef = useRef(isMuted);
  const padsLoadedRef = useRef(false);
  
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);
  
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Initialize Tone.js with retry logic
  useEffect(() => {
    const initializeTone = async () => {
      if (toneLoaded || toneRef.current) return;
      
      try {
        // Try to get Tone from CoreServices first
        const coreServices = (window as any).__coreServices || (window as any).__globalCoreServices;
        if (coreServices && typeof coreServices.getAudioEngine === 'function') {
          const audioEngine = coreServices.getAudioEngine();
          if (audioEngine && typeof audioEngine.getTone === 'function') {
            try {
              toneRef.current = audioEngine.getTone();
              logger.log('Got Tone.js from CoreServices');
              setToneLoaded(true);
              setAudioReady(true);
              return;
            } catch (engineError: any) {
              // AudioEngine not fully initialized yet, will retry
              logger.log('AudioEngine not ready yet, will retry...');
            }
          }
        }
        
        // Wait for audio services to be ready
        if (!toneRef.current) {
          logger.log('Waiting for audio services to be ready...');
          // Listen for audioServicesReady event
          await new Promise<void>((resolve) => {
            const checkServices = () => {
              if ((window as any).__globalCoreServices) {
                resolve();
              } else {
                setTimeout(checkServices, 100);
              }
            };
            
            // Also listen for the event
            const handleReady = () => {
              window.removeEventListener('audioServicesReady', handleReady);
              resolve();
            };
            window.addEventListener('audioServicesReady', handleReady);
            
            checkServices();
          });
          
          // Try again after services are ready
          await initializeTone();
        }
      } catch (error) {
        logger.error('Failed to load Tone.js:', error);
        // Retry after a short delay
        setTimeout(() => {
          if (!toneLoaded) {
            logger.log('Retrying Tone.js initialization...');
            initializeTone();
          }
        }, 1000);
      }
    };

    // Load immediately
    initializeTone();

    // Also handle clicks to resume audio context if needed
    const handleClick = async () => {
      if (toneRef.current) {
        const Tone = toneRef.current;
        const audioContext = Tone.context.rawContext as AudioContext;
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
          logger.log('Resumed audio context on user interaction');
          setAudioReady(true);
        }
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Load drum samples from Supabase into internal 16-pad sampler
  const loadDrumSamples = useCallback(async () => {
    // If using WAM drummer, load samples through it
    if (enableWamDrummer && wamDrummer.isReady) {
      logger.log('🎵 Loading samples through WAM Drummer');
      
      try {
        const kitPath = await getSupabaseUrl(DEFAULT_KIT);
        await wamDrummer.loadKit(kitPath);
        setSamplesLoaded(true);
        setLoadingStatus('WAM Drummer Ready');
        logger.log('✅ WAM Drummer samples loaded');
        return;
      } catch (error) {
        logger.error('Failed to load WAM samples:', error);
        setLoadingStatus('WAM loading failed');
      }
    }
    // Emit loading start event
    window.dispatchEvent(new CustomEvent('widgetLoadStart', { 
      detail: { widget: 'DrummerWidget' } 
    }));
    
    // First check BackgroundSampleLoader for preloaded samples
    try {
      const { getBackgroundLoader } = await import('@/domains/playback/services/BackgroundSampleLoader');
      const loader = getBackgroundLoader();
      const preloadedSamples = loader.getPreloadedSamples('drums');
      
      if (preloadedSamples) {
        const status = loader.getSampleStatus('drums');
        logger.log(`🎉 Using preloaded drum samples (${status.quality} quality)!`);
        drumPadsRef.current = preloadedSamples;
        
        // Check if samples need to be connected to destination
        if (!loader.areSamplesConnected('drums')) {
          logger.log('🔌 Connecting preloaded drums to audio destination...');
          const connected = await loader.connectSamplesToDestination('drums');
          if (connected) {
            logger.log('✅ Preloaded drums connected to destination');
          }
        }
        
        setSamplesLoaded(true);
        padsLoadedRef.current = true;
        setLoadingStatus(`Ready (${status.quality})`);
        
        // Listen for sample upgrades
        const handleUpgrade = (event: CustomEvent) => {
          if (event.detail.instrument === 'drums') {
            const newSamples = loader.getPreloadedSamples('drums');
            if (newSamples && newSamples !== drumPadsRef.current) {
              logger.log(`✨ Upgrading drums to ${event.detail.quality} quality`);
              drumPadsRef.current = newSamples;
              setLoadingStatus(`Ready (${event.detail.quality})`);
            }
          }
        };
        window.addEventListener('samplesUpgraded', handleUpgrade as EventListener);
        
        return;
      }
    } catch (error) {
      logger.log('BackgroundSampleLoader not available, checking legacy preload...');
    }
    
    // Fallback: Check legacy preloaded samples
    if ((window as any).__preloadedDrumPads) {
      logger.log('🎉 Using legacy preloaded drum samples!');
      drumPadsRef.current = (window as any).__preloadedDrumPads;
      setSamplesLoaded(true);
      padsLoadedRef.current = true;
      setLoadingStatus('Samples ready (preloaded)');
      return;
    }
    
    if (!toneRef.current) {
      logger.log('Cannot load samples - Tone.js not loaded');
      return;
    }
    
    const Tone = toneRef.current;
    
    // Audio context might be suspended but we can still load samples
    const audioContext = Tone.context.rawContext as AudioContext;
    logger.log('Loading samples with audio context state:', audioContext.state);

    logger.log('🥁 Loading drum kit from:', DEFAULT_KIT);
    setLoadingStatus('Loading samples...');

    try {
      // Clear existing pads
      Object.values(drumPadsRef.current).forEach(pad => {
        if (pad) pad.dispose();
      });
      drumPadsRef.current = {};

      // Load samples into the 16-pad internal sampler
      const drumKitMapping = { ...BOSS_DR110_MAPPING };

      let loadedCount = 0;
      const totalSamples = Object.keys(drumKitMapping).length;
      const loadPromises: Promise<void>[] = [];

      // Load each mapped sample into its pad IN PARALLEL
      for (const [padNumber, sampleInfo] of Object.entries(drumKitMapping)) {
        const padNum = parseInt(padNumber);
        const samplePath = `${DEFAULT_KIT}/${sampleInfo.file}`;
        const sampleUrl = `${supabase.storage.from('audio-samples').getPublicUrl(samplePath).data.publicUrl}`;
        
        logger.log(`Loading pad ${padNum} (${sampleInfo.name}): ${sampleUrl}`);

        // Create a promise for each sample load
        const loadPromise = (async () => {
          try {
            // Test if URL is accessible
            const testResponse = await fetch(sampleUrl, { method: 'HEAD' });
            logger.log(`URL test for pad ${padNum}: ${testResponse.ok ? 'OK' : 'FAILED'} (${testResponse.status})`);
            
            // Create promise that resolves when this specific player loads
            await new Promise<void>((resolve, reject) => {
              // Use Tone.Player which handles external URLs better
              const player = new Tone.Player({
                url: sampleUrl,
                onload: () => {
                  logger.log(`✅ Successfully loaded pad ${padNum} (${sampleInfo.name}) via Player`);
                  
                  // Only connect to destination if AudioContext is running
                  const audioContext = Tone.context.rawContext as AudioContext;
                  if (audioContext.state === 'running') {
                    player.toDestination();
                    logger.log(`🔌 Connected pad ${padNum} to destination (AudioContext running)`);
                  } else {
                    logger.log(`⏸️ Pad ${padNum} loaded but not connected (AudioContext: ${audioContext.state})`);
                  }
                  
                  // Set a reasonable initial volume
                  player.volume.value = -10;
                  
                  logger.log(`🎵 Player setup complete: connected=${player.connected}, outputs=${player.numberOfOutputs}, volume=${player.volume.value}dB`);
                  loadedCount++;
                  resolve();
                },
                onerror: (error: any) => {
                  logger.error(`❌ Player failed to load pad ${padNum}:`, error);
                  reject(error);
                }
              });
          
              // Set initial volume
              player.volume.value = -10;
              
              // Store the player BEFORE loading to ensure it's available
              drumPadsRef.current[padNum] = player;
              logger.log(`🗄️ Stored player for pad ${padNum} before loading`);
            });
          } catch (error) {
            logger.error(`Failed to load pad ${padNum}:`, error);
            
            // Create synth fallback for this pad
            if (padNum === 1) {
            // Kick synth
            drumPadsRef.current[padNum] = new Tone.MembraneSynth({
              pitchDecay: 0.05,
              octaves: 10,
              oscillator: { type: 'sine' },
              envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 1.4 },
            }).toDestination();
            drumPadsRef.current[padNum].volume.value = -10;
          } else if (padNum === 3) {
            // Snare synth
            drumPadsRef.current[padNum] = new Tone.NoiseSynth({
              noise: { type: 'white' },
              envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 },
            }).toDestination();
            drumPadsRef.current[padNum].volume.value = -10;
          } else if (padNum === 5) {
            // Hihat synth
            drumPadsRef.current[padNum] = new Tone.MetalSynth({
              envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.01 },
            }).toDestination();
            drumPadsRef.current[padNum].volume.value = -15;
          }
          }
        })();
        
        loadPromises.push(loadPromise);
      }

      // Wait for all samples to load IN PARALLEL
      await Promise.allSettled(loadPromises);

      if (loadedCount > 0) {
        setSamplesLoaded(true);
        padsLoadedRef.current = true;
        setLoadingStatus(`Loaded ${loadedCount}/${totalSamples} samples`);
        const loadTime = Date.now() - loadStartTimeRef.current;
        logger.log(`✅ DrummerWidget: Loaded ${loadedCount}/${totalSamples} samples in ${loadTime}ms`);
        
        // Emit loading complete event
        window.dispatchEvent(new CustomEvent('widgetLoadComplete', { 
          detail: { widget: 'DrummerWidget', message: `${loadedCount}/${totalSamples} samples` } 
        }));
      } else {
        setLoadingStatus('Using synth fallbacks');
        logger.log('🥁 Using all synth fallbacks');
      }

    } catch (error) {
      logger.error('Failed to load drum kit:', error);
      setLoadingStatus(`Error: ${error}`);
    }
  }, []);

  // Check for preloaded samples on mount
  useEffect(() => {
    const checkPreloadedSamples = async () => {
      try {
        const { getBackgroundLoader } = await import('@/domains/playback/services/BackgroundSampleLoader');
        const loader = getBackgroundLoader();
        const preloadedSamples = loader.getPreloadedSamples('drums');
        
        if (preloadedSamples) {
          const status = loader.getSampleStatus('drums');
          logger.log(`🎉 Drum samples preloaded on mount (${status.quality} quality)!`);
          drumPadsRef.current = preloadedSamples;
          setSamplesLoaded(true);
          padsLoadedRef.current = true;
          setLoadingStatus(`Ready (${status.quality})`);
          setToneLoaded(true);
          setAudioReady(true);
          return;
        }
      } catch (error) {
        // BackgroundSampleLoader not available, check legacy
      }
      
      // Fallback: Check legacy preloaded samples
      if ((window as any).__preloadedDrumPads) {
        logger.log('🎉 Legacy drum samples already preloaded on mount!');
        drumPadsRef.current = (window as any).__preloadedDrumPads;
        setSamplesLoaded(true);
        padsLoadedRef.current = true;
        setLoadingStatus('Samples ready (preloaded)');
        setToneLoaded(true);
        setAudioReady(true);
      } else if ((window as any).__drumsLoadOnDemand) {
        logger.log('🥁 On-demand loading enabled, will load when ready');
        // Don't mark as loaded - let normal flow handle it
      }
    };
    
    checkPreloadedSamples();
  }, []);

  // Load samples when Tone is ready (if not already preloaded)
  useEffect(() => {
    if (toneLoaded && !samplesLoaded) {
      loadDrumSamples();
    }
  }, [toneLoaded, samplesLoaded, loadDrumSamples]);

  // React to tempo changes from transport
  useEffect(() => {
    if (!toneRef.current || !isConnected) return;
    
    const Tone = toneRef.current;
    if (Tone.Transport.bpm.value !== tempo) {
      logger.log(`📊 Updating tempo from ${Tone.Transport.bpm.value} to ${tempo}`);
      Tone.Transport.bpm.value = tempo;
    }
  }, [tempo, isConnected]);

  // Professional DAW-style configuration: Transport as master clock
  useEffect(() => {
    if (!samplesLoaded || !toneRef.current) return;

    const Tone = toneRef.current;
    
    // DON'T configure Transport loop here - let the central TransportController handle it
    // The Transport should progress through the entire exercise, not loop 1 measure
    
    Tone.Transport.swing = 0; // No swing by default
    Tone.Transport.swingSubdivision = '8n';
    
    logger.log('🎛️ DAW Transport configuration: Using global transport settings');
  }, [samplesLoaded]);

  // Generate unique widget instance ID
  const [widgetInstanceId] = useState(() => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    logger.log(`🎯 DrummerWidget created with ID: ${id}`);
    return id;
  });
  
  // Note: We don't need to track isActiveWidget state here since
  // usePatternRegistration handles singleton validation internally
  
  // Use track-based system instead of pattern registration
  const track = useTrack({
    trackId: `drummer-${widgetInstanceId}`,
    name: 'Drums',
    type: 'drums',
    autoInit: true,
    debugMode: true
  });
  
  // Get transport instance for scheduling
  const transportRef = useRef<UnifiedTransport | null>(null);
  const scheduleIdRef = useRef<number | null>(null);
  
  // Get sync context for transport state
  const { syncState } = useSyncContext();
  
  
  // Debug log widget instance status
  useEffect(() => {
    logger.log(`🥁 DrummerWidget[${widgetInstanceId}]: Instance created with track-based system`);
  }, [widgetInstanceId]);
  
  // Track last triggered position to prevent duplicate hits
  // Store if pattern is registered
  const patternRegisteredRef = useRef<boolean>(false);
  
  // Helper to get Supabase URL for a path
  const getSupabaseUrl = async (path: string): Promise<string> => {
    const { data: { publicUrl } } = supabase
      .storage
      .from('audio-samples')
      .getPublicUrl(path);
    return publicUrl;
  };
  
  // Helper function to trigger drum immediately
  const triggerDrum = useCallback(async (
    instrumentType: 'kick' | 'snare' | 'hihat',
    velocity: number = 0.7
  ) => {
    // Use WAM drummer if enabled
    if (enableWamDrummer && wamDrummer.isReady) {
      const padMapping = {
        'kick': 1,
        'snare': 3,
        'hihat': 7
      };
      const padNumber = padMapping[instrumentType];
      if (padNumber) {
        wamDrummer.triggerPad(padNumber, velocity);
        logger.log(`Triggered WAM pad ${padNumber} (${instrumentType})`);
        return;
      }
    }
    if (!toneRef.current || !drumPadsRef.current) return;
    
    // Ensure drums are connected before playing
    await ensureDrumsConnected();
    
    const Tone = toneRef.current;
    const padNum = instrumentType === 'kick' ? 1 : instrumentType === 'snare' ? 3 : 5;
    const pad = drumPadsRef.current[padNum];
    
    if (!pad) {
      logger.error(`❌ No ${instrumentType} pad available`);
      return;
    }
    
    // Check if muted
    if (isMuted || volumeRef.current === 0) {
      logger.log(`🔇 Drum ${instrumentType} muted or volume is 0`);
      return;
    }
    
    // Simpler volume calculation: 80% volume = -6dB, 100% = 0dB
    const volumeDb = Tone.gainToDb(volumeRef.current / 100);
    const velocityDb = Tone.gainToDb(velocity);
    const finalVolume = volumeDb + velocityDb;
    
    const now = Tone.now();
    
    logger.log(`🥁 Triggering ${instrumentType} at time ${now.toFixed(3)}, volume: ${volumeRef.current}% = ${volumeDb}dB, velocity: ${velocity} = ${velocityDb}dB, final: ${finalVolume}dB`);
    
    try {
      // Check what type of instrument we have
      if ('restart' in pad) {
        // It's a Player (for all drum samples)
        pad.volume.value = finalVolume;
        
        // For one-shot playback, always restart to ensure clean playback
        // This prevents overlapping sounds when clicking rapidly
        pad.restart(now);
        logger.log(`✅ ${instrumentType} triggered via Player.restart()`);
        
        // Debug check for audio routing
        const Tone = toneRef.current;
        logger.log(`🔊 Audio routing check: Player connected=${pad.numberOfOutputs > 0}, state=${pad.state}, volume=${pad.volume.value}dB, loaded=${pad.loaded}, buffer=${pad.buffer ? 'exists' : 'null'}`);
        
        // Check master destination
        logger.log(`🎚️ Master Destination: volume=${Tone.Destination.volume.value}dB, mute=${Tone.Destination.mute}`);
        
      } else if ('triggerAttackRelease' in pad) {
        // It's a Synth (fallback instruments)
        let freq, dur;
        if (instrumentType === 'kick') {
          freq = 'C1';
          dur = '16n';
        } else if (instrumentType === 'snare') {
          freq = 'C4';
          dur = '16n';
        } else { // hihat
          freq = 'C6';
          dur = '32n';
        }
        pad.triggerAttackRelease(freq, dur, now, velocity);
      } else if ('triggerAttack' in pad) {
        // NoiseSynth for snare
        pad.triggerAttack(now, velocity);
        pad.triggerRelease(now + 0.1);
      }
    } catch (error) {
      logger.error(`❌ Error playing ${instrumentType}:`, error);
    }
  }, [isMuted, ensureDrumsConnected, enableWamDrummer, wamDrummer]);
  
  // Convert current pattern to transport pattern format
  const createDrumPattern = useCallback((): DrumPattern => {
    const events: DrumPatternEvent[] = [];
    
    // Default 4-bar rock pattern if no exercise
    // Kick on 1 and 3
    events.push(
      { position: toPosition(0, 0, 0), drum: 'kick', velocity: 0.8, duration: '16n' },
      { position: toPosition(0, 2, 0), drum: 'kick', velocity: 0.8, duration: '16n' }
    );
    
    // Snare on 2 and 4
    events.push(
      { position: toPosition(0, 1, 0), drum: 'snare', velocity: 0.7, duration: '16n' },
      { position: toPosition(0, 3, 0), drum: 'snare', velocity: 0.7, duration: '16n' }
    );
    
    // Hi-hat on all 8th notes
    for (let beat = 0; beat < 4; beat++) {
      events.push(
        { position: toPosition(0, beat, 0), drum: 'hihat', velocity: 0.6, duration: '32n' },
        { position: toPosition(0, beat, 2), drum: 'hihat', velocity: 0.5, duration: '32n' }
      );
    }
    
    return {
      id: `drums-${widgetInstanceId}`,
      events,
      loopLength: 1 // 1 bar pattern
    };
  }, [widgetInstanceId]);
  
  // Pattern trigger callback - called by transport at exact timing
  const handlePatternTrigger = useCallback((event: DrumPatternEvent, time: number) => {
    // Use WAM drummer if enabled
    if (enableWamDrummer && wamDrummer.isReady) {
      const padMapping = {
        'kick': 1,
        'snare': 3,
        'hihat': 7,
        'openhat': 11,
        'crash': 14,
        'ride': 16
      };
      const padNumber = padMapping[event.drum as keyof typeof padMapping];
      if (padNumber) {
        // Schedule the pad trigger at the correct time
        const delay = Math.max(0, time - (wamDrummer.wamInstance?.audioContext.currentTime || 0));
        setTimeout(() => {
          wamDrummer.triggerPad(padNumber, event.velocity / 100);
        }, delay * 1000);
      }
      return;
    }
    
    if (!toneRef.current || !drumPadsRef.current || !padsLoadedRef.current) {
      logger.log(`❌ Pattern trigger skipped - not ready (tone: ${!!toneRef.current}, pads: ${!!drumPadsRef.current}, loaded: ${padsLoadedRef.current})`);
      return;
    }
    
    // Map drum names to pad numbers
    const padMap: Record<string, number> = {
      'kick': 1,
      'snare': 3,
      'hihat': 5
    };
    
    const padNum = padMap[event.drum];
    const pad = drumPadsRef.current[padNum];
    if (!pad) {
      logger.log(`❌ No pad for ${event.drum} (pad ${padNum}). Available pads:`, Object.keys(drumPadsRef.current || {}));
      logger.log(`❌ drumPadsRef.current:`, drumPadsRef.current);
      return;
    }
    
    // Trigger drum at the scheduled time
    logger.log(`🥁 Pattern trigger: ${event.drum} at ${event.position}, velocity: ${event.velocity}, samplesLoaded: ${padsLoadedRef.current}`);
    
    try {
      // Apply velocity
      if ('volume' in pad) {
        const Tone = toneRef.current;
        const baseVolume = isMutedRef.current ? -Infinity : Tone.gainToDb(volumeRef.current / 100);
        const velocityAdjustment = Tone.gainToDb(event.velocity);
        pad.volume.value = baseVolume + velocityAdjustment;
      }
      
      // Trigger at exact time
      pad.start(time);
      
      // Stop after duration if specified
      if (event.duration) {
        const Tone = toneRef.current;
        const durationTime = Tone.Time(event.duration).toSeconds();
        pad.stop(time + durationTime);
      }
    } catch (error) {
      logger.error(`❌ Error triggering ${event.drum}:`, error);
    }
  }, []);
  
  // Schedule drum pattern with Transport when playing
  useEffect(() => {
    if (!track.isReady || !syncState.playback.isPlaying || !toneRef.current) {
      return;
    }
    
    const Tone = toneRef.current;
    
    // Cancel previous schedule if exists
    if (scheduleIdRef.current) {
      Tone.Transport.clear(scheduleIdRef.current);
      scheduleIdRef.current = null;
    }
    
    // Don't schedule if muted
    if (isMuted) {
      logger.log(`🔇 DrummerWidget[${widgetInstanceId}]: Muted, not scheduling`);
      return;
    }
    
    logger.log(`🥁 DrummerWidget[${widgetInstanceId}]: Scheduling drum pattern with Transport`);
    
    // Create drum pattern
    const pattern = createDrumPattern();
    
    // Add pattern to track
    if (track.track) {
      track.track.addPattern(pattern);
    }
    
    // Schedule with Transport.scheduleRepeat (like HarmonyWidget)
    const scheduleId = Tone.Transport.scheduleRepeat((time) => {
      // Trigger drums based on pattern
      pattern.events.forEach(event => {
        const [bar, beat, sixteenth] = event.position.split(':').map(Number);
        const currentPosition = Tone.Transport.position;
        const [currentBar, currentBeat, currentSixteenth] = currentPosition.split(':').map(Number);
        
        // Check if this event should trigger on this beat
        if (beat === currentBeat && sixteenth === currentSixteenth) {
          handlePatternTrigger(event, time);
        }
      });
    }, '16n', '0:0:0'); // Run every 16th note, starting at beginning
    
    scheduleIdRef.current = scheduleId;
    logger.log(`✅ DrummerWidget[${widgetInstanceId}]: Pattern scheduled with Transport`);
    
    return () => {
      if (scheduleIdRef.current) {
        Tone.Transport.clear(scheduleIdRef.current);
        scheduleIdRef.current = null;
      }
    };
  }, [track.isReady, syncState.playback.isPlaying, isMuted, createDrumPattern, handlePatternTrigger, widgetInstanceId]);
  
  
  // Handle mute state changes - scheduling is handled in the effect above
  useEffect(() => {
    logger.log(`🎼 DrummerWidget[${widgetInstanceId}]: Mute state changed = ${isMuted}`);
  }, [isMuted, widgetInstanceId]);
  
  // Handle play/stop state changes
  useEffect(() => {
    if (isPlaying) {
      logger.log(`🎵 DrummerWidget[${widgetInstanceId}]: Transport started - pattern will play`);
    } else {
      logger.log(`⏹️ DrummerWidget[${widgetInstanceId}]: Transport stopped`);
      setCurrentBeat(0); // Reset beat indicator
    }
  }, [isPlaying, widgetInstanceId]);

  // Function to ensure drums are connected to destination
  const ensureDrumsConnected = useCallback(async () => {
    if (!toneRef.current || !padsLoadedRef.current) return;
    
    const Tone = toneRef.current;
    const audioContext = Tone.context.rawContext as AudioContext;
    
    // Check if any pad needs connection
    const needsConnection = Object.values(drumPadsRef.current).some(pad => 
      pad && pad.numberOfOutputs === 0
    );
    
    if (needsConnection && audioContext.state === 'running') {
      logger.log('🔌 Connecting drum pads to destination...');
      Object.entries(drumPadsRef.current).forEach(([padNum, pad]) => {
        if (pad && pad.numberOfOutputs === 0) {
          try {
            pad.toDestination();
            logger.log(`✅ Connected pad ${padNum} to destination`);
          } catch (error) {
            logger.error(`❌ Failed to connect pad ${padNum}:`, error);
          }
        }
      });
    }
  }, []);

  // Handle volume changes
  useEffect(() => {
    // Handle WAM drummer volume
    if (enableWamDrummer && wamDrummer.isReady) {
      wamDrummer.setVolume(volume / 100);
      wamDrummer.setMute(isMuted);
      return;
    }
    
    // Handle Tone.js volume
    if (!toneRef.current) return;
    const Tone = toneRef.current;
    
    const dbValue = isMuted ? -Infinity : Tone.gainToDb(volume / 100);
    Object.values(drumPadsRef.current).forEach(pad => {
      if (pad && 'volume' in pad) {
        pad.volume.value = dbValue;
      }
    });
  }, [volume, isMuted, enableWamDrummer, wamDrummer]);

  // Cleanup on unmount
  useEffect(() => {
    logger.log(`🔧 DrummerWidget[${widgetInstanceId}] mounted`);
    
    return () => {
      logger.log(`🔧 DrummerWidget[${widgetInstanceId}] unmounting...`);
      
      // Track cleanup is handled by useTrack hook
      
      // Additional cleanup for safety
      
      // Dispose of drum pads
      Object.values(drumPadsRef.current).forEach(pad => {
        if (pad && typeof pad.dispose === 'function') {
          try {
            pad.dispose();
          } catch (error) {
            // Pad might already be disposed
          }
        }
      });
      drumPadsRef.current = {};
    };
  }, [widgetInstanceId]);


  // Manual test function to trigger sounds
  const testDrumSound = async (padNum: number) => {
    if (!toneRef.current) {
      logger.log('Cannot test sound - Tone.js not loaded');
      return;
    }
    
    const Tone = toneRef.current;
    
    // Ensure audio context is running using native API
    const audioContext = Tone.context.rawContext as AudioContext;
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
      logger.log('Resuming native audio context for manual test');
    }

    console.log(`🥁 Testing drum sound for pad ${padNum}, all pads:`, Object.keys(drumPadsRef.current));
    const pad = drumPadsRef.current[padNum];
    if (pad) {
      logger.log(`Testing pad ${padNum}, native audio state: ${audioContext.state}`);
      logger.log(`Pad details: volume=${pad.volume.value}dB, mute=${pad.mute}, connected=${pad.numberOfOutputs}`);
      
      // Set test volume
      const testVolume = Tone.gainToDb(volume / 100);
      pad.volume.value = testVolume;
      logger.log(`Set test volume to ${volume}% = ${testVolume}dB`);
      
      // Check master volume
      const masterVolume = Tone.Destination.volume.value;
      logger.log(`Master volume: ${masterVolume}dB`);
      
      if ('start' in pad) {
        // It's a Player - restart it
        logger.log(`Player state: ${pad.state}, loaded: ${pad.loaded}, buffer: ${pad.buffer ? 'exists' : 'null'}`);
        pad.stop();
        pad.start();
        logger.log(`Triggered Player on pad ${padNum}`);
      } else if ('triggerAttackRelease' in pad) {
        // For hihat, use a higher frequency
        const freq = padNum === 5 ? 'C6' : 'C1';
        const dur = padNum === 5 ? '32n' : '8n';
        pad.triggerAttackRelease(freq, dur);
        logger.log(`Triggered Sampler on pad ${padNum} with ${freq} ${dur}`);
      } else if ('triggerAttack' in pad) {
        pad.triggerAttack();
        logger.log(`Triggered Synth on pad ${padNum}`);
      }
    } else {
      logger.error(`No instrument on pad ${padNum}. Available pads: ${Object.keys(drumPadsRef.current).join(', ')}`);
      // Check if samples are still loading
      if (!samplesLoaded) {
        logger.log(`Samples still loading. Status: ${loadingStatus}`);
      }
    }
  };

  // Toggle drum pattern functions
  const toggleHihat = (index: number) => {
    setPatterns(prev => ({
      ...prev,
      hihat: prev.hihat.map((beat, i) => 
        i === index ? { ...beat, isActive: !beat.isActive } : beat
      )
    }));
    // Play the sound for feedback
    if (patterns.hihat && !patterns.hihat[index].isActive) {
      triggerDrum('hihat', 0.6);
    }
  };

  const toggleSnare = (index: number) => {
    setPatterns(prev => ({
      ...prev,
      snare: prev.snare.map((beat, i) => 
        i === index ? { ...beat, isActive: !beat.isActive } : beat
      )
    }));
    // Play the sound for feedback
    if (patterns.snare && !patterns.snare[index].isActive) {
      triggerDrum('snare', 0.7);
    }
  };

  const toggleKick = (index: number) => {
    setPatterns(prev => ({
      ...prev,
      kick: prev.kick.map((beat, i) => 
        i === index ? { ...beat, isActive: !beat.isActive } : beat
      )
    }));
    // Play the sound for feedback
    if (patterns.kick && !patterns.kick[index].isActive) {
      triggerDrum('kick', 0.8);
    }
  };

  if (!isVisible) return null;

  // Show connection status
  if (!isConnected) {
    return (
      <div className="relative bg-slate-800 rounded-2xl px-4 py-1 h-24 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] flex items-center justify-center">
        <p className="text-yellow-400">Connecting to transport...</p>
      </div>
    );
  }

  return (
    <div
      className={`relative bg-slate-800 rounded-2xl px-4 py-1 h-24 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300 select-none ${
        volume === 0 || isMuted ? 'bg-slate-850 grayscale brightness-100' : ''
      }`}
      onClick={async () => {
        logger.log('🔧 DrummerWidget clicked - testing all drum sounds');
        
        // Ensure audio context is resumed
        if (toneRef.current) {
          const audioContext = toneRef.current.context.rawContext as AudioContext;
          if (audioContext.state === 'suspended') {
            await audioContext.resume();
          }
        }
        
        // Test each drum sound with a delay
        triggerDrum('kick', 0.8);
        setTimeout(() => triggerDrum('snare', 0.7), 200);
        setTimeout(() => triggerDrum('hihat', 0.6), 400);
      }}
    >
      <div className="flex items-center justify-between h-full">
        {/* Volume Knob */}
        <div className="flex justify-center items-center w-20 h-16">
          <VolumeKnob
            value={volume}
            onChange={(val) => {
              console.log('Drummer volume:', val);
              setVolume(val);
              if (val > 0) {
                setIsMuted(false);
              }
            }}
            color="bg-orange-400"
            size={45}
            isMuted={isMuted}
            onMuteToggle={() => {
              setIsMuted(!isMuted);
            }}
          />
        </div>

        {/* Title/Subtitle OR Settings Panel */}
        <div className="flex-1">
          <div className="flex items-center justify-between px-4 py-2">
            {!isExpanded ? (
              <>
                {/* Title and Subtitle */}
                <div 
                  className="flex-1 cursor-pointer"
                  onClick={async () => {
                    logger.log('🔧 DrummerWidget clicked - testing all drum sounds');
                    await triggerDrum('kick', 0.8);
                    setTimeout(() => triggerDrum('snare', 0.7), 200);
                    setTimeout(() => triggerDrum('hihat', 0.6), 400);
                  }}
                >
                  <h3
                    className={`font-semibold text-sm transition-all duration-300 ${
                      volume === 0 ? 'text-slate-600' : 'text-white'
                    }`}
                  >
                    Drummer {enableWamDrummer && wamDrummer.isReady && <span className="text-[10px] text-green-500 ml-1">(WAM)</span>}
                  </h3>
                  <p
                    className={`text-xs transition-all duration-300 ${
                      volume === 0 ? 'text-slate-600' : 'text-slate-400'
                    }`}
                  >
                    {pattern} | {loadingStatus}
                  </p>
                </div>

                {/* Clickable Indicator */}
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className={`flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800 shadow-[5px_5px_10px_rgba(0,0,0,0.5),-5px_-5px_10px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300 cursor-pointer ${
                    volume === 0 ? 'opacity-50' : ''
                  }`}
                >
                  {/* Compact beat dots in 3x8 grid (3 rows, 8 beats each) */}
                  <div className="grid grid-rows-3 grid-cols-8 gap-1">
                    {/* Hi-hat row */}
                    {patterns.hihat?.map((beat, idx) => (
                      <div
                        key={`hh-${idx}`}
                        className={`w-2 h-2 rounded-full transition-all duration-200 ${
                          currentBeat === idx && isPlaying
                            ? 'bg-orange-200 shadow-lg shadow-orange-200/50'
                            : beat.isActive
                              ? 'bg-orange-500'
                              : 'bg-slate-700'
                        }`}
                      />
                    )) || []}

                    {/* Snare row */}
                    {patterns.snare?.map((beat, idx) => (
                      <div
                        key={`sn-${idx}`}
                        className={`w-2 h-2 rounded-full transition-all duration-200 ${
                          currentBeat === idx && isPlaying
                            ? 'bg-orange-200 shadow-lg shadow-orange-200/50'
                            : beat.isActive
                              ? 'bg-orange-500'
                              : 'bg-slate-700'
                        }`}
                      />
                    )) || []}

                    {/* Kick row */}
                    {patterns.kick?.map((beat, idx) => (
                      <div
                        key={`k-${idx}`}
                        className={`w-2 h-2 rounded-full transition-all duration-200 ${
                          currentBeat === idx && isPlaying
                            ? 'bg-orange-200 shadow-lg shadow-orange-200/50'
                            : beat.isActive
                              ? 'bg-orange-500'
                              : 'bg-slate-700'
                        }`}
                      />
                    )) || []}
                  </div>
                </button>
              </>
            ) : (
              <>
                {/* Settings content - 3 rows of drum patterns */}
                <div className="flex flex-col gap-3 flex-1 justify-center items-center">
                  {/* Drum pattern grid - 3 rows x 8 columns */}
                  <div className="space-y-2">
                    {/* Hi-hat row */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => testDrumSound(5)}
                        className="text-xs font-mono text-orange-400 w-6 hover:text-orange-300"
                        title="Test hihat sound"
                      >
                        HH
                      </button>
                      <div className="grid grid-cols-8 gap-1">
                        {patterns.hihat.map((beat, i) => (
                          <button
                            key={i}
                            onClick={() => toggleHihat(i)}
                            className={`w-4 h-4 rounded-full transition-all duration-200 cursor-pointer hover:scale-110 ${
                              currentBeat === i && isPlaying
                                ? 'bg-orange-300 shadow-lg shadow-orange-300/50'
                                : beat.isActive
                                  ? 'bg-orange-500 shadow-[2px_2px_4px_rgba(0,0,0,0.5),-2px_-2px_4px_rgba(255,255,255,0.1)] hover:bg-orange-400'
                                  : 'bg-slate-700 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] hover:bg-slate-600'
                            }`}
                            title={`${beat.isActive ? 'Remove' : 'Add'} hihat on eighth note ${i + 1}`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Snare row */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => testDrumSound(3)}
                        className="text-xs font-mono text-orange-400 w-6 hover:text-orange-300"
                        title="Test snare sound"
                      >
                        SN
                      </button>
                      <div className="grid grid-cols-8 gap-1">
                        {patterns.snare.map((beat, i) => (
                          <button
                            key={i}
                            onClick={() => toggleSnare(i)}
                            className={`w-4 h-4 rounded-full transition-all duration-200 cursor-pointer hover:scale-110 ${
                              currentBeat === i && isPlaying
                                ? 'bg-orange-300 shadow-lg shadow-orange-300/50'
                                : beat.isActive
                                  ? 'bg-orange-500 shadow-[2px_2px_4px_rgba(0,0,0,0.5),-2px_-2px_4px_rgba(255,255,255,0.1)] hover:bg-orange-400'
                                  : 'bg-slate-700 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] hover:bg-slate-600'
                            }`}
                            title={`${beat.isActive ? 'Remove' : 'Add'} snare on eighth note ${i + 1}`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Kick row */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => testDrumSound(1)}
                        className="text-xs font-mono text-orange-400 w-6 hover:text-orange-300"
                        title="Test kick sound"
                      >
                        K
                      </button>
                      <div className="grid grid-cols-8 gap-1">
                        {patterns.kick.map((beat, i) => (
                          <button
                            key={i}
                            onClick={() => toggleKick(i)}
                            className={`w-4 h-4 rounded-full transition-all duration-200 cursor-pointer hover:scale-110 ${
                              currentBeat === i && isPlaying
                                ? 'bg-orange-300 shadow-lg shadow-orange-300/50'
                                : beat.isActive
                                  ? 'bg-orange-500 shadow-[2px_2px_4px_rgba(0,0,0,0.5),-2px_-2px_4px_rgba(255,255,255,0.1)] hover:bg-orange-400'
                                  : 'bg-slate-700 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] hover:bg-slate-600'
                            }`}
                            title={`${beat.isActive ? 'Remove' : 'Add'} kick on eighth note ${i + 1}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setIsExpanded(false)}
                  className="w-5 h-5 rounded-md bg-slate-800 shadow-[2px_2px_4px_rgba(0,0,0,0.5),-2px_-2px_4px_rgba(255,255,255,0.1)] hover:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] transition-all duration-200 text-slate-400 text-xs flex items-center justify-center ml-4"
                  title="Close settings"
                >
                  ×
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
