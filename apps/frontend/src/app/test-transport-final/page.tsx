'use client';

import React, { useState, useRef, useEffect } from 'react';

export default function TestTransportFinalPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [method, setMethod] = useState<'transport' | 'interval' | 'hybrid'>('hybrid');
  const toneRef = useRef<any>(null);
  const playersRef = useRef<any>({});
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const transportEventsRef = useRef<number[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toTimeString().split(' ')[0];
    const logMessage = `${timestamp} - ${message}`;
    console.log('🎵', logMessage);
    setLogs(prev => [...prev.slice(-100), logMessage]);
  };

  // Initialize Tone and load samples
  const initialize = async () => {
    try {
      addLog('Loading Tone.js...');
      const Tone = await import('tone');
      toneRef.current = Tone;
      
      // Resume context
      const audioContext = Tone.context.rawContext as AudioContext;
      await audioContext.resume();
      addLog(`AudioContext state: ${audioContext.state}`);
      
      // Configure Transport
      Tone.Transport.bpm.value = 120;
      Tone.Transport.loop = true;
      Tone.Transport.loopEnd = '1m';
      addLog('Transport configured: BPM=120, Loop=1m');
      
      // Load samples
      addLog('Loading drum samples...');
      const urls = {
        kick: 'https://htuztkrbuewheehjspcz.supabase.co/storage/v1/object/public/audio-samples/drums/hydrogen-kits/mp3/electronic/boss-dr110/dr110kik.mp3',
        snare: 'https://htuztkrbuewheehjspcz.supabase.co/storage/v1/object/public/audio-samples/drums/hydrogen-kits/mp3/electronic/boss-dr110/dr110clp.mp3',
        hihat: 'https://htuztkrbuewheehjspcz.supabase.co/storage/v1/object/public/audio-samples/drums/hydrogen-kits/mp3/electronic/boss-dr110/dr110cht.mp3'
      };
      
      for (const [name, url] of Object.entries(urls)) {
        playersRef.current[name] = new Tone.Player({
          url,
          onload: () => addLog(`✅ ${name} loaded`),
          onerror: (err: any) => addLog(`❌ ${name} error: ${err}`)
        }).toDestination();
      }
      
      await Tone.loaded();
      addLog('All samples loaded!');
      
    } catch (error) {
      addLog(`Error initializing: ${error}`);
    }
  };

  // Method 1: Pure Transport scheduling
  const useTransportMethod = () => {
    if (!toneRef.current) return;
    const Tone = toneRef.current;
    
    addLog('🎯 Using PURE TRANSPORT method');
    
    // Clear any existing events
    transportEventsRef.current.forEach(id => Tone.Transport.clear(id));
    transportEventsRef.current = [];
    
    // Simple pattern: kick on beats 0 and 4, snare on 2 and 6, hihat every beat
    const pattern = [
      { time: '0:0:0', drums: ['kick', 'hihat'] },
      { time: '0:1:0', drums: ['hihat'] },
      { time: '0:2:0', drums: ['snare', 'hihat'] },
      { time: '0:3:0', drums: ['hihat'] },
      { time: '0:4:0', drums: ['kick', 'hihat'] },
      { time: '0:5:0', drums: ['hihat'] },
      { time: '0:6:0', drums: ['snare', 'hihat'] },
      { time: '0:7:0', drums: ['hihat'] },
    ];
    
    pattern.forEach(({ time, drums }) => {
      const eventId = Tone.Transport.schedule((transportTime) => {
        addLog(`Transport callback: time=${time}, transportTime=${transportTime.toFixed(3)}`);
        
        drums.forEach(drum => {
          const player = playersRef.current[drum];
          if (player && player.loaded) {
            try {
              // Try different approaches
              if (player.state === 'started') {
                player.stop(transportTime);
              }
              player.start(transportTime);
              addLog(`  ✓ Scheduled ${drum} at ${transportTime.toFixed(3)}`);
            } catch (error) {
              addLog(`  ✗ Failed to schedule ${drum}: ${error}`);
            }
          }
        });
      }, time);
      
      transportEventsRef.current.push(eventId);
    });
    
    addLog(`Scheduled ${transportEventsRef.current.length} Transport events`);
  };

  // Method 2: Pure setInterval
  const useIntervalMethod = () => {
    if (!playersRef.current.kick) return;
    
    addLog('🎯 Using PURE SETINTERVAL method');
    
    let step = 0;
    const pattern = [
      ['kick', 'hihat'],
      ['hihat'],
      ['snare', 'hihat'],
      ['hihat'],
      ['kick', 'hihat'],
      ['hihat'],
      ['snare', 'hihat'],
      ['hihat'],
    ];
    
    intervalRef.current = setInterval(() => {
      const drums = pattern[step % pattern.length];
      addLog(`Interval step ${step % 8}: ${drums.join(', ')}`);
      
      drums.forEach(drum => {
        const player = playersRef.current[drum];
        if (player && player.loaded) {
          try {
            player.stop();
            player.start();
            addLog(`  ✓ Triggered ${drum}`);
          } catch (error) {
            addLog(`  ✗ Failed to trigger ${drum}: ${error}`);
          }
        }
      });
      
      step++;
    }, 250); // 120 BPM, 8th notes
  };

  // Method 3: Hybrid - Transport for timeline, interval for triggering
  const useHybridMethod = () => {
    if (!toneRef.current || !playersRef.current.kick) return;
    const Tone = toneRef.current;
    
    addLog('🎯 Using HYBRID method (Transport timeline + interval triggering)');
    
    let lastTransportPosition = '0:0:0';
    
    // Monitor Transport position
    const positionInterval = setInterval(() => {
      const position = Tone.Transport.position;
      if (position !== lastTransportPosition) {
        addLog(`Transport position: ${position}`);
        lastTransportPosition = position;
      }
    }, 100);
    
    // Use interval for actual triggering, but sync with Transport position
    let step = 0;
    const pattern = [
      ['kick', 'hihat'],
      ['hihat'],
      ['snare', 'hihat'],
      ['hihat'],
      ['kick', 'hihat'],
      ['hihat'],
      ['snare', 'hihat'],
      ['hihat'],
    ];
    
    intervalRef.current = setInterval(() => {
      // Get Transport position for DAW-style sync
      const transportPosition = Tone.Transport.position;
      const [bars, beats] = transportPosition.split(':').map(Number);
      const expectedStep = beats % 8;
      
      // Sync step with Transport if needed
      if (Math.abs(expectedStep - (step % 8)) > 1) {
        step = expectedStep;
        addLog(`Synced step to Transport: ${step}`);
      }
      
      const drums = pattern[step % pattern.length];
      addLog(`Hybrid step ${step % 8} (Transport: ${transportPosition}): ${drums.join(', ')}`);
      
      drums.forEach(drum => {
        const player = playersRef.current[drum];
        if (player && player.loaded) {
          try {
            player.stop();
            player.start();
            addLog(`  ✓ Triggered ${drum}`);
          } catch (error) {
            addLog(`  ✗ Failed to trigger ${drum}: ${error}`);
          }
        }
      });
      
      step++;
    }, 250);
    
    // Store position interval in ref for cleanup
    (intervalRef as any).positionInterval = positionInterval;
  };

  // Start playback
  const start = async () => {
    if (!toneRef.current) {
      addLog('Tone not initialized!');
      return;
    }
    
    const Tone = toneRef.current;
    
    // Ensure context is running
    const audioContext = Tone.context.rawContext as AudioContext;
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    
    addLog(`Starting with ${method.toUpperCase()} method`);
    
    // Setup the chosen method
    switch (method) {
      case 'transport':
        useTransportMethod();
        break;
      case 'interval':
        useIntervalMethod();
        break;
      case 'hybrid':
        useHybridMethod();
        break;
    }
    
    // Start Transport (for transport and hybrid methods)
    if (method !== 'interval') {
      Tone.Transport.position = 0;
      Tone.Transport.start();
      addLog(`Transport started, state=${Tone.Transport.state}`);
    }
    
    setIsPlaying(true);
  };

  // Stop playback
  const stop = () => {
    if (!toneRef.current) return;
    const Tone = toneRef.current;
    
    // Stop Transport
    Tone.Transport.stop();
    Tone.Transport.position = 0;
    
    // Clear Transport events
    transportEventsRef.current.forEach(id => Tone.Transport.clear(id));
    transportEventsRef.current = [];
    
    // Clear interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Clear position interval (hybrid method)
    if ((intervalRef as any).positionInterval) {
      clearInterval((intervalRef as any).positionInterval);
      (intervalRef as any).positionInterval = null;
    }
    
    setIsPlaying(false);
    addLog('Stopped all playback');
  };

  // Test individual sound
  const testSound = async (drum: string) => {
    if (!toneRef.current) return;
    const Tone = toneRef.current;
    
    const audioContext = Tone.context.rawContext as AudioContext;
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    
    const player = playersRef.current[drum];
    if (player && player.loaded) {
      player.stop();
      player.start();
      addLog(`Manually triggered ${drum}`);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
      Object.values(playersRef.current).forEach((player: any) => {
        if (player) player.dispose();
      });
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto space-y-4">
        <h1 className="text-3xl font-bold text-white">Transport vs Interval vs Hybrid</h1>
        
        <div className="grid grid-cols-2 gap-4">
          {/* Controls */}
          <div className="space-y-4">
            <div className="bg-gray-800 p-4 rounded-lg">
              <h2 className="text-white mb-2">1. Initialize</h2>
              <button
                onClick={initialize}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Load Tone & Samples
              </button>
            </div>

            <div className="bg-gray-800 p-4 rounded-lg">
              <h2 className="text-white mb-2">2. Choose Method</h2>
              <div className="space-y-2">
                <label className="flex items-center text-white">
                  <input
                    type="radio"
                    value="transport"
                    checked={method === 'transport'}
                    onChange={(e) => setMethod(e.target.value as any)}
                    className="mr-2"
                  />
                  Pure Transport (may not work)
                </label>
                <label className="flex items-center text-white">
                  <input
                    type="radio"
                    value="interval"
                    checked={method === 'interval'}
                    onChange={(e) => setMethod(e.target.value as any)}
                    className="mr-2"
                  />
                  Pure setInterval (works but no DAW sync)
                </label>
                <label className="flex items-center text-white">
                  <input
                    type="radio"
                    value="hybrid"
                    checked={method === 'hybrid'}
                    onChange={(e) => setMethod(e.target.value as any)}
                    className="mr-2"
                  />
                  Hybrid (Transport timeline + interval trigger)
                </label>
              </div>
            </div>

            <div className="bg-gray-800 p-4 rounded-lg">
              <h2 className="text-white mb-2">3. Playback</h2>
              <div className="space-x-2">
                <button
                  onClick={start}
                  disabled={isPlaying}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Start
                </button>
                <button
                  onClick={stop}
                  disabled={!isPlaying}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  Stop
                </button>
              </div>
            </div>

            <div className="bg-gray-800 p-4 rounded-lg">
              <h2 className="text-white mb-2">4. Test Individual</h2>
              <div className="space-x-2">
                <button
                  onClick={() => testSound('kick')}
                  className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  Kick
                </button>
                <button
                  onClick={() => testSound('snare')}
                  className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  Snare
                </button>
                <button
                  onClick={() => testSound('hihat')}
                  className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  Hihat
                </button>
              </div>
            </div>
          </div>

          {/* Logs */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-white">Logs</h2>
              <button
                onClick={() => setLogs([])}
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
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg text-gray-300">
          <h3 className="text-white font-semibold mb-2">What's happening:</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li><strong>Pure Transport:</strong> Uses Tone.Transport.schedule() - professional but may not trigger sounds</li>
            <li><strong>Pure setInterval:</strong> Uses JavaScript setInterval - works but no DAW timeline sync</li>
            <li><strong>Hybrid:</strong> Transport for timeline + setInterval for triggering - best of both worlds</li>
          </ul>
          <p className="mt-2 text-yellow-400">The hybrid approach is the FAANG-style solution!</p>
        </div>
      </div>
    </div>
  );
}