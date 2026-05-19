/**
 * Error Handling Examples
 * Phase 5.2: Demonstrates usage of domain-specific error classes and recovery strategies
 */

import { EventBus } from '../../../services/core/EventBus.js';
import { createStructuredLogger } from '@bassnotion/contracts';
import { CircuitBreaker } from '../../../patterns/CircuitBreaker.js';
import {
  // Error classes used in the examples below
  InstrumentError,
  VoiceLimitError,
  MidiParseError,
  MidiValidationError,
  UploadError,
  CacheFullError,
  CircuitBreakerOpenError,
  ClockSyncError,

  // Error codes used in the examples below
  InstrumentErrorCode,

  // Utilities used in the examples below
  getErrorMessage,
  getErrorSeverity,
  isRecoverableError,
} from '../index.js';
import { ErrorRecoveryRegistry } from '../ErrorRecoveryRegistry.js';

const logger = createStructuredLogger('ErrorHandlingExamples');

/**
 * Example 1: Basic error handling with domain-specific errors
 */
export class InstrumentLoader {
  async loadInstrument(type: string, id: string): Promise<void> {
    try {
      // Simulate loading
      await this.performLoad(type, id);
    } catch (error) {
      // Create domain-specific error
      throw new InstrumentError(
        InstrumentErrorCode.INSTRUMENT_INIT_FAILED,
        `Failed to load ${type} instrument`,
        type,
        id,
        error as Error,
        {
          operation: 'instrument-load',
          attemptNumber: 1,
        },
      );
    }
  }

  private async performLoad(_type: string, _id: string): Promise<void> {
    // Simulate failure
    throw new Error('Network timeout');
  }
}

/**
 * Example 2: Handling errors with recovery
 */
export class AudioService {
  private eventBus = new EventBus();
  private recoveryRegistry: ErrorRecoveryRegistry;

  constructor() {
    this.recoveryRegistry = new ErrorRecoveryRegistry(this.eventBus, {
      maxRecoveryAttempts: 3,
      recoveryTimeout: 5000,
      enableMetrics: true,
      strategySelectionMode: 'adaptive',
    });

    // Listen for recovery events
    this.eventBus.on('recovery:strategy-success', (data) => {
      logger.info('Recovery successful', data);
    });
  }

  async playNote(note: number, velocity: number): Promise<void> {
    try {
      await this.performPlayNote(note, velocity);
    } catch (error) {
      // Check if error is recoverable
      if (isRecoverableError(error)) {
        const recovered = await this.recoveryRegistry.attempt(error as Error, {
          component: 'AudioService',
          operation: 'playNote',
          note,
          velocity,
        });

        if (!recovered) {
          logger.error('Recovery failed', error as Error);
          throw error;
        }
      } else {
        throw error;
      }
    }
  }

  private async performPlayNote(
    _note: number,
    _velocity: number,
  ): Promise<void> {
    // Simulate voice limit error
    throw new VoiceLimitError(32, 32, 'sampler');
  }
}

/**
 * Example 3: Circuit breaker integration
 */
export class StorageServiceWithCircuitBreaker {
  private circuitBreaker: CircuitBreaker;
  private eventBus = new EventBus();

  constructor() {
    this.circuitBreaker = new CircuitBreaker('storage-service', {
      failureThreshold: 5,
      resetTimeout: 60000,
      timeout: 10000,
    });
  }

  async uploadFile(fileName: string, data: Buffer): Promise<void> {
    try {
      await this.circuitBreaker.execute(async () => {
        await this.performUpload(fileName, data);
      });
    } catch (error) {
      // Check if circuit breaker is open
      if (this.circuitBreaker.getState() === 'open') {
        throw new CircuitBreakerOpenError(
          'storage-service',
          this.circuitBreaker.getMetrics().failureCount,
          error instanceof Error ? error.message : 'Unknown error',
        );
      }

      // Otherwise, throw specific storage error
      throw new UploadError(
        'Upload failed',
        fileName,
        data.length,
        0,
        error as Error,
      );
    }
  }

  private async performUpload(_fileName: string, _data: Buffer): Promise<void> {
    // Simulate network failure
    throw new Error('Connection refused');
  }
}

/**
 * Example 4: Error handling in MIDI processing pipeline
 */
export class MidiProcessor {
  private eventBus = new EventBus();

  async processMidiFile(fileData: ArrayBuffer): Promise<void> {
    try {
      // Parse MIDI file
      const midiData = await this.parseMidi(fileData);

      // Validate MIDI data
      await this.validateMidi(midiData);

      // Process MIDI events
      await this.processMidiEvents(midiData);
    } catch (error) {
      // Log error with appropriate severity
      const severity = getErrorSeverity(error);
      const message = getErrorMessage(error);

      logger.error('MIDI processing failed', error as Error, {
        severity,
        userMessage: message,
      });

      // Emit error event for UI handling
      this.eventBus.emit('midi:processing-error', {
        error,
        severity,
        userMessage: message,
      });

      throw error;
    }
  }

  private async parseMidi(_data: ArrayBuffer): Promise<any> {
    // Simulate parse error
    throw new MidiParseError(
      'Invalid MIDI header',
      0,
      'SMF Type 1',
      new Error('Unexpected byte sequence'),
    );
  }

  private async validateMidi(_data: any): Promise<void> {
    // Simulate validation error
    throw new MidiValidationError(
      'MIDI file contains invalid events',
      [
        { field: 'tempo', issue: 'Tempo out of range', severity: 'error' },
        { field: 'note', issue: 'Note velocity > 127', severity: 'warning' },
      ],
      42,
    );
  }

