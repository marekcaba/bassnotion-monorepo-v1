/**
 * Utility functions for managing the persistent audio context
 * Ensures all components use the same AudioContext instance
 */

import { getLogger } from '@/utils/logger.js';

const logger = getLogger('audioContext');

/**
 * Get the persistent audio context
 * This context is shared across the entire application to prevent
 * AudioBuffer incompatibility errors and connection issues
 */
export function getPersistentAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  // Check for the persistent context stored by AudioEngine
  const persistentContext = window.__persistentAudioContext;
  if (persistentContext && persistentContext.state !== 'closed') {
    return persistentContext;
  }

  // Fallback: Check AudioEngine's global context
  const AudioEngine = window.__AudioEngine as
    | { globalContext?: AudioContext }
    | undefined;
  if (
    AudioEngine &&
    AudioEngine.globalContext &&
    AudioEngine.globalContext.state !== 'closed'
  ) {
    return AudioEngine.globalContext;
  }

  // Fallback: Check Tone.js context
  const Tone = window.Tone;
  if (Tone && Tone.context) {
    // Get the native AudioContext from Tone's wrapper
    const toneContext =
      Tone.context._context ||
      Tone.context._nativeAudioContext ||
      Tone.context.rawContext;
    if (toneContext && toneContext.state !== 'closed') {
      return toneContext;
    }
  }

  return null;
}

/**
 * Get or create a persistent audio context
 * Only creates a new context if absolutely necessary
 */
export async function getOrCreatePersistentAudioContext(): Promise<AudioContext> {
  // First try to get existing context
  const existing = getPersistentAudioContext();
  if (existing) {
    // Resume if suspended
    if (existing.state === 'suspended') {
      await existing.resume();
    }
    return existing;
  }

  // If we must create a new context, store it as persistent
  logger.warn(
    '⚠️ Creating new AudioContext - this should only happen once during app initialization',
  );

  const AudioContextConstructor =
    window.AudioContext || window.webkitAudioContext;
  const context = new AudioContextConstructor!({
    latencyHint: 'balanced',
    sampleRate: 48000,
  });

  // Store as persistent context
  window.__persistentAudioContext = context;

  // Resume if needed
  if (context.state === 'suspended') {
    await context.resume();
  }

  return context;
}

/**
 * Check if we have a valid persistent audio context
 */
export function hasPersistentAudioContext(): boolean {
  const context = getPersistentAudioContext();
  return context !== null && context.state !== 'closed';
}

/**
 * Get audio context info for debugging
 */
export function getAudioContextInfo(): {
  hasPersistent: boolean;
  state?: string;
  sampleRate?: number;
  baseLatency?: number;
  outputLatency?: number;
  currentTime?: number;
} {
  const context = getPersistentAudioContext();

  if (!context) {
    return { hasPersistent: false };
  }

  return {
    hasPersistent: true,
    state: context.state,
    sampleRate: context.sampleRate,
    baseLatency: context.baseLatency,
    outputLatency: context.outputLatency,
    currentTime: context.currentTime,
  };
}

/**
 * Ensure Tone.js is using the persistent audio context
 */
export function ensureToneUsesPersistentContext(): void {
  const Tone = window.Tone;
  if (!Tone) return;

  const persistentContext = getPersistentAudioContext();
  if (!persistentContext) return;

  // Get Tone's current context
  const toneContext =
    Tone.context?._context ||
    Tone.context?._nativeAudioContext ||
    Tone.context?.rawContext;

  // Only set context if they're different
  if (toneContext !== persistentContext) {
    logger.info('🎵 Setting Tone.js to use persistent AudioContext');
    Tone.setContext(persistentContext, true);
  }
}
