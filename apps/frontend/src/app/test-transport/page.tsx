'use client';

declare global {
  interface Window {
    __toneInitLogged?: boolean;
    __widgetsLoadedLogged?: boolean;
    __autoInitStarted?: boolean;
    __consoleRestored?: boolean;
  }
}

import React, { useEffect, useState } from 'react';
import {
  AudioProvider,
  useAudioServices,
  useTransportController,
  useAudioEngine,
} from '@/domains/playback/providers/AudioProvider';
import { SyncProvider } from '@/domains/widgets/components/base/SyncProvider';
import { MetronomeWidgetV2 as MetronomeWidget } from '@/domains/widgets/components/YouTubeWidgetPage/components/MetronomeWidgetV2';
import { HarmonyWidget } from '@/domains/widgets/components/YouTubeWidgetPage/components/HarmonyWidget';
import { DrummerWidgetV2 as DrummerWidget } from '@/domains/widgets/components/YouTubeWidgetPage/components/DrummerWidgetV2';
import { BassLineWidgetV2 as BassLineWidget } from '@/domains/widgets/components/YouTubeWidgetPage/components/BassLineWidgetV2';
import { usePlaybackIntegration } from '@/domains/widgets/hooks/usePlaybackIntegration';
import { EnhancedMetronomeWidget } from './EnhancedMetronomeWidget';
import { MOCK_EXERCISES } from '@/domains/widgets/api/mockExercises';
import { widgetSyncService } from '@/domains/widgets/services/WidgetSyncService';
import { initLogger } from '@/domains/playback/utils/simpleLogger';
import { silenceConsole, restoreConsole } from '@/domains/playback/utils/silenceConsole';
import { loadingMetrics } from '@/domains/widgets/utils/performance/ExerciseLoadingMetrics';
import { getExercise } from '@/domains/widgets/api/exercises';
import { WidgetLoadingMonitor } from './WidgetLoadingMonitor';
import { BeatTimingVisualizer } from './BeatTimingVisualizer';
import { beatTimingAnalyzer } from '@/domains/playback/utils/BeatTimingAnalyzer';

