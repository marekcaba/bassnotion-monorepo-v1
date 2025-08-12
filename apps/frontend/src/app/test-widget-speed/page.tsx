'use client';

import { useState, useEffect } from 'react';
import { DrummerWidget } from '@/domains/widgets/components/YouTubeWidgetPage/components/DrummerWidget';
import { HarmonyWidgetOptimized } from '@/domains/widgets/components/YouTubeWidgetPage/components/HarmonyWidgetOptimized';
import { HarmonyWidgetFast } from '@/domains/widgets/components/YouTubeWidgetPage/components/HarmonyWidgetFast';
import { HarmonyWidget } from '@/domains/widgets/components/YouTubeWidgetPage/components/HarmonyWidget';

export default function TestWidgetSpeed() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [drumPattern, setDrumPattern] = useState('Rock Steady');
  const [progression, setProgression] = useState(['C', 'Am', 'F', 'G']);
  const [widgetVersion, setWidgetVersion] = useState<'fast' | 'optimized' | 'original'>(() => {
    // Restore selection from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('widgetVersion');
      if (saved === 'fast' || saved === 'optimized' || saved === 'original') {
        return saved;
      }
    }
    return 'fast';
  });
  const [loadTimes, setLoadTimes] = useState<Record<string, number>>({});
  
  // Track load times
  useEffect(() => {
    const startTime = performance.now();
    
    // Check when samples are loaded by monitoring console logs
    const originalLog = console.log;
    console.log = function(...args) {
      originalLog.apply(console, args);
      
      const message = args.join(' ');
      const currentTime = performance.now();
      const elapsed = ((currentTime - startTime) / 1000).toFixed(2);
      
      if (message.includes('Drum samples loaded') || message.includes('Drum samples ready') || message.includes('Successfully loaded') && message.includes('drum')) {
        setLoadTimes(prev => ({ ...prev, drums: parseFloat(elapsed) }));
      }
      
      if (message.includes('Harmony samples loaded') || message.includes('Salamander samples loaded') || 
          message.includes('Synth ready instantly') || message.includes('Ready (synth)') ||
          message.includes('Upgraded to ChordInstrumentProcessor') || message.includes('Ready (fallback)')) {
        setLoadTimes(prev => ({ ...prev, harmony: parseFloat(elapsed) }));
      }
    };
    
    return () => {
      console.log = originalLog;
    };
  }, []);

  // Mock sync props for original HarmonyWidget
  const mockSyncProps = {
    exercise: {
      chord_progression: progression,
      chord_durations: [4, 4, 4, 4],
      duration_beats: 16,
      timeSignature: { numerator: 4, denominator: 4 }
    },
    isPlaying,
    tempo: 120
  };

  return (
    <div className="p-8 bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Widget Loading Speed Comparison</h1>
      
      {/* Performance Metrics */}
      <div className="bg-gray-800 p-4 rounded mb-6">
        <h2 className="text-xl font-semibold mb-2">Load Times</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-400">DrummerWidget:</p>
            <p className="text-2xl font-mono">
              {loadTimes.drums ? `${loadTimes.drums}s` : 'Loading...'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-400">HarmonyWidget ({widgetVersion}):</p>
            <p className="text-2xl font-mono">
              {loadTimes.harmony ? `${loadTimes.harmony}s` : 'Loading...'}
            </p>
          </div>
        </div>
        
        {loadTimes.drums && loadTimes.harmony && (
          <div className="mt-4 p-2 bg-gray-700 rounded">
            <p className="text-sm">
              {loadTimes.drums < loadTimes.harmony ? (
                <span className="text-green-400">
                  ✅ DrummerWidget loaded {((loadTimes.harmony - loadTimes.drums) * 1000).toFixed(0)}ms faster
                </span>
              ) : loadTimes.harmony < loadTimes.drums ? (
                <span className="text-purple-400">
                  ✅ HarmonyWidget loaded {((loadTimes.drums - loadTimes.harmony) * 1000).toFixed(0)}ms faster
                </span>
              ) : (
                <span className="text-yellow-400">Both loaded at the same time</span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-800 p-4 rounded mb-6">
        <div className="flex gap-4 items-center">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-4 py-2 rounded ${
              isPlaying ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isPlaying ? 'Stop' : 'Play'}
          </button>
          
          <select
            value={widgetVersion}
            onChange={(e) => {
              const newVersion = e.target.value as 'fast' | 'optimized' | 'original';
              setWidgetVersion(newVersion);
              // Reset load times when switching
              setLoadTimes({});
              // Store selection in localStorage to persist across reloads
              localStorage.setItem('widgetVersion', newVersion);
            }}
            className="px-3 py-2 bg-gray-700 text-white rounded"
          >
            <option value="fast">Ultra Fast (Synth)</option>
            <option value="optimized">Optimized (With timeout)</option>
            <option value="original">Original (Slow)</option>
          </select>
          
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
          >
            Reload Page (Test Fresh)
          </button>
        </div>
      </div>

      {/* Widgets */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">DrummerWidget (Fast Loading)</h3>
          <DrummerWidget
            pattern={drumPattern}
            isPlaying={isPlaying}
            isVisible={true}
            onPatternChange={setDrumPattern}
            onToggleVisibility={() => {}}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
          />
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">
            HarmonyWidget ({
              widgetVersion === 'fast' ? 'Ultra Fast - Synth Fallback' :
              widgetVersion === 'optimized' ? 'Optimized - With Timeout' :
              'Original - Slow'
            })
          </h3>
          {widgetVersion === 'fast' ? (
            <HarmonyWidgetFast
              progression={progression}
              isPlaying={isPlaying}
              isVisible={true}
              onProgressionChange={setProgression}
              onToggleVisibility={() => {}}
              onTogglePlay={() => setIsPlaying(!isPlaying)}
            />
          ) : widgetVersion === 'optimized' ? (
            <HarmonyWidgetOptimized
              progression={progression}
              isPlaying={isPlaying}
              isVisible={true}
              onProgressionChange={setProgression}
              onToggleVisibility={() => {}}
              onTogglePlay={() => setIsPlaying(!isPlaying)}
            />
          ) : (
            <HarmonyWidget syncProps={mockSyncProps as any} />
          )}
        </div>
      </div>

      {/* Loading Strategy Comparison */}
      <div className="mt-8 bg-gray-800 p-4 rounded">
        <h2 className="text-xl font-semibold mb-2">Loading Strategy Comparison</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <h3 className="font-semibold text-green-400 mb-1">DrummerWidget Strategy ✅</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-300">
              <li>Loads Tone.js immediately on mount</li>
              <li>Checks for preloaded samples first</li>
              <li>Falls back to loading from Supabase</li>
              <li>No waiting for audio context</li>
              <li>Simple, direct initialization</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-red-400 mb-1">Original HarmonyWidget Issues ❌</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-300">
              <li>Complex initialization with multiple checks</li>
              <li>Waits for audioReady state</li>
              <li>Multiple useEffect hooks with dependencies</li>
              <li>Complex Transport state monitoring</li>
              <li>Delayed sample loading</li>
            </ul>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-green-900/20 border border-green-500 rounded">
          <h3 className="font-semibold text-green-400 mb-1">Optimized HarmonyWidget ✅</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-300 text-sm">
            <li>Uses same fast loading pattern as DrummerWidget</li>
            <li>Loads everything immediately on mount</li>
            <li>No complex state dependencies</li>
            <li>Direct sample loading without waiting</li>
            <li>Should load in under 1 second like drums</li>
          </ul>
        </div>
      </div>
    </div>
  );
}