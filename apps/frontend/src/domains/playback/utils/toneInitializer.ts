/**
 * Tone.js initialization helper
 * Initializes Tone.js without starting AudioContext
 */

let toneInstance: typeof import('tone') | null = null;
let isInitialized = false;

export async function initializeToneWithoutAudioContext() {
  if (isInitialized && toneInstance) {
    return { Tone: toneInstance, Transport: toneInstance.Transport };
  }

  try {
    // No longer manipulate global window.AudioContext

    // Import Tone.js
    const Tone = await import('tone');

    // Don't create a new AudioContext here - this causes multiple contexts
    // Let AudioEngine handle AudioContext creation and management
    // Just ensure Tone.js doesn't auto-start
    if (Tone.context.state !== 'suspended') {
      await Tone.context.suspend();
    }

    // Store the instance
    toneInstance = Tone;
    isInitialized = true;

    // Configure global settings
    Tone.Transport.bpm.value = 120;
    Tone.Transport.swing = 0;
    Tone.Transport.swingSubdivision = '8n';

    return { Tone, Transport: Tone.Transport };
  } catch (error) {
    logger.error('Failed to initialize Tone.js:', error);
    throw error;
  }
}

export function getToneInstance() {
  return toneInstance;
}

export function isToneInitialized() {
  return isInitialized;
}
