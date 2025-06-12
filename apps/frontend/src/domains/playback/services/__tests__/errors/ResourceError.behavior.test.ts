/**
 * ResourceError Behavioral Tests
 * Tests for resource management error handling with intelligent degradation strategies
 * Part of Story 2.1: Task 1, Subtask 1.3
 */

import { describe, it, expect } from 'vitest';
import {
  ResourceError,
  ResourceErrorCode,
  createResourceError,
} from '../../errors/ResourceError.js';
import {
  ErrorSeverity,
  ErrorCategory,
  ErrorContext,
} from '../../errors/base.js';

describe('ResourceError Behavioral Tests', () => {
  // ================================
  // Error Creation Behaviors
  // ================================
  describe('Error Creation Behaviors', () => {
    it('should create memory errors with correct resource type', () => {
      const error = new ResourceError(
        ResourceErrorCode.MEMORY_ALLOCATION_FAILED,
        'Failed to allocate 128MB for audio buffer',
      );

      expect(error.name).toBe('ResourceError');
      expect(error.code).toBe(ResourceErrorCode.MEMORY_ALLOCATION_FAILED);
      expect(error.resourceType).toBe('memory');
      expect(error.category).toBe(ErrorCategory.RESOURCE);
      expect(error.severity).toBe(ErrorSeverity.CRITICAL);
    });

    it('should create asset errors with proper recovery actions', () => {
      const error = new ResourceError(
        ResourceErrorCode.ASSET_LOADING_FAILED,
        'Failed to load track.mp3',
      );

      expect(error.resourceType).toBe('asset');
      expect(error.severity).toBe(ErrorSeverity.HIGH);

      const recoveryActions = error.getAutomaticRecoveries();
      expect(recoveryActions).toHaveLength(2);
      expect(recoveryActions[0]!.description).toBe('Retry asset loading');
      expect(recoveryActions[1]!.description).toBe('Use fallback assets');
    });

    it('should create buffer errors with immediate recovery', () => {
      const error = new ResourceError(
        ResourceErrorCode.BUFFER_UNDERRUN,
        'Audio buffer underrun detected',
      );

      expect(error.resourceType).toBe('buffer');
      const recoveryActions = error.getAutomaticRecoveries();
      expect(recoveryActions[0]!.description).toBe('Increase buffer size');
      expect(recoveryActions[0]!.estimatedTime).toBe(1000);
    });
  });

  // ================================
  // Resource Type Detection Behaviors
  // ================================
  describe('Resource Type Detection Behaviors', () => {
    it('should correctly identify memory-related errors', () => {
      const memoryErrors = [
        ResourceErrorCode.MEMORY_ALLOCATION_FAILED,
        ResourceErrorCode.MEMORY_LIMIT_EXCEEDED,
        ResourceErrorCode.MEMORY_LEAK_DETECTED,
      ];

      memoryErrors.forEach((code) => {
        const error = new ResourceError(code, 'Test message');
        expect(error.resourceType).toBe('memory');
      });
    });

    it('should correctly identify asset-related errors', () => {
      const assetErrors = [
        ResourceErrorCode.ASSET_LOADING_FAILED,
        ResourceErrorCode.ASSET_CORRUPTION_DETECTED,
        ResourceErrorCode.ASSET_SIZE_EXCEEDED,
      ];

      assetErrors.forEach((code) => {
        const error = new ResourceError(code, 'Test message');
        expect(error.resourceType).toBe('asset');
      });
    });

    it('should correctly identify buffer-related errors', () => {
      const bufferErrors = [
        ResourceErrorCode.BUFFER_ALLOCATION_FAILED,
        ResourceErrorCode.BUFFER_UNDERRUN,
        ResourceErrorCode.BUFFER_OVERFLOW,
      ];

      bufferErrors.forEach((code) => {
        const error = new ResourceError(code, 'Test message');
        expect(error.resourceType).toBe('buffer');
      });
    });

    it('should correctly identify CPU and disk errors', () => {
      const cpuError = new ResourceError(
        ResourceErrorCode.CPU_QUOTA_EXCEEDED,
        'CPU quota exceeded',
      );
      expect(cpuError.resourceType).toBe('cpu');

      const diskError = new ResourceError(
        ResourceErrorCode.DISK_SPACE_INSUFFICIENT,
        'Insufficient disk space',
      );
      expect(diskError.resourceType).toBe('disk');
    });
  });

  // ================================
  // Resource Metrics Extraction Behaviors
  // ================================
  describe('Resource Metrics Extraction Behaviors', () => {
    it('should extract resource metrics from context', () => {
      const context: Partial<ErrorContext> = {
        performanceMetrics: {
          requestedSize: 128 * 1024 * 1024, // 128MB
          availableSize: 64 * 1024 * 1024, // 64MB
          utilizationPercentage: 85,
          latency: 45,
          cpuUsage: 75,
          memoryUsage: 512,
        },
      };

      const error = new ResourceError(
        ResourceErrorCode.MEMORY_LIMIT_EXCEEDED,
        'Memory limit exceeded',
        context,
      );

      expect(error.requestedSize).toBe(128 * 1024 * 1024);
      expect(error.availableSize).toBe(64 * 1024 * 1024);
      expect(error.utilizationPercentage).toBe(85);
    });

    it('should handle missing resource metrics gracefully', () => {
      const error = new ResourceError(
        ResourceErrorCode.MEMORY_ALLOCATION_FAILED,
        'Failed to allocate memory',
      );

      expect(error.requestedSize).toBeUndefined();
      expect(error.availableSize).toBeUndefined();
      expect(error.utilizationPercentage).toBeUndefined();
    });

    it('should handle partial resource metrics', () => {
      const context: Partial<ErrorContext> = {
        performanceMetrics: {
          requestedSize: 256 * 1024 * 1024,
          latency: 30,
          cpuUsage: 60,
          memoryUsage: 400,
        },
      };

      const error = new ResourceError(
        ResourceErrorCode.ASSET_SIZE_EXCEEDED,
        'Asset too large',
        context,
      );

      expect(error.requestedSize).toBe(256 * 1024 * 1024);
      expect(error.availableSize).toBeUndefined();
      expect(error.utilizationPercentage).toBeUndefined();
    });
  });

  // ================================
  // Recovery Strategy Behaviors
  // ================================
  describe('Recovery Strategy Behaviors', () => {
    it('should provide memory-specific recovery strategies', () => {
      const error = new ResourceError(
        ResourceErrorCode.MEMORY_LIMIT_EXCEEDED,
        'Memory limit exceeded',
      );

      const recoveryActions = error.getAutomaticRecoveries();
      expect(recoveryActions).toHaveLength(2);

      expect(recoveryActions[0]!.type).toBe('degrade');
      expect(recoveryActions[0]!.description).toBe('Clear audio buffer cache');
      expect(recoveryActions[0]!.priority).toBe(9);
      expect(recoveryActions[0]!.estimatedTime).toBe(500);

      expect(recoveryActions[1]!.description).toBe('Reduce audio quality');
      expect(recoveryActions[1]!.priority).toBe(8);
    });

    it('should provide asset-specific recovery strategies', () => {
      const error = new ResourceError(
        ResourceErrorCode.ASSET_LOADING_FAILED,
        'Failed to load audio asset',
      );

      const recoveryActions = error.getAutomaticRecoveries();
      expect(recoveryActions).toHaveLength(2);

      expect(recoveryActions[0]!.type).toBe('retry');
      expect(recoveryActions[0]!.description).toBe('Retry asset loading');
      expect(recoveryActions[0]!.estimatedTime).toBe(2000);

      expect(recoveryActions[1]!.type).toBe('fallback');
      expect(recoveryActions[1]!.description).toBe('Use fallback assets');
    });

    it('should provide buffer-specific recovery strategies', () => {
      const error = new ResourceError(
        ResourceErrorCode.BUFFER_UNDERRUN,
        'Audio buffer underrun',
      );

      const recoveryActions = error.getAutomaticRecoveries();
      expect(recoveryActions).toHaveLength(1);

      expect(recoveryActions[0]!.type).toBe('degrade');
      expect(recoveryActions[0]!.description).toBe('Increase buffer size');
      expect(recoveryActions[0]!.automatic).toBe(true);
      expect(recoveryActions[0]!.priority).toBe(9);
    });

    it('should provide generic recovery for unknown error codes', () => {
      const error = new ResourceError(
        ResourceErrorCode.NOT_FOUND,
        'Resource not found',
      );

      const recoveryActions = error.getAutomaticRecoveries();
      expect(recoveryActions).toHaveLength(1);
      expect(recoveryActions[0]!.description).toBe(
        'Retry with reduced resource usage',
      );
      expect(recoveryActions[0]!.priority).toBe(5);
    });
  });

  // ================================
  // Severity Assessment Behaviors
  // ================================
  describe('Severity Assessment Behaviors', () => {
    it('should assign critical severity to allocation failures', () => {
      const criticalErrors = [
        ResourceErrorCode.MEMORY_ALLOCATION_FAILED,
        ResourceErrorCode.BUFFER_ALLOCATION_FAILED,
      ];

      criticalErrors.forEach((code) => {
        const error = new ResourceError(code, 'Allocation failed');
        expect(error.severity).toBe(ErrorSeverity.CRITICAL);
      });
    });

    it('should assign high severity to other resource errors', () => {
      const highSeverityErrors = [
        ResourceErrorCode.MEMORY_LIMIT_EXCEEDED,
        ResourceErrorCode.ASSET_LOADING_FAILED,
        ResourceErrorCode.BUFFER_UNDERRUN,
        ResourceErrorCode.CPU_QUOTA_EXCEEDED,
        ResourceErrorCode.DISK_SPACE_INSUFFICIENT,
      ];

      highSeverityErrors.forEach((code) => {
        const error = new ResourceError(code, 'Resource issue');
        expect(error.severity).toBe(ErrorSeverity.HIGH);
      });
    });
  });

  // ================================
  // User Message Behaviors
  // ================================
  describe('User Message Behaviors', () => {
    it('should provide memory-specific user messages', () => {
      const error = new ResourceError(
        ResourceErrorCode.MEMORY_LIMIT_EXCEEDED,
        'Memory exceeded',
      );

      expect(error.getUserMessage()).toBe(
        'Insufficient memory for audio processing. Please close other applications.',
      );
    });

    it('should provide asset-specific user messages', () => {
      const error = new ResourceError(
        ResourceErrorCode.ASSET_LOADING_FAILED,
        'Asset failed to load',
      );

      expect(error.getUserMessage()).toBe(
        'Failed to load audio content. Please check your internet connection.',
      );
    });

    it('should provide generic user messages for other errors', () => {
      const error = new ResourceError(
        ResourceErrorCode.CPU_QUOTA_EXCEEDED,
        'CPU quota exceeded',
      );

      expect(error.getUserMessage()).toBe(
        'System resource issue detected. Performance may be reduced.',
      );
    });
  });

  // ================================
  // Error Context Behaviors
  // ================================
  describe('Error Context Behaviors', () => {
    it('should include resource operation context', () => {
      const context: Partial<ErrorContext> = {
        currentOperation: 'Loading high-quality audio',
        engineState: 'processing',
        audioContextState: 'running',
      };

      const error = new ResourceError(
        ResourceErrorCode.MEMORY_ALLOCATION_FAILED,
        'Memory allocation failed',
        context,
      );

      expect(error.context.currentOperation).toBe('Loading high-quality audio');
      expect(error.context.engineState).toBe('processing');
    });

    it('should handle error chaining with resource context', () => {
      const originalError = new Error('Out of memory');
      const context: Partial<ErrorContext> = {
        performanceMetrics: {
          requestedSize: 512 * 1024 * 1024,
          availableSize: 256 * 1024 * 1024,
          utilizationPercentage: 95,
          latency: 60,
          cpuUsage: 90,
          memoryUsage: 800,
        },
      };

      const error = new ResourceError(
        ResourceErrorCode.MEMORY_LIMIT_EXCEEDED,
        'Cannot allocate additional memory',
        context,
        originalError,
      );

      expect(error.cause).toBe(originalError);
      expect(error.requestedSize).toBe(512 * 1024 * 1024);
      expect(error.availableSize).toBe(256 * 1024 * 1024);
    });
  });

  // ================================
  // Factory Function Behaviors
  // ================================
  describe('Factory Function Behaviors', () => {
    it('should create resource errors with factory function', () => {
      const error = createResourceError(
        ResourceErrorCode.ASSET_CORRUPTION_DETECTED,
        'Audio file corrupted',
        { currentOperation: 'Asset validation' },
      );

      expect(error).toBeInstanceOf(ResourceError);
      expect(error.code).toBe(ResourceErrorCode.ASSET_CORRUPTION_DETECTED);
      expect(error.context.currentOperation).toBe('Resource management');
    });

    it('should override context in factory function', () => {
      const error = createResourceError(
        ResourceErrorCode.DISK_SPACE_INSUFFICIENT,
        'Insufficient disk space',
        { engineState: 'storage-full' },
      );

      expect(error.context.currentOperation).toBe('Resource management');
      expect(error.context.engineState).toBe('storage-full');
    });

    it('should handle factory function with cause', () => {
      const originalError = new Error('Disk write failed');
      const error = createResourceError(
        ResourceErrorCode.DISK_SPACE_INSUFFICIENT,
        'Cannot write to disk',
        {},
        originalError,
      );

      expect(error.cause).toBe(originalError);
      expect(error.message).toBe('Cannot write to disk');
    });
  });

  // ================================
  // Resource Type Edge Cases
  // ================================
  describe('Resource Type Edge Cases', () => {
    it('should default to memory type for unrecognized codes', () => {
      // Create a mock error code that doesn't match any resource type
      const mockCode = 'RESOURCE_UNKNOWN_TYPE' as ResourceErrorCode;
      const error = new ResourceError(mockCode, 'Unknown resource error');

      expect(error.resourceType).toBe('memory');
    });

    it('should handle concurrent resource errors', () => {
      const errors = [
        new ResourceError(
          ResourceErrorCode.CONCURRENT_LIMIT_EXCEEDED,
          'Too many concurrent operations',
        ),
        new ResourceError(
          ResourceErrorCode.CPU_QUOTA_EXCEEDED,
          'CPU limit reached',
        ),
        new ResourceError(
          ResourceErrorCode.MEMORY_LIMIT_EXCEEDED,
          'Memory exhausted',
        ),
      ];

      expect(errors[0]!.resourceType).toBe('memory'); // CONCURRENT maps to memory by default
      expect(errors[1]!.resourceType).toBe('cpu');
      expect(errors[2]!.resourceType).toBe('memory');
    });
  });

  // ================================
  // Documentation and Technical Messages
  // ================================
  describe('Documentation and Technical Messages', () => {
    it('should provide technical messages with error codes', () => {
      const error = new ResourceError(
        ResourceErrorCode.BUFFER_OVERFLOW,
        'Audio buffer overflow detected',
      );

      expect(error.getTechnicalMessage()).toBe(
        'RESOURCE_BUFFER_OVERFLOW: Audio buffer overflow detected',
      );
    });

    it('should provide documentation URLs', () => {
      const error = new ResourceError(
        ResourceErrorCode.MEMORY_LEAK_DETECTED,
        'Memory leak detected in audio processing',
      );

      expect(error.documentationUrl).toBe(
        '/docs/troubleshooting/resource-management',
      );
    });

    it('should handle serialization with resource metrics', () => {
      const context: Partial<ErrorContext> = {
        performanceMetrics: {
          requestedSize: 64 * 1024 * 1024,
          availableSize: 32 * 1024 * 1024,
          utilizationPercentage: 90,
          latency: 40,
          cpuUsage: 85,
          memoryUsage: 600,
        },
      };

      const error = new ResourceError(
        ResourceErrorCode.MEMORY_ALLOCATION_FAILED,
        'Failed to allocate memory for audio buffer',
        context,
      );

      // Test that the error can be serialized and contains resource metrics
      const serialized = JSON.parse(JSON.stringify(error));
      expect(serialized.resourceType).toBe('memory');
      expect(serialized.requestedSize).toBe(64 * 1024 * 1024);
      expect(serialized.availableSize).toBe(32 * 1024 * 1024);
    });
  });
});
