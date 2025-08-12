'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { VolumeKnob } from './VolumeKnob';
import { useTrack } from '@/domains/playback/hooks/useTrack';
import { ensureAudioContext, withAudioContext } from '@/domains/playback/utils/ensureAudioContext';
import type { MusicalPosition } from '@bassnotion/contracts/types/musical-time';

// Metronome sound presets
const MetronomeSound = {
  CLASSIC: 'classic',
  ELECTRONIC: 'electronic',
  ACOUSTIC: 'acoustic',
  SUBTLE: 'subtle'
} as const;

type MetronomeSoundType = typeof MetronomeSound[keyof typeof MetronomeSound];

interface MetronomeWidgetProps {
  bpm: number;
  isVisible: boolean;
  isPlaying: boolean;
  onBpmChange: (bpm: number) => void;
  onToggleVisibility: () => void;
  onTogglePlay?: () => void;
}

interface MetronomeDot {
  id: number;
  isActive: boolean;
  isCurrent: boolean;
}

const initialDots: MetronomeDot[] = Array.from({ length: 8 }, (_, i) => ({
  id: i,
  isActive: i < 4,
  isCurrent: i === 0,
}));

export function MetronomeWidgetV2({
  bpm,
  isVisible,
  isPlaying,
  onBpmChange,
  onToggleVisibility,
  onTogglePlay,
}: MetronomeWidgetProps) {
  const [metronomeDots, setMetronomeDots] = useState(initialDots);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [beats, setBeats] = useState(4);
  const [noteValue, setNoteValue] = useState(4);
  const [currentSound, setCurrentSound] = useState<MetronomeSoundType>(MetronomeSound.CLASSIC);
  const [subdivisions, setSubdivisions] = useState(1); // 1 = quarter, 2 = eighth, 3 = triplet
  const [pluginLoadAttempts, setPluginLoadAttempts] = useState(0);
  
  // Create a track for metronome
  const track = useTrack({
    trackId: 'metronome-widget-track',
    name: 'Metronome',
    type: 'utility',
    debugMode: true
  });
  
  // We don't need useWAMPlugin since we're loading manually
  const [wamPluginLoaded, setWamPluginLoaded] = useState(false);
  const [pluginClassLoaded, setPluginClassLoaded] = useState(false);
  
  // Reference to the actual plugin instance and class
  const wamPluginClassRef = useRef<any>(null);
  const metronomePluginRef = useRef<any>(null);
  const lastScheduledTimeRef = useRef<number>(0);
  const currentPatternRef = useRef<any[]>([]);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Phase 1: Load the plugin class (can be done before AudioContext)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (pluginClassLoaded) return;
    
    const loadPluginClass = async () => {
      console.log('🎵 MetronomeWidgetV2: Loading plugin class...');
      
      try {
        // Dynamic import to avoid SSR issues
        const { default: WamMetronome } = await import('@/domains/playback/services/plugins/wam/WamMetronome');
        wamPluginClassRef.current = WamMetronome;
        setPluginClassLoaded(true);
        console.log('✅ WAM Metronome plugin class loaded successfully');
      } catch (error) {
        console.error('❌ Failed to load WAM Metronome plugin class:', error);
      }
    };
    
    loadPluginClass();
  }, [pluginClassLoaded]);
  
  // Phase 2: Create the audio node when AudioContext is available
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!pluginClassLoaded || !track.isReady || wamPluginLoaded) return;
    
    // Add guard to prevent multiple instances
    if (metronomePluginRef.current) {
      console.log('🎵 MetronomeWidgetV2: Plugin already loaded, skipping creation');
      return;
    }
    
    const createAudioNode = async () => {
      console.log('🎵 MetronomeWidgetV2: Attempting to create audio node...', {
        trackIsReady: track.isReady,
        wamPluginLoaded,
        pluginClassLoaded
      });
      
      try {
        const WamMetronome = wamPluginClassRef.current;
        if (!WamMetronome) {
          console.error('🎵 MetronomeWidgetV2: Plugin class not loaded');
          return;
        }
        
        // Get audio context from global audio system
        let context = null;
        
        // Try to get context from global audio services
        const globalServices = (window as any).__globalCoreServices || (window as any).__coreServices;
        if (globalServices && globalServices.getAudioEngine) {
          const audioEngine = globalServices.getAudioEngine();
          if (audioEngine && audioEngine.getContext) {
            try {
              context = audioEngine.getContext();
            } catch (e) {
              console.log('🎵 MetronomeWidgetV2: AudioEngine not ready yet, will retry...');
              return; // Context not ready yet, will retry
            }
          }
        }
        
        if (context && context instanceof AudioContext) {
          // Check if context is running or needs to be resumed
          if (context.state === 'suspended') {
            console.log('🎵 MetronomeWidgetV2: AudioContext is suspended, waiting for user gesture...');
            // Don't create the audio node yet, wait for audioContextStarted event
            return;
          }
          
          // Create plugin instance
          const plugin = await WamMetronome.createInstance(context);
          console.log('🎵 MetronomeWidgetV2: Created plugin instance:', plugin);
          
          // Store the plugin instance
          metronomePluginRef.current = plugin;
          
          // Create the audio node - this is required!
          const audioNode = await plugin.createAudioNode();
          console.log('🎵 MetronomeWidgetV2: Created audio node:', audioNode);
          
          // Connect to destination
          audioNode.connect(context.destination);
          console.log('🎵 MetronomeWidgetV2: Connected to audio destination');
          
          // Store the audio node on the plugin for easy access
          plugin.audioNode = audioNode;
          
          setWamPluginLoaded(true);
          
          console.log('✅ WAM Metronome plugin loaded and connected');
          
          // Load default samples
          if (plugin.loadDefaultSamples) {
            await plugin.loadDefaultSamples();
            console.log('✅ Default metronome samples loaded');
          }
        } else {
          console.log('🎵 MetronomeWidgetV2: AudioContext not ready yet', {
            hasContext: !!context,
            contextState: context?.state
          });
        }
      } catch (error) {
        console.error('❌ Failed to create WAM Metronome audio node:', error);
      }
    };
    
    createAudioNode();
  }, [track.isReady, wamPluginLoaded, pluginClassLoaded, pluginLoadAttempts]);
  
  // Handle volume changes
  useEffect(() => {
    if (metronomePluginRef.current) {
      metronomePluginRef.current.audioNode?.setParameterValues({
        volume: isMuted ? 0 : volume / 100
      });
    }
  }, [volume, isMuted]);
  
  // Handle sound changes - wrapped with audio context initialization
  const handleSoundChange = useCallback(withAudioContext(async (sound: MetronomeSoundType) => {
    setCurrentSound(sound);
    if (metronomePluginRef.current) {
      const soundIndex = Object.values(MetronomeSound).indexOf(sound);
      await metronomePluginRef.current.audioNode?.setParameterValues({
        sound: soundIndex
      });
    }
  }), []);
  
  // Handle subdivision changes
  const handleSubdivisionChange = useCallback(async (subdiv: number) => {
    setSubdivisions(subdiv);
    if (metronomePluginRef.current) {
      await metronomePluginRef.current.audioNode?.setParameterValues({
        subdivisions: subdiv
      });
    }
  }, []);
  
  // Handle time signature changes
  useEffect(() => {
    if (metronomePluginRef.current) {
      metronomePluginRef.current.setTimeSignature(beats, noteValue);
    }
  }, [beats, noteValue]);
  
  // Handle tempo changes
  useEffect(() => {
    if (metronomePluginRef.current) {
      metronomePluginRef.current.setTempo(bpm);
    }
  }, [bpm]);
  
  // Listen for audio services ready event
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleAudioReady = () => {
      console.log('🎵 MetronomeWidgetV2: Audio services ready event received');
      // Do nothing - the effect will handle retries
    };
    
    const handleAudioContextStarted = () => {
      console.log('🎵 MetronomeWidgetV2: AudioContext started event received');
      // Do nothing - the effect will handle retries
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
  
  // Schedule metronome pattern
  const schedulePattern = useCallback(() => {
    const plugin = metronomePluginRef.current;
    if (!plugin || !track.isPlaying) return;
    
    const context = track.track?.audioContext;
    if (!context) return;
    
    // Clear any existing pattern
    currentPatternRef.current = [];
    
    // Calculate timing
    const currentTime = context.currentTime;
    const beatDuration = 60 / bpm;
    const clickDuration = beatDuration / subdivisions;
    
    // Schedule one measure of clicks
    let scheduleTime = currentTime + 0.1; // Small lookahead
    
    for (let beat = 0; beat < beats; beat++) {
      for (let subdiv = 0; subdiv < subdivisions; subdiv++) {
        const isAccent = beat === 0 && subdiv === 0;
        
        // Create pattern event
        const event = {
          type: isAccent ? 'accent' : 'click',
          velocity: isAccent ? 0.8 : 0.6,
          position: { bar: 0, beat, sixteenth: subdiv * 4 }
        };
        
        // Handle the event
        plugin.handlePatternEvent(event, scheduleTime);
        
        // Store pattern info
        currentPatternRef.current.push({
          beat,
          subdivision: subdiv,
          time: scheduleTime,
          isAccent
        });
        
        // Update visual
        const beatIndex = beat * subdivisions + subdiv;
        setTimeout(() => {
          if (track.isPlaying) {
            setMetronomeDots(prev =>
              prev.map((dot, index) => ({
                ...dot,
                isCurrent: index === beatIndex % beats,
              }))
            );
          }
        }, (scheduleTime - currentTime) * 1000);
        
        scheduleTime += clickDuration;
      }
    }
    
    lastScheduledTimeRef.current = scheduleTime;
  }, [bpm, beats, subdivisions, track.isPlaying]);
  
  // Handle play state changes
  useEffect(() => {
    if (isPlaying && track.isReady && metronomePluginRef.current) {
      schedulePattern();
      
      // Set up interval to schedule next measures
      const measureDuration = (60 / bpm) * beats;
      const interval = setInterval(() => {
        if (track.isPlaying) {
          schedulePattern();
        }
      }, measureDuration * 1000 * 0.9); // Schedule slightly early
      
      return () => clearInterval(interval);
    } else if (!isPlaying && metronomePluginRef.current) {
      // Stop and reset visual
      metronomePluginRef.current.audioNode?.clearEvents();
      setMetronomeDots(initialDots);
    }
  }, [isPlaying, track.isReady, schedulePattern]);
  
  // Test click function - wrapped with audio context initialization
  const testClick = useCallback(withAudioContext(async () => {
    console.log('🎵 testClick called:', { plugin: metronomePluginRef.current });
    
    // If plugin isn't loaded, trigger a load attempt
    if (!metronomePluginRef.current && !wamPluginLoaded) {
      console.log('🎵 Plugin not loaded, triggering load attempt...');
      setPluginLoadAttempts(prev => prev + 1);
      
      // Wait for plugin to load
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    if (metronomePluginRef.current) {
      console.log('🎵 Calling plugin.click()');
      metronomePluginRef.current.click(false);
    } else {
      console.log('❌ Cannot trigger click - plugin not ready');
    }
  }), [wamPluginLoaded]);
  
  // Handle BPM wheel
  const handleBpmWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -1 : 1;
    const newBpm = Math.max(40, Math.min(300, bpm + delta));
    onBpmChange(newBpm);
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
            onChange={setVolume}
            color="bg-green-400"
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
                    Metronome Track
                  </h3>
                  <p className={`text-xs ${volume === 0 ? 'text-slate-600' : 'text-slate-400'}`}>
                    {bpm} BPM | {beats}/{noteValue} | {currentSound}
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
                    {/* BPM Slider */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-16">BPM:</span>
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

                    {/* Sound Selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-16">Sound:</span>
                      <select
                        value={currentSound}
                        onChange={(e) => handleSoundChange(e.target.value as MetronomeSoundType)}
                        className="flex-1 bg-slate-700 text-white text-xs rounded px-2 py-1"
                      >
                        {Object.entries(MetronomeSound).map(([key, value]) => (
                          <option key={value} value={value}>
                            {key.charAt(0) + key.slice(1).toLowerCase()}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Subdivision Selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-16">Subdiv:</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleSubdivisionChange(1)}
                          className={`px-2 py-1 text-xs rounded ${
                            subdivisions === 1 ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400'
                          }`}
                        >
                          ♩
                        </button>
                        <button
                          onClick={() => handleSubdivisionChange(2)}
                          className={`px-2 py-1 text-xs rounded ${
                            subdivisions === 2 ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400'
                          }`}
                        >
                          ♫
                        </button>
                        <button
                          onClick={() => handleSubdivisionChange(3)}
                          className={`px-2 py-1 text-xs rounded ${
                            subdivisions === 3 ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400'
                          }`}
                        >
                          ♪³
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={testClick}
                    className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-500 transition-colors"
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