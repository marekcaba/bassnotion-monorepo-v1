/**
 * ResourceError - Specialized errors for resource management issues
 *
 * Handles memory, CPU, asset loading, and system resource constraints
 * with intelligent degradation strategies.
 *
 * Part of Story 2.1: Task 1, Subtask 1.3
 */

import {
  PlaybackError,
  ErrorDetails,
  ErrorSeverity,
  ErrorCategory,
  ErrorContext,
  ErrorRecoveryAction,
  createErrorContext,
} from './base';

export enum ResourceErrorCode {
  // Memory errors
  MEMORY_ALLOCATION_FAILED = 'RESOURCE_MEMORY_ALLOCATION_FAILED',
  MEMORY_LIMIT_EXCEEDED = 'RESOURCE_MEMORY_LIMIT_EXCEEDED',
  MEMORY_LEAK_DETECTED = 'RESOURCE_MEMORY_LEAK_DETECTED',

  // Asset loading errors
  ASSET_LOADING_FAILED = 'RESOURCE_ASSET_LOADING_FAILED',
  ASSET_CORRUPTION_DETECTED = 'RESOURCE_ASSET_CORRUPTION_DETECTED',
  ASSET_SIZE_EXCEEDED = 'RESOURCE_ASSET_SIZE_EXCEEDED',

  // Audio buffer errors
  BUFFER_ALLOCATION_FAILED = 'RESOURCE_BUFFER_ALLOCATION_FAILED',
  BUFFER_UNDERRUN = 'RESOURCE_BUFFER_UNDERRUN',
  BUFFER_OVERFLOW = 'RESOURCE_BUFFER_OVERFLOW',

  // System resource errors
  CPU_QUOTA_EXCEEDED = 'RESOURCE_CPU_QUOTA_EXCEEDED',
  DISK_SPACE_INSUFFICIENT = 'RESOURCE_DISK_SPACE_INSUFFICIENT',
  CONCURRENT_LIMIT_EXCEEDED = 'RESOURCE_CONCURRENT_LIMIT_EXCEEDED',
}

export class ResourceError extends PlaybackError {
  public readonly resourceType?: 'memory' | 'asset' | 'buffer' | 'cpu' | 'disk';
  public readonly requestedSize?: number;
  public readonly availableSize?: number;
  public readonly utilizationPercentage?: number;

  constructor(
    code: ResourceErrorCode,
    message: string,
    context: Partial<ErrorContext> = {},
    cause?: Error,
  ) {
    const recoveryActions = getResourceRecoveryActions(code);
    const severity = getResourceSeverity(code);

    const errorDetails: ErrorDetails = {
      code,
      message,
      severity,
      category: ErrorCategory.RESOURCE,
      context: createErrorContext(context),
      recoveryActions,
      userMessage: getResourceUserMessage(code),
      technicalMessage: getResourceTechnicalMessage(code, message),
      documentationUrl: getResourceDocumentationUrl(code),
    };

    super(errorDetails, cause);
    this.name = 'ResourceError';

    // Extract resource-specific context
    this.resourceType = this.extractResourceType(code);
    this.extractResourceMetrics(context);
  }

  private extractResourceType(
    code: ResourceErrorCode,
  ): 'memory' | 'asset' | 'buffer' | 'cpu' | 'disk' {
    if (code.includes('MEMORY')) return 'memory';
    if (code.includes('ASSET')) return 'asset';
    if (code.includes('BUFFER')) return 'buffer';
    if (code.includes('CPU')) return 'cpu';
    if (code.includes('DISK')) return 'disk';
    return 'memory';
  }

  private extractResourceMetrics(context: Partial<ErrorContext>): void {
    const metrics = context.performanceMetrics;
    if (metrics) {
      (this as any).requestedSize = metrics.requestedSize;
      (this as any).availableSize = metrics.availableSize;
      (this as any).utilizationPercentage = metrics.utilizationPercentage;
    }
  }
}

function getResourceRecoveryActions(
  code: ResourceErrorCode,
): ErrorRecoveryAction[] {
  const actions: ErrorRecoveryAction[] = [];

  switch (code) {
    case ResourceErrorCode.MEMORY_LIMIT_EXCEEDED:
      actions.push({
        type: 'degrade',
        description: 'Clear audio buffer cache',
        automatic: true,
        priority: 9,
        estimatedTime: 500,
      });
      actions.push({
        type: 'degrade',
        description: 'Reduce audio quality',
        automatic: true,
        priority: 8,
      });
      break;

    case ResourceErrorCode.ASSET_LOADING_FAILED:
      actions.push({
        type: 'retry',
        description: 'Retry asset loading',
        automatic: true,
        priority: 8,
        estimatedTime: 2000,
      });
      actions.push({
        type: 'fallback',
        description: 'Use fallback assets',
        automatic: true,
        priority: 6,
      });
      break;

    case ResourceErrorCode.BUFFER_UNDERRUN:
      actions.push({
        type: 'degrade',
        description: 'Increase buffer size',
        automatic: true,
        priority: 9,
        estimatedTime: 1000,
      });
      break;

    default:
      actions.push({
        type: 'retry',
        description: 'Retry with reduced resource usage',
        automatic: true,
        priority: 5,
      });
  }

  return actions;
}

function getResourceSeverity(code: ResourceErrorCode): ErrorSeverity {
  const criticalErrors = [
    ResourceErrorCode.MEMORY_ALLOCATION_FAILED,
    ResourceErrorCode.BUFFER_ALLOCATION_FAILED,
  ];

  if (criticalErrors.includes(code)) {
    return ErrorSeverity.CRITICAL;
  }

  return ErrorSeverity.HIGH;
}

function getResourceUserMessage(code: ResourceErrorCode): string {
  switch (code) {
    case ResourceErrorCode.MEMORY_LIMIT_EXCEEDED:
      return 'Insufficient memory for audio processing. Please close other applications.';

    case ResourceErrorCode.ASSET_LOADING_FAILED:
      return 'Failed to load audio content. Please check your internet connection.';

    default:
      return 'System resource issue detected. Performance may be reduced.';
  }
}

function getResourceTechnicalMessage(
  code: ResourceErrorCode,
  originalMessage: string,
): string {
  return `${code}: ${originalMessage}`;
}

function getResourceDocumentationUrl(_code: ResourceErrorCode): string {
  return '/docs/troubleshooting/resource-management';
}

export function createResourceError(
  code: ResourceErrorCode,
  message: string,
  additionalContext: Partial<ErrorContext> = {},
  cause?: Error,
): ResourceError {
  const context: Partial<ErrorContext> = {
    currentOperation: 'Resource management',
    ...additionalContext,
  };

  return new ResourceError(code, message, context, cause);
}
