'use client';

import { useState } from 'react';
import { BassLineWidgetV2 } from '@/domains/widgets/components/YouTubeWidgetPage/components';
import { Card } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';

export default function TestBassV2Page() {
  const [pattern, setPattern] = useState('Root-Fifth');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [tempo, setTempo] = useState(120);
  
  const handleTogglePlay = () => {
    setIsPlaying(!isPlaying);
  };
  
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">BassLineWidget V2 - Track System Test</h1>
      
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
          <h2 className="text-xl font-semibold mb-4">BassLineWidget V2</h2>
          {isVisible ? (
            <BassLineWidgetV2
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
              <span>BassLineWidget now uses Track System</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✅</span>
              <span>WAM Bass Plugin integration</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✅</span>
              <span>Multiple articulation support (Fingerstyle, Slap, Pick, Mute, Harmonic)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✅</span>
              <span>Tab notation compatibility (string/fret tracking)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-yellow-600">⏳</span>
              <span>Placeholder synth active (waiting for real bass samples)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✅</span>
              <span>Removed useWidgetSync and useAudioFretboard hooks</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✅</span>
              <span>Built-in compression for punchy bass sound</span>
            </div>
          </div>
        </Card>
        
        <Card className="p-6 md:col-span-2">
          <h2 className="text-xl font-semibold mb-4">Architecture Changes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium mb-2 text-red-600">Old System (Removed) ❌</h3>
              <pre className="bg-gray-100 p-3 rounded text-xs">
{`BassLineWidget
  ├── useWidgetSync
  ├── useAudioFretboard
  ├── Direct pattern generation
  └── Complex sync logic`}
              </pre>
            </div>
            <div>
              <h3 className="font-medium mb-2 text-green-600">New System (Current) ✅</h3>
              <pre className="bg-gray-100 p-3 rounded text-xs">
{`BassLineWidget V2
  ├── useTrack (creates bass track)
  ├── useWAMPlugin (loads bass plugin)
  ├── WAM Bass Plugin
  │   ├── Placeholder Synth (temp)
  │   ├── Ready for Samples
  │   ├── Articulations
  │   └── Compression
  └── Track System
      ├── Volume/Pan/Mute
      ├── Effects Chain
      └── MIDI Support`}
              </pre>
            </div>
          </div>
          
          <div className="mt-4">
            <h3 className="font-medium mb-2">Key Features</h3>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li>Plugin architecture ready for professional bass samples</li>
              <li>MIDI-first design for future bass controller support</li>
              <li>Tab notation support with string/fret tracking</li>
              <li>Multiple articulation techniques for realistic bass playing</li>
              <li>Built-in dynamics processing optimized for bass</li>
              <li>Placeholder synth provides immediate functionality</li>
            </ul>
          </div>
          
          <div className="mt-4 p-3 bg-yellow-50 rounded">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> The bass plugin is currently using a placeholder synthesizer. 
              Once real bass samples are recorded and uploaded to Supabase, they will automatically 
              be loaded by the plugin for authentic bass guitar sound.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}