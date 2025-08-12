'use client';

import { useState, useEffect } from 'react';
import { HarmonyWidgetRealPiano } from '@/domains/widgets/components/YouTubeWidgetPage/components/HarmonyWidgetRealPiano';
import { DrummerWidget } from '@/domains/widgets/components/YouTubeWidgetPage/components/DrummerWidget';

// Disable background loading for this test page IMMEDIATELY
if (typeof window !== 'undefined') {
  (window as any).DISABLE_BACKGROUND_LOADING = true;
}

export default function TestRealPiano() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progression, setProgression] = useState(['C', 'Am', 'F', 'G']);
  const [loadTimes, setLoadTimes] = useState<Record<string, number>>({});
  const [velocityLayerStatus, setVelocityLayerStatus] = useState<{
    loaded: number;
    total: number;
    layers: string[];
    phase2Time?: number;
    phase3Time?: number;
    fullLoadTime?: number;
    currentPhase: number;
    widgetStatus?: string;
  }>({ loaded: 0, total: 16, layers: [], currentPhase: 1 });
  
  useEffect(() => {
    const startTime = performance.now();
    const loadedLayers = new Set<string>();
    
    // Monitor console logs
    const originalLog = console.log;
    console.log = function(...args) {
      originalLog.apply(console, args);
      
      const message = args.join(' ');
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      
      // Track initial widget loading - look for the actual success messages
      if (message.includes('PHASE 1 COMPLETE') || 
          message.includes('✅ Phase 1 complete') || 
          message.includes('Widget ready in')) {
        // Extract time from the message if it contains it
        const timeMatch = message.match(/(\d+\.?\d*)s/);
        // Defer state update to avoid setState during render
        setTimeout(() => {
          if (timeMatch) {
            setLoadTimes(prev => ({ ...prev, piano: parseFloat(timeMatch[1]) }));
          } else {
            setLoadTimes(prev => ({ ...prev, piano: parseFloat(elapsed) }));
          }
        }, 0);
      }
      
      if (message.includes('Drum samples loaded') || message.includes('Successfully loaded') && message.includes('drum')) {
        setTimeout(() => {
          setLoadTimes(prev => ({ ...prev, drums: parseFloat(elapsed) }));
        }, 0);
      }
      
      // Track Phase 2 velocity layer loading
      if (message.includes('PHASE 2 STARTING') || 
          message.includes('PHASE 2: Loading')) {
        // Starting Phase 2
        setTimeout(() => {
          setVelocityLayerStatus(prev => ({
            ...prev,
            currentPhase: 2,
          }));
        }, 0);
      }
      
      // Track Phase 3 starting
      if (message.includes('PHASE 3 STARTING')) {
        setTimeout(() => {
          setVelocityLayerStatus(prev => ({
            ...prev,
            currentPhase: 3,
          }));
        }, 0);
      }
      
      // Track individual layer loading from HarmonyWidgetRealPiano status updates
      // Looking for patterns like:
      // "✅ Ready (5 velocity layers)" - Phase 2 complete
      // "✅ Ready (8/16 velocity layers)" - Phase 3 progress
      // "✅ Ready (Full Salamander - 16 layers)" - All phases complete
      if (message.includes('✅ Ready')) {
        setTimeout(() => {
          // Store the raw widget status for debugging
          setVelocityLayerStatus(prev => ({
            ...prev,
            widgetStatus: message,
          }));
          
          // Check for full completion first
          if (message.includes('Full Salamander')) {
            setVelocityLayerStatus(prev => ({
              ...prev,
              loaded: 16,
              total: 16,
              currentPhase: 3,
              widgetStatus: message,
            }));
          } 
          // Check for velocity layers count
          else if (message.includes('velocity layers')) {
            // Pattern 1: "✅ Ready (5 velocity layers)"
            const simpleMatch = message.match(/Ready \((\d+)\s*velocity layers\)/);
            if (simpleMatch) {
              const loaded = parseInt(simpleMatch[1]);
              setVelocityLayerStatus(prev => ({
                ...prev,
                loaded: loaded,
                total: 16, // We know it's always out of 16
                widgetStatus: message,
              }));
            }
            
            // Pattern 2: "✅ Ready (8/16 velocity layers)"
            const fractionMatch = message.match(/Ready \((\d+)\/(\d+)\s*velocity layers\)/);
            if (fractionMatch) {
              const loaded = parseInt(fractionMatch[1]);
              const total = parseInt(fractionMatch[2]);
              setVelocityLayerStatus(prev => ({
                ...prev,
                loaded: loaded,
                total: total,
                widgetStatus: message,
              }));
            }
          }
          // Check for layer count without "velocity" keyword
          else if (message.includes('layers')) {
            const layerMatch = message.match(/Ready \((\d+)(?:\/(\d+))?\s*layers\)/);
            if (layerMatch) {
              const loaded = parseInt(layerMatch[1]);
              const total = layerMatch[2] ? parseInt(layerMatch[2]) : 16;
              
              setVelocityLayerStatus(prev => ({
                ...prev,
                loaded: loaded,
                total: total,
                widgetStatus: message,
              }));
            }
          }
        }, 0);
      }
      
      // Track when Phase 2 completes
      if (message.includes('PHASE 2 COMPLETE')) {
        const timeMatch = message.match(/loaded in (\d+\.?\d*)s/);
        if (timeMatch) {
          setTimeout(() => {
            setVelocityLayerStatus(prev => ({
              ...prev,
              phase2Time: parseFloat(timeMatch[1]),
              loaded: Math.max(prev.loaded, 5), // At least 5 layers loaded after phase 2
            }));
          }, 0);
        }
      }
      
      // Track when Phase 3 completes
      if (message.includes('PHASE 3 COMPLETE')) {
        const timeMatch = message.match(/loaded in (\d+\.?\d*)s/);
        if (timeMatch) {
          setTimeout(() => {
            setVelocityLayerStatus(prev => ({
              ...prev,
              phase3Time: parseFloat(timeMatch[1]),
            }));
          }, 0);
        }
      }
      
      // Track when ALL phases complete
      if (message.includes('ALL PHASES COMPLETE')) {
        const timeMatch = message.match(/total (\d+\.?\d*)s/);
        const countMatch = message.match(/(\d+)\/16 velocity layers/);
        
        if (timeMatch) {
          setTimeout(() => {
            setVelocityLayerStatus(prev => ({
              ...prev,
              loaded: countMatch ? parseInt(countMatch[1]) : 16,
              total: 16,
              fullLoadTime: parseFloat(timeMatch[1]),
              currentPhase: 3,
            }));
          }, 0);
        }
      }
    };
    
    return () => {
      console.log = originalLog;
    };
  }, []);
  
  // Start Transport
  useEffect(() => {
    const startTransport = async () => {
      const Tone = await import('tone');
      if (Tone.Transport.state === 'stopped') {
        Tone.Transport.bpm.value = 120;
        Tone.Transport.start();
      }
    };
    startTransport();
  }, []);

  return (
    <div className="p-8 bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Real Salamander Piano Test</h1>
      
      <div className="bg-gray-800 p-4 rounded mb-6">
        <h2 className="text-xl font-semibold mb-2">Performance Metrics</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-400">Initial Load (1 layer, 7 samples):</p>
            <p className="text-2xl font-mono">
              {loadTimes.piano ? (
                loadTimes.piano < 3 ? (
                  <span className="text-green-400">✅ {loadTimes.piano}s</span>
                ) : (
                  <span className="text-red-400">❌ {loadTimes.piano}s (too slow!)</span>
                )
              ) : (
                'Loading...'
              )}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Drums:</p>
            <p className="text-2xl font-mono">
              {loadTimes.drums ? `✅ ${loadTimes.drums}s` : 'Loading...'}
            </p>
          </div>
        </div>
        
        {/* Velocity Layers Loading Progress */}
        <div className="mt-4 p-3 bg-gray-700 rounded">
          <p className="text-sm text-gray-400 mb-2">
            Velocity Layers Loading (Phase {velocityLayerStatus.currentPhase}):
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex gap-1 mb-1">
                {[...Array(velocityLayerStatus.total)].map((_, i) => (
                  <div
                    key={i}
                    className={`h-2 flex-1 rounded ${
                      i < velocityLayerStatus.loaded
                        ? i < 5 
                          ? 'bg-green-500'  // Phase 2 layers (first 5)
                          : 'bg-purple-500' // Phase 3 layers (remaining)
                        : 'bg-gray-600'
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-400">
                {velocityLayerStatus.loaded}/{velocityLayerStatus.total} layers loaded
                {velocityLayerStatus.currentPhase === 2 && ' (Phase 2: Key layers)'}
                {velocityLayerStatus.currentPhase === 3 && ' (Phase 3: Full range)'}
              </p>
            </div>
            {velocityLayerStatus.fullLoadTime && (
              <div className="text-right">
                <p className="text-xl font-mono text-purple-400">
                  {velocityLayerStatus.fullLoadTime}s
                </p>
                <p className="text-xs text-gray-400">Total time</p>
              </div>
            )}
          </div>
          
          {/* Phase timing breakdown */}
          {(velocityLayerStatus.phase2Time || velocityLayerStatus.phase3Time) && (
            <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
              <div className="bg-gray-800 p-2 rounded">
                <p className="text-gray-400">Phase 1</p>
                <p className="text-green-400 font-mono">{loadTimes.piano}s</p>
                <p className="text-gray-500">1 layer</p>
              </div>
              {velocityLayerStatus.phase2Time && (
                <div className="bg-gray-800 p-2 rounded">
                  <p className="text-gray-400">Phase 2</p>
                  <p className="text-green-400 font-mono">{velocityLayerStatus.phase2Time}s</p>
                  <p className="text-gray-500">5 layers</p>
                </div>
              )}
              {velocityLayerStatus.phase3Time && (
                <div className="bg-gray-800 p-2 rounded">
                  <p className="text-gray-400">Phase 3</p>
                  <p className="text-purple-400 font-mono">{velocityLayerStatus.phase3Time}s</p>
                  <p className="text-gray-500">10 layers</p>
                </div>
              )}
            </div>
          )}
          
          {velocityLayerStatus.fullLoadTime && (
            <p className="text-sm text-gray-300 mt-2">
              🎹 Full Salamander piano (16 velocity layers) ready in {velocityLayerStatus.fullLoadTime}s
            </p>
          )}
        </div>
        
        {loadTimes.piano && loadTimes.piano < 3 && (
          <div className="mt-4 p-3 bg-green-900/30 border border-green-500 rounded">
            <p className="text-green-400 font-semibold">
              ✅ SUCCESS! Initial piano loaded in under 3 seconds!
            </p>
          </div>
        )}
      </div>

      <div className="bg-gray-800 p-4 rounded mb-6">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={`px-6 py-3 rounded text-lg font-semibold ${
            isPlaying ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {isPlaying ? 'Stop' : 'Play'}
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">HarmonyWidget (Real Salamander Piano)</h3>
          <HarmonyWidgetRealPiano
            progression={progression}
            isPlaying={isPlaying}
            isVisible={true}
            onProgressionChange={setProgression}
            onToggleVisibility={() => {}}
          />
        </div>
        
        <div>
          <h3 className="text-lg font-semibold mb-2">DrummerWidget (Reference)</h3>
          <DrummerWidget
            pattern="Rock Steady"
            isPlaying={isPlaying}
            isVisible={true}
            onPatternChange={() => {}}
            onToggleVisibility={() => {}}
          />
        </div>
      </div>

      {/* Debug section - show raw widget status */}
      <div className="mt-8 bg-gray-800 p-4 rounded">
        <h2 className="text-xl font-semibold mb-2">Debug Info</h2>
        <div className="text-sm font-mono text-gray-400">
          <p>Current Phase: {velocityLayerStatus.currentPhase}</p>
          <p>Loaded Layers: {velocityLayerStatus.loaded}</p>
          <p>Total Layers: {velocityLayerStatus.total}</p>
          <p>Widget Status: {velocityLayerStatus.widgetStatus || 'Not set'}</p>
          <p>Phase 2 Time: {velocityLayerStatus.phase2Time || 'Not complete'}</p>
          <p>Phase 3 Time: {velocityLayerStatus.phase3Time || 'Not complete'}</p>
          <p>Full Load Time: {velocityLayerStatus.fullLoadTime || 'Not complete'}</p>
        </div>
      </div>

      <div className="mt-8 bg-gray-800 p-4 rounded">
        <h2 className="text-xl font-semibold mb-2">Progressive Loading Strategy</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <h3 className="text-lg font-semibold text-green-400 mb-2">Phase 1: Instant (&lt; 3s)</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-300">
              <li>1 velocity layer (v9 - mezzo-forte)</li>
              <li>16 key samples (sparse sampling)</li>
              <li>Covers C2-F#5 range</li>
              <li>Tone.js interpolates between samples</li>
              <li>Target: Under 3 seconds ✅</li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-yellow-400 mb-2">Phase 2: Enhanced (~10s)</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-300">
              <li>5 key velocity layers</li>
              <li>v1, v6, v10, v14, v16</li>
              <li>Basic dynamic range (pp to ff)</li>
              <li>Good velocity response</li>
              <li>Loads automatically after Phase 1</li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-purple-400 mb-2">Phase 3: Professional (~30s)</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-300">
              <li>All 16 velocity layers</li>
              <li>v1 through v16 complete</li>
              <li>Full dynamic expression</li>
              <li>Studio-quality velocity response</li>
              <li>256 total samples loaded</li>
            </ul>
          </div>
        </div>
        <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500 rounded">
          <p className="text-sm text-blue-300">
            💡 <strong>Progressive Enhancement:</strong> Users get instant playback with Phase 1, 
            enhanced dynamics with Phase 2, and professional studio quality with Phase 3 - all loading seamlessly in the background.
          </p>
        </div>
      </div>
    </div>
  );
}