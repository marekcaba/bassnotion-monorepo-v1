'use client';

import { useEffect, useState } from 'react';
import { useAudio, useTransport } from '@/domains/playback/hooks';

export default function TestTransportSyncPage() {
  const { isReady: audioReady, getTone } = useAudio();
  const { start, stop, isPlaying, tempo, position } = useTransport();
  const [logs, setLogs] = useState<string[]>([]);
  const [drumLoopActive, setDrumLoopActive] = useState(false);
  
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const log = `[${timestamp}] ${message}`;
    setLogs(prev => [...prev.slice(-20), log]);
    console.log(message);
  };
  
  // Monitor Transport state
  useEffect(() => {
    const interval = setInterval(() => {
      const Tone = audioReady ? getTone() : null;
      if (Tone && Tone.Transport) {
        const state = Tone.Transport.state;
        const pos = Tone.Transport.position.toString();
        const context = Tone.context.state;
        addLog(`Transport: ${state}, Position: ${pos}, Context: ${context}`);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [audioReady, getTone]);
  
  const handlePlayToggle = async () => {
    try {
      if (isPlaying) {
        addLog('Stopping transport...');
        await stop();
      } else {
        addLog('Starting transport...');
        await start();
        
        // Create a simple drum loop to test
        const Tone = getTone();
        if (Tone && !drumLoopActive) {
          const kick = new Tone.MembraneSynth().toDestination();
          const loop = new Tone.Loop((time) => {
            kick.triggerAttackRelease('C1', '8n', time);
            addLog(`Drum hit at ${time.toFixed(3)}`);
          }, '4n');
          loop.start(0);
          setDrumLoopActive(true);
          addLog('Drum loop created and started');
        }
      }
    } catch (error) {
      addLog(`Error: ${error}`);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-8">Transport Sync Test</h1>
      
      <div className="mb-8 space-y-2">
        <p>Audio Ready: <span className={audioReady ? 'text-green-400' : 'text-red-400'}>{String(audioReady)}</span></p>
        <p>Transport Playing: <span className={isPlaying ? 'text-green-400' : 'text-red-400'}>{String(isPlaying)}</span></p>
        <p>Tempo: {tempo} BPM</p>
        <p>Position: {position.bars}:{position.beats}:{position.sixteenths}</p>
      </div>
      
      <button
        onClick={handlePlayToggle}
        className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold mb-8"
      >
        {isPlaying ? 'Stop' : 'Start'} Transport
      </button>
      
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-xl font-semibold mb-4">Logs</h2>
        <div className="space-y-1 font-mono text-sm text-gray-300 max-h-96 overflow-y-auto">
          {logs.length === 0 ? (
            <p className="text-gray-500">No logs yet...</p>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="hover:bg-gray-700 px-2 py-1 rounded">
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
