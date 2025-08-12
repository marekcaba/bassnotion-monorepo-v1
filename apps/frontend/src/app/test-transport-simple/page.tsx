'use client';

import { useState, useEffect } from 'react';
import { useToneInit } from '@/domains/playback/hooks/useToneInit';

export default function SimpleTransportTest() {
  const { isReady, Tone, Transport, startContext } = useToneInit();
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState('0:0:0');
  const [bpm, setBpm] = useState(120);

  // Update position display
  useEffect(() => {
    if (!isReady || !Transport) return;

    const interval = setInterval(() => {
      setPosition(Transport.position.toString());
    }, 50);

    return () => clearInterval(interval);
  }, [isReady, Transport]);

  const handlePlay = async () => {
    if (!isReady) return;

    // Start audio context on user gesture
    await startContext();

    if (Transport.state === 'started') {
      Transport.stop();
      setIsPlaying(false);
    } else {
      Transport.start();
      setIsPlaying(true);
    }
  };

  const handleBpmChange = (newBpm: number) => {
    if (!isReady) return;
    setBpm(newBpm);
    Transport.bpm.value = newBpm;
  };

  return (
    <div className="p-8 bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-8">Simple Transport Test</h1>
      
      <div className="space-y-4 max-w-md">
        <div className="bg-gray-800 p-4 rounded">
          <p className="mb-2">Status: {isReady ? '✅ Ready' : '⏳ Loading...'}</p>
          <p className="mb-2">Transport: {isPlaying ? '▶️ Playing' : '⏸️ Stopped'}</p>
          <p className="mb-2">Position: {position}</p>
          <p>BPM: {bpm}</p>
        </div>

        <button
          onClick={handlePlay}
          disabled={!isReady}
          className={`w-full py-3 rounded font-bold text-lg ${
            !isReady
              ? 'bg-gray-600 cursor-not-allowed'
              : isPlaying
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {!isReady ? 'Initializing...' : isPlaying ? 'Stop' : 'Play'}
        </button>

        <div className="bg-gray-800 p-4 rounded">
          <label className="block mb-2">BPM: {bpm}</label>
          <input
            type="range"
            min="60"
            max="200"
            value={bpm}
            onChange={(e) => handleBpmChange(Number(e.target.value))}
            disabled={!isReady}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}