'use client';

import React, { useState, useRef } from 'react';

export default function TestDrumsIsolatedPage() {
  const [status, setStatus] = useState('Click to start');
  const [isPlaying, setIsPlaying] = useState(false);
  const toneRef = useRef<any>(null);
  const playersRef = useRef<any>({});
  const sequenceRef = useRef<any>(null);

  const initAndLoad = async () => {
    try {
      setStatus('Loading Tone.js...');
      
      // Dynamically import Tone.js
      const Tone = await import('tone');
      toneRef.current = Tone;
      
      // Resume native context
      const audioContext = Tone.context.rawContext as AudioContext;
      await audioContext.resume();
      
      setStatus(`Context: ${audioContext.state}, loading samples...`);
      
      // Load drum samples
      const samples = {
        kick: 'https://htuztkrbuewheehjspcz.supabase.co/storage/v1/object/public/audio-samples/drums/hydrogen-kits/mp3/electronic/boss-dr110/dr110kik.mp3',
        snare: 'https://htuztkrbuewheehjspcz.supabase.co/storage/v1/object/public/audio-samples/drums/hydrogen-kits/mp3/electronic/boss-dr110/dr110clp.mp3',
        hihat: 'https://htuztkrbuewheehjspcz.supabase.co/storage/v1/object/public/audio-samples/drums/hydrogen-kits/mp3/electronic/boss-dr110/dr110cht.mp3'
      };

      // Create players
      playersRef.current.kick = new Tone.Player(samples.kick).toDestination();
      playersRef.current.snare = new Tone.Player(samples.snare).toDestination();
      playersRef.current.hihat = new Tone.Player(samples.hihat).toDestination();
      
      // Wait for all to load
      await Tone.loaded();
      
      setStatus('✅ Ready! Click sounds or play pattern');
      
      // Create a simple pattern
      const pattern = [
        ['kick', 'hihat'],
        ['hihat'],
        ['snare', 'hihat'],
        ['hihat'],
        ['kick'],
        ['hihat'],
        ['snare', 'hihat'],
        []
      ];
      
      sequenceRef.current = new Tone.Sequence(
        (time, drums) => {
          console.log(`Sequence callback at time ${time}, drums:`, drums);
          drums.forEach((drum: string) => {
            const player = playersRef.current[drum];
            if (player && player.loaded) {
              player.stop();
              player.start(time);
              console.log(`  - Triggered ${drum} at ${time}`);
            } else {
              console.log(`  - ${drum} not loaded or missing`);
            }
          });
        },
        pattern,
        '8n'
      );
      
      sequenceRef.current.loop = true;
      Tone.Transport.bpm.value = 120;
      
    } catch (error) {
      setStatus(`Error: ${error}`);
      console.error(error);
    }
  };

  const playSound = (name: string) => {
    const player = playersRef.current[name];
    if (player && player.loaded) {
      player.stop();
      player.start();
      console.log(`Playing ${name}`);
    }
  };

  const togglePattern = async () => {
    if (!toneRef.current || !sequenceRef.current) return;
    
    const Tone = toneRef.current;
    
    // Ensure context is running
    const audioContext = Tone.context.rawContext as AudioContext;
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    
    if (isPlaying) {
      Tone.Transport.stop();
      sequenceRef.current.stop();
      setIsPlaying(false);
      console.log('Stopped Transport');
    } else {
      // Reset position and start
      Tone.Transport.position = 0;
      sequenceRef.current.start(0);
      Tone.Transport.start();
      setIsPlaying(true);
      console.log('Started Transport, state:', Tone.Transport.state);
      console.log('Sequence state:', sequenceRef.current.state);
      
      // Debug: Log transport events
      let beatCount = 0;
      Tone.Transport.scheduleRepeat((time) => {
        console.log(`Beat ${beatCount++} at time ${time}`);
      }, '8n');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-white mb-4">Isolated Drum Test</h1>
        
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-white mb-4">Status: {status}</div>
          
          <button
            onClick={initAndLoad}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Initialize & Load Samples
          </button>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <h2 className="text-white mb-2">Test Individual Sounds:</h2>
          <div className="space-x-2">
            <button
              onClick={() => playSound('kick')}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Kick
            </button>
            <button
              onClick={() => playSound('snare')}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Snare
            </button>
            <button
              onClick={() => playSound('hihat')}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Hi-Hat
            </button>
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <h2 className="text-white mb-2">Pattern Playback:</h2>
          <button
            onClick={togglePattern}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {isPlaying ? 'Stop' : 'Play'} Pattern
          </button>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg text-gray-300">
          <h3 className="text-white font-semibold mb-2">Instructions:</h3>
          <ol className="list-decimal list-inside space-y-1">
            <li>Click "Initialize & Load Samples"</li>
            <li>Wait for "✅ Ready!" status</li>
            <li>Test individual sounds</li>
            <li>Play the drum pattern</li>
          </ol>
        </div>
      </div>
    </div>
  );
}