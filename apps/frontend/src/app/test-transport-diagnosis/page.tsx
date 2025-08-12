'use client';

import React, { useState, useRef } from 'react';
import { PatternScheduler } from '@/domains/playback/services/PatternScheduler';

export default function TestTransportDiagnosisPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState('Ready');
  const schedulerRef = useRef<PatternScheduler | null>(null);
  const toneRef = useRef<any>(null);

  const addLog = (message: string) => {
    const timestamp = new Date().toTimeString().split(' ')[0];
    const logMessage = `${timestamp} - ${message}`;
    console.log(logMessage);
    setLogs(prev => [...prev.slice(-50), logMessage]);
  };

  const initializeTone = async () => {
    try {
      addLog('Importing Tone.js...');
      const Tone = await import('tone');
      toneRef.current = Tone;
      
      // Resume context
      const audioContext = Tone.context.rawContext as AudioContext;
      await audioContext.resume();
      
      addLog(`AudioContext state: ${audioContext.state}`);
      addLog(`Tone version: ${Tone.version}`);
      addLog(`Transport state: ${Tone.Transport.state}`);
      
      setStatus('Tone.js loaded');
    } catch (error) {
      addLog(`Error: ${error}`);
    }
  };

  const testBasicScheduling = async () => {
    if (!toneRef.current) {
      addLog('Tone not loaded');
      return;
    }
    
    const Tone = toneRef.current;
    addLog('Testing basic Transport.schedule...');
    
    // Schedule a simple callback
    Tone.Transport.schedule((time) => {
      addLog(`Schedule fired at time=${time.toFixed(3)}, now=${Tone.now().toFixed(3)}`);
    }, 0);
    
    Tone.Transport.schedule((time) => {
      addLog(`Schedule fired at time=${time.toFixed(3)}, now=${Tone.now().toFixed(3)}`);
    }, '0:1:0');
    
    // Start transport
    Tone.Transport.position = 0;
    Tone.Transport.start();
    addLog(`Transport started, state=${Tone.Transport.state}`);
    
    // Stop after 2 seconds
    setTimeout(() => {
      Tone.Transport.stop();
      addLog('Transport stopped');
    }, 2000);
  };

  const testScheduleRepeat = async () => {
    if (!toneRef.current) {
      addLog('Tone not loaded');
      return;
    }
    
    const Tone = toneRef.current;
    addLog('Testing Transport.scheduleRepeat...');
    
    let count = 0;
    const eventId = Tone.Transport.scheduleRepeat((time) => {
      addLog(`Repeat ${count++} at time=${time.toFixed(3)}, position=${Tone.Transport.position}`);
      if (count >= 8) {
        Tone.Transport.clear(eventId);
        Tone.Transport.stop();
        addLog('Stopped after 8 beats');
      }
    }, '8n');
    
    Tone.Transport.position = 0;
    Tone.Transport.start();
    addLog(`Transport started with repeat, state=${Tone.Transport.state}`);
  };

  const testPlayerScheduling = async () => {
    if (!toneRef.current) {
      addLog('Tone not loaded');
      return;
    }
    
    const Tone = toneRef.current;
    addLog('Testing Player with Transport.schedule...');
    
    // Create a test player
    const player = new Tone.Player({
      url: 'https://htuztkrbuewheehjspcz.supabase.co/storage/v1/object/public/audio-samples/drums/hydrogen-kits/mp3/electronic/boss-dr110/dr110kik.mp3',
      onload: () => {
        addLog('Test player loaded');
        
        // Schedule it to play
        Tone.Transport.schedule((time) => {
          addLog(`Attempting to trigger player at time=${time.toFixed(3)}`);
          try {
            player.start(time);
            addLog('Player.start() called successfully');
          } catch (error) {
            addLog(`Player.start() error: ${error}`);
          }
        }, 0);
        
        Tone.Transport.schedule((time) => {
          addLog(`Second trigger at time=${time.toFixed(3)}`);
          player.stop(time);
          player.start(time);
        }, '0:1:0');
        
        // Start transport
        Tone.Transport.position = 0;
        Tone.Transport.start();
        addLog('Transport started for player test');
      },
      onerror: (err) => addLog(`Player error: ${err}`)
    }).toDestination();
  };

  const testDrumScheduler = async () => {
    if (!toneRef.current) {
      addLog('Tone not loaded');
      return;
    }
    
    addLog('Testing DrumScheduler class...');
    
    // Create pattern
    const pattern = {
      kick: [true, false, false, false, true, false, false, false],
      snare: [false, false, true, false, false, false, true, false],
      hihat: [true, true, true, true, true, true, true, true]
    };
    
    // Create scheduler
    schedulerRef.current = new PatternScheduler();
    
    // Set up beat callback
    schedulerRef.current.onBeat((beat) => {
      addLog(`Beat: ${beat}`);
    });
    
    // Load samples
    const urls = {
      kick: 'https://htuztkrbuewheehjspcz.supabase.co/storage/v1/object/public/audio-samples/drums/hydrogen-kits/mp3/electronic/boss-dr110/dr110kik.mp3',
      snare: 'https://htuztkrbuewheehjspcz.supabase.co/storage/v1/object/public/audio-samples/drums/hydrogen-kits/mp3/electronic/boss-dr110/dr110clp.mp3',
      hihat: 'https://htuztkrbuewheehjspcz.supabase.co/storage/v1/object/public/audio-samples/drums/hydrogen-kits/mp3/electronic/boss-dr110/dr110cht.mp3'
    };
    
    try {
      await schedulerRef.current.loadSamples(urls);
      addLog('Samples loaded in scheduler');
      
      // Schedule and start
      schedulerRef.current.schedulePattern();
      schedulerRef.current.start();
      
      setStatus('DrumScheduler running');
    } catch (error) {
      addLog(`DrumScheduler error: ${error}`);
    }
  };

  const testDrumSchedulerWithPart = async () => {
    if (!toneRef.current) {
      addLog('Tone not loaded');
      return;
    }
    
    addLog('Testing DrumScheduler with Part...');
    
    // Create pattern
    const pattern = {
      kick: [true, false, false, false, true, false, false, false],
      snare: [false, false, true, false, false, false, true, false],
      hihat: [true, true, true, true, true, true, true, true]
    };
    
    // Create scheduler
    schedulerRef.current = new PatternScheduler();
    
    // Load samples
    const urls = {
      kick: 'https://htuztkrbuewheehjspcz.supabase.co/storage/v1/object/public/audio-samples/drums/hydrogen-kits/mp3/electronic/boss-dr110/dr110kik.mp3',
      snare: 'https://htuztkrbuewheehjspcz.supabase.co/storage/v1/object/public/audio-samples/drums/hydrogen-kits/mp3/electronic/boss-dr110/dr110clp.mp3',
      hihat: 'https://htuztkrbuewheehjspcz.supabase.co/storage/v1/object/public/audio-samples/drums/hydrogen-kits/mp3/electronic/boss-dr110/dr110cht.mp3'
    };
    
    try {
      await schedulerRef.current.loadSamples(urls);
      addLog('Samples loaded in scheduler');
      
      // Use Part-based scheduling
      schedulerRef.current.scheduleWithPart();
      schedulerRef.current.start();
      
      setStatus('DrumScheduler (Part) running');
    } catch (error) {
      addLog(`DrumScheduler error: ${error}`);
    }
  };

  const stopAll = () => {
    if (toneRef.current) {
      toneRef.current.Transport.stop();
      toneRef.current.Transport.cancel();
    }
    if (schedulerRef.current) {
      schedulerRef.current.stop();
    }
    addLog('All stopped');
    setStatus('Stopped');
  };

  const clearLogs = () => setLogs([]);

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-white">Transport Diagnosis</h1>
        <div className="text-gray-400">Status: {status}</div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-4">
            <div className="bg-gray-800 p-4 rounded-lg">
              <h2 className="text-white mb-2">1. Initialize</h2>
              <button
                onClick={initializeTone}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Load Tone.js
              </button>
            </div>

            <div className="bg-gray-800 p-4 rounded-lg">
              <h2 className="text-white mb-2">2. Test Transport Methods</h2>
              <div className="space-y-2">
                <button
                  onClick={testBasicScheduling}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 block w-full"
                >
                  Test schedule()
                </button>
                <button
                  onClick={testScheduleRepeat}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 block w-full"
                >
                  Test scheduleRepeat()
                </button>
                <button
                  onClick={testPlayerScheduling}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 block w-full"
                >
                  Test Player + schedule()
                </button>
              </div>
            </div>

            <div className="bg-gray-800 p-4 rounded-lg">
              <h2 className="text-white mb-2">3. Test DrumScheduler</h2>
              <div className="space-y-2">
                <button
                  onClick={testDrumScheduler}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 block w-full"
                >
                  Test with schedule()
                </button>
                <button
                  onClick={testDrumSchedulerWithPart}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 block w-full"
                >
                  Test with Part
                </button>
              </div>
            </div>

            <div className="bg-gray-800 p-4 rounded-lg">
              <button
                onClick={stopAll}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Stop All
              </button>
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-white">Diagnostic Logs</h2>
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
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg text-gray-300">
          <h3 className="text-white font-semibold mb-2">What we\'re testing:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Basic Transport.schedule() - Does it fire callbacks?</li>
            <li>Transport.scheduleRepeat() - Does it repeat properly?</li>
            <li>Player with Transport.schedule() - Does it trigger sounds?</li>
            <li>DrumScheduler class - Professional approach</li>
            <li>DrumScheduler with Part - Alternative scheduling</li>
          </ol>
        </div>
      </div>
    </div>
  );
}