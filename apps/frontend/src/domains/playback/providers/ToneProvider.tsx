'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

// Export functions to get global Tone info for backward compatibility
export function getGlobalTone() {
  // Deprecated - use AudioProvider and useAudioEngine hook instead
  logger.warn(
    '[ToneProvider] getGlobalTone is deprecated. Use AudioProvider.',
  );
  return null;
}

export function getGlobalToneId() {
  // Deprecated - no longer using global instance IDs
  logger.warn(
    '[ToneProvider] getGlobalToneId is deprecated. Use AudioProvider.',
  );
  return 'deprecated';
}

export function getGlobalContextId() {
  // Deprecated - no longer using global state
  logger.warn(
    '[ToneProvider] getGlobalContextId is deprecated. Global state has been eliminated.',
  );
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
  const { correlationId, logger } = useCorrelation('ToneProvider');
  const [tone, setTone] = useState<any>(null);
  const [transport, setTransport] = useState<any>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    logger.warn(
      '[ToneProvider] This provider is deprecated. Please use AudioProvider instead.',
    );
    // Mark as ready immediately since this is just a stub
    setIsReady(true);
  }, []);

  // Method to start audio context (needs user gesture)
  const startContext = async () => {
    logger.warn(
      '[ToneProvider] startContext is deprecated. Use AudioProvider.',
    );
  };

  const contextValue: ToneContextValue = {
    Tone: tone,
    Transport: transport,
    isReady,
    startContext,
  };

  return (
    <ToneContext.Provider value={contextValue}>{children}</ToneContext.Provider>
  );
}

export function useTone() {
  const context = useContext(ToneContext);
  if (!context) {
    throw new Error('useTone must be used within a ToneProvider');
  }
  return context;
}
