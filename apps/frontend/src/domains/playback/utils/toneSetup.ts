/**
 * Tone.js setup - DEPRECATED
 * Story 3.18.3: Global State Elimination
 * 
 * This file used to manipulate global window.AudioContext
 * which is an anti-pattern. The new architecture uses
 * AudioEngine from core services instead.
 * 
 * @deprecated Use AudioEngine.getTone() instead
 */

export function restoreAudioContext() {
  // No longer needed - AudioEngine handles context properly
  console.warn('[toneSetup] restoreAudioContext is deprecated. Use AudioEngine instead.');
}