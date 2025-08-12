'use client';

import React, { useState, useEffect } from 'react';
import { FourWidgetsCard } from '@/domains/widgets/components/YouTubeWidgetPage/components';
import { useWidgetPageState } from '@/domains/widgets/hooks/useWidgetPageState';
import { useTransport } from '@/domains/playback/hooks/useTransport';
import { Card } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
export default function TestTrackSystemIntegrationPage() {
  const widgetState = useWidgetPageState();
  const transport = useTransport();
  const [showDebugInfo, setShowDebugInfo] = useState(true);
  
  // Handle play button click
  const handlePlayClick = async () => {
    console.log('🎵 Play button clicked');
    
    // Use the shared audio context initialization
    const { ensureAudioContext } = await import('@/domains/playback/utils/ensureAudioContext');
    await ensureAudioContext();
    
    // Toggle playback
    widgetState.togglePlayback();
  };
  
  // Sync widget state with transport
  useEffect(() => {
    const syncPlayback = async () => {
      console.log('🎵 Sync playback effect:', {
        widgetIsPlaying: widgetState.state.isPlaying,
        transportIsPlaying: transport.isPlaying,
        transport
      });
      
      try {
        if (widgetState.state.isPlaying && !transport.isPlaying) {
          console.log('🎵 Starting transport...');
          await transport.start();
        } else if (!widgetState.state.isPlaying && transport.isPlaying) {
          console.log('🎵 Pausing transport...');
          await transport.pause();
        }
      } catch (error) {
        console.error('❌ Transport error:', error);
        // If transport isn't initialized, it might be because audio hasn't started yet
        if (error.message?.includes('not initialized')) {
          console.log('🎵 Transport not initialized, waiting for audio services...');
        }
      }
    };
    syncPlayback();
  }, [widgetState.state.isPlaying, transport.isPlaying]);
  
  // Sync tempo changes
  useEffect(() => {
    const syncTempo = async () => {
      try {
        if (widgetState.state.tempo !== transport.tempo && transport.setTempo) {
          await transport.setTempo(widgetState.state.tempo);
        }
      } catch (error) {
        console.log('Transport not ready for tempo change:', error);
      }
    };
    syncTempo();
  }, [widgetState.state.tempo, transport.tempo]);
  
  return (
    <div className="container mx-auto p-8">
        <h1 className="text-3xl font-bold mb-8">Track System Integration Test</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Main Widget Card */}
          <div className="md:col-span-2">
            <FourWidgetsCard widgetState={widgetState} />
          </div>
          
          {/* Test Controls */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Test Controls</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Global Playback</h3>
                <Button 
                  onClick={handlePlayClick}
                  variant={widgetState.state.isPlaying ? "destructive" : "default"}
                  className="w-full"
                >
                  {widgetState.state.isPlaying ? 'Stop All' : 'Play All'}
                </Button>
                <div className="mt-2 text-xs text-gray-500">
                  Transport: {transport.isPlaying ? '▶️ Playing' : '⏸️ Stopped'}
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Tempo Control</h3>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="60"
                    max="180"
                    value={widgetState.state.widgets.metronome.bpm}
                    onChange={(e) => widgetState.setTempo(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="w-16 text-right font-mono">
                    {widgetState.state.widgets.metronome.bpm} BPM
                  </span>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Debug Info</h3>
                <Button 
                  onClick={() => setShowDebugInfo(!showDebugInfo)}
                  variant="outline"
                  size="sm"
                >
                  {showDebugInfo ? 'Hide' : 'Show'} Debug Info
                </Button>
              </div>
            </div>
          </Card>
          
          {/* Status Card */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Migration Status</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-green-600">✅</span>
                <span>Track System Implemented</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600">✅</span>
                <span>WAM Plugins Created</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600">✅</span>
                <span>All 4 Widgets Migrated</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600">✅</span>
                <span>FourWidgetsCard Refactored</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600">✅</span>
                <span>Legacy Files Removed</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600">✅</span>
                <span>UnifiedTransport Cleaned</span>
              </div>
            </div>
          </Card>
          
          {/* Debug Info */}
          {showDebugInfo && (
            <Card className="p-6 md:col-span-2">
              <h2 className="text-xl font-semibold mb-4">Debug Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium mb-2">Widget States</h3>
                  <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto">
{JSON.stringify({
  metronome: {
    visible: widgetState.state.widgets.metronome.isVisible,
    bpm: widgetState.state.widgets.metronome.bpm
  },
  drummer: {
    visible: widgetState.state.widgets.drummer.isVisible,
    pattern: widgetState.state.widgets.drummer.pattern
  },
  bassLine: {
    visible: widgetState.state.widgets.bassLine.isVisible,
    pattern: widgetState.state.widgets.bassLine.pattern
  },
  harmony: {
    visible: widgetState.state.widgets.harmony.isVisible,
    progression: widgetState.state.widgets.harmony.progression
  }
}, null, 2)}
                  </pre>
                </div>
                <div>
                  <h3 className="font-medium mb-2">Track System Info</h3>
                  <pre className="bg-gray-100 p-3 rounded text-xs">
{`Architecture: Track-based WAM System
Transport: UnifiedTransport (cleaned)
Plugins:
- WamMetronome
- WamDrummer (existing)
- WamBass (placeholder)
- WamKeyboard (multi-instrument)

Legacy Removed:
- PatternScheduler ❌
- usePatternRegistration ❌
- useWidgetSync ❌
- widgetSingleton ❌
- WidgetTrackAdapter ❌`}
                  </pre>
                </div>
              </div>
            </Card>
          )}
          
          {/* Integration Test Checklist */}
          <Card className="p-6 md:col-span-2">
            <h2 className="text-xl font-semibold mb-4">Integration Test Checklist</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <h3 className="font-medium mb-2 text-sm">Metronome</h3>
                <ul className="text-xs space-y-1">
                  <li>☐ Click sounds play</li>
                  <li>☐ Tempo changes work</li>
                  <li>☐ Visual sync OK</li>
                  <li>☐ No timing drift</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium mb-2 text-sm">Drummer</h3>
                <ul className="text-xs space-y-1">
                  <li>☐ Pattern plays correctly</li>
                  <li>☐ Grid editor works</li>
                  <li>☐ Samples load OK</li>
                  <li>☐ Pattern changes work</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium mb-2 text-sm">Bass</h3>
                <ul className="text-xs space-y-1">
                  <li>☐ Placeholder synth plays</li>
                  <li>☐ Pattern selector works</li>
                  <li>☐ Articulation UI shows</li>
                  <li>☐ Ready for samples</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium mb-2 text-sm">Harmony</h3>
                <ul className="text-xs space-y-1">
                  <li>☐ Chords play correctly</li>
                  <li>☐ Instrument switch works</li>
                  <li>☐ Progression changes OK</li>
                  <li>☐ MIDI responsive</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </div>
  );
}