/**
 * WindowRegistry Tests
 *
 * Tests the centralized window global registry to prevent pollution
 * and naming collisions (BUG #8 fix)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WindowRegistry } from '../WindowRegistry.js';

describe('WindowRegistry - BUG #8: Window Object Pollution Prevention', () => {
  beforeEach(() => {
    // Clean up before each test
    WindowRegistry.cleanup();
  });

  afterEach(() => {
    // Clean up after each test
    WindowRegistry.cleanup();
  });

  // ============================================================================
  // CORE SERVICES TESTS
  // ============================================================================

  describe('CoreServices Management', () => {
    it('should set and get core services', () => {
      const mockServices = { test: 'value', engine: 'audio' };

      WindowRegistry.setCoreServices(mockServices);

      const retrieved = WindowRegistry.getCoreServices();
      expect(retrieved).toBe(mockServices);
    });

    it('should replace existing core services', () => {
      const oldServices = { version: 'old' };
      const newServices = { version: 'new' };

      WindowRegistry.setCoreServices(oldServices);
      WindowRegistry.setCoreServices(newServices);

      const retrieved = WindowRegistry.getCoreServices();
      expect(retrieved).toBe(newServices);
      expect(retrieved).not.toBe(oldServices);
    });

    it('should clean up legacy __globalCoreServices key', () => {
      (window as any).__globalCoreServices = { legacy: true };

      WindowRegistry.setCoreServices({ new: true });

      expect((window as any).__globalCoreServices).toBeUndefined();
      expect((window as any).__bassnotion_coreServices).toBeDefined();
    });

    it('should fall back to legacy key during migration', () => {
      (window as any).__globalCoreServices = { legacy: true };

      const retrieved = WindowRegistry.getCoreServices();
      expect(retrieved).toEqual({ legacy: true });
    });
  });

  // ============================================================================
  // EVENT BUS TESTS
  // ============================================================================

  describe('EventBus Management', () => {
    it('should set and get event bus', () => {
      const mockEventBus = { emit: () => {}, on: () => {} };

      WindowRegistry.setEventBus(mockEventBus);

      const retrieved = WindowRegistry.getEventBus();
      expect(retrieved).toBe(mockEventBus);
    });

    it('should clean up legacy __globalEventBus key', () => {
      (window as any).__globalEventBus = { legacy: true };

      WindowRegistry.setEventBus({ new: true });

      expect((window as any).__globalEventBus).toBeUndefined();
    });
  });

  // ============================================================================
  // AUDIOCONTEXT TESTS
  // ============================================================================

  describe('AudioContext Management', () => {
    it('should set and get audio context', () => {
      const mockContext = { state: 'running' } as any;

      WindowRegistry.setAudioContext(mockContext);

      const retrieved = WindowRegistry.getAudioContext();
      expect(retrieved).toBe(mockContext);
    });

    it('should set and get audio context unsubscribe function', () => {
      const mockUnsubscribe = () => console.log('unsubscribed');

      WindowRegistry.setAudioContextUnsubscribe(mockUnsubscribe);

      const retrieved = WindowRegistry.getAudioContextUnsubscribe();
      expect(retrieved).toBe(mockUnsubscribe);
    });

    it('should clean up unsubscribe when set to undefined', () => {
      const mockUnsubscribe = () => {};
      WindowRegistry.setAudioContextUnsubscribe(mockUnsubscribe);

      WindowRegistry.setAudioContextUnsubscribe(undefined);

      expect(window.__bassnotion_audioContextUnsubscribe).toBeUndefined();
    });
  });

  // ============================================================================
  // INITIALIZATION FLAGS TESTS
  // ============================================================================

  describe('Initialization Flags', () => {
    it('should set and get samplesReady flag', () => {
      WindowRegistry.setSamplesReady(true);
      expect(WindowRegistry.getSamplesReady()).toBe(true);

      WindowRegistry.setSamplesReady(false);
      expect(WindowRegistry.getSamplesReady()).toBe(false);
    });

    it('should set and get essentialSamplesLoaded flag', () => {
      WindowRegistry.setEssentialSamplesLoaded(true);
      expect(WindowRegistry.getEssentialSamplesLoaded()).toBe(true);

      WindowRegistry.setEssentialSamplesLoaded(false);
      expect(WindowRegistry.getEssentialSamplesLoaded()).toBe(false);
    });

    it('should set and get initializationFailed flag', () => {
      WindowRegistry.setInitializationFailed(true);
      expect(WindowRegistry.getInitializationFailed()).toBe(true);

      WindowRegistry.setInitializationFailed(false);
      expect(WindowRegistry.getInitializationFailed()).toBe(false);
    });

    it('should default to false for unset flags', () => {
      expect(WindowRegistry.getSamplesReady()).toBe(false);
      expect(WindowRegistry.getEssentialSamplesLoaded()).toBe(false);
      expect(WindowRegistry.getInitializationFailed()).toBe(false);
    });
  });

  // ============================================================================
  // CLEANUP TESTS
  // ============================================================================

  describe('Cleanup', () => {
    it('should clean up all BassNotion globals', () => {
      WindowRegistry.setCoreServices({ test: 'value' });
      WindowRegistry.setEventBus({ test: 'bus' });
      WindowRegistry.setSamplesReady(true);
      WindowRegistry.setEssentialSamplesLoaded(true);

      WindowRegistry.cleanup();

      expect(window.__bassnotion_coreServices).toBeUndefined();
      expect(window.__bassnotion_eventBus).toBeUndefined();
      expect(window.__bassnotion_samplesReady).toBeUndefined();
      expect(window.__bassnotion_essentialSamplesLoaded).toBeUndefined();
    });

    it('should clean up legacy keys', () => {
      (window as any).__globalCoreServices = { legacy: true };
      (window as any).__coreServices = { legacy: true };
      (window as any).__samplesReady = true;

      WindowRegistry.cleanup();

      expect((window as any).__globalCoreServices).toBeUndefined();
      expect((window as any).__coreServices).toBeUndefined();
      expect((window as any).__samplesReady).toBeUndefined();
    });

    it('should not affect non-BassNotion globals', () => {
      (window as any).myCustomGlobal = 'should remain';

      WindowRegistry.setCoreServices({ test: 'value' });
      WindowRegistry.cleanup();

      expect((window as any).myCustomGlobal).toBe('should remain');
    });
  });

  // ============================================================================
  // SERVICE REGISTRY TESTS
  // ============================================================================

  describe('Service Registry', () => {
    it('should set and get service registry', () => {
      const mockRegistry = { services: ['audio', 'transport'] };

      WindowRegistry.setServiceRegistry(mockRegistry);

      const retrieved = WindowRegistry.getServiceRegistry();
      expect(retrieved).toBe(mockRegistry);
    });
  });

  // ============================================================================
  // DEBUGGING UTILITIES TESTS
  // ============================================================================

  describe('Debugging Utilities', () => {
    it('should return all active BassNotion globals', () => {
      WindowRegistry.setCoreServices({ test: 'core' });
      WindowRegistry.setEventBus({ test: 'bus' });
      WindowRegistry.setSamplesReady(true);

      const all = WindowRegistry.debugGetAll();

      expect(all.__bassnotion_coreServices).toEqual({ test: 'core' });
      expect(all.__bassnotion_eventBus).toEqual({ test: 'bus' });
      expect(all.__bassnotion_samplesReady).toBe(true);
    });

    it('should return empty object when no globals set', () => {
      const all = WindowRegistry.debugGetAll();
      expect(all).toEqual({});
    });

    it('should detect legacy keys still present', () => {
      (window as any).__globalCoreServices = { legacy: true };
      (window as any).__samplesReady = true;

      const legacyKeys = WindowRegistry.debugCheckLegacyKeys();

      expect(legacyKeys).toContain('__globalCoreServices');
      expect(legacyKeys).toContain('__samplesReady');
    });

    it('should return empty array when no legacy keys present', () => {
      WindowRegistry.cleanup();

      const legacyKeys = WindowRegistry.debugCheckLegacyKeys();
      expect(legacyKeys).toEqual([]);
    });
  });

  // ============================================================================
  // PLAYBACK ENGINES TESTS (Phase 1 Task 1.5)
  // ============================================================================

  describe('Playback Engines Management', () => {
    it('should set and get RegionProcessor', () => {
      const mockProcessor = { start: () => {}, stop: () => {} };

      WindowRegistry.setRegionProcessor(mockProcessor);

      const retrieved = WindowRegistry.getRegionProcessor();
      expect(retrieved).toBe(mockProcessor);
    });

    it('should set and get PlaybackEngine', () => {
      const mockEngine = {
        play: () => {},
        pause: () => {},
        getState: () => 'idle',
      };

      WindowRegistry.setPlaybackEngine(mockEngine);

      const retrieved = WindowRegistry.getPlaybackEngine();
      expect(retrieved).toBe(mockEngine);
    });

    it('should track both RegionProcessor and PlaybackEngine simultaneously', () => {
      const mockProcessor = { type: 'region' };
      const mockEngine = { type: 'playback' };

      WindowRegistry.setRegionProcessor(mockProcessor);
      WindowRegistry.setPlaybackEngine(mockEngine);

      expect(WindowRegistry.getRegionProcessor()).toBe(mockProcessor);
      expect(WindowRegistry.getPlaybackEngine()).toBe(mockEngine);
      expect(WindowRegistry.getRegionProcessor()).not.toBe(mockEngine);
    });

    it('should allow cleanup of both engines', () => {
      const mockProcessor = { type: 'region' };
      const mockEngine = { type: 'playback' };

      WindowRegistry.setRegionProcessor(mockProcessor);
      WindowRegistry.setPlaybackEngine(mockEngine);

      // Cleanup both
      WindowRegistry.cleanup();

      expect(WindowRegistry.getRegionProcessor()).toBeNull();
      expect(WindowRegistry.getPlaybackEngine()).toBeNull();
    });

    it('should handle null PlaybackEngine (feature flag disabled)', () => {
      const mockProcessor = { type: 'region' };

      WindowRegistry.setRegionProcessor(mockProcessor);
      // Don't set PlaybackEngine (simulating feature flag disabled)

      expect(WindowRegistry.getRegionProcessor()).toBe(mockProcessor);
      expect(WindowRegistry.getPlaybackEngine()).toBeNull();
    });

    it('should replace existing RegionProcessor', () => {
      const oldProcessor = { version: 'old' };
      const newProcessor = { version: 'new' };

      WindowRegistry.setRegionProcessor(oldProcessor);
      WindowRegistry.setRegionProcessor(newProcessor);

      expect(WindowRegistry.getRegionProcessor()).toBe(newProcessor);
    });

    it('should replace existing PlaybackEngine', () => {
      const oldEngine = { version: 'old' };
      const newEngine = { version: 'new' };

      WindowRegistry.setPlaybackEngine(oldEngine);
      WindowRegistry.setPlaybackEngine(newEngine);

      expect(WindowRegistry.getPlaybackEngine()).toBe(newEngine);
    });

    it('should clean up engines on WindowRegistry.cleanup()', () => {
      WindowRegistry.setRegionProcessor({ test: 'processor' });
      WindowRegistry.setPlaybackEngine({ test: 'engine' });

      WindowRegistry.cleanup();

      expect(window.__bassnotion_regionProcessor).toBeUndefined();
      expect(window.__bassnotion_playbackEngine).toBeUndefined();
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration Scenarios', () => {
    it('should handle full lifecycle: set → get → cleanup', () => {
      // Set
      WindowRegistry.setCoreServices({ engine: 'audio' });
      WindowRegistry.setEventBus({ type: 'bus' });
      WindowRegistry.setSamplesReady(true);

      // Get
      expect(WindowRegistry.getCoreServices()).toEqual({ engine: 'audio' });
      expect(WindowRegistry.getEventBus()).toEqual({ type: 'bus' });
      expect(WindowRegistry.getSamplesReady()).toBe(true);

      // Cleanup
      WindowRegistry.cleanup();

      expect(WindowRegistry.getCoreServices()).toBeFalsy();
      expect(WindowRegistry.getEventBus()).toBeFalsy();
      expect(WindowRegistry.getSamplesReady()).toBe(false);
    });

    it('should handle migration from legacy to new keys', () => {
      // Start with legacy
      (window as any).__globalCoreServices = { legacy: 'true' };

      // Access should work
      expect(WindowRegistry.getCoreServices()).toEqual({ legacy: 'true' });

      // Migrate to new key
      WindowRegistry.setCoreServices({ migrated: 'true' });

      // Should use new key and clean up legacy
      expect(WindowRegistry.getCoreServices()).toEqual({ migrated: 'true' });
      expect((window as any).__globalCoreServices).toBeUndefined();
    });

    it('should prevent naming collisions', () => {
      const service1 = { id: 1 };
      const service2 = { id: 2 };

      WindowRegistry.setCoreServices(service1);

      // Attempt collision (should replace, not create duplicate)
      WindowRegistry.setCoreServices(service2);

      const all = WindowRegistry.debugGetAll();
      const keys = Object.keys(all);

      // Should only have one __bassnotion_coreServices key
      const coreServicesKeys = keys.filter((k) => k.includes('coreServices'));
      expect(coreServicesKeys.length).toBe(1);
      expect(all.__bassnotion_coreServices).toBe(service2);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle undefined gracefully', () => {
      WindowRegistry.setCoreServices(undefined as any);
      expect(WindowRegistry.getCoreServices()).toBeUndefined();
    });

    it('should handle null gracefully', () => {
      WindowRegistry.setCoreServices(null as any);
      expect(WindowRegistry.getCoreServices()).toBeFalsy();
    });

    it('should handle multiple cleanup calls', () => {
      WindowRegistry.setCoreServices({ test: 'value' });

      WindowRegistry.cleanup();
      WindowRegistry.cleanup(); // Should not throw
      WindowRegistry.cleanup(); // Should not throw

      expect(WindowRegistry.getCoreServices()).toBeFalsy();
    });

    it('should handle set after cleanup', () => {
      WindowRegistry.setCoreServices({ first: 'value' });
      WindowRegistry.cleanup();

      WindowRegistry.setCoreServices({ second: 'value' });

      expect(WindowRegistry.getCoreServices()).toEqual({ second: 'value' });
    });
  });
});
