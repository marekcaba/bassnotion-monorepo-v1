/**
 * CommandQueue - Command Execution and History Management
 * Story 3.18.4: Service Architecture Implementation
 *
 * Manages command execution, queuing, history, and undo/redo functionality.
 */

import { Command, CommandResult, ICommand } from './Command.js';
import { EventBus } from '../services/core/EventBus.js';
import { CircuitBreaker } from '../services/errors/CircuitBreaker.js';
import { createStructuredLogger } from '@bassnotion/contracts';

export interface CommandQueueConfig {
  maxHistorySize?: number;
  maxQueueSize?: number;
  executionTimeout?: number;
  enableBatching?: boolean;
  batchSize?: number;
  batchTimeout?: number;
  circuitBreakerConfig?: {
    failureThreshold?: number;
    recoveryTimeout?: number;
  };
}

export interface QueuedCommand {
  command: ICommand;
  priority: number;
  timestamp: number;
  callback?: (result: CommandResult) => void;
}

export interface CommandQueueStats {
  executed: number;
  undone: number;
  redone: number;
  failed: number;
  queued: number;
  historySize: number;
}

export class CommandQueue {
  private history: ICommand[] = [];
  private redoStack: ICommand[] = [];
  private queue: QueuedCommand[] = [];
  private isProcessing = false;
  private config: Required<CommandQueueConfig>;
  private eventBus: EventBus;
  private circuitBreaker: CircuitBreaker;
  private stats: CommandQueueStats = {
    executed: 0,
    undone: 0,
    redone: 0,
    failed: 0,
    queued: 0,
    historySize: 0,
  };
  private batchTimer: NodeJS.Timeout | null = null;
  private currentBatch: QueuedCommand[] = [];

  constructor(eventBus: EventBus, config: CommandQueueConfig = {}) {
    this.eventBus = eventBus;
    this.config = {
      maxHistorySize: config.maxHistorySize || 100,
      maxQueueSize: config.maxQueueSize || 1000,
      executionTimeout: config.executionTimeout || 30000, // 30 seconds
      enableBatching: config.enableBatching || false,
      batchSize: config.batchSize || 10,
      batchTimeout: config.batchTimeout || 100, // ms
      circuitBreakerConfig: config.circuitBreakerConfig || {
        failureThreshold: 5,
        recoveryTimeout: 60000, // 1 minute
      },
    };

    this.circuitBreaker = new CircuitBreaker(
      'CommandQueue',
      this.config.circuitBreakerConfig,
    );
  }

  /**
   * Execute a command immediately
   */
  async execute(command: ICommand, priority = 0): Promise<CommandResult> {
    // Clear redo stack when executing new command
    this.redoStack = [];

    return this.circuitBreaker.execute(async () => {
      try {
        // Validate command
        if (!(await command.validate())) {
          throw new Error(
            `Command validation failed: ${command.metadata.name}`,
          );
        }

        // Execute with timeout
        const result = await this.executeWithTimeout(command);

        if (result.success) {
          // Add to history
          this.addToHistory(command);
          this.stats.executed++;
          this.updateStats();

          // Emit success event
          this.eventBus.emit('commandqueue:executed', {
            command: command.metadata,
            result,
          });
        } else {
          this.stats.failed++;
          this.updateStats();

          // Emit failure event
          this.eventBus.emit('commandqueue:failed', {
            command: command.metadata,
            error: result.error,
          });
        }

        return result;
      } catch (error) {
        this.stats.failed++;
        this.updateStats();

        const result: CommandResult = {
          success: false,
          error:
            error instanceof Error
              ? error
              : new Error('Command execution failed'),
          timestamp: Date.now(),
        };

        this.eventBus.emit('commandqueue:error', {
          command: command.metadata,
          error: result.error,
        });

        throw error; // Re-throw for circuit breaker
      }
    });
  }

  /**
   * Queue a command for later execution
   */
  async enqueue(command: ICommand, priority = 0): Promise<void> {
    if (this.queue.length >= this.config.maxQueueSize) {
      throw new Error('Command queue is full');
    }

    const queuedCommand: QueuedCommand = {
      command,
      priority,
      timestamp: Date.now(),
    };

    // Insert based on priority
    const insertIndex = this.queue.findIndex(
      (item) => item.priority < priority,
    );
    if (insertIndex === -1) {
      this.queue.push(queuedCommand);
    } else {
      this.queue.splice(insertIndex, 0, queuedCommand);
    }

    this.stats.queued = this.queue.length;
    this.updateStats();

    this.eventBus.emit('commandqueue:enqueued', {
      command: command.metadata,
      queueSize: this.queue.length,
    });

    // Process queue if not already processing
    if (!this.isProcessing) {
      if (this.config.enableBatching) {
        this.scheduleBatchExecution();
      } else {
        await this.processQueue();
      }
    }
  }

