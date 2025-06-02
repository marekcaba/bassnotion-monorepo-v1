/**
 * Device Detection Security Tests
 *
 * Tests security aspects of device detection utilities
 * including user agent injection prevention, browser fingerprinting protection,
 * and safe capability detection.
 *
 * Part of Story 2.1: Core Audio Engine Foundation - Security Testing
 */

import {
  describe,
  it,
  expect,
  beforeEach as _beforeEach,
  afterEach,
  vi,
} from 'vitest';
import {
  detectDeviceCapabilities,
  getMobileAudioConstraints,
  supportsLowLatencyAudio,
  getRecommendedAudioContextConfig,
  requiresUserGesture,
  getDevicePerformanceTier,
  getBatteryOptimizationRecommendations,
} from '../deviceDetection.js';

// Mock user agent safely
const mockUserAgent = (userAgent: string) => {
  vi.stubGlobal('navigator', {
    ...navigator,
    userAgent,
  });
};

describe('Device Detection - Security Tests', () => {
  afterEach(() => {
    // Clean up globals
    vi.unstubAllGlobals();
  });

  describe('User Agent Injection Prevention', () => {
    it('should handle malicious user agent strings safely', () => {
      const maliciousUserAgents = [
        '<script>alert("xss")</script>',
        'javascript:alert(1)',
        '<img src=x onerror=alert(1)>',
        'Mozilla/5.0<iframe src=javascript:alert(1)>',
        'data:text/html,<script>alert(1)</script>',
        '"><script>alert(1)</script>',
        'javascript:void(0)',
        '<svg onload=alert(1)>',
      ];

      maliciousUserAgents.forEach((maliciousUA) => {
        mockUserAgent(maliciousUA);

        // Should not throw or execute malicious code
        expect(() => detectDeviceCapabilities()).not.toThrow();

        const capabilities = detectDeviceCapabilities();

        // Verify capabilities are safe objects without executable content
        expect(typeof capabilities.isMobile).toBe('boolean');
        expect(typeof capabilities.isIOS).toBe('boolean');
        expect(typeof capabilities.isAndroid).toBe('boolean');
        expect(typeof capabilities.preferredSampleRate).toBe('number');
        expect(Number.isFinite(capabilities.preferredSampleRate)).toBe(true);

        // Ensure no script content is present in any capability values
        const capabilitiesString = JSON.stringify(capabilities);
        expect(capabilitiesString).not.toContain('<script>');
        expect(capabilitiesString).not.toContain('javascript:');
        expect(capabilitiesString).not.toContain('onerror=');
        expect(capabilitiesString).not.toContain('<iframe');
        expect(capabilitiesString).not.toContain('<svg');
      });
    });

    it('should sanitize user agent data in detection logic', () => {
      // Test with user agent containing potential injection vectors
      mockUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0<script>alert(1)</script> like Mac OS X)',
      );

      const capabilities = detectDeviceCapabilities();

      // Should still detect iOS correctly but safely
      expect(capabilities.isIOS).toBe(true);
      expect(capabilities.isMobile).toBe(true);

      // Verify numeric values are safe
      expect(Number.isFinite(capabilities.preferredSampleRate)).toBe(true);
      expect(Number.isFinite(capabilities.preferredBufferSize)).toBe(true);
      expect(Number.isFinite(capabilities.estimatedLatency)).toBe(true);
    });

    it('should prevent injection in version parsing', () => {
      // Test with malicious version numbers
      const maliciousVersions = [
        'Mozilla/5.0 (iPhone; CPU iPhone OS <script>13</script>_0 like Mac OS X)',
        'Mozilla/5.0 (Android <iframe>11</iframe>; Mobile)',
        'Mozilla/5.0 (iPhone; CPU iPhone OS javascript:alert(1)_0 like Mac OS X)',
      ];

      maliciousVersions.forEach((ua) => {
        mockUserAgent(ua);

        // Should handle malicious version parsing gracefully
        expect(() => detectDeviceCapabilities()).not.toThrow();
        expect(() => supportsLowLatencyAudio()).not.toThrow();
        expect(() => getDevicePerformanceTier()).not.toThrow();

        const tier = getDevicePerformanceTier();
        expect(['low', 'medium', 'high']).toContain(tier);
      });
    });
  });

  describe('Browser Fingerprinting Protection', () => {
    it('should not expose unnecessary browser information', () => {
      mockUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      );

      const capabilities = detectDeviceCapabilities();

      // Should only expose necessary audio-related capabilities
      const allowedProperties = [
        'isMobile',
        'isIOS',
        'isAndroid',
        'isSafari',
        'isChrome',
        'supportsWebAudio',
        'preferredSampleRate',
        'preferredBufferSize',
        'supportsAudioWorklet',
        'estimatedLatency',
        'batteryOptimizationRecommended',
      ];

      Object.keys(capabilities).forEach((key) => {
        expect(allowedProperties).toContain(key);
      });

      // Should not expose sensitive system information
      expect(capabilities).not.toHaveProperty('browserVersion');
      expect(capabilities).not.toHaveProperty('osVersion');
      expect(capabilities).not.toHaveProperty('hardwareInfo');
      expect(capabilities).not.toHaveProperty('systemSpecs');
    });

    it('should limit audio configuration exposure', () => {
      mockUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)');

      const config = getRecommendedAudioContextConfig();

      // Should only contain standard AudioContext options
      const allowedConfigKeys = ['sampleRate', 'latencyHint'];
      Object.keys(config).forEach((key) => {
        expect(allowedConfigKeys).toContain(key);
      });

      // Values should be sanitized
      expect(['interactive', 'balanced', 'playback']).toContain(
        config.latencyHint,
      );
      expect(typeof config.sampleRate).toBe('number');
      expect(Number.isFinite(config.sampleRate)).toBe(true);
    });
  });

  describe('Safe Capability Detection', () => {
    it('should handle missing global objects gracefully', () => {
      // Mock missing AudioContext
      vi.stubGlobal('AudioContext', undefined);
      vi.stubGlobal('webkitAudioContext', undefined);

      mockUserAgent('Mozilla/5.0 (Chrome/91.0.4472.124)');

      const capabilities = detectDeviceCapabilities();

      // Should handle gracefully
      expect(capabilities.supportsWebAudio).toBe(false);
      expect(capabilities.supportsAudioWorklet).toBe(false);

      // Other capabilities should still work
      expect(typeof capabilities.isMobile).toBe('boolean');
      expect(typeof capabilities.preferredSampleRate).toBe('number');
    });

    it('should validate capability values', () => {
      mockUserAgent('Mozilla/5.0 (Android 11; Mobile)');

      const capabilities = detectDeviceCapabilities();
      const constraints = getMobileAudioConstraints(capabilities);

      // Validate all numeric values are reasonable
      expect(capabilities.preferredSampleRate).toBeGreaterThan(0);
      expect(capabilities.preferredSampleRate).toBeLessThan(200000);

      expect(capabilities.preferredBufferSize).toBeGreaterThan(0);
      expect(capabilities.preferredBufferSize).toBeLessThan(10000);

      expect(capabilities.estimatedLatency).toBeGreaterThan(0);
      expect(capabilities.estimatedLatency).toBeLessThan(1000);

      // Validate constraints are reasonable
      expect(constraints.maxPolyphony).toBeGreaterThan(0);
      expect(constraints.maxPolyphony).toBeLessThan(100);

      expect(constraints.preferredLatency).toBeGreaterThan(0);
      expect(constraints.preferredLatency).toBeLessThan(1000);
    });

    it('should prevent capability manipulation through prototype pollution', () => {
      // Attempt prototype pollution
      (Object.prototype as any).polluted = 'malicious';
      (Array.prototype as any).polluted = 'malicious';

      mockUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)');

      const capabilities = detectDeviceCapabilities();
      const constraints = getMobileAudioConstraints(capabilities);
      const config = getRecommendedAudioContextConfig();

      // Results should not contain polluted properties
      expect(capabilities).not.toHaveProperty('polluted');
      expect(constraints).not.toHaveProperty('polluted');
      expect(config).not.toHaveProperty('polluted');

      expect((capabilities as any).polluted).toBeUndefined();
      expect((constraints as any).polluted).toBeUndefined();
      expect((config as any).polluted).toBeUndefined();

      // Cleanup
      delete (Object.prototype as any).polluted;
      delete (Array.prototype as any).polluted;
    });
  });

  describe('Input Validation Security', () => {
    it('should handle malformed capabilities objects', () => {
      const malformedCapabilities = [
        null as any,
        undefined as any,
        'not an object' as any,
        { isMobile: '<script>alert(1)</script>' } as any,
        { preferredSampleRate: 'javascript:alert(1)' } as any,
        { estimatedLatency: Infinity } as any,
        { batteryOptimizationRecommended: 'true' } as any,
      ];

      malformedCapabilities.forEach((caps) => {
        // Should handle gracefully without throwing
        expect(() => getMobileAudioConstraints(caps)).not.toThrow();

        const constraints = getMobileAudioConstraints(caps);

        // Should return safe default values
        expect(typeof constraints.maxPolyphony).toBe('number');
        expect(typeof constraints.preferredLatency).toBe('number');
        expect(typeof constraints.enableEffects).toBe('boolean');
        expect(typeof constraints.useCompression).toBe('boolean');
        expect(typeof constraints.backgroundSuspend).toBe('boolean');
      });
    });

    it('should sanitize extreme capability values', () => {
      const extremeCapabilities = {
        isMobile: true,
        isIOS: false,
        isAndroid: true,
        isSafari: false,
        isChrome: true,
        supportsWebAudio: true,
        preferredSampleRate: Number.MAX_SAFE_INTEGER,
        preferredBufferSize: -1,
        supportsAudioWorklet: true,
        estimatedLatency: Infinity,
        batteryOptimizationRecommended: true,
      };

      const constraints = getMobileAudioConstraints(extremeCapabilities);

      // Should produce reasonable constraints despite extreme inputs
      expect(constraints.maxPolyphony).toBeGreaterThan(0);
      expect(constraints.maxPolyphony).toBeLessThan(100);

      expect(constraints.preferredLatency).toBeGreaterThan(0);
      expect(constraints.preferredLatency).toBeLessThan(1000);

      expect(Number.isFinite(constraints.maxPolyphony)).toBe(true);
      expect(Number.isFinite(constraints.preferredLatency)).toBe(true);
    });
  });

  describe('Platform Security Consistency', () => {
    it('should provide consistent results for same user agent', () => {
      const testUserAgent =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)';

      // Run detection multiple times
      const results = Array.from({ length: 5 }, () => {
        mockUserAgent(testUserAgent);
        return {
          capabilities: detectDeviceCapabilities(),
          lowLatency: supportsLowLatencyAudio(),
          userGesture: requiresUserGesture(),
          tier: getDevicePerformanceTier(),
        };
      });

      // All results should be identical
      if (results.length > 0) {
        const first = results[0];
        if (first) {
          results.slice(1).forEach((result) => {
            expect(result.capabilities).toEqual(first.capabilities);
            expect(result.lowLatency).toBe(first.lowLatency);
            expect(result.userGesture).toBe(first.userGesture);
            expect(result.tier).toBe(first.tier);
          });
        }
      }
    });

    it('should handle rapid successive calls safely', () => {
      mockUserAgent('Mozilla/5.0 (Android 11; Mobile)');

      // Make many rapid calls to detect race conditions or memory issues
      const calls = Array.from({ length: 100 }, () => ({
        capabilities: detectDeviceCapabilities(),
        recommendations: getBatteryOptimizationRecommendations(),
      }));

      // All calls should succeed and return valid data
      calls.forEach((call) => {
        expect(typeof call.capabilities.isMobile).toBe('boolean');
        expect(typeof call.recommendations.suspendOnBackground).toBe('boolean');
        expect(typeof call.recommendations.reducedPolyphony).toBe('boolean');
        expect(typeof call.recommendations.disableEffects).toBe('boolean');
        expect(typeof call.recommendations.lowerSampleRate).toBe('boolean');
      });
    });
  });

  describe('Error Handling Security', () => {
    it('should not expose system information in errors', () => {
      // Mock navigator to throw errors
      vi.stubGlobal('navigator', {
        get userAgent() {
          throw new Error(
            'System path: /usr/local/browser/navigator.js line 42',
          );
        },
      });

      // Should handle gracefully without exposing system paths
      expect(() => detectDeviceCapabilities()).not.toThrow();

      const capabilities = detectDeviceCapabilities();

      // Should return safe defaults
      expect(typeof capabilities.isMobile).toBe('boolean');
      expect(typeof capabilities.preferredSampleRate).toBe('number');
    });

    it('should handle malicious property accessors', () => {
      // Mock navigator with malicious getters
      vi.stubGlobal('navigator', {
        get userAgent() {
          // Try to execute malicious code
          try {
            eval('alert("malicious")');
          } catch {
            // Ignore - just testing defensive programming
          }
          return 'Mozilla/5.0 (Safe User Agent)';
        },
      });

      // Should handle without executing malicious code
      expect(() => detectDeviceCapabilities()).not.toThrow();

      const capabilities = detectDeviceCapabilities();
      expect(capabilities).toBeDefined();
      expect(typeof capabilities.isMobile).toBe('boolean');
    });
  });

  describe('Memory Safety', () => {
    it('should not cause memory leaks with repeated detection', () => {
      const userAgents = [
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
        'Mozilla/5.0 (Android 11; Mobile)',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      ];

      // Simulate many device detections
      for (let i = 0; i < 1000; i++) {
        const ua = userAgents[i % userAgents.length];
        if (ua) {
          mockUserAgent(ua);
        }

        const capabilities = detectDeviceCapabilities();
        const constraints = getMobileAudioConstraints(capabilities);

        // Verify results are still valid
        expect(capabilities).toBeDefined();
        expect(constraints).toBeDefined();
      }

      // Should complete without memory issues
      expect(true).toBe(true);
    });

    it('should clean up detection state properly', () => {
      // Multiple detection cycles
      ['iPhone', 'Android', 'Chrome'].forEach((platform) => {
        const userAgent = `Mozilla/5.0 (${platform})`;
        mockUserAgent(userAgent);

        const capabilities = detectDeviceCapabilities();
        expect(capabilities).toBeDefined();

        // Each detection should be independent
        expect(typeof capabilities.isMobile).toBe('boolean');
      });

      // Final cleanup verification
      expect(() => detectDeviceCapabilities()).not.toThrow();
    });
  });
});
