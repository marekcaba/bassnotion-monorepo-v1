/**
 * GracefulDegradation Behavior Tests
 *
 * Tests the adaptive fallback behaviors including degradation strategies,
 * feature management, recovery mechanisms, and intelligent fallback selection.
 *
 * Focus: What the service DOES, not how it's implemented
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  GracefulDegradation,
  DegradationLevel,
  FeatureCategory,
  DegradationContext,
  DegradationStrategy,
  DegradationAction,
  DegradationState,
} from '../../errors/GracefulDegradation.js';
import { ErrorCategory, ErrorSeverity } from '../../errors/base.js';

// Test Environment Setup
const setupGracefulDegradationEnvironment = () => {
  global.console = {
    ...global.console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  // Mock Date.now with proper typing
  const originalDate = global.Date;
  global.Date = class extends originalDate {
    static now = vi.fn(() => 1000);
  } as unknown as DateConstructor;

  global.performance = {
    now: vi.fn(() => 1000),
    mark: vi.fn(),
    measure: vi.fn(),
  } as any;

  return {};
};

// Degradation Scenario Builders
const createDegradationScenarios = () => {
  const deviceCapabilities = {
    highEnd: {
      isLowEnd: false,
      batteryLevel: 0.85,
      networkCondition: 'excellent' as const,
      memoryPressure: 'normal' as const,
    },
    midRange: {
      isLowEnd: false,
      batteryLevel: 0.6,
      networkCondition: 'good' as const,
      memoryPressure: 'moderate' as const,
    },
    lowEnd: {
      isLowEnd: true,
      batteryLevel: 0.25,
      networkCondition: 'fair' as const,
      memoryPressure: 'high' as const,
    },
    critical: {
      isLowEnd: true,
      batteryLevel: 0.05,
      networkCondition: 'poor' as const,
      memoryPressure: 'critical' as const,
    },
    offline: {
      isLowEnd: true,
      batteryLevel: 0.1,
      networkCondition: 'offline' as const,
      memoryPressure: 'high' as const,
    },
  };

  const userPreferences = {
    performanceFirst: {
      preferPerformanceOverQuality: true,
      allowDataSaving: true,
      enableOfflineMode: true,
    },
    qualityFirst: {
      preferPerformanceOverQuality: false,
      allowDataSaving: false,
      enableOfflineMode: false,
    },
    balanced: {
      preferPerformanceOverQuality: false,
      allowDataSaving: true,
      enableOfflineMode: true,
    },
  };

  const createDegradationContext = (
    errorCategory: ErrorCategory,
    errorSeverity: ErrorSeverity,
    deviceType: keyof typeof deviceCapabilities = 'midRange',
    userPrefType: keyof typeof userPreferences = 'balanced',
    affectedSystems: string[] = [],
    currentLevel: DegradationLevel = DegradationLevel.NONE,
  ): DegradationContext => ({
    errorCategory,
    errorSeverity,
    affectedSystems,
    deviceCapabilities: deviceCapabilities[deviceType],
    currentDegradationLevel: currentLevel,
    userPreferences: userPreferences[userPrefType],
  });

  const networkFailureContext = createDegradationContext(
    ErrorCategory.NETWORK,
    ErrorSeverity.HIGH,
    'lowEnd',
    'performanceFirst',
    ['cdn', 'api'],
    DegradationLevel.NONE,
  );

  const audioFailureContext = createDegradationContext(
    ErrorCategory.AUDIO_CONTEXT,
    ErrorSeverity.CRITICAL,
    'midRange',
    'qualityFirst',
    ['audioContext', 'webAudio'],
    DegradationLevel.NONE,
  );

  const memoryPressureContext = createDegradationContext(
    ErrorCategory.RESOURCE,
    ErrorSeverity.HIGH,
    'critical',
    'performanceFirst',
    ['memory', 'backgroundProcesses'],
    DegradationLevel.MINIMAL,
  );

  const systemFailureContext = createDegradationContext(
    ErrorCategory.PERFORMANCE,
    ErrorSeverity.CRITICAL,
    'lowEnd',
    'balanced',
    ['core', 'plugins', 'state'],
    DegradationLevel.NONE,
  );

  const offlineContext = createDegradationContext(
    ErrorCategory.NETWORK,
    ErrorSeverity.CRITICAL,
    'offline',
    'balanced',
    ['network', 'api', 'cdn'],
    DegradationLevel.NONE,
  );

  const createMockAction = (
    type: DegradationAction['type'],
    target: string,
    shouldSucceed = true,
  ): DegradationAction => ({
    type,
    target,
    description: `${type} ${target}`,
    implementation: vi.fn().mockResolvedValue(shouldSucceed),
    rollback: vi.fn().mockResolvedValue(shouldSucceed),
  });

  return {
    deviceCapabilities,
    userPreferences,
    createDegradationContext,
    networkFailureContext,
    audioFailureContext,
    memoryPressureContext,
    systemFailureContext,
    offlineContext,
    createMockAction,
  };
};

// Test Helpers
const expectValidDegradationLevel = (level: DegradationLevel) => {
  expect(Object.values(DegradationLevel)).toContain(level);
};

const expectValidFeatureCategory = (category: FeatureCategory) => {
  expect(Object.values(FeatureCategory)).toContain(category);
};

const expectValidDegradationState = (state: DegradationState) => {
  expect(state).toBeDefined();
  expectValidDegradationLevel(state.currentLevel);
  expect(Array.isArray(state.activeStrategies)).toBe(true);
  expect(state.disabledFeatures).toBeInstanceOf(Set);
  expect(Array.isArray(state.appliedActions)).toBe(true);
  expect(typeof state.lastUpdate).toBe('number');
  expect(typeof state.recoveryAttempts).toBe('number');

  expect(state.lastUpdate).toBeGreaterThan(0);
  expect(state.recoveryAttempts).toBeGreaterThanOrEqual(0);
};

const expectValidDegradationStrategy = (strategy: DegradationStrategy) => {
  expect(strategy).toBeDefined();
  expectValidDegradationLevel(strategy.level);
  expect(typeof strategy.description).toBe('string');
  expect(Array.isArray(strategy.affectedFeatures)).toBe(true);
  expect(Array.isArray(strategy.fallbackActions)).toBe(true);
  expect(typeof strategy.userMessage).toBe('string');
  expect(typeof strategy.technicalDetails).toBe('string');
  expect(typeof strategy.canRecover).toBe('boolean');
  expect(typeof strategy.estimatedImpact).toBe('number');

  expect(strategy.description.length).toBeGreaterThan(0);
  expect(strategy.userMessage.length).toBeGreaterThan(0);
  expect(strategy.estimatedImpact).toBeGreaterThanOrEqual(0);
  expect(strategy.estimatedImpact).toBeLessThanOrEqual(100);

  strategy.affectedFeatures.forEach((feature) => {
    expectValidFeatureCategory(feature);
  });
};

const _expectDegradationProgression = (
  fromLevel: DegradationLevel,
  toLevel: DegradationLevel,
  actualLevel: DegradationLevel,
) => {
  expect(actualLevel).toBe(toLevel);

  const levelOrder = [
    DegradationLevel.NONE,
    DegradationLevel.MINIMAL,
    DegradationLevel.MODERATE,
    DegradationLevel.SEVERE,
    DegradationLevel.CRITICAL,
  ];

  const _fromIndex = levelOrder.indexOf(fromLevel);
  const toIndex = levelOrder.indexOf(toLevel);
  const actualIndex = levelOrder.indexOf(actualLevel);

  expect(actualIndex).toBe(toIndex);
};

// Behavior Tests
describe('GracefulDegradation Behaviors', () => {
  let gracefulDegradation: GracefulDegradation;
  let scenarios: ReturnType<typeof createDegradationScenarios>;

  beforeEach(() => {
    setupGracefulDegradationEnvironment();
    scenarios = createDegradationScenarios();

    // Reset singleton instance
    (GracefulDegradation as any).instance = null;
    gracefulDegradation = GracefulDegradation.getInstance();

    vi.clearAllMocks();
  });

  afterEach(() => {
    gracefulDegradation.reset();
    vi.restoreAllMocks();
  });

  describe('Graceful Degradation Identity Behaviors', () => {
    test('should provide singleton graceful degradation instance', () => {
      const instance1 = GracefulDegradation.getInstance();
      const instance2 = GracefulDegradation.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(GracefulDegradation);
    });

    test('should maintain singleton across multiple calls', () => {
      const instances = Array.from({ length: 5 }, () =>
        GracefulDegradation.getInstance(),
      );

      instances.forEach((instance) => {
        expect(instance).toBe(gracefulDegradation);
      });
    });

    test('should provide initial degradation state', () => {
      const state = gracefulDegradation.getState();

      expectValidDegradationState(state);
      expect(state.currentLevel).toBe(DegradationLevel.NONE);
      expect(state.activeStrategies).toHaveLength(0);
      expect(state.disabledFeatures.size).toBe(0);
      expect(state.appliedActions).toHaveLength(0);
      expect(state.recoveryAttempts).toBe(0);
    });

    test('should start with all features available', () => {
      const audioAvailable = gracefulDegradation.isFeatureAvailable(
        FeatureCategory.AUDIO_CONTEXT,
      );
      const effectsAvailable = gracefulDegradation.isFeatureAvailable(
        FeatureCategory.AUDIO_EFFECTS,
      );
      const pluginsAvailable = gracefulDegradation.isFeatureAvailable(
        FeatureCategory.PLUGIN_SYSTEM,
      );

      expect(audioAvailable).toBe(true);
      expect(effectsAvailable).toBe(true);
      expect(pluginsAvailable).toBe(true);
    });

    test('should provide empty user message initially', () => {
      const message = gracefulDegradation.getUserMessage();
      expect(typeof message).toBe('string');
    });
  });

  describe('Degradation Strategy Selection Behaviors', () => {
    test('should apply appropriate degradation for network failures', async () => {
      const context = scenarios.networkFailureContext;

      const result = await gracefulDegradation.applyDegradation(context);

      expect(result).toBe(true);
      const state = gracefulDegradation.getState();
      expectValidDegradationState(state);
      expect(state.currentLevel).not.toBe(DegradationLevel.NONE);
    });

    test('should apply appropriate degradation for audio failures', async () => {
      const context = scenarios.audioFailureContext;

      const result = await gracefulDegradation.applyDegradation(context);

      expect(result).toBe(true);
      const state = gracefulDegradation.getState();
      expectValidDegradationState(state);
      expect(state.currentLevel).not.toBe(DegradationLevel.NONE);
    });

    test('should handle memory pressure appropriately', async () => {
      const context = scenarios.memoryPressureContext;

      const result = await gracefulDegradation.applyDegradation(context);

      expect(result).toBe(true);
      const state = gracefulDegradation.getState();
      expectValidDegradationState(state);
      expect(state.currentLevel).not.toBe(DegradationLevel.NONE);
    });

    test('should select severe degradation for system failures', async () => {
      const context = scenarios.systemFailureContext;

      const result = await gracefulDegradation.applyDegradation(context);

      expect(result).toBe(true);
      const state = gracefulDegradation.getState();
      expectValidDegradationState(state);

      // System failures should trigger significant degradation
      const severeLevels = [DegradationLevel.SEVERE, DegradationLevel.CRITICAL];
      expect(severeLevels).toContain(state.currentLevel);
    });

    test('should handle offline scenarios with critical degradation', async () => {
      const context = scenarios.offlineContext;

      const result = await gracefulDegradation.applyDegradation(context);

      expect(result).toBe(true);
      const state = gracefulDegradation.getState();
      expectValidDegradationState(state);

      // Offline should trigger critical degradation
      expect(state.currentLevel).toBe(DegradationLevel.CRITICAL);
    });
  });

  describe('Device-Aware Degradation Behaviors', () => {
    test('should adapt degradation for low-end devices', async () => {
      const lowEndContext = scenarios.createDegradationContext(
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.MEDIUM,
        'lowEnd',
        'performanceFirst',
      );

      const result = await gracefulDegradation.applyDegradation(lowEndContext);

      expect(result).toBe(true);
      const state = gracefulDegradation.getState();
      expectValidDegradationState(state);

      // Low-end devices should get more aggressive degradation
      expect(state.currentLevel).not.toBe(DegradationLevel.NONE);
    });

    test('should handle high-end devices with appropriate degradation', async () => {
      const highEndContext = scenarios.createDegradationContext(
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.MEDIUM,
        'highEnd',
        'qualityFirst',
      );

      const result = await gracefulDegradation.applyDegradation(highEndContext);

      expect(result).toBe(true);
      const state = gracefulDegradation.getState();
      expectValidDegradationState(state);

      // High-end devices should still respond to medium severity appropriately
      expect(state.currentLevel).not.toBe(DegradationLevel.CRITICAL);
    });

    test('should consider battery level in degradation decisions', async () => {
      const criticalBatteryContext = scenarios.createDegradationContext(
        ErrorCategory.RESOURCE,
        ErrorSeverity.MEDIUM,
        'critical',
        'performanceFirst',
      );

      const result = await gracefulDegradation.applyDegradation(
        criticalBatteryContext,
      );

      expect(result).toBe(true);
      const state = gracefulDegradation.getState();
      expectValidDegradationState(state);

      // Critical battery should trigger significant degradation
      expect(state.currentLevel).not.toBe(DegradationLevel.NONE);
    });

    test('should adapt to network conditions', async () => {
      const poorNetworkContext = scenarios.createDegradationContext(
        ErrorCategory.NETWORK,
        ErrorSeverity.MEDIUM,
        'lowEnd',
        'balanced',
      );

      const result =
        await gracefulDegradation.applyDegradation(poorNetworkContext);

      expect(result).toBe(true);
      const state = gracefulDegradation.getState();
      expectValidDegradationState(state);
      expect(state.currentLevel).not.toBe(DegradationLevel.NONE);
    });

    test('should consider memory pressure levels', async () => {
      const highMemoryPressureContext = scenarios.createDegradationContext(
        ErrorCategory.RESOURCE,
        ErrorSeverity.HIGH,
        'critical',
        'performanceFirst',
      );

      const result = await gracefulDegradation.applyDegradation(
        highMemoryPressureContext,
      );

      expect(result).toBe(true);
      const state = gracefulDegradation.getState();
      expectValidDegradationState(state);

      // High memory pressure should trigger significant degradation
      const significantLevels = [
        DegradationLevel.MODERATE,
        DegradationLevel.SEVERE,
        DegradationLevel.CRITICAL,
      ];
      expect(significantLevels).toContain(state.currentLevel);
    });
  });

  describe('User Preference Adaptation Behaviors', () => {
    test('should prioritize performance when user prefers performance', async () => {
      const performanceContext = scenarios.createDegradationContext(
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.HIGH,
        'midRange',
        'performanceFirst',
      );

      const result =
        await gracefulDegradation.applyDegradation(performanceContext);

      expect(result).toBe(true);
      const state = gracefulDegradation.getState();
      expectValidDegradationState(state);
      expect(state.currentLevel).not.toBe(DegradationLevel.NONE);
    });

    test('should consider quality preference in degradation decisions', async () => {
      const qualityContext = scenarios.createDegradationContext(
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.MEDIUM,
        'highEnd',
        'qualityFirst',
      );

      const result = await gracefulDegradation.applyDegradation(qualityContext);

      expect(result).toBe(true);
      const state = gracefulDegradation.getState();
      expectValidDegradationState(state);

      // Quality-first users should get degradation but not critical level
      expect(state.currentLevel).not.toBe(DegradationLevel.CRITICAL);
    });

    test('should enable data saving features when user allows', async () => {
      const dataSavingContext = scenarios.createDegradationContext(
        ErrorCategory.NETWORK,
        ErrorSeverity.HIGH,
        'lowEnd',
        'performanceFirst',
      );

      const result =
        await gracefulDegradation.applyDegradation(dataSavingContext);

      expect(result).toBe(true);
      const state = gracefulDegradation.getState();
      expectValidDegradationState(state);
      expect(state.appliedActions.length).toBeGreaterThan(0);
    });

    test('should enable offline mode when user preferences allow', async () => {
      const offlineEnabledContext = scenarios.createDegradationContext(
        ErrorCategory.NETWORK,
        ErrorSeverity.CRITICAL,
        'midRange',
        'balanced',
      );

      const result = await gracefulDegradation.applyDegradation(
        offlineEnabledContext,
      );

      expect(result).toBe(true);
      const state = gracefulDegradation.getState();
      expectValidDegradationState(state);
      expect(state.currentLevel).not.toBe(DegradationLevel.NONE);
    });
  });

  describe('Feature Management Behaviors', () => {
    test('should disable features based on degradation level', async () => {
      const context = scenarios.systemFailureContext;

      await gracefulDegradation.applyDegradation(context);

      // Check that some features are now disabled
      const audioAvailable = gracefulDegradation.isFeatureAvailable(
        FeatureCategory.AUDIO_CONTEXT,
      );
      const effectsAvailable = gracefulDegradation.isFeatureAvailable(
        FeatureCategory.AUDIO_EFFECTS,
      );
      const visualizationAvailable = gracefulDegradation.isFeatureAvailable(
        FeatureCategory.VISUALIZATION,
      );

      // At least some features should be disabled after degradation
      const allAvailable =
        audioAvailable && effectsAvailable && visualizationAvailable;
      expect(allAvailable).toBe(false);
    });

    test('should track disabled features in state', async () => {
      const context = scenarios.audioFailureContext;

      await gracefulDegradation.applyDegradation(context);

      const state = gracefulDegradation.getState();
      expectValidDegradationState(state);
      expect(state.disabledFeatures.size).toBeGreaterThan(0);

      // Should contain audio-related features
      const disabledArray = Array.from(state.disabledFeatures);
      disabledArray.forEach((feature) => {
        expectValidFeatureCategory(feature);
      });
    });

    test('should provide accurate feature availability status', async () => {
      const context = scenarios.memoryPressureContext;

      await gracefulDegradation.applyDegradation(context);

      const state = gracefulDegradation.getState();

      // Verify feature availability matches disabled features
      Object.values(FeatureCategory).forEach((feature) => {
        const isAvailable = gracefulDegradation.isFeatureAvailable(feature);
        const isDisabled = state.disabledFeatures.has(feature);

        expect(isAvailable).toBe(!isDisabled);
      });
    });

    test('should handle feature queries for non-existent features gracefully', () => {
      const invalidFeature = 'non_existent_feature' as FeatureCategory;

      // Should not throw error for invalid feature
      expect(() => {
        gracefulDegradation.isFeatureAvailable(invalidFeature);
      }).not.toThrow();
    });
  });

  describe('Recovery Mechanism Behaviors', () => {
    test('should attempt recovery from degraded state', async () => {
      const context = scenarios.networkFailureContext;

      // Apply degradation first
      await gracefulDegradation.applyDegradation(context);

      const stateBeforeRecovery = gracefulDegradation.getState();
      expect(stateBeforeRecovery.currentLevel).not.toBe(DegradationLevel.NONE);

      // Attempt recovery
      const recoveryResult = await gracefulDegradation.attemptRecovery();

      expect(recoveryResult).toBe(true);

      const stateAfterRecovery = gracefulDegradation.getState();
      expectValidDegradationState(stateAfterRecovery);
      expect(stateAfterRecovery.currentLevel).toBe(DegradationLevel.NONE);
      expect(stateAfterRecovery.recoveryAttempts).toBeGreaterThan(0);
    });

    test('should handle recovery from already normal state', async () => {
      const initialState = gracefulDegradation.getState();
      expect(initialState.currentLevel).toBe(DegradationLevel.NONE);

      const recoveryResult = await gracefulDegradation.attemptRecovery();

      expect(recoveryResult).toBe(true);

      const finalState = gracefulDegradation.getState();
      expect(finalState.currentLevel).toBe(DegradationLevel.NONE);
    });

    test('should restore all features after successful recovery', async () => {
      const context = scenarios.audioFailureContext;

      // Apply degradation
      await gracefulDegradation.applyDegradation(context);

      // Verify some features are disabled
      const audioBeforeRecovery = gracefulDegradation.isFeatureAvailable(
        FeatureCategory.AUDIO_CONTEXT,
      );
      const effectsBeforeRecovery = gracefulDegradation.isFeatureAvailable(
        FeatureCategory.AUDIO_EFFECTS,
      );

      // At least one should be disabled
      const allEnabledBeforeRecovery =
        audioBeforeRecovery && effectsBeforeRecovery;
      expect(allEnabledBeforeRecovery).toBe(false);

      // Recover
      await gracefulDegradation.attemptRecovery();

      // Verify all features are restored
      const audioAfterRecovery = gracefulDegradation.isFeatureAvailable(
        FeatureCategory.AUDIO_CONTEXT,
      );
      const effectsAfterRecovery = gracefulDegradation.isFeatureAvailable(
        FeatureCategory.AUDIO_EFFECTS,
      );
      const pluginsAfterRecovery = gracefulDegradation.isFeatureAvailable(
        FeatureCategory.PLUGIN_SYSTEM,
      );

      expect(audioAfterRecovery).toBe(true);
      expect(effectsAfterRecovery).toBe(true);
      expect(pluginsAfterRecovery).toBe(true);
    });

    test('should track recovery attempts', async () => {
      const context = scenarios.systemFailureContext;

      await gracefulDegradation.applyDegradation(context);

      const initialState = gracefulDegradation.getState();
      expect(initialState.recoveryAttempts).toBe(0);

      // Attempt recovery multiple times
      await gracefulDegradation.attemptRecovery();
      await gracefulDegradation.attemptRecovery();

      const finalState = gracefulDegradation.getState();
      expect(finalState.recoveryAttempts).toBeGreaterThan(0);
    });

    test('should handle recovery failures gracefully', async () => {
      const context = scenarios.createDegradationContext(
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.CRITICAL,
        'critical',
        'balanced',
      );

      await gracefulDegradation.applyDegradation(context);

      const recoveryResult = await gracefulDegradation.attemptRecovery();

      // Should handle gracefully even if some rollbacks fail
      expect(typeof recoveryResult).toBe('boolean');

      const finalState = gracefulDegradation.getState();
      expectValidDegradationState(finalState);
    });
  });

  describe('User Communication Behaviors', () => {
    test('should provide meaningful user messages during degradation', async () => {
      const context = scenarios.networkFailureContext;

      await gracefulDegradation.applyDegradation(context);

      const userMessage = gracefulDegradation.getUserMessage();
      expect(typeof userMessage).toBe('string');
      expect(userMessage.length).toBeGreaterThan(0);
    });

    test('should update user message based on degradation level', async () => {
      const minimalContext = scenarios.createDegradationContext(
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.LOW,
        'midRange',
        'balanced',
      );

      const criticalContext = scenarios.createDegradationContext(
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.CRITICAL,
        'critical',
        'performanceFirst',
      );

      await gracefulDegradation.applyDegradation(minimalContext);
      const minimalMessage = gracefulDegradation.getUserMessage();

      await gracefulDegradation.reset();

      await gracefulDegradation.applyDegradation(criticalContext);
      const criticalMessage = gracefulDegradation.getUserMessage();

      // Messages should be different for different degradation levels
      expect(typeof minimalMessage).toBe('string');
      expect(typeof criticalMessage).toBe('string');
    });

    test('should clear user message after recovery', async () => {
      const context = scenarios.audioFailureContext;

      await gracefulDegradation.applyDegradation(context);

      const messageBeforeRecovery = gracefulDegradation.getUserMessage();
      expect(messageBeforeRecovery.length).toBeGreaterThan(0);

      await gracefulDegradation.attemptRecovery();

      const messageAfterRecovery = gracefulDegradation.getUserMessage();
      expect(messageAfterRecovery.length).toBe(0);
    });
  });

  describe('Event System Behaviors', () => {
    test('should emit degradation change events', async () => {
      const changeHandler = vi.fn();
      const unsubscribe = gracefulDegradation.on(
        'degradationChange',
        changeHandler,
      );

      const context = scenarios.networkFailureContext;
      await gracefulDegradation.applyDegradation(context);

      expect(changeHandler).toHaveBeenCalled();
      expect(changeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          currentLevel: expect.any(String),
          activeStrategies: expect.any(Array),
          disabledFeatures: expect.any(Set),
        }),
      );

      unsubscribe();
    });

    test('should support multiple event handlers', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      const unsubscribe1 = gracefulDegradation.on(
        'degradationChange',
        handler1,
      );
      const unsubscribe2 = gracefulDegradation.on(
        'degradationChange',
        handler2,
      );
      const unsubscribe3 = gracefulDegradation.on(
        'degradationChange',
        handler3,
      );

      const context = scenarios.audioFailureContext;
      await gracefulDegradation.applyDegradation(context);

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
      expect(handler3).toHaveBeenCalled();

      unsubscribe1();
      unsubscribe2();
      unsubscribe3();
    });

    test('should remove event handlers correctly', async () => {
      const handler = vi.fn();
      const unsubscribe = gracefulDegradation.on('degradationChange', handler);

      unsubscribe();

      const context = scenarios.memoryPressureContext;
      await gracefulDegradation.applyDegradation(context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('should emit events during recovery', async () => {
      const changeHandler = vi.fn();
      gracefulDegradation.on('degradationChange', changeHandler);

      const context = scenarios.systemFailureContext;
      await gracefulDegradation.applyDegradation(context);

      changeHandler.mockClear();

      await gracefulDegradation.attemptRecovery();

      expect(changeHandler).toHaveBeenCalled();
    });
  });

  describe('State Management Behaviors', () => {
    test('should update state timestamp on changes', async () => {
      const initialState = gracefulDegradation.getState();
      const initialTimestamp = initialState.lastUpdate;

      // Mock time advancement
      (Date.now as any).mockReturnValue(2000);

      const context = scenarios.networkFailureContext;
      await gracefulDegradation.applyDegradation(context);

      const updatedState = gracefulDegradation.getState();
      expect(updatedState.lastUpdate).toBeGreaterThan(initialTimestamp);
    });

    test('should maintain applied actions history', async () => {
      const context = scenarios.audioFailureContext;

      await gracefulDegradation.applyDegradation(context);

      const state = gracefulDegradation.getState();
      expectValidDegradationState(state);
      expect(state.appliedActions.length).toBeGreaterThan(0);

      state.appliedActions.forEach((action) => {
        expect(action).toBeDefined();
        expect(typeof action.type).toBe('string');
        expect(typeof action.target).toBe('string');
        expect(typeof action.description).toBe('string');
        expect(typeof action.implementation).toBe('function');
      });
    });

    test('should track active strategies', async () => {
      const context = scenarios.systemFailureContext;

      await gracefulDegradation.applyDegradation(context);

      const state = gracefulDegradation.getState();
      expectValidDegradationState(state);
      expect(state.activeStrategies.length).toBeGreaterThan(0);

      state.activeStrategies.forEach((strategy) => {
        expectValidDegradationStrategy(strategy);
      });
    });

    test('should reset state completely', async () => {
      const context = scenarios.offlineContext;

      await gracefulDegradation.applyDegradation(context);

      const stateBeforeReset = gracefulDegradation.getState();
      expect(stateBeforeReset.currentLevel).not.toBe(DegradationLevel.NONE);
      expect(stateBeforeReset.disabledFeatures.size).toBeGreaterThan(0);

      gracefulDegradation.reset();

      const stateAfterReset = gracefulDegradation.getState();
      expectValidDegradationState(stateAfterReset);
      expect(stateAfterReset.currentLevel).toBe(DegradationLevel.NONE);
      expect(stateAfterReset.activeStrategies).toHaveLength(0);
      expect(stateAfterReset.disabledFeatures.size).toBe(0);
      expect(stateAfterReset.appliedActions).toHaveLength(0);
      expect(stateAfterReset.recoveryAttempts).toBe(0);
    });
  });

  describe('Explicit Degradation Level Mapping Behaviors', () => {
    test('should map low severity errors to minimal degradation', async () => {
      const context = scenarios.createDegradationContext(
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.LOW,
        'midRange',
        'balanced',
        ['audio-effects'],
      );

      const result = await gracefulDegradation.applyDegradation(context);
      expect(result).toBe(true);

      const state = gracefulDegradation.getState();
      expect(state.currentLevel).toBe(DegradationLevel.MINIMAL);
    });

    test('should map medium severity errors to moderate degradation', async () => {
      const context = scenarios.createDegradationContext(
        ErrorCategory.AUDIO_CONTEXT,
        ErrorSeverity.MEDIUM,
        'midRange',
        'balanced',
        ['audio-context', 'audio-effects'],
      );

      const result = await gracefulDegradation.applyDegradation(context);
      expect(result).toBe(true);

      const state = gracefulDegradation.getState();
      expect(state.currentLevel).toBe(DegradationLevel.MODERATE);
    });

    test('should map high severity errors to severe degradation', async () => {
      const context = scenarios.createDegradationContext(
        ErrorCategory.RESOURCE,
        ErrorSeverity.HIGH,
        'lowEnd',
        'performanceFirst',
        ['memory', 'cpu', 'audio-context'],
      );

      const result = await gracefulDegradation.applyDegradation(context);
      expect(result).toBe(true);

      const state = gracefulDegradation.getState();
      expect(state.currentLevel).toBe(DegradationLevel.SEVERE);
    });

    test('should map critical severity errors to critical degradation', async () => {
      const context = scenarios.createDegradationContext(
        ErrorCategory.AUDIO_CONTEXT,
        ErrorSeverity.CRITICAL,
        'critical',
        'performanceFirst',
        ['audio-context', 'audio-effects', 'performance'],
      );

      const result = await gracefulDegradation.applyDegradation(context);
      expect(result).toBe(true);

      const state = gracefulDegradation.getState();
      expect(state.currentLevel).toBe(DegradationLevel.CRITICAL);
    });

    test('should handle validation errors with no degradation', async () => {
      const context = scenarios.createDegradationContext(
        ErrorCategory.VALIDATION,
        ErrorSeverity.LOW,
        'highEnd',
        'qualityFirst',
        [],
      );

      const result = await gracefulDegradation.applyDegradation(context);
      expect(result).toBe(true);

      const state = gracefulDegradation.getState();
      expect(state.currentLevel).toBe(DegradationLevel.NONE);
    });
  });

  describe('Feature Disabling Precision Behaviors', () => {
    test('should disable only audio effects in minimal degradation', async () => {
      const context = scenarios.createDegradationContext(
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.LOW,
        'midRange',
        'balanced',
        ['audio-effects'],
      );

      await gracefulDegradation.applyDegradation(context);

      expect(
        gracefulDegradation.isFeatureAvailable(FeatureCategory.AUDIO_CONTEXT),
      ).toBe(true);
      expect(
        gracefulDegradation.isFeatureAvailable(FeatureCategory.AUDIO_EFFECTS),
      ).toBe(false);
      expect(
        gracefulDegradation.isFeatureAvailable(
          FeatureCategory.PERFORMANCE_MONITORING,
        ),
      ).toBe(true);
    });

    test('should disable multiple features in moderate degradation', async () => {
      const context = scenarios.createDegradationContext(
        ErrorCategory.AUDIO_CONTEXT,
        ErrorSeverity.MEDIUM,
        'midRange',
        'balanced',
        ['audio-context', 'visualization'],
      );

      await gracefulDegradation.applyDegradation(context);

      // Check that some features are disabled (specific features may vary based on implementation)
      const audioEffectsAvailable = gracefulDegradation.isFeatureAvailable(
        FeatureCategory.AUDIO_EFFECTS,
      );
      const visualizationAvailable = gracefulDegradation.isFeatureAvailable(
        FeatureCategory.VISUALIZATION,
      );
      const performanceMonitoringAvailable =
        gracefulDegradation.isFeatureAvailable(
          FeatureCategory.PERFORMANCE_MONITORING,
        );

      // At least some features should be disabled
      const allFeaturesEnabled =
        audioEffectsAvailable &&
        visualizationAvailable &&
        performanceMonitoringAvailable;
      expect(allFeaturesEnabled).toBe(false);
    });

    test('should disable most features in severe degradation while keeping core', async () => {
      const context = scenarios.createDegradationContext(
        ErrorCategory.RESOURCE,
        ErrorSeverity.HIGH,
        'lowEnd',
        'performanceFirst',
        ['memory', 'cpu'],
      );

      await gracefulDegradation.applyDegradation(context);

      expect(
        gracefulDegradation.isFeatureAvailable(FeatureCategory.AUDIO_CONTEXT),
      ).toBe(true); // Core feature should remain
      expect(
        gracefulDegradation.isFeatureAvailable(FeatureCategory.AUDIO_EFFECTS),
      ).toBe(false);
      expect(
        gracefulDegradation.isFeatureAvailable(FeatureCategory.VISUALIZATION),
      ).toBe(false);
      expect(
        gracefulDegradation.isFeatureAvailable(FeatureCategory.PLUGIN_SYSTEM),
      ).toBe(false);
    });
  });

  describe('State Transition Logic Behaviors', () => {
    test('should not degrade when already at higher level', async () => {
      // First apply severe degradation
      const severeContext = scenarios.createDegradationContext(
        ErrorCategory.RESOURCE,
        ErrorSeverity.HIGH,
        'lowEnd',
        'performanceFirst',
        ['memory', 'cpu'],
      );

      await gracefulDegradation.applyDegradation(severeContext);
      const firstState = gracefulDegradation.getState();
      expect(firstState.currentLevel).toBe(DegradationLevel.SEVERE);

      // Then try to apply minimal degradation
      const minimalContext = scenarios.createDegradationContext(
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.LOW,
        'lowEnd',
        'performanceFirst',
        ['audio-effects'],
        firstState.currentLevel,
      );

      await gracefulDegradation.applyDegradation(minimalContext);

      // Should remain at severe level or higher (implementation dependent)
      const finalState = gracefulDegradation.getState();
      const levelOrder = [
        DegradationLevel.NONE,
        DegradationLevel.MINIMAL,
        DegradationLevel.MODERATE,
        DegradationLevel.SEVERE,
        DegradationLevel.CRITICAL,
      ];
      const firstIndex = levelOrder.indexOf(firstState.currentLevel);
      const finalIndex = levelOrder.indexOf(finalState.currentLevel);
      expect(finalIndex).toBeGreaterThanOrEqual(firstIndex);
    });

    test('should allow upgrading degradation level', async () => {
      // First apply minimal degradation
      const minimalContext = scenarios.createDegradationContext(
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.LOW,
        'midRange',
        'balanced',
        ['audio-effects'],
      );

      await gracefulDegradation.applyDegradation(minimalContext);
      expect(gracefulDegradation.getState().currentLevel).toBe(
        DegradationLevel.MINIMAL,
      );

      // Then apply moderate degradation
      const moderateContext = scenarios.createDegradationContext(
        ErrorCategory.AUDIO_CONTEXT,
        ErrorSeverity.MEDIUM,
        'midRange',
        'balanced',
        ['audio-context', 'audio-effects'],
        DegradationLevel.MINIMAL,
      );

      await gracefulDegradation.applyDegradation(moderateContext);

      // Should upgrade to moderate level
      expect(gracefulDegradation.getState().currentLevel).toBe(
        DegradationLevel.MODERATE,
      );
    });
  });

  describe('Recovery Tracking Behaviors', () => {
    test('should track recovery attempts correctly', async () => {
      const context = scenarios.networkFailureContext;

      await gracefulDegradation.applyDegradation(context);

      const initialState = gracefulDegradation.getState();
      const initialAttempts = initialState.recoveryAttempts;

      await gracefulDegradation.attemptRecovery();

      const finalState = gracefulDegradation.getState();
      expect(finalState.recoveryAttempts).toBe(initialAttempts + 1);
    });

    test('should increment recovery attempts on multiple recovery calls', async () => {
      const context = scenarios.audioFailureContext;

      await gracefulDegradation.applyDegradation(context);

      const initialState = gracefulDegradation.getState();
      expect(initialState.recoveryAttempts).toBe(0);

      // Attempt recovery - first call
      await gracefulDegradation.attemptRecovery();
      const firstRecoveryState = gracefulDegradation.getState();
      expect(firstRecoveryState.recoveryAttempts).toBeGreaterThan(0);

      // If already recovered, apply degradation again for second recovery test
      if (firstRecoveryState.currentLevel === DegradationLevel.NONE) {
        await gracefulDegradation.applyDegradation(context);
      }

      // Attempt recovery - second call
      await gracefulDegradation.attemptRecovery();
      const finalState = gracefulDegradation.getState();
      expect(finalState.recoveryAttempts).toBeGreaterThan(
        initialState.recoveryAttempts,
      );
    });
  });

  describe('Event System Reliability Behaviors', () => {
    test('should remove event handlers when unsubscribed', async () => {
      const handler = vi.fn();
      const unsubscribe = gracefulDegradation.on('degradationChange', handler);
      unsubscribe();

      const context = scenarios.networkFailureContext;
      await gracefulDegradation.applyDegradation(context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('should handle multiple handlers and selective unsubscription', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      const unsubscribe1 = gracefulDegradation.on(
        'degradationChange',
        handler1,
      );
      const unsubscribe2 = gracefulDegradation.on(
        'degradationChange',
        handler2,
      );
      const unsubscribe3 = gracefulDegradation.on(
        'degradationChange',
        handler3,
      );

      // Unsubscribe only handler2
      unsubscribe2();

      const context = scenarios.audioFailureContext;
      await gracefulDegradation.applyDegradation(context);

      expect(handler1).toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
      expect(handler3).toHaveBeenCalled();

      unsubscribe1();
      unsubscribe3();
    });
  });

  describe('Edge Case Handling Behaviors', () => {
    test('should handle empty affected systems gracefully', async () => {
      const context = scenarios.createDegradationContext(
        ErrorCategory.UNKNOWN,
        ErrorSeverity.MEDIUM,
        'midRange',
        'balanced',
        [], // Empty affected systems
      );

      const result = await gracefulDegradation.applyDegradation(context);
      expect(result).toBe(true);

      const state = gracefulDegradation.getState();
      expectValidDegradationState(state);
    });

    test('should handle degradation action failures gracefully', async () => {
      // This test verifies the system doesn't crash when actions fail
      const context = scenarios.createDegradationContext(
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.MEDIUM,
        'midRange',
        'balanced',
        ['audio-effects'],
      );

      // Should not throw error even if some actions fail internally
      const result = await gracefulDegradation.applyDegradation(context);
      expect(typeof result).toBe('boolean');

      const state = gracefulDegradation.getState();
      expectValidDegradationState(state);
    });

    test('should handle non-existent feature queries gracefully', () => {
      const invalidFeature = 'non_existent_feature' as FeatureCategory;

      expect(() => {
        gracefulDegradation.isFeatureAvailable(invalidFeature);
      }).not.toThrow();
    });
  });

  describe('User Message Quality Behaviors', () => {
    test('should provide meaningful user messages with specific content', async () => {
      const context = scenarios.createDegradationContext(
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.MEDIUM,
        'midRange',
        'balanced',
        ['audio-effects'],
      );

      await gracefulDegradation.applyDegradation(context);

      const message = gracefulDegradation.getUserMessage();
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
      expect(message.toLowerCase()).toContain('reduced');
    });

    test('should provide empty message when not degraded', () => {
      const message = gracefulDegradation.getUserMessage();
      expect(message).toBe('');
    });

    test('should update message content based on degradation severity', async () => {
      const minimalContext = scenarios.createDegradationContext(
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.LOW,
        'midRange',
        'balanced',
        ['audio-effects'],
      );

      const criticalContext = scenarios.createDegradationContext(
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.CRITICAL,
        'critical',
        'performanceFirst',
        ['core', 'audio', 'memory'],
      );

      await gracefulDegradation.applyDegradation(minimalContext);
      const minimalMessage = gracefulDegradation.getUserMessage();

      await gracefulDegradation.reset();

      await gracefulDegradation.applyDegradation(criticalContext);
      const criticalMessage = gracefulDegradation.getUserMessage();

      expect(typeof minimalMessage).toBe('string');
      expect(typeof criticalMessage).toBe('string');
      expect(minimalMessage.length).toBeGreaterThan(0);
      expect(criticalMessage.length).toBeGreaterThan(0);
    });
  });

  describe('State Consistency Behaviors', () => {
    test('should maintain consistency between feature availability and disabled features', async () => {
      const context = scenarios.systemFailureContext;

      await gracefulDegradation.applyDegradation(context);

      const state = gracefulDegradation.getState();

      // Verify feature availability matches disabled features
      Object.values(FeatureCategory).forEach((feature) => {
        const isAvailable = gracefulDegradation.isFeatureAvailable(feature);
        const isDisabled = state.disabledFeatures.has(feature);

        expect(isAvailable).toBe(!isDisabled);
      });
    });

    test('should update state timestamp on changes', async () => {
      const initialState = gracefulDegradation.getState();
      const initialTimestamp = initialState.lastUpdate;

      // Mock time advancement
      (Date.now as any).mockReturnValue(2000);

      const context = scenarios.networkFailureContext;
      await gracefulDegradation.applyDegradation(context);

      const updatedState = gracefulDegradation.getState();
      expect(updatedState.lastUpdate).toBeGreaterThan(initialTimestamp);
    });

    test('should maintain applied actions history integrity', async () => {
      const context = scenarios.audioFailureContext;

      await gracefulDegradation.applyDegradation(context);

      const state = gracefulDegradation.getState();
      expectValidDegradationState(state);

      state.appliedActions.forEach((action) => {
        expect(action).toBeDefined();
        expect(typeof action.type).toBe('string');
        expect(typeof action.target).toBe('string');
        expect(typeof action.description).toBe('string');
        expect(typeof action.implementation).toBe('function');
      });
    });
  });

  describe('Real-World Degradation Scenarios', () => {
    test('should handle progressive degradation under increasing stress', async () => {
      // Start with minor performance issue
      const minorContext = scenarios.createDegradationContext(
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.LOW,
        'midRange',
        'balanced',
      );

      await gracefulDegradation.applyDegradation(minorContext);
      const firstState = gracefulDegradation.getState();

      // Escalate to memory pressure
      const memoryContext = scenarios.createDegradationContext(
        ErrorCategory.RESOURCE,
        ErrorSeverity.MEDIUM,
        'lowEnd',
        'performanceFirst',
        ['memory'],
        firstState.currentLevel,
      );

      await gracefulDegradation.applyDegradation(memoryContext);
      const secondState = gracefulDegradation.getState();

      // Further escalate to system failure
      const systemContext = scenarios.createDegradationContext(
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.HIGH,
        'critical',
        'performanceFirst',
        ['core', 'memory'],
        secondState.currentLevel,
      );

      await gracefulDegradation.applyDegradation(systemContext);
      const finalState = gracefulDegradation.getState();

      expectValidDegradationState(finalState);

      // Should show progression toward more severe degradation
      const levelOrder = [
        DegradationLevel.NONE,
        DegradationLevel.MINIMAL,
        DegradationLevel.MODERATE,
        DegradationLevel.SEVERE,
        DegradationLevel.CRITICAL,
      ];
      const firstIndex = levelOrder.indexOf(firstState.currentLevel);
      const finalIndex = levelOrder.indexOf(finalState.currentLevel);

      expect(finalIndex).toBeGreaterThanOrEqual(firstIndex);
    });

    test('should handle mobile device battery optimization', async () => {
      const batteryContext = scenarios.createDegradationContext(
        ErrorCategory.RESOURCE,
        ErrorSeverity.HIGH,
        'critical', // Low battery
        'performanceFirst',
        ['battery', 'power'],
      );

      const result = await gracefulDegradation.applyDegradation(batteryContext);

      expect(result).toBe(true);
      const state = gracefulDegradation.getState();
      expectValidDegradationState(state);

      // Should disable power-hungry features
      const visualizationAvailable = gracefulDegradation.isFeatureAvailable(
        FeatureCategory.VISUALIZATION,
      );
      const backgroundProcessingAvailable =
        gracefulDegradation.isFeatureAvailable(
          FeatureCategory.BACKGROUND_PROCESSING,
        );

      expect(visualizationAvailable || backgroundProcessingAvailable).toBe(
        false,
      );
    });

    test('should handle network connectivity loss gracefully', async () => {
      const connectivityLossContext = scenarios.createDegradationContext(
        ErrorCategory.NETWORK,
        ErrorSeverity.CRITICAL,
        'offline',
        'balanced',
        ['network', 'api', 'cdn'],
      );

      const result = await gracefulDegradation.applyDegradation(
        connectivityLossContext,
      );

      expect(result).toBe(true);
      const state = gracefulDegradation.getState();
      expectValidDegradationState(state);

      // Should enable offline mode features
      expect(state.currentLevel).toBe(DegradationLevel.CRITICAL);

      // Network features should be disabled
      const networkFeaturesAvailable = gracefulDegradation.isFeatureAvailable(
        FeatureCategory.NETWORK_FEATURES,
      );
      expect(networkFeaturesAvailable).toBe(false);
    });

    test('should handle audio context suspension in mobile browsers', async () => {
      const audioSuspensionContext = scenarios.createDegradationContext(
        ErrorCategory.AUDIO_CONTEXT,
        ErrorSeverity.CRITICAL,
        'lowEnd',
        'balanced',
        ['audioContext', 'webAudio'],
      );

      const result = await gracefulDegradation.applyDegradation(
        audioSuspensionContext,
      );

      expect(result).toBe(true);
      const state = gracefulDegradation.getState();
      expectValidDegradationState(state);

      // Audio-related features should be affected
      const audioContextAvailable = gracefulDegradation.isFeatureAvailable(
        FeatureCategory.AUDIO_CONTEXT,
      );
      const audioEffectsAvailable = gracefulDegradation.isFeatureAvailable(
        FeatureCategory.AUDIO_EFFECTS,
      );

      expect(audioContextAvailable || audioEffectsAvailable).toBe(false);
    });

    test('should coordinate with user preferences for optimal experience', async () => {
      const qualityFirstUserContext = scenarios.createDegradationContext(
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.MEDIUM,
        'highEnd',
        'qualityFirst',
        ['processing'],
      );

      const performanceFirstUserContext = scenarios.createDegradationContext(
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.MEDIUM,
        'highEnd',
        'performanceFirst',
        ['processing'],
      );

      // Test quality-first user
      await gracefulDegradation.applyDegradation(qualityFirstUserContext);
      const qualityFirstState = gracefulDegradation.getState();

      await gracefulDegradation.reset();

      // Test performance-first user
      await gracefulDegradation.applyDegradation(performanceFirstUserContext);
      const performanceFirstState = gracefulDegradation.getState();

      expectValidDegradationState(qualityFirstState);
      expectValidDegradationState(performanceFirstState);

      // Performance-first users should get more aggressive degradation
      const levelOrder = [
        DegradationLevel.NONE,
        DegradationLevel.MINIMAL,
        DegradationLevel.MODERATE,
        DegradationLevel.SEVERE,
        DegradationLevel.CRITICAL,
      ];
      const qualityIndex = levelOrder.indexOf(qualityFirstState.currentLevel);
      const performanceIndex = levelOrder.indexOf(
        performanceFirstState.currentLevel,
      );

      expect(performanceIndex).toBeGreaterThanOrEqual(qualityIndex);
    });

    test('should handle recovery after service restoration', async () => {
      // Simulate service outage
      const outageContext = scenarios.createDegradationContext(
        ErrorCategory.PERFORMANCE,
        ErrorSeverity.CRITICAL,
        'midRange',
        'balanced',
        ['api', 'database'],
      );

      await gracefulDegradation.applyDegradation(outageContext);

      const degradedState = gracefulDegradation.getState();
      expect(degradedState.currentLevel).not.toBe(DegradationLevel.NONE);

      // Simulate service restoration
      const recoveryResult = await gracefulDegradation.attemptRecovery();

      expect(recoveryResult).toBe(true);

      const recoveredState = gracefulDegradation.getState();
      expectValidDegradationState(recoveredState);
      expect(recoveredState.currentLevel).toBe(DegradationLevel.NONE);

      // All features should be available again
      Object.values(FeatureCategory).forEach((feature) => {
        const isAvailable = gracefulDegradation.isFeatureAvailable(feature);
        expect(isAvailable).toBe(true);
      });
    });
  });
});
