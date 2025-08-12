'use client';

import { useEffect, useState } from 'react';
import { serviceRegistry } from '@/domains/playback/services/core/ServiceRegistry';
import { getAudioArchitectureFlags } from '@/domains/playback/config/featureFlags';
import { useAudioServices } from '@/domains/playback/providers/AudioProvider';

export default function TestArchitecturePage() {
  const [architectureInfo, setArchitectureInfo] = useState<any>({});
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    try {
      const flags = getAudioArchitectureFlags();
      const services = serviceRegistry.getServiceNames();
      
      setArchitectureInfo({
        flags,
        servicesRegistered: services,
        serviceCount: services.length,
        expectedServices: ['audioEngine', 'transportController', 'eventBus', 'pluginManager'],
        isNewArchitecture: flags.USE_NEW_AUDIO_ENGINE && flags.USE_NEW_DEPENDENCY_INJECTION,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);
  
  const { isInitialized, coreServices } = useAudioServices();
  
  return (
    <div className="min-h-screen p-8 bg-gray-900 text-white">
      <h1 className="text-3xl font-bold mb-8">Epic 3.18 Architecture Test</h1>
      
      {error && (
        <div className="bg-red-500/20 border border-red-500 p-4 rounded mb-8">
          <h2 className="text-xl font-bold mb-2">Error</h2>
          <pre>{error}</pre>
        </div>
      )}
      
      <div className="space-y-8">
        <div className="bg-gray-800 p-6 rounded">
          <h2 className="text-xl font-bold mb-4">Feature Flags</h2>
          <pre className="overflow-auto">{JSON.stringify(architectureInfo.flags, null, 2)}</pre>
        </div>
        
        <div className="bg-gray-800 p-6 rounded">
          <h2 className="text-xl font-bold mb-4">Architecture Status</h2>
          <div className="space-y-2">
            <p>New Architecture Active: <span className={architectureInfo.isNewArchitecture ? 'text-green-500' : 'text-red-500'}>
              {architectureInfo.isNewArchitecture ? '✅ YES' : '❌ NO'}
            </span></p>
            <p>AudioProvider Initialized: <span className={isInitialized ? 'text-green-500' : 'text-yellow-500'}>
              {isInitialized ? '✅ YES' : '⏳ LOADING'}
            </span></p>
            <p>Core Services Available: <span className={coreServices ? 'text-green-500' : 'text-red-500'}>
              {coreServices ? '✅ YES' : '❌ NO'}
            </span></p>
          </div>
        </div>
        
        <div className="bg-gray-800 p-6 rounded">
          <h2 className="text-xl font-bold mb-4">ServiceRegistry</h2>
          <div className="space-y-2">
            <p>Service Count: {architectureInfo.serviceCount || 0}</p>
            <p>Expected Services: {architectureInfo.expectedServices?.join(', ')}</p>
            <p>Registered Services: {architectureInfo.servicesRegistered?.join(', ') || 'None'}</p>
          </div>
        </div>
        
        <div className="bg-gray-800 p-6 rounded">
          <h2 className="text-xl font-bold mb-4">Full Info</h2>
          <pre className="overflow-auto text-sm">{JSON.stringify(architectureInfo, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}