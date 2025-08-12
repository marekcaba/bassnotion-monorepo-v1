'use client';

import React, { useState, useRef } from 'react';

export default function TestDrumsLoopPage() {
  const [status, setStatus] = useState('Click to start');
  const [isPlaying, setIsPlaying] = useState(false);
  const toneRef = useRef<any>(null);
  const playersRef = useRef<any>({});
  const loopRef = useRef<any>(null);

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
      
      // Create a Loop instead of Sequence
      let step = 0;
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
      
      loopRef.current = new Tone.Loop((time) => {
        const drums = pattern[step % pattern.length];
        console.log(`Step ${step % pattern.length}, time ${time}, drums:`, drums);
        
        drums.forEach((drum: string) => {
          const player = playersRef.current[drum];
          if (player && player.loaded) {
            // Schedule slightly ahead to avoid timing issues
            player.start(time);
            console.log(`  - Scheduled ${drum} at ${time}`);
          }
        });
        
        step++;
      }, '8n');
      
      // Set BPM
      Tone.Transport.bpm.value = 120;
      console.log('Transport BPM set to:', Tone.Transport.bpm.value);
      
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
      console.log(`Playing ${name} individually`);
    }
  };

  const togglePattern = async () => {
    if (!toneRef.current || !loopRef.current) return;
    
    const Tone = toneRef.current;
    
    // Ensure context is running
    const audioContext = Tone.context.rawContext as AudioContext;
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
      console.log('Resumed context:', audioContext.state);
    }
    
    if (isPlaying) {
      // Stop transport and loop
      loopRef.current.stop();
      Tone.Transport.stop();
      setIsPlaying(false);
      console.log('Stopped Transport and Loop');
    } else {
      // Start from beginning
      Tone.Transport.position = 0;
      console.log('Transport position reset to 0');
      
      // Start the loop first, then transport
      loopRef.current.start(0);
      Tone.Transport.start();
      
      setIsPlaying(true);
      console.log('Started Loop and Transport');
      console.log('Transport state:', Tone.Transport.state);
      console.log('Loop state:', loopRef.current.state);
      console.log('Context state:', audioContext.state);
    }
  };

  // Alternative: Use setTimeout pattern (no Transport)
  const playWithTimeout = () => {
    if (!playersRef.current.kick) {
      console.log('Players not loaded');
      return;
    }
    
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
    
    let step = 0;
    const interval = 250; // 120 BPM, 8th notes = 250ms
    
    const playStep = () => {
      if (!isPlaying) return;
      
      const drums = pattern[step % pattern.length];
      drums.forEach((drum: string) => {
        const player = playersRef.current[drum];
        if (player && player.loaded) {
          player.stop();
          player.start();
        }
      });
      
      step++;
      if (isPlaying) {
        setTimeout(playStep, interval);
      }
    };
    
    setIsPlaying(true);
    playStep();
  };

  const stopTimeout = () => {
    setIsPlaying(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-white mb-4">Drum Loop Test (Using Tone.Loop)</h1>
        
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
          <h2 className="text-white mb-2">Pattern with Tone.Loop:</h2>
          <button
            onClick={togglePattern}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {isPlaying ? 'Stop' : 'Play'} Loop Pattern
          </button>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <h2 className="text-white mb-2">Pattern with setTimeout (No Transport):</h2>
          <div className="space-x-2">
            <button
              onClick={playWithTimeout}
              className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
              disabled={isPlaying}
            >
              Play with setTimeout
            </button>
            <button
              onClick={stopTimeout}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Stop
            </button>
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg text-gray-300">
          <h3 className="text-white font-semibold mb-2">Debug Info:</h3>
          <p>Check console for detailed logs</p>
          <p>If Loop doesn't work, try setTimeout pattern</p>
        </div>
      </div>
    </div>
  );
}