'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Slider } from '@/shared/components/ui/slider';
import type { CoreServices } from '@/domains/playback/services/core/CoreServices';
import type { UnifiedTransport, TimingMetrics, MusicalPosition } from '@/domains/playback/services/core/UnifiedTransport';
import { BackgroundSampleLoader, type SampleStatus } from '@/domains/playback/services/BackgroundSampleLoader';

function TestUnifiedTransportContent() {
  const [coreServices, setCoreServices] = useState<CoreServices | null>(null);
  const [transport, setTransport] = useState<UnifiedTransport | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [tempo, setTempo] = useState(120);
  const [position, setPosition] = useState<MusicalPosition>({ bars: 0, beats: 0, sixteenths: 0, ticks: 0 });
  const [metrics, setMetrics] = useState<TimingMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [audioInitialized, setAudioInitialized] = useState(false);
  
  // Background sample loading state
  const [backgroundLoader, setBackgroundLoader] = useState<BackgroundSampleLoader | null>(null);
  const [sampleLoadingProgress, setSampleLoadingProgress] = useState<Record<string, SampleStatus>>({});
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
  
  const positionInterval = useRef<number | null>(null);
  
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, fractionalSecondDigits: 3 });
    setLogs(prev => [...prev.slice(-19), `[${timestamp}] ${message}`]);
  };
  
  
  // Initialize core services
  useEffect(() => {
    // Initialize BackgroundSampleLoader immediately - no AudioContext needed!
    const loader = BackgroundSampleLoader.getInstance();
    setBackgroundLoader(loader);
    addLog('BackgroundSampleLoader initialized (no AudioContext needed for loading URLs!)');
    
    // Start automatic background loading immediately
    setIsBackgroundLoading(true);
    addLog('🚀 Starting automatic background sample loading...');
    
    loader.startBackgroundLoading({
      priority: 'all',
      maxIdleTime: 50,
      onProgress: (instrument, status) => {
        setSampleLoadingProgress(prev => ({
          ...prev,
          [instrument]: status
        }));
        addLog(`📊 Auto-load ${instrument}: ${status.quality} (${status.progress}%)`); 
      }
    }).catch(error => {
      addLog(`❌ Auto-load failed: ${error.message}`);
    });
    
    // Try to get CoreServices if available
    const checkServices = async () => {
      // Also listen for the audioServicesReady event
      const serviceReadyHandler = () => {
        // Event fired, CoreServices should be ready
      };
      window.addEventListener('audioServicesReady', serviceReadyHandler);
      
      let attempts = 0;
      while (attempts < 30) {
        if ((window as any).__globalCoreServices) {
          const services = (window as any).__globalCoreServices as CoreServices;
          setCoreServices(services);
          
          const unifiedTransport = services.getUnifiedTransport();
          setTransport(unifiedTransport);
          
          // Subscribe to transport events immediately
          const eventBus = services.getEventBus();
          
          const startHandler = () => {
            addLog('Transport started event received');
            setIsPlaying(true);
            setIsPaused(false);
          };
          
          const stopHandler = () => {
            addLog('Transport stopped event received');
            setIsPlaying(false);
            setIsPaused(false);
          };
          
          const pauseHandler = () => {
            addLog('Transport paused event received');
            setIsPaused(true);
            // Keep isPlaying true so we know we can resume
          };
          
          const resumeHandler = () => {
            addLog('Transport resumed event received');
            setIsPaused(false);
            setIsPlaying(true); // Ensure isPlaying is true when resuming
          };
          
          // Register handlers and store unsubscribe functions
          const unsubs = [
            eventBus.on('transport:start', startHandler),
            eventBus.on('transport:stop', stopHandler),
            eventBus.on('transport:pause', pauseHandler),
            eventBus.on('transport:resume', resumeHandler),
            eventBus.on('transport:test', (data) => {
              addLog('Test event received');
            })
          ];
          
          // Add debug logging for all known transport events
          const allEvents = ['transport:start', 'transport:stop', 'transport:pause', 'transport:resume', 
                            'transport:seek', 'transport:tempo-change', 'transport:timing-update'];
          allEvents.forEach(eventName => {
            eventBus.on(eventName, (data) => {
              // Skip timing-update events to reduce console spam
              if (eventName !== 'transport:timing-update') {
                addLog(`Debug event: ${eventName}`);
              }
            });
          });
          
          // Store for cleanup if needed
          (window as any).__transportEventUnsubs = unsubs;
          
          addLog('Transport event handlers registered');
          
          // Test event emission
          setTimeout(() => {
            eventBus.emit('transport:test', { message: 'Test event' });
          }, 1000);
          
          addLog('CoreServices detected and loaded (AudioContext may be suspended)');
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      if (attempts >= 30) {
        console.error('CoreServices not found after 30 attempts');
        addLog('ERROR: CoreServices not available after 3 seconds');
      }
    };
    
    checkServices();
    
    return () => {
      if (positionInterval.current) {
        clearInterval(positionInterval.current);
      }
      // Stop background loading on unmount
      if (backgroundLoader) {
        backgroundLoader.stopBackgroundLoading();
        addLog('🛑 Stopped automatic background loading on component unmount');
      }
      // Don't dispose CoreServices - it's managed by AudioProvider
    };
  }, []);
  
  // Update position and metrics when playing
  useEffect(() => {
    console.log('Position update effect triggered:', { transport: !!transport, isPlaying, isPaused });
    
    if (transport && isPlaying && !isPaused) {
      // Clear any existing interval first
      if (positionInterval.current) {
        clearInterval(positionInterval.current);
      }
      
      addLog('Starting position update interval');
      positionInterval.current = window.setInterval(() => {
        const state = transport.getState();
        
        // Check if transport stopped but UI hasn't updated
        if (state === 'stopped' && isPlaying) {
          addLog('WARNING: Transport stopped but UI shows playing, fixing...');
          setIsPlaying(false);
          return;
        }
        
        // Check if transport paused but UI hasn't updated
        if (state === 'paused' && !isPaused) {
          addLog('WARNING: Transport paused but UI shows not paused, fixing...');
          setIsPaused(true);
          return;
        }
        
        // Get musical position for display
        const musicalPos = transport.getMusicalPosition ? transport.getMusicalPosition() : transport.getPosition();
        
        // Position update debugging removed for cleaner console
        
        // If we got a number instead of musical position, convert it
        if (typeof musicalPos === 'number') {
          // Convert seconds to bars:beats:sixteenths
          const beatsPerBar = 4;
          const secondsPerBeat = 60 / tempo;
          const totalBeats = musicalPos / secondsPerBeat;
          const bars = Math.floor(totalBeats / beatsPerBar);
          const beats = Math.floor(totalBeats % beatsPerBar);
          const sixteenths = Math.floor((totalBeats % 1) * 4);
          
          setPosition({ bars, beats, sixteenths, ticks: 0 });
        } else {
          setPosition(musicalPos);
        }
        
        setMetrics(transport.getMetrics());
      }, 50); // 20Hz update
      
      console.log('Position interval started:', !!positionInterval.current);
    } else {
      if (positionInterval.current) {
        addLog(`Stopping position update interval (isPaused: ${isPaused}, isPlaying: ${isPlaying})`);
        clearInterval(positionInterval.current);
        positionInterval.current = null;
      }
    }
    
    return () => {
      if (positionInterval.current) {
        console.log('Cleanup: clearing position interval');
        clearInterval(positionInterval.current);
        positionInterval.current = null;
      }
    };
  }, [transport, isPlaying, isPaused, tempo]);
  
  const handleStart = async () => {
    
    try {
      addLog(`handleStart called - audioInitialized: ${audioInitialized}`);
      
      // Get CoreServices from global singleton
      const services = (window as any).__globalCoreServices as CoreServices;
      if (!services) {
        addLog('ERROR: Global CoreServices not available');
        throw new Error('Global CoreServices not available');
      }
      
      // Ensure CoreServices is fully initialized (with AudioContext) on first play
      if (!audioInitialized) {
        addLog('First play - ensuring full CoreServices initialization with user gesture...');
        await services.initialize();
        addLog('CoreServices fully initialized with AudioContext');
        setAudioInitialized(true);
      }
      
      // Get transport
      const currentTransport = services.getUnifiedTransport();
      if (!currentTransport) {
        addLog('ERROR: No transport available!');
        throw new Error('No transport available');
      }
      
      // Check if we're paused and should resume instead of start
      const currentState = currentTransport.getState();
      console.log('Current transport state:', currentState, 'isPaused:', isPaused);
      
      if (isPaused && currentState === 'paused') {
        addLog('Resuming paused transport...');
        await currentTransport.resume();
        addLog('Transport resumed successfully');
        
        // Manually update state if event doesn't fire
        setTimeout(() => {
          const newState = currentTransport.getState();
          if (newState === 'playing' && isPaused) {
            setIsPaused(false);
            setIsPlaying(true);
          }
        }, 100);
      } else {
        // Start the transport - it will handle AudioContext resume internally
        addLog('Starting transport...');
        await currentTransport.start();
        
        // Check the actual state after starting
        const transportState = currentTransport.getState();
        addLog(`Transport state after start: ${transportState}`);
        
        // Get Tone.Transport state as well
        const tone = services.getAudioEngine()?.getTone();
        if (tone) {
          addLog(`Tone.Transport.state: ${tone.Transport.state}`);
          addLog(`Tone.Transport.seconds: ${tone.Transport.seconds}`);
        }
        
        addLog('Transport started successfully');
        
        // The event handler should update isPlaying, but check just in case
        if (transportState === 'playing' && !isPlaying) {
          addLog('WARNING: Transport is playing but UI not updated, forcing update');
          setIsPlaying(true);
        }
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start';
      setError(errorMessage);
      addLog(`Error starting: ${errorMessage}`);
    }
  };
  
  const handleStop = async () => {
    if (!transport) return;
    try {
      addLog('Stopping transport...');
      await transport.stop();
      addLog('Transport stopped successfully');
      
      // Manually reset state in case event doesn't fire
      setTimeout(() => {
        const newState = transport.getState();
        if (newState === 'stopped' && (isPlaying || isPaused)) {
          setIsPlaying(false);
          setIsPaused(false);
        }
      }, 100);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop';
      setError(errorMessage);
      addLog(`Error stopping: ${errorMessage}`);
    }
  };
  
  const handlePause = async () => {
    if (!transport) return;
    try {
      addLog('Pausing transport...');
      await transport.pause();
      addLog('Transport pause command sent');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to pause';
      setError(errorMessage);
      addLog(`Error pausing: ${errorMessage}`);
    }
  };
  
  const handleTempoChange = (value: number[]) => {
    if (!transport) return;
    const newTempo = value[0];
    setTempo(newTempo);
    transport.setTempo(newTempo);
  };
  
  const scheduleTestEvent = () => {
    if (!transport) return;
    
    const eventId = transport.scheduleEvent({
      time: transport.getPosition().bars * 4 + 2, // 2 seconds from now
      callback: (time) => {
        addLog(`Test event fired at audio time: ${time.toFixed(3)}s`);
      },
      priority: 'high',
      metadata: { test: true }
    });
    
    addLog(`Scheduled test event with ID: ${eventId}`);
  };
  
  const scheduleRepeatingEvent = () => {
    if (!transport) return;
    
    const eventId = transport.scheduleRepeat(
      (time) => {
        addLog(`Repeating event at ${time.toFixed(3)}s`);
      },
      '1m', // Every measure
      undefined,
      'normal'
    );
    
    addLog(`Scheduled repeating event with ID: ${eventId}`);
  };
  
  // Background sample loading functions
  const startBackgroundLoading = () => {
    if (!backgroundLoader) {
      addLog('BackgroundLoader not initialized');
      return;
    }
    
    setIsBackgroundLoading(true);
    addLog('Starting background sample loading...');
    
    backgroundLoader.startBackgroundLoading({
      priority: 'all',
      maxIdleTime: 50,
      onProgress: (instrument, status) => {
        setSampleLoadingProgress(prev => ({
          ...prev,
          [instrument]: status
        }));
        addLog(`${instrument}: ${status.quality} (${status.progress}%)`); 
      }
    });
  };
  
  const stopBackgroundLoading = () => {
    if (!backgroundLoader) return;
    
    backgroundLoader.stopBackgroundLoading();
    setIsBackgroundLoading(false);
    addLog('Background loading stopped');
  };
  
  const checkPreloadedSamples = () => {
    if (!backgroundLoader) {
      addLog('BackgroundLoader not initialized');
      return;
    }
    
    const instruments = ['harmony', 'drums', 'bass', 'metronome'];
    instruments.forEach(inst => {
      const status = backgroundLoader.getSampleStatus(inst);
      const hasEssential = backgroundLoader.hasEssentialSamples(inst);
      const preloaded = backgroundLoader.getPreloadedSamples(inst);
      
      addLog(`${inst}: ${status.quality} quality, ${status.progress}% loaded, essential: ${hasEssential}, preloaded: ${!!preloaded}`);
    });
    
    // Check global variables
    const globals = {
      harmony: !!(window as any).__preloadedHarmonySamples,
      chordProcessor: !!(window as any).__preloadedChordProcessor,
      drumPads: !!(window as any).__preloadedDrumPads,
      metronome: !!(window as any).__preloadedMetronome
    };
    
    addLog(`Global samples: ${JSON.stringify(globals)}`);
  };
  
  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">UnifiedTransport Test</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Transport Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Transport Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button 
                onClick={handleStart} 
                disabled={!transport || (isPlaying && !isPaused)}
              >
                {isPaused ? 'Resume' : 'Play'}
              </Button>
              <Button onClick={handleStop} disabled={!transport || (!isPlaying && !isPaused)}>
                Stop
              </Button>
              <Button 
                onClick={handlePause}
                disabled={!transport || !isPlaying || isPaused}
              >
                Pause
              </Button>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Pause/Resume Quantum (Professional DAW precision)</label>
              <div className="flex gap-2 flex-wrap">
                {['128n', '64n', '32n', '16n', '8n', '4n', '2n', '1n'].map(quantum => (
                  <Button
                    key={quantum}
                    size="sm"
                    variant={transport?.getPauseResumeQuantum() === quantum ? 'default' : 'outline'}
                    onClick={() => {
                      if (transport) {
                        transport.setPauseResumeQuantum(quantum);
                        addLog(`Pause/Resume quantum set to ${quantum}`);
                      }
                    }}
                    disabled={!transport}
                  >
                    {quantum}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-gray-500">
                128n = highest precision (1/128 note), 1n = lowest precision (whole note)
              </p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Professional Features</label>
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant={transport?.useHardwareClock ? 'default' : 'outline'}
                  onClick={() => {
                    if (transport) {
                      transport.enableHardwareClockSync(!transport.useHardwareClock);
                      addLog(`Hardware clock sync ${transport.useHardwareClock ? 'disabled' : 'enabled'}`);
                    }
                  }}
                  disabled={!transport}
                >
                  🔧 Hardware Clock Sync
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (transport) {
                      const newTime = transport.preBufferTime === 0.1 ? 0.2 : 0.1;
                      transport.setPreBufferTime(newTime);
                      addLog(`Pre-buffer time set to ${newTime * 1000}ms`);
                    }
                  }}
                  disabled={!transport}
                >
                  📦 Pre-buffer: {transport ? `${transport.preBufferTime * 1000}ms` : '100ms'}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Hardware sync: Uses AudioContext clock for sample-accurate timing
              </p>
            </div>
            
            <div className="space-y-2">
              <label>Tempo: {tempo} BPM</label>
              <Slider
                value={[tempo]}
                onValueChange={handleTempoChange}
                min={60}
                max={200}
                step={1}
                disabled={!transport}
              />
            </div>
            
            <div className="space-y-2">
              <p className="font-mono text-sm">
                Position: {position.bars}:{position.beats}:{position.sixteenths}
              </p>
              <p className="text-sm text-gray-600">
                State: {isPaused ? 'Paused' : isPlaying ? 'Playing' : 'Stopped'}
              </p>
            </div>
          </CardContent>
        </Card>
        
        {/* Timing Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Timing Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics ? (
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-gray-600">Stability</p>
                    <p className={`font-mono text-lg ${metrics.stability > 95 ? 'text-green-600' : metrics.stability > 90 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {metrics.stability.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Avg Drift</p>
                    <p className={`font-mono text-lg ${Math.abs(metrics.avgDrift) < 1 ? 'text-green-600' : Math.abs(metrics.avgDrift) < 3 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {metrics.avgDrift > 0 ? '+' : ''}{metrics.avgDrift.toFixed(2)}ms
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Max Drift</p>
                    <p className="font-mono text-lg">
                      {metrics.maxDrift.toFixed(2)}ms
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Jitter</p>
                    <p className="font-mono text-lg">
                      {metrics.jitter.toFixed(2)}ms
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Update Rate</p>
                    <p className="font-mono text-lg">
                      {metrics.updateRate.toFixed(1)}Hz
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Buffer Health</p>
                    <p className={`font-mono text-lg ${metrics.bufferHealth > 80 ? 'text-green-600' : metrics.bufferHealth > 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {metrics.bufferHealth.toFixed(0)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">CPU Load</p>
                    <p className={`font-mono text-lg ${metrics.cpuLoad < 25 ? 'text-green-600' : metrics.cpuLoad < 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {metrics.cpuLoad.toFixed(0)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Events</p>
                    <p className="font-mono text-lg">
                      {metrics.totalEvents} / {metrics.missedEvents}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">Start transport to see metrics</p>
            )}
          </CardContent>
        </Card>
        
        {/* Event Scheduling */}
        <Card>
          <CardHeader>
            <CardTitle>Event Scheduling</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button onClick={scheduleTestEvent} disabled={!transport || !isPlaying} size="sm">
              Schedule Test Event (2s)
            </Button>
            <Button onClick={scheduleRepeatingEvent} disabled={!transport || !isPlaying} size="sm">
              Schedule Repeating Event (1m)
            </Button>
          </CardContent>
        </Card>
        
        {/* Event Log */}
        <Card>
          <CardHeader>
            <CardTitle>Event Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-900 text-gray-100 p-3 rounded font-mono text-xs space-y-1 h-64 overflow-y-auto">
              {logs.map((log, i) => (
                <div key={i}>{log}</div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        {/* Background Sample Loading Test */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Background Sample Loading Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 mb-4">
              <Button 
                onClick={startBackgroundLoading} 
                disabled={!backgroundLoader || isBackgroundLoading}
                size="sm"
              >
                Restart Loading (Manual)
              </Button>
              <Button 
                onClick={stopBackgroundLoading} 
                disabled={!backgroundLoader || !isBackgroundLoading}
                size="sm"
                variant="secondary"
              >
                Stop Loading
              </Button>
              <Button 
                onClick={checkPreloadedSamples} 
                disabled={!backgroundLoader}
                size="sm"
                variant="outline"
              >
                Check Loaded Samples
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2">Loading Progress</h4>
                <div className="space-y-2">
                  {['harmony', 'drums', 'bass', 'metronome'].map(instrument => {
                    const status = sampleLoadingProgress[instrument] || { 
                      loaded: false, 
                      quality: 'none', 
                      progress: 0 
                    };
                    return (
                      <div key={instrument} className="flex items-center gap-2">
                        <span className="w-24 text-sm">{instrument}:</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all ${
                              status.quality === 'premium' ? 'bg-green-600' :
                              status.quality === 'standard' ? 'bg-blue-600' :
                              status.quality === 'essential' ? 'bg-yellow-600' :
                              'bg-gray-400'
                            }`}
                            style={{ width: `${status.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 w-20">
                          {status.quality} ({status.progress}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Overall Status</h4>
                <div className="space-y-1 text-sm">
                  <p>Loading: {isBackgroundLoading ? 'Active' : 'Inactive'}</p>
                  <p>Overall Progress: {backgroundLoader?.getOverallProgress() || 0}%</p>
                  <p className="text-xs text-gray-600 mt-2">
                    Background loading starts automatically on page load using requestIdleCallback 
                    to progressively load samples without affecting page performance.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { AudioProvider } from '@/domains/playback/providers/AudioProvider';

export default function TestUnifiedTransportPage() {
  return (
    <AudioProvider>
      <TestUnifiedTransportContent />
    </AudioProvider>
  );
}