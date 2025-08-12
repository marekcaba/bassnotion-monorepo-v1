'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { VolumeKnob } from './VolumeKnob';
import { useSyncContext } from '../../base/SyncProvider';
import { useTransportPosition, isBarStart } from '@/domains/widgets/hooks/useTransportPosition';
import { useTrack } from '@/domains/playback/hooks/useTrack';

const logger = {
  log: (...args: any[]) => console.log('🎹 HarmonyWidgetRealPiano:', ...args),
  error: (...args: any[]) => console.error('🎹 HarmonyWidgetRealPiano Error:', ...args),
};

import type { Exercise } from '@bassnotion/contracts';

interface HarmonyWidgetProps {
  progression: string[];
  isVisible: boolean;
  exercise?: Exercise;
  onProgressionChange: (progression: string[]) => void;
  onToggleVisibility: () => void;
  // REMOVED: isPlaying prop - we get it from sync service
  // REMOVED: onTogglePlay - widgets shouldn't control transport
  chordDurations?: number[]; // Optional: durations in beats for each chord
}

/**
 * HarmonyWidget that loads REAL Salamander piano within 3 seconds
 * Then progressively loads all 5 velocity layers in background
 */
// Track widget instances (replaced by singleton manager)
// let widgetInstanceCount = 0;

