/**
 * AudioEnabledTutorial - Universal Audio Integration for Tutorial Pages
 * Enhanced Platform Audio Integration - Phase 2
 * 
 * Wraps tutorial pages with full audio capabilities:
 * ✅ Same UnifiedTransport system as test pages
 * ✅ Same BackgroundSampleLoader automatic loading
 * ✅ Same professional timing/sync features
 * ✅ Same AudioContext management
 * ✅ PLUS existing widget synchronization
 * 
 * Ensures tutorial pages work identically to your test-unified-transport page.
 */

import React, { useEffect, useState } from 'react';
import { AudioProvider } from '@/domains/playback/providers/AudioProvider';
import { BackgroundSampleLoader } from '@/domains/playback/services/BackgroundSampleLoader';
import { YouTubeWidgetPage } from './YouTubeWidgetPage';
import type { Tutorial } from '@bassnotion/contracts';

interface AudioEnabledTutorialProps {
  tutorialData: Tutorial;
  tutorialSlug: string;
  exercises: any[];
}

/**
 * Inner component that uses EXACT same direct polling as test-unified-transport
 * Bypasses AudioProvider to avoid React StrictMode issues
 */
function AudioEnabledTutorialContent({
  tutorialData,
  tutorialSlug, 
  exercises,
}: AudioEnabledTutorialProps) {
  // Use EXACT same state management as test-unified-transport
  const [coreServices, setCoreServices] = useState<any>(null);
  const [transport, setTransport] = useState<any>(null);
  const [backgroundLoader, setBackgroundLoader] = useState<any>(null);
  const [sampleLoadingProgress, setSampleLoadingProgress] = useState<Record<string, any>>({});
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [audioFullyInitialized, setAudioFullyInitialized] = useState(false);
  const [initializationLog, setInitializationLog] = useState<string[]>([]);
  
  // Widget timing metrics
  const [widgetTimings, setWidgetTimings] = useState<Map<string, any>>(new Map());
  const [transportMetrics, setTransportMetrics] = useState<any>({
    drift: 0,
    jitter: 0,
    frameRate: 0,
    audioLatency: 0,
    updateInterval: 0,
  });
  const driftHistoryRef = React.useRef<Map<string, number[]>>(new Map());
  const lastTransportUpdateRef = React.useRef<number>(0);
  const frameCountRef = React.useRef<number>(0);
  const frameTimestampRef = React.useRef<number>(performance.now());

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour12: false, 
      fractionalSecondDigits: 3 
    });
    setInitializationLog(prev => [...prev.slice(-9), `[${timestamp}] ${message}`]);
  };

  // Initialize core services - EXACT same pattern as test-unified-transport
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
      onProgress: (instrument: string, status: any) => {
        setSampleLoadingProgress(prev => ({
          ...prev,
          [instrument]: status
        }));
        addLog(`📊 Auto-load ${instrument}: ${status.quality} (${status.progress}%)`); 
      }
    }).catch((error: any) => {
      addLog(`❌ Auto-load failed: ${error.message}`);
    });
    
    // Try to get CoreServices if available - EXACT same polling as test page
    const checkServices = async () => {
      // Also listen for the audioServicesReady event
      const serviceReadyHandler = () => {
        addLog('🎉 audioServicesReady event fired!');
      };
      window.addEventListener('audioServicesReady', serviceReadyHandler);
      
      let attempts = 0;
      while (attempts < 30) {
        // Debug what's available on window
        if (attempts === 0 || attempts % 5 === 0) {
          addLog(`🔍 Attempt ${attempts + 1}: Checking for CoreServices...`);
          addLog(`Global vars: __globalCoreServices=${!!((window as any).__globalCoreServices)}, __coreServices=${!!((window as any).__coreServices)}`);
        }
        
        if ((window as any).__globalCoreServices) {
          const services = (window as any).__globalCoreServices;
          setCoreServices(services);
          
          // Wait for UnifiedTransport to be available
          try {
            const unifiedTransport = services.getUnifiedTransport();
            setTransport(unifiedTransport);
            
            addLog('✅ CoreServices detected and loaded');
            setAudioInitialized(true);
            
            // Check if services are fully initialized (including AudioEngine)
            // The AudioProvider pre-initializes but doesn't create AudioContext
            if (services.isReady()) {
              addLog('🎉 AudioEngine already initialized');
              setAudioFullyInitialized(true);
            } else {
              addLog('⏳ Audio will be enabled when user clicks play button');
              // Subscribe to initialization event
              const eventBus = services.getEventBus();
              const unsubscribe = eventBus.on('core-services:initialized', () => {
                addLog('🎉 CoreServices fully initialized event received');
                setAudioFullyInitialized(true);
                unsubscribe();
              });
            }
            
            // Store references globally for debugging (same pattern as test page)
            (window as any).__tutorialCoreServices = services;
            (window as any).__tutorialTransport = unifiedTransport;
            (window as any).__tutorialSampleLoader = loader;
            
            break;
          } catch (error) {
            // Services not ready yet, continue polling
            if (attempts === 0) {
              addLog('⏳ Waiting for services to initialize...');
            }
          }
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      if (attempts >= 30) {
        console.error('CoreServices not found after 30 attempts');
        addLog('❌ ERROR: CoreServices not available after 3 seconds');
        addLog('💡 Check if AudioProvider is properly initializing CoreServices');
      }
      
      // Clean up event listener
      window.removeEventListener('audioServicesReady', serviceReadyHandler);
    };
    
    checkServices();
    
    return () => {
      // Stop background loading on unmount
      if (backgroundLoader) {
        backgroundLoader.stopBackgroundLoading();
        addLog('🛑 Stopped automatic background loading on component unmount');
      }
      // Don't dispose CoreServices - it's managed by AudioProvider
    };
  }, []);

  // Track widget timing events
  useEffect(() => {
    if (!coreServices) return;

    const eventBus = coreServices.getEventBus();
    const unsubscribers: (() => void)[] = [];

    // Calculate frame rate every second
    const frameRateInterval = setInterval(() => {
      const now = performance.now();
      const deltaTime = now - frameTimestampRef.current;
      if (deltaTime > 0) {
        const frameRate = (frameCountRef.current / deltaTime) * 1000;
        setTransportMetrics(prev => ({ ...prev, frameRate: Math.round(frameRate) }));
        frameCountRef.current = 0;
        frameTimestampRef.current = now;
      }
    }, 1000);

    // Listen for transport updates
    unsubscribers.push(
      eventBus.on('transport:position', (position: any) => {
        const now = performance.now();
        
        // Calculate update interval
        if (lastTransportUpdateRef.current > 0) {
          const interval = now - lastTransportUpdateRef.current;
          setTransportMetrics(prev => ({ ...prev, updateInterval: Math.round(interval) }));
        }
        lastTransportUpdateRef.current = now;
        
        frameCountRef.current++;
      })
    );

    // Listen for widget timing events
    unsubscribers.push(
      eventBus.on('widget:timing', (data: any) => {
        const { widgetId, transportTime, widgetTime, eventType, drift: providedDrift } = data;
        // Use provided drift if available, otherwise calculate
        const drift = providedDrift !== undefined ? Math.abs(providedDrift) : Math.abs((transportTime - widgetTime) * 1000);
        
        // Update drift history for this widget
        const history = driftHistoryRef.current.get(widgetId) || [];
        history.push(drift);
        if (history.length > 100) history.shift(); // Keep last 100 samples
        driftHistoryRef.current.set(widgetId, history);
        
        // Calculate jitter (standard deviation of drift)
        if (history.length > 1) {
          const mean = history.reduce((a, b) => a + b, 0) / history.length;
          const variance = history.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / history.length;
          const jitter = Math.sqrt(variance);
          
          setWidgetTimings(prev => {
            const newMap = new Map(prev);
            newMap.set(widgetId, {
              lastDrift: drift,
              avgDrift: mean,
              jitter: jitter,
              eventType,
              timestamp: Date.now()
            });
            return newMap;
          });
          
          // Update overall metrics
          const allDrifts = Array.from(driftHistoryRef.current.values()).flat();
          if (allDrifts.length > 0) {
            const overallMean = allDrifts.reduce((a, b) => a + b, 0) / allDrifts.length;
            const overallVariance = allDrifts.reduce((a, b) => a + Math.pow(b - overallMean, 2), 0) / allDrifts.length;
            const overallJitter = Math.sqrt(overallVariance);
            
            setTransportMetrics(prev => ({
              ...prev,
              drift: Math.round(overallMean * 10) / 10,
              jitter: Math.round(overallJitter * 10) / 10
            }));
          }
        }
      })
    );

    // Listen for audio latency updates
    unsubscribers.push(
      eventBus.on('audio:latency', (latency: number) => {
        setTransportMetrics(prev => ({ ...prev, audioLatency: Math.round(latency * 1000) }));
      })
    );

    return () => {
      unsubscribers.forEach(unsub => unsub());
      clearInterval(frameRateInterval);
    };
  }, [coreServices]);

  // Only show loading state if CoreServices aren't even created yet
  if (!audioInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-white text-lg mb-2">Loading tutorial...</p>
          <p className="text-purple-300 text-sm">Initializing audio system</p>
        </div>
      </div>
    );
  }

  // Render tutorial with full audio integration
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Show initialization progress in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed top-4 right-4 bg-black/80 text-white p-3 rounded-lg text-xs font-mono z-50 max-w-sm max-h-96 overflow-y-auto">
          <div className="text-green-400 mb-2">🎵 Tutorial Audio System</div>
          <div className="space-y-1">
            <div>Status: {audioInitialized ? '✅ Ready' : '⏳ Loading'}</div>
            <div>AudioEngine: {audioFullyInitialized ? '🎵 Full Init' : '⚡ Pre-Init'}</div>
            <div>Transport: {transport ? '✅ Active' : '❌ None'}</div>
            <div>CoreServices: {coreServices ? '✅ Connected' : '❌ None'}</div>
            <div>Loading: {isBackgroundLoading ? '🔄 Active' : '⏸️ Stopped'}</div>
          </div>
          
          {/* Transport Metrics */}
          {audioInitialized && (
            <div className="mt-2 pt-2 border-t border-gray-600">
              <div className="text-yellow-400 mb-1">📊 Transport Metrics</div>
              <div className="space-y-1 text-xs">
                <div>Drift: {transportMetrics.drift}ms</div>
                <div>Jitter: {transportMetrics.jitter}ms</div>
                <div>Frame Rate: {transportMetrics.frameRate} fps</div>
                <div>Audio Latency: {transportMetrics.audioLatency}ms</div>
                <div>Update Interval: {transportMetrics.updateInterval}ms</div>
              </div>
            </div>
          )}
          
          {/* Widget Timing Details */}
          {widgetTimings.size > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-600">
              <div className="text-blue-400 mb-1">🎛️ Widget Timings</div>
              <div className="space-y-2 text-xs">
                {Array.from(widgetTimings.entries()).map(([widgetId, timing]) => (
                  <div key={widgetId} className="space-y-1">
                    <div className="text-gray-300">{widgetId}:</div>
                    <div className="pl-2 text-gray-400">
                      <div>Last Drift: {timing.lastDrift.toFixed(1)}ms</div>
                      <div>Avg Drift: {timing.avgDrift.toFixed(1)}ms</div>
                      <div>Jitter: {timing.jitter.toFixed(1)}ms</div>
                      <div>Event: {timing.eventType}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {initializationLog.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-600">
              {initializationLog.map((log, i) => (
                <div key={i} className="text-xs text-gray-400">{log}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tutorial content with full audio integration */}
      <YouTubeWidgetPage
        tutorialData={tutorialData}
        tutorialSlug={tutorialSlug}
        exercises={exercises}
      />
    </div>
  );
}

/**
 * AudioEnabledTutorial - Main wrapper component
 * 
 * Uses EXACT same structure as test-unified-transport:
 * 1. AudioProvider at top level (creates CoreServices)
 * 2. Content component inside (polls for CoreServices)
 * 3. Identical to TestUnifiedTransportPage structure
 */
export function AudioEnabledTutorial({
  tutorialData,
  tutorialSlug,
  exercises,
}: AudioEnabledTutorialProps) {
  return (
    <AudioProvider>
      <AudioEnabledTutorialContent
        tutorialData={tutorialData}
        tutorialSlug={tutorialSlug}
        exercises={exercises}
      />
    </AudioProvider>
  );
}