'use client';

import React, { useState, useRef } from 'react';

export default function TestDrumsDebugPage() {
  const [status, setStatus] = useState('Ready to test');
  const [logs, setLogs] = useState<string[]>([]);
  const toneRef = useRef<any>(null);
  const playersRef = useRef<any>({});
  const intervalRef = useRef<any>(null);

  const addLog = (message: string) => {
    console.log(message);
    setLogs(prev => [...prev, `${new Date().toTimeString().split(' ')[0]} - ${message}`]);
  };

  const loadToneAndSamples = async () => {
    try {
      addLog('Loading Tone.js...');
      const Tone = await import('tone');
      toneRef.current = Tone;
      
      const audioContext = Tone.context.rawContext as AudioContext;
      await audioContext.resume();
      addLog(`AudioContext state: ${audioContext.state}`);
      
      const samples = {
        kick: 'https://htuztkrbuewheehjspcz.supabase.co/storage/v1/object/public/audio-samples/drums/hydrogen-kits/mp3/electronic/boss-dr110/dr110kik.mp3',
        snare: 'https://htuztkrbuewheehjspcz.supabase.co/storage/v1/object/public/audio-samples/drums/hydrogen-kits/mp3/electronic/boss-dr110/dr110clp.mp3',
        hihat: 'https://htuztkrbuewheehjspcz.supabase.co/storage/v1/object/public/audio-samples/drums/hydrogen-kits/mp3/electronic/boss-dr110/dr110cht.mp3'
      };

      for (const [name, url] of Object.entries(samples)) {
        addLog(`Loading ${name}...`);
        playersRef.current[name] = new Tone.Player({
          url,
          onload: () => addLog(`✅ ${name} loaded`),
          onerror: (err: any) => addLog(`❌ ${name} error: ${err}`)
        }).toDestination();
      }
      
      await Tone.loaded();
      addLog('All samples loaded!');
      setStatus('Ready for testing');
    } catch (error) {
      addLog(`Error: ${error}`);
    }
  };

  const testSingleSound = (name: string) => {
    const player = playersRef.current[name];
    if (!player) {
      addLog(`${name} player not found`);
      return;
    }
    
    addLog(`Testing ${name}...`);
    addLog(`  - Player loaded: ${player.loaded}`);
    addLog(`  - Player state: ${player.state}`);
    addLog(`  - Buffer duration: ${player.buffer?.duration}`);
    
    try {
      player.stop();
      player.start();
      addLog(`  ✅ ${name} triggered`);
    } catch (error) {
      addLog(`  ❌ ${name} error: ${error}`);
    }
  };

  const testRapidFire = () => {
    addLog('Testing rapid fire (3 sounds quickly)...');
    
    setTimeout(() => {
      addLog('  1. Kick');
      playersRef.current.kick?.stop();
      playersRef.current.kick?.start();
    }, 0);
    
    setTimeout(() => {
      addLog('  2. Snare');
      playersRef.current.snare?.stop();
      playersRef.current.snare?.start();
    }, 100);
    
    setTimeout(() => {
      addLog('  3. Hihat');
      playersRef.current.hihat?.stop();
      playersRef.current.hihat?.start();
    }, 200);
  };

  const testSetInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      addLog('Stopped interval');
      return;
    }

    addLog('Starting setInterval pattern...');
    let step = 0;
    const pattern = ['kick', 'hihat', 'snare', 'hihat'];
    
    intervalRef.current = setInterval(() => {
      const drum = pattern[step % pattern.length];
      const player = playersRef.current[drum];
      
      if (player && player.loaded) {
        addLog(`Step ${step}: ${drum}`);
        try {
          // Try different approaches
          player.stop();
          player.start();
        } catch (error) {
          addLog(`Error: ${error}`);
        }
      }
      
      step++;
      if (step >= 16) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        addLog('Pattern complete');
      }
    }, 250);
  };

  const testWithNow = () => {
    if (!toneRef.current) {
      addLog('Tone not loaded');
      return;
    }
    
    const Tone = toneRef.current;
    addLog('Testing with Tone.now() timing...');
    
    const kick = playersRef.current.kick;
    const snare = playersRef.current.snare;
    
    if (kick && snare) {
      const now = Tone.now();
      addLog(`Current time: ${now}`);
      
      // Schedule sounds at specific times
      kick.start(now);
      addLog(`Scheduled kick at ${now}`);
      
      snare.start(now + 0.5);
      addLog(`Scheduled snare at ${now + 0.5}`);
      
      kick.start(now + 1);
      addLog(`Scheduled kick at ${now + 1}`);
    }
  };

  const testDifferentPlayer = async () => {
    if (!toneRef.current) {
      addLog('Tone not loaded');
      return;
    }
    
    const Tone = toneRef.current;
    addLog('Creating new player for test...');
    
    const testPlayer = new Tone.Player({
      url: 'https://htuztkrbuewheehjspcz.supabase.co/storage/v1/object/public/audio-samples/drums/hydrogen-kits/mp3/electronic/boss-dr110/dr110kik.mp3',
      onload: () => {
        addLog('Test player loaded, playing...');
        testPlayer.start();
        
        // Try playing again after delay
        setTimeout(() => {
          addLog('Playing test player again...');
          testPlayer.stop();
          testPlayer.start();
        }, 500);
      }
    }).toDestination();
  };

  const clearLogs = () => setLogs([]);

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-white">Drum Debug Test</h1>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-4">
            <div className="bg-gray-800 p-4 rounded-lg">
              <h2 className="text-white mb-2">1. Initialize</h2>
              <button
                onClick={loadToneAndSamples}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Load Tone & Samples
              </button>
            </div>

            <div className="bg-gray-800 p-4 rounded-lg">
              <h2 className="text-white mb-2">2. Test Individual</h2>
              <div className="space-x-2">
                <button
                  onClick={() => testSingleSound('kick')}
                  className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  Kick
                </button>
                <button
                  onClick={() => testSingleSound('snare')}
                  className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  Snare
                </button>
                <button
                  onClick={() => testSingleSound('hihat')}
                  className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  Hihat
                </button>
              </div>
            </div>

            <div className="bg-gray-800 p-4 rounded-lg">
              <h2 className="text-white mb-2">3. Test Sequences</h2>
              <div className="space-y-2">
                <button
                  onClick={testRapidFire}
                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 block"
                >
                  Rapid Fire (setTimeout)
                </button>
                <button
                  onClick={testSetInterval}
                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 block"
                >
                  Pattern (setInterval)
                </button>
                <button
                  onClick={testWithNow}
                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 block"
                >
                  Scheduled (Tone.now)
                </button>
                <button
                  onClick={testDifferentPlayer}
                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 block"
                >
                  New Player Test
                </button>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-white">Debug Logs</h2>
              <button
                onClick={clearLogs}
                className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
              >
                Clear
              </button>
            </div>
            <div className="bg-black p-2 rounded h-96 overflow-y-auto">
              <pre className="text-green-400 text-xs font-mono">
                {logs.length > 0 ? logs.join('\n') : 'Logs will appear here...'}
              </pre>
            </div>
            <div className="text-gray-400 text-sm mt-2">
              Status: {status}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}