'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { VolumeKnob } from './VolumeKnob';
import { useSyncContext } from '../../base/SyncProvider';
import { useTrack } from '@/domains/playback/hooks/useTrack';
import type { MetronomePattern, MetronomePatternEvent } from '@/domains/playback/types/pattern';
import { toMusicalPosition as toPosition } from '@/domains/playback/types/pattern';

interface MetronomeWidgetProps {
  bpm: number;
  isVisible: boolean;
  onBpmChange: (bpm: number) => void;
  onToggleVisibility: () => void;
  // REMOVED: isPlaying prop - we get it from sync service
  // REMOVED: onTogglePlay - widgets shouldn't control transport
}

interface MetronomeDot {
  id: number;
  isActive: boolean;
  isCurrent: boolean;
}

const initialDots: MetronomeDot[] = Array.from({ length: 8 }, (_, i) => ({
  id: i, // 0-based indexing to match Tone.js
  isActive: i < 4, // First 4 dots are active for compact view
  isCurrent: i === 0, // First dot is current
}));

const logger = {
  log: (...args: any[]) => console.log('🎼 MetronomeWidget:', ...args),
  error: (...args: any[]) => console.error('🎼 MetronomeWidget Error:', ...args),
};

export function MetronomeWidget({
  bpm,
  isVisible,
  onBpmChange,
  onToggleVisibility,
}: MetronomeWidgetProps) {
  // Hook for reporting beat timing - commented out as it's not imported
  // const { reportBeat } = useBeatTimingReport('metronome');
  
  // DIRECT CONNECTION TO TRANSPORT STATE
  const syncResult = useWidgetSync({
    widgetId: 'metronome-widget',
    subscribeTo: ['PLAY', 'STOP', 'PAUSE', 'TEMPO_CHANGE', 'SEEK'],
    debugMode: false,
  });

  // Get transport state directly from sync service
  const isPlaying = syncResult.isPlaying;
  const syncTempo = syncResult.tempo;
  const isConnected = syncResult.state.isConnected;
  
  const [metronomeDots, setMetronomeDots] = useState(initialDots);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [beats, setBeats] = useState(4);
  const [noteValue, setNoteValue] = useState(4);
  const [mutedBeats, setMutedBeats] = useState<Set<number>>(new Set());
  const [polyrhythmEnabled, setPolyrhythmEnabled] = useState(false);
  const [polyrhythmRatio, setPolyrhythmRatio] = useState({
    main: 4,
    poly: 3,
  });
  
  // Store Tone.js reference (must be declared before singleton registration)
  const toneRef = useRef<typeof import('tone') | null>(null);
  const toneLoaded = useRef(false);
  
  // Metronome synth for click sounds (must be declared before singleton registration)
  const metronomeSynthRef = useRef<any | null>(null);
  const accentSynthRef = useRef<any | null>(null);
  
  // Note: We don't need to track isActiveWidget state here since
  // usePatternRegistration handles singleton validation internally
  
  // Widget singleton management
  const [widgetInstanceId] = useState(() => {
    return widgetSingleton.register('metronome', () => {
      // Cleanup function will be called by singleton manager
      logger.log('🧹 Singleton cleanup: Metronome widget');
      if (metronomeSynthRef.current) {
        try {
          metronomeSynthRef.current.dispose();
        } catch (error) {
          logger.error('Error disposing metronome synth:', error);
        }
      }
      if (accentSynthRef.current) {
        try {
          accentSynthRef.current.dispose();
        } catch (error) {
          logger.error('Error disposing accent synth:', error);
        }
      }
    });
  });
  
  // Refs for mute and volume to avoid stale closures
  const isMutedRef = useRef(isMuted);
  const volumeRef = useRef(volume);
  const beatsRef = useRef(beats);
  const mutedBeatsRef = useRef(mutedBeats);
  
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);
  
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);
  
  useEffect(() => {
    beatsRef.current = beats;
  }, [beats]);
  
  useEffect(() => {
    mutedBeatsRef.current = mutedBeats;
  }, [mutedBeats]);

  // Initialize Tone.js - retry until available
  useEffect(() => {
    const initializeTone = async () => {
      if (toneLoaded.current || toneRef.current) return;
      
      try {
        // Try to get Tone from CoreServices first
        const coreServices = (window as any).__coreServices || (window as any).__globalCoreServices;
        if (coreServices && typeof coreServices.getAudioEngine === 'function') {
          const audioEngine = coreServices.getAudioEngine();
          if (audioEngine && typeof audioEngine.getTone === 'function') {
            try {
              toneRef.current = audioEngine.getTone();
              logger.log('Got Tone.js from CoreServices');
              toneLoaded.current = true;
              await initializeSynths();
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
        logger.error('Failed to initialize Tone.js:', error);
        // Retry after a short delay
        setTimeout(() => {
          if (!toneLoaded.current) {
            logger.log('Retrying Tone.js initialization...');
            initializeTone();
          }
        }, 1000);
      }
    };
    
    initializeTone();
  }, []);

  const initializeSynths = async () => {
    if (!toneRef.current) return;
    
    const Tone = toneRef.current;
    
    try {
      // Create metronome synths with short, percussive sounds
      metronomeSynthRef.current = new Tone.MembraneSynth({
        pitchDecay: 0.008,
        octaves: 2,
        oscillator: { type: 'sine' },
        envelope: {
          attack: 0.001,
          decay: 0.05,
          sustain: 0,
          release: 0.01,
        },
      }).toDestination();

      accentSynthRef.current = new Tone.MembraneSynth({
        pitchDecay: 0.008,
        octaves: 2,
        oscillator: { type: 'sine' },
        envelope: {
          attack: 0.001,
          decay: 0.08,
          sustain: 0,
          release: 0.02,
        },
      }).toDestination();

      logger.log('✅ Synths initialized');
    } catch (error) {
      logger.error('Failed to initialize metronome synths:', error);
    }
  };

  // Update tempo when sync tempo changes
  useEffect(() => {
    if (syncTempo !== bpm) {
      onBpmChange(syncTempo);
    }
  }, [syncTempo, bpm, onBpmChange]);

  // React to tempo changes from transport
  useEffect(() => {
    if (!toneRef.current || !isConnected) return;
    
    const Tone = toneRef.current;
    if (Tone.Transport.bpm.value !== syncTempo) {
      logger.log(`📊 Updating tempo from ${Tone.Transport.bpm.value} to ${syncTempo}`);
      Tone.Transport.bpm.value = syncTempo;
    }
  }, [syncTempo, isConnected]);

  // Track if pattern is registered
  const patternRegisteredRef = useRef<boolean>(false);

  // Hook for pattern registration with transport
  const { registerPattern, updatePattern, setEnabled } = usePatternRegistration({
    widgetId: widgetInstanceId,
    widgetType: 'metronome',
    enabled: !isMuted
  });
  
  // Update pattern enable state when mute changes
  useEffect(() => {
    if (patternRegisteredRef.current) {
      try {
        setEnabled(!isMuted);
        logger.log(`🎼 MetronomeWidget[${widgetInstanceId}]: Pattern enabled = ${!isMuted}`);
      } catch (error) {
        logger.error(`❌ MetronomeWidget[${widgetInstanceId}]: Failed to set enabled:`, error);
        patternRegisteredRef.current = false;
      }
    } else {
      logger.log(`⚠️ MetronomeWidget[${widgetInstanceId}]: Skipping setEnabled - pattern not registered`);
    }
  }, [isMuted, setEnabled, widgetInstanceId]);
  
  // Create metronome pattern
  const createMetronomePattern = useCallback((): MetronomePattern => {
    const events: MetronomePatternEvent[] = [];
    const { numerator } = beats <= 8 ? { numerator: beats } : { numerator: 4 };
    
    // Create events for each beat in the time signature
    for (let beat = 0; beat < numerator; beat++) {
      events.push({
        position: toPosition(0, beat, 0),
        type: beat === 0 ? 'accent' : 'click',
        pitch: beat === 0 ? 'C5' : 'C4',
        velocity: beat === 0 ? 0.8 : 0.6,
        duration: '32n'
      });
    }
    
    return {
      id: `metronome-${widgetInstanceId}`,
      events,
      timeSignature: { numerator, denominator: noteValue }
    };
  }, [widgetInstanceId, beats, noteValue]);
  
  // Pattern trigger callback - called by transport at exact timing
  const handlePatternTrigger = useCallback((event: MetronomePatternEvent, time: number) => {
    if (!toneRef.current || !metronomeSynthRef.current || !accentSynthRef.current) return;
    
    const Tone = toneRef.current;
    const synth = event.type === 'accent' ? accentSynthRef.current : metronomeSynthRef.current;
    
    try {
      // Apply volume
      const actualVolume = (volumeRef.current / 100) * event.velocity;
      const dbVolume = Tone.gainToDb(actualVolume);
      synth.volume.value = dbVolume;
      
      // Trigger at exact time
      synth.triggerAttackRelease(event.pitch || 'C4', event.duration || '32n', time);
      
      logger.log(`🎼 Metronome ${event.type} at ${event.position}`);
    } catch (error) {
      logger.error(`❌ Error triggering metronome:`, error);
    }
  }, []);
  
  // Register pattern when initialized - only for active widget instances
  useEffect(() => {
    if (!toneRef.current || !metronomeSynthRef.current || !accentSynthRef.current) return;
    
    // Pattern registration handles singleton validation internally
    logger.log(`🎼 MetronomeWidget[${widgetInstanceId}]: Attempting pattern registration`);
    
    const pattern = createMetronomePattern();
    
    if (!patternRegisteredRef.current) {
      const registrationSucceeded = registerPattern(pattern, handlePatternTrigger);
      patternRegisteredRef.current = registrationSucceeded;
      
      if (registrationSucceeded) {
        logger.log(`✅ MetronomeWidget[${widgetInstanceId}]: Pattern registered with transport`);
      } else {
        logger.error(`❌ MetronomeWidget[${widgetInstanceId}]: Pattern registration failed - widget may not be active`);
      }
    } else {
      // Update pattern if beats or time signature changed
      updatePattern(pattern);
      logger.log(`🎼 MetronomeWidget[${widgetInstanceId}]: Pattern updated`);
    }
    
    return () => {
      patternRegisteredRef.current = false;
    };
  }, [createMetronomePattern, registerPattern, updatePattern, handlePatternTrigger, beats, noteValue, widgetInstanceId]);
  
  // Handle play/stop state changes and visual updates
  useEffect(() => {
    
    if (isPlaying) {
      logger.log('🎵 MetronomeWidget: Transport started - pattern will play');
      
      // Simple visual update based on tempo
      let currentBeat = 0;
      const beatDuration = 60000 / bpm; // ms per beat
      
      const visualInterval = setInterval(() => {
        setMetronomeDots(prev =>
          prev.map((dot, index) => ({
            ...dot,
            isCurrent: index === currentBeat,
          }))
        );
        currentBeat = (currentBeat + 1) % beats;
      }, beatDuration);
      
      return () => clearInterval(visualInterval);
    } else {
      logger.log('⏹️ MetronomeWidget: Transport stopped');
      // Reset visual
      setMetronomeDots(initialDots);
    }
  }, [isPlaying, widgetInstanceId, bpm, beats]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (metronomeSynthRef.current) {
        metronomeSynthRef.current.dispose();
      }
      if (accentSynthRef.current) {
        accentSynthRef.current.dispose();
      }
    };
  }, []);

  const testClick = async () => {
    if (!toneRef.current || !metronomeSynthRef.current) return;
    
    const Tone = toneRef.current;
    const audioContext = Tone.context.rawContext as AudioContext;
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    
    const dbVolume = Tone.gainToDb(volume / 100);
    metronomeSynthRef.current.volume.value = dbVolume;
    metronomeSynthRef.current.triggerAttackRelease('C4', '32n');
  };

  const toggleBeat = (beatNumber: number) => {
    setMutedBeats(prev => {
      const newSet = new Set(prev);
      if (newSet.has(beatNumber)) {
        newSet.delete(beatNumber);
      } else {
        newSet.add(beatNumber);
      }
      return newSet;
    });
  };

  const handleBpmWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -1 : 1;
    const newBpm = Math.max(40, Math.min(300, bpm + delta));
    onBpmChange(newBpm);
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
    >
      <div className="flex items-center justify-between h-full">
        {/* Volume Knob */}
        <div className="flex justify-center items-center w-20 h-16">
          <VolumeKnob
            value={volume}
            onChange={setVolume}
            color="bg-green-400"
            size={45}
            isMuted={isMuted}
            onMuteToggle={() => setIsMuted(!isMuted)}
          />
        </div>

        {/* Title/Subtitle OR Settings Panel */}
        <div className="flex-1">
          <div className="flex items-center justify-between px-4 py-2">
            {!isExpanded ? (
              <>
                <div className="flex-1">
                  <h3 className={`font-semibold text-sm ${volume === 0 ? 'text-slate-600' : 'text-white'}`}>
                    Metronome
                  </h3>
                  <p className={`text-xs ${volume === 0 ? 'text-slate-600' : 'text-slate-400'}`}>
                    {bpm} BPM | {beats}/{noteValue}
                  </p>
                </div>

                <button
                  onClick={() => setIsExpanded(true)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-800 shadow-[5px_5px_10px_rgba(0,0,0,0.5),-5px_-5px_10px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300 cursor-pointer ${
                    volume === 0 ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex gap-1">
                    {metronomeDots.slice(0, beats).map((dot) => (
                      <div
                        key={dot.id}
                        className={`w-3 h-3 rounded-full transition-all duration-200 ${
                          dot.isCurrent && isPlaying
                            ? 'bg-green-400 shadow-lg shadow-green-400/50'
                            : mutedBeats.has(dot.id + 1) // Convert 0-based dot.id to 1-based for mutedBeats
                            ? 'bg-slate-700'
                            : 'bg-green-500'
                        }`}
                      />
                    ))}
                  </div>
                  <span
                    className={`text-lg font-bold ${volume === 0 ? 'text-slate-600' : 'text-green-400'} min-w-[3rem] text-right`}
                    onWheel={handleBpmWheel}
                  >
                    {bpm}
                  </span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-4 w-full">
                <div className="flex-1">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-12">BPM:</span>
                      <input
                        type="range"
                        min="40"
                        max="300"
                        value={bpm}
                        onChange={(e) => onBpmChange(Number(e.target.value))}
                        className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="text-xs text-green-400 font-bold w-10 text-right">
                        {bpm}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-12">Beats:</span>
                      <div className="flex gap-1">
                        {Array.from({ length: 8 }, (_, i) => i + 1).map((beat) => (
                          <button
                            key={beat}
                            onClick={() => {
                              if (beat <= beats) {
                                toggleBeat(beat);
                              } else {
                                setBeats(beat);
                              }
                            }}
                            className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center transition-all ${
                              beat <= beats
                                ? mutedBeats.has(beat)
                                  ? 'bg-slate-700 text-slate-500'
                                  : 'bg-green-500 text-slate-900'
                                : 'bg-slate-800 text-slate-600 hover:bg-slate-700'
                            }`}
                          >
                            {beat === 1 ? '!' : ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={testClick}
                    className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-500 transition-colors"
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
    </div>
  );
}