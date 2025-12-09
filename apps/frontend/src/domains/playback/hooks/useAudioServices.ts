import { useContext } from 'react';
import { AudioContext } from '../providers/AudioProvider.js';
import { WindowRegistry } from '../services/WindowRegistry.js';

/**
 * Hook to access CoreServices, EventBus, AudioContext, Tone
 *
 * Replaces direct window.__ global access patterns with centralized WindowRegistry API
 *
 * Migration from:
 *   ❌ window.__globalCoreServices
 *   ❌ window.__coreServices
 *   ❌ window.__globalTone
 *   ❌ window.__globalEventBus
 *
 * To:
 *   ✅ const { coreServices, tone, eventBus } = useAudioServices();
 *
 * This hook provides backward compatibility by falling back to WindowRegistry
 * if React context is not available (e.g., in test utilities or legacy components)
 */
export function useAudioServices() {
  const context = useContext(AudioContext);

  if (!context) {
    // Fallback to WindowRegistry for backward compatibility
    // This allows gradual migration without breaking existing code
    return {
      coreServices: WindowRegistry.getCoreServices(),
      eventBus: WindowRegistry.getEventBus(),
      audioContext: WindowRegistry.getAudioContext(),
      tone: WindowRegistry.getTone(),
      serviceRegistry: WindowRegistry.getServiceRegistry(),
      // Note: No isInitialized/isReady flags in fallback mode
      // Consumers should check for null/undefined values
    };
  }

  // Use React context when available (preferred)
  return {
    coreServices: context.coreServices,
    eventBus: context.coreServices?.getEventBus?.() || WindowRegistry.getEventBus(),
    audioContext: context.coreServices?.getAudioEngine?.()?.getContext?.() || WindowRegistry.getAudioContext(),
    tone: WindowRegistry.getTone(), // Tone is not in context, always use WindowRegistry
    serviceRegistry: WindowRegistry.getServiceRegistry(),
    // Additional context flags
    isInitialized: context.isInitialized,
    isReady: context.servicesReady,
    error: context.error,
  };
}
