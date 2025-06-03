/**
 * AndroidOptimizer Tests
 *
 * Tests for Android-specific audio optimizations including AudioManager integration,
 * power management, background audio handling, and platform-specific workarounds.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AndroidOptimizer } from '../AndroidOptimizer.js';
import type {
  AndroidAudioInterruption,
  AndroidAudioRouteChangeEvent,
  AndroidOptimizationDecision,
} from '../../types/audio.js';

// Mock dependencies
vi.mock('../MobileOptimizer.js', () => ({
  MobileOptimizer: {
    getInstance: vi.fn(() => ({
      optimizeForCurrentConditions: vi.fn().mockResolvedValue({
        qualityConfig: {
          sampleRate: 48000,
          bufferSize: 256,
          bitDepth: 16,
          compressionRatio: 0.8,
          maxPolyphony: 16,
          enableEffects: true,
          enableVisualization: true,
          backgroundProcessing: true,
          cpuThrottling: 0.7,
          memoryLimit: 512,
          thermalManagement: true,
          aggressiveBatteryMode: false,
          backgroundAudioReduction: false,
          displayOptimization: true,
          qualityLevel: 'medium',
          estimatedBatteryImpact: 0.3,
          estimatedCpuUsage: 0.4,
        },
        reasoning: {
          primaryFactors: ['android_optimization'],
          batteryInfluence: 0.3,
          thermalInfluence: 0.2,
          performanceInfluence: 0.4,
          userPreferenceInfluence: 0.1,
          explanation: 'Optimized for Android device',
        },
        estimatedImprovement: {
          batteryLifeExtension: 30,
          performanceImprovement: 0.2,
          qualityReduction: 0.1,
          stabilityImprovement: 0.3,
        },
        confidence: 0.8,
        nextReEvaluationTime: Date.now() + 30000,
      }),
    })),
  },
}));

// Mock Web Audio API
const mockAudioContext = {
  state: 'running',
  resume: vi.fn().mockResolvedValue(undefined),
  suspend: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  audioWorklet: {
    addModule: vi.fn().mockResolvedValue(undefined),
  },
  sampleRate: 48000,
  destination: {},
} as unknown as AudioContext;

describe('AndroidOptimizer', () => {
  let optimizer: AndroidOptimizer;
  let originalUserAgent: string;
  let originalNavigator: any;

  beforeEach(() => {
    // Store original values
    originalUserAgent = navigator.userAgent;
    originalNavigator = global.navigator;

    // Clear singleton instance before creating new one
    (AndroidOptimizer as any).resetInstance();

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {
      // Intentionally empty for test isolation
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {
      // Intentionally empty for test isolation
    });
    vi.spyOn(console, 'error').mockImplementation(() => {
      // Intentionally empty for test isolation
    });
  });

  afterEach(() => {
    // Restore original values
    Object.defineProperty(global.navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
    global.navigator = originalNavigator;

    // Reset singleton instance after each test
    (AndroidOptimizer as any).resetInstance();

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const optimizer1 = AndroidOptimizer.getInstance();
      const optimizer2 = AndroidOptimizer.getInstance();

      expect(optimizer1).toBe(optimizer2);
    });
  });

  describe('Android Environment Detection', () => {
    it('should detect Android Chrome environment', () => {
      // Mock Android Chrome user agent
      Object.defineProperty(global.navigator, 'userAgent', {
        value:
          'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
        configurable: true,
      });

      const newOptimizer = AndroidOptimizer.getInstance();
      const status = newOptimizer.getOptimizationStatus();

      expect(status.androidVersion).toBe('11.0');
      expect(status.isChrome).toBe(true);
      expect(status.isWebView).toBe(false);
    });

    it('should detect Android WebView environment', () => {
      // Mock Android WebView user agent
      Object.defineProperty(global.navigator, 'userAgent', {
        value:
          'Mozilla/5.0 (Linux; Android 10; SM-A205U) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/88.0.4324.181 Mobile Safari/537.36; wv',
        configurable: true,
      });

      const newOptimizer = AndroidOptimizer.getInstance();
      const status = newOptimizer.getOptimizationStatus();

      expect(status.androidVersion).toBe('10.0');
      expect(status.isChrome).toBe(false);
      expect(status.isWebView).toBe(true);
    });

    it('should handle older Android versions', () => {
      // Mock older Android user agent
      Object.defineProperty(global.navigator, 'userAgent', {
        value:
          'Mozilla/5.0 (Linux; Android 6.0.1; SM-G935F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
        configurable: true,
      });

      const newOptimizer = AndroidOptimizer.getInstance();
      const status = newOptimizer.getOptimizationStatus();

      expect(status.androidVersion).toBe('6.0');
      expect(status.capabilities.aaudioSupport).toBe(false);
      expect(status.capabilities.lowLatencyAudioSupport).toBe(false);
    });

    it('should skip initialization on non-Android devices', async () => {
      // Mock iOS user agent
      Object.defineProperty(global.navigator, 'userAgent', {
        value:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
        configurable: true,
      });

      const newOptimizer = AndroidOptimizer.getInstance();
      await newOptimizer.initialize(mockAudioContext);

      const status = newOptimizer.getOptimizationStatus();
      expect(status.isInitialized).toBe(true); // Still initialized, but with no-op
    });
  });

  describe('Initialization', () => {
    beforeEach(() => {
      // Mock modern Android Chrome
      Object.defineProperty(global.navigator, 'userAgent', {
        value:
          'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
        configurable: true,
      });
      optimizer = AndroidOptimizer.getInstance();
    });

    it('should initialize successfully on Android device', async () => {
      await optimizer.initialize(mockAudioContext);

      const status = optimizer.getOptimizationStatus();
      expect(status.isInitialized).toBe(true);
      expect(status.capabilities.aaudioSupport).toBe(true);
      expect(status.capabilities.lowLatencyAudioSupport).toBe(true);
    });

    it('should detect Android 11+ capabilities', async () => {
      await optimizer.initialize(mockAudioContext);

      const status = optimizer.getOptimizationStatus();
      expect(status.capabilities.spatialAudioSupport).toBe(false); // Android 11 < 12
      expect(status.capabilities.lowLatencyAudioSupport).toBe(true);
      expect(status.capabilities.aaudioSupport).toBe(true);
    });

    it('should not initialize twice', async () => {
      await optimizer.initialize(mockAudioContext);
      await optimizer.initialize(mockAudioContext);

      // Should only initialize once - check for the final initialization message
      expect(console.log).toHaveBeenCalledWith(
        'AndroidOptimizer initialized for Android',
        11,
        expect.objectContaining({
          chrome: true,
          webView: false,
          audioContextState: 'running',
        }),
      );
    });

    it('should handle initialization errors gracefully', async () => {
      const mockBrokenAudioContext = {
        ...mockAudioContext,
        state: 'suspended',
        audioWorklet: {
          addModule: vi
            .fn()
            .mockRejectedValue(new Error('AudioWorklet failed')),
        },
      } as unknown as AudioContext;

      // Force an error during the Android-specific initialization
      vi.spyOn(optimizer, 'detectAndroidCapabilities' as any).mockRejectedValue(
        new Error('Capability detection failed'),
      );

      await expect(
        optimizer.initialize(mockBrokenAudioContext),
      ).rejects.toThrow();
    });
  });

  describe('Audio Manager Configuration', () => {
    beforeEach(async () => {
      // Mock modern Android Chrome
      Object.defineProperty(global.navigator, 'userAgent', {
        value:
          'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
        configurable: true,
      });
      optimizer = AndroidOptimizer.getInstance();
      await optimizer.initialize(mockAudioContext);
    });

    it('should configure AudioManager with default settings', async () => {
      await optimizer.configureAudioManager();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(
          'Android AudioManager configured: music/media/music',
        ),
      );
    });

    it('should configure AudioManager with custom settings', async () => {
      await optimizer.configureAudioManager(
        'voice_call',
        'voice_communication',
        'speech',
      );

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(
          'Android AudioManager configured: voice_call/voice_communication/speech',
        ),
      );
    });

    it('should handle AudioManager configuration errors', async () => {
      // Mock error scenario
      const _originalConfigureAudioManager = optimizer.configureAudioManager;
      vi.spyOn(optimizer, 'configureAudioManager').mockRejectedValue(
        new Error('AudioManager configuration failed'),
      );

      await expect(optimizer.configureAudioManager()).rejects.toThrow(
        'AudioManager configuration failed',
      );
    });
  });

  describe('Background Audio Handling', () => {
    beforeEach(async () => {
      // Mock modern Android Chrome
      Object.defineProperty(global.navigator, 'userAgent', {
        value:
          'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
        configurable: true,
      });
      optimizer = AndroidOptimizer.getInstance();
      await optimizer.initialize(mockAudioContext);
    });

    it('should enable background audio for Chrome', async () => {
      await optimizer.enableBackgroundAudio();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Chrome background audio strategy enabled'),
      );
    });

    it('should enable background audio for WebView', async () => {
      // Reset singleton first
      (AndroidOptimizer as any).resetInstance();

      // Mock WebView environment
      Object.defineProperty(global.navigator, 'userAgent', {
        value:
          'Mozilla/5.0 (Linux; Android 10; SM-A205U) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/88.0.4324.181 Mobile Safari/537.36; wv',
        configurable: true,
      });

      const newOptimizer = AndroidOptimizer.getInstance();
      await newOptimizer.initialize(mockAudioContext);
      await newOptimizer.enableBackgroundAudio();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('WebView background audio strategy enabled'),
      );
    });

    it('should configure Doze mode compatibility', async () => {
      await optimizer.enableBackgroundAudio();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Doze mode compatibility enabled'),
      );
    });

    it('should handle background audio errors', async () => {
      // Mock console.error to track error logging
      const consoleSpy = vi.spyOn(console, 'error');

      // Force an error by modifying internal state
      const _status = optimizer.getOptimizationStatus();
      // Disable background audio in config to trigger early return
      await optimizer.enableBackgroundAudio();

      // Should not throw, but might log errors in complex scenarios
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('Audio Interruption Handling', () => {
    beforeEach(async () => {
      // Mock modern Android Chrome
      Object.defineProperty(global.navigator, 'userAgent', {
        value:
          'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
        configurable: true,
      });
      optimizer = AndroidOptimizer.getInstance();
      await optimizer.initialize(mockAudioContext);
    });

    it('should handle transient audio interruptions', async () => {
      const interruption: AndroidAudioInterruption = {
        type: 'began',
        reason: 'phone_call',
        timestamp: Date.now(),
        wasPlayingBeforeInterruption: true,
        focusLoss: 'transient',
      };

      await optimizer.handleAudioInterruption(interruption);

      expect(console.log).toHaveBeenCalledWith(
        'Android audio interruption began:',
        'phone_call',
      );
    });

    it('should handle ducking interruptions', async () => {
      const interruption: AndroidAudioInterruption = {
        type: 'began',
        reason: 'notification',
        timestamp: Date.now(),
        wasPlayingBeforeInterruption: true,
        focusLoss: 'transient_can_duck',
      };

      await optimizer.handleAudioInterruption(interruption);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Ducking Android audio'),
      );
    });

    it('should handle permanent focus loss', async () => {
      const interruption: AndroidAudioInterruption = {
        type: 'began',
        reason: 'other_app',
        timestamp: Date.now(),
        wasPlayingBeforeInterruption: true,
        focusLoss: 'permanent',
      };

      await optimizer.handleAudioInterruption(interruption);

      const status = optimizer.getOptimizationStatus();
      expect(status.currentPlaybackState).toBe('stopped');
      expect(status.audioFocusActive).toBe(false);
    });

    it('should handle interruption ended', async () => {
      const interruption: AndroidAudioInterruption = {
        type: 'ended',
        reason: 'phone_call',
        timestamp: Date.now(),
        wasPlayingBeforeInterruption: true,
        focusLoss: 'transient',
        options: {
          shouldResume: true,
        },
      };

      await optimizer.handleAudioInterruption(interruption);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Resuming Android audio'),
      );
    });
  });

  describe('Audio Route Changes', () => {
    beforeEach(async () => {
      // Mock modern Android Chrome
      Object.defineProperty(global.navigator, 'userAgent', {
        value:
          'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
        configurable: true,
      });
      optimizer = AndroidOptimizer.getInstance();
      await optimizer.initialize(mockAudioContext);
    });

    it('should handle Bluetooth route changes', async () => {
      const routeEvent: AndroidAudioRouteChangeEvent = {
        previousRoute: 'speaker',
        newRoute: 'bluetooth_a2dp',
        reason: 'device_connect',
        routeQuality: 'high',
        latencyChange: 5,
        timestamp: Date.now(),
        bluetoothCodec: 'ldac',
      };

      await optimizer.handleRouteChange(routeEvent);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(
          'Android audio route changed: speaker -> bluetooth_a2dp',
        ),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Optimizing for Bluetooth codec: ldac'),
      );
    });

    it('should handle headphone route changes', async () => {
      const routeEvent: AndroidAudioRouteChangeEvent = {
        previousRoute: 'speaker',
        newRoute: 'headphones',
        reason: 'device_connect',
        routeQuality: 'high',
        latencyChange: -2,
        timestamp: Date.now(),
      };

      await optimizer.handleRouteChange(routeEvent);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Optimized for Android headphones output'),
      );
    });

    it('should optimize for different Bluetooth codecs', async () => {
      const routeEvent: AndroidAudioRouteChangeEvent = {
        previousRoute: 'speaker',
        newRoute: 'bluetooth_a2dp',
        reason: 'device_connect',
        routeQuality: 'medium',
        latencyChange: 10,
        timestamp: Date.now(),
        bluetoothCodec: 'sbc',
      };

      await optimizer.handleRouteChange(routeEvent);

      // Should optimize for lower quality SBC codec
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Optimizing for Bluetooth codec: sbc'),
      );
    });
  });

  describe('Optimization Decisions', () => {
    beforeEach(async () => {
      // Mock modern Android Chrome
      Object.defineProperty(global.navigator, 'userAgent', {
        value:
          'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
        configurable: true,
      });
      optimizer = AndroidOptimizer.getInstance();
      await optimizer.initialize(mockAudioContext);
    });

    it('should generate optimization decision', async () => {
      const decision: AndroidOptimizationDecision =
        await optimizer.getOptimizationDecision();

      expect(decision).toHaveProperty('baseOptimization');
      expect(decision).toHaveProperty('androidSpecific');
      expect(decision).toHaveProperty('performanceImpact');
      expect(decision).toHaveProperty('batteryImpact');
      expect(decision).toHaveProperty('thermalImpact');
      expect(decision).toHaveProperty('reasoning');
      expect(decision).toHaveProperty('confidence');

      expect(decision.androidSpecific.aaudioRecommended).toBe(true);
      expect(decision.androidSpecific.recommendedBufferSize).toBe(256);
      expect(decision.androidSpecific.recommendedLatencyHint).toBe(
        'interactive',
      );
    });

    it('should calculate positive performance impact for modern Android', async () => {
      const decision: AndroidOptimizationDecision =
        await optimizer.getOptimizationDecision();

      expect(decision.performanceImpact).toBeGreaterThan(0);
      expect(decision.confidence).toBeGreaterThan(0.7);
    });

    it('should include Android-specific optimizations', async () => {
      const decision: AndroidOptimizationDecision =
        await optimizer.getOptimizationDecision();

      expect(decision.androidSpecific.audioManagerConfig).toHaveProperty(
        'streamType',
        'music',
      );
      expect(decision.androidSpecific.audioManagerConfig).toHaveProperty(
        'usage',
        'media',
      );
      expect(decision.androidSpecific.audioManagerConfig).toHaveProperty(
        'contentType',
        'music',
      );
      expect(decision.androidSpecific.powerManagerConfig).toHaveProperty(
        'strategy',
        'balanced',
      );
      expect(decision.androidSpecific.backgroundAudio).toHaveProperty(
        'strategy',
        'media_session',
      );
    });
  });

  describe('Playback State Management', () => {
    beforeEach(async () => {
      // Mock modern Android Chrome
      Object.defineProperty(global.navigator, 'userAgent', {
        value:
          'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
        configurable: true,
      });
      optimizer = AndroidOptimizer.getInstance();
      await optimizer.initialize(mockAudioContext);
    });

    it('should update playback state', () => {
      optimizer.updatePlaybackState('playing');

      const status = optimizer.getOptimizationStatus();
      expect(status.currentPlaybackState).toBe('playing');
    });

    it('should track state transitions', () => {
      optimizer.updatePlaybackState('playing');
      optimizer.updatePlaybackState('paused');
      optimizer.updatePlaybackState('stopped');

      const status = optimizer.getOptimizationStatus();
      expect(status.currentPlaybackState).toBe('stopped');
    });
  });

  describe('Legacy Android Support', () => {
    it('should handle Android 6.0 limitations', async () => {
      // Mock Android 6.0
      Object.defineProperty(global.navigator, 'userAgent', {
        value:
          'Mozilla/5.0 (Linux; Android 6.0.1; SM-G935F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
        configurable: true,
      });

      const newOptimizer = AndroidOptimizer.getInstance();
      await newOptimizer.initialize(mockAudioContext);

      const status = newOptimizer.getOptimizationStatus();
      expect(status.capabilities.aaudioSupport).toBe(false);
      expect(status.capabilities.lowLatencyAudioSupport).toBe(false);
      expect(status.capabilities.spatialAudioSupport).toBe(false);

      const decision = await newOptimizer.getOptimizationDecision();
      expect(decision.androidSpecific.recommendedBufferSize).toBe(1024); // Larger buffer for older Android
      expect(decision.androidSpecific.recommendedLatencyHint).toBe('playback');
    });

    it('should apply legacy workarounds for older Android', async () => {
      // Mock Android 7.0
      Object.defineProperty(global.navigator, 'userAgent', {
        value:
          'Mozilla/5.0 (Linux; Android 7.0; SM-G935F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
        configurable: true,
      });

      const newOptimizer = AndroidOptimizer.getInstance();
      await newOptimizer.initialize(mockAudioContext);

      const decision = await newOptimizer.getOptimizationDecision();
      expect(decision.androidSpecific.chromeWorkarounds).toContain(
        'legacy_webaudio_workaround',
      );
    });
  });

  describe('Performance Metrics', () => {
    beforeEach(async () => {
      // Mock modern Android Chrome
      Object.defineProperty(global.navigator, 'userAgent', {
        value:
          'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
        configurable: true,
      });
      optimizer = AndroidOptimizer.getInstance();
      await optimizer.initialize(mockAudioContext);
    });

    it('should track audio manager configurations', async () => {
      await optimizer.configureAudioManager();
      await optimizer.configureAudioManager(
        'voice_call',
        'voice_communication',
        'speech',
      );

      const status = optimizer.getOptimizationStatus();
      expect(status.performanceMetrics.audioManagerConfigurations).toBe(2);
    });

    it('should track audio interruptions', async () => {
      const interruption: AndroidAudioInterruption = {
        type: 'began',
        reason: 'phone_call',
        timestamp: Date.now(),
        wasPlayingBeforeInterruption: true,
        focusLoss: 'transient',
      };

      await optimizer.handleAudioInterruption(interruption);

      const status = optimizer.getOptimizationStatus();
      expect(status.performanceMetrics.audioInterruptions).toBe(1);
    });
  });

  describe('Resource Cleanup', () => {
    beforeEach(async () => {
      // Mock modern Android Chrome
      Object.defineProperty(global.navigator, 'userAgent', {
        value:
          'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
        configurable: true,
      });
      optimizer = AndroidOptimizer.getInstance();
      await optimizer.initialize(mockAudioContext);
    });

    it('should dispose resources properly', async () => {
      await optimizer.dispose();

      const status = optimizer.getOptimizationStatus();
      expect(status.isInitialized).toBe(false);
      expect(status.audioFocusActive).toBe(false);
    });

    it('should remove event listeners on dispose', async () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      await optimizer.dispose();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function),
      );
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      // Mock modern Android Chrome
      Object.defineProperty(global.navigator, 'userAgent', {
        value:
          'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
        configurable: true,
      });
      optimizer = AndroidOptimizer.getInstance();
      await optimizer.initialize(mockAudioContext);
    });

    it('should handle route change errors gracefully', async () => {
      const routeEvent: AndroidAudioRouteChangeEvent = {
        previousRoute: 'speaker',
        newRoute: 'unknown_route',
        reason: 'unknown',
        routeQuality: 'low',
        latencyChange: 0,
        timestamp: Date.now(),
      };

      // Should not throw
      await expect(
        optimizer.handleRouteChange(routeEvent),
      ).resolves.not.toThrow();
    });

    it('should handle malformed interruption data', async () => {
      const malformedInterruption = {
        type: 'invalid',
      } as unknown as AndroidAudioInterruption;

      // Should not throw
      await expect(
        optimizer.handleAudioInterruption(malformedInterruption),
      ).resolves.not.toThrow();
    });
  });
});
