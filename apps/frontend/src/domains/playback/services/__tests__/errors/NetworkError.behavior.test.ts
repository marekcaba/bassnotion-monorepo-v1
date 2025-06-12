/**
 * NetworkError Behavioral Tests
 * Tests for network and connectivity error handling
 * Part of Story 2.1: Task 1, Subtask 1.3
 */

import { describe, it, expect } from 'vitest';
import {
  NetworkError,
  NetworkErrorCode,
  createNetworkError,
} from '../../errors/NetworkError.js';
import {
  ErrorSeverity,
  ErrorCategory,
  ErrorContext,
} from '../../errors/base.js';

describe('NetworkError Behavioral Tests', () => {
  // ================================
  // Error Creation Behaviors
  // ================================
  describe('Error Creation Behaviors', () => {
    it('should create network errors with correct properties', () => {
      const error = new NetworkError(
        NetworkErrorCode.CONNECTION_LOST,
        'Internet connection was lost',
      );

      expect(error.name).toBe('NetworkError');
      expect(error.code).toBe(NetworkErrorCode.CONNECTION_LOST);
      expect(error.category).toBe(ErrorCategory.NETWORK);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.message).toBe('Internet connection was lost');
    });

    it('should include network retry recovery action', () => {
      const error = new NetworkError(
        NetworkErrorCode.TIMEOUT,
        'Request timed out after 30 seconds',
      );

      const recoveryActions = error.getAutomaticRecoveries();
      expect(recoveryActions).toHaveLength(1);
      expect(recoveryActions[0]!.type).toBe('retry');
      expect(recoveryActions[0]!.description).toBe('Retry network operation');
      expect(recoveryActions[0]!.automatic).toBe(true);
      expect(recoveryActions[0]!.priority).toBe(8);
      expect(recoveryActions[0]!.estimatedTime).toBe(2000);
    });

    it('should provide appropriate user messages', () => {
      const error = new NetworkError(
        NetworkErrorCode.ASSET_LOAD_FAILED,
        'Failed to load audio asset from server',
      );

      expect(error.getUserMessage()).toBe(
        'Network connection issue. Please check your internet connection.',
      );
    });

    it('should provide technical messages with error codes', () => {
      const error = new NetworkError(
        NetworkErrorCode.CDN_UNAVAILABLE,
        'CDN endpoint not responding',
      );

      expect(error.getTechnicalMessage()).toBe(
        'NETWORK_CDN_UNAVAILABLE: CDN endpoint not responding',
      );
    });
  });

  // ================================
  // Network Error Code Behaviors
  // ================================
  describe('Network Error Code Behaviors', () => {
    it('should handle connection lost errors appropriately', () => {
      const error = new NetworkError(
        NetworkErrorCode.CONNECTION_LOST,
        'Network connection interrupted during playback',
        {
          currentOperation: 'Audio streaming',
          engineState: 'buffering',
          performanceMetrics: {
            latency: 250,
            cpuUsage: 30,
            memoryUsage: 180,
          },
        },
      );

      expect(error.code).toBe(NetworkErrorCode.CONNECTION_LOST);
      expect(error.context.currentOperation).toBe('Audio streaming');
      expect(error.context.engineState).toBe('buffering');
    });

    it('should handle timeout errors with proper context', () => {
      const error = new NetworkError(
        NetworkErrorCode.TIMEOUT,
        'Request timeout while fetching track metadata',
        {
          currentOperation: 'Metadata retrieval',
          performanceMetrics: {
            latency: 30000, // 30 seconds
            cpuUsage: 25,
            memoryUsage: 150,
          },
        },
      );

      expect(error.code).toBe(NetworkErrorCode.TIMEOUT);
      expect(error.context.performanceMetrics?.latency).toBe(30000);
    });

    it('should handle asset loading failures', () => {
      const error = new NetworkError(
        NetworkErrorCode.ASSET_LOAD_FAILED,
        'HTTP 404: Audio file not found on server',
        {
          currentOperation: 'Asset loading',
          audioContextState: 'running',
          deviceInfo: {
            platform: 'chrome',
            isMobile: false,
            hasLowLatencySupport: true,
            browserVersion: '91.0',
          },
        },
      );

      expect(error.code).toBe(NetworkErrorCode.ASSET_LOAD_FAILED);
      expect(error.context.deviceInfo?.platform).toBe('chrome');
      expect(error.context.audioContextState).toBe('running');
    });

    it('should handle CDN unavailability errors', () => {
      const error = new NetworkError(
        NetworkErrorCode.CDN_UNAVAILABLE,
        'Primary CDN server not responding, failover required',
        {
          currentOperation: 'CDN asset retrieval',
          engineState: 'error',
          performanceMetrics: {
            latency: 15000,
            cpuUsage: 20,
            memoryUsage: 120,
          },
        },
      );

      expect(error.code).toBe(NetworkErrorCode.CDN_UNAVAILABLE);
      expect(error.context.engineState).toBe('error');
    });
  });

  // ================================
  // Context Preservation Behaviors
  // ================================
  describe('Context Preservation Behaviors', () => {
    it('should preserve network-specific context information', () => {
      const networkContext: Partial<ErrorContext> = {
        currentOperation: 'Streaming audio download',
        engineState: 'downloading',
        audioContextState: 'running',
        deviceInfo: {
          platform: 'firefox',
          isMobile: true,
          hasLowLatencySupport: false,
          browserVersion: '89.0',
        },
        performanceMetrics: {
          latency: 180,
          cpuUsage: 40,
          memoryUsage: 220,
        },
      };

      const error = new NetworkError(
        NetworkErrorCode.CONNECTION_LOST,
        'Mobile network connection unstable',
        networkContext,
      );

      expect(error.context.currentOperation).toBe('Streaming audio download');
      expect(error.context.deviceInfo?.isMobile).toBe(true);
      expect(error.context.performanceMetrics?.latency).toBe(180);
    });

    it('should handle missing network context gracefully', () => {
      const error = new NetworkError(
        NetworkErrorCode.TIMEOUT,
        'Timeout without context',
      );

      expect(error.context).toBeDefined();
      expect(error.context.timestamp).toBeDefined();
      expect(error.code).toBe(NetworkErrorCode.TIMEOUT);
    });

    it('should handle partial network context', () => {
      const partialContext: Partial<ErrorContext> = {
        currentOperation: 'Partial network operation',
        // Missing other context fields
      };

      const error = new NetworkError(
        NetworkErrorCode.ASSET_LOAD_FAILED,
        'Partial context test',
        partialContext,
      );

      expect(error.context.currentOperation).toBe('Partial network operation');
      expect(error.context.performanceMetrics).toBeUndefined();
      expect(error.context.deviceInfo).toBeUndefined();
    });
  });

  // ================================
  // Error Chaining Behaviors
  // ================================
  describe('Error Chaining Behaviors', () => {
    it('should handle error chaining with network-specific causes', () => {
      const fetchError = new Error('Failed to fetch');
      (fetchError as any).status = 404;

      const error = new NetworkError(
        NetworkErrorCode.ASSET_LOAD_FAILED,
        'Audio asset could not be retrieved',
        {
          currentOperation: 'Asset download',
          performanceMetrics: {
            latency: 5000,
            cpuUsage: 15,
            memoryUsage: 100,
          },
        },
        fetchError,
      );

      expect(error.cause).toBe(fetchError);
      expect(error.message).toBe('Audio asset could not be retrieved');
      expect(error.context.currentOperation).toBe('Asset download');
    });

    it('should maintain error chain information for timeouts', () => {
      const timeoutError = new Error('AbortError: The operation was aborted');
      timeoutError.name = 'AbortError';

      const error = new NetworkError(
        NetworkErrorCode.TIMEOUT,
        'Network request was aborted due to timeout',
        {
          performanceMetrics: {
            latency: 30000,
            cpuUsage: 35,
            memoryUsage: 200,
          },
        },
        timeoutError,
      );

      expect(error.cause).toBe(timeoutError);
      expect((error.cause as Error).name).toBe('AbortError');
    });
  });

  // ================================
  // Factory Function Behaviors
  // ================================
  describe('Factory Function Behaviors', () => {
    it('should create network errors using factory function', () => {
      const error = createNetworkError(
        NetworkErrorCode.CDN_UNAVAILABLE,
        'Factory-created CDN error',
        {
          currentOperation: 'CDN failover',
          engineState: 'retrying',
        },
      );

      expect(error).toBeInstanceOf(NetworkError);
      expect(error.code).toBe(NetworkErrorCode.CDN_UNAVAILABLE);
      expect(error.context.currentOperation).toBe('CDN failover');
      expect(error.context.engineState).toBe('retrying');
    });

    it('should handle factory function with error chaining', () => {
      const connectionError = new Error('ECONNREFUSED');

      const error = createNetworkError(
        NetworkErrorCode.CONNECTION_LOST,
        'Cannot establish connection to server',
        {
          performanceMetrics: {
            latency: 10000,
            cpuUsage: 25,
            memoryUsage: 160,
          },
        },
        connectionError,
      );

      expect(error.cause).toBe(connectionError);
      expect(error.context.performanceMetrics?.latency).toBe(10000);
    });

    it('should apply factory function context correctly', () => {
      const error = createNetworkError(
        NetworkErrorCode.ASSET_LOAD_FAILED,
        'Factory context test',
        {
          audioContextState: 'suspended',
          deviceInfo: {
            platform: 'safari',
            isMobile: false,
            hasLowLatencySupport: true,
            browserVersion: '14.0',
          },
        },
      );

      expect(error.context.audioContextState).toBe('suspended');
      expect(error.context.deviceInfo?.platform).toBe('safari');
    });
  });

  // ================================
  // Recovery Strategy Behaviors
  // ================================
  describe('Recovery Strategy Behaviors', () => {
    it('should provide consistent network retry recovery', () => {
      const errorCodes = [
        NetworkErrorCode.CONNECTION_LOST,
        NetworkErrorCode.TIMEOUT,
        NetworkErrorCode.ASSET_LOAD_FAILED,
        NetworkErrorCode.CDN_UNAVAILABLE,
      ];

      errorCodes.forEach((code) => {
        const error = new NetworkError(code, `Test error for ${code}`);
        const recoveryActions = error.getAutomaticRecoveries();

        expect(recoveryActions).toHaveLength(1);
        expect(recoveryActions[0]!.type).toBe('retry');
        expect(recoveryActions[0]!.description).toBe('Retry network operation');
        expect(recoveryActions[0]!.automatic).toBe(true);
        expect(recoveryActions[0]!.priority).toBe(8);
        expect(recoveryActions[0]!.estimatedTime).toBe(2000);
      });
    });

    it('should indicate recoverability for network errors', () => {
      const error = new NetworkError(
        NetworkErrorCode.CONNECTION_LOST,
        'Network connection lost',
      );

      expect(error.isRecoverable()).toBe(true);
      expect(error.getAutomaticRecoveries().length).toBeGreaterThan(0);
    });
  });

  // ================================
  // Severity Consistency Behaviors
  // ================================
  describe('Severity Consistency Behaviors', () => {
    it('should assign high severity to all network errors', () => {
      const errorCodes = [
        NetworkErrorCode.CONNECTION_LOST,
        NetworkErrorCode.TIMEOUT,
        NetworkErrorCode.ASSET_LOAD_FAILED,
        NetworkErrorCode.CDN_UNAVAILABLE,
      ];

      errorCodes.forEach((code) => {
        const error = new NetworkError(code, `Test error for ${code}`);
        expect(error.severity).toBe(ErrorSeverity.HIGH);
      });
    });

    it('should maintain consistent category assignment', () => {
      const errorCodes = [
        NetworkErrorCode.CONNECTION_LOST,
        NetworkErrorCode.TIMEOUT,
        NetworkErrorCode.ASSET_LOAD_FAILED,
        NetworkErrorCode.CDN_UNAVAILABLE,
      ];

      errorCodes.forEach((code) => {
        const error = new NetworkError(code, `Test error for ${code}`);
        expect(error.category).toBe(ErrorCategory.NETWORK);
      });
    });
  });

  // ================================
  // Error Message Consistency Behaviors
  // ================================
  describe('Error Message Consistency Behaviors', () => {
    it('should provide consistent user messages across error codes', () => {
      const errorCodes = [
        NetworkErrorCode.CONNECTION_LOST,
        NetworkErrorCode.TIMEOUT,
        NetworkErrorCode.ASSET_LOAD_FAILED,
        NetworkErrorCode.CDN_UNAVAILABLE,
      ];

      const expectedUserMessage =
        'Network connection issue. Please check your internet connection.';

      errorCodes.forEach((code) => {
        const error = new NetworkError(code, `Test message for ${code}`);
        expect(error.getUserMessage()).toBe(expectedUserMessage);
      });
    });

    it('should provide technical messages with proper formatting', () => {
      const testCases = [
        {
          code: NetworkErrorCode.CONNECTION_LOST,
          message: 'Connection dropped during transfer',
          expected:
            'NETWORK_CONNECTION_LOST: Connection dropped during transfer',
        },
        {
          code: NetworkErrorCode.TIMEOUT,
          message: 'Request exceeded timeout limit',
          expected: 'NETWORK_TIMEOUT: Request exceeded timeout limit',
        },
        {
          code: NetworkErrorCode.ASSET_LOAD_FAILED,
          message: 'Asset could not be downloaded',
          expected: 'NETWORK_ASSET_LOAD_FAILED: Asset could not be downloaded',
        },
        {
          code: NetworkErrorCode.CDN_UNAVAILABLE,
          message: 'CDN service is offline',
          expected: 'NETWORK_CDN_UNAVAILABLE: CDN service is offline',
        },
      ];

      testCases.forEach(({ code, message, expected }) => {
        const error = new NetworkError(code, message);
        expect(error.getTechnicalMessage()).toBe(expected);
      });
    });
  });

  // ================================
  // Serialization and Metadata Behaviors
  // ================================
  describe('Serialization and Metadata Behaviors', () => {
    it('should serialize network errors with all metadata', () => {
      const error = new NetworkError(
        NetworkErrorCode.CONNECTION_LOST,
        'Connection lost serialization test',
        {
          currentOperation: 'Network streaming',
          performanceMetrics: {
            latency: 200,
            cpuUsage: 35,
            memoryUsage: 170,
          },
        },
      );

      const serialized = JSON.parse(JSON.stringify(error));

      expect(serialized.name).toBe('NetworkError');
      expect(serialized.code).toBe(NetworkErrorCode.CONNECTION_LOST);
      expect(serialized.category).toBe(ErrorCategory.NETWORK);
      expect(serialized.severity).toBe(ErrorSeverity.HIGH);
    });

    it('should maintain timestamp consistency', () => {
      const error = new NetworkError(
        NetworkErrorCode.TIMEOUT,
        'Timestamp test',
      );

      expect(error.timestamp).toBeDefined();
      expect(error.context.timestamp).toBeDefined();
      expect(typeof error.timestamp).toBe('number');
    });

    it('should handle complex error serialization', () => {
      const networkError = new Error('ETIMEDOUT');
      const error = new NetworkError(
        NetworkErrorCode.TIMEOUT,
        'Complex network timeout',
        {
          currentOperation: 'Audio streaming with retry',
          performanceMetrics: {
            latency: 15000,
            cpuUsage: 45,
            memoryUsage: 240,
          },
          deviceInfo: {
            platform: 'edge',
            isMobile: false,
            hasLowLatencySupport: true,
            browserVersion: '91.0',
          },
        },
        networkError,
      );

      const serialized = JSON.parse(JSON.stringify(error));
      expect(serialized.message).toBe('Complex network timeout');
      expect(serialized.context.currentOperation).toBe(
        'Audio streaming with retry',
      );
    });
  });
});
