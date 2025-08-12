'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { UsePlaybackIntegrationReturn } from '@/domains/widgets/hooks/usePlaybackIntegration';
import { useWidgetAudioRegistration } from '@/domains/widgets/hooks/useWidgetAudioRegistration';
import { SyncedWidget } from '@/domains/widgets/components/base';
import type { SyncedWidgetRenderProps } from '@/domains/widgets/components/base';
import { VolumeKnob } from '@/domains/widgets/components/YouTubeWidgetPage/components/VolumeKnob';
import { supabase } from '@/infrastructure/supabase/client';
import { scheduleTransportSync } from '@/domains/widgets/utils/transportSync';
import { useBeatTimingReport } from '@/domains/widgets/hooks/useBeatTimingReport';

interface EnhancedMetronomeWidgetProps {
  bpm: number;
  isPlaying: boolean;
  isVisible: boolean;
  onTogglePlay: () => void;
  onBpmChange: (bpm: number) => void;
  onToggleVisibility: () => void;
  onBeatCallback?: (beat: number) => void;
  playbackIntegration?: UsePlaybackIntegrationReturn;
}

interface MetronomeDot {
  id: number;
  isActive: boolean;
  isCurrent: boolean;
}

const initialDots: MetronomeDot[] = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1,
  isActive: i < 4,
  isCurrent: i === 0,
}));

