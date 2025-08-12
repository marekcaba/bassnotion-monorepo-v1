/**
 * Utility to ensure AudioContext is initialized before audio operations
 * Handles user gesture requirements for browser security
 */

import * as Tone from 'tone';

/**
 * Ensures the AudioContext is initialized and running
 * Can be called from any user interaction (button click, etc.)
 * 
 * @returns Promise that resolves when AudioContext is ready
 */
export async function ensureAudioContext(): Promise<void> {
  try {
    // Get global services
    const globalServices = (window as any).__globalCoreServices || (window as any).__coreServices;
    
    if (!globalServices) {
      console.warn('ensureAudioContext: Global audio services not found');
      // Fallback to just starting Tone
      if (Tone.context.state === 'suspended') {
        await Tone.start();
      }
      return;
    }

    // Get the audio engine
    const audioEngine = globalServices.getAudioEngine?.();
    
    if (!audioEngine) {
      console.warn('ensureAudioContext: AudioEngine not found');
      // Fallback to just starting Tone
      if (Tone.context.state === 'suspended') {
        await Tone.start();
      }
      return;
    }

    // Check if AudioEngine is initialized
    if (!audioEngine.isReady()) {
      console.log('ensureAudioContext: AudioEngine not ready, initializing...');
      await audioEngine.initialize();
    }

    // Get Tone instance from AudioEngine
    const ToneFromEngine = audioEngine.getTone();
    
    if (ToneFromEngine && ToneFromEngine.context.state === 'suspended') {
      console.log('ensureAudioContext: Starting audio context...');
      await ToneFromEngine.start();
      console.log('ensureAudioContext: Audio context started successfully');
    }

    // Ensure all services are fully initialized
    if (!globalServices.isReady()) {
      console.log('ensureAudioContext: CoreServices not fully initialized, initializing...');
      await globalServices.initialize();
      console.log('ensureAudioContext: CoreServices initialized successfully');
    }

    // Dispatch event to notify components
    window.dispatchEvent(new Event('audioContextStarted'));
    
  } catch (error) {
    console.error('ensureAudioContext: Failed to initialize audio context:', error);
    throw error;
  }
}

/**
 * Check if AudioContext is currently available and running
 */
export function isAudioContextReady(): boolean {
  try {
    const globalServices = (window as any).__globalCoreServices || (window as any).__coreServices;
    
    if (!globalServices) {
      return false;
    }

    const audioEngine = globalServices.getAudioEngine?.();
    
    if (!audioEngine || !audioEngine.isReady()) {
      return false;
    }

    const ToneFromEngine = audioEngine.getTone();
    
    return ToneFromEngine && ToneFromEngine.context.state === 'running';
  } catch {
    return false;
  }
}

/**
 * Higher-order function to wrap click handlers with audio context initialization
 * 
 * @param handler The original click handler
 * @returns Wrapped handler that ensures audio context before executing
 */
export function withAudioContext<T extends (...args: any[]) => any>(
  handler: T
): T {
  return (async (...args: Parameters<T>) => {
    await ensureAudioContext();
    return handler(...args);
  }) as T;
}