export function HarmonyWidgetRealPiano({
  progression,
  isVisible,
  exercise,
  onProgressionChange,
  onToggleVisibility,
  chordDurations,
}: HarmonyWidgetProps) {
  // DIRECT CONNECTION TO TRANSPORT STATE
  const syncResult = useWidgetSync({
    widgetId: 'harmony-widget',
    subscribeTo: ['PLAY', 'STOP', 'PAUSE', 'TEMPO_CHANGE', 'SEEK'],
    debugMode: false,
  });

  // Get transport state directly from sync service
  const isPlaying = syncResult.isPlaying;
  const tempo = syncResult.tempo;
  const isConnected = syncResult.state.isConnected;
  
  // Create refs first (before singleton registration)
  const loadStartTimeRef = useRef<number>(Date.now());
  const toneRef = useRef<typeof import('tone') | null>(null);
  const samplerRef = useRef<any>(null);
  const processorRef = useRef<any>(null); // For full velocity layers
  const currentChordIndexRef = useRef<number>(0);
  
  // Track if this widget is active
  const [isActiveWidget, setIsActiveWidget] = useState(true);
  
  const [widgetInstanceId] = useState(() => {
    return widgetSingleton.register('harmony', () => {
      // Cleanup function will be called by singleton manager
      logger.log('🧹 Singleton cleanup: HarmonyWidget');
      if (samplerRef.current) {
        try {
          samplerRef.current.dispose();
        } catch (error) {
          logger.error('Error disposing sampler:', error);
        }
      }
      if (processorRef.current) {
        try {
          processorRef.current.dispose();
        } catch (error) {
          logger.error('Error disposing processor:', error);
        }
      }
    });
  });
  
  useEffect(() => {
    logger.log(`🆔 Widget instance #${widgetInstanceId} mounted`);
    
    // Listen for singleton cleanup events
    const handleSingletonCleanup = (event: CustomEvent) => {
      const { type, activeId } = event.detail;
      if (type === 'harmony' && activeId !== widgetInstanceId) {
        logger.log(`🚫 HarmonyWidget[${widgetInstanceId}]: Deactivating inactive instance (active: ${activeId})`);
        setIsActiveWidget(false);
      }
    };
    
    window.addEventListener('widget-singleton-cleanup', handleSingletonCleanup as EventListener);
    
    return () => {
      logger.log(`🆔 Widget instance #${widgetInstanceId} unmounting`);
      window.removeEventListener('widget-singleton-cleanup', handleSingletonCleanup as EventListener);
      widgetSingleton.unregister('harmony', widgetInstanceId);
    };
  }, [widgetInstanceId]);
  const [currentChordIndex, setCurrentChordIndex] = useState(-1);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('Loading Salamander...');
  const [isReady, setIsReady] = useState(false);

  // Load REAL Salamander piano samples with progressive enhancement
  useEffect(() => {
    let mounted = true;
    
    // Define handleUpgrade function first so it can be used in cleanup
    let handleUpgrade: ((event: Event) => void) | null = null;
    
    const loadProgressiveSalamander = async () => {
      const startTime = performance.now();
      logger.log('🎹 Starting progressive Salamander loading...');
      
      // Emit loading start event
      window.dispatchEvent(new CustomEvent('widgetLoadStart', { 
        detail: { widget: 'HarmonyWidget' } 
      }));
      
      try {
        // First check BackgroundSampleLoader for preloaded samples
        try {
          const { getBackgroundLoader } = await import('@/domains/playback/services/BackgroundSampleLoader');
          const loader = getBackgroundLoader();
          const preloadedHarmony = loader.getPreloadedSamples('harmony');
          
          if (preloadedHarmony) {
            const status = loader.getSampleStatus('harmony');
            logger.log(`🎉 Using preloaded harmony samples (${status.quality} quality)!`);
            
            // Get Tone instance
            let Tone;
            if ((window as any).Tone) {
              logger.log('Using existing Tone.js instance');
              Tone = (window as any).Tone;
            } else {
              logger.log('Loading new Tone.js instance');
              Tone = await import('tone');
              (window as any).Tone = Tone;
            }
            toneRef.current = Tone;
            
            // Use professional timing settings from central config
            // Don't override the global timing settings here!
            
            // Use the preloaded processor directly
            processorRef.current = preloadedHarmony;
            
            if (!mounted) return;
            
            setIsReady(true);
            const loadTimeMs = Date.now() - loadStartTimeRef.current;
            setLoadingStatus(`✅ Ready (${status.quality} - preloaded)`);
            logger.log(`✅ HarmonyWidget: Using preloaded samples, ready in ${loadTimeMs}ms`);
            
            // Emit loading complete event
            window.dispatchEvent(new CustomEvent('widgetLoadComplete', { 
              detail: { widget: 'HarmonyWidget', message: `Preloaded (${status.quality})` } 
            }));
            
            // Listen for sample upgrades
            handleUpgrade = (event: Event) => {
              const customEvent = event as CustomEvent;
              if (customEvent.detail.instrument === 'harmony') {
                const newSamples = loader.getPreloadedSamples('harmony');
                if (newSamples && newSamples !== processorRef.current) {
                  logger.log(`✨ Upgrading harmony to ${customEvent.detail.quality} quality`);
                  processorRef.current = newSamples;
                  setLoadingStatus(`✅ Ready (${customEvent.detail.quality})`);
                }
              }
            };
            window.addEventListener('samplesUpgraded', handleUpgrade);
            
            return; // Exit early, no need to load samples manually
          }
        } catch (error) {
          logger.log('BackgroundSampleLoader not available, loading samples directly...');
        }
        // 1. Load Tone.js (use existing instance if available)
        let Tone;
        if ((window as any).Tone) {
          logger.log('Using existing Tone.js instance');
          Tone = (window as any).Tone;
        } else {
          logger.log('Loading new Tone.js instance');
          Tone = await import('tone');
          (window as any).Tone = Tone;
        }
        toneRef.current = Tone;
        
        // Log audio context state
        const audioContext = Tone.context.rawContext as AudioContext;
        logger.log(`AudioContext state: ${audioContext.state}, sampleRate: ${audioContext.sampleRate}`);
        
        // Force audio context to running state
        if (audioContext.state === 'suspended') {
          audioContext.resume().catch(() => {});
        }
        
        // Use professional timing settings from central config
        // Don't override the global timing settings here!
        
        // 2. PHASE 1: Extract ONLY the notes needed from the chord progression
        const requiredNotes = new Set<string>();
        progression.forEach(chord => {
          const notes = getChordNotes(chord);
          notes.forEach(note => requiredNotes.add(note));
        });
        
        logger.log('📊 Exercise requires these specific notes:', Array.from(requiredNotes));
        
        // Map to actual Salamander samples - Let Tone.js handle pitch shifting!
        // Salamander has samples at: A, C, D# (Ds in filename), F# (Fs in filename) for each octave
        // Use proper music notation for Tone.js (D# not Ds, F# not Fs)
        const salamanderMapping: Record<string, string> = {
          // Octave 2 - Map to exact notes, let Tone.js interpolate
          'C2': 'C2.mp3',
          'A2': 'A2.mp3',
          'D#2': 'Ds2.mp3',  // D# in Tone.js, but Ds2.mp3 in file system
          'F#2': 'Fs2.mp3',  // F# in Tone.js, but Fs2.mp3 in file system
          
          // Octave 3
          'C3': 'C3.mp3',
          'A3': 'A3.mp3',
          'D#3': 'Ds3.mp3',
          'F#3': 'Fs3.mp3',
          
          // Octave 4
          'C4': 'C4.mp3',
          'A4': 'A4.mp3',
          'D#4': 'Ds4.mp3',
          'F#4': 'Fs4.mp3',
          
          // Octave 5
          'C5': 'C5.mp3',
          'A5': 'A5.mp3',
          'D#5': 'Ds5.mp3',
          'F#5': 'Fs5.mp3',
        };
        
        // Build samples object with actual Salamander samples
        // Tone.js will interpolate for notes that don't have direct samples
        const baseUrl = 'https://htuztkrbuewheehjspcz.supabase.co/storage/v1/object/public/audio-samples/Keyboards/salamander/v9/';
        
        // Only load the actual samples that exist in Salamander
        const urls: Record<string, string> = {};
        Object.entries(salamanderMapping).forEach(([note, file]) => {
          urls[note] = baseUrl + file;
        });
        
        logger.log(`📦 PHASE 1: Loading ${Object.keys(urls).length} core Salamander samples`);
        logger.log('Notes to load:', Object.keys(urls));
        
        // Create the initial sampler with timeout protection
        const samplerPromise = new Promise<any>((resolve, reject) => {
          const loadStartTime = performance.now();
          const sampler = new Tone.Sampler({
            urls,
            onload: () => {
              const loadDuration = ((performance.now() - loadStartTime) / 1000).toFixed(2);
              logger.log(`✅ Phase 1 complete: Essential samples loaded in ${loadDuration}s!`);
              resolve(sampler);
            },
            onerror: (error) => {
              logger.error('Failed to load essential samples:', error);
              reject(error);
            }
          }).toDestination();
          
          sampler.volume.value = -15; // Reduce volume to prevent clipping
          
          // Log progress
          setTimeout(() => {
            logger.log('⏳ Still loading samples... (1s)');
          }, 1000);
          setTimeout(() => {
            logger.log('⏳ Still loading samples... (2s)');
          }, 2000);
        });
        
        // Race against 4-second timeout (slightly longer for Supabase)
        const timeoutPromise = new Promise<null>((resolve) => 
          setTimeout(() => {
            logger.log('⏱️ Phase 1 timeout (4s)');
            resolve(null);
          }, 4000)
        );
        
        const result = await Promise.race([samplerPromise, timeoutPromise]);
        
        if (!mounted) return;
        
        if (result) {
          samplerRef.current = result;
          setIsReady(true);
          const loadTime = ((performance.now() - startTime) / 1000).toFixed(2);
          const loadTimeMs = Date.now() - loadStartTimeRef.current;
          const initialStatus = `✅ Ready (${loadTime}s)`;
          setLoadingStatus(initialStatus);
          logger.log(initialStatus); // Log initial status
          
          // Emit loading complete event
          window.dispatchEvent(new CustomEvent('widgetLoadComplete', { 
            detail: { widget: 'HarmonyWidget', message: `Loaded in ${loadTime}s` } 
          }));
          logger.log(`✅ PHASE 1 COMPLETE: Widget #${widgetInstanceId} ready in ${loadTime}s`);
          logger.log(`✅ HarmonyWidget: Loaded in ${loadTimeMs}ms`);
          logger.log(`🔊 Basic sampler connected to destination`);
          
          // PHASE 2 & 3: Load velocity layers in background progressively
          // This happens AUTOMATICALLY, no need to wait for play!
          logger.log('📦 PHASE 2: Starting background load of 5 velocity layers...');
          loadFullVelocityLayers(startTime);
          
        } else {
          // Timeout - create minimal sampler with just one note
          logger.log('⚠️ Phase 1 timed out, creating minimal sampler with C4 only');
          try {
            const minimalSampler = new Tone.Sampler({
              urls: { 'C4': baseUrl + 'C4.mp3' },
              onload: () => {
                logger.log('✅ Minimal sampler ready with C4');
                if (mounted) {
                  samplerRef.current = minimalSampler;
                  setIsReady(true);
                  setLoadingStatus('⚠️ Ready (minimal - C4 only)');
                }
              },
              onerror: (err) => {
                logger.error('Even minimal sampler failed:', err);
                if (mounted) {
                  setLoadingStatus('❌ Failed to load');
                }
              }
            }); // Don't connect - will be replaced by velocity layers
            
            // minimalSampler.volume.value = -10; // Not needed if not connected
            
            // Still try to load full layers in background
            logger.log('📦 Continuing with background loading despite timeout...');
            loadFullVelocityLayers(startTime);
          } catch (minimalError) {
            logger.error('Failed to create minimal sampler:', minimalError);
            if (mounted) {
              setLoadingStatus('❌ Failed to load');
            }
          }
        }
        
      } catch (error) {
        logger.error('Failed to load Salamander:', error);
        if (!mounted) return;
        setLoadingStatus('❌ Failed to load');
      }
    };
    
    // PHASE 2 & 3: Background loading of velocity layers
    const loadFullVelocityLayers = async (startTime: number) => {
      try {
        logger.log('🎹 PHASE 2 STARTING: Loading 5 key velocity layers...');
        
        // Phase 2: Load 5 key layers for basic velocity response
        const phase2Layers = ['v1', 'v6', 'v10', 'v14', 'v16'];
        
        // Phase 3: Load ALL 16 layers for full professional dynamic range
        const allLayers = [
          'v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8',
          'v9', 'v10', 'v11', 'v12', 'v13', 'v14', 'v15', 'v16'
        ];
        
        // Extract required notes from progression
        const requiredNotes = new Set<string>();
        progression.forEach(chord => {
          const notes = getChordNotes(chord);
          notes.forEach(note => requiredNotes.add(note));
        });
        
        logger.log(`📦 PHASE 2: Loading ${phase2Layers.length} key layers for basic velocity response`);
        
        // Use the same correct mapping for Salamander samples
        const salamanderMapping: Record<string, string> = {
          // Octave 2
          'C2': 'C2.mp3',
          'A2': 'A2.mp3',
          'D#2': 'Ds2.mp3',  // D# in Tone.js, Ds2.mp3 in file system
          'F#2': 'Fs2.mp3',  // F# in Tone.js, Fs2.mp3 in file system
          // Octave 3
          'C3': 'C3.mp3',
          'A3': 'A3.mp3',
          'D#3': 'Ds3.mp3',
          'F#3': 'Fs3.mp3',
          // Octave 4
          'C4': 'C4.mp3',
          'A4': 'A4.mp3',
          'D#4': 'Ds4.mp3',
          'F#4': 'Fs4.mp3',
          // Octave 5
          'C5': 'C5.mp3',
          'A5': 'A5.mp3',
          'D#5': 'Ds5.mp3',
          'F#5': 'Fs5.mp3',
        };
        
        // Store samplers for each velocity layer
        const velocitySamplers: Record<string, any> = {};
        
        // PHASE 2: Load 5 key layers
        let phase2LoadedCount = 0;
        const phase2Start = performance.now();
        
        for (const layer of phase2Layers) {
          // Skip v9 since we already loaded it in Phase 1
          if (layer === 'v9') continue;
          
          try {
            const layerStart = performance.now();
            logger.log(`⏳ PHASE 2: Loading layer ${layer} (${phase2LoadedCount + 1}/${phase2Layers.length})...`);
            
            // Create URLs for this layer
            const urls: Record<string, string> = {};
            Object.entries(salamanderMapping).forEach(([note, file]) => {
              urls[note] = `https://htuztkrbuewheehjspcz.supabase.co/storage/v1/object/public/audio-samples/Keyboards/salamander/${layer}/${file}`;
            });
            
            // Create sampler for this layer
            const layerSampler = new toneRef.current.Sampler({
              urls,
              volume: -15, // Reduce volume to prevent clipping
              onload: () => {
                const layerTime = ((performance.now() - layerStart) / 1000).toFixed(2);
                phase2LoadedCount++;
                velocitySamplers[layer] = layerSampler;
                logger.log(`✅ Layer ${layer} loaded (${phase2LoadedCount}/${phase2Layers.length}) in ${layerTime}s`);
                
                // Update status
                setLoadingStatus(prev => {
                  if (prev.includes('Ready')) {
                    if (phase2LoadedCount === phase2Layers.length) {
                      const status = `✅ Ready (5 velocity layers)`;
                      logger.log(status); // Log to console for test page
                      return status;
                    }
                    const status = `✅ Ready (${phase2LoadedCount}/5 layers)`;
                    logger.log(status); // Log to console for test page
                    return status;
                  }
                  return prev;
                });
              },
              onerror: (err) => {
                logger.warn(`⚠️ Layer ${layer} failed:`, err);
              }
            }); // Don't connect to destination yet - only connect the active one
            
            // Wait for this layer to load
            await layerSampler.loaded;
            
            // Use the v10 (mezzo-forte) as the main processor after Phase 2
            if (layer === 'v10') {
              logger.log('🎹 Setting v10 as active processor');
              
              // CRITICAL FIX: Set the new processor BEFORE disconnecting the old one
              // This ensures there's always an audio source available
              processorRef.current = layerSampler;
              layerSampler.volume.value = -15; // Reduce volume
              layerSampler.toDestination();
              logger.log('✅ v10 layer connected as main processor');
              
              // NOW disconnect the basic sampler after the new one is ready
              if (samplerRef.current) {
                logger.log('🔇 Disconnecting and disposing basic sampler...');
                try {
                  samplerRef.current.disconnect();
                  samplerRef.current.dispose();
                  samplerRef.current = null;
                } catch (e) {
                  logger.error('Error disconnecting basic sampler:', e);
                }
              }
            }
            
          } catch (layerError) {
            logger.warn(`⚠️ Failed to load layer ${layer}:`, layerError);
          }
        }
        
        const phase2Time = ((performance.now() - phase2Start) / 1000).toFixed(2);
        logger.log(`✅ PHASE 2 COMPLETE: ${phase2LoadedCount} layers loaded in ${phase2Time}s`);
        
        // PHASE 3: Load remaining layers (11 more to reach all 16)
        logger.log('📦 PHASE 3 STARTING: Loading remaining velocity layers for full dynamic range...');
        const phase3Start = performance.now();
        const remainingLayers = allLayers.filter(l => !phase2Layers.includes(l) && l !== 'v9'); // Exclude already loaded
        let phase3LoadedCount = 0;
        
        for (const layer of remainingLayers) {
          try {
            const layerStart = performance.now();
            logger.log(`⏳ PHASE 3: Loading layer ${layer} (${phase3LoadedCount + 1}/${remainingLayers.length})...`);
            
            // Create URLs for this layer
            const urls: Record<string, string> = {};
            Object.entries(salamanderMapping).forEach(([note, file]) => {
              urls[note] = `https://htuztkrbuewheehjspcz.supabase.co/storage/v1/object/public/audio-samples/Keyboards/salamander/${layer}/${file}`;
            });
            
            // Create sampler for this layer
            const layerSampler = new toneRef.current.Sampler({
              urls,
              volume: -15, // Reduce volume to prevent clipping
              onload: () => {
                const layerTime = ((performance.now() - layerStart) / 1000).toFixed(2);
                phase3LoadedCount++;
                velocitySamplers[layer] = layerSampler;
                logger.log(`✅ Layer ${layer} loaded (${phase3LoadedCount}/${remainingLayers.length}) in ${layerTime}s`);
                
                // Update status
                const totalLoaded = phase2LoadedCount + phase3LoadedCount + 1; // +1 for v9 from Phase 1
                const status = `✅ Ready (${totalLoaded}/16 velocity layers)`;
                logger.log(status); // Log to console for test page
                setLoadingStatus(status);
              },
              onerror: (err) => {
                logger.warn(`⚠️ Layer ${layer} failed:`, err);
              }
            }); // Don't connect to destination yet - only connect the active one
            
            // Wait for this layer to load
            await layerSampler.loaded;
            
          } catch (layerError) {
            logger.warn(`⚠️ Failed to load layer ${layer}:`, layerError);
          }
        }
        
        const phase3Time = ((performance.now() - phase3Start) / 1000).toFixed(2);
        const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);
        const totalLoaded = phase2LoadedCount + phase3LoadedCount + 1; // +1 for v9
        
        logger.log(`✅ PHASE 3 COMPLETE: ${phase3LoadedCount} additional layers loaded in ${phase3Time}s`);
        logger.log(`🎹 ALL PHASES COMPLETE: ${totalLoaded}/16 velocity layers loaded in total ${totalTime}s`);
        const finalStatus = `✅ Ready (Full Salamander - 16 layers)`;
        logger.log(finalStatus); // Log to console for test page
        setLoadingStatus(finalStatus);
        
      } catch (error) {
        logger.error('❌ PHASE 2 FAILED:', error);
        // Not critical - we still have the basic sampler working
      }
    };
    
    loadProgressiveSalamander();
    
    return () => {
      mounted = false;
      // Remove event listener if we were using preloaded samples
      if (handleUpgrade) {
        window.removeEventListener('samplesUpgraded', handleUpgrade);
      }
      
      if (samplerRef.current && typeof samplerRef.current.dispose === 'function') {
        samplerRef.current.dispose();
      }
      // Don't dispose preloaded processor - it's shared
      if (processorRef.current && typeof processorRef.current.dispose === 'function' && !processorRef.current._isPreloaded) {
        processorRef.current.dispose();
      }
    };
  }, [progression]); // Reload when progression changes to load new notes

  // React to tempo changes from transport
  useEffect(() => {
    if (!toneRef.current || !isConnected) return;
    
    const Tone = toneRef.current;
    if (Tone.Transport.bpm.value !== tempo) {
      logger.log(`📊 Updating tempo from ${Tone.Transport.bpm.value} to ${tempo}`);
      Tone.Transport.bpm.value = tempo;
    }
  }, [tempo, isConnected]);

  // Track last played bar to prevent duplicate triggers
  const lastPlayedBarRef = useRef<number>(-1);
  
  // Direct EventBus subscription for timing-critical audio
  useTransportPosition({
    onPositionUpdate: useCallback((position) => {
      if (!toneRef.current || !isReady || !isPlaying || !isActiveWidget) return;
      
      const Tone = toneRef.current;
      const audioSource = processorRef.current || samplerRef.current;
      if (!audioSource) return;
      
      // Use exercise chord progression if available
      const actualProgression = exercise?.chord_progression || progression;
      const actualDurations = exercise?.chord_durations || chordDurations;
      
      if (!actualProgression || actualProgression.length === 0) return;
      
      // Only trigger on bar starts (when beats and sixteenths are 0)
      if (!isBarStart(position)) return;
      
      // Prevent playing the same bar multiple times
      if (position.bars === lastPlayedBarRef.current) return;
      lastPlayedBarRef.current = position.bars;
      
      // Calculate which chord to play based on bar number
      const chordIndex = position.bars % actualProgression.length;
      const chord = actualProgression[chordIndex];
      
      // Update UI state
      setCurrentChordIndex(chordIndex);
      
      // Get duration for this chord (default to 4 beats if not specified)
      const chordBeats = actualDurations?.[chordIndex] || 4;
      const duration = chordBeats === 4 ? '1n' : // whole note
                      chordBeats === 2 ? '2n' : // half note
                      chordBeats === 1 ? '4n' : // quarter note
                      `${chordBeats * 4}n`; // generic conversion
      
      // Use moderate velocity for all notes
      const velocity = 0.5;
      const now = Tone.now();
      
      // Use full velocity sampler if available, otherwise basic sampler
      if (processorRef.current) {
        if (processorRef.current.playChord && typeof processorRef.current.playChord === 'function') {
          // It's a ChordInstrumentProcessor - use its playChord method
          processorRef.current.playChord(chord, now, velocity);
        } else if (typeof processorRef.current.triggerAttackRelease === 'function') {
          // It's a basic sampler with triggerAttackRelease
          const notes = getChordNotes(chord);
          processorRef.current.triggerAttackRelease(notes, duration, now, velocity);
        }
      } else if (samplerRef.current) {
        // Basic sampler fallback
        playChord(chord, now, duration);
      }
      
      logger.log(`🎵 Playing chord ${chord} at bar ${position.bars}`);
    }, [isPlaying, isActiveWidget, isReady, progression, chordDurations, exercise]),
    enabled: isPlaying && isActiveWidget && isReady && isConnected
  });
  
  // Handle play/stop state changes
  useEffect(() => {
    if (!isActiveWidget) {
      logger.log(`⚠️ Widget ${widgetInstanceId} is not active, ignoring state change`);
      return;
    }
    
    if (isPlaying && progression.length > 0) {
      logger.log(`🎵 HarmonyWidget[${widgetInstanceId}]: Started event-driven playback`);
      const audioSource = processorRef.current || samplerRef.current;
      const layerInfo = processorRef.current ? 'with 5 velocity layers' : 'with basic sampler';
      logger.log(`Using ${layerInfo}`, audioSource?.constructor?.name || 'unknown source');
    } else {
      logger.log(`⏹️ HarmonyWidget[${widgetInstanceId}]: Stopped event-driven playback`);
      setCurrentChordIndex(-1);
      lastPlayedBarRef.current = -1; // Reset last played bar
      
      // Stop all sounds immediately
      if (processorRef.current) {
        if (typeof processorRef.current.stopAll === 'function') {
          processorRef.current.stopAll();
        }
        if (typeof processorRef.current.releaseAll === 'function') {
          processorRef.current.releaseAll();
        }
      }
      
      // Stop basic sampler
      if (samplerRef.current && typeof samplerRef.current.releaseAll === 'function') {
        samplerRef.current.releaseAll();
      }
    }
  }, [isPlaying, isActiveWidget, widgetInstanceId]);

  const playChord = (chord: string, time?: number, duration: string = '1n') => {
    if (!samplerRef.current) return;
    
    const notes = getChordNotes(chord);
    // Use dynamic duration based on chord_durations (default to whole note '1n')
    samplerRef.current.triggerAttackRelease(notes, duration, time);
  };

  // Manual test
  const testChord = async (chord: string) => {
    if (!toneRef.current || (!samplerRef.current && !processorRef.current)) {
      logger.log('Cannot test - not ready');
      return;
    }
    
    const Tone = toneRef.current;
    const audioContext = Tone.context.rawContext as AudioContext;
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    
    // Use full velocity sampler if available, otherwise basic sampler
    if (processorRef.current) {
      // Check if it's a ChordInstrumentProcessor (preloaded)
      if (processorRef.current.playChord && typeof processorRef.current.playChord === 'function') {
        logger.log(`Testing chord: ${chord} with ChordInstrumentProcessor`);
        processorRef.current.playChord(chord, undefined, 0.5);
      } else if (typeof processorRef.current.triggerAttackRelease === 'function') {
        logger.log(`Testing chord: ${chord} with full 5 velocity layers`);
        const notes = getChordNotes(chord);
        processorRef.current.triggerAttackRelease(notes, '1n', undefined, 0.5); // Use 0-1 range
      }
    } else if (samplerRef.current) {
      logger.log(`Testing chord: ${chord} with basic sampler`);
      playChord(chord);
    }
  };

  // Volume control
  useEffect(() => {
    // Set volume for basic sampler
    if (samplerRef.current && samplerRef.current.volume) {
      const volumeValue = isMuted ? -Infinity : -30 + (volume * 0.3);
      samplerRef.current.volume.value = volumeValue;
    }
    
    // Set volume for full velocity sampler (if loaded)
    if (processorRef.current) {
      // SalamanderVelocitySampler doesn't have a direct setVolume method
      // Volume is controlled via velocity parameter when playing
      // We could add mechanical volume control if needed
    }
  }, [volume, isMuted]);

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
    >
      <div className="flex items-center justify-between h-full">
        <div className="flex justify-center items-center w-20 h-16">
          <VolumeKnob
            value={volume}
            onChange={setVolume}
            color="bg-purple-400"
            size={45}
            isMuted={isMuted}
            onMuteToggle={() => setIsMuted(!isMuted)}
          />
        </div>

        <div className="flex-1 px-4">
          <h3 className={`font-semibold text-sm ${volume === 0 ? 'text-slate-600' : 'text-white'}`}>
            Harmony (Salamander Piano)
          </h3>
          <p className={`text-xs ${volume === 0 ? 'text-slate-600' : 'text-slate-400'}`}>
            {loadingStatus} | {progression.length} chords
          </p>
          
          <div className="flex gap-2 mt-1">
            {progression.slice(0, 8).map((chord, i) => (
              <button
                key={i}
                onClick={() => testChord(chord)}
                disabled={!isReady}
                className={`text-xs px-2 py-1 rounded transition-all ${
                  !isReady 
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : currentChordIndex === i && isPlaying
                    ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/50'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {chord}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to get chord notes
function getChordNotes(chord: string): string[] {
  const chordMap: Record<string, string[]> = {
    'C': ['C3', 'E3', 'G3', 'C4'],
    'Am': ['A2', 'C3', 'E3', 'A3'],
    'F': ['F2', 'A2', 'C3', 'F3'],
    'G': ['G2', 'B2', 'D3', 'G3'],
    'Dm': ['D3', 'F3', 'A3'],
    'Em': ['E3', 'G3', 'B3'],
    'Bb': ['Bb2', 'D3', 'F3'],
    'A': ['A2', 'C#3', 'E3'],
    'D': ['D3', 'F#3', 'A3'],
    'E': ['E3', 'G#3', 'B3'],
    'Bm': ['B2', 'D3', 'F#3'],
    'F#m': ['F#3', 'A3', 'C#4'],
  };
  
  return chordMap[chord] || ['C3', 'E3', 'G3'];
}