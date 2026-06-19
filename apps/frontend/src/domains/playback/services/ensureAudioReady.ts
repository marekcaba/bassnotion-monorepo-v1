/**
 * ensureAudioReady — the single, promise-deduped entry point that warms the full
 * audio engine into the WindowRegistry singleton.
 *
 * Both the route-aware background warm-up (AppAudioWarmup, fires on idle after
 * paint) and the on-demand drill-start path call this. It mirrors the exact init
 * sequence AudioProvider uses (createCoreServicesWithPreInit → register registry +
 * services → services.initialize() → register the PlaybackEngine), so whoever
 * mounts the player later finds a warm engine via WindowRegistry.getPlaybackEngine().
 *
 * Idempotent + race-safe:
 *  - Returns immediately if an engine is already registered.
 *  - A single in-flight promise is shared across concurrent callers (warm-up +
 *    drill start), and createCoreServicesWithPreInit itself returns the
 *    GlobalAudioSystem process-wide singleton, so only ONE engine/AudioContext
 *    is ever created.
 *
 * Never throws to the caller's render path — failures resolve to `false`.
 */

import { WindowRegistry } from './WindowRegistry';

let inFlight: Promise<boolean> | null = null;

export function isAudioReady(): boolean {
  return !!WindowRegistry.getPlaybackEngine();
}

export function ensureAudioReady(): Promise<boolean> {
  // Already warm — nothing to do.
  if (isAudioReady()) return Promise.resolve(true);
  // Share the in-flight warm so concurrent callers don't double-init.
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      // Dynamic import keeps the heavy CoreServices graph out of any caller's
      // first-paint chunk.
      const { createCoreServicesWithPreInit } =
        await import('./core/CoreServices');

      // GlobalAudioSystem singleton — returns the same instance if one exists.
      const services = await createCoreServicesWithPreInit({
        autoLoadPlugins: true,
      });

      // Register the registry + services before initialize, mirroring
      // AudioProvider so consumers resolve the same objects.
      const registry = services.getServiceRegistry();
      if (registry) WindowRegistry.setServiceRegistry(registry);
      WindowRegistry.setCoreServices(services);

      // Creates the AudioContext in a SUSPENDED state (no autoplay) + wires the
      // engine. The gesture-gated resume() elsewhere flips suspended→running.
      await services.initialize();

      const playbackEngine = services.getPlaybackEngine();
      if (playbackEngine) {
        WindowRegistry.setPlaybackEngine(playbackEngine);
      }

      return isAudioReady();
    } catch (err) {
      // Warm-up is best-effort; on failure the on-demand path / AudioProvider
      // will try again. Don't surface to render.
      if (typeof console !== 'undefined') {
        console.warn('[ensureAudioReady] warm-up failed:', err);
      }
      return false;
    } finally {
      // Allow a retry on a later explicit call if the warm didn't land.
      if (!isAudioReady()) inFlight = null;
    }
  })();

  return inFlight;
}
