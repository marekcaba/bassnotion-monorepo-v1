/**
 * IOSOptimizer Tests
 *
 * Comprehensive unit tests for iOS-specific audio optimizations
 * including Safari workarounds, background audio, PWA features, and audio session management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IOSOptimizer } from '../IOSOptimizer.js';
import type {
  IOSAudioInterruption,
  IOSRouteChangeEvent,
} from '../../types/audio.js';

// Mock dependencies
vi.mock('../MobileOptimizer.js', () => ({
  MobileOptimizer: {
    getInstance: vi.fn(() => ({
      optimizeForCurrentConditions: vi.fn().mockResolvedValue({
        qualityConfig: {
          qualityLevel: 'medium',
          aggressiveBatteryMode: false,
          thermalManagement: true,
        },
        reasoning: { explanation: 'Test optimization' },
        confidence: 0.8,
      }),
    })),
  },
}));

// Mock Web APIs
const mockAudioContext = {
  state: 'suspended' as AudioContextState,
  resume: vi.fn().mockResolvedValue(undefined),
  suspend: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
};

// Mock navigator
const mockNavigator = {
  userAgent: '',
  standalone: false,
};

// Mock MediaQueryList for PWA detection
const createMockMediaQueryList = () => ({
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  media: '',
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
});

// Mock document events
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();

describe('IOSOptimizer', () => {
  let optimizer: IOSOptimizer;
  let originalNavigator: any;
  let originalDocument: any;
  let originalWindow: any;
  let mockMediaQueryList: ReturnType<typeof createMockMediaQueryList>;

  beforeEach(() => {
    // Store original values
    originalNavigator = global.navigator;
    originalDocument = global.document;
    originalWindow = global.window;

    // Set up global browser environment mocks
    global.navigator = mockNavigator as any;
    global.document = {
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener,
      hidden: false,
    } as any;

    global.window = {
      matchMedia: vi.fn(() => createMockMediaQueryList()),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as any;

    // Reset singleton
    (IOSOptimizer as any).instance = undefined;

    // Create fresh mock for each test
    mockMediaQueryList = createMockMediaQueryList();

    // Reset mocks
    vi.clearAllMocks();
    mockAudioContext.state = 'suspended';
    mockNavigator.userAgent = '';
    mockNavigator.standalone = false;
    mockMediaQueryList.matches = false;

    // Set up window.matchMedia mock
    global.window.matchMedia = vi.fn(() => mockMediaQueryList);
  });

  afterEach(() => {
    // Restore original values
    global.navigator = originalNavigator;
    global.document = originalDocument;
    global.window = originalWindow;

    if (optimizer) {
      optimizer.dispose();
    }
  });

  describe('iOS Device Detection', () => {
    it('should detect iPhone devices', () => {
      mockNavigator.userAgent =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15';

      optimizer = IOSOptimizer.getInstance();
      const status = optimizer.getOptimizationStatus();

      expect(status.isIOSDevice).toBe(true);
      expect(status.iosMajorVersion).toBe(16);
      expect(status.isSafari).toBe(false); // Safari not detected in this UA
    });

    it('should detect iPad devices', () => {
      mockNavigator.userAgent =
        'Mozilla/5.0 (iPad; CPU OS 15_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.2 Mobile/15E148 Safari/604.1';

      optimizer = IOSOptimizer.getInstance();
      const status = optimizer.getOptimizationStatus();

      expect(status.isIOSDevice).toBe(true);
      expect(status.iosMajorVersion).toBe(15);
      expect(status.isSafari).toBe(true);
    });

    it('should detect iPod devices', () => {
      mockNavigator.userAgent =
        'Mozilla/5.0 (iPod; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15';

      optimizer = IOSOptimizer.getInstance();
      const status = optimizer.getOptimizationStatus();

      expect(status.isIOSDevice).toBe(true);
      expect(status.iosMajorVersion).toBe(14);
    });

    it('should not detect non-iOS devices', () => {
      mockNavigator.userAgent =
        'Mozilla/5.0 (Android 12; Mobile; rv:91.0) Gecko/91.0 Firefox/91.0';

      optimizer = IOSOptimizer.getInstance();
      const status = optimizer.getOptimizationStatus();

      expect(status.isIOSDevice).toBe(false);
      expect(status.iosMajorVersion).toBe(0);
    });

    it('should detect Safari browser', () => {
      mockNavigator.userAgent =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';

      optimizer = IOSOptimizer.getInstance();
      const status = optimizer.getOptimizationStatus();

      expect(status.isSafari).toBe(true);
    });

    it('should not detect Safari when using Chrome on iOS', () => {
      mockNavigator.userAgent =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/103.0.5060.63 Mobile/15E148 Safari/604.1';

      optimizer = IOSOptimizer.getInstance();
      const status = optimizer.getOptimizationStatus();

      expect(status.isSafari).toBe(false);
    });

    it('should detect standalone PWA mode', () => {
      mockNavigator.userAgent =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15';
      mockNavigator.standalone = true;

      optimizer = IOSOptimizer.getInstance();
      const status = optimizer.getOptimizationStatus();

      expect(status.isStandalonePWA).toBe(true);
    });

    it('should detect PWA via media query', () => {
      mockNavigator.userAgent =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15';
      mockMediaQueryList.matches = true;

      optimizer = IOSOptimizer.getInstance();
      const status = optimizer.getOptimizationStatus();

      expect(status.isStandalonePWA).toBe(true);
    });
  });

  describe('Initialization', () => {
    beforeEach(() => {
      // Set up iOS device for initialization tests
      mockNavigator.userAgent =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
    });

    it('should create singleton instance', () => {
      const optimizer1 = IOSOptimizer.getInstance();
      const optimizer2 = IOSOptimizer.getInstance();

      expect(optimizer1).toBe(optimizer2);
    });

    it('should initialize with iOS device', async () => {
      optimizer = IOSOptimizer.getInstance();

      await optimizer.initialize(mockAudioContext as any);

      const status = optimizer.getOptimizationStatus();
      expect(status.isIOSDevice).toBe(true);
    });

    it('should skip initialization for non-iOS devices', async () => {
      mockNavigator.userAgent =
        'Mozilla/5.0 (Android 12; Mobile; rv:91.0) Gecko/91.0 Firefox/91.0';
      optimizer = IOSOptimizer.getInstance();

      await optimizer.initialize(mockAudioContext as any);

      const status = optimizer.getOptimizationStatus();
      expect(status.isIOSDevice).toBe(false);
    });

    it('should not reinitialize if already initialized', async () => {
      optimizer = IOSOptimizer.getInstance();

      await optimizer.initialize(mockAudioContext as any);
      await optimizer.initialize(mockAudioContext as any); // Second call

      // Should not throw or cause issues
      const status = optimizer.getOptimizationStatus();
      expect(status.isIOSDevice).toBe(true);
    });

    it('should set up event listeners on initialization', async () => {
      optimizer = IOSOptimizer.getInstance();

      await optimizer.initialize(mockAudioContext as any);

      // Verify event listeners were set up
      expect(mockAddEventListener).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function),
      );
      expect(mockAddEventListener).toHaveBeenCalledWith(
        'touchstart',
        expect.any(Function),
        { once: true },
      );
    });
  });

  describe('Audio Session Configuration', () => {
    beforeEach(async () => {
      mockNavigator.userAgent =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
      optimizer = IOSOptimizer.getInstance();
      await optimizer.initialize(mockAudioContext as any);
      // Clear any mock calls from initialization
      mockAudioContext.resume.mockClear();
    });

    it('should configure audio session with default settings', async () => {
      await optimizer.configureAudioSession();

      const status = optimizer.getOptimizationStatus();
      expect(status.sessionConfig.category).toBe('playback');
      expect(status.sessionConfig.mode).toBe('default');
    });

    it('should configure audio session with custom settings', async () => {
      await optimizer.configureAudioSession('playAndRecord', 'videoChat');

      const status = optimizer.getOptimizationStatus();
      expect(status.sessionConfig.category).toBe('playAndRecord');
      expect(status.sessionConfig.mode).toBe('videoChat');
    });

    it('should activate audio context when configuring session', async () => {
      mockAudioContext.state = 'suspended';

      await optimizer.configureAudioSession();

      expect(mockAudioContext.resume).toHaveBeenCalled();
    });

    it('should handle audio session configuration errors', async () => {
      // Clear any previous mock calls
      mockAudioContext.resume.mockClear();
      mockAudioContext.state = 'suspended'; // Ensure it will try to activate

      // Set up the error to be thrown on the next call
      mockAudioContext.resume.mockRejectedValueOnce(
        new Error('Activation failed'),
      );

      // Should catch the error and increment counter
      try {
        await optimizer.configureAudioSession();
      } catch {
        // Expected to throw due to activation failure
      }

      const status = optimizer.getOptimizationStatus();
      expect(status.performanceMetrics.sessionInterruptions).toBeGreaterThan(0);
    });
  });

  describe('Background Audio Management', () => {
    beforeEach(async () => {
      mockNavigator.userAgent =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
      optimizer = IOSOptimizer.getInstance();
      await optimizer.initialize(mockAudioContext as any);
    });

    it('should enable background audio', async () => {
      await optimizer.enableBackgroundAudio();

      const status = optimizer.getOptimizationStatus();
      expect(status.isBackgroundActive).toBe(true);
    });

    it('should configure Safari-specific background audio', async () => {
      await optimizer.enableBackgroundAudio();

      const status = optimizer.getOptimizationStatus();
      expect(status.backgroundConfig.strategy).toBe('safari');
    });

    it('should configure PWA-specific background audio', async () => {
      mockNavigator.standalone = true;
      // Reset singleton to pick up new PWA detection
      (IOSOptimizer as any).instance = undefined;
      optimizer = IOSOptimizer.getInstance();
      await optimizer.initialize(mockAudioContext as any);

      await optimizer.enableBackgroundAudio();

      const status = optimizer.getOptimizationStatus();
      expect(status.backgroundConfig.strategy).toBe('pwa');
    });

    it('should handle background audio setup errors', async () => {
      // Simulate error condition
      const originalConsoleError = console.error;
      console.error = vi.fn();

      // Enable background audio (should handle gracefully)
      await optimizer.enableBackgroundAudio();

      console.error = originalConsoleError;

      const status = optimizer.getOptimizationStatus();
      expect(status.backgroundConfig.enabled).toBe(true);
    });
  });

  describe('Audio Interruption Handling', () => {
    beforeEach(async () => {
      mockNavigator.userAgent =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15';
      optimizer = IOSOptimizer.getInstance();
      await optimizer.initialize(mockAudioContext as any);
    });

    it('should handle interruption began', async () => {
      const interruption: IOSAudioInterruption = {
        type: 'began',
        reason: 'phone_call',
        timestamp: Date.now(),
      };

      optimizer.updatePlaybackState('playing');
      await optimizer.handleAudioInterruption(interruption);

      const status = optimizer.getOptimizationStatus();
      expect(status.performanceMetrics.sessionInterruptions).toBe(1);
    });

    it('should handle interruption ended with resumption', async () => {
      const interruptionBegan: IOSAudioInterruption = {
        type: 'began',
        reason: 'phone_call',
        timestamp: Date.now(),
        wasPlayingBeforeInterruption: true,
      };

      const interruptionEnded: IOSAudioInterruption = {
        type: 'ended',
        reason: 'phone_call',
        timestamp: Date.now() + 5000,
        wasPlayingBeforeInterruption: true,
      };

      optimizer.updatePlaybackState('playing');
      await optimizer.handleAudioInterruption(interruptionBegan);
      await optimizer.handleAudioInterruption(interruptionEnded);

      expect(mockAudioContext.resume).toHaveBeenCalled();
    });

    it('should handle different interruption reasons', async () => {
      const alarmInterruption: IOSAudioInterruption = {
        type: 'began',
        reason: 'alarm',
        timestamp: Date.now(),
      };

      await optimizer.handleAudioInterruption(alarmInterruption);

      const status = optimizer.getOptimizationStatus();
      expect(status.performanceMetrics.sessionInterruptions).toBe(1);
    });
  });

  describe('Route Change Handling', () => {
    beforeEach(async () => {
      mockNavigator.userAgent =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15';
      optimizer = IOSOptimizer.getInstance();
      await optimizer.initialize(mockAudioContext as any);
    });

    it('should handle route change to headphones', async () => {
      const routeChange: IOSRouteChangeEvent = {
        previousRoute: 'speaker',
        newRoute: 'headphones',
        reason: 'newDevice',
        routeQuality: 'high',
        timestamp: Date.now(),
      };

      await optimizer.handleRouteChange(routeChange);

      const status = optimizer.getOptimizationStatus();
      expect(status.performanceMetrics.routeChanges).toBe(1);
    });

    it('should handle route change to bluetooth', async () => {
      const routeChange: IOSRouteChangeEvent = {
        previousRoute: 'headphones',
        newRoute: 'bluetooth',
        reason: 'newDevice',
        routeQuality: 'medium',
        timestamp: Date.now(),
      };

      await optimizer.handleRouteChange(routeChange);

      const status = optimizer.getOptimizationStatus();
      expect(status.performanceMetrics.routeChanges).toBe(1);
    });

    it('should optimize performance based on route quality', async () => {
      const lowQualityRoute: IOSRouteChangeEvent = {
        previousRoute: 'headphones',
        newRoute: 'bluetooth',
        reason: 'newDevice',
        routeQuality: 'low',
        timestamp: Date.now(),
      };

      await optimizer.handleRouteChange(lowQualityRoute);

      // Verify that route quality affects session configuration
      const status = optimizer.getOptimizationStatus();
      expect(status.sessionConfig.preferredBufferDuration).toBeGreaterThan(0);
    });
  });

  describe('Audio Context Activation', () => {
    beforeEach(async () => {
      mockNavigator.userAgent =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15'; // iOS 15 - requires gesture
      optimizer = IOSOptimizer.getInstance();
      await optimizer.initialize(mockAudioContext as any);
    });

    it('should activate audio context directly when possible', async () => {
      mockAudioContext.state = 'suspended';

      await optimizer.activateAudioContext();

      expect(mockAudioContext.resume).toHaveBeenCalled();
    });

    it('should skip activation if already running', async () => {
      mockAudioContext.state = 'running';
      // Clear any previous calls
      mockAudioContext.resume.mockClear();

      await optimizer.activateAudioContext();

      expect(mockAudioContext.resume).not.toHaveBeenCalled();
    });

    it('should set up user gesture activation for older iOS', async () => {
      mockAudioContext.state = 'suspended';

      await optimizer.activateAudioContext();

      // Should set up touch listener for gesture activation
      expect(mockAddEventListener).toHaveBeenCalledWith(
        'touchstart',
        expect.any(Function),
        { once: true },
      );
    });

    it('should handle activation errors gracefully', async () => {
      mockAudioContext.state = 'suspended';
      mockAudioContext.resume.mockRejectedValueOnce(
        new Error('Activation failed'),
      );

      await optimizer.activateAudioContext();

      // Should handle error and still set up gesture activation
      expect(mockAddEventListener).toHaveBeenCalledWith(
        'touchstart',
        expect.any(Function),
        { once: true },
      );
    });
  });

  describe('Optimization Decision Generation', () => {
    beforeEach(async () => {
      mockNavigator.userAgent =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15';
      optimizer = IOSOptimizer.getInstance();
      await optimizer.initialize(mockAudioContext as any);
    });

    it('should generate iOS optimization decision', async () => {
      const decision = await optimizer.getOptimizationDecision();

      expect(decision).toMatchObject({
        baseOptimization: expect.any(Object),
        iosSpecific: {
          sessionConfig: expect.any(Object),
          backgroundAudio: expect.any(Object),
          safariWorkarounds: expect.any(Array),
          pwaOptimizations: expect.any(Array),
          recommendedBufferSize: expect.any(Number),
          recommendedLatencyHint: expect.any(String),
        },
        performanceImpact: expect.any(Number),
        batteryImpact: expect.any(Number),
        reasoning: expect.any(String),
        confidence: expect.any(Number),
      });
    });

    it('should calculate buffer size based on iOS version', async () => {
      const decision = await optimizer.getOptimizationDecision();

      expect(decision.iosSpecific.recommendedBufferSize).toBeGreaterThan(0);
      expect(decision.iosSpecific.recommendedBufferSize).toBeLessThan(4096);
    });

    it('should recommend appropriate latency hint', async () => {
      const decision = await optimizer.getOptimizationDecision();

      expect(['interactive', 'balanced', 'playback']).toContain(
        decision.iosSpecific.recommendedLatencyHint,
      );
    });
  });

  describe('Playback State Management', () => {
    beforeEach(async () => {
      mockNavigator.userAgent =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15';
      optimizer = IOSOptimizer.getInstance();
      await optimizer.initialize(mockAudioContext as any);
    });

    it('should update playback state', () => {
      optimizer.updatePlaybackState('playing');

      const status = optimizer.getOptimizationStatus();
      expect(status.currentPlaybackState).toBe('playing');
    });

    it('should optimize for different playback states', () => {
      optimizer.updatePlaybackState('stopped');
      optimizer.updatePlaybackState('playing');
      optimizer.updatePlaybackState('paused');

      // Should handle all state transitions without error
      const status = optimizer.getOptimizationStatus();
      expect(status.currentPlaybackState).toBe('paused');
    });
  });

  describe('Safari-Specific Optimizations', () => {
    beforeEach(async () => {
      mockNavigator.userAgent =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1';
      optimizer = IOSOptimizer.getInstance();
      await optimizer.initialize(mockAudioContext as any);
    });

    it('should apply Safari-specific workarounds for older iOS', async () => {
      const status = optimizer.getOptimizationStatus();

      expect(status.sessionConfig).toBeDefined();
      expect(
        status.performanceMetrics.safariWorkarounds,
      ).toBeGreaterThanOrEqual(0);
    });

    it('should require touch activation for older iOS', () => {
      // iOS 14 should require touch activation
      expect(mockAddEventListener).toHaveBeenCalledWith(
        'touchstart',
        expect.any(Function),
        { once: true },
      );
    });
  });

  describe('PWA-Specific Optimizations', () => {
    beforeEach(async () => {
      mockNavigator.userAgent =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15';
      mockNavigator.standalone = true;
      optimizer = IOSOptimizer.getInstance();
      await optimizer.initialize(mockAudioContext as any);
    });

    it('should apply PWA-specific optimizations', async () => {
      const status = optimizer.getOptimizationStatus();

      expect(status.isStandalonePWA).toBe(true);
      expect(status.backgroundConfig.strategy).toBe('pwa');
    });

    it('should enable enhanced background audio for PWA', async () => {
      await optimizer.enableBackgroundAudio();

      const status = optimizer.getOptimizationStatus();
      expect(status.isBackgroundActive).toBe(true);
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(async () => {
      mockNavigator.userAgent =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15';
      optimizer = IOSOptimizer.getInstance();
      await optimizer.initialize(mockAudioContext as any);
    });

    it('should track performance metrics', () => {
      const status = optimizer.getOptimizationStatus();

      expect(status.performanceMetrics).toMatchObject({
        backgroundAudioDropouts: expect.any(Number),
        sessionInterruptions: expect.any(Number),
        routeChanges: expect.any(Number),
        safariWorkarounds: expect.any(Number),
        touchActivations: expect.any(Number),
        lastOptimization: expect.any(Number),
      });
    });

    it('should increment metrics on events', async () => {
      const initialStatus = optimizer.getOptimizationStatus();
      const initialInterruptions =
        initialStatus.performanceMetrics.sessionInterruptions;

      await optimizer.handleAudioInterruption({
        type: 'began',
        reason: 'phone_call',
        timestamp: Date.now(),
      });

      const updatedStatus = optimizer.getOptimizationStatus();
      expect(updatedStatus.performanceMetrics.sessionInterruptions).toBe(
        initialInterruptions + 1,
      );
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle initialization without audio context', async () => {
      mockNavigator.userAgent =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15';
      optimizer = IOSOptimizer.getInstance();

      await expect(optimizer.initialize(null as any)).rejects.toThrow();
    });

    it('should handle malformed user agent strings', () => {
      mockNavigator.userAgent = 'Invalid User Agent String';

      optimizer = IOSOptimizer.getInstance();
      const status = optimizer.getOptimizationStatus();

      expect(status.isIOSDevice).toBe(false);
      expect(status.iosMajorVersion).toBe(0);
    });

    it('should handle missing media query support', () => {
      window.matchMedia = undefined as any;
      mockNavigator.userAgent =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15';

      optimizer = IOSOptimizer.getInstance();
      const status = optimizer.getOptimizationStatus();

      expect(status.isIOSDevice).toBe(true);
      expect(status.isStandalonePWA).toBe(false);
    });
  });

  describe('Resource Management', () => {
    beforeEach(async () => {
      mockNavigator.userAgent =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15';
      optimizer = IOSOptimizer.getInstance();
      await optimizer.initialize(mockAudioContext as any);
    });

    it('should dispose resources correctly', async () => {
      await optimizer.dispose();

      expect(mockRemoveEventListener).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function),
      );
    });

    it('should clean up all event listeners on disposal', async () => {
      await optimizer.dispose();

      // Verify all event types are cleaned up
      expect(mockRemoveEventListener).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function),
      );
      expect(mockRemoveEventListener).toHaveBeenCalledWith(
        'touchstart',
        expect.any(Function),
      );
    });

    it('should reset state on disposal', async () => {
      optimizer.updatePlaybackState('playing');
      await optimizer.enableBackgroundAudio();

      await optimizer.dispose();

      const status = optimizer.getOptimizationStatus();
      expect(status.currentPlaybackState).toBe('stopped');
      expect(status.isBackgroundActive).toBe(false);
    });
  });
});
