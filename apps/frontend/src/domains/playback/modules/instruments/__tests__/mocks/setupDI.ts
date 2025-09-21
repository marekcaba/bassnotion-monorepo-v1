/**
 * Setup utilities for dependency injection testing
 *
 * This provides a consistent way to setup window.__coreServices
 * and AudioEngine mocks across all instrument tests.
 */

import { vi } from 'vitest';
import { createMockAudioEngine, mockTone } from './mockAudioEngine.js';

// Mock AudioContext
export const mockAudioContext = {
  state: 'running',
  sampleRate: 48000,
  currentTime: 0,
  createGain: vi.fn(() => ({
    gain: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
  createOscillator: vi.fn(() => ({
    type: 'sine',
    frequency: { value: 440 },
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  })),
  createBuffer: vi.fn(() => ({
    length: 48000,
    duration: 1,
    sampleRate: 48000,
    numberOfChannels: 2,
    getChannelData: vi.fn(() => new Float32Array(48000)),
  })),
  destination: {},
};

// Mock window.__coreServices
export const createMockCoreServices = (
  audioEngine = createMockAudioEngine(),
) => ({
  getAudioEngine: vi.fn(() => audioEngine),
  getToneInstance: vi.fn(() => mockTone),
});

/**
 * Setup DI mocks for testing
 *
 * This sets up:
 * - window.__coreServices with getAudioEngine
 * - window.__globalCoreServices as alias
 * - AudioContext and webkitAudioContext mocks
 *
 * Returns the mocked audioEngine for verification
 */
export const setupDIMocks = (audioEngine = createMockAudioEngine()) => {
  const mockCoreServices = createMockCoreServices(audioEngine);

  // Setup window object with all required mocks
  (global as any).window = {
    __coreServices: mockCoreServices,
    __globalCoreServices: mockCoreServices, // Some code uses this alias
    AudioContext: vi.fn().mockImplementation(() => mockAudioContext),
    webkitAudioContext: vi.fn().mockImplementation(() => mockAudioContext),
  };

  // Also set up global AudioContext constructor
  (global as any).AudioContext = vi
    .fn()
    .mockImplementation(() => mockAudioContext);

  return {
    audioEngine,
    coreServices: mockCoreServices,
    audioContext: mockAudioContext,
  };
};

/**
 * Clean up DI mocks after testing
 */
export const cleanupDIMocks = () => {
  delete (global as any).window;
  delete (global as any).AudioContext;
  vi.clearAllMocks();
};
