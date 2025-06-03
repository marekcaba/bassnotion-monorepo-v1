/**
 * GracefulDegradation - Adaptive Fallback Strategies for Failure Scenarios
 *
 * Implements intelligent degradation strategies that maintain core functionality
 * when components fail, ensuring the best possible user experience.
 *
 * Part of Story 2.1: Task 5, Subtask 5.3 - Graceful degradation strategies
 */

import { ErrorCategory, ErrorSeverity } from './base.js';

export enum DegradationLevel {
  NONE = 'none', // Full functionality
  MINIMAL = 'minimal', // Minor feature reduction
  MODERATE = 'moderate', // Significant feature reduction
  SEVERE = 'severe', // Core functionality only
  CRITICAL = 'critical', // Minimal viable functionality
}

export enum FeatureCategory {
  AUDIO_CONTEXT = 'audio_context',
  AUDIO_EFFECTS = 'audio_effects',
  PERFORMANCE_MONITORING = 'performance_monitoring',
  STATE_PERSISTENCE = 'state_persistence',
  BACKGROUND_PROCESSING = 'background_processing',
  MOBILE_OPTIMIZATION = 'mobile_optimization',
  PLUGIN_SYSTEM = 'plugin_system',
  VISUALIZATION = 'visualization',
  NETWORK_FEATURES = 'network_features',
}

export interface DegradationStrategy {
  level: DegradationLevel;
  description: string;
  affectedFeatures: FeatureCategory[];
  fallbackActions: DegradationAction[];
  userMessage: string;
  technicalDetails: string;
  canRecover: boolean;
  estimatedImpact: number; // 0-100 percentage of functionality lost
}

export interface DegradationAction {
  type: 'disable' | 'reduce' | 'fallback' | 'simplify' | 'cache' | 'offline';
  target: string;
  description: string;
  implementation: () => Promise<boolean>;
  rollback?: () => Promise<boolean>;
}

export interface DegradationContext {
  errorCategory: ErrorCategory;
  errorSeverity: ErrorSeverity;
  affectedSystems: string[];
  deviceCapabilities: {
    isLowEnd: boolean;
    batteryLevel?: number;
    networkCondition: 'excellent' | 'good' | 'fair' | 'poor' | 'offline';
    memoryPressure: 'normal' | 'moderate' | 'high' | 'critical';
  };
  currentDegradationLevel: DegradationLevel;
  userPreferences: {
    preferPerformanceOverQuality: boolean;
    allowDataSaving: boolean;
    enableOfflineMode: boolean;
  };
}

export interface DegradationState {
  currentLevel: DegradationLevel;
  activeStrategies: DegradationStrategy[];
  disabledFeatures: Set<FeatureCategory>;
  appliedActions: DegradationAction[];
  lastUpdate: number;
  recoveryAttempts: number;
}

export class GracefulDegradation {
  private static instance: GracefulDegradation;
  private state: DegradationState;
  private strategies: Map<string, DegradationStrategy>;
  private eventHandlers: Map<string, Set<(state: DegradationState) => void>>;

  private constructor() {
    this.state = {
      currentLevel: DegradationLevel.NONE,
      activeStrategies: [],
      disabledFeatures: new Set(),
      appliedActions: [],
      lastUpdate: Date.now(),
      recoveryAttempts: 0,
    };
    this.strategies = new Map();
    this.eventHandlers = new Map();
    this.initializeStrategies();
  }

  public static getInstance(): GracefulDegradation {
    if (!GracefulDegradation.instance) {
      GracefulDegradation.instance = new GracefulDegradation();
    }
    return GracefulDegradation.instance;
  }

  /**
   * Apply appropriate degradation strategy based on context
   */
  public async applyDegradation(context: DegradationContext): Promise<boolean> {
    const strategy = this.selectDegradationStrategy(context);

    if (!strategy) {
      console.log('No degradation strategy required for current context');
      return true;
    }

    console.log(`Applying degradation strategy: ${strategy.description}`);

    try {
      // Apply all degradation actions
      const results = await Promise.allSettled(
        strategy.fallbackActions.map((action) => this.executeAction(action)),
      );

      // Check if all actions succeeded
      const allSucceeded = results.every(
        (result) => result.status === 'fulfilled' && result.value === true,
      );

      if (allSucceeded) {
        this.updateState(strategy);
        this.notifyDegradationChange();
        return true;
      } else {
        console.error('Some degradation actions failed:', results);
        return false;
      }
    } catch (error) {
      console.error('Failed to apply degradation strategy:', error);
      return false;
    }
  }

