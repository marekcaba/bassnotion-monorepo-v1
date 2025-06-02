/**
 * Device Detection Utilities Unit Tests
 *
 * Tests mobile device detection, capability assessment,
 * and audio optimization recommendations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  detectDeviceCapabilities,
  getMobileAudioConstraints,
  supportsLowLatencyAudio,
  getRecommendedAudioContextConfig,
  requiresUserGesture,
  getDevicePerformanceTier,
  getBatteryOptimizationRecommendations,
} from '../deviceDetection.js';

// Store original values
const _originalUserAgent = navigator.userAgent;
const _originalAudioContext = globalThis.AudioContext;

// Mock navigator.userAgent
const mockUserAgent = (userAgent: string) => {
  vi.stubGlobal('navigator', {
    ...navigator,
    userAgent,
  });
};

// Mock AudioContext with prototype
const mockAudioContext = () => {
  const MockedAudioContext = function () {
    // Empty constructor for mocked AudioContext
  } as any;
  MockedAudioContext.prototype = {
    audioWorklet: {}, // Mock audioWorklet for testing
  };

  vi.stubGlobal('AudioContext', MockedAudioContext);
  vi.stubGlobal('webkitAudioContext', MockedAudioContext);
};

// Remove AudioContext completely
const removeAudioContext = () => {
  vi.stubGlobal('AudioContext', undefined);
  vi.stubGlobal('webkitAudioContext', undefined);
};

describe('Device Detection Utilities', () => {
  beforeEach(() => {
    // Store original values (prefixed with _ since they're not used in current test structure)
    const _originalUserAgent = Object.getOwnPropertyDescriptor(
      Navigator.prototype,
      'userAgent',
    );
    const _originalAudioContext = global.AudioContext;

    // Spy on console to suppress warnings during tests
    vi.spyOn(console, 'warn').mockImplementation(() => {
      // Suppress console warnings during tests to keep test output clean
    });

    // Clean up after each test
    afterEach(() => {
      vi.restoreAllMocks();
    });

    // Reset to a default desktop Chrome user agent
    mockUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    );
    mockAudioContext();
  });

  describe('detectDeviceCapabilities', () => {
    it('should detect desktop capabilities', () => {
      mockUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      );

      const capabilities = detectDeviceCapabilities();

      expect(capabilities.isMobile).toBe(false);
      expect(capabilities.isIOS).toBe(false);
      expect(capabilities.isAndroid).toBe(false);
      expect(capabilities.isChrome).toBe(true);
      expect(capabilities.isSafari).toBe(false);
      expect(capabilities.supportsWebAudio).toBe(true);
      expect(capabilities.preferredSampleRate).toBe(44100);
      expect(capabilities.preferredBufferSize).toBe(128);
      expect(capabilities.estimatedLatency).toBe(15);
      expect(capabilities.batteryOptimizationRecommended).toBe(false);
    });

    it('should detect iPhone capabilities', () => {
      mockUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
      );

      const capabilities = detectDeviceCapabilities();

      expect(capabilities.isMobile).toBe(true);
      expect(capabilities.isIOS).toBe(true);
      expect(capabilities.isAndroid).toBe(false);
      expect(capabilities.isSafari).toBe(true);
      expect(capabilities.isChrome).toBe(false);
      expect(capabilities.preferredSampleRate).toBe(44100);
      expect(capabilities.preferredBufferSize).toBe(256); // Modern iOS
      expect(capabilities.estimatedLatency).toBe(25);
      expect(capabilities.batteryOptimizationRecommended).toBe(true);
    });

    it('should detect older iPhone capabilities', () => {
      mockUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Mobile/15E148 Safari/604.1',
      );

      const capabilities = detectDeviceCapabilities();

      expect(capabilities.isMobile).toBe(true);
      expect(capabilities.isIOS).toBe(true);
      expect(capabilities.preferredBufferSize).toBe(512); // Older iOS
      expect(capabilities.estimatedLatency).toBe(40);
    });

    it('should detect Android capabilities', () => {
      mockUserAgent(
        'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
      );

      const capabilities = detectDeviceCapabilities();

      expect(capabilities.isMobile).toBe(true);
      expect(capabilities.isIOS).toBe(false);
      expect(capabilities.isAndroid).toBe(true);
      expect(capabilities.isChrome).toBe(true);
      expect(capabilities.isSafari).toBe(false);
      expect(capabilities.preferredSampleRate).toBe(48000); // Android prefers 48kHz
      expect(capabilities.preferredBufferSize).toBe(256); // Modern Android
      expect(capabilities.estimatedLatency).toBe(30);
      expect(capabilities.batteryOptimizationRecommended).toBe(true);
    });

    it('should detect older Android capabilities', () => {
      mockUserAgent(
        'Mozilla/5.0 (Linux; Android 7.0; SM-G935F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
      );

      const capabilities = detectDeviceCapabilities();

      expect(capabilities.isMobile).toBe(true);
      expect(capabilities.isAndroid).toBe(true);
      expect(capabilities.preferredBufferSize).toBe(512); // Older Android
      expect(capabilities.estimatedLatency).toBe(45);
    });

    it('should detect Web Audio API support', () => {
      // Ensure AudioContext is properly mocked
      mockAudioContext();
      expect(detectDeviceCapabilities().supportsWebAudio).toBe(true);

      // Test without AudioContext
      removeAudioContext();

      expect(detectDeviceCapabilities().supportsWebAudio).toBe(false);

      // Restore
      mockAudioContext();
    });

    it('should detect AudioWorklet support', () => {
      // Mock AudioWorklet support
      mockAudioContext();
      expect(detectDeviceCapabilities().supportsAudioWorklet).toBe(true);
    });
  });

  describe('getMobileAudioConstraints', () => {
    it('should return desktop constraints for non-mobile devices', () => {
      const capabilities = { isMobile: false } as any;

      const constraints = getMobileAudioConstraints(capabilities);

      expect(constraints).toEqual({
        maxPolyphony: 32,
        preferredLatency: 15,
        enableEffects: true,
        useCompression: false,
        backgroundSuspend: false,
      });
    });

    it('should return modern iOS constraints', () => {
      mockUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
      );
      const capabilities = detectDeviceCapabilities();

      const constraints = getMobileAudioConstraints(capabilities);

      expect(constraints.maxPolyphony).toBe(16);
      expect(constraints.preferredLatency).toBe(25);
      expect(constraints.enableEffects).toBe(true);
      expect(constraints.useCompression).toBe(true);
      expect(constraints.backgroundSuspend).toBe(true);
    });

    it('should return older iOS constraints', () => {
      mockUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/605.1.15',
      );
      const capabilities = detectDeviceCapabilities();

      const constraints = getMobileAudioConstraints(capabilities);

      expect(constraints.maxPolyphony).toBe(8);
      expect(constraints.preferredLatency).toBe(40);
      expect(constraints.enableEffects).toBe(false);
    });

    it('should return modern Android constraints', () => {
      mockUserAgent(
        'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
      );
      const capabilities = detectDeviceCapabilities();

      const constraints = getMobileAudioConstraints(capabilities);

      expect(constraints.maxPolyphony).toBe(12);
      expect(constraints.preferredLatency).toBe(30);
      expect(constraints.enableEffects).toBe(true);
    });

    it('should return older Android constraints', () => {
      mockUserAgent(
        'Mozilla/5.0 (Linux; Android 7.0; SM-G935F) AppleWebKit/537.36',
      );
      const capabilities = detectDeviceCapabilities();

      const constraints = getMobileAudioConstraints(capabilities);

      expect(constraints.maxPolyphony).toBe(6);
      expect(constraints.preferredLatency).toBe(45);
      expect(constraints.enableEffects).toBe(false);
    });
  });

  describe('supportsLowLatencyAudio', () => {
    it('should return true for desktop', () => {
      mockUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      );
      expect(supportsLowLatencyAudio()).toBe(true);
    });

    it('should return true for modern iOS', () => {
      mockUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
      );
      expect(supportsLowLatencyAudio()).toBe(true);
    });

    it('should return false for older iOS', () => {
      mockUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/605.1.15',
      );
      expect(supportsLowLatencyAudio()).toBe(false);
    });

    it('should return true for modern Android with Chrome', () => {
      mockUserAgent(
        'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
      );
      expect(supportsLowLatencyAudio()).toBe(true);
    });

    it('should return false for older Android', () => {
      mockUserAgent(
        'Mozilla/5.0 (Linux; Android 7.0; SM-G935F) AppleWebKit/537.36',
      );
      expect(supportsLowLatencyAudio()).toBe(false);
    });

    it('should return false for Android without Chrome', () => {
      mockUserAgent(
        'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Mobile Safari/537.36',
      );
      expect(supportsLowLatencyAudio()).toBe(false);
    });
  });

  describe('getRecommendedAudioContextConfig', () => {
    it('should return desktop configuration', () => {
      mockUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      );

      const config = getRecommendedAudioContextConfig();

      expect(config.sampleRate).toBe(44100);
      expect(config.latencyHint).toBe('interactive');
    });

    it('should return mobile configuration', () => {
      mockUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
      );

      const config = getRecommendedAudioContextConfig();

      expect(config.sampleRate).toBe(44100);
      expect(config.latencyHint).toBe('balanced');
    });

    it('should return Android configuration', () => {
      mockUserAgent(
        'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
      );

      const config = getRecommendedAudioContextConfig();

      expect(config.sampleRate).toBe(48000);
      expect(config.latencyHint).toBe('balanced');
    });
  });

  describe('requiresUserGesture', () => {
    it('should return false for desktop Chrome', () => {
      mockUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      );
      expect(requiresUserGesture()).toBe(false);
    });

    it('should return true for Safari', () => {
      mockUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
      );
      expect(requiresUserGesture()).toBe(true);
    });

    it('should return true for mobile devices', () => {
      mockUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
      );
      expect(requiresUserGesture()).toBe(true);

      mockUserAgent(
        'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
      );
      expect(requiresUserGesture()).toBe(true);
    });
  });

  describe('getDevicePerformanceTier', () => {
    it('should return high for desktop', () => {
      mockUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      );
      expect(getDevicePerformanceTier()).toBe('high');
    });

    it('should return high for modern iOS', () => {
      mockUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
      );
      expect(getDevicePerformanceTier()).toBe('high');
    });

    it('should return low for older iOS', () => {
      mockUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/605.1.15',
      );
      expect(getDevicePerformanceTier()).toBe('low');
    });

    it('should return medium for modern Android', () => {
      mockUserAgent(
        'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
      );
      expect(getDevicePerformanceTier()).toBe('medium');
    });

    it('should return low for older Android', () => {
      mockUserAgent(
        'Mozilla/5.0 (Linux; Android 7.0; SM-G935F) AppleWebKit/537.36',
      );
      expect(getDevicePerformanceTier()).toBe('low');
    });
  });

  describe('getBatteryOptimizationRecommendations', () => {
    it('should return desktop recommendations', () => {
      mockUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      );

      const recommendations = getBatteryOptimizationRecommendations();

      expect(recommendations).toEqual({
        suspendOnBackground: false,
        reducedPolyphony: false,
        disableEffects: false,
        lowerSampleRate: false,
      });
    });

    it('should return mobile recommendations', () => {
      mockUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
      );

      const recommendations = getBatteryOptimizationRecommendations();

      expect(recommendations.suspendOnBackground).toBe(true);
      expect(recommendations.reducedPolyphony).toBe(false); // High performance tier
      expect(recommendations.disableEffects).toBe(false);
      expect(recommendations.lowerSampleRate).toBe(false);
    });

    it('should return low-end device recommendations', () => {
      mockUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/605.1.15',
      );

      const recommendations = getBatteryOptimizationRecommendations();

      expect(recommendations.suspendOnBackground).toBe(true);
      expect(recommendations.reducedPolyphony).toBe(true); // Low performance tier
      expect(recommendations.disableEffects).toBe(true);
      expect(recommendations.lowerSampleRate).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle unknown user agents gracefully', () => {
      mockUserAgent('Mozilla/5.0 (Unknown Device)');

      const capabilities = detectDeviceCapabilities();

      expect(capabilities.isMobile).toBe(false);
      expect(capabilities.isIOS).toBe(false);
      expect(capabilities.isAndroid).toBe(false);
      expect(capabilities.preferredSampleRate).toBe(44100); // Default
      expect(capabilities.estimatedLatency).toBe(15); // Default
    });

    it('should handle missing AudioContext gracefully', () => {
      // Remove AudioContext completely
      removeAudioContext();

      const capabilities = detectDeviceCapabilities();
      expect(capabilities.supportsWebAudio).toBe(false);
      expect(capabilities.supportsAudioWorklet).toBe(false);

      // Restore for other tests
      mockAudioContext();
    });

    it('should handle malformed version strings', () => {
      mockUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS like Mac OS X) AppleWebKit/605.1.15',
      );

      const capabilities = detectDeviceCapabilities();
      // Should not crash and should default to older device behavior
      expect(capabilities.isIOS).toBe(true);
    });
  });
});
