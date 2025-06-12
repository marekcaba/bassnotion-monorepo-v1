/**
 * AudioContextError Behavior Tests
 *
 * Tests the audio context error handling behaviors including error classification,
 * recovery strategies, browser compatibility detection, and user gesture handling.
 *
 * Focus: What the service DOES, not how it's implemented
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AudioContextError,
  AudioContextErrorCode,
  createAudioContextError,
} from '../../errors/AudioContextError.js';
import type { ErrorContext } from '../../errors/base.js';
import { ErrorCategory, ErrorSeverity } from '../../errors/base.js';

// Test Environment Setup
const setupTestEnvironment = () => {
  // Mock console to prevent test noise
  global.console = {
    ...global.console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  // Mock Web Audio API
  const mockAudioContext = vi.fn().mockImplementation(() => ({
    state: 'suspended',
    sampleRate: 44100,
    currentTime: 0,
    resume: vi.fn().mockResolvedValue(undefined),
    suspend: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  }));

  (global as any).AudioContext = mockAudioContext;
  (global as any).webkitAudioContext = mockAudioContext;
  (global as any).AudioWorkletNode = vi.fn();
  (global as any).OfflineAudioContext = vi.fn();

  // Mock window for browser detection
  (global as any).window = {
    AudioContext: mockAudioContext,
    webkitAudioContext: mockAudioContext,
  };

  return { mockAudioContext };
};

// Test Scenarios
const createErrorScenarios = () => ({
  basicContext: (): Partial<ErrorContext> => ({
    timestamp: Date.now(),
    sessionId: 'test-session',
    audioContextState: 'suspended',
    deviceInfo: {
      platform:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      browserVersion: '91.0.4472.114',
      isMobile: false,
      hasLowLatencySupport: true,
    },
  }),

  mobileContext: (): Partial<ErrorContext> => ({
    timestamp: Date.now(),
    sessionId: 'mobile-session',
    audioContextState: 'suspended',
    deviceInfo: {
      platform:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
      browserVersion: '15.0',
      isMobile: true,
      hasLowLatencySupport: false,
    },
  }),

  legacyBrowserContext: (): Partial<ErrorContext> => ({
    timestamp: Date.now(),
    sessionId: 'legacy-session',
    audioContextState: 'closed',
    deviceInfo: {
      platform:
        'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko',
      browserVersion: '11.0',
      isMobile: false,
      hasLowLatencySupport: false,
    },
  }),

  performanceMetrics: () => ({
    latency: 75,
    cpuUsage: 45,
    memoryUsage: 128,
    audioDropouts: 2,
  }),
});

// Behavior Expectations
const expectations = {
  shouldCreateError: (error: AudioContextError) => {
    expect(error).toBeInstanceOf(AudioContextError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AudioContextError');
    expect(error.category).toBe(ErrorCategory.AUDIO_CONTEXT);
  },

  shouldHaveValidErrorCode: (
    error: AudioContextError,
    expectedCode: AudioContextErrorCode,
  ) => {
    expect(error.code).toBe(expectedCode);
    expect(Object.values(AudioContextErrorCode)).toContain(error.code);
  },

  shouldHaveRecoveryActions: (error: AudioContextError) => {
    expect(error.recoveryActions).toBeDefined();
    expect(Array.isArray(error.recoveryActions)).toBe(true);
    if (error.recoveryActions.length > 0) {
      error.recoveryActions.forEach((action) => {
        expect(action.type).toBeDefined();
        expect(action.description).toBeDefined();
        expect(typeof action.automatic).toBe('boolean');
        expect(typeof action.priority).toBe('number');
      });
    }
  },

  shouldDetectBrowserFeatures: (error: AudioContextError) => {
    if (error.browserInfo) {
      expect(error.browserInfo.name).toBeDefined();
      expect(error.browserInfo.hasWebAudioSupport).toBeDefined();
      expect(Array.isArray(error.browserInfo.supportedFeatures)).toBe(true);
    }
  },

  shouldProvideUserMessage: (error: AudioContextError) => {
    const userMessage = error.getUserMessage();
    expect(typeof userMessage).toBe('string');
    expect(userMessage.length).toBeGreaterThan(0);
  },

  shouldBeSeverityAware: (
    error: AudioContextError,
    expectedSeverity?: ErrorSeverity,
  ) => {
    expect(Object.values(ErrorSeverity)).toContain(error.severity);
    if (expectedSeverity) {
      expect(error.severity).toBe(expectedSeverity);
    }
  },

  shouldBeRecoverable: (error: AudioContextError) => {
    const isRecoverable = error.isRecoverable();
    expect(typeof isRecoverable).toBe('boolean');

    if (isRecoverable) {
      expect(error.recoveryActions.length).toBeGreaterThan(0);
      expect(error.severity).not.toBe(ErrorSeverity.CRITICAL);
    }
  },

  shouldPrioritizeRecoveries: (error: AudioContextError) => {
    const automaticRecoveries = error.getAutomaticRecoveries();
    const manualRecoveries = error.getManualRecoveries();

    // Automatic recoveries should be sorted by priority (descending)
    for (let i = 1; i < automaticRecoveries.length; i++) {
      expect(automaticRecoveries[i - 1]!.priority).toBeGreaterThanOrEqual(
        automaticRecoveries[i]!.priority,
      );
    }

    // Manual recoveries should be sorted by priority (descending)
    for (let i = 1; i < manualRecoveries.length; i++) {
      expect(manualRecoveries[i - 1]!.priority).toBeGreaterThanOrEqual(
        manualRecoveries[i]!.priority,
      );
    }
  },
};

// Behavior Tests
describe('AudioContextError Behaviors', () => {
  let scenarios: ReturnType<typeof createErrorScenarios>;

  beforeEach(() => {
    setupTestEnvironment();
    scenarios = createErrorScenarios();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Error Creation Behaviors', () => {
    test('should create basic audio context error', () => {
      const error = new AudioContextError(
        AudioContextErrorCode.NOT_SUPPORTED,
        'Audio context not supported in this browser',
        scenarios.basicContext(),
      );

      expectations.shouldCreateError(error);
      expectations.shouldHaveValidErrorCode(
        error,
        AudioContextErrorCode.NOT_SUPPORTED,
      );
      expectations.shouldBeSeverityAware(error);
    });

    test('should create error with comprehensive context', () => {
      const context = scenarios.basicContext();
      const error = new AudioContextError(
        AudioContextErrorCode.USER_GESTURE_REQUIRED,
        'User gesture required to resume audio context',
        context,
      );

      expectations.shouldCreateError(error);
      expect(error.audioContextState).toBe(context.audioContextState);
      expectations.shouldDetectBrowserFeatures(error);
    });

    test('should create error with cause chain', () => {
      const cause = new Error('Underlying Web Audio API error');
      const error = new AudioContextError(
        AudioContextErrorCode.INITIALIZATION_FAILED,
        'Failed to initialize audio context',
        scenarios.basicContext(),
        cause,
      );

      expectations.shouldCreateError(error);
      expect(error.stack).toContain('Caused by:');
    });

    test('should use factory function for error creation', () => {
      const error = createAudioContextError(
        AudioContextErrorCode.RESUME_FAILED,
        'Failed to resume audio context',
        scenarios.basicContext(),
      );

      expectations.shouldCreateError(error);
      expectations.shouldHaveValidErrorCode(
        error,
        AudioContextErrorCode.RESUME_FAILED,
      );
    });
  });

  describe('Browser Compatibility Behaviors', () => {
    test('should detect Chrome browser features', () => {
      const context = scenarios.basicContext();
      context.deviceInfo!.platform =
        'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124';

      const error = new AudioContextError(
        AudioContextErrorCode.BROWSER_INCOMPATIBLE,
        'Browser compatibility issue',
        context,
      );

      expectations.shouldDetectBrowserFeatures(error);
      expect(error.browserInfo?.name).toBe('Chrome');
    });

    test('should detect Safari browser features', () => {
      const context = scenarios.basicContext();
      context.deviceInfo!.platform =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15';

      const error = new AudioContextError(
        AudioContextErrorCode.FEATURE_UNSUPPORTED,
        'Safari feature limitation',
        context,
      );

      expectations.shouldDetectBrowserFeatures(error);
      expect(error.browserInfo?.name).toBe('Safari');
    });

    test('should detect Web Audio API support', () => {
      const error = new AudioContextError(
        AudioContextErrorCode.NOT_SUPPORTED,
        'Web Audio API not supported',
        scenarios.basicContext(),
      );

      expectations.shouldDetectBrowserFeatures(error);
      expect(error.browserInfo?.hasWebAudioSupport).toBe(true);
    });

    test('should handle unsupported browser gracefully', () => {
      // Remove Web Audio API support
      delete (global as any).AudioContext;
      delete (global as any).webkitAudioContext;

      const error = new AudioContextError(
        AudioContextErrorCode.NOT_SUPPORTED,
        'Web Audio API not available',
        scenarios.legacyBrowserContext(),
      );

      expectations.shouldCreateError(error);
      expectations.shouldDetectBrowserFeatures(error);
      if (error.browserInfo) {
        expect(error.browserInfo.hasWebAudioSupport).toBe(false);
      }
    });

    test('should detect supported audio features', () => {
      const error = new AudioContextError(
        AudioContextErrorCode.FEATURE_UNSUPPORTED,
        'Feature detection test',
        scenarios.basicContext(),
      );

      expectations.shouldDetectBrowserFeatures(error);
      if (error.browserInfo) {
        expect(error.browserInfo.supportedFeatures).toContain('AudioContext');
      }
    });
  });

  describe('Recovery Strategy Behaviors', () => {
    test('should provide fallback recovery for unsupported browsers', () => {
      const error = new AudioContextError(
        AudioContextErrorCode.NOT_SUPPORTED,
        'Browser does not support Web Audio API',
        scenarios.legacyBrowserContext(),
      );

      expectations.shouldHaveRecoveryActions(error);
      expectations.shouldBeRecoverable(error);

      const automaticRecoveries = error.getAutomaticRecoveries();
      const fallbackAction = automaticRecoveries.find(
        (action) => action.type === 'fallback',
      );
      expect(fallbackAction).toBeDefined();
      expect(fallbackAction?.description).toContain('fallback');
    });

    test('should provide retry strategy for context resume failures', () => {
      const error = new AudioContextError(
        AudioContextErrorCode.RESUME_FAILED,
        'Failed to resume audio context',
        scenarios.basicContext(),
      );

      expectations.shouldHaveRecoveryActions(error);
      expectations.shouldBeRecoverable(error);

      const automaticRecoveries = error.getAutomaticRecoveries();
      const retryAction = automaticRecoveries.find(
        (action) => action.type === 'retry',
      );
      expect(retryAction).toBeDefined();
      expect(retryAction?.description).toContain('retry');
    });

    test('should require manual intervention for user gesture errors', () => {
      const error = new AudioContextError(
        AudioContextErrorCode.USER_GESTURE_REQUIRED,
        'User gesture required for audio context',
        scenarios.basicContext(),
      );

      expectations.shouldHaveRecoveryActions(error);

      const manualRecoveries = error.getManualRecoveries();
      const gestureAction = manualRecoveries.find((action) =>
        action.description.includes('user interaction'),
      );
      expect(gestureAction).toBeDefined();
      expect(gestureAction?.automatic).toBe(false);
    });

    test('should provide degradation strategy for system overload', () => {
      const error = new AudioContextError(
        AudioContextErrorCode.SYSTEM_OVERLOAD,
        'System resources overwhelmed',
        scenarios.basicContext(),
      );

      expectations.shouldHaveRecoveryActions(error);

      const automaticRecoveries = error.getAutomaticRecoveries();
      const degradeAction = automaticRecoveries.find(
        (action) => action.type === 'degrade',
      );
      expect(degradeAction).toBeDefined();
      expect(degradeAction?.description).toContain('quality');
    });

    test('should prioritize recovery actions correctly', () => {
      const error = new AudioContextError(
        AudioContextErrorCode.RESUME_FAILED,
        'Multiple recovery strategies needed',
        scenarios.basicContext(),
      );

      expectations.shouldPrioritizeRecoveries(error);

      const automaticRecoveries = error.getAutomaticRecoveries();
      if (automaticRecoveries.length > 1) {
        expect(automaticRecoveries[0]!.priority).toBeGreaterThanOrEqual(
          automaticRecoveries[automaticRecoveries.length - 1]!.priority,
        );
      }
    });
  });

  describe('Mobile-Specific Behaviors', () => {
    test('should handle mobile interruption scenarios', () => {
      const error = new AudioContextError(
        AudioContextErrorCode.MOBILE_INTERRUPTION,
        'Audio interrupted by phone call',
        scenarios.mobileContext(),
      );

      expectations.shouldCreateError(error);
      expectations.shouldHaveRecoveryActions(error);

      const automaticRecoveries = error.getAutomaticRecoveries();
      const resumeAction = automaticRecoveries.find((action) =>
        action.description.includes('interruption'),
      );
      expect(resumeAction).toBeDefined();
    });

    test('should handle background suspension on mobile', () => {
      const error = new AudioContextError(
        AudioContextErrorCode.BACKGROUND_SUSPEND,
        'Audio context suspended in background',
        scenarios.mobileContext(),
      );

      expectations.shouldCreateError(error);
      expectations.shouldBeRecoverable(error);
    });

    test('should detect mobile limitations', () => {
      const error = new AudioContextError(
        AudioContextErrorCode.MOBILE_LIMITATIONS,
        'Mobile platform constraints',
        scenarios.mobileContext(),
      );

      expectations.shouldCreateError(error);
      if (error.browserInfo) {
        // Mobile browsers may have different feature support
        expect(error.browserInfo.supportedFeatures).toBeDefined();
      }
    });
  });

  describe('Error Severity Behaviors', () => {
    test('should classify critical errors correctly', () => {
      const error = new AudioContextError(
        AudioContextErrorCode.NOT_SUPPORTED,
        'Web Audio API completely unavailable',
        scenarios.legacyBrowserContext(),
      );

      expectations.shouldBeSeverityAware(error, ErrorSeverity.HIGH);
    });

    test('should classify recoverable errors as medium severity', () => {
      const error = new AudioContextError(
        AudioContextErrorCode.RESUME_FAILED,
        'Temporary resume failure',
        scenarios.basicContext(),
      );

      expectations.shouldBeSeverityAware(error);
      expect(error.severity).not.toBe(ErrorSeverity.CRITICAL);
    });

    test('should classify user gesture errors as low severity', () => {
      const error = new AudioContextError(
        AudioContextErrorCode.USER_GESTURE_REQUIRED,
        'User gesture needed',
        scenarios.basicContext(),
      );

      expectations.shouldBeSeverityAware(error);
      // User gesture is common and recoverable
      expect([ErrorSeverity.LOW, ErrorSeverity.MEDIUM]).toContain(
        error.severity,
      );
    });
  });

  describe('Error Context Behaviors', () => {
    test('should serialize error information correctly', () => {
      const error = new AudioContextError(
        AudioContextErrorCode.INITIALIZATION_FAILED,
        'Context initialization error',
        scenarios.basicContext(),
      );

      const serialized = error.toJSON();

      expect(serialized.name).toBe('AudioContextError');
      expect(serialized.code).toBe(AudioContextErrorCode.INITIALIZATION_FAILED);
      expect(serialized.category).toBe(ErrorCategory.AUDIO_CONTEXT);
      expect(serialized.timestamp).toBeDefined();
      expect(serialized.context).toBeDefined();
    });

    test('should provide user-friendly messages', () => {
      const error = new AudioContextError(
        AudioContextErrorCode.USER_GESTURE_REQUIRED,
        'Technical message',
        scenarios.basicContext(),
      );

      expectations.shouldProvideUserMessage(error);

      const userMessage = error.getUserMessage();
      // User message should be more friendly than technical message
      expect(userMessage).not.toBe('Technical message');
    });

    test('should preserve audio context state information', () => {
      const context = scenarios.basicContext();
      context.audioContextState = 'running';

      const error = new AudioContextError(
        AudioContextErrorCode.SUSPEND_FAILED,
        'Failed to suspend running context',
        context,
      );

      expect(error.audioContextState).toBe('running');
      expect(error.context.audioContextState).toBe('running');
    });

    test('should handle missing context gracefully', () => {
      const error = new AudioContextError(
        AudioContextErrorCode.INVALID_STATE,
        'State validation error',
        // No context provided
      );

      expectations.shouldCreateError(error);
      expect(error.audioContextState).toBeUndefined();
      expect(error.browserInfo).toBeUndefined();
    });
  });

  describe('Error Recovery Integration Behaviors', () => {
    test('should estimate recovery times for automatic actions', () => {
      const error = new AudioContextError(
        AudioContextErrorCode.RESUME_FAILED,
        'Context resume failed',
        scenarios.basicContext(),
      );

      const automaticRecoveries = error.getAutomaticRecoveries();
      const timedActions = automaticRecoveries.filter(
        (action) => action.estimatedTime,
      );

      timedActions.forEach((action) => {
        expect(action.estimatedTime).toBeGreaterThan(0);
        expect(action.estimatedTime).toBeLessThan(10000); // Reasonable recovery time
      });
    });

    test('should provide documentation URLs for error types', () => {
      const error = new AudioContextError(
        AudioContextErrorCode.NOT_SUPPORTED,
        'Web Audio not supported',
        scenarios.basicContext(),
      );

      if (error.documentationUrl) {
        expect(typeof error.documentationUrl).toBe('string');
        expect(error.documentationUrl.length).toBeGreaterThan(0);
      }
    });

    test('should handle error chaining correctly', () => {
      const originalError = new Error('Original Web Audio failure');
      const contextError = new AudioContextError(
        AudioContextErrorCode.INITIALIZATION_FAILED,
        'Wrapped initialization failure',
        scenarios.basicContext(),
        originalError,
      );

      expect(contextError.stack).toContain('Caused by:');
      expect(contextError.stack).toContain('Original Web Audio failure');
    });
  });
});
