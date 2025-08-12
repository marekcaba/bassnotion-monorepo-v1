'use client';

import { useEffect, useState } from 'react';
import { useAudio } from '@/domains/playback/hooks';

export default function TestAudioInitPage() {
  const { isReady, isInitializing, error, initialize, getTone } = useAudio();
  const [initStatus, setInitStatus] = useState('Not initialized');
  const [logs, setLogs] = useState<string[]>([]);
  
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`🎵 Test: ${message}`);
  };
  
  useEffect(() => {
    addLog(`Audio ready: ${isReady}, initializing: ${isInitializing}`);
    
    // Check window objects
    const hasCoreServices = !!(window as any).__coreServices;
    const hasServiceRegistry = !!(window as any).__serviceRegistry;
    addLog(`Window objects: CoreServices=${hasCoreServices}, ServiceRegistry=${hasServiceRegistry}`);
  }, [isReady, isInitializing]);
  
  const handleInitialize = async () => {
    addLog('Starting manual initialization...');
    setInitStatus('Initializing...');
    
    try {
      await initialize();
      addLog('Initialization successful!');
      setInitStatus('Initialized successfully');
      
      // Try to get Tone
      const tone = getTone();
      addLog(`Tone available: ${!!tone}`);
      if (tone) {
        addLog(`Tone.Transport state: ${tone.Transport?.state}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      addLog(`Initialization failed: ${message}`);
      setInitStatus(`Failed: ${message}`);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">🎵 Audio Initialization Test</h1>
        
        <div className="bg-slate-800/50 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Current State</h2>
          <div className="space-y-2 text-white">
            <p>Is Ready: <span className={isReady ? 'text-green-400' : 'text-red-400'}>{String(isReady)}</span></p>
            <p>Is Initializing: <span className={isInitializing ? 'text-yellow-400' : 'text-gray-400'}>{String(isInitializing)}</span></p>
            <p>Error: <span className="text-red-400">{error?.message || 'None'}</span></p>
            <p>Status: <span className="text-blue-400">{initStatus}</span></p>
          </div>
        </div>
        
        <div className="bg-slate-800/50 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Actions</h2>
          <button
            onClick={handleInitialize}
            disabled={isInitializing || isReady}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            {isReady ? 'Already Initialized' : isInitializing ? 'Initializing...' : 'Initialize Audio'}
          </button>
        </div>
        
        <div className="bg-slate-900/50 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Debug Logs</h2>
          <div className="space-y-1 font-mono text-sm text-gray-300 max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500">No logs yet...</p>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="hover:bg-slate-800/50 px-2 py-1 rounded">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}