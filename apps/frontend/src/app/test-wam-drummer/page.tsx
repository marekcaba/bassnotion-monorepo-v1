'use client';

import React, { useState, useEffect } from 'react';
import { DrummerWidget } from '@/domains/widgets/components/YouTubeWidgetPage/components/DrummerWidget';
import { GlobalControlsCard } from '@/domains/widgets/components/YouTubeWidgetPage/components/GlobalControlsCard';
import { serviceRegistry } from '@/domains/playback/services/core/ServiceRegistry';
import { UnifiedTransport } from '@/domains/playback/services/core/UnifiedTransport';
import { AudioEngine } from '@/domains/playback/services/core/AudioEngine';
import { EventBus } from '@/domains/playback/services/core/EventBus';
import { WamHostManager } from '@/domains/playback/services/plugins/WamHostManager';
import { WidgetTrackAdapter } from '@/domains/playback/services/adapters/WidgetTrackAdapter';
import { EnhancedTrackManagerProcessor } from '@/domains/playback/services/plugins/EnhancedTrackManagerProcessor';

export default function TestWamDrummerPage() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [tempo, setTempo] = useState(120);
  const [systemReady, setSystemReady] = useState(false);
  const [initStatus, setInitStatus] = useState('Click "Initialize System" to start');
  const [useWamDrummer, setUseWamDrummer] = useState(true);
  const [trackSystemEnabled, setTrackSystemEnabled] = useState(true);
  const [isInitializing, setIsInitializing] = useState(false);

  const initializeSystem = async () => {
    setIsInitializing(true);
      try {
        // Initialize event bus FIRST - required by other services
        const eventBus = new EventBus();
        serviceRegistry.register('eventBus', eventBus);

        // Initialize core services
        setInitStatus('Setting up audio engine...');
        const audioEngine = new AudioEngine(eventBus);
        await audioEngine.initialize();
        serviceRegistry.register('audioEngine', audioEngine);

        // Initialize transport
        setInitStatus('Setting up transport...');
        const transport = UnifiedTransport.getInstance();
        serviceRegistry.register('transport', transport);

        // Initialize WAM host
        setInitStatus('Setting up WAM host...');
        const wamHost = WamHostManager.getInstance();
        await wamHost.initialize();
        serviceRegistry.register('wamHost', wamHost);

        if (trackSystemEnabled) {
          // Initialize track system
          setInitStatus('Setting up track system...');
          const trackManager = new EnhancedTrackManagerProcessor();
          await trackManager.initializeEnhanced();
          serviceRegistry.register('trackManager', trackManager);

          // Initialize widget-track adapter
          const widgetAdapter = new WidgetTrackAdapter();
          await widgetAdapter.initialize();
          serviceRegistry.register('widgetTrackAdapter', widgetAdapter);
        }

        setInitStatus('System ready!');
        setSystemReady(true);
        setIsInitializing(false);

        // Emit ready event
        window.dispatchEvent(new Event('audioServicesReady'));
      } catch (error) {
        console.error('Failed to initialize system:', error);
        setInitStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setIsInitializing(false);
      }
    };

  const handlePlay = () => {
    const transport = UnifiedTransport.getInstance();
    if (isPlaying) {
      transport.stop();
    } else {
      transport.start();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTempoChange = (newTempo: number) => {
    setTempo(newTempo);
    const transport = UnifiedTransport.getInstance();
    transport.setTempo(newTempo);
  };

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (systemReady) {
        const transport = UnifiedTransport.getInstance();
        transport.stop();
      }
    };
  }, [systemReady]);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold mb-8">WAM Drummer Test</h1>
        
        {/* System Status */}
        <div className="bg-slate-800 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-2">System Status</h2>
          <p className="text-sm text-slate-400 mb-4">
            {initStatus}
          </p>
          
          {!systemReady && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={useWamDrummer}
                    onChange={(e) => setUseWamDrummer(e.target.checked)}
                    disabled={isInitializing}
                    className="rounded"
                  />
                  <span>Use WAM Drummer</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={trackSystemEnabled}
                    onChange={(e) => setTrackSystemEnabled(e.target.checked)}
                    disabled={isInitializing}
                    className="rounded"
                  />
                  <span>Track System</span>
                </label>
              </div>
              
              <button
                onClick={initializeSystem}
                disabled={isInitializing}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 rounded-lg font-semibold"
              >
                {isInitializing ? 'Initializing...' : 'Initialize System'}
              </button>
            </div>
          )}
          
          {systemReady && (
            <div className="mt-2 flex gap-4">
              <span className="text-green-400">✓ System Ready</span>
              <span className="text-sm text-slate-500">
                WAM: {useWamDrummer ? 'Enabled' : 'Disabled'}, 
                Track System: {trackSystemEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          )}
        </div>

        {/* Transport Controls */}
        {systemReady && (
          <>
            <div className="bg-slate-800 rounded-lg p-4">
              <h2 className="text-xl font-semibold mb-4">Transport Controls</h2>
              <div className="flex gap-4 items-center">
                <button
                  onClick={handlePlay}
                  className="px-6 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg font-semibold"
                >
                  {isPlaying ? 'Stop' : 'Play'}
                </button>
                <div className="flex items-center gap-2">
                  <label htmlFor="tempo">Tempo:</label>
                  <input
                    id="tempo"
                    type="range"
                    min="60"
                    max="180"
                    value={tempo}
                    onChange={(e) => handleTempoChange(Number(e.target.value))}
                    className="w-32"
                  />
                  <span className="w-12 text-right">{tempo}</span>
                </div>
              </div>
            </div>

            {/* Global Controls */}
            <GlobalControlsCard 
              isPlaying={isPlaying}
              onTogglePlay={handlePlay}
            />

            {/* Drummer Widget */}
            <div className="bg-slate-800 rounded-lg p-4">
              <h2 className="text-xl font-semibold mb-4">
                Drummer Widget {useWamDrummer ? '(WAM Mode)' : '(Legacy Mode)'}
              </h2>
              <DrummerWidget
                pattern="Rock Steady"
                isVisible={true}
                onPatternChange={(pattern) => console.log('Pattern changed:', pattern)}
                onToggleVisibility={() => console.log('Toggle visibility')}
                enableWamDrummer={useWamDrummer}
              />
            </div>

            {/* Debug Info */}
            <div className="bg-slate-800 rounded-lg p-4">
              <h2 className="text-xl font-semibold mb-2">Debug Info</h2>
              <pre className="text-xs text-slate-400 overflow-auto">
                {JSON.stringify({
                  isPlaying,
                  tempo,
                  useWamDrummer,
                  trackSystemEnabled,
                  services: Object.keys(serviceRegistry['services'] || {}),
                  transport: {
                    state: UnifiedTransport.getInstance().state,
                    position: UnifiedTransport.getInstance().getCurrentPosition(),
                    tempo: UnifiedTransport.getInstance().getTempo()
                  }
                }, null, 2)}
              </pre>
            </div>
          </>
        )}
      </div>
    </div>
  );
}