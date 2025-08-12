'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { VolumeKnob } from './VolumeKnob';
import { useTrack } from '@/domains/playback/hooks/useTrack';
import { ensureAudioContext, withAudioContext } from '@/domains/playback/utils/ensureAudioContext';
import type { Exercise } from '@bassnotion/contracts';

interface DrummerWidgetProps {
  pattern: string;
  isVisible: boolean;
  isPlaying: boolean;
  exercise?: Exercise;
  onPatternChange: (pattern: string) => void;
  onToggleVisibility: () => void;
  onTogglePlay?: () => void;
  tempo?: number;
}

// Drum pattern presets
const drumPatterns = {
  'Rock Steady': {
    kick:  [1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 1, 0, 0, 0, 1, 0],
    hihat: [1, 1, 1, 1, 1, 1, 1, 1]
  },
  'Jazz Swing': {
    kick:  [1, 0, 0, 0, 0, 0, 1, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0],
    hihat: [1, 0, 1, 1, 0, 1, 1, 0]
  },
  'Bossa Nova': {
    kick:  [1, 0, 0, 1, 0, 0, 1, 0],
    snare: [0, 0, 1, 0, 0, 1, 0, 0],
    hihat: [1, 0, 1, 0, 1, 0, 1, 0]
  },
  'Funk Groove': {
    kick:  [1, 0, 0, 1, 0, 0, 1, 0],
    snare: [0, 1, 0, 1, 0, 0, 1, 0],
    hihat: [1, 1, 0, 1, 1, 0, 1, 1]
  },
  'Latin': {
    kick:  [1, 0, 0, 1, 0, 1, 0, 0],
    snare: [0, 0, 1, 0, 1, 0, 1, 0],
    hihat: [1, 1, 1, 0, 1, 1, 1, 0]
  },
  'Shuffle': {
    kick:  [1, 0, 1, 0, 1, 0, 1, 0],
    snare: [0, 0, 1, 0, 0, 0, 1, 0],
    hihat: [1, 0, 1, 1, 0, 1, 1, 0]
  }
};