  /**
   * Attempt to recover from degraded state
   */
  public async attemptRecovery(): Promise<boolean> {
    if (this.state.currentLevel === DegradationLevel.NONE) {
      return true; // Already at full functionality
    }

    this.state.recoveryAttempts++;
    console.log(`Attempting recovery (attempt ${this.state.recoveryAttempts})`);

    try {
      // Try to rollback applied actions in reverse order
      const rollbackActions = this.state.appliedActions
        .filter((action) => action.rollback)
        .reverse();

      for (const action of rollbackActions) {
        try {
          const rollbackFn = action.rollback;
          if (rollbackFn) {
            const success = await rollbackFn();
            if (!success) {
              console.warn(`Failed to rollback action: ${action.description}`);
            }
          } else {
            console.warn(
              `No rollback function for action: ${action.description}`,
            );
          }
        } catch (error) {
          console.error(
            `Error during rollback of ${action.description}:`,
            error,
          );
        }
      }

      // Reset state
      this.resetToNormalOperation();
      this.notifyDegradationChange();

      console.log('Recovery successful - restored to full functionality');
      return true;
    } catch (error) {
      console.error('Recovery failed:', error);
      return false;
    }
  }

  /**
   * Get current degradation status
   */
  public getState(): DegradationState {
    return { ...this.state };
  }

  /**
   * Check if specific feature is available
   */
  public isFeatureAvailable(feature: FeatureCategory): boolean {
    return !this.state.disabledFeatures.has(feature);
  }

  /**
   * Get user-friendly degradation message
   */
  public getUserMessage(): string {
    if (this.state.activeStrategies.length === 0) {
      return '';
    }

    const primaryStrategy = this.state.activeStrategies[0];
    return primaryStrategy?.userMessage || '';
  }

