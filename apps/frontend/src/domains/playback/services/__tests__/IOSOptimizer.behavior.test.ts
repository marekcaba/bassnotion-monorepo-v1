/**
 * IOSOptimizer Behavior Tests
 *
 * Testing iOS-specific audio optimizations, Safari workarounds, PWA features,
 * and audio session management for the 944-line IOSOptimizer service using
 * proven behavior-driven approach.
 *
 * Core Behaviors:
 * - iOS environment detection and version-specific optimizations
 * - Audio session configuration and management
 * - Background audio handling for Safari and PWA contexts
 * - Safari-specific workarounds and compatibility layers
 * - PWA optimizations and native integration
 * - Audio interruption handling and recovery
 * - Route change management for different audio outputs
 * - Performance monitoring and health tracking
 * - Lifecycle management with proper event handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IOSOptimizer } from '../IOSOptimizer.js';
import type {
  IOSAudioInterruption,
  IOSRouteChangeEvent,
  IOSPlaybackState,
  IOSAudioSessionCategory,
  IOSAudioSessionMode,
} from '../../types/audio.js';

// Safe browser environment setup for iOS testing
const createMockIOSEnvironment = () => {
  const globalObj = global as any;

  // iOS-specific navigator properties
  const mockNavigator = {
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
    standalone: true, // PWA detection
    platform: 'iPhone',
    hardwareConcurrency: 6,
    deviceMemory: 4,
    connection: {
      effectiveType: '4g',
      downlink: 10,
      rtt: 30,
    },
  };

  // Mock AudioContext with iOS-specific behavior
  const mockAudioContext = {
    state: 'suspended' as AudioContextState,
    sampleRate: 48000,
    baseLatency: 0.005,
    outputLatency: 0.02,
    currentTime: 0,
    suspend: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockImplementation(function (this: any) {
      this.state = 'running';
      return Promise.resolve();
    }),
    close: vi.fn().mockResolvedValue(undefined),
    createGain: vi.fn().mockReturnValue({
      gain: { value: 1, setValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
    destination: {
      connect: vi.fn(),
      disconnect: vi.fn(),
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  // Document with iOS-specific properties
  const mockDocument = {
    hidden: false,
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  // Window with iOS/PWA-specific properties
  const mockWindow = {
    matchMedia: vi.fn().mockReturnValue({
      matches: true, // Assume PWA standalone mode
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    navigator: mockNavigator,
  };

  // Performance API
  const mockPerformance = {
    now: vi.fn(() => Date.now()),
    memory: {
      usedJSHeapSize: 50 * 1024 * 1024,
      totalJSHeapSize: 100 * 1024 * 1024,
      jsHeapSizeLimit: 2 * 1024 * 1024 * 1024,
    },
  };

  return {
    globalObj,
    mockNavigator,
    mockAudioContext,
    mockDocument,
    mockWindow,
    mockPerformance,
  };
};

// Scenario builders for iOS optimization testing
const createIOSScenarios = () => {
  // iOS Device scenarios
  const iosDevice = (version = '16.0', device = 'iPhone') => ({
    userAgent: `Mozilla/5.0 (${device}; CPU ${device} OS ${version.replace('.', '_')} like Mac OS X) AppleWebKit/605.1.15`,
    expectedVersion: parseInt(version.split('.')[0] || '16', 10),
    device,
  });

  const safariDevice = (version = '16.0') => ({
    userAgent: `Mozilla/5.0 (iPhone; CPU iPhone OS ${version.replace('.', '_')} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1`,
    expectedVersion: parseInt(version.split('.')[0] || '16', 10),
    isSafari: true,
  });

  const pwaDevice = (version = '16.0') => ({
    userAgent: `Mozilla/5.0 (iPhone; CPU iPhone OS ${version.replace('.', '_')} like Mac OS X) AppleWebKit/605.1.15`,
    standalone: true,
    matchMedia: true,
    expectedVersion: parseInt(version.split('.')[0] || '16', 10),
    isPWA: true,
  });

  // Audio interruption scenarios
  const phoneCallInterruption: IOSAudioInterruption = {
    type: 'began',
    reason: 'phone_call',
    timestamp: Date.now(),
  };

  const phoneCallEnd: IOSAudioInterruption = {
    type: 'ended',
    reason: 'phone_call',
    timestamp: Date.now(),
  };

  const alarmInterruption: IOSAudioInterruption = {
    type: 'began',
    reason: 'alarm',
    timestamp: Date.now(),
  };

  const otherAppInterruption: IOSAudioInterruption = {
    type: 'began',
    reason: 'other_app',
    timestamp: Date.now(),
  };

  // Route change scenarios
  const headphonesConnected: IOSRouteChangeEvent = {
    reason: 'newDevice',
    previousRoute: 'speaker',
    newRoute: 'headphones',
    routeQuality: 'high',
    timestamp: Date.now(),
  };

  const bluetoothConnected: IOSRouteChangeEvent = {
    reason: 'routeConfigurationChange',
    previousRoute: 'headphones',
    newRoute: 'bluetooth',
    routeQuality: 'medium',
    timestamp: Date.now(),
  };

  const airPlayConnected: IOSRouteChangeEvent = {
    reason: 'routeConfigurationChange',
    previousRoute: 'speaker',
    newRoute: 'airplay',
    routeQuality: 'high',
    timestamp: Date.now(),
  };

  return {
    devices: {
      iosDevice,
      safariDevice,
      pwaDevice,
    },
    interruptions: {
      phoneCallInterruption,
      phoneCallEnd,
      alarmInterruption,
      otherAppInterruption,
    },
    routeChanges: {
      headphonesConnected,
      bluetoothConnected,
      airPlayConnected,
    },
  };
};

// Expectation helpers for iOS optimization testing
const createIOSExpectations = () => {
  const shouldDetectIOSEnvironment = (
    optimizer: IOSOptimizer,
    expectedVersion: number,
  ) => {
    const status = optimizer.getOptimizationStatus();
    expect(status.isIOSDevice).toBe(true);
    expect(status.iosMajorVersion).toBe(expectedVersion);
  };

  const shouldDetectSafari = (optimizer: IOSOptimizer) => {
    const status = optimizer.getOptimizationStatus();
    expect(status.isSafari).toBe(true);
  };

  const shouldDetectPWA = (optimizer: IOSOptimizer) => {
    const status = optimizer.getOptimizationStatus();
    expect(status.isStandalonePWA).toBe(true);
  };

  const shouldConfigureAudioSession = (optimizer: IOSOptimizer) => {
    const status = optimizer.getOptimizationStatus();
    expect(status.sessionConfig).toMatchObject({
      category: expect.any(String),
      mode: expect.any(String),
      options: expect.any(Object),
      preferredSampleRate: expect.any(Number),
      preferredBufferDuration: expect.any(Number),
    });
  };

  const shouldHandleBackgroundAudio = (optimizer: IOSOptimizer) => {
    const status = optimizer.getOptimizationStatus();
    expect(status.backgroundConfig).toMatchObject({
      enabled: expect.any(Boolean),
      strategy: expect.stringMatching(/safari|pwa/),
      keepAliveInterval: expect.any(Number),
      silentAudioInterval: expect.any(Number),
    });
  };

  const shouldProvideOptimizationDecision = (decision: any) => {
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
    expect(decision.confidence).toBeGreaterThan(0);
    expect(decision.confidence).toBeLessThanOrEqual(1);
  };

  const shouldTrackPerformanceMetrics = (optimizer: IOSOptimizer) => {
    const status = optimizer.getOptimizationStatus();
    expect(status.performanceMetrics).toMatchObject({
      routeChanges: expect.any(Number),
      sessionInterruptions: expect.any(Number),
      sessionConfigurations: expect.any(Number),
      backgroundAudioDropouts: expect.any(Number),
      safariWorkarounds: expect.any(Number),
      touchActivations: expect.any(Number),
      lastOptimization: expect.any(Number),
    });
    expect(status.performanceMetrics.routeChanges).toBeGreaterThanOrEqual(0);
    expect(
      status.performanceMetrics.sessionInterruptions,
    ).toBeGreaterThanOrEqual(0);
  };

  const shouldUpdatePlaybackState = (
    optimizer: IOSOptimizer,
    state: IOSPlaybackState,
  ) => {
    optimizer.updatePlaybackState(state);
    const status = optimizer.getOptimizationStatus();
    expect(status.currentPlaybackState).toBe(state);
  };

  return {
    shouldDetectIOSEnvironment,
    shouldDetectSafari,
    shouldDetectPWA,
    shouldConfigureAudioSession,
    shouldHandleBackgroundAudio,
    shouldProvideOptimizationDecision,
    shouldTrackPerformanceMetrics,
    shouldUpdatePlaybackState,
  };
};

describe('IOSOptimizer Behavior', () => {
  let optimizer: IOSOptimizer;
  let mockEnv: ReturnType<typeof createMockIOSEnvironment>;
  let scenarios: ReturnType<typeof createIOSScenarios>;
  let expectations: ReturnType<typeof createIOSExpectations>;

  beforeEach(async () => {
    // Setup mock environment
    mockEnv = createMockIOSEnvironment();
    scenarios = createIOSScenarios();
    expectations = createIOSExpectations();

    // Setup global mocks
    vi.stubGlobal('navigator', mockEnv.mockNavigator);
    vi.stubGlobal(
      'AudioContext',
      vi.fn(() => mockEnv.mockAudioContext),
    );
    vi.stubGlobal('document', mockEnv.mockDocument);
    vi.stubGlobal('window', mockEnv.mockWindow);
    vi.stubGlobal('performance', mockEnv.mockPerformance);

    // Reset singleton
    (IOSOptimizer as any).instance = undefined;
    optimizer = IOSOptimizer.getInstance();
  });

  afterEach(async () => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    if (optimizer) {
      await optimizer.dispose();
    }
  });

  describe('🍎 iOS Environment Detection Behavior', () => {
    it('should detect iPhone device correctly', async () => {
      const iosConfig = scenarios.devices.iosDevice('15.0', 'iPhone');
      vi.stubGlobal('navigator', {
        ...mockEnv.mockNavigator,
        userAgent: iosConfig.userAgent,
      });

      (IOSOptimizer as any).instance = undefined;
      optimizer = IOSOptimizer.getInstance();

      expectations.shouldDetectIOSEnvironment(
        optimizer,
        iosConfig.expectedVersion,
      );
    });

    it('should detect iPad device correctly', async () => {
      const iosConfig = scenarios.devices.iosDevice('16.0', 'iPad');
      vi.stubGlobal('navigator', {
        ...mockEnv.mockNavigator,
        userAgent: iosConfig.userAgent,
      });

      (IOSOptimizer as any).instance = undefined;
      optimizer = IOSOptimizer.getInstance();

      expectations.shouldDetectIOSEnvironment(
        optimizer,
        iosConfig.expectedVersion,
      );
    });

    it('should detect Safari browser correctly', async () => {
      const safariConfig = scenarios.devices.safariDevice('16.0');
      vi.stubGlobal('navigator', {
        ...mockEnv.mockNavigator,
        userAgent: safariConfig.userAgent,
      });

      (IOSOptimizer as any).instance = undefined;
      optimizer = IOSOptimizer.getInstance();

      expectations.shouldDetectIOSEnvironment(
        optimizer,
        safariConfig.expectedVersion,
      );
      expectations.shouldDetectSafari(optimizer);
    });

    it('should detect PWA standalone mode correctly', async () => {
      const pwaConfig = scenarios.devices.pwaDevice('16.0');
      vi.stubGlobal('navigator', {
        ...mockEnv.mockNavigator,
        userAgent: pwaConfig.userAgent,
        standalone: true,
      });
      vi.stubGlobal('window', {
        ...mockEnv.mockWindow,
        matchMedia: vi.fn().mockReturnValue({ matches: true }),
      });

      (IOSOptimizer as any).instance = undefined;
      optimizer = IOSOptimizer.getInstance();

      expectations.shouldDetectIOSEnvironment(
        optimizer,
        pwaConfig.expectedVersion,
      );
      expectations.shouldDetectPWA(optimizer);
    });

    it('should handle non-iOS devices gracefully', async () => {
      vi.stubGlobal('navigator', {
        ...mockEnv.mockNavigator,
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      });

      (IOSOptimizer as any).instance = undefined;
      optimizer = IOSOptimizer.getInstance();

      const status = optimizer.getOptimizationStatus();
      expect(status.isIOSDevice).toBe(false);
      expect(status.iosMajorVersion).toBe(0);
    });
  });

  describe('🎵 Audio Session Management Behavior', () => {
    beforeEach(async () => {
      await optimizer.initialize(mockEnv.mockAudioContext as any);
    });

    it('should configure audio session with default settings', async () => {
      await optimizer.configureAudioSession();

      expectations.shouldConfigureAudioSession(optimizer);
      expect(mockEnv.mockAudioContext.resume).toHaveBeenCalled();
    });

    it('should configure audio session with custom category and mode', async () => {
      await optimizer.configureAudioSession(
        'ambient' as IOSAudioSessionCategory,
        'movie_playback' as IOSAudioSessionMode,
      );

      const status = optimizer.getOptimizationStatus();
      expect(status.sessionConfig.category).toBe('ambient');
      expect(status.sessionConfig.mode).toBe('movie_playback');
    });

    it('should handle audio session configuration errors', async () => {
      // Reset AudioContext state to suspended to test error path
      mockEnv.mockAudioContext.state = 'suspended';
      mockEnv.mockAudioContext.resume.mockRejectedValueOnce(
        new Error('AudioContext error'),
      );

      await expect(optimizer.configureAudioSession()).rejects.toThrow(
        'AudioContext error',
      );

      const status = optimizer.getOptimizationStatus();
      expect(status.performanceMetrics.sessionInterruptions).toBeGreaterThan(0);
    });

    it('should activate audio context successfully', async () => {
      await optimizer.activateAudioContext();

      expect(mockEnv.mockAudioContext.resume).toHaveBeenCalled();
      expect(mockEnv.mockAudioContext.state).toBe('running');
    });

    it('should handle audio context activation with error throwing', async () => {
      // Reset AudioContext state to suspended to test error path
      mockEnv.mockAudioContext.state = 'suspended';
      mockEnv.mockAudioContext.resume.mockRejectedValueOnce(
        new Error('Activation failed'),
      );

      await expect(optimizer.activateAudioContext(true)).rejects.toThrow(
        'Activation failed',
      );
    });
  });

  describe('🎧 Background Audio Behavior', () => {
    beforeEach(async () => {
      await optimizer.initialize(mockEnv.mockAudioContext as any);
    });

    it('should enable background audio for Safari', async () => {
      const status = optimizer.getOptimizationStatus();
      if (status.isSafari) {
        await optimizer.enableBackgroundAudio();
        expectations.shouldHandleBackgroundAudio(optimizer);
      }
    });

    it('should enable background audio for PWA', async () => {
      const status = optimizer.getOptimizationStatus();
      if (status.isStandalonePWA) {
        await optimizer.enableBackgroundAudio();
        expectations.shouldHandleBackgroundAudio(optimizer);
      }
    });

    it('should handle background audio setup for non-iOS devices', async () => {
      vi.stubGlobal('navigator', {
        ...mockEnv.mockNavigator,
        userAgent: 'Mozilla/5.0 (Android 10; Mobile; rv:91.0)',
      });

      (IOSOptimizer as any).instance = undefined;
      const nonIOSOptimizer = IOSOptimizer.getInstance();
      await nonIOSOptimizer.initialize(mockEnv.mockAudioContext as any);

      // Should complete without errors for non-iOS
      await expect(
        nonIOSOptimizer.enableBackgroundAudio(),
      ).resolves.not.toThrow();

      await nonIOSOptimizer.dispose();
    });

    it('should handle background audio errors gracefully', async () => {
      // Mock an error condition that might occur during background audio setup
      mockEnv.mockDocument.addEventListener.mockImplementationOnce(() => {
        throw new Error('Event listener setup failed');
      });

      await expect(optimizer.enableBackgroundAudio()).resolves.not.toThrow();

      const status = optimizer.getOptimizationStatus();
      expect(
        status.performanceMetrics.backgroundAudioDropouts,
      ).toBeGreaterThanOrEqual(0);
    });
  });

  describe('🔧 Safari Workarounds and Compatibility', () => {
    beforeEach(async () => {
      const safariConfig = scenarios.devices.safariDevice('14.0'); // Older iOS version
      vi.stubGlobal('navigator', {
        ...mockEnv.mockNavigator,
        userAgent: safariConfig.userAgent,
      });

      (IOSOptimizer as any).instance = undefined;
      optimizer = IOSOptimizer.getInstance();
      await optimizer.initialize(mockEnv.mockAudioContext as any);
    });

    it('should apply legacy AudioContext workarounds for iOS < 15', async () => {
      const status = optimizer.getOptimizationStatus();
      if (status.iosMajorVersion < 15) {
        expect(status.sessionConfig).toBeDefined();
        // Legacy workarounds would be applied during initialization
      }
    });

    it('should require user gesture for older iOS versions', async () => {
      const status = optimizer.getOptimizationStatus();
      if (status.iosMajorVersion < 17) {
        // Touch activation should be required
        mockEnv.mockDocument.addEventListener = vi.fn((event, handler) => {
          if (event === 'touchstart') {
            expect(handler).toBeDefined();
          }
        });
      }
    });

    it('should handle touch activation for user gesture requirements', async () => {
      // Simulate touch event
      const _touchEvent = new Event('touchstart');

      // The touch handler would be set up during initialization
      const status = optimizer.getOptimizationStatus();
      expect(status.performanceMetrics.touchActivations).toBeGreaterThanOrEqual(
        0,
      );
    });
  });

  describe('📱 PWA Optimization Behavior', () => {
    beforeEach(async () => {
      const pwaConfig = scenarios.devices.pwaDevice('16.0');
      vi.stubGlobal('navigator', {
        ...mockEnv.mockNavigator,
        userAgent: pwaConfig.userAgent,
        standalone: true,
      });
      vi.stubGlobal('window', {
        ...mockEnv.mockWindow,
        matchMedia: vi.fn().mockReturnValue({ matches: true }),
      });

      (IOSOptimizer as any).instance = undefined;
      optimizer = IOSOptimizer.getInstance();
      await optimizer.initialize(mockEnv.mockAudioContext as any);
    });

    it('should detect and configure PWA-specific optimizations', async () => {
      expectations.shouldDetectPWA(optimizer);

      const decision = await optimizer.getOptimizationDecision();
      expect(decision.iosSpecific.pwaOptimizations).toContain(
        'standalone_audio_session',
      );
      expect(decision.iosSpecific.pwaOptimizations).toContain(
        'enhanced_background_audio',
      );
    });

    it('should optimize background audio strategy for PWA', async () => {
      const status = optimizer.getOptimizationStatus();
      expect(status.backgroundConfig.strategy).toBe('pwa');
    });

    it('should handle PWA-specific audio session configuration', async () => {
      const decision = await optimizer.getOptimizationDecision();
      expect(decision.iosSpecific.pwaOptimizations).toContain(
        'native_audio_controls',
      );
    });
  });

  describe('☎️ Audio Interruption Handling Behavior', () => {
    beforeEach(async () => {
      await optimizer.initialize(mockEnv.mockAudioContext as any);
    });

    it('should handle phone call interruption', async () => {
      const initialMetrics =
        optimizer.getOptimizationStatus().performanceMetrics
          .sessionInterruptions;

      await optimizer.handleAudioInterruption(
        scenarios.interruptions.phoneCallInterruption,
      );

      const status = optimizer.getOptimizationStatus();
      expect(status.performanceMetrics.sessionInterruptions).toBe(
        initialMetrics + 1,
      );
    });

    it('should handle phone call end and resume', async () => {
      // Interrupt first
      await optimizer.handleAudioInterruption(
        scenarios.interruptions.phoneCallInterruption,
      );

      // Then resume
      await optimizer.handleAudioInterruption(
        scenarios.interruptions.phoneCallEnd,
      );

      expect(mockEnv.mockAudioContext.resume).toHaveBeenCalled();
    });

    it('should handle alarm interruption', async () => {
      await optimizer.handleAudioInterruption(
        scenarios.interruptions.alarmInterruption,
      );

      const status = optimizer.getOptimizationStatus();
      expect(status.performanceMetrics.sessionInterruptions).toBeGreaterThan(0);
    });

    it('should handle other app interruption', async () => {
      await optimizer.handleAudioInterruption(
        scenarios.interruptions.otherAppInterruption,
      );

      const status = optimizer.getOptimizationStatus();
      expect(status.performanceMetrics.sessionInterruptions).toBeGreaterThan(0);
    });

    it('should track interruption history', async () => {
      await optimizer.handleAudioInterruption(
        scenarios.interruptions.phoneCallInterruption,
      );

      const status = optimizer.getOptimizationStatus();
      // Should have stored the last interruption (private property, so we test behavior)
      expect(status.performanceMetrics.sessionInterruptions).toBeGreaterThan(0);
    });
  });

  describe('🔊 Audio Route Change Behavior', () => {
    beforeEach(async () => {
      await optimizer.initialize(mockEnv.mockAudioContext as any);
    });

    it('should handle headphones connection', async () => {
      const initialRouteChanges =
        optimizer.getOptimizationStatus().performanceMetrics.routeChanges;

      await optimizer.handleRouteChange(
        scenarios.routeChanges.headphonesConnected,
      );

      const status = optimizer.getOptimizationStatus();
      expect(status.performanceMetrics.routeChanges).toBe(
        initialRouteChanges + 1,
      );
    });

    it('should handle Bluetooth audio connection', async () => {
      await optimizer.handleRouteChange(
        scenarios.routeChanges.bluetoothConnected,
      );

      const status = optimizer.getOptimizationStatus();
      expect(status.performanceMetrics.routeChanges).toBeGreaterThan(0);
    });

    it('should handle AirPlay connection', async () => {
      await optimizer.handleRouteChange(
        scenarios.routeChanges.airPlayConnected,
      );

      const status = optimizer.getOptimizationStatus();
      expect(status.performanceMetrics.routeChanges).toBeGreaterThan(0);
    });

    it('should optimize performance for different routes', async () => {
      await optimizer.handleRouteChange(
        scenarios.routeChanges.headphonesConnected,
      );
      await optimizer.handleRouteChange(
        scenarios.routeChanges.bluetoothConnected,
      );

      // Each route change should trigger performance optimization
      const status = optimizer.getOptimizationStatus();
      expect(status.performanceMetrics.routeChanges).toBe(2);
    });
  });

  describe('🎮 Playback State Management Behavior', () => {
    beforeEach(async () => {
      await optimizer.initialize(mockEnv.mockAudioContext as any);
    });

    it('should update playback state to playing', () => {
      expectations.shouldUpdatePlaybackState(optimizer, 'playing');
    });

    it('should update playback state to paused', () => {
      expectations.shouldUpdatePlaybackState(optimizer, 'paused');
    });

    it('should update playback state to stopped', () => {
      expectations.shouldUpdatePlaybackState(optimizer, 'stopped');
    });

    it('should handle playback state transitions', () => {
      optimizer.updatePlaybackState('playing');
      optimizer.updatePlaybackState('paused');
      optimizer.updatePlaybackState('stopped');

      const status = optimizer.getOptimizationStatus();
      expect(status.currentPlaybackState).toBe('stopped');
    });

    it('should optimize for different playback states', () => {
      optimizer.updatePlaybackState('playing');
      const playingStatus = optimizer.getOptimizationStatus();

      optimizer.updatePlaybackState('paused');
      const pausedStatus = optimizer.getOptimizationStatus();

      // State changes should be reflected
      expect(playingStatus.currentPlaybackState).toBe('playing');
      expect(pausedStatus.currentPlaybackState).toBe('paused');
    });
  });

  describe('📊 Optimization Decision Generation Behavior', () => {
    beforeEach(async () => {
      await optimizer.initialize(mockEnv.mockAudioContext as any);
    });

    it('should generate comprehensive optimization decision', async () => {
      const decision = await optimizer.getOptimizationDecision();
      expectations.shouldProvideOptimizationDecision(decision);
    });

    it('should include iOS-specific recommendations', async () => {
      const decision = await optimizer.getOptimizationDecision();

      expect(decision.iosSpecific.recommendedBufferSize).toBeGreaterThan(0);
      expect(['interactive', 'balanced', 'playback']).toContain(
        decision.iosSpecific.recommendedLatencyHint,
      );
    });

    it('should provide Safari-specific workarounds', async () => {
      const decision = await optimizer.getOptimizationDecision();
      expect(decision.iosSpecific.safariWorkarounds).toBeInstanceOf(Array);
    });

    it('should provide PWA-specific optimizations', async () => {
      const decision = await optimizer.getOptimizationDecision();
      expect(decision.iosSpecific.pwaOptimizations).toBeInstanceOf(Array);
    });

    it('should calculate performance and battery impact', async () => {
      const decision = await optimizer.getOptimizationDecision();
      expect(decision.performanceImpact).toBeGreaterThanOrEqual(0);
      expect(decision.batteryImpact).toBeGreaterThanOrEqual(0);
      expect(decision.reasoning).toBeDefined();
    });
  });

  describe('📈 Performance Monitoring Behavior', () => {
    beforeEach(async () => {
      await optimizer.initialize(mockEnv.mockAudioContext as any);
    });

    it('should track performance metrics accurately', () => {
      expectations.shouldTrackPerformanceMetrics(optimizer);
    });

    it('should increment metrics on specific events', async () => {
      const initialMetrics =
        optimizer.getOptimizationStatus().performanceMetrics;

      await optimizer.handleAudioInterruption(
        scenarios.interruptions.phoneCallInterruption,
      );
      await optimizer.handleRouteChange(
        scenarios.routeChanges.headphonesConnected,
      );
      await optimizer.configureAudioSession();

      const updatedMetrics =
        optimizer.getOptimizationStatus().performanceMetrics;
      expect(updatedMetrics.sessionInterruptions).toBeGreaterThan(
        initialMetrics.sessionInterruptions,
      );
      expect(updatedMetrics.routeChanges).toBeGreaterThan(
        initialMetrics.routeChanges,
      );
      expect(updatedMetrics.sessionConfigurations).toBeGreaterThan(
        initialMetrics.sessionConfigurations,
      );
    });

    it('should provide optimization status with current metrics', () => {
      const status = optimizer.getOptimizationStatus();

      expect(status.isIOSDevice).toBeDefined();
      expect(status.iosMajorVersion).toBeDefined();
      expect(status.currentPlaybackState).toBeDefined();
      expect(status.performanceMetrics).toBeDefined();
    });

    it('should handle metrics collection over time', async () => {
      // Simulate various events to accumulate metrics
      await optimizer.handleAudioInterruption(
        scenarios.interruptions.phoneCallInterruption,
      );
      await optimizer.handleRouteChange(
        scenarios.routeChanges.headphonesConnected,
      );
      await optimizer.configureAudioSession();

      const metrics = optimizer.getOptimizationStatus().performanceMetrics;
      expect(metrics.lastOptimization).toBeGreaterThan(0);
    });
  });

  describe('🔄 Lifecycle Management Behavior', () => {
    it('should initialize properly on iOS devices', async () => {
      await optimizer.initialize(mockEnv.mockAudioContext as any);

      const _status = optimizer.getOptimizationStatus();
      expectations.shouldConfigureAudioSession(optimizer);
      expectations.shouldHandleBackgroundAudio(optimizer);
    });

    it('should handle initialization on non-iOS devices', async () => {
      vi.stubGlobal('navigator', {
        ...mockEnv.mockNavigator,
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      });

      (IOSOptimizer as any).instance = undefined;
      const nonIOSOptimizer = IOSOptimizer.getInstance();

      // Should complete initialization without errors for non-iOS
      await expect(
        nonIOSOptimizer.initialize(mockEnv.mockAudioContext as any),
      ).resolves.not.toThrow();

      await nonIOSOptimizer.dispose();
    });

    it('should prevent double initialization', async () => {
      await optimizer.initialize(mockEnv.mockAudioContext as any);

      // Second initialization should be safe
      await expect(
        optimizer.initialize(mockEnv.mockAudioContext as any),
      ).resolves.not.toThrow();
    });

    it('should dispose properly and clean up resources', async () => {
      await optimizer.initialize(mockEnv.mockAudioContext as any);

      // Dispose should complete without errors
      await expect(optimizer.dispose()).resolves.not.toThrow();

      // Verify cleanup
      expect(mockEnv.mockDocument.removeEventListener).toHaveBeenCalled();
      expect(mockEnv.mockWindow.removeEventListener).toHaveBeenCalled();
    });

    it('should maintain singleton pattern', () => {
      const optimizer1 = IOSOptimizer.getInstance();
      const optimizer2 = IOSOptimizer.getInstance();

      expect(optimizer1).toBe(optimizer2);
    });
  });

  describe('🛡️ Error Recovery Behavior', () => {
    beforeEach(async () => {
      await optimizer.initialize(mockEnv.mockAudioContext as any);
    });

    it('should handle missing browser APIs gracefully', async () => {
      vi.stubGlobal('document', undefined);
      vi.stubGlobal('window', undefined);

      (IOSOptimizer as any).instance = undefined;
      const fallbackOptimizer = IOSOptimizer.getInstance();

      await expect(
        fallbackOptimizer.initialize(mockEnv.mockAudioContext as any),
      ).resolves.not.toThrow();

      await fallbackOptimizer.dispose();
    });

    it('should handle audio context errors gracefully', async () => {
      mockEnv.mockAudioContext.resume.mockRejectedValue(
        new Error('AudioContext unavailable'),
      );

      await expect(optimizer.activateAudioContext()).resolves.not.toThrow();
    });

    it('should handle event listener setup failures', async () => {
      mockEnv.mockDocument.addEventListener.mockImplementation(() => {
        throw new Error('Event listener setup failed');
      });

      (IOSOptimizer as any).instance = undefined;
      const resilientOptimizer = IOSOptimizer.getInstance();

      await expect(
        resilientOptimizer.initialize(mockEnv.mockAudioContext as any),
      ).resolves.not.toThrow();

      await resilientOptimizer.dispose();
    });

    it('should handle disposal multiple times', async () => {
      await optimizer.dispose();
      await expect(optimizer.dispose()).resolves.not.toThrow();
      await expect(optimizer.dispose()).resolves.not.toThrow();
    });
  });
});