export function DrummerWidgetV2({
  pattern,
  isVisible,
  isPlaying,
  exercise,
  onPatternChange,
  onToggleVisibility,
  onTogglePlay,
  tempo = 120,
}: DrummerWidgetProps) {
  const [currentBeat, setCurrentBeat] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [currentPattern, setCurrentPattern] = useState(drumPatterns[pattern as keyof typeof drumPatterns] || drumPatterns['Rock Steady']);
  const [audioServicesReady, setAudioServicesReady] = useState(false);
  const [pluginLoadAttempts, setPluginLoadAttempts] = useState(0);
  
  // Create a track for drums
  const track = useTrack({
    trackId: 'drummer-widget-track',
    name: 'Drums',
    type: 'drums',
    debugMode: true
  });
  
  // We'll load the plugin manually
  const [wamPluginLoaded, setWamPluginLoaded] = useState(false);
  const [pluginClassLoaded, setPluginClassLoaded] = useState(false);
  
  // Reference to the plugin class and instance
  const wamPluginClassRef = useRef<any>(null);
  const drummerPluginRef = useRef<any>(null);
  const lastScheduledTimeRef = useRef<number>(0);
  const currentPatternRef = useRef<any[]>([]);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Phase 1: Load the plugin class (can be done before AudioContext)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (pluginClassLoaded) return;
    
    const loadPluginClass = async () => {
      console.log('🎹 DrummerWidgetV2: Loading plugin class...');
      
      try {
        // Dynamic import to avoid SSR issues
        const { default: WamDrummer } = await import('@/domains/playback/services/plugins/wam/WamDrummer');
        wamPluginClassRef.current = WamDrummer;
        setPluginClassLoaded(true);
        console.log('✅ WAM Drummer plugin class loaded successfully');
      } catch (error) {
        console.error('❌ Failed to load WAM Drummer plugin class:', error);
      }
    };
    
    loadPluginClass();
  }, [pluginClassLoaded]);

  // Phase 2: Create the audio node when AudioContext is available
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!pluginClassLoaded || !track.isReady || wamPluginLoaded) return;
    
    // Add guard to prevent multiple instances
    if (drummerPluginRef.current) {
      console.log('🎹 DrummerWidgetV2: Plugin already loaded, skipping creation');
      return;
    }
    
    const createAudioNode = async () => {
      console.log('🎹 DrummerWidgetV2: Attempting to create audio node...', {
        trackIsReady: track.isReady,
        wamPluginLoaded,
        pluginClassLoaded
      });
      
      try {
        const WamDrummer = wamPluginClassRef.current;
        if (!WamDrummer) {
          console.error('🎹 DrummerWidgetV2: Plugin class not loaded');
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
              console.log('🎹 DrummerWidgetV2: AudioEngine not ready yet, will retry...');
              return; // Context not ready yet, will retry
            }
          }
        }
        
        console.log('🎹 DrummerWidgetV2: Got context:', context, {
          type: context?.constructor?.name,
          isAudioContext: context instanceof AudioContext,
          contextState: context?.state
        });
        
        if (context && context instanceof AudioContext) {
          // Check if context is running or needs to be resumed
          if (context.state === 'suspended') {
            console.log('🎹 DrummerWidgetV2: AudioContext is suspended, waiting for user gesture...');
            // Don't create the audio node yet, wait for audioContextStarted event
            return;
          }
          
          // Create plugin instance
          const plugin = await WamDrummer.createInstance(context);
          console.log('🎹 DrummerWidgetV2: Created plugin instance:', plugin);
          
          // Store the plugin instance for later use
          drummerPluginRef.current = plugin;
          
          // Create the audio node - this is required!
          const audioNode = await plugin.createAudioNode();
          console.log('🎹 DrummerWidgetV2: Created audio node:', audioNode);
          
          // Connect to destination for now
          audioNode.connect(context.destination);
          console.log('🎹 DrummerWidgetV2: Connected to audio destination');
          
          // Store the audio node on the plugin for easy access
          plugin.audioNode = audioNode;
          
          setWamPluginLoaded(true);
          
          console.log('✅ WAM Drummer plugin loaded and connected');
          
          // Load default kit using the correct method
          if (plugin.loadDefaultKit) {
            await plugin.loadDefaultKit();
            console.log('✅ Default drum kit loaded');
          }
        } else {
          console.log('🎹 DrummerWidgetV2: AudioContext not ready yet', {
            hasContext: !!context,
            contextState: context?.state
          });
        }
      } catch (error) {
        console.error('❌ Failed to create WAM Drummer audio node:', error);
      }
    };
    
    createAudioNode();
  }, [track.isReady, wamPluginLoaded, pluginClassLoaded, pluginLoadAttempts]);
  
  // Handle volume changes
  useEffect(() => {
    if (drummerPluginRef.current && drummerPluginRef.current.audioNode) {
      const audioNode = drummerPluginRef.current.audioNode;
      if (audioNode.setVolume) {
        audioNode.setVolume(isMuted ? 0 : volume / 100);
        audioNode.setMute(isMuted);
      }
    }
  }, [volume, isMuted]);
  
  // Listen for audio services ready event
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleAudioReady = () => {
      console.log('🎹 DrummerWidgetV2: Audio services ready event received');
      setAudioServicesReady(true);
    };
    
    // Check if services are already ready
    const globalServices = (window as any).__globalCoreServices || (window as any).__coreServices;
    if (globalServices && globalServices.getAudioEngine) {
      try {
        const audioEngine = globalServices.getAudioEngine();
        if (audioEngine && audioEngine.isReady && audioEngine.isReady()) {
          console.log('🎹 DrummerWidgetV2: Audio services already ready');
          setAudioServicesReady(true);
        }
      } catch (e) {
        // Not ready yet
      }
    }
    
    window.addEventListener('audioServicesReady', handleAudioReady);
    
    // Also listen for audioContext started event
    const handleAudioContextStarted = () => {
      console.log('🎹 DrummerWidgetV2: AudioContext started event received');
      // Do nothing - the effect will handle retries
    };
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
    if (audioServicesReady && track.isReady && !wamPluginLoaded) {
      console.log('🎹 DrummerWidgetV2: Audio services ready, retrying plugin load...');
      // Small delay to ensure everything is fully initialized
      retryTimeoutRef.current = setTimeout(() => {
        setWamPluginLoaded(false); // Force a retry by changing the dependency
      }, 100);
    }
  }, [audioServicesReady, track.isReady, wamPluginLoaded]);
  
  // Update pattern when selection changes
  useEffect(() => {
    const newPattern = drumPatterns[pattern as keyof typeof drumPatterns] || drumPatterns['Rock Steady'];
    setCurrentPattern(newPattern);
  }, [pattern]);
  
  // Schedule drum pattern
  const schedulePattern = useCallback(() => {
    const plugin = drummerPluginRef.current;
    if (!plugin || !plugin.audioNode || !track.isPlaying) return;
    
    // Get audio context from global audio system
    let context = null;
    const globalServices = (window as any).__globalCoreServices || (window as any).__coreServices;
    if (globalServices && globalServices.getAudioEngine) {
      const audioEngine = globalServices.getAudioEngine();
      if (audioEngine && audioEngine.getContext) {
        context = audioEngine.getContext();
      } else {
        const Tone = audioEngine.getTone();
        if (Tone && Tone.context) {
          // Tone.context might be a wrapper, try to get the raw AudioContext
          context = Tone.context.rawContext || Tone.context._context || Tone.context;
        }
      }
    }
    
    if (!context) return;
    
    // Clear any existing pattern
    currentPatternRef.current = [];
    
    // Calculate timing
    const currentTime = context.currentTime;
    const beatDuration = 60 / tempo;
    const eighthNoteDuration = beatDuration / 2;
    
    // Schedule one measure of drums
    let scheduleTime = currentTime + 0.1; // Small lookahead
    
    const audioNode = plugin.audioNode;
    
    for (let i = 0; i < 8; i++) { // 8 eighth notes
      // Schedule each drum hit
      if (currentPattern.kick[i]) {
        if (audioNode.triggerPad) {
          audioNode.triggerPad(1, 0.8); // Pad 1 = Kick
        }
      }
      
      if (currentPattern.snare[i]) {
        if (audioNode.triggerPad) {
          // Schedule with proper timing
          setTimeout(() => {
            audioNode.triggerPad(3, 0.7); // Pad 3 = Snare
          }, (scheduleTime - currentTime) * 1000);
        }
      }
      
      if (currentPattern.hihat[i]) {
        if (audioNode.triggerPad) {
          setTimeout(() => {
            audioNode.triggerPad(5, 0.6); // Pad 5 = Hi-hat
          }, (scheduleTime - currentTime) * 1000);
        }
      }
      
      // Update visual beat indicator
      setTimeout(() => {
        if (track.isPlaying) {
          setCurrentBeat(i);
        }
      }, (scheduleTime - currentTime) * 1000);
      
      scheduleTime += eighthNoteDuration;
    }
    
    lastScheduledTimeRef.current = scheduleTime;
  }, [currentPattern, tempo, track.isPlaying]);
  
  // Handle play state changes
  useEffect(() => {
    if (isPlaying && track.isReady && drummerPluginRef.current) {
      schedulePattern();
      
      // Set up interval to schedule next measures
      const measureDuration = (60 / tempo) * 4; // 4/4 time
      const interval = setInterval(() => {
        if (track.isPlaying) {
          schedulePattern();
        }
      }, measureDuration * 1000 * 0.9); // Schedule slightly early
      
      return () => clearInterval(interval);
    } else if (!isPlaying) {
      // Reset visual
      setCurrentBeat(0);
    }
  }, [isPlaying, track.isReady, schedulePattern]);
  
  // Test drum function - wrapped with audio context initialization
  const testDrumSound = useCallback(withAudioContext(async (padNum: number) => {
    console.log('🥁 testDrumSound called:', { padNum, plugin: drummerPluginRef.current });
    
    // If plugin isn't loaded, trigger a load attempt
    if (!drummerPluginRef.current && !wamPluginLoaded) {
      console.log('🥁 Plugin not loaded, triggering load attempt...');
      setPluginLoadAttempts(prev => prev + 1);
      
      // Wait for plugin to load
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    if (drummerPluginRef.current && drummerPluginRef.current.audioNode) {
      const audioNode = drummerPluginRef.current.audioNode;
      if (audioNode.triggerPad) {
        console.log('🥁 Triggering pad:', padNum);
        audioNode.triggerPad(padNum, 0.8);
      } else {
        console.log('❌ Cannot trigger pad - audio node has no triggerPad method');
      }
    } else {
      console.log('❌ Cannot trigger pad - plugin not ready', {
        hasPlugin: !!drummerPluginRef.current,
        hasAudioNode: drummerPluginRef.current?.audioNode
      });
    }
  }), [wamPluginLoaded]);
  
  // Toggle pattern functions - wrapped with audio context initialization
  const toggleDrum = useCallback(withAudioContext(async (drum: 'kick' | 'snare' | 'hihat', index: number) => {
    setCurrentPattern(prev => ({
      ...prev,
      [drum]: prev[drum].map((beat, i) => i === index ? (beat ? 0 : 1) : beat)
    }));
    
    // Play sound for feedback
    const padMap = { kick: 1, snare: 3, hihat: 5 };
    await testDrumSound(padMap[drum]);
  }), [testDrumSound]);
  
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
            color="bg-orange-400"
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
                    Drums Track
                  </h3>
                  <p className={`text-xs ${volume === 0 ? 'text-slate-600' : 'text-slate-400'}`}>
                    {pattern} | {wamPluginLoaded ? 'Ready' : 'Loading...'}
                  </p>
                </div>

                <button
                  onClick={() => setIsExpanded(true)}
                  className={`flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800 shadow-[5px_5px_10px_rgba(0,0,0,0.5),-5px_-5px_10px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300 cursor-pointer ${
                    volume === 0 ? 'opacity-50' : ''
                  }`}
                >
                  {/* Compact beat dots in 3x8 grid */}
                  <div className="grid grid-rows-3 grid-cols-8 gap-1">
                    {/* Hi-hat row */}
                    {currentPattern.hihat.map((beat, idx) => (
                      <div
                        key={`hh-${idx}`}
                        className={`w-2 h-2 rounded-full transition-all duration-200 ${
                          currentBeat === idx && isPlaying
                            ? 'bg-orange-200 shadow-lg shadow-orange-200/50'
                            : beat
                              ? 'bg-orange-500'
                              : 'bg-slate-700'
                        }`}
                      />
                    ))}
                    
                    {/* Snare row */}
                    {currentPattern.snare.map((beat, idx) => (
                      <div
                        key={`sn-${idx}`}
                        className={`w-2 h-2 rounded-full transition-all duration-200 ${
                          currentBeat === idx && isPlaying
                            ? 'bg-orange-200 shadow-lg shadow-orange-200/50'
                            : beat
                              ? 'bg-orange-500'
                              : 'bg-slate-700'
                        }`}
                      />
                    ))}
                    
                    {/* Kick row */}
                    {currentPattern.kick.map((beat, idx) => (
                      <div
                        key={`k-${idx}`}
                        className={`w-2 h-2 rounded-full transition-all duration-200 ${
                          currentBeat === idx && isPlaying
                            ? 'bg-orange-200 shadow-lg shadow-orange-200/50'
                            : beat
                              ? 'bg-orange-500'
                              : 'bg-slate-700'
                        }`}
                      />
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
                      <span className="text-xs text-slate-400 w-16">Pattern:</span>
                      <select
                        value={pattern}
                        onChange={(e) => onPatternChange(e.target.value)}
                        className="flex-1 bg-slate-700 text-white text-xs rounded px-2 py-1"
                      >
                        {Object.keys(drumPatterns).map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>

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
                      await new Promise(resolve => setTimeout(resolve, 200));
                      await testDrumSound(3); // snare
                      await new Promise(resolve => setTimeout(resolve, 200));
                      await testDrumSound(5); // hihat
                    }}
                    className="px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-500 transition-colors"
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