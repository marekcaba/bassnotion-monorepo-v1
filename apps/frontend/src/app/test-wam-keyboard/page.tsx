'use client';

/**
 * Test page for WAM Keyboard Plugin
 * 
 * Tests the keyboard plugin with track system integration
 */

import { useState, useEffect } from 'react';
import { useTrack } from '@/domains/playback/hooks/useTrack';
import { useWAMPlugin } from '@/domains/playback/hooks/useWAMPlugin';
import { Card } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';

// Test chord progressions
const TEST_PROGRESSIONS = {
  'C Major': [
    { notes: [60, 64, 67], velocity: 80, duration: 1 }, // C
    { notes: [65, 69, 72], velocity: 80, duration: 1 }, // F
    { notes: [67, 71, 74], velocity: 80, duration: 1 }, // G
    { notes: [60, 64, 67], velocity: 80, duration: 1 }, // C
  ],
  'Am Blues': [
    { notes: [57, 60, 64], velocity: 70, duration: 1 }, // Am
    { notes: [57, 60, 64], velocity: 70, duration: 1 }, // Am
    { notes: [62, 65, 69], velocity: 70, duration: 1 }, // Dm
    { notes: [57, 60, 64], velocity: 70, duration: 1 }, // Am
  ],
  'Jazz ii-V-I': [
    { notes: [62, 65, 69, 72], velocity: 75, duration: 0.5 }, // Dm7
    { notes: [67, 71, 74, 77], velocity: 75, duration: 0.5 }, // G7
    { notes: [60, 64, 67, 71], velocity: 75, duration: 1 },   // CMaj7
  ]
};

export default function TestWamKeyboardPage() {
  const [selectedProgression, setSelectedProgression] = useState('C Major');
  const [instrument, setInstrument] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Create a track for the keyboard
  const track = useTrack({
    trackId: 'test-keyboard-track',
    name: 'Test Keyboard',
    type: 'harmony',
    debugMode: true
  });
  
  // Load WAM plugin into the track
  const wamPlugin = useWAMPlugin({
    track: track.track,
    pluginUrl: '/wam/keyboard', // This would be the actual URL in production
    autoLoad: false, // We'll load manually for testing
    debugMode: true
  });
  
  // Initialize the plugin
  useEffect(() => {
    const loadPlugin = async () => {
      if (track.isReady && !wamPlugin.isLoaded) {
        try {
          // For testing, we'll create the plugin directly
          const { default: WamKeyboard } = await import('@/domains/playback/services/plugins/wam/WamKeyboard');
          const context = track.track?.audioContext;
          
          if (context) {
            const plugin = await WamKeyboard.createInstance(context);
            
            // Connect to track output
            if (plugin.audioNode) {
              plugin.audioNode.connect(context.destination);
            }
            
            // Store plugin reference
            (window as any).testKeyboardPlugin = plugin;
            
            console.log('WAM Keyboard plugin loaded successfully', plugin);
          }
        } catch (error) {
          console.error('Failed to load WAM Keyboard plugin:', error);
        }
      }
    };
    
    loadPlugin();
  }, [track.isReady, wamPlugin.isLoaded]);
  
  const handlePlayProgression = async () => {
    const plugin = (window as any).testKeyboardPlugin;
    if (!plugin || !plugin.audioNode) return;
    
    setIsPlaying(true);
    
    // Play the selected progression
    const progression = TEST_PROGRESSIONS[selectedProgression as keyof typeof TEST_PROGRESSIONS];
    const tempo = 120;
    
    plugin.audioNode.playProgression({
      chords: progression,
      loop: false,
      tempo
    });
    
    // Calculate total duration
    const totalDuration = progression.reduce((sum, chord) => sum + chord.duration, 0) * (60 / tempo) * 1000;
    
    setTimeout(() => {
      setIsPlaying(false);
    }, totalDuration);
  };
  
  const handleInstrumentChange = async (value: string) => {
    const instrumentIndex = parseInt(value);
    setInstrument(instrumentIndex);
    
    const plugin = (window as any).testKeyboardPlugin;
    if (plugin && plugin.audioNode) {
      await plugin.audioNode.setParameterValues({ instrument: instrumentIndex });
    }
  };
  
  const handlePlayNote = (note: number) => {
    const plugin = (window as any).testKeyboardPlugin;
    if (plugin && plugin.audioNode) {
      plugin.audioNode.triggerNote(note, 80);
      setTimeout(() => {
        plugin.audioNode.releaseNote(note);
      }, 500);
    }
  };
  
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">WAM Keyboard Plugin Test</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Track Status</h2>
          <div className="space-y-2">
            <p>Track Ready: {track.isReady ? '✅' : '⏳'}</p>
            <p>Track ID: {track.track?.id || 'Not created'}</p>
            <p>Plugin Status: {wamPlugin.isLoaded ? '✅ Loaded' : '⏳ Loading...'}</p>
            <p>Audio Context: {track.track?.audioContext ? '✅' : '❌'}</p>
          </div>
        </Card>
        
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Plugin Controls</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Instrument</label>
              <Select value={instrument.toString()} onValueChange={handleInstrumentChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Salamander Grand Piano</SelectItem>
                  <SelectItem value="1">Fender Rhodes</SelectItem>
                  <SelectItem value="2">Wurlitzer EP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Chord Progression</label>
              <Select value={selectedProgression} onValueChange={setSelectedProgression}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(TEST_PROGRESSIONS).map(name => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button 
              onClick={handlePlayProgression} 
              disabled={!track.isReady || isPlaying}
              className="w-full"
            >
              {isPlaying ? 'Playing...' : 'Play Progression'}
            </Button>
          </div>
        </Card>
        
        <Card className="p-6 md:col-span-2">
          <h2 className="text-xl font-semibold mb-4">Virtual Keyboard</h2>
          <div className="flex gap-2 flex-wrap">
            {[60, 62, 64, 65, 67, 69, 71, 72].map(note => (
              <Button
                key={note}
                onClick={() => handlePlayNote(note)}
                disabled={!track.isReady}
                variant="outline"
                className="w-16 h-16"
              >
                {['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'][note % 12 === 0 ? 0 : note % 12 === 2 ? 1 : note % 12 === 4 ? 2 : note % 12 === 5 ? 3 : note % 12 === 7 ? 4 : note % 12 === 9 ? 5 : note % 12 === 11 ? 6 : 7]}
              </Button>
            ))}
          </div>
        </Card>
        
        <Card className="p-6 md:col-span-2">
          <h2 className="text-xl font-semibold mb-4">Debug Info</h2>
          <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto">
            {JSON.stringify({
              trackReady: track.isReady,
              pluginLoaded: wamPlugin.isLoaded,
              isPlaying: track.isPlaying,
              tempo: track.tempo,
              currentTime: track.currentTime,
              instrument: ['Salamander', 'Rhodes', 'Wurlitzer'][instrument]
            }, null, 2)}
          </pre>
        </Card>
      </div>
    </div>
  );
}