// Component for the inner content to prevent re-registration
function EnhancedMetronomeContent({
  bpm,
  isPlaying,
  onTogglePlay,
  onBpmChange,
  onBeatCallback,
  playbackIntegration,
  syncProps,
}: {
  bpm: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onBpmChange: (bpm: number) => void;
  onBeatCallback?: (beat: number) => void;
  playbackIntegration?: UsePlaybackIntegrationReturn;
  syncProps: SyncedWidgetRenderProps;
}) {
  const [metronomeDots, setMetronomeDots] = useState(initialDots);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [beats, setBeats] = useState(4);
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [toneReady, setToneReady] = useState(false);
  const loadStartTimeRef = useRef<number>(Date.now());

  // Store Tone module after lazy loading
  const toneRef = useRef<typeof import('tone') | null>(null);

  // Hook for reporting beat timing
  const { reportBeat } = useBeatTimingReport('metronome');

  // Store volume and mute in refs to avoid re-scheduling
  const volumeRef = useRef(volume);
  const isMutedRef = useRef(isMuted);
  
  // Update refs when values change
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);
  
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);
  
  // Stable audio config to prevent re-registration
  const audioConfig = useMemo(
    () => ({
      type: 'metronome' as const,
      volume: volume / 100,
      pan: 0,
      muted: isMuted,
      solo: false,
    }),
    [volume, isMuted],
  );

  // Audio registration - moved outside render prop
  const { controls: audioControls } = useWidgetAudioRegistration({
    widgetId: 'enhanced-metronome-widget',
    widgetType: 'metronome',
    displayName: 'Enhanced Metronome',
    audioConfig,
    autoRegister: true,
  });

  // Tone.js references
  const transportEventRef = useRef<number | null>(null); // For Transport.scheduleRepeat
  const synthRef = useRef<any | null>(null);
  const samplerRef = useRef<any | null>(null); // For metronome samples
  const accentSamplerRef = useRef<any | null>(null); // For accent samples
  const [samplesLoaded, setSamplesLoaded] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('Loading metronome...');

  // Use synchronized state
  const currentTempo =
    syncProps.tempo || playbackIntegration?.state.tempo || bpm;
  const isEnginePlay =
    syncProps.isPlaying || playbackIntegration?.state.isPlaying || isPlaying;

  // Initialize Tone.js on mount
  useEffect(() => {
    const initializeTone = async () => {
      if (!toneReady && !toneRef.current) {
        try {
          console.log('🎵 Enhanced Metronome: Getting Tone.js from CoreServices...');
          
          // Wait for CoreServices to be available
          let attempts = 0;
          while (!(window as any).__coreServices && attempts < 30) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
          }
          
          const coreServices = (window as any).__coreServices;
          if (coreServices) {
            const audioEngine = coreServices.getAudioEngine();
            if (audioEngine) {
              toneRef.current = audioEngine.getTone();
              console.log('🎵 Enhanced Metronome: Got Tone.js from CoreServices');
            }
          }
          
          // Fallback if CoreServices not available
          if (!toneRef.current) {
            console.log('🎵 Enhanced Metronome: CoreServices not ready, loading Tone.js directly');
            const Tone = await import('tone');
            toneRef.current = Tone;
            // Apply timing config immediately
            const { applyTransportTimingConfig } = await import('@/domains/playback/config/transportTiming');
            applyTransportTimingConfig(Tone);
          }
          
          // Try to start audio context (may be suspended until user interaction)
          const audioContext = toneRef.current.context.rawContext as AudioContext;
          if (audioContext.state === 'suspended') {
            audioContext.resume().catch(() => {
              console.log('🎵 Enhanced Metronome: Audio context suspended until user interaction');
            });
          }
          
          // Set low latency hint for better sync
          toneRef.current.context.lookAhead = 0.01; // Reduce lookahead for tighter sync
          toneRef.current.context.updateInterval = 0.01; // Update more frequently
          
          setToneReady(true);
          console.log('🎵 Enhanced Metronome: Tone.js ready, context state:', audioContext.state);
        } catch (error) {
          console.error('🎵 Enhanced Metronome: Failed to load Tone.js:', error);
        }
      }
    };

    initializeTone();
  }, []);

  // Load metronome samples from Supabase
  useEffect(() => {
    if (!toneRef.current || !toneReady) return;
    
    const Tone = toneRef.current;

    const loadMetronomeSamples = async () => {
      try {
        if (Tone.context.state === 'closed') {
          console.warn('🎵 Enhanced Metronome: Context is closed');
          return;
        }
        
        // Resume context if suspended
        if (Tone.context.state === 'suspended') {
          console.log('🎵 Enhanced Metronome: Context suspended, will load anyway');
          // Try to resume but don't wait - samples can still load
          Tone.context.resume().catch(() => {});
        }

        console.log('🎵 Enhanced Metronome: Loading samples from Supabase...');
        setLoadingStatus('Loading metronome samples...');

        // Define sample paths in Supabase
        const metronomePath = 'metronome/Clicks_01.mp3';
        const accentPath = 'metronome/Clicks_01.mp3'; // Use same sample for both, just louder for accent
        
        // Get public URLs from Supabase
        const metronomeUrl = supabase.storage.from('audio-samples').getPublicUrl(metronomePath).data.publicUrl;
        const accentUrl = supabase.storage.from('audio-samples').getPublicUrl(accentPath).data.publicUrl;
        
        console.log('🎵 Metronome URL:', metronomeUrl);
        console.log('🎵 Accent URL:', accentUrl);

        // Create Players for the samples
        const metronomePlayer = new Tone.Player({
          url: metronomeUrl,
          onload: () => {
            console.log('✅ Metronome sample loaded');
          },
          onerror: (error: any) => {
            console.error('❌ Failed to load metronome sample:', error);
            // Fallback to synth
            createFallbackSynth();
          }
        }).toDestination();
        
        // For accent, try to load specific accent sample, or use same sample with higher volume
        const accentPlayer = new Tone.Player({
          url: accentUrl,
          onload: () => {
            console.log('✅ Accent sample loaded');
          },
          onerror: (error: any) => {
            console.warn('⚠️ No accent sample, using regular sample with higher volume');
            // Use regular sample for accent too
            accentSamplerRef.current = new Tone.Player({
              url: metronomeUrl,
              volume: 3, // Slightly louder for accent
            }).toDestination();
          }
        }).toDestination();

        // Set initial volumes (0 dB = full volume)
        metronomePlayer.volume.value = -6;
        accentPlayer.volume.value = -3; // Slightly louder for accent

        // Store references
        samplerRef.current = metronomePlayer;
        accentSamplerRef.current = accentPlayer;
        
        // Wait for samples to load
        await Tone.loaded();
        
        setSamplesLoaded(true);
        setLoadingStatus('Ready');
        const loadTime = Date.now() - loadStartTimeRef.current;
        console.log(`✅ Enhanced Metronome: Loaded in ${loadTime}ms`);
        
      } catch (error) {
        console.warn('🎵 Enhanced Metronome: Failed to load samples, using synth fallback:', error);
        createFallbackSynth();
      }
    };

    const createFallbackSynth = () => {
      // Fallback to synthesized sound if samples fail to load
      const synth = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: {
          attack: 0.001,
          decay: 0.1,
          sustain: 0,
          release: 0.1,
        },
      }).toDestination();

      synthRef.current = synth;
      setSamplesLoaded(true);
      setLoadingStatus('Ready (synth)');
      const loadTime = Date.now() - loadStartTimeRef.current;
      console.log(`✅ Enhanced Metronome: Loaded (synth fallback) in ${loadTime}ms`);
    };

    // Always try to load samples, regardless of context state
    loadMetronomeSamples();

    return () => {
      if (synthRef.current) {
        synthRef.current.dispose();
        synthRef.current = null;
      }
      if (samplerRef.current) {
        samplerRef.current.dispose();
        samplerRef.current = null;
      }
      if (accentSamplerRef.current) {
        accentSamplerRef.current.dispose();
        accentSamplerRef.current = null;
      }
    };
  }, [toneReady]);

  // Track if transport is running
  const [transportRunning, setTransportRunning] = useState(false);
  
  // Monitor Transport state changes
  useEffect(() => {
    if (!toneRef.current || !toneReady) return;
    
    let lastState = 'stopped';
    
    const checkTransportState = () => {
      const Tone = toneRef.current;
      if (!Tone) return;
      
      const currentState = Tone.Transport.state;
      
      // Only react to actual state changes
      if (lastState !== currentState) {
        console.log('🎵 Enhanced Metronome: Transport state changed from', lastState, 'to', currentState);
        lastState = currentState;
        
        // Update transport running state
        setTransportRunning(currentState === 'started');
      }
    };
    
    // Check transport state periodically
    const interval = setInterval(checkTransportState, 100);
    checkTransportState(); // Check immediately
    
    return () => clearInterval(interval);
  }, [toneReady]);

  // Schedule metronome ONLY when transport state changes
  useEffect(() => {
    const Tone = toneRef.current;
    
    if (!Tone || !toneReady) {
      return;
    }
    
    // Wait for either samples or synth fallback to be ready
    const hasAudioSource = (samplerRef.current && accentSamplerRef.current) || synthRef.current;
    if (!hasAudioSource) {
      console.log('🎵 Enhanced Metronome: Waiting for audio source...');
      return;
    }
    
    // Schedule if transport is playing OR if we're told to play
    const shouldPlay = transportRunning || isEnginePlay;
    
    if (!shouldPlay) {
      // Clear any existing scheduled events when stopping
      if (transportEventRef.current !== null) {
        console.log('🎵 Enhanced Metronome: Clearing event', transportEventRef.current);
        Tone.Transport.clear(transportEventRef.current);
        transportEventRef.current = null;
        // Reset visual state
        setCurrentBeat(0);
        setMetronomeDots((prev) =>
          prev.map((dot, index) => ({
            ...dot,
            isCurrent: index === 0,
          })),
        );
      }
      return;
    }

    // If we already have a scheduled event, don't create another one
    if (transportEventRef.current !== null) {
      return; // Silently return - we're already scheduled
    }

    console.log('🎵 Enhanced Metronome: Creating NEW metronome schedule');
    
    let beatCount = 0;
    
    // Schedule metronome clicks using synchronized transport for perfect sync
    const eventId = scheduleTransportSync({
      interval: '4n',
      startOffset: '0:0:0',
      callback: (time) => {
      // Calculate current beat
      const beatIndex = beatCount % beats;
      
      // Schedule UI update to sync with audio timing
      const delay = time - Tone.now();
      if (delay > 0) {
        // Schedule UI update for the future to match audio
        setTimeout(() => {
          setCurrentBeat(beatIndex);
          setMetronomeDots((prev) =>
            prev.map((dot, index) => ({
              ...dot,
              isCurrent: index === beatIndex,
            })),
          );
          
          // Report beat timing for analysis
          const position = Tone.Transport.position as string;
          const [bars, beats] = position.split(':').map(Number);
          reportBeat(beats, bars, performance.now());
        }, delay * 1000); // Convert to milliseconds
      } else {
        // Update immediately if we're behind
        requestAnimationFrame(() => {
          setCurrentBeat(beatIndex);
          setMetronomeDots((prev) =>
            prev.map((dot, index) => ({
              ...dot,
              isCurrent: index === beatIndex,
            })),
          );
          
          // Report beat timing for analysis
          const position = Tone.Transport.position as string;
          const [bars, beats] = position.split(':').map(Number);
          reportBeat(beats, bars, performance.now());
        });
      }

      // Play metronome click - use refs to avoid re-scheduling
      if (!isMutedRef.current && volumeRef.current > 0) {
        try {
          const isDownbeat = beatIndex === 0;
          const clickVolume = (volumeRef.current / 100) * (isDownbeat ? 0.8 : 0.6);
          const dbVolume = Tone.gainToDb(clickVolume);

          // Use samples if available, otherwise use synth
          if (samplerRef.current && accentSamplerRef.current) {
            // Use samples
            const player = isDownbeat ? accentSamplerRef.current : samplerRef.current;
            player.volume.value = dbVolume;
            // Stop any current playback and start fresh
            // IMPORTANT: Pass the time parameter to stop() for proper scheduling
            player.stop(time);
            player.start(time);
            
            if (beatIndex === 0) {
              console.log(`🎵 Metronome click (sample) at beat ${beatIndex}, time=${time.toFixed(3)}, volume=${dbVolume.toFixed(2)}dB, player=${isDownbeat ? 'accent' : 'regular'}`);
            }
          } else if (synthRef.current) {
            // Fallback to synth
            const frequency = isDownbeat ? 800 : 400;
            synthRef.current.volume.value = dbVolume;
            synthRef.current.triggerAttackRelease(frequency, '16n', time);
            
            if (beatIndex === 0) {
              console.log(`🎵 Metronome click (synth) at beat ${beatIndex}, time=${time.toFixed(3)}`);
            }
          } else {
            console.warn('🎵 No audio source available for metronome!');
          }
        } catch (error) {
          console.warn('🎵 Enhanced Metronome: Click error:', error);
        }
      }

      // Increment beat counter
      beatCount++;

      // Callback for external monitoring
      if (onBeatCallback) {
        onBeatCallback(beatIndex);
      }
    }}); // Using synchronized scheduling

    transportEventRef.current = eventId;
    console.log('🎵 Enhanced Metronome: Scheduled with Transport, eventId:', eventId);

    // No cleanup here - we'll handle it in a separate effect
  }, [toneReady, transportRunning, isEnginePlay, samplesLoaded]); // Only re-schedule when these critical deps change
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up when component unmounts
      if (transportEventRef.current !== null && toneRef.current) {
        console.log('🎵 Enhanced Metronome: Cleaning up on unmount');
        toneRef.current.Transport.clear(transportEventRef.current);
        transportEventRef.current = null;
      }
    };
  }, []); // Empty deps - only run on unmount

  // Update tempo when it changes
  useEffect(() => {
    if (toneRef.current && toneRef.current.Transport) {
      toneRef.current.Transport.bpm.value = currentTempo;
    }
  }, [currentTempo, toneReady]);

  // Update loop callback when mute/volume changes
  useEffect(() => {
    // The loop will use the current values from the closures
    // No need to recreate the loop
  }, [isMuted, volume, onBeatCallback]);

  // Update dots when beats change
  useEffect(() => {
    setMetronomeDots(
      Array.from({ length: beats }, (_, i) => ({
        id: i + 1,
        isActive: true,
        isCurrent: i === 0,
      })),
    );
  }, [beats]);

  const handleBpmChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newBpm = parseInt(event.target.value, 10);
    if (newBpm >= 60 && newBpm <= 200) {
      onBpmChange(newBpm);

      // Emit tempo change event
      syncProps.sync.actions.emitEvent(
        'TEMPO_CHANGE',
        {
          tempo: newBpm,
          source: 'enhanced-metronome-widget',
        },
        'high',
      );

      // Sync with playback engine
      if (playbackIntegration) {
        playbackIntegration.controls.setTempo(newBpm);
      }
    }
  };

  const handlePlayToggle = () => {
    if (playbackIntegration) {
      if (isEnginePlay) {
        playbackIntegration.controls.pause();
      } else {
        playbackIntegration.controls.play();
      }
    } else {
      syncProps.sync.actions.emitEvent(
        'PLAYBACK_STATE',
        {
          isPlaying: !isEnginePlay,
          source: 'enhanced-metronome-widget',
        },
        'high',
      );
      onTogglePlay();
    }
  };

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
              if (val > 0) setIsMuted(false);
              if (audioControls) {
                audioControls.setVolume(val / 100);
              }
            }}
            color="bg-emerald-400"
            size={45}
            isMuted={isMuted}
            onMuteToggle={() => {
              const newMuted = !isMuted;
              setIsMuted(newMuted);
              if (audioControls) {
                audioControls.setMute(newMuted);
              }
            }}
          />
        </div>

        {/* Content Area */}
        <div className="flex-1">
          <div className="flex items-center justify-between px-4 py-2">
            {!isExpanded ? (
              <>
                {/* Title */}
                <div className="flex-1">
                  <h3
                    className={`font-semibold text-sm transition-all duration-300 ${
                      volume === 0 ? 'text-slate-600' : 'text-white'
                    }`}
                  >
                    Enhanced Metronome
                  </h3>
                  <p
                    className={`text-xs transition-all duration-300 ${
                      volume === 0 ? 'text-slate-600' : 'text-slate-400'
                    }`}
                  >
                    {currentTempo} BPM • Beat {currentBeat + 1}/{beats} • {loadingStatus}
                  </p>
                </div>

                {/* Beat Dots */}
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 shadow-[5px_5px_10px_rgba(0,0,0,0.5),-5px_-5px_10px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300"
                >
                  <div className="grid grid-cols-4 gap-1">
                    {metronomeDots.slice(0, 4).map((dot, i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full transition-all duration-200 ${
                          dot.isCurrent && isEnginePlay
                            ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50'
                            : 'bg-emerald-500'
                        }`}
                      />
                    ))}
                  </div>
                </button>
              </>
            ) : (
              <>
                {/* Expanded Controls */}
                <div className="flex items-center justify-between flex-1">
                  {/* Beats Control */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setBeats(Math.max(1, beats - 1))}
                      className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-xs"
                    >
                      -
                    </button>
                    <span className="text-sm w-8 text-center">{beats}/4</span>
                    <button
                      onClick={() => setBeats(Math.min(8, beats + 1))}
                      className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-xs"
                    >
                      +
                    </button>
                  </div>

                  {/* Beat Indicators */}
                  <div className="flex gap-1">
                    {metronomeDots.map((dot, i) => (
                      <div
                        key={i}
                        className={`w-3 h-3 rounded-full transition-all duration-200 ${
                          dot.isCurrent && isEnginePlay
                            ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50'
                            : 'bg-emerald-600'
                        }`}
                      />
                    ))}
                  </div>

                  {/* BPM Control */}
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="60"
                      max="200"
                      value={currentTempo}
                      onChange={handleBpmChange}
                      className="w-20"
                    />
                    <span className="text-xs w-12">{currentTempo}</span>
                  </div>
                </div>

                <button
                  onClick={() => setIsExpanded(false)}
                  className="ml-2 w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 text-xs"
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

export function EnhancedMetronomeWidget({
  bpm,
  isPlaying,
  isVisible,
  onTogglePlay,
  onBpmChange,
  onToggleVisibility,
  onBeatCallback,
  playbackIntegration,
}: EnhancedMetronomeWidgetProps) {
  if (!isVisible) return null;

  return (
    <SyncedWidget
      widgetId="enhanced-metronome-widget"
      widgetName="Enhanced Metronome"
      syncOptions={{
        subscribeTo: [
          'PLAYBACK_STATE',
          'PLAY',
          'PAUSE',
          'STOP',
          'TEMPO_CHANGE',
          'SEEK',
        ],
        debugMode: true,
      }}
    >
      {(syncProps: SyncedWidgetRenderProps) => (
        <EnhancedMetronomeContent
          bpm={bpm}
          isPlaying={isPlaying}
          onTogglePlay={onTogglePlay}
          onBpmChange={onBpmChange}
          onBeatCallback={onBeatCallback}
          playbackIntegration={playbackIntegration}
          syncProps={syncProps}
        />
      )}
    </SyncedWidget>
  );
}
