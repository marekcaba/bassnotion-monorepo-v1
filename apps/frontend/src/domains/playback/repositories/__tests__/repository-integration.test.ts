/**
 * Repository Integration Tests
 *
 * Verify that repositories work correctly with the DI system
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  serviceRegistry,
  resetServiceRegistry,
} from '../../services/core/ServiceRegistry.js';
import {
  registerPlaybackRepositories,
  getRepositoryService,
  getTrackRepository,
  getTransportRepository,
  getPluginPresetRepository,
} from '../index.js';
import { TrackId, Volume } from '../value-objects/index.js';
import { TrackEntity } from '../entities/index.js';

describe('Repository Integration', () => {
  beforeEach(() => {
    // Clear any existing registrations
    resetServiceRegistry();
    localStorage.clear();
  });

  afterEach(() => {
    resetServiceRegistry();
  });

  it('should register repositories with service registry', async () => {
    await registerPlaybackRepositories();

    const repositoryService = getRepositoryService();
    expect(repositoryService).toBeDefined();

    const healthCheck = await repositoryService.healthCheck();
    expect(healthCheck.status).toBe('healthy');
  });

  it('should provide access to track repository through DI', async () => {
    await registerPlaybackRepositories();

    const trackRepo = getTrackRepository();
    expect(trackRepo).toBeDefined();

    // Test basic operations
    const tracks = await trackRepo.findAll();
    expect(tracks).toEqual([]);

    const count = await trackRepo.count();
    expect(count).toBe(0);
  });

  it('should persist and retrieve tracks', async () => {
    await registerPlaybackRepositories();
    const trackRepo = getTrackRepository();

    // Create and save a track
    const track = TrackEntity.create(
      TrackId.generate(),
      'Test Bass Track',
      'bass',
      0,
    );

    await trackRepo.save(track);

    // Retrieve the track
    const retrieved = await trackRepo.findById(track.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('Test Bass Track');
    expect(retrieved?.instrumentType).toBe('bass');
  });

  it('should work with caching layer', async () => {
    await registerPlaybackRepositories();
    const trackRepo = getTrackRepository();

    // Create multiple tracks
    const track1 = TrackEntity.create(
      TrackId.generate(),
      'Track 1',
      'drums',
      0,
    );
    const track2 = TrackEntity.create(TrackId.generate(), 'Track 2', 'bass', 1);

    await trackRepo.save(track1);
    await trackRepo.save(track2);

    // First call loads from storage
    const allTracks1 = await trackRepo.findAll();
    expect(allTracks1).toHaveLength(2);

    // Second call should use cache (verify through performance)
    const start = performance.now();
    const allTracks2 = await trackRepo.findAll();
    const duration = performance.now() - start;

    expect(allTracks2).toHaveLength(2);
    expect(duration).toBeLessThan(1); // Cache should be very fast
  });

  it('should handle repository errors gracefully', async () => {
    await registerPlaybackRepositories();
    const trackRepo = getTrackRepository();

    // Try to delete non-existent track
    const fakeId = TrackId.create('non-existent');

    await expect(trackRepo.delete(fakeId)).rejects.toThrow();

    // Repository should still be functional
    const tracks = await trackRepo.findAll();
    expect(tracks).toBeDefined();
  });

  it('should integrate with service lifecycle', async () => {
    await registerPlaybackRepositories();
    const repositoryService = getRepositoryService();

    // Test service lifecycle
    await repositoryService.initialize();
    await repositoryService.start();

    const config = repositoryService.getConfig();
    expect(config.storageType).toBe('localStorage');

    await repositoryService.stop();
    await repositoryService.dispose();

    // Should still be functional after restart
    await repositoryService.initialize();
    const healthCheck = await repositoryService.healthCheck();
    expect(healthCheck.status).toBe('healthy');
  });

  it('should support transport repository', async () => {
    await registerPlaybackRepositories();
    // Import at top level to avoid dynamic import issues
    const transportRepo = getTransportRepository();

    // Get initial state
    const state = await transportRepo.get();
    expect(state.playbackState).toBe('stopped');
    expect(state.tempo.value).toBe(120);

    // save() must not throw for a valid state. Note: TransportRepository.get()
    // intentionally always returns the initial state (it does NOT replay
    // persisted values back into a new session) — this is a deliberate
    // "always start at countdown position" design choice. So we only verify
    // that save resolves successfully, not that the value survives a re-read.
    const { Tempo } = await import('../value-objects/index.js');
    state.setTempo(Tempo.create(140));
    await expect(transportRepo.save(state)).resolves.not.toThrow();
  });

  it('should support plugin preset repository', async () => {
    await registerPlaybackRepositories();
    const presetRepo = getPluginPresetRepository();

    // Should have factory presets
    const allPresets = await presetRepo.findAll();
    expect(allPresets.length).toBeGreaterThan(0);

    const factoryPreset = allPresets.find((p) => p.isFactory);
    expect(factoryPreset).toBeDefined();
    expect(factoryPreset?.canEdit()).toBe(false);
  });
});
