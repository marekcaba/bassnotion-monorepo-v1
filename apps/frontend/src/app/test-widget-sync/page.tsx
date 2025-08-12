'use client';

import React, { useState, useEffect } from 'react';
import { AudioProvider, useEventBus, useUnifiedTransport } from '@/domains/playback/providers/AudioProvider';
import { widgetSyncService } from '@/domains/widgets/services/WidgetSyncService';
import { useWidgetSync } from '@/domains/widgets/hooks/useWidgetSync';

function TransportControls() {
  const [error, setError] = useState<string | null>(null);
  
  const handlePlay = () => {
    try {
      console.log('🎵 Test: Starting transport...');
      const coreServices = (window as any).__coreServices;
      if (!coreServices) {
        setError('CoreServices not available');
        return;
      }
      
      const transportController = coreServices.getUnifiedTransport();
      transportController.start().then(() => {
        console.log('✅ Transport started successfully');
      }).catch((err: any) => {
        console.error('❌ Failed to start transport:', err);
        setError(err.message);
      });
    } catch (err) {
      console.error('❌ Error starting transport:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };
  
  const handleStop = () => {
    try {
      console.log('🛑 Test: Stopping transport...');
      const coreServices = (window as any).__coreServices;
      if (!coreServices) {
        setError('CoreServices not available');
        return;
      }
      
      const transportController = coreServices.getUnifiedTransport();
      transportController.stop().then(() => {
        console.log('✅ Transport stopped successfully');
      }).catch((err: any) => {
        console.error('❌ Failed to stop transport:', err);
        setError(err.message);
      });
    } catch (err) {
      console.error('❌ Error stopping transport:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };
  
  return (
    <div className="mb-6">
      <h2 className="text-xl mb-2">Transport Controls</h2>
      <div className="flex gap-4">
        <button 
          onClick={handlePlay}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded"
        >
          ▶️ Play
        </button>
        <button 
          onClick={handleStop}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
        >
          ⏹️ Stop
        </button>
      </div>
      {error && (
        <div className="mt-2 p-2 bg-red-800 text-red-200 rounded">
          Error: {error}
        </div>
      )}
    </div>
  );
}

function TestWidget({ widgetId, color }: { widgetId: string; color: string }) {
  const sync = useWidgetSync({
    widgetId,
    subscribeTo: ['PLAY', 'STOP', 'PAUSE', 'HEARTBEAT'],
    debugMode: true
  });
  
  const [events, setEvents] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    console.log(`🔌 ${widgetId}: Mounted, isConnected=${sync.state.isConnected}, isPlaying=${sync.isPlaying}`);
  }, []);
  
  useEffect(() => {
    console.log(`🎯 ${widgetId}: State changed - isPlaying=${sync.isPlaying}, isConnected=${sync.state.isConnected}`);
    if (!mounted) return;
    
    // Add events for both play and stop
    if (sync.isPlaying) {
      setEvents(prev => [...prev, `▶️ PLAYING at ${new Date().toLocaleTimeString()}`]);
    } else {
      // Only add stop event if we have some events (to avoid initial state)
      if (events.length > 0) {
        setEvents(prev => [...prev, `⏸️ STOPPED at ${new Date().toLocaleTimeString()}`]);
      }
    }
  }, [sync.isPlaying, mounted, widgetId]);
  
  // Format time only on client side
  const formatTime = (timestamp: number) => {
    if (!mounted) return '...';
    return new Date(timestamp).toLocaleTimeString();
  };
  
  return (
    <div className={`p-4 rounded ${color} text-white`}>
      <h3 className="font-bold mb-2">{widgetId}</h3>
      <div className="text-sm space-y-1">
        <p>Connected: {sync.state.isConnected ? '✅' : '❌'}</p>
        <p>Playing: {sync.isPlaying ? '▶️ Yes' : '⏸️ No'}</p>
        <p>Last Sync: {formatTime(sync.state.lastSyncTime)}</p>
        <p>Events: {sync.state.eventCount}</p>
        <p>Latency: {sync.state.averageLatency.toFixed(2)}ms</p>
      </div>
      <div className="mt-2 max-h-32 overflow-y-auto text-xs font-mono">
        {events.slice(-5).map((event, i) => (
          <div key={i} className="py-0.5">{event}</div>
        ))}
      </div>
    </div>
  );
}

function WidgetSyncTest() {
  const [servicesReady, setServicesReady] = useState(false);
  
  useEffect(() => {
    const checkServices = () => {
      const coreServices = (window as any).__coreServices;
      if (coreServices) {
        console.log('✅ CoreServices detected:', coreServices);
        setServicesReady(true);
      } else {
        console.log('⏳ Waiting for CoreServices...');
        setTimeout(checkServices, 100);
      }
    };
    
    checkServices();
    
    // Also listen for the ready event
    window.addEventListener('audioServicesReady', () => {
      console.log('🎉 Audio services ready event received!');
      setServicesReady(true);
    });
  }, []);
  
  return (
    <div className="p-8 bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Widget Sync Test - Heartbeat Fix</h1>
      
      <div className="mb-4 p-4 bg-blue-900 border border-blue-700 rounded">
        <p className="text-blue-200">
          This test verifies that the heartbeat mechanism prevents widget timeout after 30 seconds.
        </p>
        <p className="text-blue-300 mt-2">
          Services Ready: {servicesReady ? '✅ Yes' : '⏳ Loading...'}
        </p>
      </div>
      
      {servicesReady && <TransportControls />}
      
      <div className="grid grid-cols-3 gap-4">
        <TestWidget widgetId="test-widget-1" color="bg-purple-800" />
        <TestWidget widgetId="test-widget-2" color="bg-blue-800" />
        <TestWidget widgetId="test-widget-3" color="bg-green-800" />
      </div>
      
      <div className="mt-6">
        <h2 className="text-xl mb-2">Expected Behavior</h2>
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li>Widgets should show ✅ Connected immediately</li>
          <li>When you click Play, all widgets should show ▶️</li>
          <li>Widgets should receive heartbeats every 5 seconds</li>
          <li>Widgets should NOT timeout after 30 seconds</li>
          <li>Event count should increase steadily</li>
        </ul>
      </div>
    </div>
  );
}

export default function TestPage() {
  return (
    <AudioProvider>
      <WidgetSyncTest />
    </AudioProvider>
  );
}