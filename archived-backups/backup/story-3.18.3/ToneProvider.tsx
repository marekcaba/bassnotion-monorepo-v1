'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { initLogger } from '../utils/simpleLogger';
import { toneInstanceManager } from '../services/ToneInstanceManager';

// Export functions to get global Tone info for backward compatibility
export function getGlobalTone() {
  // Deprecated - use AudioProvider and useAudioEngine hook instead
  console.warn('[ToneProvider] getGlobalTone is deprecated. Use AudioProvider.');
  return null;
}

export function getGlobalToneId() {
  return toneInstanceManager.getInstanceId();
}

export function getGlobalContextId() {
  // Deprecated - no longer using global state
  console.warn('[ToneProvider] getGlobalContextId is deprecated. Global state has been eliminated.');
  return null;
}

interface ToneContextValue {
  Tone: any | null;
  Transport: any | null;
  isReady: boolean;
  startContext?: () => Promise<void>;
}

const ToneContext = createContext<ToneContextValue>({
  Tone: null,
  Transport: null,
  isReady: false,
});

interface ToneProviderProps {
  children: React.ReactNode;
}

export function ToneProvider({ children }: ToneProviderProps) {
  const [tone, setTone] = useState<any>(null);
  const [transport, setTransport] = useState<any>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        // Get the singleton Tone instance
        const Tone = await toneInstanceManager.getTone();
        const Transport = await toneInstanceManager.getTransport();
        
        console.log('🎵 ToneProvider: Using singleton Tone.js instance', {
          instanceId: toneInstanceManager.getInstanceId(),
          transportState: Transport.state,
        });
        
        // Store references
        setTone(Tone);
        setTransport(Transport);
        setIsReady(true);
        
        // Log success
        initLogger.toneInitialized();
      } catch (error) {
        console.error('ToneProvider: Failed to initialize:', error);
      }
    };

    // Initialize immediately
    init();
  }, []);

  // Method to start audio context (needs user gesture)
  const startContext = async () => {
    try {
      // Use the singleton manager to start context
      await toneInstanceManager.startContext();
    } catch (error) {
      console.error('Failed to start AudioContext:', error);
    }
  };

  const contextValue: ToneContextValue = {
    Tone: tone,
    Transport: transport,
    isReady,
    startContext,
  };

  return (
    <ToneContext.Provider value={contextValue}>
      {children}
    </ToneContext.Provider>
  );
}

export function useTone() {
  const context = useContext(ToneContext);
  if (!context) {
    throw new Error('useTone must be used within a ToneProvider');
  }
  return context;
}