function TransportTestContent() {
  // Silence console output on mount and initialize state
  const [initState, setInitState] = useState<'pending' | 'initializing' | 'ready' | 'failed'>('pending');
  const [autoInitCompleted, setAutoInitCompleted] = useState(false);
  const [audioPreloadStarted, setAudioPreloadStarted] = useState(false);
  
  React.useEffect(() => {
    silenceConsole();
    // Track when audio engine initialization starts
    loadingMetrics.startAudioEngineInit();
  }, []);

  // Use new Epic 3.18 architecture
  const { 
    isInitialized: isReady, 
    error: audioError,
    getTone,
    audioEngine,
    transportController,
    eventBus
  } = useAudioServices();
  
  const [transportState, setTransportState] = useState<any>({});
  const [loopState, setLoopState] = useState<string>('not created');
  const [loopFiredCount, setLoopFiredCount] = useState(0);
  const [engineState, setEngineState] = useState<string>('ready');
  const [contextState, setContextState] = useState<string>('unknown');

  // Widget states
  const [tempo, setTempo] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showWidgets, setShowWidgets] = useState(true);
  const [consoleEnabled, setConsoleEnabled] = useState(false);
  const [widgetVisibility, setWidgetVisibility] = useState({
    metronome: false, // Disable basic metronome to avoid conflicts
    enhancedMetronome: true, // Enable enhanced metronome for timing metrics
    harmony: true,
    drummer: true,
    bassline: true,
  });

  // Beat tracking
  const [lastBeat, setLastBeat] = useState({ widget: '', beat: -1, time: '' });

  // Timing drift monitoring
  const [timingMetrics, setTimingMetrics] = useState<{
    drift: number;
    avgInterval: number;
    maxInterval: number;
    minInterval: number;
    jitter: number;
  }>({
    drift: 0,
    avgInterval: 0,
    maxInterval: 0,
    minInterval: Infinity,
    jitter: 0,
  });
  const beatTimestampsRef = React.useRef<number[]>([]);

  // Widget data
  const [harmonyProgression, setHarmonyProgression] = useState([
    'C',
    'Am',
    'F',
    'G',
  ]);
  const [currentChord, setCurrentChord] = useState(0);
  const [drumPattern, setDrumPattern] = useState('Rock Steady');
  const [basslineEnabled, setBasslineEnabled] = useState(true);
  const [bassPattern, setBassPattern] = useState('Modal Walking');
  const [loadedExercise, setLoadedExercise] = useState<any>(null);

  // Get playback integration
  const playbackIntegration = usePlaybackIntegration();

  // Event log for monitoring
  const [eventLog, setEventLog] = useState<
    Array<{ time: string; event: string; data?: any }>
  >([]);
  const addEvent = (event: string, data?: any) => {
    const time = new Date().toLocaleTimeString();
    setEventLog((prev) => [...prev.slice(-19), { time, event, data }]);
  };

  // Update state when Tone.js is ready
  useEffect(() => {
    if (isReady) {
      setInitState('ready');
      // Track audio engine completion
      loadingMetrics.completeAudioEngineInit(true);
      // Restore console after initialization
      setTimeout(() => {
        restoreConsole();
        setConsoleEnabled(true);
      }, 1000);
    } else if (audioError) {
      // Track audio engine failure
      loadingMetrics.completeAudioEngineInit(false, audioError?.message);
    }
  }, [isReady, audioError]);

  // OPTIMIZED LOADING - Load exercise metadata FIRST, audio engine in parallel
  useEffect(() => {
    if (!autoInitCompleted && !loadedExercise) {
      console.log('🎯 Starting optimized loading - exercise metadata first...');
      
      // Load exercise metadata immediately (doesn't need audio engine)
      const loadExerciseMetadata = async () => {
        try {
          loadingMetrics.startExerciseMetadataLoad();
          
          // Simulate loading from Supabase - use first mock exercise
          // In real app, this would be: const { exercise } = await getExercise(exerciseId);
          await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
          const testExercise = MOCK_EXERCISES[0];
          
          setLoadedExercise(testExercise);
          loadingMetrics.completeExerciseMetadataLoad(true);
          
          // Update UI state immediately
          setTempo(testExercise.bpm);
          if (testExercise.chord_progression) {
            setHarmonyProgression(testExercise.chord_progression);
          }
          
          // Enable widgets
          setWidgetVisibility({
            metronome: false,
            enhancedMetronome: true,
            harmony: true,
            drummer: true,
            bassline: true,
          });
          setShowWidgets(true);
          
          // Send exercise to widget sync service for smart loading
          widgetSyncService.emit({
            type: 'EXERCISE_CHANGE',
            payload: { exercise: testExercise },
            timestamp: Date.now(),
            source: 'optimized-loader',
            priority: 'high',
          });
          
          addEvent('Exercise Metadata Loaded', {
            exercise: testExercise.title,
            bpm: testExercise.bpm,
            loadTime: loadingMetrics.getMetrics().exerciseMetadata.duration
          });
          
          console.log('✅ Exercise metadata loaded - UI ready for user!');
        } catch (error) {
          console.error('Failed to load exercise metadata:', error);
          loadingMetrics.completeExerciseMetadataLoad(false, error?.toString());
        }
      };
      
      loadExerciseMetadata();
    }
  }, [autoInitCompleted, loadedExercise]);
  
  // Removed PreloadStrategy check - widgets handle their own loading

  // Configure transport when audio engine becomes ready
  useEffect(() => {
    if (isReady && loadedExercise && !autoInitCompleted && transportController) {
      console.log('🎯 Audio engine ready, configuring transport...');
      
      // Configure transport with exercise data
      transportController.setTempo(loadedExercise.bpm);
      transportController.setTimeSignature(loadedExercise.timeSignature);
      
      addEvent('Audio Engine Ready', {
        exerciseConfigured: true,
        bpm: loadedExercise.bpm
      });
      
      setAutoInitCompleted(true);
      
      // Print loading metrics
      loadingMetrics.printSummary();
    }
  }, [isReady, loadedExercise, autoInitCompleted, transportController]);

  // Log when widgets are shown
  useEffect(() => {
    if (showWidgets && !window.__widgetsLoadedLogged) {
      initLogger.widgetsLoaded();
      window.__widgetsLoadedLogged = true;
    }
  }, [showWidgets]);

  // No need for complex initialization - ToneProvider handles it!

  useEffect(() => {
    if (!isReady || !transportController || !audioEngine) return;

    // Get Tone.js instance from AudioEngine
    const Tone = getTone();
    if (!Tone) return;

    // Expose Tone globally for tests
    (window as any).Tone = Tone;

    // Restore console after successful initialization
    if (!window.__toneInitLogged) {
      window.__toneInitLogged = true;
      
      // Restore console after successful initialization
      setTimeout(() => {
        restoreConsole();
        setConsoleEnabled(true);
      }, 1000);
    }

    // Create a test loop using Tone.js
    const testLoop = new Tone.Loop((time) => {
      // console.log('🎵 Loop callback fired at time:', time);
      setLoopFiredCount((prev) => prev + 1);
    }, '4n');

    // Create timing monitor loop that tracks transport timing
    const timingMonitor = new Tone.Loop((time) => {
      const now = performance.now();
      beatTimestampsRef.current.push(now);

      // Keep only last 100 timestamps
      if (beatTimestampsRef.current.length > 100) {
        beatTimestampsRef.current.shift();
      }

      // Calculate timing metrics
      if (beatTimestampsRef.current.length > 2) {
        const intervals: number[] = [];
        for (let i = 1; i < beatTimestampsRef.current.length; i++) {
          intervals.push(
            beatTimestampsRef.current[i] - beatTimestampsRef.current[i - 1],
          );
        }

        const avgInterval =
          intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const maxInterval = Math.max(...intervals);
        const minInterval = Math.min(...intervals);

        // Calculate expected interval
        const expectedInterval = 60000 / (transportController?.getTempo() || tempo); // ms per beat
        const drift = Math.abs(avgInterval - expectedInterval);

        // Calculate jitter (standard deviation)
        const variance =
          intervals.reduce(
            (sum, interval) => sum + Math.pow(interval - avgInterval, 2),
            0,
          ) / intervals.length;
        const jitter = Math.sqrt(variance);

        setTimingMetrics({
          drift,
          avgInterval,
          maxInterval,
          minInterval,
          jitter,
        });
      }
    }, '4n');

    // Store timing monitor reference
    (window as any).__timingMonitor = timingMonitor;

    // Monitor Transport state with higher frequency using new Epic 3.18 API
    const interval = setInterval(() => {
      try {
        // Use TransportController to get state
        if (!transportController) {
          // console.warn('TransportController not ready');
          return;
        }
        
        try {
          const position = transportController.getCurrentPosition();
          const newTransportState = {
            state: transportController.getState(),
            position: `${position.bars}:${position.beats}:${position.sixteenths}`,
            seconds: position.seconds || 0,
            bpm: transportController.getTempo(),
            loop: transportController.isLoopEnabled(),
            loopStart: transportController.getLoopStart(),
            loopEnd: transportController.getLoopEnd(),
            ticks: position.ticks || 0,
            PPQ: 192, // Standard PPQ
          };
          setTransportState(newTransportState);
        } catch (error) {
          // Transport controller might not be fully initialized yet
          console.log('Transport monitoring error:', error);
        }
        
        // Debug logging when Transport should be advancing
        // if (newTransportState.state === 'started' && newTransportState.seconds === 0) {
        //   console.log('🚨 TRANSPORT STATE DEBUG:', {
        //     state: newTransportState.state,
        //     position: newTransportState.position,
        //     seconds: newTransportState.seconds,
        //     transportId: (currentTransport as any)?._id,
        //     timestamp: Date.now(),
        //   });
        // }
      } catch (error) {
        // console.error('Error reading Transport state:', error);
      }
      
      // Diagnostic logging for Transport advancement
      // if (Transport.state === 'started') {
      //   const posStr = Transport.position.toString();
      //   if (posStr === '0:0:0' && Transport.seconds < 0.1) {
      //     console.log('🚨 TRANSPORT DIAGNOSTIC:', {
      //       state: Transport.state,
      //       position: posStr,
      //       seconds: Transport.seconds.toFixed(3),
      //       ticks: Transport.ticks,
      //       context: {
      //         state: Transport.context.state,
      //         currentTime: Transport.context.currentTime.toFixed(3),
      //       },
      //       timeline: {
      //         length: (Transport as any)._timeline?.length,
      //         events: (Transport as any)._timeline?._timeline?.length,
      //       },
      //       scheduledEvents: (Transport as any)._scheduledEvents,
      //     });
      //   }
      // }

      // Update isPlaying based on actual transport state
      // Use a timeout to debounce rapid state changes
      // Only log once to avoid spam
      const timeoutId = setTimeout(() => {
        const transportState = transportController.getState();
        if (transportState === 'playing' && !isPlaying) {
          if (!(window as any)._transportSyncLogged) {
            console.log(
              '🎵 Transport is playing but isPlaying is false, updating...',
            );
            (window as any)._transportSyncLogged = true;
          }
          setIsPlaying(true);
        } else if (transportState !== 'playing' && isPlaying) {
          console.log(
            '🎵 Transport is not playing but isPlaying is true, updating...',
          );
          setIsPlaying(false);
          (window as any)._transportSyncLogged = false;
        }
      }, 50);

      setLoopState(testLoop.state);

      // Update context state more frequently
      const contextInterval = setInterval(() => {
        if (audioEngine) {
          try {
            const context = audioEngine.getContext();
            setContextState(context?.state || 'unknown');
            
            // Also update engine state based on audio engine status
            setEngineState(audioEngine.getStatus());
          } catch (e) {
            // Context might not be ready yet
          }
        }
      }, 100);

      return () => {
        clearTimeout(timeoutId);
        clearInterval(contextInterval);
      };
    }, 25); // MUCH faster monitoring to catch Transport position updates immediately

    // Cleanup
    return () => {
      clearInterval(interval);
      testLoop.dispose();

      // Clean up timing monitor
      const monitor = (window as any).__timingMonitor;
      if (monitor) {
        monitor.stop();
        monitor.dispose();
        (window as any).__timingMonitor = null;
      }
    };
  }, [isReady, transportController, audioEngine, getTone]);


  const handleStartTransport = async (e?: React.MouseEvent) => {
    // Prevent event bubbling
    e?.stopPropagation();
    
    if (!isReady || !transportController) return;

    console.log('🎵 Starting Transport using Epic 3.18 TransportController...');
    addEvent('Start Transport (3.18)', {
      transportState: transportController?.getState(),
      transportPosition: transportController?.getCurrentPosition(),
    });

    // This is a user gesture (button click), perfect time to activate audio
    addEvent('User gesture detected - activating audio context...');

    // Ensure audio context is started (needs user gesture)
    const tone = audioEngine?.getTone();
    if (!tone) {
      addEvent('ERROR: Tone.js not available');
      return;
    }

    // Start or stop transport using new API
    if (transportController.getState() === 'playing') {
      await transportController.stop();
      setIsPlaying(false);
      addEvent('Transport Stopped (3.18)');
    } else {
      // CRITICAL: Ensure AudioEngine is initialized first
      try {
        addEvent('Ensuring AudioEngine is initialized...');
        if (!audioEngine.isReady()) {
          await audioEngine.initialize();
          addEvent('✅ AudioEngine initialized');
        }
        
        addEvent('Starting Tone.js audio system...');
        await tone.start();
        addEvent('✅ Tone.start() completed, context state: ' + tone.context.state);
        
        // Set low latency for better sync between UI and audio
        tone.context.lookAhead = 0.01; // 10ms lookahead instead of default 100ms
        tone.context.updateInterval = 0.01; // 10ms update interval
        addEvent('✅ Set low latency: lookAhead=0.01s, updateInterval=0.01s');
        
        // Double-check context state
        if (tone.context.state === 'suspended') {
          addEvent('⚠️ AudioContext still suspended after Tone.start()');
          addEvent('Trying to resume context directly...');
          await tone.context.resume();
          addEvent('Context state after resume: ' + tone.context.state);
        }
        
        // Now start the transport
        await transportController.start();
        setIsPlaying(true);
        addEvent('Transport Started (3.18)');
      } catch (error) {
        addEvent('❌ Failed to start: ' + error.message);
        console.error('Failed to start transport:', error);
        setIsPlaying(false);
      }
    }

    // Verify transport actually started
    setTimeout(() => {
      const actualTransportState = transportController?.getState();

      addEvent('Post-Start State (3.18)', {
        transportState: actualTransportState,
        transportPosition: transportController?.getCurrentPosition(),
        transportBPM: transportController?.getTempo(),
      });
    }, 200);
  };

  const handleStopTransport = async (e?: React.MouseEvent) => {
    // Prevent event bubbling
    e?.stopPropagation();
    
    if (!transportController) return;

    console.log('🎵 Stopping Transport using Epic 3.18...');
    addEvent('Stop Transport (3.18)');

    // Stop timing monitor
    const monitor = (window as any).__timingMonitor;
    if (monitor) {
      monitor.stop();
      console.log('🎵 Stopped timing monitor');
    }

    // Stop the transport using new API
    await transportController.stop();
    await transportController.seekTo(0); // Reset position
    addEvent('Transport Stopped (3.18)');

    // Force update state
    setIsPlaying(false);

    // Log final state
    setTimeout(() => {
      addEvent('Post-Stop State (3.18)', {
        transportState: transportController?.getState(),
        transportPosition: transportController?.getCurrentPosition(),
        contextState: audioEngine?.getContext()?.state,
      });
    }, 100);
  };

  const handleStartLoop = async () => {
    if (!isReady || !transportController) return;

    const Tone = getTone();
    if (!Tone) return;

    console.log('🎵 Creating and starting test loop...');
    console.log('🎵 Current Transport state:', transportController.getState());

    // Create and start a test loop
    const testLoop = new Tone.Loop((time) => {
      console.log('🎵 Test loop fired at:', time);
      setLoopFiredCount((prev) => prev + 1);
    }, '4n');

    testLoop.start(0);
    console.log('🎵 Test loop state after start:', testLoop.state);

    // Make sure Transport is running
    if (transportController.getState() !== 'playing') {
      console.log('🎵 Transport not started, starting now...');
      await transportController.start();
      console.log('🎵 Transport state after start:', transportController.getState());
    }
  };

  // Sync widget states with engine
  useEffect(() => {
    if (playbackIntegration) {
      setIsPlaying(playbackIntegration.state.isPlaying);
      setTempo(playbackIntegration.state.tempo);
    }
  }, [playbackIntegration?.state.isPlaying, playbackIntegration?.state.tempo]);

  return (
    <div className="p-8 bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4">
        Global Transport & Widget Synchronization Test (Real-World Tutorial Mode)
      </h1>

      {/* Auto-initialization Status Banner */}
      {!autoInitCompleted && (
        <div className="mb-4 p-4 bg-blue-900 border border-blue-700 rounded">
          <p className="text-blue-200">
            ⏳ Optimized loading in progress...
          </p>
          <div className="mt-2 text-sm">
            <p className={`${loadedExercise ? 'text-green-400' : 'text-blue-300'}`}>
              {loadedExercise ? '✅' : '⏳'} Exercise metadata: {loadedExercise ? 'Loaded' : 'Loading...'}
            </p>
            <p className={`${isReady ? 'text-green-400' : 'text-blue-300'}`}>
              {isReady ? '✅' : '⏳'} Audio engine: {isReady ? 'Ready' : 'Initializing...'}
            </p>
          </div>
        </div>
      )}
      
      {autoInitCompleted && loadedExercise && (
        <div className="mb-4 p-4 bg-green-900 border border-green-700 rounded">
          <p className="text-green-200 font-semibold">
            ✅ Tutorial Ready! Exercise loaded, widgets configured. Just press PLAY to start!
          </p>
          <p className="text-green-300 text-sm mt-1">
            This simulates the real tutorial experience where everything is pre-loaded.
          </p>
          <div className="mt-3 p-3 bg-green-800 rounded">
            <p className="text-green-100 font-semibold">Loaded Exercise:</p>
            <p className="text-green-200">"{loadedExercise.title}"</p>
            <p className="text-green-300 text-sm">
              {loadedExercise.bpm} BPM | {loadedExercise.duration_beats} beats | 
              {' '}{loadedExercise.timeSignature.numerator}/{loadedExercise.timeSignature.denominator} time
            </p>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-xl mb-2">Status</h2>
        <div className="bg-gray-800 p-4 rounded">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p>Epic 3.18 Ready: {isReady ? '✅' : '❌'}</p>
              <p>Auto-Init Complete: {autoInitCompleted ? '✅' : '⏳'}</p>
              <p>AudioContext State: {contextState}</p>
              <p>Engine State: {transportController?.getState() || 'not initialized'}</p>
              <p>Transport State: {transportState.state || 'not initialized'}</p>
              <p>Transport Position: {transportState.position || '0:0:0'}</p>
              <p>Transport Seconds: {transportState.seconds?.toFixed(2) || '0.00'}</p>
              <p>Transport BPM: {transportState.bpm || 120}</p>
              <p>Loop State: {loopState}</p>
              <p>Loop Fired Count: {loopFiredCount}</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">
                ⏱️ Timing Stability Metrics
              </h3>
              <p
                className={`${timingMetrics.drift > 5 ? 'text-red-400' : 'text-green-400'}`}
              >
                Drift: {timingMetrics.drift.toFixed(3)}ms{' '}
                {timingMetrics.drift > 5 ? '⚠️' : '✅'}
              </p>
              <p>Avg Interval: {timingMetrics.avgInterval.toFixed(3)}ms</p>
              <p>
                Min/Max:{' '}
                {timingMetrics.minInterval === Infinity
                  ? '—'
                  : timingMetrics.minInterval.toFixed(1)}
                /{timingMetrics.maxInterval.toFixed(1)}ms
              </p>
              <p
                className={`${timingMetrics.jitter > 10 ? 'text-yellow-400' : 'text-green-400'}`}
              >
                Jitter: {timingMetrics.jitter.toFixed(3)}ms{' '}
                {timingMetrics.jitter > 10 ? '⚠️' : '✅'}
              </p>
              <p className="text-xs text-gray-400">
                Samples: {beatTimestampsRef.current.length}{' '}
                {beatTimestampsRef.current.length === 0 ? '🔴' : '🟢'}
              </p>
              <p className="text-xs text-gray-400">
                Monitor:{' '}
                {transportState.state === 'started'
                  ? '🟢 Running'
                  : '🔴 Stopped'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        {/* Main PLAY button - simulates real tutorial experience */}
        {autoInitCompleted && (
          <button
            onClick={async () => {
              if (!isReady || !transportController) return;

              if (isPlaying) {
                // STOP
                addEvent('User pressed STOP');
                await transportController.stop();
                await transportController.seekTo(0);
                setIsPlaying(false);
                
                // Emit widget sync events
                widgetSyncService.emit({
                  type: 'STOP',
                  payload: {},
                  timestamp: Date.now(),
                  source: 'test-transport-page',
                  priority: 'critical'
                });
              } else {
                // PLAY - This is the main user action in real tutorials
                addEvent('User pressed PLAY');
                
                // Ensure audio context is started (requires user gesture)
                const tone = audioEngine?.getTone();
                if (!tone) {
                  addEvent('ERROR: Tone.js not loaded!');
                  return;
                }
                
                // Start Tone.js which will handle AudioContext startup
                addEvent('Starting Tone.js audio system...');
                try {
                  await tone.start();
                  addEvent('✅ Tone.start() completed, context state: ' + tone.context.state);
                  
                  // Apply professional timing configuration
                  const { applyTransportTimingConfig } = await import('@/domains/playback/config/transportTiming');
                  applyTransportTimingConfig(tone);
                  addEvent('✅ Applied professional DAW timing configuration');
                  
                  // Double-check the context is running
                  if (tone.context.state !== 'running') {
                    addEvent('⚠️ Context still not running, trying resume...');
                    await tone.context.resume();
                    addEvent('Context after resume: ' + tone.context.state);
                  }
                } catch (error) {
                  addEvent('❌ Failed to start Tone.js: ' + error.message);
                  console.error('Failed to start Tone.js:', error);
                  return;
                }
                
                // Start transport immediately - NO TEST BEEP!
                await transportController.start();
                setIsPlaying(true);
                
                // Emit widget sync events
                widgetSyncService.emit({
                  type: 'PLAY',
                  payload: {},
                  timestamp: Date.now(),
                  source: 'test-transport-page',
                  priority: 'critical'
                });
                
                // Log state immediately
                addEvent('Playback started', {
                  state: transportController?.getState(),
                  position: transportController?.getCurrentPosition(),
                  bpm: transportController?.getTempo(),
                });
              }
            }}
            className={`px-8 py-4 text-xl font-bold rounded-lg transition-all ${
              isPlaying 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-green-600 hover:bg-green-700 animate-pulse'
            }`}
          >
            {isPlaying ? '⏹️ STOP' : '▶️ PLAY'}
          </button>
        )}

        <div className="border-l border-gray-600 mx-2"></div>

        <button
          onClick={() => {
            if (consoleEnabled) {
              silenceConsole();
              setConsoleEnabled(false);
              addEvent('Console silenced');
            } else {
              restoreConsole();
              setConsoleEnabled(true);
              addEvent('Console restored');
            }
          }}
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded"
          title="Toggle console output for debugging"
        >
          {consoleEnabled ? '🔇 Silence Console' : '🔊 Enable Console'}
        </button>
        
        <button
          onClick={() => {
            const metrics = loadingMetrics.getMetrics();
            addEvent('Loading Metrics', {
              userInteractionReady: metrics.userInteractionReady?.toFixed(0) + 'ms',
              exerciseLoad: metrics.exerciseMetadata.duration?.toFixed(0) + 'ms',
              audioEngineInit: metrics.audioEngine.duration?.toFixed(0) + 'ms',
              totalTime: metrics.totalLoadTime?.toFixed(0) + 'ms'
            });
            loadingMetrics.printSummary();
          }}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded"
          title="Show loading performance metrics"
        >
          📊 Show Loading Metrics
        </button>
        
        <button
          onClick={handleStartTransport}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded mr-4"
          disabled={!isReady}
        >
          Start Transport (Epic 3.18)
        </button>
        <button
          onClick={handleStopTransport}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
          disabled={!isReady}
        >
          Stop Transport (Epic 3.18)
        </button>
        <button
          onClick={handleStartLoop}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
          disabled={!isReady}
        >
          Create & Start Test Loop
        </button>

        <div className="border-l border-gray-600 mx-2"></div>

        <button
          onClick={async () => {
            addEvent('Restart Helper', {
              message: 'Restarting widgets and transport...',
            });

            // 1. Turn off all widgets
            setShowWidgets(false);
            await new Promise((resolve) => setTimeout(resolve, 100));

            // 2. Stop transport properly
            if (transportController) {
              await transportController.stop();
              await transportController.seekTo(0);
              await new Promise((resolve) => setTimeout(resolve, 100));
            }

            // 3. Re-enable widgets
            setShowWidgets(true);
            await new Promise((resolve) => setTimeout(resolve, 200));

            // 4. Start transport again
            if (transportController && audioEngine) {
              // Ensure audio context is started
              const context = audioEngine.getContext();
              if (context && context.state !== 'running') {
                await context.resume();
              }
              await transportController.start();
              setIsPlaying(true);
              addEvent('Restart Helper', {
                message: 'Transport restarted successfully',
              });
            }
          }}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded font-semibold"
          disabled={!isReady}
        >
          🔄 Restart Widgets & Play
        </button>
      </div>

      <div className="mb-6">
        <h2 className="text-xl mb-2">Raw Transport Data</h2>
        <pre className="bg-gray-800 p-4 rounded overflow-auto text-sm">
          {JSON.stringify(transportState, null, 2)}
        </pre>
      </div>

      {/* Widget Loading Monitor */}
      <WidgetLoadingMonitor />

      {/* Widget Controls */}
      <div className="mb-6">
        <h2 className="text-xl mb-4">Widget Testing</h2>

        <div className="flex gap-4 mb-4">
          <button
            onClick={() => setShowWidgets(!showWidgets)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded"
          >
            {showWidgets ? 'Hide Widgets' : 'Show Widgets'}
          </button>

          <button
            onClick={async () => {
              // Load the first mock exercise
              const exercise = MOCK_EXERCISES[0];
              
              // Configure transport with exercise data
              if (transportController) {
                await transportController.setTempo(exercise.bpm);
                await transportController.setTimeSignature(exercise.timeSignature);
                
                // Calculate loop if needed
                const total_bars = Math.ceil(exercise.duration_beats / exercise.timeSignature.numerator);
                const loopEndSeconds = (exercise.duration_beats * 60) / exercise.bpm;
                await transportController.setLoop(0, loopEndSeconds);
                
                addEvent('Transport Configured', {  
                  exerciseId: exercise.id,
                  bars: total_bars,
                  beats: exercise.duration_beats,
                  bpm: exercise.bpm,
                });
              }
              
              // Emit to widget sync service
              widgetSyncService.emit({
                type: 'EXERCISE_CHANGE',
                payload: { exercise },
                timestamp: Date.now(),
                source: 'test-transport',
                priority: 'high',
              });
              addEvent('Loaded Exercise', {
                title: exercise.title,
                duration_beats: exercise.duration_beats,
              });

              // Update local harmony progression from exercise
              if (exercise.chord_progression) {
                setHarmonyProgression(exercise.chord_progression);
              }
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded"
            disabled={!isReady}
          >
            Load Test Exercise
          </button>

          <div className="flex gap-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={widgetVisibility.metronome}
                onChange={(e) =>
                  setWidgetVisibility({
                    ...widgetVisibility,
                    metronome: e.target.checked,
                  })
                }
              />
              Metronome
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={widgetVisibility.enhancedMetronome}
                onChange={(e) =>
                  setWidgetVisibility({
                    ...widgetVisibility,
                    enhancedMetronome: e.target.checked,
                  })
                }
              />
              Enhanced
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={widgetVisibility.harmony}
                onChange={(e) =>
                  setWidgetVisibility({
                    ...widgetVisibility,
                    harmony: e.target.checked,
                  })
                }
              />
              Harmony
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={widgetVisibility.drummer}
                onChange={(e) =>
                  setWidgetVisibility({
                    ...widgetVisibility,
                    drummer: e.target.checked,
                  })
                }
              />
              Drummer
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={widgetVisibility.bassline}
                onChange={(e) =>
                  setWidgetVisibility({
                    ...widgetVisibility,
                    bassline: e.target.checked,
                  })
                }
              />
              Bassline
            </label>
          </div>
        </div>

        {/* Widget Container */}
        {showWidgets && (
          <div className="space-y-4 bg-gray-800 p-4 rounded">
            {/* Metronome Widget */}
            {widgetVisibility.metronome && (
              <div>
                <h3 className="text-lg mb-2">Metronome Widget (Basic)</h3>
                <div className="mb-2 text-sm text-yellow-400">
                  Note: Basic metronome doesn't provide timing metrics. Use
                  Enhanced Metronome for drift monitoring.
                </div>
                <MetronomeWidget
                  bpm={tempo}
                  isPlaying={isPlaying}
                  isVisible={true}
                  onTogglePlay={() => {
                    if (playbackIntegration) {
                      isPlaying
                        ? playbackIntegration.controls.pause()
                        : playbackIntegration.controls.play();
                    }
                  }}
                  onBpmChange={(newBpm) => {
                    setTempo(newBpm);
                    if (playbackIntegration) {
                      playbackIntegration.controls.setTempo(newBpm);
                    }
                  }}
                  onToggleVisibility={() => {}}
                  playbackIntegration={playbackIntegration}
                />
              </div>
            )}

            {/* Enhanced Metronome Widget */}
            {widgetVisibility.enhancedMetronome && (
              <div data-testid="metronome-widget">
                <h3 className="text-lg mb-2">
                  Enhanced Metronome Widget (Tone.js)
                </h3>
                <EnhancedMetronomeWidget
                  bpm={tempo}
                  isPlaying={isPlaying}
                  isVisible={true}
                  onTogglePlay={() => {
                    if (playbackIntegration) {
                      isPlaying
                        ? playbackIntegration.controls.pause()
                        : playbackIntegration.controls.play();
                    }
                  }}
                  onBpmChange={(newBpm) => {
                    setTempo(newBpm);
                    if (playbackIntegration) {
                      playbackIntegration.controls.setTempo(newBpm);
                    }
                  }}
                  onToggleVisibility={() => {}}
                  onBeatCallback={(beat) => {
                    const now = performance.now();
                    setLastBeat({
                      widget: 'Enhanced Metronome',
                      beat,
                      time: new Date().toLocaleTimeString(),
                    });
                    // Don't log every beat to avoid clutter
                    if (beat === 0) {
                      addEvent('Metronome Bar', {
                        beat,
                        timestamp: now.toFixed(2),
                      });
                    }

                    // Always log first few beats for debugging
                    if (beatTimestampsRef.current.length < 5) {
                      console.log(
                        `🎵 Beat callback: beat=${beat}, time=${now.toFixed(2)}ms`,
                      );
                    }

                    // Track beat timing for drift analysis
                    beatTimestampsRef.current.push(now);
                    if (beatTimestampsRef.current.length > 100) {
                      beatTimestampsRef.current.shift();
                    }

                    // Calculate timing metrics
                    if (beatTimestampsRef.current.length > 2) {
                      const intervals: number[] = [];
                      for (
                        let i = 1;
                        i < beatTimestampsRef.current.length;
                        i++
                      ) {
                        intervals.push(
                          beatTimestampsRef.current[i] -
                            beatTimestampsRef.current[i - 1],
                        );
                      }

                      const avgInterval =
                        intervals.reduce((a, b) => a + b, 0) / intervals.length;
                      const maxInterval = Math.max(...intervals);
                      const minInterval = Math.min(...intervals);

                      // Calculate expected interval
                      const expectedInterval = 60000 / tempo; // ms per beat
                      const drift = Math.abs(avgInterval - expectedInterval);

                      // Calculate jitter (standard deviation)
                      const variance =
                        intervals.reduce(
                          (sum, interval) =>
                            sum + Math.pow(interval - avgInterval, 2),
                          0,
                        ) / intervals.length;
                      const jitter = Math.sqrt(variance);

                      setTimingMetrics({
                        drift,
                        avgInterval,
                        maxInterval,
                        minInterval,
                        jitter,
                      });
                    }
                  }}
                  playbackIntegration={playbackIntegration}
                />
              </div>
            )}

            {/* Harmony Widget */}
            {widgetVisibility.harmony && (
              <div data-testid="harmony-widget">
                <h3 className="text-lg mb-2">Harmony Widget</h3>
                <HarmonyWidget
                  progression={harmonyProgression}
                  isPlaying={isPlaying}
                  isVisible={true}
                  onProgressionChange={(prog) => setHarmonyProgression(prog)}
                  onToggleVisibility={() => {}}
                  chordDurations={loadedExercise?.chord_durations || [4, 4, 4, 4]}
                />
              </div>
            )}

            {/* Drummer Widget */}
            {widgetVisibility.drummer && (
              <div data-testid="drummer-widget">
                <h3 className="text-lg mb-2">Drummer Widget</h3>
                <DrummerWidget
                  pattern={drumPattern}
                  isPlaying={isPlaying}
                  isVisible={true}
                  onPatternChange={(pattern) => setDrumPattern(pattern)}
                  onToggleVisibility={() => {}}
                  onTogglePlay={() => {
                    if (playbackIntegration) {
                      isPlaying
                        ? playbackIntegration.controls.pause()
                        : playbackIntegration.controls.play();
                    }
                  }}
                />
              </div>
            )}

            {/* Bassline Widget */}
            {widgetVisibility.bassline && (
              <div>
                <h3 className="text-lg mb-2">Bassline Widget</h3>
                <BassLineWidget
                  pattern={bassPattern}
                  isPlaying={isPlaying}
                  isVisible={true}
                  onPatternChange={(pattern) => setBassPattern(pattern)}
                  onToggleVisibility={() => {}}
                  tempo={tempo}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Transport Controls */}
      <div className="mb-6">
        <h2 className="text-xl mb-2">Transport Position Controls</h2>
        <div className="bg-gray-800 p-4 rounded space-y-4">
          <div className="flex gap-4">
            <button
              onClick={async () => {
                if (transportController) {
                  await transportController.seekTo(0);
                  addEvent('Seek to Start');
                }
              }}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded"
              disabled={!isReady}
            >
              ⏮ Start
            </button>
            <button
              onClick={async () => {
                if (transportController) {
                  const position = transportController.getCurrentPosition();
                  const prevBar = Math.max(1, position.bars - 1);
                  await transportController.seekTo({ measure: prevBar, beat: 1, subdivision: 0 });
                  addEvent('Seek to Previous Bar', { bar: prevBar });
                }
              }}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded"
              disabled={!isReady}
            >
              ⏪ Prev Bar
            </button>
            <button
              onClick={async () => {
                if (transportController) {
                  const position = transportController.getCurrentPosition();
                  const nextBar = position.bars + 1;
                  await transportController.seekTo({ measure: nextBar, beat: 1, subdivision: 0 });
                  addEvent('Seek to Next Bar', { bar: nextBar });
                }
              }}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded"
              disabled={!isReady}
            >
              ⏩ Next Bar
            </button>
          </div>

          <div className="flex items-center gap-4">
            <label>Tempo:</label>
            <input
              type="range"
              min="60"
              max="200"
              value={tempo}
              onChange={async (e) => {
                const newTempo = parseInt(e.target.value);
                setTempo(newTempo);
                if (transportController) {
                  await transportController.setTempo(newTempo);
                  addEvent('Tempo Changed', { tempo: newTempo });
                }
              }}
              className="flex-1"
            />
            <span className="w-16">{tempo} BPM</span>
          </div>

          <div className="flex items-center gap-4">
            <label>Loop:</label>
            <button
              onClick={async () => {
                if (transportController) {
                  // Calculate 4 measures in seconds based on tempo
                  const beatsPerBar = transportController.getTimeSignature().numerator;
                  const barsToLoop = 4;
                  const beatsToLoop = beatsPerBar * barsToLoop;
                  const secondsPerBeat = 60 / transportController.getTempo();
                  const loopEndSeconds = beatsToLoop * secondsPerBeat;
                  
                  await transportController.setLoop(0, loopEndSeconds);
                  addEvent('Loop Set', { start: 0, end: '4 bars' });
                }
              }}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
              disabled={!isReady}
            >
              Set 4-Bar Loop
            </button>
            <button
              onClick={async () => {
                if (transportController) {
                  await transportController.disableLoop();
                  addEvent('Loop Disabled');
                }
              }}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
              disabled={!isReady}
            >
              Disable Loop
            </button>
          </div>
        </div>
      </div>

      {/* Sync Event Monitor */}
      <div className="mb-6">
        <h2 className="text-xl mb-2">Widget State Monitor</h2>
        <div className="bg-gray-800 p-4 rounded">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">Current State</h3>
              <div className="space-y-1 text-sm">
                <p>
                  Tempo: <span className="text-green-400">{tempo} BPM</span>
                </p>
                <p>
                  Playback:{' '}
                  <span
                    className={isPlaying ? 'text-green-400' : 'text-red-400'}
                  >
                    {isPlaying ? 'Playing' : 'Stopped'}
                  </span>
                </p>
                <p>
                  Current Chord:{' '}
                  <span className="text-blue-400">
                    {harmonyProgression[currentChord]}
                  </span>
                </p>
                <p>
                  Drum Pattern:{' '}
                  <span className="text-purple-400">{drumPattern}</span>
                </p>
                <p>
                  Bass Pattern:{' '}
                  <span className="text-orange-400">{bassPattern}</span>
                </p>
                <p>
                  Last Beat:{' '}
                  <span className="text-cyan-400">
                    {lastBeat.widget} - Beat {lastBeat.beat + 1}
                  </span>
                </p>
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Transport Info</h3>
              <div className="space-y-1 text-sm">
                <p>
                  Position:{' '}
                  <span className="text-yellow-400">
                    {transportState.position || '0:0:0'}
                  </span>
                </p>
                <p>
                  Seconds:{' '}
                  <span className="text-yellow-400">
                    {transportState.seconds?.toFixed(2) || '0.00'}
                  </span>
                </p>
                <p>
                  Loop:{' '}
                  <span
                    className={
                      transportState.loop ? 'text-green-400' : 'text-gray-400'
                    }
                  >
                    {transportState.loop ? 'Enabled' : 'Disabled'}
                  </span>
                </p>
                <p>
                  Transport BPM:{' '}
                  <span className="text-yellow-400">
                    {transportState.bpm || '120'}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Event Log */}
      <div className="mb-6">
        <h2 className="text-xl mb-2">Event Log</h2>
        <div className="bg-gray-800 p-4 rounded">
          <div className="space-y-1 text-sm font-mono max-h-64 overflow-y-auto">
            {eventLog.length === 0 ? (
              <p className="text-gray-400">No events yet...</p>
            ) : (
              eventLog.map((log, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-gray-500">{log.time}</span>
                  <span className="text-blue-400">{log.event}</span>
                  {log.data && (
                    <span className="text-gray-400">
                      {JSON.stringify(log.data)}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
          <button
            onClick={() => setEventLog([])}
            className="mt-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          >
            Clear Log
          </button>
        </div>
      </div>

      {/* Widget Sync Test */}
      <div className="mb-6">
        <h2 className="text-xl mb-2">Widget Synchronization Tests</h2>
        <div className="bg-gray-800 p-4 rounded space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">Test Scenarios</h3>
              <div className="space-y-2">
                <button
                  onClick={async () => {
                    addEvent('Test: Start All Widgets');

                    // First ensure Tone.js is initialized
                    if (!isReady) {
                      addEvent('Test: Audio not ready, please wait...');
                      return;
                    }

                    // Ensure audio context is started
                    const tone = getTone();
                    if (tone && tone.context.state !== 'running') {
                      await tone.start();
                      addEvent('Test: Started audio context');
                    }

                    // Ensure Transport is ready
                    if (transportController && transportController.getState() === 'stopped') {
                      addEvent('Test: Transport ready');
                    }

                    // Enable all widgets
                    setWidgetVisibility({
                      metronome: false,
                      enhancedMetronome: true,
                      harmony: true,
                      drummer: true,
                      bassline: true,
                    });
                    setShowWidgets(true);

                    // Wait for widgets to mount and samples to load
                    setTimeout(async () => {
                      addEvent('Test: Waiting for samples to load...');

                      // Ensure transport is ready
                      if (transportController) {
                        await transportController.setTempo(tempo);
                        addEvent(`Test: Set transport BPM to ${tempo}`);
                      }

                      // Give more time for samples to load
                      setTimeout(async () => {
                        try {
                          // Ensure audio context is started
                          const context = audioEngine?.getContext();
                          if (context && context.state !== 'running') {
                            await context.resume();
                          }
                          
                          await transportController.start();
                          setIsPlaying(true);
                          addEvent('Test: Started playback via TransportController');

                          // Verify transport is running
                          if (transportController.getState() !== 'playing') {
                            await transportController.start();
                            addEvent('Test: Manually started transport');
                          }
                          addEvent(
                            `Test: Transport state = ${transportController.getState()}`,
                          );
                        } catch (error) {
                          addEvent(
                            `Test: Error starting playback: ${error.message}`,
                          );
                        }
                      }, 2000);
                    }, 500);
                  }}
                  className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm text-left"
                  disabled={!isReady}
                >
                  🚀 Start All Widgets Test
                </button>

                <button
                  onClick={async () => {
                    addEvent('Test: Tempo Sync');

                    // Ensure transport is running first
                    if (!isReady || !Transport) {
                      addEvent(
                        'Test: Transport not ready, please initialize first',
                      );
                      return;
                    }

                    if (transportController.getState() !== 'playing') {
                      addEvent('Test: Starting playback first...');
                      const context = audioEngine?.getContext();
                      if (context && context.state !== 'running') {
                        await context.resume();
                      }
                      await transportController.start();
                      setIsPlaying(true);
                      await new Promise((resolve) => setTimeout(resolve, 500));
                    }

                    const testTempos = [120, 140, 100, 160, 120];
                    let index = 0;
                    const interval = setInterval(async () => {
                      if (index < testTempos.length) {
                        const newTempo = testTempos[index];
                        setTempo(newTempo);

                        // Set tempo on TransportController
                        if (transportController) {
                          await transportController.setTempo(newTempo);
                        }

                        // Log the tempo change
                        addEvent(
                          `Tempo Test: ${newTempo} BPM`,
                        );

                        index++;
                      } else {
                        clearInterval(interval);
                        addEvent('Test: Tempo sync test completed');
                      }
                    }, 2000);
                  }}
                  className="w-full px-3 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-sm text-left"
                  disabled={!isReady}
                >
                  🎵 Test Tempo Synchronization
                </button>

                <button
                  onClick={async () => {
                    addEvent('Test: Start/Stop Sync');

                    if (!isReady || !transportController) {
                      addEvent(
                        'Test: Transport not ready, please initialize first',
                      );
                      return;
                    }

                    // Ensure audio context is started
                    const context = audioEngine?.getContext();
                    if (context && context.state !== 'running') {
                      await context.resume();
                      addEvent('Test: Started audio context');
                    }

                    const runTest = async () => {
                      try {
                        // Start
                        await transportController.start();
                        addEvent(
                          `Test Play - Transport: ${transportController.getState()}`,
                        );

                        setTimeout(async () => {
                          // Pause
                          await transportController.pause();
                          addEvent(
                            `Test Pause - Transport: ${transportController.getState()}`,
                          );

                          setTimeout(async () => {
                            // Resume
                            await transportController.start();
                            addEvent(
                              `Test Resume - Transport: ${transportController.getState()}`,
                            );

                            // Final check
                            setTimeout(() => {
                              addEvent('Test: Start/Stop sync test completed');
                              addEvent(
                                `Final state - Transport: ${transportController.getState()}`,
                              );
                            }, 2000);
                          }, 1000);
                        }, 3000);
                      } catch (error) {
                        addEvent(`Test Error: ${error.message}`);
                      }
                    };

                    runTest();
                  }}
                  className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm text-left"
                  disabled={!isReady}
                >
                  ⏯️ Test Start/Stop Sync
                </button>
                <button
                  onClick={() => {
                    addEvent('Test: Clear Timing Metrics');
                    beatTimestampsRef.current = [];
                    setTimingMetrics({
                      drift: 0,
                      avgInterval: 0,
                      maxInterval: 0,
                      minInterval: Infinity,
                      jitter: 0,
                    });
                  }}
                  className="w-full px-3 py-2 bg-gray-600 hover:bg-gray-700 rounded text-sm text-left"
                >
                  🧹 Clear Timing Metrics
                </button>

                <button
                  onClick={async () => {
                    addEvent('Test: Widget Beat Sync Verification');

                    if (!isReady || !engine) {
                      addEvent('Test: Engine not ready');
                      return;
                    }

                    // Enable enhanced metronome for beat tracking
                    setWidgetVisibility({
                      metronome: false,
                      enhancedMetronome: true,
                      harmony: true,
                      drummer: true,
                      bassline: true,
                    });
                    setShowWidgets(true);

                    // Start tracking beats
                    const beatLog: any[] = [];
                    const testDuration = 10000; // 10 seconds
                    let startTime = Date.now();

                    // Monitor for 10 seconds
                    const checkInterval = setInterval(() => {
                      if (Date.now() - startTime > testDuration) {
                        clearInterval(checkInterval);

                        // Analyze results
                        const beatCount = beatLog.filter(
                          (log) => log.widget === 'Enhanced Metronome',
                        ).length;
                        const expectedBeats = Math.floor(
                          (testDuration / 1000) * (tempo / 60),
                        );
                        const accuracy = (beatCount / expectedBeats) * 100;

                        addEvent('Test: Beat Sync Results', {
                          totalBeats: beatCount,
                          expectedBeats,
                          accuracy: `${accuracy.toFixed(1)}%`,
                          tempo,
                        });

                        if (accuracy > 90) {
                          addEvent(
                            '✅ Test PASSED: Widgets are syncing correctly',
                          );
                        } else {
                          addEvent('❌ Test FAILED: Sync issues detected');
                        }
                      }

                      // Log current beat
                      if (lastBeat.beat >= 0 && lastBeat.time) {
                        beatLog.push({ ...lastBeat, timestamp: Date.now() });
                      }
                    }, 100);

                    // Start playback after a delay
                    setTimeout(async () => {
                      if (transportController) {
                        const context = audioEngine?.getContext();
                        if (context && context.state !== 'running') {
                          await context.resume();
                        }
                        await transportController.start();
                        setIsPlaying(true);
                        addEvent('Test: Started beat sync monitoring...');
                        startTime = Date.now();
                      }
                    }, 2000);
                  }}
                  className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm text-left"
                  disabled={!isReady}
                >
                  🎯 Test Widget Beat Sync
                </button>
              </div>
            </div>

            {/* Beat Timing Visualizer */}
            <div className="col-span-2">
              <BeatTimingVisualizer isPlaying={isPlaying} tempo={tempo} />
            </div>

            <div>
              <h3 className="font-semibold mb-2">Test Results</h3>
              <div className="space-y-1 text-sm">
                <p>✅ Tone.js Initialized: {isReady ? 'Yes' : 'No'}</p>
                <p>
                  ✅ Engine Running:{' '}
                  {transportController?.getState() === 'playing' ? 'Yes' : transportController?.getState() || 'not initialized'}
                </p>
                <p>
                  ✅ Transport Active:{' '}
                  {transportState.state === 'started' ? 'Yes' : 'No'}
                </p>
                <p>✅ Widgets Synced: {showWidgets ? 'Yes' : 'No'}</p>
                <p>
                  ✅ Beat Tracking: {lastBeat.beat >= 0 ? 'Active' : 'Inactive'}
                </p>
                <p>
                  📊 Transport Position: {transportState.position || '0:0:0'}
                </p>
                <p>
                  ⏱️ Transport Time:{' '}
                  {transportState.seconds?.toFixed(2) || '0.00'}s
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TransportTestPage() {
  return (
    <AudioProvider>
      <SyncProvider
        debugMode={false}
        monitoringInterval={1000}
        enableGlobalMonitoring={true}
      >
        <TransportTestContent />
      </SyncProvider>
    </AudioProvider>
  );
}
