'use client';

import { useState } from 'react';
import { MetronomeWidgetV2 } from '@/domains/widgets/components/YouTubeWidgetPage/components';
import { Card } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';

export default function TestMetronomeV2Page() {
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  
  const handleTogglePlay = () => {
    setIsPlaying(!isPlaying);
  };
  
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">MetronomeWidget V2 - Track System Test</h1>
      
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
                  min="40"
                  max="300"
                  value={bpm}
                  onChange={(e) => setBpm(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="w-16 text-right font-mono">{bpm} BPM</span>
              </div>
            </div>
            
            <div>
              <h3 className="font-medium mb-2">Current State</h3>
              <div className="bg-gray-100 p-3 rounded text-sm">
                <p>Playing: {isPlaying ? 'Yes' : 'No'}</p>
                <p>BPM: {bpm}</p>
                <p>Widget Visible: {isVisible ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">MetronomeWidget V2</h2>
          {isVisible ? (
            <MetronomeWidgetV2
              bpm={bpm}
              isPlaying={isPlaying}
              isVisible={isVisible}
              onBpmChange={setBpm}
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
              <span>MetronomeWidget now uses Track System</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✅</span>
              <span>WAM Metronome Plugin integration</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✅</span>
              <span>Multiple click sound presets (Classic, Electronic, Acoustic, Subtle)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✅</span>
              <span>Subdivision support (Quarter, Eighth, Triplet)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✅</span>
              <span>Removed usePatternRegistration hook</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✅</span>
              <span>Removed useWidgetSync hook</span>
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
{`MetronomeWidget
  ├── usePatternRegistration
  ├── useWidgetSync
  ├── widgetSingleton
  ├── Tone.js MembraneSynth
  └── PatternScheduler`}
              </pre>
            </div>
            <div>
              <h3 className="font-medium mb-2 text-green-600">New System (Current) ✅</h3>
              <pre className="bg-gray-100 p-3 rounded text-xs">
{`MetronomeWidget V2
  ├── useTrack (creates utility track)
  ├── useWAMPlugin (loads metronome)
  ├── WAM Metronome Plugin
  │   ├── Classic Click
  │   ├── Electronic Beep
  │   ├── Acoustic Stick
  │   └── Subtle Click
  └── Track System
      ├── Volume/Pan/Mute
      ├── Tempo Sync
      └── MIDI Clock Support`}
              </pre>
            </div>
          </div>
          
          <div className="mt-4">
            <h3 className="font-medium mb-2">Key Improvements</h3>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li>Plugin-based architecture allows for easy sound customization</li>
              <li>Track system provides proper mixing and routing capabilities</li>
              <li>MIDI clock sync support for DAW integration</li>
              <li>Reduced coupling - metronome logic contained in plugin</li>
              <li>Better performance through track-level optimization</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}