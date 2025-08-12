import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock must be defined before vi.mock
vi.mock('../toneLoader', () => ({
  loadGlobalTone: vi.fn()
}));

import { SalamanderVelocitySampler } from '../SalamanderVelocitySampler';
import { loadGlobalTone } from '../toneLoader';

// Mock Tone.js
const mockTone = {
  context: {
    state: 'running',
    currentTime: 0
  },
  start: vi.fn().mockResolvedValue(undefined),
  Sampler: vi.fn(),
  Player: vi.fn(),
  Time: vi.fn((duration) => ({
    toSeconds: () => typeof duration === 'number' ? duration : 1
  })),
  Transport: {
    state: 'started',
    seconds: 0
  },
  now: () => 0
};

describe('SalamanderVelocitySampler', () => {
  let sampler: SalamanderVelocitySampler;
  let mockSamplerInstance: any;
  let mockPlayerInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up the mock to return mockTone
    vi.mocked(loadGlobalTone).mockResolvedValue(mockTone as any);
    
    // Mock Sampler instance
    mockSamplerInstance = {
      loaded: Promise.resolve(),
      _buffers: new Map(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      dispose: vi.fn(),
      triggerAttackRelease: vi.fn(),
      triggerRelease: vi.fn(),
      releaseAll: vi.fn()
    };
    
    // Mock Player instance
    mockPlayerInstance = {
      loaded: Promise.resolve(),
      buffer: {},
      connect: vi.fn(),
      disconnect: vi.fn(),
      dispose: vi.fn(),
      start: vi.fn()
    };
    
    // Make mockSamplerInstance look like a real Tone.Sampler
    Object.setPrototypeOf(mockSamplerInstance, mockTone.Sampler.prototype);
    
    mockTone.Sampler.mockImplementation((options) => {
      if (options.onload) {
        setTimeout(() => options.onload(), 10);
      }
      return mockSamplerInstance;
    });
    
    mockTone.Player.mockImplementation((options) => {
      if (options.onload) {
        setTimeout(() => options.onload(), 10);
      }
      return mockPlayerInstance;
    });
    
    sampler = new SalamanderVelocitySampler();
  });

  describe('initialization', () => {
    it('should initialize with local samples path', async () => {
      await sampler.initialize();
      
      // Check that Sampler was created with local path
      expect(mockTone.Sampler).toHaveBeenCalled();
      const samplerCall = mockTone.Sampler.mock.calls[0][0];
      expect(samplerCall.baseUrl).toContain('/samples/salamander-mp3/');
    });

    it('should load common velocity layers on initialization', async () => {
      await sampler.initialize();
      
      const status = sampler.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.loadedLayers.length).toBeGreaterThan(0);
    });

    it('should handle sampler loading errors gracefully', async () => {
      // Make sampler creation fail
      mockTone.Sampler.mockImplementation(() => {
        throw new Error('Failed to create sampler');
      });
      
      await sampler.initialize();
      
      // Should still be initialized even if some layers fail
      const status = sampler.getStatus();
      expect(status.initialized).toBe(true);
    });
  });

  describe('layer loading', () => {
    it('should use local samples path for layers', async () => {
      await sampler.initialize();
      
      // Find calls that created samplers
      const samplerCalls = mockTone.Sampler.mock.calls;
      
      // All calls should use local path
      samplerCalls.forEach(call => {
        const options = call[0];
        if (options.baseUrl) {
          expect(options.baseUrl).toContain('/samples/salamander-mp3/');
          expect(options.baseUrl).not.toContain('supabase');
        }
      });
    });

    it('should have correct sample mapping', async () => {
      await sampler.initialize();
      
      const samplerCall = mockTone.Sampler.mock.calls[0][0];
      const urls = samplerCall.urls;
      
      // Check key notes are mapped correctly
      expect(urls.C4).toBe('C4.mp3');
      expect(urls.A4).toBe('A4.mp3');
      expect(urls.Eb4).toBe('Ds4.mp3'); // Flats mapped to sharps
    });
  });

  describe('note playback', () => {
    beforeEach(async () => {
      await sampler.initialize();
    });

    it('should play notes when sampler is loaded', async () => {
      // Mark sampler as loaded
      Object.defineProperty(mockSamplerInstance, 'loaded', {
        get: () => true
      });
      
      await sampler.triggerAttackRelease('C4', 1, undefined, 64);
      
      expect(mockSamplerInstance.triggerAttackRelease).toHaveBeenCalledWith(
        'C4',
        1,
        undefined,
        expect.any(Number) // velocity normalized to 0-1
      );
    });

    it('should handle unloaded samplers gracefully', async () => {
      // Make the sampler report as not loaded
      mockSamplerInstance.loaded = false;
      mockSamplerInstance.triggerAttackRelease.mockImplementation(() => {
        throw new Error('buffer is either not set or not loaded');
      });
      
      // Should not throw - should handle error internally
      await expect(
        sampler.triggerAttackRelease('C4', 1, undefined, 64)
      ).resolves.not.toThrow();
    });

    it('should normalize MIDI velocity to 0-1 range', async () => {
      Object.defineProperty(mockSamplerInstance, 'loaded', {
        get: () => true
      });
      
      await sampler.triggerAttackRelease('C4', 1, undefined, 127);
      
      expect(mockSamplerInstance.triggerAttackRelease).toHaveBeenCalledWith(
        'C4',
        1,
        undefined,
        1 // 127/127 = 1
      );
    });
  });

  describe('error handling', () => {
    it('should handle missing Tone.js gracefully', async () => {
      // Mock loadGlobalTone to return null
      vi.mocked(loadGlobalTone).mockResolvedValueOnce(null);
      
      const newSampler = new SalamanderVelocitySampler();
      
      // Should throw when trying to initialize without Tone
      await expect(newSampler.initialize()).rejects.toThrow('Tone.js is not loaded');
    });
  });

  describe('status reporting', () => {
    it('should report correct status', async () => {
      const status = sampler.getStatus();
      
      expect(status).toHaveProperty('initialized');
      expect(status).toHaveProperty('loadedLayers');
      expect(status).toHaveProperty('totalLayers');
      expect(status).toHaveProperty('memoryEstimate');
      
      expect(status.initialized).toBe(false);
      expect(status.loadedLayers).toEqual([]);
      expect(status.totalLayers).toBe(16);
    });

    it('should update status after initialization', async () => {
      await sampler.initialize();
      
      const status = sampler.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.loadedLayers.length).toBeGreaterThan(0);
    });
  });
});