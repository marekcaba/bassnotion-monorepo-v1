'use client';

import { useState } from 'react';
import { HarmonyWidgetV2 } from '@/domains/widgets/components/YouTubeWidgetPage/components';
import { Card } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';

export default function TestHarmonyV2Page() {
  const [progression, setProgression] = useState(['Dm7', 'G7', 'CMaj7', 'Am7']);
  const [currentChord, setCurrentChord] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [tempo] = useState(120);
  
  const handleNextChord = () => {
    setCurrentChord((prev) => (prev + 1) % progression.length);
  };
  
  const handleProgressionChange = (newProgression: string[]) => {
    setProgression(newProgression);
    setCurrentChord(0);
  };
  
  const handleTogglePlay = () => {
    setIsPlaying(!isPlaying);
    if (!isPlaying) {
      setCurrentChord(0); // Reset to first chord when starting
    }
  };
  
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">HarmonyWidget V2 - Track System Test</h1>
      
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
              <h3 className="font-medium mb-2">Current State</h3>
              <div className="bg-gray-100 p-3 rounded text-sm">
                <p>Playing: {isPlaying ? 'Yes' : 'No'}</p>
                <p>Current Chord: {progression[currentChord]} (#{currentChord + 1})</p>
                <p>Tempo: {tempo} BPM</p>
                <p>Progression: {progression.join(' → ')}</p>
              </div>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">HarmonyWidget V2</h2>
          {isVisible ? (
            <HarmonyWidgetV2
              progression={progression}
              currentChord={currentChord}
              isPlaying={isPlaying}
              isVisible={isVisible}
              onNextChord={handleNextChord}
              onProgressionChange={handleProgressionChange}
              onToggleVisibility={() => setIsVisible(false)}
              onTogglePlay={handleTogglePlay}
              tempo={tempo}
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
              <span>HarmonyWidget now uses Track System</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✅</span>
              <span>WAM Keyboard Plugin integration</span>
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
              <span>Track-based volume/mute control</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✅</span>
              <span>Instrument switching (Piano/Rhodes/Wurlitzer)</span>
            </div>
          </div>
        </Card>
        
        <Card className="p-6 md:col-span-2">
          <h2 className="text-xl font-semibold mb-4">Architecture Changes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium mb-2 text-red-600">Old System (Removed) ❌</h3>
              <pre className="bg-gray-100 p-3 rounded text-xs">
{`HarmonyWidget
  ├── usePatternRegistration
  ├── useWidgetSync
  ├── widgetSingleton
  └── PatternScheduler`}
              </pre>
            </div>
            <div>
              <h3 className="font-medium mb-2 text-green-600">New System (Current) ✅</h3>
              <pre className="bg-gray-100 p-3 rounded text-xs">
{`HarmonyWidget V2
  ├── useTrack (creates harmony track)
  ├── useWAMPlugin (loads keyboard)
  ├── WAM Keyboard Plugin
  │   ├── Salamander Piano
  │   ├── Fender Rhodes
  │   └── Wurlitzer EP
  └── Track System
      ├── Volume/Pan/Mute
      ├── Effects Chain
      └── MIDI Support`}
              </pre>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}