/**
 * Simple hook to initialize Tone.js automatically
 */

import { useEffect, useState } from 'react';

export function useToneInit() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [tone, setTone] = useState<any>(null);
  const [transport, setTransport] = useState<any>(null);

  useEffect(() => {
    const init = async () => {
      try {
        // Import Tone.js
        const Tone = await import('tone');
        
        // Set up the context but don't start it
        const context = new AudioContext();
        await context.suspend();
        Tone.setContext(context);
        
        // Configure Transport
        Tone.Transport.bpm.value = 120;
        
        // Store references
        setTone(Tone);
        setTransport(Tone.Transport);
        setIsInitialized(true);
        
        console.log('✅ Tone.JS initialized');
      } catch (error) {
        console.error('Failed to initialize Tone.js:', error);
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
    }
  };
}