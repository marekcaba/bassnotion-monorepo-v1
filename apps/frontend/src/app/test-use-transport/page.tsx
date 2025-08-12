'use client';

import React from 'react';
import { useTransport } from '@/domains/playback/hooks/useTransport';
import { Button } from '@/shared/components/ui/button';

export default function TestUseTransportPage() {
  const transport = useTransport();
  
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Test useTransport Hook</h1>
      
      <div className="space-y-4">
        <div className="p-4 bg-gray-100 rounded">
          <h2 className="font-semibold mb-2">Transport State</h2>
          <ul className="space-y-1 text-sm">
            <li>Playing: {transport.isPlaying ? 'Yes' : 'No'}</li>
            <li>Paused: {transport.isPaused ? 'Yes' : 'No'}</li>
            <li>Stopped: {transport.isStopped ? 'Yes' : 'No'}</li>
            <li>Tempo: {transport.tempo} BPM</li>
            <li>Position: {transport.position.bars}:{transport.position.beats}:{transport.position.sixteenths}</li>
            <li>Loop Enabled: {transport.isLoopEnabled ? 'Yes' : 'No'}</li>
          </ul>
        </div>
        
        <div className="space-y-2">
          <h2 className="font-semibold">Transport Controls</h2>
          <div className="flex gap-2">
            <Button 
              onClick={() => transport.start()} 
              disabled={transport.isPlaying}
            >
              Start
            </Button>
            <Button 
              onClick={() => transport.stop()} 
              disabled={transport.isStopped}
            >
              Stop
            </Button>
            <Button 
              onClick={() => transport.pause()} 
              disabled={!transport.isPlaying}
            >
              Pause
            </Button>
          </div>
          
          <div className="flex gap-2 mt-4">
            <Button 
              onClick={() => transport.setTempo(transport.tempo - 10)}
              variant="outline"
            >
              Tempo -10
            </Button>
            <Button 
              onClick={() => transport.setTempo(transport.tempo + 10)}
              variant="outline"
            >
              Tempo +10
            </Button>
          </div>
          
          <div className="flex gap-2 mt-4">
            <Button 
              onClick={() => transport.setLoop(0, 8)}
              variant="outline"
            >
              Set Loop 0-8
            </Button>
            <Button 
              onClick={() => transport.seekTo(0)}
              variant="outline"
            >
              Seek to Start
            </Button>
          </div>
        </div>
        
        <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded">
          <p className="text-sm text-green-800">
            ✅ If this page loads without errors and the controls work, the backward compatibility layer is functioning correctly!
          </p>
          <p className="text-xs text-green-700 mt-2">
            The useTransport hook is now using UnifiedTransport through the backward compatibility export.
          </p>
        </div>
      </div>
    </div>
  );
}