  private async processMidiEvents(_data: any): Promise<void> {
    // Process events
  }
}

/**
 * Example 5: Transport error handling with timing compensation
 */
export class TransportController {
  private eventBus = new EventBus();
  private recoveryRegistry: ErrorRecoveryRegistry;

  constructor() {
    this.recoveryRegistry = new ErrorRecoveryRegistry(this.eventBus);
  }

  async synchronizeClock(targetSampleRate: number): Promise<void> {
    try {
      await this.performClockSync(targetSampleRate);
    } catch (error) {
      if (error instanceof ClockSyncError) {
        logger.warn('Clock sync failed, attempting recovery', {
          drift: error.drift,
          threshold: error.threshold,
        });

        // Attempt recovery
        const recovered = await this.recoveryRegistry.attempt(error, {
          component: 'TransportController',
          operation: 'synchronizeClock',
          targetSampleRate,
        });

        if (!recovered) {
          // Fall back to less accurate timing
          this.eventBus.emit('transport:fallback-timing', {
            reason: 'clock-sync-failed',
            accuracy: 'reduced',
          });
        }
      }

      throw error;
    }
  }

  private async performClockSync(sampleRate: number): Promise<void> {
    // Simulate clock drift error
    throw new ClockSyncError(
      'Clock drift exceeded threshold',
      150, // 150ms drift
      100, // 100ms threshold
      sampleRate,
    );
  }
}

/**
 * Example 6: Comprehensive error handling with metrics
 */
export class PlaybackEngine {
  private eventBus = new EventBus();
  private recoveryRegistry: ErrorRecoveryRegistry;
  private errorCount = 0;
  private lastErrorTime = 0;

  constructor() {
    this.recoveryRegistry = new ErrorRecoveryRegistry(this.eventBus, {
      enableMetrics: true,
      strategySelectionMode: 'adaptive',
    });

    // Monitor error patterns
    this.eventBus.on('error:occurred', this.analyzeErrorPattern.bind(this));
  }

  async start(): Promise<void> {
    try {
      await this.initialize();
      await this.loadResources();
      await this.startPlayback();
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  private handleError(error: Error): void {
    this.errorCount++;
    const now = Date.now();

    // Track error frequency
    if (now - this.lastErrorTime < 1000) {
      logger.warn('High error frequency detected', {
        errorCount: this.errorCount,
        timeSinceLastError: now - this.lastErrorTime,
      });
    }

    this.lastErrorTime = now;

    // Emit error event
    this.eventBus.emit('error:occurred', {
      error,
      timestamp: now,
      errorCount: this.errorCount,
    });

    // Get recovery strategies stats
    const stats = this.recoveryRegistry.getStrategyStats();
    logger.info('Recovery strategy statistics', { stats });
  }

  private analyzeErrorPattern(_data: any): void {
    // Implement error pattern analysis
    // Could trigger proactive measures based on patterns
  }

  private async initialize(): Promise<void> {
    // Initialization logic
  }

  private async loadResources(): Promise<void> {
    // Simulate cache full error
    throw new CacheFullError(
      1024 * 1024 * 100, // 100MB current
      1024 * 1024 * 100, // 100MB max
      1024 * 1024 * 10, // 10MB requested
    );
  }

  private async startPlayback(): Promise<void> {
    // Playback logic
  }
}

/**
 * Example 7: Error boundary for React components
 */
export function usePlaybackErrorHandler() {
  const eventBus = new EventBus();
  const recoveryRegistry = new ErrorRecoveryRegistry(eventBus);

  const handleError = async (error: Error, errorInfo?: any) => {
    logger.error('Playback error in component', error, errorInfo);

    // Check if recoverable
    if (isRecoverableError(error)) {
      const recovered = await recoveryRegistry.attempt(error, {
        component: errorInfo?.componentStack,
        timestamp: Date.now(),
      });

      if (recovered) {
        // Trigger component re-render or state reset
        return { recovered: true, action: 'retry' };
      }
    }

    // Show user-friendly error message
    const userMessage = getErrorMessage(error);
    const severity = getErrorSeverity(error);

    return {
      recovered: false,
      userMessage,
      severity,
      showFallback: severity === 'critical',
    };
  };

  return { handleError };
}

/**
 * Example 8: Batch operation error handling
 */
export class BatchProcessor {
  async processBatch(items: any[]): Promise<void> {
    const errors: Array<{ operation: string; error: string }> = [];
    let successCount = 0;

    for (const item of items) {
      try {
        await this.processItem(item);
        successCount++;
      } catch (error) {
        errors.push({
          operation: `process-${item.id}`,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    if (errors.length > 0) {
      throw new BatchOperationError(
        'Batch processing partially failed',
        items.length,
        successCount,
        errors,
      );
    }
  }

  private async processItem(_item: any): Promise<void> {
    // Process individual item
    if (Math.random() > 0.8) {
      throw new Error('Random processing error');
    }
  }
}

// Export example usage
export function demonstrateErrorHandling() {
  logger.info('Error Handling Examples', {
    examples: [
      'InstrumentLoader - Domain-specific errors',
      'AudioService - Error recovery',
      'StorageServiceWithCircuitBreaker - Circuit breaker integration',
      'MidiProcessor - Pipeline error handling',
      'TransportController - Timing error compensation',
      'PlaybackEngine - Comprehensive error handling',
      'usePlaybackErrorHandler - React error boundary',
      'BatchProcessor - Batch operation errors',
    ],
  });
}