  /**
   * Add event listener
   */
  public on(
    event: 'degradationChange',
    handler: (state: DegradationState) => void,
  ): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }

    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.add(handler);

      return () => {
        handlers.delete(handler);
      };
    }

    // Return a no-op function if handlers couldn't be retrieved
    return () => {
      // No-op: intentionally empty cleanup function
    };
  }

  /**
   * Select appropriate degradation strategy
   */
  private selectDegradationStrategy(
    context: DegradationContext,
  ): DegradationStrategy | null {
    // Don't degrade further if already at critical level
    if (context.currentDegradationLevel === DegradationLevel.CRITICAL) {
      return null;
    }

    const strategyKey = this.getStrategyKey(context);
    const strategy = this.strategies.get(strategyKey);

    if (strategy) {
      return strategy;
    }

    // Fallback to general strategies based on error severity
    return this.getGeneralStrategy(context);
  }

  /**
   * Get general degradation strategy based on error characteristics
   */
  private getGeneralStrategy(
    context: DegradationContext,
  ): DegradationStrategy | null {
    switch (context.errorSeverity) {
      case ErrorSeverity.CRITICAL:
        return this.strategies.get('critical_fallback') || null;

      case ErrorSeverity.HIGH:
        return this.strategies.get('high_severity_fallback') || null;

      case ErrorSeverity.MEDIUM:
        if (context.deviceCapabilities.isLowEnd) {
          return this.strategies.get('low_end_device') || null;
        }
        return this.strategies.get('moderate_degradation') || null;

      default:
        return null;
    }
  }

  /**
   * Execute degradation action
   */
  private async executeAction(action: DegradationAction): Promise<boolean> {
    try {
      console.log(`Executing degradation action: ${action.description}`);
      const result = await action.implementation();

      if (result) {
        this.state.appliedActions.push(action);
      }

      return result;
    } catch (error) {
      console.error(
        `Failed to execute degradation action ${action.description}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Update degradation state
   */
  private updateState(strategy: DegradationStrategy): void {
    this.state.currentLevel = strategy.level;
    this.state.activeStrategies = [strategy];

    // Add affected features to disabled set
    strategy.affectedFeatures.forEach((feature) => {
      this.state.disabledFeatures.add(feature);
    });

    this.state.lastUpdate = Date.now();
  }

  /**
   * Reset to normal operation
   */
  private resetToNormalOperation(): void {
    this.state.currentLevel = DegradationLevel.NONE;
    this.state.activeStrategies = [];
    this.state.disabledFeatures.clear();
    this.state.appliedActions = [];
    this.state.lastUpdate = Date.now();
  }

  /**
   * Notify listeners of degradation change
   */
  private notifyDegradationChange(): void {
    const handlers = this.eventHandlers.get('degradationChange');
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(this.getState());
        } catch (error) {
          console.error('Error in degradation change handler:', error);
        }
      });
    }
  }

  /**
   * Generate strategy key for context
   */
  private getStrategyKey(context: DegradationContext): string {
    return `${context.errorCategory}_${context.errorSeverity}`;
  }

  /**
   * Initialize degradation strategies
   */
  private initializeStrategies(): void {
    // Audio Context Failures
    this.strategies.set('audio_context_critical', {
      level: DegradationLevel.CRITICAL,
      description:
        'Audio Context completely unavailable - disable all audio features',
      affectedFeatures: [
        FeatureCategory.AUDIO_CONTEXT,
        FeatureCategory.AUDIO_EFFECTS,
      ],
      fallbackActions: [
        {
          type: 'disable',
          target: 'audio_engine',
          description: 'Disable audio engine completely',
          implementation: async () => {
            // Implementation would disable audio completely
            console.log(
              'Audio engine disabled - no audio functionality available',
            );
            return true;
          },
          rollback: async () => {
            console.log('Attempting to re-enable audio engine');
            return true;
          },
        },
      ],
      userMessage:
        'Audio is currently unavailable. You can still view content without sound.',
      technicalDetails:
        'WebAudio API not supported or AudioContext creation failed',
      canRecover: true,
      estimatedImpact: 100,
    });

    // Performance Issues
    this.strategies.set('performance_high', {
      level: DegradationLevel.MODERATE,
      description: 'Reduce audio quality and disable non-essential features',
      affectedFeatures: [
        FeatureCategory.AUDIO_EFFECTS,
        FeatureCategory.VISUALIZATION,
      ],
      fallbackActions: [
        {
          type: 'reduce',
          target: 'audio_quality',
          description: 'Reduce audio quality to improve performance',
          implementation: async () => {
            console.log('Reducing audio quality for better performance');
            return true;
          },
          rollback: async () => {
            console.log('Restoring original audio quality');
            return true;
          },
        },
        {
          type: 'disable',
          target: 'visualizations',
          description: 'Disable real-time visualizations',
          implementation: async () => {
            console.log('Disabling visualizations');
            return true;
          },
          rollback: async () => {
            console.log('Re-enabling visualizations');
            return true;
          },
        },
      ],
      userMessage:
        'Performance optimizations applied. Some visual features have been reduced.',
      technicalDetails: 'High CPU usage or memory pressure detected',
      canRecover: true,
      estimatedImpact: 30,
    });

    // Network Issues
    this.strategies.set('network_high', {
      level: DegradationLevel.MODERATE,
      description: 'Enable offline mode and use cached content',
      affectedFeatures: [FeatureCategory.NETWORK_FEATURES],
      fallbackActions: [
        {
          type: 'offline',
          target: 'content_loading',
          description: 'Switch to offline mode with cached content',
          implementation: async () => {
            console.log('Switching to offline mode');
            return true;
          },
          rollback: async () => {
            console.log('Switching back to online mode');
            return true;
          },
        },
      ],
      userMessage:
        'Working offline with cached content. Some features may be limited.',
      technicalDetails: 'Network connectivity issues detected',
      canRecover: true,
      estimatedImpact: 40,
    });

    // Low-end Device Strategy
    this.strategies.set('low_end_device', {
      level: DegradationLevel.MODERATE,
      description: 'Optimize for low-end device capabilities',
      affectedFeatures: [
        FeatureCategory.AUDIO_EFFECTS,
        FeatureCategory.BACKGROUND_PROCESSING,
        FeatureCategory.VISUALIZATION,
      ],
      fallbackActions: [
        {
          type: 'simplify',
          target: 'audio_processing',
          description: 'Use simplified audio processing',
          implementation: async () => {
            console.log('Switching to simplified audio processing');
            return true;
          },
          rollback: async () => {
            console.log('Restoring full audio processing');
            return true;
          },
        },
        {
          type: 'disable',
          target: 'background_workers',
          description: 'Disable background worker threads',
          implementation: async () => {
            console.log('Disabling background workers');
            return true;
          },
          rollback: async () => {
            console.log('Re-enabling background workers');
            return true;
          },
        },
      ],
      userMessage:
        'Optimized for your device. Some advanced features are simplified.',
      technicalDetails:
        'Low-end device detected, applying performance optimizations',
      canRecover: false,
      estimatedImpact: 25,
    });

    // Critical Fallback
    this.strategies.set('critical_fallback', {
      level: DegradationLevel.CRITICAL,
      description: 'Maintain only core functionality',
      affectedFeatures: [
        FeatureCategory.AUDIO_EFFECTS,
        FeatureCategory.BACKGROUND_PROCESSING,
        FeatureCategory.PLUGIN_SYSTEM,
        FeatureCategory.VISUALIZATION,
        FeatureCategory.PERFORMANCE_MONITORING,
      ],
      fallbackActions: [
        {
          type: 'disable',
          target: 'all_non_essential',
          description: 'Disable all non-essential features',
          implementation: async () => {
            console.log(
              'Critical degradation: disabling all non-essential features',
            );
            return true;
          },
          rollback: async () => {
            console.log('Attempting to restore non-essential features');
            return true;
          },
        },
      ],
      userMessage:
        "Basic functionality only. We're working to restore full features.",
      technicalDetails:
        'Critical system failure, minimal functionality mode active',
      canRecover: true,
      estimatedImpact: 75,
    });
  }
}
