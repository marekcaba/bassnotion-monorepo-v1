'use client';

import { useState } from 'react';
import { DrummerWidgetV2 } from '@/domains/widgets/components/YouTubeWidgetPage/components';
import { Card } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';

export default function TestDrummerV2Page() {
  const [pattern, setPattern] = useState('Rock Steady');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [tempo, setTempo] = useState(120);
  
  const handleTogglePlay = () => {
    setIsPlaying(!isPlaying);
  };
  
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">DrummerWidget V2 - Track System Test</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Test Controls</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Widget Visibility</h3>
              <Button 
                onClick={() => setIsVisible(!isVisible)}
                variant={isVisible ? "default" : "outline"}
              >
                {isVisible ? 'Hide Widget' : 'Show Widget'}
              </Button>
            </div>
            
            <div>
              <h3 className="font-medium mb-2">Playback Control</h3>
              <Button 
                onClick={handleTogglePlay}
                variant={isPlaying ? "destructive" : "default"}
                className="w-full"
              >
                {isPlaying ? 'Stop' : 'Play'}
              </Button>
            </div>
            
            <div>
              <h3 className="font-medium mb-2">Tempo Control</h3>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="60"
                  max="180"
                  value={tempo}
                  onChange={(e) => setTempo(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="w-16 text-right font-mono">{tempo} BPM</span>
              </div>
            </div>
            
            <div>
              <h3 className="font-medium mb-2">Current State</h3>
              <div className="bg-gray-100 p-3 rounded text-sm">
                <p>Playing: {isPlaying ? 'Yes' : 'No'}</p>
                <p>Pattern: {pattern}</p>
                <p>Tempo: {tempo} BPM</p>
                <p>Widget Visible: {isVisible ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">DrummerWidget V2</h2>
          {isVisible ? (
            <DrummerWidgetV2
              pattern={pattern}
              isPlaying={isPlaying}
              isVisible={isVisible}
              tempo={tempo}
              onPatternChange={setPattern}
              onToggleVisibility={() => setIsVisible(false)}
              onTogglePlay={handleTogglePlay}
            />
          ) : (
            <div className="text-center text-gray-500 py-8">
              Widget is hidden. Click "Show Widget" to display it.
            </div>
          )}
        </Card>
        
        <Card className="p-6 md:col-span-2">
          <h2 className="text-xl font-semibold mb-4">Migration Status</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-green-600">✅</span>
              <span>DrummerWidget now uses Track System</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✅</span>
              <span>Using existing WAM Drummer Plugin</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✅</span>
              <span>Pattern grid editor (kick, snare, hi-hat)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✅</span>
              <span>Multiple preset patterns</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✅</span>
              <span>Removed useWidgetSync hook</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✅</span>
              <span>Removed usePatternRegistration hook</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✅</span>
              <span>Removed widgetSingleton dependency</span>
            </div>
          </div>
        </Card>
        
        <Card className="p-6 md:col-span-2">
          <h2 className="text-xl font-semibold mb-4">Architecture Changes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium mb-2 text-red-600">Old System (Removed) ❌</h3>
              <pre className="bg-gray-100 p-3 rounded text-xs">
{`DrummerWidget
  ├── useWidgetSync
  ├── usePatternRegistration
  ├── widgetSingleton
  ├── Manual Tone.js loading
  ├── Supabase sample loading
  └── Complex pattern scheduling`}
              </pre>
            </div>
            <div>
              <h3 className="font-medium mb-2 text-green-600">New System (Current) ✅</h3>
              <pre className="bg-gray-100 p-3 rounded text-xs">
{`DrummerWidget V2
  ├── useTrack (creates drum track)
  ├── useWAMPlugin (loads drummer)
  ├── WAM Drummer Plugin
  │   ├── 16-pad MPC style
  │   ├── Sample management
  │   └── Pattern playback
  └── Track System
      ├── Volume/Pan/Mute
      ├── Effects Chain
      └── MIDI Support`}
              </pre>
            </div>
          </div>
          
          <div className="mt-4">
            <h3 className="font-medium mb-2">Key Improvements</h3>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li>Simplified architecture - plugin handles all drum logic</li>
              <li>Track system provides proper mixing capabilities</li>
              <li>No more manual Tone.js initialization</li>
              <li>Pattern editing is visual and intuitive</li>
              <li>Ready for MIDI drum pad controllers</li>
              <li>Effects can be added to the drum track</li>
            </ul>
          </div>
        </Card>
        
        <Card className="p-6 md:col-span-2">
          <h2 className="text-xl font-semibold mb-4">🎉 Migration Complete!</h2>
          <p className="mb-4">All 4 widgets have been successfully migrated to the track-based WAM system:</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 rounded">
              <div className="text-2xl mb-2">🎹</div>
              <div className="font-medium">HarmonyWidget</div>
              <div className="text-sm text-gray-600">WAM Keyboard</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded">
              <div className="text-2xl mb-2">🎵</div>
              <div className="font-medium">MetronomeWidget</div>
              <div className="text-sm text-gray-600">WAM Metronome</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded">
              <div className="text-2xl mb-2">🎸</div>
              <div className="font-medium">BassLineWidget</div>
              <div className="text-sm text-gray-600">WAM Bass</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded">
              <div className="text-2xl mb-2">🥁</div>
              <div className="font-medium">DrummerWidget</div>
              <div className="text-sm text-gray-600">WAM Drummer</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}