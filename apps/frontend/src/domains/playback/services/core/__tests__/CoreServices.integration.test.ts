/**
 * CoreServices Integration Tests
 *
 * History:
 *   Originally tested a dual-engine architecture: RegionProcessor +
 *   PlaybackEngine, gated by a feature flag (NEW_PLAYBACK_ENGINE).
 *
 *   Phase 3.2 of the playback rollout deleted RegionProcessor entirely
 *   and made PlaybackEngine the sole engine at 100% rollout. Phase 3.3
 *   deleted RegionProcessorAdapter. The dual-engine and feature-flag
 *   tests no longer describe how the system works, so they were
 *   removed. What remains: lifecycle and disposal of PlaybackEngine
 *   itself.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CoreServices } from '../CoreServices.js';
import * as featureFlags from '../../../config/featureFlags.js';

// Mock feature flags module. The flag is still queried in production
// even though the dual-engine path is gone, so the mock has to exist.
vi.mock('../../../config/featureFlags.js', () => ({
  isNewPlaybackEngineEnabled: vi.fn(() => true),
  logPlaybackEngineMigrationEvent: vi.fn(),
  getAudioArchitectureFlags: vi.fn(() => ({
    ENABLE_NEW_PLAYBACK_ENGINE: true,
  })),
}));

describe('CoreServices - PlaybackEngine Integration', () => {
  let coreServices: CoreServices;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(featureFlags.isNewPlaybackEngineEnabled).mockReturnValue(true);
  });

  afterEach(() => {
    if (coreServices) {
      coreServices.dispose();
    }
  });

  describe('PlaybackEngine lifecycle', () => {
    it('should create PlaybackEngine on construction', () => {
      coreServices = new CoreServices();

      const playbackEngine = coreServices.getPlaybackEngine();
      expect(playbackEngine).not.toBeNull();
      expect(playbackEngine).toBeDefined();
    });

    it('should log a migration event when PlaybackEngine is created', () => {
      coreServices = new CoreServices();

      expect(featureFlags.logPlaybackEngineMigrationEvent).toHaveBeenCalledWith(
        'PlaybackEngine created',
        expect.any(Object),
      );
    });

    it('should start PlaybackEngine in idle or ready state', () => {
      coreServices = new CoreServices();

      const playbackEngine = coreServices.getPlaybackEngine();
      expect(playbackEngine).not.toBeNull();

      const state = playbackEngine!.getState();
      expect(['idle', 'ready']).toContain(state);
    });

    it('should dispose PlaybackEngine when CoreServices is disposed', async () => {
      coreServices = new CoreServices();

      const playbackEngine = coreServices.getPlaybackEngine();
      expect(playbackEngine).not.toBeNull();

      const disposeSpy = vi.spyOn(playbackEngine!, 'dispose');

      await coreServices.dispose();

      expect(disposeSpy).toHaveBeenCalled();
      expect(coreServices.getPlaybackEngine()).toBeNull();
    });

    it('should log a migration event when PlaybackEngine is disposed', async () => {
      coreServices = new CoreServices();

      await coreServices.dispose();

      expect(featureFlags.logPlaybackEngineMigrationEvent).toHaveBeenCalledWith(
        'PlaybackEngine disposed',
      );
    });
  });

  describe('Service surface', () => {
    it('should expose all required services', () => {
      coreServices = new CoreServices();

      expect(coreServices.getEventBus()).toBeDefined();
      expect(coreServices.getPluginManager()).toBeDefined();
      expect(coreServices.getAudioEngine()).toBeDefined();
      expect(coreServices.getUnifiedTransport()).toBeDefined();
      expect(coreServices.getPlaybackEngine()).not.toBeNull();
    });
  });
});
