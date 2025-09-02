/**
 * Audio Test Setup Utilities
 *
 * Provides proper setup for audio integration tests that bypasses
 * browser environment checks while maintaining test integrity
 */

import { AudioEngine } from '@/domains/playback/services/core/AudioEngine.js';
import type { AudioEngineConfig } from '@/domains/playback/services/core/AudioEngine.js';

// Mock browser APIs if not available
export function setupBrowserMocks(): void {
  // Mock navigator if not present
  if (typeof navigator === 'undefined') {
    (global as any).navigator = {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };
  }

  // Mock window if not present
  if (typeof window === 'undefined') {
    (global as any).window = {
      __globalTone: null,
      AudioContext: MockAudioContext,
      AudioWorkletNode: MockAudioWorkletNode,
    };
  }

  // Mock performance if not present
  if (typeof performance === 'undefined') {
    (global as any).performance = {
      now: () => Date.now(),
    };
  }
}

// Mock AudioContext for test environment
class MockAudioContext {
  readonly sampleRate = 48000;
  readonly currentTime = 0;
  readonly state = 'running';
  readonly baseLatency = 0.01;
  readonly outputLatency = 0.02;

  async resume() {
    return Promise.resolve();
  }

  async suspend() {
    return Promise.resolve();
  }

  async close() {
    return Promise.resolve();
  }

  createGain() {
    return {
      gain: { value: 1 },
      connect: () => {},
      disconnect: () => {},
    };
  }

  createOscillator() {
    return {
      frequency: { value: 440 },
      connect: () => {},
      disconnect: () => {},
      start: () => {},
      stop: () => {},
    };
  }
}

// Mock AudioWorkletNode for test environment
class MockAudioWorkletNode {
  constructor() {}
  connect() {}
  disconnect() {}
}

/**
 * Get test-friendly AudioEngine configuration
 */
export function getTestAudioEngineConfig(
  overrides: Partial<AudioEngineConfig> = {},
): AudioEngineConfig {
  return {
    enableBrowserCheck: false,
    enableValidation: false,
    maxInitRetries: 1,
    initRetryDelay: 10,
    sampleRate: 48000,
    latencyHint: 'interactive',
    ...overrides,
  };
}

/**
 * Create and initialize AudioEngine for tests
 */
export async function createTestAudioEngine(
  config: Partial<AudioEngineConfig> = {},
): Promise<AudioEngine> {
  setupBrowserMocks();

  const audioEngine = AudioEngine.getInstance(
    undefined,
    getTestAudioEngineConfig(config),
  );

  // Pre-initialize without browser checks
  await audioEngine.preInitialize();

  return audioEngine;
}

/**
 * Reset AudioEngine singleton for test isolation
 */
export function resetAudioEngine(): void {
  AudioEngine.resetInstance();

  // Clear global Tone reference
  if (typeof window !== 'undefined') {
    window.__globalTone = null;
  }
}

/**
 * Setup complete audio test environment
 */
export async function setupAudioTestEnvironment(): Promise<{
  audioEngine: AudioEngine;
  cleanup: () => void;
}> {
  setupBrowserMocks();

  const audioEngine = await createTestAudioEngine();

  const cleanup = () => {
    resetAudioEngine();
  };

  return { audioEngine, cleanup };
}
