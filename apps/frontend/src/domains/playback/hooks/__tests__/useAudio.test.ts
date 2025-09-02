/**
 * useAudio Hook Tests
 * Story 3.18.6: Widget Integration & Enhancement
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAudio } from '../useAudio';
import { ServiceRegistry } from '../../services/core/ServiceRegistry';
import { AudioEngine } from '../../services/core/AudioEngine';
import { AudioError, AudioInitializationError } from '../../errors/AudioErrors';

// Mock AudioEngine
class MockAudioEngine {
  public isInitialized = false;
  private _context: AudioContext | null = null;

  async initialize() {
    await new Promise((resolve) => setTimeout(resolve, 10));
    this.isInitialized = true;
    this._context = new AudioContext();
  }

  async createSampler(config: any) {
    if (!this.isInitialized) {
      throw new Error('AudioEngine not initialized');
    }
    return {
      triggerAttack: vi.fn(),
      triggerRelease: vi.fn(),
      triggerAttackRelease: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      dispose: vi.fn(),
    };
  }

  getTone() {
    if (!this.isInitialized) {
      throw new Error('AudioEngine not initialized');
    }
    return { Transport: {}, Sampler: {} };
  }

  getContext() {
    return this._context;
  }
}

describe('useAudio Hook', () => {
  let mockServiceRegistry: ServiceRegistry;
  let mockAudioEngine: MockAudioEngine;

  beforeEach(() => {
    mockAudioEngine = new MockAudioEngine();
    mockServiceRegistry = new ServiceRegistry();
    mockServiceRegistry.register('audioEngine', mockAudioEngine as any);

    // Set global service registry
    (window as any).__serviceRegistry = mockServiceRegistry;
  });

  afterEach(() => {
    delete (window as any).__serviceRegistry;
    vi.clearAllMocks();
  });

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useAudio());

    expect(result.current.isReady).toBe(false);
    expect(result.current.isInitializing).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.audioContext).toBeNull();
  });

  it('should handle missing ServiceRegistry', () => {
    delete (window as any).__serviceRegistry;

    const { result } = renderHook(() => useAudio());

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toContain(
      'ServiceRegistry not found',
    );
  });

  it('should initialize audio engine successfully', async () => {
    const { result } = renderHook(() => useAudio());

    await act(async () => {
      await result.current.initialize();
    });

    expect(result.current.isReady).toBe(true);
    expect(result.current.isInitializing).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.audioContext).toBeInstanceOf(AudioContext);
  });

  it('should prevent multiple simultaneous initialization attempts', async () => {
    const { result } = renderHook(() => useAudio());

    // Start multiple initialization attempts
    const promise1 = act(async () => result.current.initialize());
    const promise2 = act(async () => result.current.initialize());

    await Promise.all([promise1, promise2]);

    expect(result.current.isReady).toBe(true);
    expect(result.current.isInitializing).toBe(false);
  });

  it('should handle initialization errors', async () => {
    // Override initialize to throw error
    mockAudioEngine.initialize = vi
      .fn()
      .mockRejectedValue(
        new AudioInitializationError('Test initialization error'),
      );

    const { result } = renderHook(() => useAudio());

    await act(async () => {
      try {
        await result.current.initialize();
      } catch (err) {
        // Expected to throw
      }
    });

    expect(result.current.isReady).toBe(false);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toContain(
      'Test initialization error',
    );
  });

  it('should create sampler when audio is ready', async () => {
    const { result } = renderHook(() => useAudio());

    await act(async () => {
      await result.current.initialize();
    });

    const samplerConfig = {
      urls: { C4: 'sample.mp3' },
      baseUrl: '/samples/',
    };

    let sampler;
    await act(async () => {
      sampler = await result.current.createSampler(samplerConfig);
    });

    expect(sampler).toBeDefined();
    expect(sampler).toHaveProperty('triggerAttack');
    expect(sampler).toHaveProperty('triggerRelease');
  });

  it('should throw error when creating sampler before initialization', async () => {
    const { result } = renderHook(() => useAudio());

    const samplerConfig = {
      urls: { C4: 'sample.mp3' },
      baseUrl: '/samples/',
    };

    await expect(result.current.createSampler(samplerConfig)).rejects.toThrow(
      'Audio not ready',
    );
  });

  it('should get Tone instance when ready', async () => {
    const { result } = renderHook(() => useAudio());

    await act(async () => {
      await result.current.initialize();
    });

    const tone = result.current.getTone();
    expect(tone).toBeDefined();
    expect(tone).toHaveProperty('Transport');
    expect(tone).toHaveProperty('Sampler');
  });

  it('should throw error when getting Tone before initialization', () => {
    const { result } = renderHook(() => useAudio());

    expect(() => result.current.getTone()).toThrow('Audio not ready');
  });

  it('should use provided ServiceRegistry', () => {
    const customRegistry = new ServiceRegistry();
    const customAudioEngine = new MockAudioEngine();
    customRegistry.register('audioEngine', customAudioEngine as any);

    const { result } = renderHook(() => useAudio(customRegistry));

    expect(result.current.error).toBeNull();
  });

  it('should detect already initialized AudioEngine', () => {
    // Pre-initialize the audio engine
    mockAudioEngine.initialize();

    const { result } = renderHook(() => useAudio());

    expect(result.current.isReady).toBe(true);
    expect(result.current.isInitializing).toBe(false);
  });
});
