/**
 * Tone.js initialization helper
 * Initializes Tone.js without starting AudioContext
 */

import { getLogger } from '@/utils/logger.js';

const logger = getLogger('toneInitializer');

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
    // TEMPO FIX: Do NOT set Tone.Transport.bpm here!
    // MusicalTruthAuthority is the single source of truth for tempo.
    // Tone.Transport.bpm will be set when:
    // 1. An exercise is loaded via musicalTruth.setFromExercise()
    // 2. User adjusts tempo via musicalTruth.setBPM()
    // Setting a hardcoded 120 BPM here would overwrite the exercise tempo
    // when the exercise is loaded and cause tempo bugs.
    // Tone.Transport.bpm.value = 120; // ❌ REMOVED - bypasses MusicalTruthAuthority
    Tone.getTransport().swing = 0;
    Tone.getTransport().swingSubdivision = '8n';

    return { Tone, Transport: Tone.getTransport() };
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
