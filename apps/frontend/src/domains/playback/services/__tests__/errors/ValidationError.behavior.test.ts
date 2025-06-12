/**
 * ValidationError Behavioral Tests
 * Tests for input validation and type error handling
 * Part of Story 2.1: Task 1, Subtask 1.3
 */

import { describe, it, expect } from 'vitest';
import {
  ValidationError,
  ValidationErrorCode,
  createValidationError,
} from '../../errors/ValidationError.js';
import {
  ErrorSeverity,
  ErrorCategory,
  ErrorContext,
} from '../../errors/base.js';

describe('ValidationError Behavioral Tests', () => {
  // ================================
  // Error Creation Behaviors
  // ================================
  describe('Error Creation Behaviors', () => {
    it('should create validation errors with correct properties', () => {
      const error = new ValidationError(
        ValidationErrorCode.INVALID_PARAMETER,
        'Volume parameter must be between 0 and 1',
      );

      expect(error.name).toBe('ValidationError');
      expect(error.code).toBe(ValidationErrorCode.INVALID_PARAMETER);
      expect(error.category).toBe(ErrorCategory.VALIDATION);
      expect(error.severity).toBe(ErrorSeverity.LOW);
      expect(error.message).toBe('Volume parameter must be between 0 and 1');
    });

    it('should include fallback recovery action', () => {
      const error = new ValidationError(
        ValidationErrorCode.TYPE_MISMATCH,
        'Expected number, received string',
      );

      const recoveryActions = error.getAutomaticRecoveries();
      expect(recoveryActions).toHaveLength(1);
      expect(recoveryActions[0]!.type).toBe('fallback');
      expect(recoveryActions[0]!.description).toBe('Use default values');
      expect(recoveryActions[0]!.automatic).toBe(true);
      expect(recoveryActions[0]!.priority).toBe(8);
    });

    it('should provide appropriate user messages', () => {
      const error = new ValidationError(
        ValidationErrorCode.REQUIRED_FIELD_MISSING,
        'Audio source URL is required',
      );

      expect(error.getUserMessage()).toBe(
        'Invalid configuration detected. Using default settings.',
      );
    });

    it('should provide technical messages with error codes', () => {
      const error = new ValidationError(
        ValidationErrorCode.INVALID_FORMAT,
        'Audio format not supported: .xyz',
      );

      expect(error.getTechnicalMessage()).toBe(
        'VALIDATION_INVALID_FORMAT: Audio format not supported: .xyz',
      );
    });
  });

  // ================================
  // Validation Error Code Behaviors
  // ================================
  describe('Validation Error Code Behaviors', () => {
    it('should handle invalid parameter errors', () => {
      const error = new ValidationError(
        ValidationErrorCode.INVALID_PARAMETER,
        'Playback rate must be between 0.25 and 4.0, received: 6.5',
        {
          currentOperation: 'Setting playback rate',
          engineState: 'configuring',
          performanceMetrics: {
            latency: 25,
            cpuUsage: 10,
            memoryUsage: 80,
          },
        },
      );

      expect(error.code).toBe(ValidationErrorCode.INVALID_PARAMETER);
      expect(error.context.currentOperation).toBe('Setting playback rate');
    });

    it('should handle type mismatch errors', () => {
      const error = new ValidationError(
        ValidationErrorCode.TYPE_MISMATCH,
        'Expected AudioBuffer, received HTMLAudioElement',
        {
          currentOperation: 'Audio buffer validation',
          audioContextState: 'running',
        },
      );

      expect(error.code).toBe(ValidationErrorCode.TYPE_MISMATCH);
      expect(error.context.audioContextState).toBe('running');
    });

    it('should handle range exceeded errors', () => {
      const error = new ValidationError(
        ValidationErrorCode.RANGE_EXCEEDED,
        'Buffer size 1048576 exceeds maximum allowed: 524288',
        {
          currentOperation: 'Buffer allocation',
          performanceMetrics: {
            requestedSize: 1048576,
            availableSize: 524288,
            utilizationPercentage: 200,
            latency: 15,
            cpuUsage: 5,
            memoryUsage: 60,
          },
        },
      );

      expect(error.code).toBe(ValidationErrorCode.RANGE_EXCEEDED);
      expect(error.context.performanceMetrics?.utilizationPercentage).toBe(200);
    });

    it('should handle required field missing errors', () => {
      const error = new ValidationError(
        ValidationErrorCode.REQUIRED_FIELD_MISSING,
        'Audio source configuration is missing required field: url',
        {
          currentOperation: 'Audio source initialization',
          engineState: 'initializing',
        },
      );

      expect(error.code).toBe(ValidationErrorCode.REQUIRED_FIELD_MISSING);
      expect(error.context.engineState).toBe('initializing');
    });

    it('should handle invalid format errors', () => {
      const error = new ValidationError(
        ValidationErrorCode.INVALID_FORMAT,
        'Audio file format .xyz is not supported. Supported formats: .mp3, .wav, .ogg',
        {
          currentOperation: 'Format validation',
          deviceInfo: {
            platform: 'chrome',
            isMobile: false,
            hasLowLatencySupport: true,
            browserVersion: '91.0',
          },
        },
      );

      expect(error.code).toBe(ValidationErrorCode.INVALID_FORMAT);
      expect(error.context.deviceInfo?.platform).toBe('chrome');
    });

    it('should handle dependency errors', () => {
      const error = new ValidationError(
        ValidationErrorCode.DEPENDENCY_ERROR,
        'AudioContext must be initialized before creating audio nodes',
        {
          currentOperation: 'Audio node creation',
          audioContextState: 'suspended',
          engineState: 'error',
        },
      );

      expect(error.code).toBe(ValidationErrorCode.DEPENDENCY_ERROR);
      expect(error.context.audioContextState).toBe('suspended');
    });
  });

  // ================================
  // Context Preservation Behaviors
  // ================================
  describe('Context Preservation Behaviors', () => {
    it('should preserve validation-specific context information', () => {
      const validationContext: Partial<ErrorContext> = {
        currentOperation: 'Configuration validation',
        engineState: 'validating',
        audioContextState: 'running',
        deviceInfo: {
          platform: 'firefox',
          isMobile: false,
          hasLowLatencySupport: false,
          browserVersion: '89.0',
        },
        performanceMetrics: {
          latency: 20,
          cpuUsage: 8,
          memoryUsage: 50,
        },
      };

      const error = new ValidationError(
        ValidationErrorCode.INVALID_PARAMETER,
        'Invalid gain value: must be finite number',
        validationContext,
      );

      expect(error.context.currentOperation).toBe('Configuration validation');
      expect(error.context.deviceInfo?.platform).toBe('firefox');
      expect(error.context.performanceMetrics?.latency).toBe(20);
    });

    it('should handle missing validation context gracefully', () => {
      const error = new ValidationError(
        ValidationErrorCode.TYPE_MISMATCH,
        'Type validation without context',
      );

      expect(error.context).toBeDefined();
      expect(error.context.timestamp).toBeDefined();
      expect(error.code).toBe(ValidationErrorCode.TYPE_MISMATCH);
    });

    it('should handle partial validation context', () => {
      const partialContext: Partial<ErrorContext> = {
        currentOperation: 'Partial validation operation',
        // Missing other context fields
      };

      const error = new ValidationError(
        ValidationErrorCode.RANGE_EXCEEDED,
        'Partial context test',
        partialContext,
      );

      expect(error.context.currentOperation).toBe(
        'Partial validation operation',
      );
      expect(error.context.performanceMetrics).toBeUndefined();
      expect(error.context.deviceInfo).toBeUndefined();
    });
  });

  // ================================
  // Error Chaining Behaviors
  // ================================
  describe('Error Chaining Behaviors', () => {
    it('should handle error chaining with validation-specific causes', () => {
      const typeError = new TypeError('Cannot read property of undefined');

      const error = new ValidationError(
        ValidationErrorCode.TYPE_MISMATCH,
        'Audio parameter validation failed due to type error',
        {
          currentOperation: 'Parameter validation',
          engineState: 'error',
        },
        typeError,
      );

      expect(error.cause).toBe(typeError);
      expect(error.message).toBe(
        'Audio parameter validation failed due to type error',
      );
      expect(error.context.engineState).toBe('error');
    });

    it('should maintain error chain information for range errors', () => {
      const rangeError = new RangeError('Value out of range');

      const error = new ValidationError(
        ValidationErrorCode.RANGE_EXCEEDED,
        'Parameter value exceeded acceptable range',
        {
          performanceMetrics: {
            requestedSize: 999999,
            availableSize: 100000,
            utilizationPercentage: 999,
            latency: 30,
            cpuUsage: 15,
            memoryUsage: 120,
          },
        },
        rangeError,
      );

      expect(error.cause).toBe(rangeError);
      expect((error.cause as Error).name).toBe('RangeError');
    });
  });

  // ================================
  // Factory Function Behaviors
  // ================================
  describe('Factory Function Behaviors', () => {
    it('should create validation errors using factory function', () => {
      const error = createValidationError(
        ValidationErrorCode.INVALID_FORMAT,
        'Factory-created format validation error',
        {
          currentOperation: 'Format checking',
          engineState: 'validating',
        },
      );

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.code).toBe(ValidationErrorCode.INVALID_FORMAT);
      expect(error.context.currentOperation).toBe('Format checking');
      expect(error.context.engineState).toBe('validating');
    });

    it('should handle factory function with error chaining', () => {
      const validationError = new Error('JSON parse error');

      const error = createValidationError(
        ValidationErrorCode.INVALID_FORMAT,
        'Cannot parse configuration JSON',
        {
          currentOperation: 'Configuration parsing',
        },
        validationError,
      );

      expect(error.cause).toBe(validationError);
      expect(error.context.currentOperation).toBe('Configuration parsing');
    });

    it('should apply factory function context correctly', () => {
      const error = createValidationError(
        ValidationErrorCode.DEPENDENCY_ERROR,
        'Factory context test',
        {
          audioContextState: 'closed',
          deviceInfo: {
            platform: 'safari',
            isMobile: true,
            hasLowLatencySupport: false,
            browserVersion: '14.0',
          },
        },
      );

      expect(error.context.audioContextState).toBe('closed');
      expect(error.context.deviceInfo?.platform).toBe('safari');
    });
  });

  // ================================
  // Recovery Strategy Behaviors
  // ================================
  describe('Recovery Strategy Behaviors', () => {
    it('should provide consistent fallback recovery', () => {
      const errorCodes = [
        ValidationErrorCode.INVALID_PARAMETER,
        ValidationErrorCode.TYPE_MISMATCH,
        ValidationErrorCode.RANGE_EXCEEDED,
        ValidationErrorCode.REQUIRED_FIELD_MISSING,
        ValidationErrorCode.INVALID_FORMAT,
        ValidationErrorCode.DEPENDENCY_ERROR,
      ];

      errorCodes.forEach((code) => {
        const error = new ValidationError(code, `Test error for ${code}`);
        const recoveryActions = error.getAutomaticRecoveries();

        expect(recoveryActions).toHaveLength(1);
        expect(recoveryActions[0]!.type).toBe('fallback');
        expect(recoveryActions[0]!.description).toBe('Use default values');
        expect(recoveryActions[0]!.automatic).toBe(true);
        expect(recoveryActions[0]!.priority).toBe(8);
      });
    });

    it('should indicate recoverability for validation errors', () => {
      const error = new ValidationError(
        ValidationErrorCode.INVALID_PARAMETER,
        'Invalid parameter value',
      );

      expect(error.isRecoverable()).toBe(true);
      expect(error.getAutomaticRecoveries()[0]!.type).toBe('fallback');
    });
  });

  // ================================
  // Severity Consistency Behaviors
  // ================================
  describe('Severity Consistency Behaviors', () => {
    it('should assign low severity to all validation errors', () => {
      const errorCodes = [
        ValidationErrorCode.INVALID_PARAMETER,
        ValidationErrorCode.TYPE_MISMATCH,
        ValidationErrorCode.RANGE_EXCEEDED,
        ValidationErrorCode.REQUIRED_FIELD_MISSING,
        ValidationErrorCode.INVALID_FORMAT,
        ValidationErrorCode.DEPENDENCY_ERROR,
      ];

      errorCodes.forEach((code) => {
        const error = new ValidationError(code, `Test error for ${code}`);
        expect(error.severity).toBe(ErrorSeverity.LOW);
      });
    });

    it('should maintain consistent category assignment', () => {
      const errorCodes = [
        ValidationErrorCode.INVALID_PARAMETER,
        ValidationErrorCode.TYPE_MISMATCH,
        ValidationErrorCode.RANGE_EXCEEDED,
        ValidationErrorCode.REQUIRED_FIELD_MISSING,
        ValidationErrorCode.INVALID_FORMAT,
        ValidationErrorCode.DEPENDENCY_ERROR,
      ];

      errorCodes.forEach((code) => {
        const error = new ValidationError(code, `Test error for ${code}`);
        expect(error.category).toBe(ErrorCategory.VALIDATION);
      });
    });
  });

  // ================================
  // Error Message Consistency Behaviors
  // ================================
  describe('Error Message Consistency Behaviors', () => {
    it('should provide consistent user messages across error codes', () => {
      const errorCodes = [
        ValidationErrorCode.INVALID_PARAMETER,
        ValidationErrorCode.TYPE_MISMATCH,
        ValidationErrorCode.RANGE_EXCEEDED,
        ValidationErrorCode.REQUIRED_FIELD_MISSING,
        ValidationErrorCode.INVALID_FORMAT,
        ValidationErrorCode.DEPENDENCY_ERROR,
      ];

      const expectedUserMessage =
        'Invalid configuration detected. Using default settings.';

      errorCodes.forEach((code) => {
        const error = new ValidationError(code, `Test message for ${code}`);
        expect(error.getUserMessage()).toBe(expectedUserMessage);
      });
    });

    it('should provide technical messages with proper formatting', () => {
      const testCases = [
        {
          code: ValidationErrorCode.INVALID_PARAMETER,
          message: 'Parameter value is invalid',
          expected: 'VALIDATION_INVALID_PARAMETER: Parameter value is invalid',
        },
        {
          code: ValidationErrorCode.TYPE_MISMATCH,
          message: 'Expected string, got number',
          expected: 'VALIDATION_TYPE_MISMATCH: Expected string, got number',
        },
        {
          code: ValidationErrorCode.RANGE_EXCEEDED,
          message: 'Value exceeds allowed range',
          expected: 'VALIDATION_RANGE_EXCEEDED: Value exceeds allowed range',
        },
        {
          code: ValidationErrorCode.REQUIRED_FIELD_MISSING,
          message: 'Required field is missing',
          expected:
            'VALIDATION_REQUIRED_FIELD_MISSING: Required field is missing',
        },
        {
          code: ValidationErrorCode.INVALID_FORMAT,
          message: 'Format is not supported',
          expected: 'VALIDATION_INVALID_FORMAT: Format is not supported',
        },
        {
          code: ValidationErrorCode.DEPENDENCY_ERROR,
          message: 'Dependency requirement not met',
          expected:
            'VALIDATION_DEPENDENCY_ERROR: Dependency requirement not met',
        },
      ];

      testCases.forEach(({ code, message, expected }) => {
        const error = new ValidationError(code, message);
        expect(error.getTechnicalMessage()).toBe(expected);
      });
    });
  });

  // ================================
  // Serialization and Metadata Behaviors
  // ================================
  describe('Serialization and Metadata Behaviors', () => {
    it('should serialize validation errors with all metadata', () => {
      const error = new ValidationError(
        ValidationErrorCode.INVALID_PARAMETER,
        'Parameter validation serialization test',
        {
          currentOperation: 'Parameter validation',
          performanceMetrics: {
            latency: 5,
            cpuUsage: 2,
            memoryUsage: 30,
          },
        },
      );

      const serialized = JSON.parse(JSON.stringify(error));

      expect(serialized.name).toBe('ValidationError');
      expect(serialized.code).toBe(ValidationErrorCode.INVALID_PARAMETER);
      expect(serialized.category).toBe(ErrorCategory.VALIDATION);
      expect(serialized.severity).toBe(ErrorSeverity.LOW);
    });

    it('should maintain timestamp consistency', () => {
      const error = new ValidationError(
        ValidationErrorCode.TYPE_MISMATCH,
        'Timestamp test',
      );

      expect(error.timestamp).toBeDefined();
      expect(error.context.timestamp).toBeDefined();
      expect(typeof error.timestamp).toBe('number');
    });

    it('should handle complex validation error serialization', () => {
      const rangeError = new RangeError('Index out of bounds');
      const error = new ValidationError(
        ValidationErrorCode.RANGE_EXCEEDED,
        'Complex validation error with range context',
        {
          currentOperation: 'Array bounds checking',
          performanceMetrics: {
            requestedSize: 1000,
            availableSize: 500,
            utilizationPercentage: 200,
            latency: 10,
            cpuUsage: 5,
            memoryUsage: 45,
          },
          deviceInfo: {
            platform: 'chrome',
            isMobile: false,
            hasLowLatencySupport: true,
            browserVersion: '91.0',
          },
        },
        rangeError,
      );

      const serialized = JSON.parse(JSON.stringify(error));
      expect(serialized.message).toBe(
        'Complex validation error with range context',
      );
      expect(serialized.context.currentOperation).toBe('Array bounds checking');
    });
  });

  // ================================
  // Validation Scenario Behaviors
  // ================================
  describe('Validation Scenario Behaviors', () => {
    it('should handle audio parameter validation scenarios', () => {
      const scenarios = [
        {
          code: ValidationErrorCode.INVALID_PARAMETER,
          message: 'Volume must be between 0.0 and 1.0',
          context: { currentOperation: 'Volume setting' },
        },
        {
          code: ValidationErrorCode.RANGE_EXCEEDED,
          message: 'Playback rate 5.0 exceeds maximum 4.0',
          context: { currentOperation: 'Playback rate setting' },
        },
        {
          code: ValidationErrorCode.TYPE_MISMATCH,
          message: 'Expected AudioNode, received string',
          context: { currentOperation: 'Audio graph connection' },
        },
      ];

      scenarios.forEach(({ code, message, context }) => {
        const error = new ValidationError(code, message, context);
        expect(error.code).toBe(code);
        expect(error.message).toBe(message);
        expect(error.context.currentOperation).toBe(context.currentOperation);
        expect(error.severity).toBe(ErrorSeverity.LOW);
      });
    });

    it('should handle configuration validation scenarios', () => {
      const configErrors = [
        {
          code: ValidationErrorCode.REQUIRED_FIELD_MISSING,
          message: 'Audio source URL is required',
        },
        {
          code: ValidationErrorCode.INVALID_FORMAT,
          message: 'Configuration must be valid JSON',
        },
        {
          code: ValidationErrorCode.DEPENDENCY_ERROR,
          message: 'Plugin dependencies not satisfied',
        },
      ];

      configErrors.forEach(({ code, message }) => {
        const error = new ValidationError(code, message, {
          currentOperation: 'Configuration validation',
        });

        expect(error.isRecoverable()).toBe(true);
        expect(error.getAutomaticRecoveries()[0]!.type).toBe('fallback');
      });
    });
  });
});