  /**
   * Process queued commands
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        const queuedCommand = this.queue.shift()!;
        this.stats.queued = this.queue.length;

        try {
          const result = await this.execute(
            queuedCommand.command,
            queuedCommand.priority,
          );

          if (queuedCommand.callback) {
            queuedCommand.callback(result);
          }
        } catch (error) {
          // Continue processing even if one command fails
          logger.error('Command execution failed:', error);
        }
      }
    } finally {
      this.isProcessing = false;
      this.updateStats();
    }
  }

  /**
   * Schedule batch execution
   */
  private scheduleBatchExecution(): void {
    // Execute immediately if batch size is reached
    if (this.queue.length >= this.config.batchSize) {
      this.executeBatch();
      return;
    }

    if (this.batchTimer) {
      return;
    }

    this.batchTimer = setTimeout(() => {
      this.executeBatch();
    }, this.config.batchTimeout);
  }

  /**
   * Execute commands in batch
   */
  private async executeBatch(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.queue.length === 0) {
      return;
    }

    // Take up to batchSize commands
    const batch = this.queue.splice(0, this.config.batchSize);
    this.stats.queued = this.queue.length;

    // Execute batch
    const results = await Promise.allSettled(
      batch.map((queuedCommand) =>
        this.execute(queuedCommand.command, queuedCommand.priority),
      ),
    );

    // Handle callbacks
    batch.forEach((queuedCommand, index) => {
      if (queuedCommand.callback) {
        const result = results[index];
        if (result.status === 'fulfilled') {
          queuedCommand.callback(result.value);
        } else {
          queuedCommand.callback({
            success: false,
            error: result.reason,
            timestamp: Date.now(),
          });
        }
      }
    });

    // Continue processing if more commands in queue
    if (this.queue.length > 0) {
      this.scheduleBatchExecution();
    }

    this.updateStats();
  }

  /**
   * Undo the last executed command
   */
  async undo(): Promise<CommandResult | null> {
    if (this.history.length === 0) {
      return null;
    }

    const command = this.history.pop()!;

    try {
      const result = await this.executeWithTimeout(() => command.undo());

      if (result.success) {
        this.redoStack.push(command);
        this.stats.undone++;
        this.stats.historySize = this.history.length;
        this.updateStats();

        this.eventBus.emit('commandqueue:undone', {
          command: command.metadata,
          result,
        });
      }

      return result;
    } catch (error) {
      // Put command back in history if undo fails
      this.history.push(command);
      throw error;
    }
  }

  /**
   * Redo the last undone command
   */
  async redo(): Promise<CommandResult | null> {
    if (this.redoStack.length === 0) {
      return null;
    }

    const command = this.redoStack.pop()!;

    try {
      const result = await this.execute(command);

      if (result.success) {
        this.stats.redone++;
        this.updateStats();

        this.eventBus.emit('commandqueue:redone', {
          command: command.metadata,
          result,
        });
      }

      return result;
    } catch (error) {
      // Put command back in redo stack if execution fails
      this.redoStack.push(command);
      throw error;
    }
  }

  /**
   * Execute command with timeout
   */
  private async executeWithTimeout(
    commandOrFunction: ICommand | (() => Promise<CommandResult>),
  ): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Command execution timeout'));
      }, this.config.executionTimeout);

      const executePromise =
        typeof commandOrFunction === 'function'
          ? commandOrFunction()
          : commandOrFunction.execute();

      executePromise
        .then((result) => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Add command to history
   */
  private addToHistory(command: ICommand): void {
    this.history.push(command);

    // Trim history if it exceeds max size
    if (this.history.length > this.config.maxHistorySize) {
      this.history.shift();
    }

    this.stats.historySize = this.history.length;
  }

  /**
   * Update statistics
   */
  private updateStats(): void {
    this.eventBus.emit('commandqueue:stats-updated', this.stats);
  }

  /**
   * Get current statistics
   */
  getStats(): CommandQueueStats {
    return { ...this.stats };
  }

  /**
   * Get command history
   */
  getHistory(): ICommand[] {
    return [...this.history];
  }

  /**
   * Get redo stack
   */
  getRedoStack(): ICommand[] {
    return [...this.redoStack];
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
    this.redoStack = [];
    this.stats.historySize = 0;
    this.updateStats();

    this.eventBus.emit('commandqueue:history-cleared', {});
  }

  /**
   * Clear queue
   */
  clearQueue(): void {
    this.queue = [];
    this.stats.queued = 0;

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    this.updateStats();
    this.eventBus.emit('commandqueue:queue-cleared', {});
  }

  /**
   * Can undo
   */
  canUndo(): boolean {
    return (
      this.history.length > 0 && this.history[this.history.length - 1].canUndo()
    );
  }

  /**
   * Can redo
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Get circuit breaker metrics
   */
  getCircuitBreakerMetrics(): any {
    return this.circuitBreaker.getMetrics();
  }
}
