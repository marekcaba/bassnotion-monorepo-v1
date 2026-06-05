/**
 * Utility functions for managing the persistent audio context
 * Ensures all components use the same AudioContext instance
 */

import { getLogger } from '@/utils/logger.js';
import { WindowRegistry } from '../services/WindowRegistry.js';

const logger = getLogger('audioContext');

/**
 * Get the persistent audio context
 * This context is shared across the entire application to prevent
 * AudioBuffer incompatibility errors and connection issues.
 *
 * SINGLE SOURCE OF TRUTH: this now resolves through
 * `WindowRegistry.getAudioContext()` (which reads
 * `__bassnotion_audioContext || __persistentAudioContext` — both kept in
 * sync by setAudioContext). We no longer mint a context here; that was the
 * second creator that let the engine's context diverge from the live one.
 * Tone's own context is kept only as a last-ditch read fallback (it is
 * pointed at the canonical context by ToneWrapper.initialize anyway).
 */
export function getPersistentAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  // Canonical: whatever the registry holds (engine/AudioContextManager on
  // /app, the raw prewarm context on the waitlist). setAudioContext now
  // aliases both globals, so this and the engine always agree.
  const registryContext = WindowRegistry.getAudioContext();
  if (registryContext && registryContext.state !== 'closed') {
    return registryContext;
  }

  // Last-ditch read fallback: Tone.js's native context. Read-only — do NOT
  // construct here. If Tone is pointed somewhere live we can reuse it.
  const Tone = window.Tone;
  if (Tone && Tone.context) {
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

  // Last-resort creation. Should be rare: on /app the AudioContextManager
  // creates+registers the context before any play; on the waitlist the
  // prewarm hook does. This path only fires if a consumer reaches here before
  // either ran (and nothing live exists in the registry or Tone).
  logger.warn(
    '⚠️ Creating new AudioContext - this should only happen once during app initialization',
  );

  const AudioContextConstructor =
    window.AudioContext || window.webkitAudioContext;
  const context = new AudioContextConstructor!({
    latencyHint: 'balanced',
    sampleRate: 48000,
  });

  // Publish through the registry so BOTH globals (__bassnotion_audioContext
  // and __persistentAudioContext) alias this one instance — never write only
  // the legacy key (that was the original divergence source).
  WindowRegistry.setAudioContext(context);

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
    // CRITICAL: Do NOT pass `disposeOld = true`. The dispose cascade
    // calls `transport.dispose()` → `Clock.dispose()` → `TickSource.dispose()`
    // which empties the StateTimeline. After that, ANY write to the
    // deprecated `Tone.Transport` const (which was captured at module-load
    // time and is used 200+ times in this codebase) throws
    // "Cannot read properties of undefined (reading 'time')" because
    // `TickSource.getTicksAtTime()` reads `lastState.time` and `lastState`
    // is undefined on an empty timeline.
    //
    // The orphaned old Context is GC-collected once nothing references it
    // — a tiny one-time leak, harmless.
    //
    // Long-term: migrate all `Tone.Transport.*` reads to
    // `Tone.getTransport().*` (which re-resolves the current context on
    // every call and is safe across swaps).
    Tone.setContext(persistentContext);
  }
}
