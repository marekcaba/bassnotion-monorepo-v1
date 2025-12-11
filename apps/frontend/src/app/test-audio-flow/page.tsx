'use client';

import { useState, useEffect, useCallback } from 'react';
import { GlobalAudioSystem } from '@/domains/playback/services/core/CoreServices';
import { AudioDebugger } from '@/domains/playback/services/core/AudioDebugger';
import * as Tone from 'tone';

export default function TestAudioFlow() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [transportState, setTransportState] = useState('');
  const [toneTransportState, setToneTransportState] = useState('');

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `${new Date().toISOString()}: ${message}`]);
  };

  const initialize = useCallback(async () => {
    try {
      addLog('Getting pre-initialized CoreServices...');
      const coreServices = await GlobalAudioSystem.getPreInitializedInstance();

      addLog('Initializing CoreServices with user gesture...');
      await coreServices.initialize();

      addLog('Getting services...');
      const eventBus = coreServices.getEventBus();
      const playbackEngine = coreServices.getPlaybackEngine();
      const instrumentRegistry = coreServices.getInstrumentRegistry();
      const audioEventRouter = coreServices.getAudioEventRouter();

      // Register a simple test instrument for metronome
      addLog('Registering test metronome instrument...');
      const testMetronome = {
        id: 'test-metronome',
        trigger: (beat: number, velocity: number) => {
          console.log('Metronome trigger called!', { beat, velocity });
          addLog(`Metronome triggered: beat=${beat}, velocity=${velocity}`);
        },
        triggerClick: (beat: number, velocity: number) => {
          console.log('Metronome triggerClick called!', { beat, velocity });
          addLog(`Metronome click: beat=${beat}, velocity=${velocity}`);
        },
      };
      instrumentRegistry.setActive('metronome', testMetronome);

      // Create a simple test pattern
      const testPattern = {
        events: [
          { position: '0:0:0', type: 'accent', velocity: 0.9 },
          { position: '0:1:0', type: 'click', velocity: 0.6 },
          { position: '0:2:0', type: 'click', velocity: 0.6 },
          { position: '0:3:0', type: 'click', velocity: 0.6 },
          { position: '1:0:0', type: 'accent', velocity: 0.9 },
          { position: '1:1:0', type: 'click', velocity: 0.6 },
          { position: '1:2:0', type: 'click', velocity: 0.6 },
          { position: '1:3:0', type: 'click', velocity: 0.6 },
        ],
      };

      // Register track with RegionProcessor
      addLog('Registering track with RegionProcessor...');
      playbackEngine.registerTracks([
        {
          id: 'test-metronome-track',
          name: 'Test Metronome',
          instrumentType: 'metronome',
          regions: [
            {
              id: 'test-region-1',
              trackId: 'test-metronome-track',
              startTime: 0,
              duration: 8,
              pattern: testPattern,
            },
          ],
        },
      ]);

      // Start the region processor
      addLog('Starting RegionProcessor...');
      playbackEngine.start();

      setIsInitialized(true);
      addLog('Initialization complete!');

      // Monitor transport states
      setInterval(() => {
        const transport = coreServices.getUnifiedTransport();
        setTransportState(transport.getState());
        setToneTransportState(Tone.Transport.state);
      }, 100);
    } catch (error) {
      addLog(`Error: ${error}`);
      console.error(error);
    }
  }, []);

  const start = useCallback(async () => {
    try {
      addLog('Starting transport...');
      const coreServices = await GlobalAudioSystem.getPreInitializedInstance();
      const transport = coreServices.getUnifiedTransport();

      await transport.start();
      setIsPlaying(true);
      addLog('Transport started!');

      // Check Tone.Transport state
      addLog(`Tone.Transport state: ${Tone.Transport.state}`);
      addLog(`Tone.Transport position: ${Tone.Transport.position}`);
    } catch (error) {
      addLog(`Error starting: ${error}`);
      console.error(error);
    }
  }, []);

  const stop = useCallback(async () => {
    try {
      addLog('Stopping transport...');
      const coreServices = await GlobalAudioSystem.getPreInitializedInstance();
      const transport = coreServices.getUnifiedTransport();
      const playbackEngine = coreServices.getPlaybackEngine();

      await transport.stop();
      playbackEngine.stop();
      setIsPlaying(false);
      addLog('Transport stopped!');

      // Check Tone.Transport state
      addLog(`Tone.Transport state: ${Tone.Transport.state}`);
    } catch (error) {
      addLog(`Error stopping: ${error}`);
      console.error(error);
    }
  }, []);

  const checkDebugger = useCallback(() => {
    const audioDebugger = AudioDebugger.getInstance();
    const events = audioDebugger.getRecentEvents(20);
    addLog('=== Recent Audio Events ===');
    events.forEach((event) => {
      addLog(`[${event.source}] ${event.event}`);
    });
    audioDebugger.summary();
  }, []);

  return (
    <>
      <div className="p-8">
        <h1 className="text-2xl mb-4">Audio Event Flow Test</h1>

        <div className="mb-4">
          <p>Transport State: {transportState}</p>
          <p>Tone.Transport State: {toneTransportState}</p>
          <p>Initialized: {isInitialized ? 'Yes' : 'No'}</p>
          <p>Playing: {isPlaying ? 'Yes' : 'No'}</p>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={initialize}
            disabled={isInitialized}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
          >
            Initialize
          </button>

          <button
            onClick={start}
            disabled={!isInitialized || isPlaying}
            className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
          >
            Start
          </button>

          <button
            onClick={stop}
            disabled={!isInitialized || !isPlaying}
            className="px-4 py-2 bg-red-500 text-white rounded disabled:opacity-50"
          >
            Stop
          </button>

          <button
            onClick={checkDebugger}
            className="px-4 py-2 bg-purple-500 text-white rounded"
          >
            Check Debugger
          </button>
        </div>

        <div className="bg-gray-100 p-4 rounded">
          <h2 className="text-lg mb-2">Logs:</h2>
          <div className="max-h-96 overflow-y-auto text-sm font-mono">
            {logs.map((log, i) => (
              <div key={i} className="mb-1">
                {log}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          <p>Open browser console for detailed debug output.</p>
          <p>Use window.__audioDebugger in console for more control.</p>
        </div>
      </div>
    </>
  );
}
