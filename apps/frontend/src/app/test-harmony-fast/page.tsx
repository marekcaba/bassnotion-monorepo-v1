'use client';

import { useState, useEffect } from 'react';
import { HarmonyWidgetFast } from '@/domains/widgets/components/YouTubeWidgetPage/components/HarmonyWidgetFast';

export default function TestHarmonyFast() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progression, setProgression] = useState(['C', 'Am', 'F', 'G']);
  const [loadTime, setLoadTime] = useState<number | null>(null);
  const [status, setStatus] = useState('Initializing...');
  
  useEffect(() => {
    const startTime = performance.now();
    
    // Monitor console logs to track loading
    const originalLog = console.log;
    console.log = function(...args) {
      originalLog.apply(console, args);
      
      const message = args.join(' ');
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      
      if (message.includes('Synth ready instantly')) {
        setLoadTime(parseFloat(elapsed));
        setStatus(`✅ Loaded in ${elapsed}s (synth ready)`);
      } else if (message.includes('Upgraded to ChordInstrumentProcessor')) {
        setStatus(`✅ Upgraded to piano samples at ${elapsed}s`);
      } else if (message.includes('Sample loading timed out')) {
        setStatus(`⚠️ Using synth fallback (samples timed out at ${elapsed}s)`);
      }
    };
    
    return () => {
      console.log = originalLog;
    };
  }, []);
  
  // Start Tone.js Transport
  useEffect(() => {
    const startTransport = async () => {
      const Tone = await import('tone');
      if (Tone.Transport.state === 'stopped') {
        Tone.Transport.bpm.value = 120;
        Tone.Transport.start();
        console.log('Transport started');
      }
    };
    startTransport();
  }, []);

  return (
    <div className="p-8 bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4">HarmonyWidgetFast Test</h1>
      
      <div className="bg-gray-800 p-4 rounded mb-6">
        <h2 className="text-xl font-semibold mb-2">Performance</h2>
        <div className="space-y-2">
          <p className="text-lg">
            Status: <span className="font-mono">{status}</span>
          </p>
          {loadTime !== null && (
            <p className="text-2xl font-bold">
              {loadTime < 1 ? (
                <span className="text-green-400">✅ Ultra Fast: {loadTime}s</span>
              ) : loadTime < 3 ? (
                <span className="text-yellow-400">⚡ Fast: {loadTime}s</span>
              ) : (
                <span className="text-red-400">⚠️ Slow: {loadTime}s</span>
              )}
            </p>
          )}
        </div>
      </div>

      <div className="bg-gray-800 p-4 rounded mb-6">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={`px-6 py-3 rounded text-lg font-semibold ${
            isPlaying ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {isPlaying ? 'Stop' : 'Play'}
        </button>
      </div>

      <div className="space-y-4">
        <HarmonyWidgetFast
          progression={progression}
          isPlaying={isPlaying}
          isVisible={true}
          onProgressionChange={setProgression}
          onToggleVisibility={() => {}}
          onTogglePlay={() => setIsPlaying(!isPlaying)}
        />
      </div>

      <div className="mt-8 bg-gray-800 p-4 rounded">
        <h2 className="text-xl font-semibold mb-2">How it Works</h2>
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li>Creates a simple synthesizer immediately (&lt; 0.5s)</li>
          <li>Widget is ready to play instantly</li>
          <li>Attempts to upgrade to piano samples in background</li>
          <li>If samples load within 5 seconds, upgrades automatically</li>
          <li>If samples timeout, continues with synth (still sounds good!)</li>
          <li>Never blocks or hangs the UI</li>
        </ul>
      </div>
    </div>
  );
}