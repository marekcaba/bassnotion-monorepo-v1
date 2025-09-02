/**
 * Simple hook to initialize Tone.js automatically
 */

import { useEffect, useState } from 'react';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

export function useToneInit() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [tone, setTone] = useState<any>(null);
  const [transport, setTransport] = useState<any>(null);

  useEffect(() => {
    const init = async () => {
      try {
        // Import Tone.js
        const Tone = await import('tone');

        // Don't create a new AudioContext here - let AudioEngine handle it
        // This was causing multiple contexts to be created
        // Just ensure Tone.js is loaded and ready

        // Configure Transport
        Tone.Transport.bpm.value = 120;

        // Store references
        setTone(Tone);
        setTransport(Tone.Transport);
        setIsInitialized(true);

        logger.info('✅ Tone.JS initialized');
      } catch (error) {
        logger.error('Failed to initialize Tone.js:', error);
      }
    };

    init();
  }, []);

  return {
    isReady: isInitialized,
    Tone: tone,
    Transport: transport,
    startContext: async () => {
      if (tone && tone.context.state !== 'running') {
        await tone.start();
      }
    },
  };
}
