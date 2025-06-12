/**
 * MobileError Behavioral Tests
 * Tests for mobile device constraint error handling
 * Part of Story 2.1: Task 1, Subtask 1.3
 */

import { describe, it, expect } from 'vitest';
import {
  MobileError,
  MobileErrorCode,
  createMobileError,
} from '../../errors/MobileError.js';
import {
  ErrorSeverity,
  ErrorCategory,
  ErrorContext,
} from '../../errors/base.js';

describe('MobileError Behavioral Tests', () => {
  // ================================
  // Error Creation Behaviors
  // ================================
  describe('Error Creation Behaviors', () => {
    it('should create mobile errors with correct properties', () => {
      const error = new MobileError(
        MobileErrorCode.BATTERY_LOW,
        'Battery level is critically low',
      );

      expect(error.name).toBe('MobileError');
      expect(error.code).toBe(MobileErrorCode.BATTERY_LOW);
      expect(error.category).toBe(ErrorCategory.MOBILE);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.message).toBe('Battery level is critically low');
    });

    it('should include mobile optimization recovery action', () => {
      const error = new MobileError(
        MobileErrorCode.MEMORY_CONSTRAINT,
        'Mobile memory constraint detected',
      );

      const recoveryActions = error.getAutomaticRecoveries();
      expect(recoveryActions).toHaveLength(1);
      expect(recoveryActions[0]!.type).toBe('degrade');
      expect(recoveryActions[0]!.description).toBe(
        'Enable mobile optimization mode',
      );
      expect(recoveryActions[0]!.automatic).toBe(true);
      expect(recoveryActions[0]!.priority).toBe(8);
    });

    it('should provide appropriate user messages', () => {
      const error = new MobileError(
        MobileErrorCode.AUDIO_INTERRUPTION,
        'Audio session interrupted',
      );

      expect(error.getUserMessage()).toBe(
        'Mobile device limitation detected. Performance may be optimized.',
      );
    });

    it('should provide technical messages with error codes', () => {
      const error = new MobileError(
        MobileErrorCode.BACKGROUND_RESTRICTION,
        'Background audio restricted',
      );

      expect(error.getTechnicalMessage()).toBe(
        'MOBILE_BACKGROUND_RESTRICTION: Background audio restricted',
      );
    });
  });

  // ================================
  // Mobile Error Code Behaviors
  // ================================
  describe('Mobile Error Code Behaviors', () => {
    it('should handle battery low errors appropriately', () => {
      const error = new MobileError(
        MobileErrorCode.BATTERY_LOW,
        'Battery at 5%, entering power saving mode',
        {
          deviceInfo: {
            platform: 'ios',
            isMobile: true,
            hasLowLatencySupport: false,
            browserVersion: '15.0',
          },
          performanceMetrics: {
            latency: 120,
            cpuUsage: 45,
            memoryUsage: 300,
          },
        },
      );

      expect(error.code).toBe(MobileErrorCode.BATTERY_LOW);
      expect(error.context.deviceInfo?.isMobile).toBe(true);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
    });

    it('should handle background restriction errors', () => {
      const error = new MobileError(
        MobileErrorCode.BACKGROUND_RESTRICTION,
        'Audio playback restricted in background',
        {
          currentOperation: 'Background audio playback',
          engineState: 'suspended',
        },
      );

      expect(error.code).toBe(MobileErrorCode.BACKGROUND_RESTRICTION);
      expect(error.context.currentOperation).toBe('Background audio playback');
      expect(error.context.engineState).toBe('suspended');
    });

    it('should handle memory constraint errors', () => {
      const error = new MobileError(
        MobileErrorCode.MEMORY_CONSTRAINT,
        'Insufficient memory for high-quality audio',
        {
          performanceMetrics: {
            memoryUsage: 450,
            requestedSize: 128 * 1024 * 1024,
            availableSize: 64 * 1024 * 1024,
            utilizationPercentage: 92,
            latency: 80,
            cpuUsage: 70,
          },
        },
      );

      expect(error.code).toBe(MobileErrorCode.MEMORY_CONSTRAINT);
      expect(error.context.performanceMetrics?.utilizationPercentage).toBe(92);
    });

    it('should handle audio interruption errors', () => {
      const error = new MobileError(
        MobileErrorCode.AUDIO_INTERRUPTION,
        'Audio interrupted by phone call',
        {
          audioContextState: 'interrupted',
          currentOperation: 'Audio playback',
        },
      );

      expect(error.code).toBe(MobileErrorCode.AUDIO_INTERRUPTION);
      expect(error.context.audioContextState).toBe('interrupted');
    });
  });

  // ================================
  // Context Preservation Behaviors
  // ================================
  describe('Context Preservation Behaviors', () => {
    it('should preserve mobile-specific context information', () => {
      const mobileContext: Partial<ErrorContext> = {
        currentOperation: 'Mobile audio processing',
        engineState: 'optimized',
        audioContextState: 'running',
        deviceInfo: {
          platform: 'android',
          isMobile: true,
          hasLowLatencySupport: true,
          browserVersion: '91.0.4472.124',
        },
        performanceMetrics: {
          latency: 85,
          cpuUsage: 60,
          memoryUsage: 280,
        },
      };

      const error = new MobileError(
        MobileErrorCode.BATTERY_LOW,
        'Low battery affecting performance',
        mobileContext,
      );

      expect(error.context.currentOperation).toBe('Mobile audio processing');
      expect(error.context.deviceInfo?.platform).toBe('android');
      expect(error.context.deviceInfo?.isMobile).toBe(true);
      expect(error.context.performanceMetrics?.latency).toBe(85);
    });

    it('should handle missing mobile context gracefully', () => {
      const error = new MobileError(
        MobileErrorCode.MEMORY_CONSTRAINT,
        'Memory constraint without context',
      );

      expect(error.context).toBeDefined();
      expect(error.context.timestamp).toBeDefined();
      expect(error.code).toBe(MobileErrorCode.MEMORY_CONSTRAINT);
    });

    it('should handle partial mobile context', () => {
      const partialContext: Partial<ErrorContext> = {
        deviceInfo: {
          platform: 'ios',
          isMobile: true,
          hasLowLatencySupport: false,
          browserVersion: '15.0',
        },
        // Missing performance metrics and other fields
      };

      const error = new MobileError(
        MobileErrorCode.BACKGROUND_RESTRICTION,
        'Partial context test',
        partialContext,
      );

      expect(error.context.deviceInfo?.platform).toBe('ios');
      expect(error.context.performanceMetrics).toBeUndefined();
    });
  });

  // ================================
  // Error Chaining Behaviors
  // ================================
  describe('Error Chaining Behaviors', () => {
    it('should handle error chaining with mobile-specific causes', () => {
      const originalError = new Error('MediaSession interrupted by system');

      const error = new MobileError(
        MobileErrorCode.AUDIO_INTERRUPTION,
        'Audio session interrupted by system call',
        {
          audioContextState: 'interrupted',
          deviceInfo: {
            platform: 'ios',
            isMobile: true,
            hasLowLatencySupport: false,
            browserVersion: '15.0',
          },
        },
        originalError,
      );

      expect(error.cause).toBe(originalError);
      expect(error.message).toBe('Audio session interrupted by system call');
      expect(error.context.audioContextState).toBe('interrupted');
    });

    it('should maintain error chain information in stack traces', () => {
      const systemError = new Error('System denied background audio');
      systemError.stack =
        'Error: System denied background audio\n    at MediaController.resume (/app/media.js:45:12)';

      const error = new MobileError(
        MobileErrorCode.BACKGROUND_RESTRICTION,
        'Background audio not permitted',
        {},
        systemError,
      );

      expect(error.cause).toBe(systemError);
      expect(error.stack).toBeDefined();
    });
  });

  // ================================
  // Factory Function Behaviors
  // ================================
  describe('Factory Function Behaviors', () => {
    it('should create mobile errors using factory function', () => {
      const error = createMobileError(
        MobileErrorCode.MEMORY_CONSTRAINT,
        'Factory-created memory constraint error',
        {
          performanceMetrics: {
            memoryUsage: 400,
            latency: 95,
            cpuUsage: 75,
          },
        },
      );

      expect(error).toBeInstanceOf(MobileError);
      expect(error.code).toBe(MobileErrorCode.MEMORY_CONSTRAINT);
      expect(error.context.performanceMetrics?.memoryUsage).toBe(400);
    });

    it('should handle factory function with error chaining', () => {
      const originalError = new Error('Battery service unavailable');

      const error = createMobileError(
        MobileErrorCode.BATTERY_LOW,
        'Cannot access battery status',
        {
          deviceInfo: {
            platform: 'android',
            isMobile: true,
            hasLowLatencySupport: true,
            browserVersion: '91.0',
          },
        },
        originalError,
      );

      expect(error.cause).toBe(originalError);
      expect(error.context.deviceInfo?.platform).toBe('android');
    });

    it('should apply factory function context correctly', () => {
      const error = createMobileError(
        MobileErrorCode.AUDIO_INTERRUPTION,
        'Factory context test',
        {
          currentOperation: 'Custom operation',
          engineState: 'custom-state',
        },
      );

      expect(error.context.currentOperation).toBe('Custom operation');
      expect(error.context.engineState).toBe('custom-state');
    });
  });

  // ================================
  // Recovery Strategy Behaviors
  // ================================
  describe('Recovery Strategy Behaviors', () => {
    it('should provide consistent mobile optimization recovery', () => {
      const errorCodes = [
        MobileErrorCode.BATTERY_LOW,
        MobileErrorCode.BACKGROUND_RESTRICTION,
        MobileErrorCode.MEMORY_CONSTRAINT,
        MobileErrorCode.AUDIO_INTERRUPTION,
      ];

      errorCodes.forEach((code) => {
        const error = new MobileError(code, `Test error for ${code}`);
        const recoveryActions = error.getAutomaticRecoveries();

        expect(recoveryActions).toHaveLength(1);
        expect(recoveryActions[0]!.type).toBe('degrade');
        expect(recoveryActions[0]!.description).toBe(
          'Enable mobile optimization mode',
        );
        expect(recoveryActions[0]!.automatic).toBe(true);
        expect(recoveryActions[0]!.priority).toBe(8);
      });
    });

    it('should indicate recoverability for mobile errors', () => {
      const error = new MobileError(
        MobileErrorCode.MEMORY_CONSTRAINT,
        'Mobile memory constraint',
      );

      expect(error.isRecoverable()).toBe(true);
      expect(error.getAutomaticRecoveries().length).toBeGreaterThan(0);
    });
  });

  // ================================
  // Serialization and Metadata Behaviors
  // ================================
  describe('Serialization and Metadata Behaviors', () => {
    it('should serialize mobile errors with all metadata', () => {
      const error = new MobileError(
        MobileErrorCode.BATTERY_LOW,
        'Low battery serialization test',
        {
          deviceInfo: {
            platform: 'ios',
            isMobile: true,
            hasLowLatencySupport: false,
            browserVersion: '15.0',
          },
          performanceMetrics: {
            latency: 110,
            cpuUsage: 55,
            memoryUsage: 320,
          },
        },
      );

      const serialized = JSON.parse(JSON.stringify(error));

      expect(serialized.name).toBe('MobileError');
      expect(serialized.code).toBe(MobileErrorCode.BATTERY_LOW);
      expect(serialized.category).toBe(ErrorCategory.MOBILE);
      expect(serialized.severity).toBe(ErrorSeverity.MEDIUM);
    });

    it('should maintain timestamp consistency', () => {
      const error = new MobileError(
        MobileErrorCode.AUDIO_INTERRUPTION,
        'Timestamp test',
      );

      expect(error.timestamp).toBeDefined();
      expect(error.context.timestamp).toBeDefined();
      expect(typeof error.timestamp).toBe('number');
    });
  });

  // ================================
  // Platform-Specific Behaviors
  // ================================
  describe('Platform-Specific Behaviors', () => {
    it('should handle iOS-specific mobile constraints', () => {
      const error = new MobileError(
        MobileErrorCode.BACKGROUND_RESTRICTION,
        'iOS background audio restriction',
        {
          deviceInfo: {
            platform: 'ios',
            isMobile: true,
            hasLowLatencySupport: false,
            browserVersion: '15.0',
          },
          audioContextState: 'suspended',
        },
      );

      expect(error.context.deviceInfo?.platform).toBe('ios');
      expect(error.context.deviceInfo?.hasLowLatencySupport).toBe(false);
      expect(error.context.audioContextState).toBe('suspended');
    });

    it('should handle Android-specific mobile constraints', () => {
      const error = new MobileError(
        MobileErrorCode.MEMORY_CONSTRAINT,
        'Android memory limitation',
        {
          deviceInfo: {
            platform: 'android',
            isMobile: true,
            hasLowLatencySupport: true,
            browserVersion: '91.0',
          },
          performanceMetrics: {
            memoryUsage: 380,
            cpuUsage: 65,
            latency: 75,
          },
        },
      );

      expect(error.context.deviceInfo?.platform).toBe('android');
      expect(error.context.deviceInfo?.hasLowLatencySupport).toBe(true);
      expect(error.context.performanceMetrics?.memoryUsage).toBe(380);
    });
  });

  // ================================
  // Error Message Consistency Behaviors
  // ================================
  describe('Error Message Consistency Behaviors', () => {
    it('should provide consistent user messages across error codes', () => {
      const errorCodes = [
        MobileErrorCode.BATTERY_LOW,
        MobileErrorCode.BACKGROUND_RESTRICTION,
        MobileErrorCode.MEMORY_CONSTRAINT,
        MobileErrorCode.AUDIO_INTERRUPTION,
      ];

      const expectedUserMessage =
        'Mobile device limitation detected. Performance may be optimized.';

      errorCodes.forEach((code) => {
        const error = new MobileError(code, `Test message for ${code}`);
        expect(error.getUserMessage()).toBe(expectedUserMessage);
      });
    });

    it('should provide technical messages with proper formatting', () => {
      const testCases = [
        {
          code: MobileErrorCode.BATTERY_LOW,
          message: 'Battery at critical level',
          expected: 'MOBILE_BATTERY_LOW: Battery at critical level',
        },
        {
          code: MobileErrorCode.BACKGROUND_RESTRICTION,
          message: 'Background playback denied',
          expected: 'MOBILE_BACKGROUND_RESTRICTION: Background playback denied',
        },
        {
          code: MobileErrorCode.MEMORY_CONSTRAINT,
          message: 'Memory insufficient for quality',
          expected: 'MOBILE_MEMORY_CONSTRAINT: Memory insufficient for quality',
        },
        {
          code: MobileErrorCode.AUDIO_INTERRUPTION,
          message: 'Call interrupted audio',
          expected: 'MOBILE_AUDIO_INTERRUPTION: Call interrupted audio',
        },
      ];

      testCases.forEach(({ code, message, expected }) => {
        const error = new MobileError(code, message);
        expect(error.getTechnicalMessage()).toBe(expected);
      });
    });
  });
});
