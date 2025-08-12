'use client';

import React, { useState, useRef } from 'react';
import * as Tone from 'tone';

export default function TestSimpleDrumsPage() {
  const [status, setStatus] = useState('Not initialized');
  const [audioState, setAudioState] = useState('unknown');
  const [debugInfo, setDebugInfo] = useState({ version: '', sampleRate: 'N/A', bpm: 'N/A' });
  const playersRef = useRef<{ [key: string]: Tone.Player }>({});

  const initAudio = async () => {
    try {
      // Start Tone.js audio context
      await Tone.start();
      const state = Tone.context.state;
      setAudioState(state);
      setStatus(`Audio context started. State: ${state}`);
      
      // Update debug info
      setDebugInfo({
        version: Tone.version,
        sampleRate: Tone.context.sampleRate.toString(),
        bpm: Tone.Transport.bpm.value.toString()
      });
      
      // Try to resume if still suspended
      if (state === 'suspended') {
        await Tone.context.resume();
        const newState = Tone.context.state;
        setAudioState(newState);
        setStatus(`Audio context resumed. State: ${newState}`);
      }
    } catch (error) {
      setStatus(`Error: ${error}`);
      console.error(error);
    }
  };

  const loadSamples = async () => {
    setStatus('Loading samples...');
    
    const samples = {
      kick: 'https://htuztkrbuewheehjspcz.supabase.co/storage/v1/object/public/audio-samples/drums/hydrogen-kits/mp3/electronic/boss-dr110/dr110kik.mp3',
      snare: 'https://htuztkrbuewheehjspcz.supabase.co/storage/v1/object/public/audio-samples/drums/hydrogen-kits/mp3/electronic/boss-dr110/dr110clp.mp3',
      hihat: 'https://htuztkrbuewheehjspcz.supabase.co/storage/v1/object/public/audio-samples/drums/hydrogen-kits/mp3/electronic/boss-dr110/dr110cht.mp3'
    };

    try {
      // Ensure audio context is running
      if (Tone.context.state === 'suspended') {
        await Tone.start();
      }

      for (const [name, url] of Object.entries(samples)) {
        playersRef.current[name] = new Tone.Player({
          url: url,
          onload: () => {
            console.log(`✅ Loaded ${name} from ${url}`);
          },
          onerror: (error) => {
            console.error(`❌ Failed to load ${name}:`, error);
          }
        }).toDestination();
      }

      // Wait for all to load
      await Tone.loaded();
      setStatus('All samples loaded!');
      setAudioState(Tone.context.state);
    } catch (error) {
      setStatus(`Error loading: ${error}`);
      console.error(error);
    }
  };

  const playSound = async (name: string) => {
    try {
      // Always try to resume context before playing
      if (Tone.context.state === 'suspended') {
        await Tone.context.resume();
        setAudioState(Tone.context.state);
      }

      const player = playersRef.current[name];
      if (player) {
        // Stop and restart the player
        player.stop();
        player.start();
        setStatus(`Playing ${name}, context: ${Tone.context.state}`);
      } else {
        setStatus(`${name} not loaded`);
      }
    } catch (error) {
      setStatus(`Error playing: ${error}`);
      console.error(error);
    }
  };

  const testSynth = async () => {
    try {
      // Ensure context is running
      if (Tone.context.state === 'suspended') {
        await Tone.context.resume();
      }

      const synth = new Tone.Synth().toDestination();
      synth.triggerAttackRelease("C4", "8n");
      setStatus(`Synth test played, context: ${Tone.context.state}`);
      setAudioState(Tone.context.state);
    } catch (error) {
      setStatus(`Error with synth: ${error}`);
    }
  };

  const forceResume = async () => {
    try {
      // Use native Web Audio API directly
      const audioContext = Tone.context.rawContext as AudioContext;
      await audioContext.resume();
      setAudioState(audioContext.state);
      setStatus(`Force resumed using native API. State: ${audioContext.state}`);
    } catch (error) {
      setStatus(`Force resume error: ${error}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-white mb-8">Simple Drum Test</h1>
        
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="text-white mb-2">Status: {status}</div>
          <div className="text-white mb-2">Audio State: {audioState}</div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg space-y-2">
          <h2 className="text-lg font-semibold text-white mb-2">1. Initialize</h2>
          <button
            onClick={initAudio}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 mr-2"
          >
            Start Audio Context
          </button>
          <button
            onClick={forceResume}
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
          >
            Force Resume (Native API)
          </button>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <h2 className="text-lg font-semibold text-white mb-2">2. Load Samples</h2>
          <button
            onClick={loadSamples}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Load Boss DR-110 Samples
          </button>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <h2 className="text-lg font-semibold text-white mb-2">3. Test Sounds</h2>
          <div className="space-x-2">
            <button
              onClick={() => playSound('kick')}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Play Kick
            </button>
            <button
              onClick={() => playSound('snare')}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Play Snare
            </button>
            <button
              onClick={() => playSound('hihat')}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Play Hi-Hat
            </button>
            <button
              onClick={testSynth}
              className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
            >
              Test Synth
            </button>
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg text-gray-300">
          <h3 className="text-white font-semibold mb-2">Debug Info:</h3>
          <div className="font-mono text-sm">
            <div>Tone.js version: {debugInfo.version || 'Not initialized'}</div>
            <div>Context sampleRate: {debugInfo.sampleRate}</div>
            <div>Transport BPM: {debugInfo.bpm}</div>
          </div>
        </div>
      </div>
    </div>
  );
}