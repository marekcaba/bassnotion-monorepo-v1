'use client';

/**
 * useBassAudioContext Hook
 *
 * Manages AudioContext initialization and gain node setup for the BassLineWidget:
 * - Creates and maintains AudioContext reference
 * - Creates master gain node for volume control
 * - Listens for audio services ready events
 * - Tracks sampler ready state
 *
 * @example
 * const {
 *   audioContextRef,
 *   gainNodeRef,
 *   samplerReady,
 *   samplesLoaded,
 *   totalSamples,
 * } = useBassAudioContext({ isMuted, volume });
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry.js';
import { getLogger } from '@/utils/logger.js';
import type {
  UseBassAudioContextOptions,
  UseBassAudioContextReturn,
} from '../types.js';

const logger = getLogger('bassline-widget');

/**
 * Hook for managing AudioContext and gain node for bass widget
 */
export function useBassAudioContext(
  options: UseBassAudioContextOptions,
): UseBassAudioContextReturn {
  const { isMuted, volume } = options;

  // Refs for audio resources
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioInitializedRef = useRef(false);

  // State for UI feedback
  const [samplerReady, setSamplerReady] = useState(false);
  const [samplesLoaded, setSamplesLoaded] = useState(0);
  const [totalSamples, setTotalSamples] = useState(0);

  /**
   * Initialize bass audio context and gain node
   * Buffer injection is handled by useBassBufferRegistration
   */
  const initializeBass = useCallback(async () => {
    // Skip if already initialized
    if (
      audioInitializedRef.current &&
      audioContextRef.current?.state === 'running'
    ) {
      return;
    }

    logger.debug('Initializing bass audio context...');

    // Get CoreServices
    const coreServices = WindowRegistry.getCoreServices();
    if (!coreServices) {
      logger.debug('CoreServices not ready, will retry...');
      return;
    }

    const audioEngine = coreServices.getAudioEngine?.();
    if (!audioEngine || !audioEngine.isReady()) {
      logger.debug('AudioEngine not ready, will retry...');
      return;
    }

    const context = audioEngine.getContext();
    if (!context || context.state !== 'running') {
      logger.debug('AudioContext not running, waiting for user gesture...');
      return;
    }

    audioContextRef.current = context;

    // Create gain node for volume control
    if (!gainNodeRef.current) {
      gainNodeRef.current = context.createGain();
      gainNodeRef.current.gain.value = isMuted ? 0 : volume / 100;
      gainNodeRef.current.connect(context.destination);
    }

    // Mark as initialized
    audioInitializedRef.current = true;
    setSamplerReady(true);
    logger.info('Bass audio context initialized, ready for buffer injection');
  }, [isMuted, volume]);

  /**
   * Initialize on mount and listen for audio ready events
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    initializeBass();

    const handleAudioReady = () => {
      logger.debug('Audio services ready event received');
      initializeBass();
    };

    const handleAudioContextStarted = () => {
      logger.debug('AudioContext started event received');
      initializeBass();
    };

    window.addEventListener('audioServicesReady', handleAudioReady);
    window.addEventListener('audioContextStarted', handleAudioContextStarted);

    return () => {
      window.removeEventListener('audioServicesReady', handleAudioReady);
      window.removeEventListener(
        'audioContextStarted',
        handleAudioContextStarted,
      );
    };
  }, [initializeBass]);

  return {
    audioContextRef,
    gainNodeRef,
    samplerReady,
    samplesLoaded,
    totalSamples,
    setSamplesLoaded,
    setTotalSamples,
    setSamplerReady,
  };
}
