/**
 * Playback Store Unit Tests
 *
 * Tests Zustand state management for playback controls,
 * audio source management, and performance monitoring.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { usePlaybackStore, playbackSelectors } from '../playbackStore.js';
import type { AudioSourceConfig, PerformanceAlert } from '../../types/audio.js';

// Test store helpers
const createTestStore = () => {
  // Reset store to initial state using the reset method
  usePlaybackStore.getState().reset();
  return usePlaybackStore;
};

describe('PlaybackStore', () => {
  let store: typeof usePlaybackStore;

  beforeEach(() => {
    store = createTestStore();
  });

  describe('Engine Lifecycle', () => {
    it('should set initialized state', () => {
      expect(store.getState().isInitialized).toBe(false);

      store.getState().setInitialized(true);

      expect(store.getState().isInitialized).toBe(true);
    });

    it('should set playback state', () => {
      expect(store.getState().playbackState).toBe('stopped');

      store.getState().setPlaybackState('playing');

      expect(store.getState().playbackState).toBe('playing');
    });

    it('should set audio context state', () => {
      expect(store.getState().audioContextState).toBe('suspended');

      store.getState().setAudioContextState('running');

      expect(store.getState().audioContextState).toBe('running');
    });

    it('should set loading state', () => {
      expect(store.getState().isLoading).toBe(false);

      store.getState().setLoading(true);

      expect(store.getState().isLoading).toBe(true);
    });

    it('should set error state', () => {
      expect(store.getState().error).toBe(null);

      store.getState().setError('Test error');

      expect(store.getState().error).toBe('Test error');
    });

    it('should clear error state', () => {
      store.getState().setError('Test error');
      expect(store.getState().error).toBe('Test error');

      store.getState().setError(null);

      expect(store.getState().error).toBe(null);
    });
  });

  describe('Configuration Management', () => {
    it('should update partial config', () => {
      const initialConfig = store.getState().config;

      store.getState().updateConfig({ tempo: 140, pitch: 2 });

      const updatedConfig = store.getState().config;
      expect(updatedConfig).toEqual({
        ...initialConfig,
        tempo: 140,
        pitch: 2,
      });
    });

    it('should update mobile config', () => {
      const initialMobileConfig = store.getState().mobileConfig;

      store.getState().updateMobileConfig({
        optimizeForBattery: false,
        reducedLatencyMode: true,
      });

      const updatedMobileConfig = store.getState().mobileConfig;
      expect(updatedMobileConfig).toEqual({
        ...initialMobileConfig,
        optimizeForBattery: false,
        reducedLatencyMode: true,
      });
    });

    it('should set master volume with bounds checking', () => {
      // Normal range
      store.getState().setMasterVolume(0.5);
      expect(store.getState().config.masterVolume).toBe(0.5);

      // Below minimum
      store.getState().setMasterVolume(-0.1);
      expect(store.getState().config.masterVolume).toBe(0);

      // Above maximum
      store.getState().setMasterVolume(1.5);
      expect(store.getState().config.masterVolume).toBe(1);
    });

    it('should set tempo with bounds checking', () => {
      // Normal range
      store.getState().setTempo(140);
      expect(store.getState().config.tempo).toBe(140);

      // Below minimum
      store.getState().setTempo(30);
      expect(store.getState().config.tempo).toBe(60);

      // Above maximum
      store.getState().setTempo(250);
      expect(store.getState().config.tempo).toBe(200);
    });

    it('should set pitch with bounds checking', () => {
      // Normal range
      store.getState().setPitch(5);
      expect(store.getState().config.pitch).toBe(5);

      // Below minimum
      store.getState().setPitch(-15);
      expect(store.getState().config.pitch).toBe(-12);

      // Above maximum
      store.getState().setPitch(15);
      expect(store.getState().config.pitch).toBe(12);
    });

    it('should set swing factor with bounds checking', () => {
      // Normal range
      store.getState().setSwingFactor(0.3);
      expect(store.getState().config.swingFactor).toBe(0.3);

      // Below minimum
      store.getState().setSwingFactor(-0.1);
      expect(store.getState().config.swingFactor).toBe(0);

      // Above maximum
      store.getState().setSwingFactor(1.5);
      expect(store.getState().config.swingFactor).toBe(1);
    });
  });

  describe('Audio Source Management', () => {
    const testSource: AudioSourceConfig = {
      id: 'test-drums',
      type: 'drums',
      volume: 0.8,
      pan: 0,
      muted: false,
      solo: false,
    };

    it('should add audio source', () => {
      expect(store.getState().audioSources.size).toBe(0);

      store.getState().addAudioSource(testSource);

      expect(store.getState().audioSources.size).toBe(1);
      expect(store.getState().audioSources.get('test-drums')).toEqual(
        testSource,
      );
    });

    it('should remove audio source', () => {
      store.getState().addAudioSource(testSource);
      expect(store.getState().audioSources.size).toBe(1);

      store.getState().removeAudioSource('test-drums');

      expect(store.getState().audioSources.size).toBe(0);
    });

    it('should update audio source', () => {
      store.getState().addAudioSource(testSource);

      store.getState().updateAudioSource('test-drums', {
        volume: 0.5,
        muted: true,
      });

      const updatedSource = store.getState().audioSources.get('test-drums');
      expect(updatedSource).toEqual({
        ...testSource,
        volume: 0.5,
        muted: true,
      });
    });

    it('should not update non-existent audio source', () => {
      const sourcesBefore = new Map(store.getState().audioSources);

      store.getState().updateAudioSource('non-existent', { volume: 0.5 });

      expect(store.getState().audioSources).toEqual(sourcesBefore);
    });

    it('should set source volume with bounds checking', () => {
      store.getState().addAudioSource(testSource);

      // Normal range
      store.getState().setSourceVolume('test-drums', 0.6);
      expect(store.getState().audioSources.get('test-drums')?.volume).toBe(0.6);

      // Below minimum
      store.getState().setSourceVolume('test-drums', -0.1);
      expect(store.getState().audioSources.get('test-drums')?.volume).toBe(0);

      // Above maximum
      store.getState().setSourceVolume('test-drums', 1.5);
      expect(store.getState().audioSources.get('test-drums')?.volume).toBe(1);
    });

    it('should set source mute state', () => {
      store.getState().addAudioSource(testSource);

      store.getState().setSourceMute('test-drums', true);

      expect(store.getState().audioSources.get('test-drums')?.muted).toBe(true);
    });

    it('should set source solo state', () => {
      store.getState().addAudioSource(testSource);

      store.getState().setSourceSolo('test-drums', true);

      expect(store.getState().audioSources.get('test-drums')?.solo).toBe(true);
    });

    it('should handle multiple audio sources', () => {
      const bassSource: AudioSourceConfig = {
        id: 'test-bass',
        type: 'bass',
        volume: 0.7,
        pan: -0.2,
        muted: false,
        solo: false,
      };

      store.getState().addAudioSource(testSource);
      store.getState().addAudioSource(bassSource);

      expect(store.getState().audioSources.size).toBe(2);
      expect(store.getState().audioSources.get('test-drums')).toEqual(
        testSource,
      );
      expect(store.getState().audioSources.get('test-bass')).toEqual(
        bassSource,
      );
    });
  });

  describe('Performance Monitoring', () => {
    const testMetrics = {
      latency: 25,
      averageLatency: 22,
      maxLatency: 35,
      dropoutCount: 2,
      bufferUnderruns: 0,
      cpuUsage: 45,
      memoryUsage: 128,
      sampleRate: 44100,
      bufferSize: 256,
      timestamp: Date.now(),
    };

    const testAlert: PerformanceAlert = {
      type: 'latency',
      severity: 'warning',
      message: 'Audio latency warning: 35ms',
      metrics: { latency: 35 },
      timestamp: Date.now(),
    };

    it('should update performance metrics', () => {
      expect(store.getState().performanceMetrics).toBe(null);

      store.getState().updatePerformanceMetrics(testMetrics);

      expect(store.getState().performanceMetrics).toEqual(testMetrics);
    });

    it('should add performance alert', () => {
      expect(store.getState().performanceAlerts).toHaveLength(0);

      store.getState().addPerformanceAlert(testAlert);

      expect(store.getState().performanceAlerts).toHaveLength(1);
      expect(store.getState().performanceAlerts[0]).toEqual(testAlert);
    });

    it('should limit performance alerts to 10', () => {
      // Add 12 alerts
      for (let i = 0; i < 12; i++) {
        store.getState().addPerformanceAlert({
          ...testAlert,
          message: `Alert ${i}`,
          timestamp: Date.now() + i,
        });
      }

      const alerts = store.getState().performanceAlerts;
      expect(alerts).toHaveLength(10);
      expect(alerts[0]?.message).toBe('Alert 2'); // First two should be dropped
      expect(alerts[9]?.message).toBe('Alert 11');
    });

    it('should clear performance alerts', () => {
      store.getState().addPerformanceAlert(testAlert);
      expect(store.getState().performanceAlerts).toHaveLength(1);

      store.getState().clearPerformanceAlerts();

      expect(store.getState().performanceAlerts).toHaveLength(0);
    });
  });

  describe('Visualization Synchronization', () => {
    it('should update sync position', () => {
      expect(store.getState().syncEvents.currentPosition).toBe(0);

      store.getState().updateSyncPosition(2.5);

      expect(store.getState().syncEvents.currentPosition).toBe(2.5);
    });

    it('should update beat count', () => {
      expect(store.getState().syncEvents.beatCount).toBe(0);

      store.getState().updateBeatCount(16);

      expect(store.getState().syncEvents.beatCount).toBe(16);
    });

    it('should update bar count', () => {
      expect(store.getState().syncEvents.barCount).toBe(0);

      store.getState().updateBarCount(4);

      expect(store.getState().syncEvents.barCount).toBe(4);
    });

    it('should set time signature', () => {
      expect(store.getState().syncEvents.timeSignature).toEqual({
        numerator: 4,
        denominator: 4,
      });

      store.getState().setTimeSignature(3, 8);

      expect(store.getState().syncEvents.timeSignature).toEqual({
        numerator: 3,
        denominator: 8,
      });
    });
  });

  describe('Store Reset', () => {
    it('should reset store to initial state', () => {
      // Modify state
      store.getState().setInitialized(true);
      store.getState().setPlaybackState('playing');
      store.getState().setMasterVolume(0.5);
      store.getState().addAudioSource({
        id: 'test',
        type: 'drums',
        volume: 0.8,
        pan: 0,
        muted: false,
        solo: false,
      });

      // Reset
      store.getState().reset();

      // Check state is reset
      const state = store.getState();
      expect(state.isInitialized).toBe(false);
      expect(state.playbackState).toBe('stopped');
      expect(state.config.masterVolume).toBe(0.8);
      expect(state.audioSources.size).toBe(0);
    });
  });

  describe('Selectors', () => {
    beforeEach(() => {
      // Set up test state
      store.getState().setInitialized(true);
      store.getState().setAudioContextState('running');
      store.getState().setLoading(false);
      store.getState().setError(null);
    });

    it('should detect playing state', () => {
      store.getState().setPlaybackState('stopped');
      expect(playbackSelectors.isPlaying(store.getState())).toBe(false);

      store.getState().setPlaybackState('playing');
      expect(playbackSelectors.isPlaying(store.getState())).toBe(true);
    });

    it('should detect when can play', () => {
      expect(playbackSelectors.canPlay(store.getState())).toBe(true);

      // Should not be able to play when not initialized
      store.getState().setInitialized(false);
      expect(playbackSelectors.canPlay(store.getState())).toBe(false);

      // Should not be able to play when loading
      store.getState().setInitialized(true);
      store.getState().setLoading(true);
      expect(playbackSelectors.canPlay(store.getState())).toBe(false);

      // Should not be able to play when audio context suspended
      store.getState().setLoading(false);
      store.getState().setAudioContextState('suspended');
      expect(playbackSelectors.canPlay(store.getState())).toBe(false);

      // Should not be able to play when in loading state
      store.getState().setAudioContextState('running');
      store.getState().setPlaybackState('loading');
      expect(playbackSelectors.canPlay(store.getState())).toBe(false);
    });

    it('should detect error state', () => {
      expect(playbackSelectors.hasError(store.getState())).toBe(false);

      store.getState().setError('Test error');
      expect(playbackSelectors.hasError(store.getState())).toBe(true);
    });

    it('should filter critical alerts', () => {
      const warningAlert: PerformanceAlert = {
        type: 'latency',
        severity: 'warning',
        message: 'Warning',
        metrics: {},
        timestamp: Date.now(),
      };

      const criticalAlert: PerformanceAlert = {
        type: 'cpu',
        severity: 'critical',
        message: 'Critical',
        metrics: {},
        timestamp: Date.now(),
      };

      store.getState().addPerformanceAlert(warningAlert);
      store.getState().addPerformanceAlert(criticalAlert);

      const criticalAlerts = playbackSelectors.criticalAlerts(store.getState());
      expect(criticalAlerts).toHaveLength(1);
      expect(criticalAlerts[0]).toEqual(criticalAlert);
    });

    it('should filter solo sources', () => {
      const normalSource: AudioSourceConfig = {
        id: 'normal',
        type: 'drums',
        volume: 0.8,
        pan: 0,
        muted: false,
        solo: false,
      };

      const soloSource: AudioSourceConfig = {
        id: 'solo',
        type: 'bass',
        volume: 0.8,
        pan: 0,
        muted: false,
        solo: true,
      };

      store.getState().addAudioSource(normalSource);
      store.getState().addAudioSource(soloSource);

      const soloSources = playbackSelectors.soloSources(store.getState());
      expect(soloSources).toHaveLength(1);
      expect(soloSources[0]).toEqual(soloSource);
    });

    it('should filter muted sources', () => {
      const normalSource: AudioSourceConfig = {
        id: 'normal',
        type: 'drums',
        volume: 0.8,
        pan: 0,
        muted: false,
        solo: false,
      };

      const mutedSource: AudioSourceConfig = {
        id: 'muted',
        type: 'bass',
        volume: 0.8,
        pan: 0,
        muted: true,
        solo: false,
      };

      store.getState().addAudioSource(normalSource);
      store.getState().addAudioSource(mutedSource);

      const mutedSources = playbackSelectors.mutedSources(store.getState());
      expect(mutedSources).toHaveLength(1);
      expect(mutedSources[0]).toEqual(mutedSource);
    });
  });
});
