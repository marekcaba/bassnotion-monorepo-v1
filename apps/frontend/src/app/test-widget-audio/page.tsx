'use client';

import React, { useState, useEffect } from 'react';
import { AudioProvider } from '@/domains/playback/providers/AudioProvider';

function WidgetAudioTest() {
  const [status, setStatus] = useState<string[]>(['Starting test...']);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const addStatus = (msg: string) => {
    setStatus(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };
  
  useEffect(() => {
    const checkServices = async () => {
      addStatus('Checking for CoreServices...');
      
      // Wait for services
      let attempts = 0;
      while (!window.__coreServices && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      if (!window.__coreServices) {
        addStatus('❌ CoreServices not available after 5 seconds');
        return;
      }
      
      addStatus('✅ CoreServices available');
      
      const coreServices = window.__coreServices;
      const transportController = coreServices.getUnifiedTransport();
      const audioEngine = coreServices.getAudioEngine();
      
      // Check audio context
      const context = audioEngine.getContext();
      addStatus(`📊 AudioContext state: ${context?.state}`);
      
      // Check Tone.js
      const Tone = audioEngine.getTone();
      addStatus(`🎹 Tone.js loaded: ${!!Tone}`);
      addStatus(`🎹 Tone.Transport state: ${Tone?.Transport.state}`);
    };
    
    checkServices();
  }, []);
  
  const testTransportAndWidgets = async () => {
    addStatus('🚀 Starting test...');
    
    const coreServices = window.__coreServices;
    if (!coreServices) {
      addStatus('❌ CoreServices not available');
      return;
    }
    
    const transportController = coreServices.getUnifiedTransport();
    const audioEngine = coreServices.getAudioEngine();
    const Tone = audioEngine.getTone();
    
    try {
      // Start audio context if needed
      if (Tone.context.state !== 'running') {
        addStatus('🔊 Starting audio context...');
        await Tone.start();
        addStatus(`✅ Audio context state: ${Tone.context.state}`);
      }
      
      // Start transport
      addStatus('▶️ Starting transport...');
      await transportController.start();
      setIsPlaying(true);
      
      // Monitor transport
      let monitorCount = 0;
      const monitor = setInterval(() => {
        const state = Tone.Transport.state;
        const position = Tone.Transport.position;
        const seconds = Tone.Transport.seconds;
        
        addStatus(`📍 Transport: ${state}, Position: ${position}, Seconds: ${seconds.toFixed(2)}`);
        
        // Check for scheduled events
        const events = Tone.Transport._timeline._events;
        addStatus(`🎵 Scheduled events: ${events.length}`);
        
        monitorCount++;
        if (monitorCount >= 5) {
          clearInterval(monitor);
        }
      }, 1000);
      
    } catch (error) {
      addStatus(`❌ Error: ${error}`);
    }
  };
  
  const stopTransport = async () => {
    const coreServices = window.__coreServices;
    if (!coreServices) return;
    
    const transportController = coreServices.getUnifiedTransport();
    
    addStatus('⏹️ Stopping transport...');
    await transportController.stop();
    setIsPlaying(false);
    addStatus('✅ Transport stopped');
  };
  
  return (
    <div className="p-8 bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Widget Audio Production Test</h1>
      
      <div className="mb-6 space-x-4">
        <button 
          onClick={testTransportAndWidgets}
          disabled={isPlaying}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded"
        >
          {isPlaying ? '▶️ Playing...' : '▶️ Start Test'}
        </button>
        
        <button 
          onClick={stopTransport}
          disabled={!isPlaying}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded"
        >
          ⏹️ Stop
        </button>
      </div>
      
      <div className="bg-gray-800 p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Status Log:</h2>
        <div className="font-mono text-sm space-y-1 max-h-96 overflow-y-auto">
          {status.map((msg, i) => (
            <div key={i} className={
              msg.includes('❌') ? 'text-red-400' :
              msg.includes('✅') ? 'text-green-400' :
              msg.includes('📍') ? 'text-blue-400' :
              msg.includes('🎵') ? 'text-purple-400' :
              'text-gray-300'
            }>
              {msg}
            </div>
          ))}
        </div>
      </div>
      
      <div className="mt-6 p-4 bg-blue-900 rounded">
        <h2 className="text-lg font-semibold mb-2">Test Instructions:</h2>
        <ol className="list-decimal list-inside space-y-1">
          <li>Click "Start Test" to begin</li>
          <li>The test will start the transport and monitor its state</li>
          <li>Check if you hear any audio from widgets</li>
          <li>Look for scheduled events in the log</li>
          <li>If no audio, check browser console for errors</li>
        </ol>
      </div>
    </div>
  );
}

export default function TestPage() {
  return (
    <AudioProvider>
      <WidgetAudioTest />
    </AudioProvider>
  );
}