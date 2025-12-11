/**
 * CoreServices Integration Tests
 * Phase 1, Task 1.4 Day 3: Dual-Engine Coexistence Testing
 *
 * Tests:
 * - PlaybackEngine integration with CoreServices
 * - Feature flag behavior
 * - Dual-engine coexistence (RegionProcessor + PlaybackEngine)
 * - Lifecycle management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CoreServices } from '../CoreServices.js';
import * as featureFlags from '../../../config/featureFlags.js';

// Mock feature flags module
vi.mock('../../../config/featureFlags.js', () => ({
  isNewPlaybackEngineEnabled: vi.fn(() => false),
  logPlaybackEngineMigrationEvent: vi.fn(),
  getAudioArchitectureFlags: vi.fn(() => ({
    ENABLE_NEW_PLAYBACK_ENGINE: false,
  })),
}));

describe('CoreServices - PlaybackEngine Integration', () => {
  let coreServices: CoreServices;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (coreServices) {
      coreServices.dispose();
    }
  });

  describe('Feature Flag Disabled (Default)', () => {
    beforeEach(() => {
      vi.mocked(featureFlags.isNewPlaybackEngineEnabled).mockReturnValue(false);
    });

    it('should NOT create PlaybackEngine when feature flag is disabled', () => {
      coreServices = new CoreServices();

      const playbackEngine = coreServices.getPlaybackEngine();
      expect(playbackEngine).toBeNull();
    });

    it('should create RegionProcessor regardless of feature flag', () => {
      coreServices = new CoreServices();

      const regionProcessor = coreServices.getRegionProcessor();
      expect(regionProcessor).toBeDefined();
      expect(regionProcessor).not.toBeNull();
    });

    it('should not affect CoreServices creation when feature flag is disabled', () => {
      coreServices = new CoreServices();

      // CoreServices should be created successfully
      expect(coreServices).toBeDefined();
      expect(coreServices.getPlaybackEngine()).toBeNull();
      expect(coreServices.getRegionProcessor()).toBeDefined();
    });

    it('should NOT log PlaybackEngine migration events when disabled', () => {
      coreServices = new CoreServices();

      expect(
        featureFlags.logPlaybackEngineMigrationEvent,
      ).not.toHaveBeenCalled();
    });
  });

  describe('Feature Flag Enabled', () => {
    beforeEach(() => {
      vi.mocked(featureFlags.isNewPlaybackEngineEnabled).mockReturnValue(true);
    });

    it('should create PlaybackEngine when feature flag is enabled', () => {
      coreServices = new CoreServices();

      const playbackEngine = coreServices.getPlaybackEngine();
      expect(playbackEngine).not.toBeNull();
      expect(playbackEngine).toBeDefined();
    });

    it('should create BOTH RegionProcessor and PlaybackEngine (dual-engine)', () => {
      coreServices = new CoreServices();

      const regionProcessor = coreServices.getRegionProcessor();
      const playbackEngine = coreServices.getPlaybackEngine();

      expect(regionProcessor).toBeDefined();
      expect(regionProcessor).not.toBeNull();
      expect(playbackEngine).not.toBeNull();
      expect(playbackEngine).toBeDefined();
    });

    it('should log PlaybackEngine creation event', () => {
      coreServices = new CoreServices();

      expect(featureFlags.logPlaybackEngineMigrationEvent).toHaveBeenCalledWith(
        'PlaybackEngine created',
        expect.any(Object),
      );
    });

    it('should create PlaybackEngine in ready state', () => {
      coreServices = new CoreServices();

      const playbackEngine = coreServices.getPlaybackEngine();
      expect(playbackEngine).not.toBeNull();

      // PlaybackEngine should be in initial state (idle or ready)
      const state = playbackEngine!.getState();
      expect(['idle', 'ready']).toContain(state);
    });

    it('should dispose PlaybackEngine during CoreServices disposal', async () => {
      coreServices = new CoreServices();

      const playbackEngine = coreServices.getPlaybackEngine();
      expect(playbackEngine).not.toBeNull();

      // Spy on PlaybackEngine dispose
      const disposeSpy = vi.spyOn(playbackEngine!, 'dispose');

      await coreServices.dispose();

      expect(disposeSpy).toHaveBeenCalled();
      expect(coreServices.getPlaybackEngine()).toBeNull();
    });

    it('should log PlaybackEngine disposal event', async () => {
      coreServices = new CoreServices();

      await coreServices.dispose();

      expect(featureFlags.logPlaybackEngineMigrationEvent).toHaveBeenCalledWith(
        'PlaybackEngine disposed',
      );
    });
  });

  describe('Dual-Engine Coexistence', () => {
    beforeEach(() => {
      vi.mocked(featureFlags.isNewPlaybackEngineEnabled).mockReturnValue(true);
    });

    it('should maintain separate state for RegionProcessor and PlaybackEngine', () => {
      coreServices = new CoreServices();

      const regionProcessor = coreServices.getRegionProcessor();
      const playbackEngine = coreServices.getPlaybackEngine();

      expect(regionProcessor).toBeDefined();
      expect(playbackEngine).not.toBeNull();

      // They should be different instances
      expect(regionProcessor).not.toBe(playbackEngine);
    });

    it('should provide access to both engines via getters', () => {
      coreServices = new CoreServices();

      const regionProcessor = coreServices.getRegionProcessor();
      const playbackEngine = coreServices.getPlaybackEngine();

      // Both should be accessible
      expect(regionProcessor).toBeDefined();
      expect(playbackEngine).not.toBeNull();

      // Should have access to same EventBus
      const eventBus = coreServices.getEventBus();
      expect(eventBus).toBeDefined();
    });
  });

  describe('Feature Flag Consistency', () => {
    it('should respect feature flag at construction time', () => {
      // Flag off
      vi.mocked(featureFlags.isNewPlaybackEngineEnabled).mockReturnValue(false);
      const services1 = new CoreServices();
      expect(services1.getPlaybackEngine()).toBeNull();
      services1.dispose();

      // Flag on
      vi.mocked(featureFlags.isNewPlaybackEngineEnabled).mockReturnValue(true);
      const services2 = new CoreServices();
      expect(services2.getPlaybackEngine()).not.toBeNull();
      services2.dispose();
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain RegionProcessor as primary engine when flag is off', () => {
      vi.mocked(featureFlags.isNewPlaybackEngineEnabled).mockReturnValue(false);

      coreServices = new CoreServices();

      const regionProcessor = coreServices.getRegionProcessor();
      const playbackEngine = coreServices.getPlaybackEngine();

      expect(regionProcessor).toBeDefined();
      expect(playbackEngine).toBeNull();
    });

    it('should provide all required services when flag is off', () => {
      vi.mocked(featureFlags.isNewPlaybackEngineEnabled).mockReturnValue(false);

      coreServices = new CoreServices();

      // All services should be accessible
      expect(coreServices.getRegionProcessor()).toBeDefined();
      expect(coreServices.getEventBus()).toBeDefined();
      expect(coreServices.getPluginManager()).toBeDefined();
      expect(coreServices.getAudioEngine()).toBeDefined();
      expect(coreServices.getUnifiedTransport()).toBeDefined();

      // PlaybackEngine should be null
      expect(coreServices.getPlaybackEngine()).toBeNull();
    });
  });
});
