'use client';

import { useEffect, useState } from 'react';
import { getBackgroundLoader } from '@/domains/playback/services/BackgroundSampleLoader';

export default function TestBackgroundLoader() {
  const [loadingStatus, setLoadingStatus] = useState<Record<string, any>>({});
  const [overallProgress, setOverallProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const addLog = (message: string) => {
      setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
      console.log(message);
    };

    const checkBackgroundLoading = async () => {
      addLog('🚀 Testing BackgroundSampleLoader...');
      
      // Get the background loader instance
      const loader = getBackgroundLoader();
      addLog('✅ Got BackgroundSampleLoader instance');

      // Check initial status
      const instruments = ['harmony', 'drums', 'bass', 'metronome'];
      const initialStatus: Record<string, any> = {};
      
      for (const inst of instruments) {
        const status = loader.getSampleStatus(inst);
        initialStatus[inst] = status;
        addLog(`📊 ${inst}: ${status.quality} (${status.progress}%)`);
      }
      
      setLoadingStatus(initialStatus);
      setOverallProgress(loader.getOverallProgress());

      // Start background loading if not already started
      addLog('🎵 Starting background loading...');
      
      await loader.startBackgroundLoading({
        priority: 'all',
        onProgress: (instrument, status) => {
          addLog(`📈 ${instrument} progress: ${status.quality} (${status.progress}%)`);
          
          setLoadingStatus(prev => ({
            ...prev,
            [instrument]: status
          }));
          
          setOverallProgress(loader.getOverallProgress());
        }
      });

      // Check for preloaded samples
      setTimeout(() => {
        addLog('🔍 Checking for preloaded samples after 5 seconds...');
        
        for (const inst of instruments) {
          const samples = loader.getPreloadedSamples(inst);
          const hasEssential = loader.hasEssentialSamples(inst);
          
          if (samples) {
            addLog(`✅ ${inst}: Samples loaded! Has essential: ${hasEssential}`);
          } else {
            addLog(`⏳ ${inst}: No samples yet. Has essential: ${hasEssential}`);
          }
        }
      }, 5000);

      // Check again after 10 seconds
      setTimeout(() => {
        addLog('🔍 Final check after 10 seconds...');
        
        for (const inst of instruments) {
          const status = loader.getSampleStatus(inst);
          const samples = loader.getPreloadedSamples(inst);
          
          addLog(`📊 ${inst}: ${status.quality} (${status.progress}%) - ${samples ? 'LOADED' : 'NOT LOADED'}`);
        }
        
        const overall = loader.getOverallProgress();
        addLog(`📊 Overall progress: ${overall}%`);
        setOverallProgress(overall);
      }, 10000);
    };

    checkBackgroundLoading();
  }, []);

  return (
    <div className="p-8 bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Background Sample Loader Test</h1>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Overall Progress</h2>
        <div className="w-full bg-gray-700 rounded-full h-4">
          <div 
            className="bg-green-500 h-4 rounded-full transition-all duration-500"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
        <p className="text-sm mt-1">{overallProgress}%</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {Object.entries(loadingStatus).map(([instrument, status]) => (
          <div key={instrument} className="bg-gray-800 p-4 rounded">
            <h3 className="font-semibold capitalize">{instrument}</h3>
            <p className="text-sm">Quality: {status.quality}</p>
            <p className="text-sm">Progress: {status.progress}%</p>
            <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
              <div 
                className={`h-2 rounded-full transition-all duration-500 ${
                  status.quality === 'premium' ? 'bg-purple-500' :
                  status.quality === 'standard' ? 'bg-blue-500' :
                  status.quality === 'essential' ? 'bg-green-500' :
                  'bg-gray-500'
                }`}
                style={{ width: `${status.progress}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gray-800 p-4 rounded">
        <h2 className="text-xl font-semibold mb-2">Log Output</h2>
        <div className="h-64 overflow-y-auto font-mono text-sm">
          {logs.map((log, i) => (
            <div key={i} className="mb-1">
              {log}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-400">
        <p>This page tests the BackgroundSampleLoader service which loads audio samples from Supabase.</p>
        <p>Samples are loaded progressively using requestIdleCallback to avoid blocking the main thread.</p>
        <p>All samples are loaded from Supabase storage only - no external CDNs or synthesizers.</p>
      </div>
    </div>
  );
}