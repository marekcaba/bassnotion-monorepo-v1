/**
 * CommandHistory - Command History Tracking and Persistence
 * Story 3.18.4: Service Architecture Implementation
 * 
 * Tracks command execution history with persistence and audit trail capabilities.
 */

import { ICommand, CommandMetadata, CommandResult } from './Command.js';
import { EventBus } from '../services/core/EventBus.js';

export interface CommandHistoryEntry {
  id: string;
  command: CommandMetadata;
  result: CommandResult;
  executedAt: number;
  undoneAt?: number;
  redoneAt?: number;
  userId?: string;
  sessionId: string;
}

export interface CommandHistoryConfig {
  maxEntries?: number;
  persistenceEnabled?: boolean;
  persistenceKey?: string;
  sessionId?: string;
}

export interface CommandHistoryStats {
  totalCommands: number;
  successfulCommands: number;
  failedCommands: number;
  undoneCommands: number;
  redoneCommands: number;
  averageExecutionTime: number;
  commandFrequency: Record<string, number>;
}

export interface CommandAuditReport {
  entries: CommandHistoryEntry[];
  stats: CommandHistoryStats;
  timeRange: {
    start: number;
    end: number;
  };
  generatedAt: number;
}

export class CommandHistory {
  private entries: CommandHistoryEntry[] = [];
  private config: Required<CommandHistoryConfig>;
  private eventBus: EventBus;
  private sessionId: string;
  private commandFrequency = new Map<string, number>();
  private totalExecutionTime = 0;

  constructor(eventBus: EventBus, config: CommandHistoryConfig = {}) {
    this.eventBus = eventBus;
    this.sessionId = config.sessionId || this.generateSessionId();
    this.config = {
      maxEntries: config.maxEntries || 1000,
      persistenceEnabled: config.persistenceEnabled || false,
      persistenceKey: config.persistenceKey || 'commandHistory',
      sessionId: this.sessionId,
    };

    // Load persisted history if enabled
    if (this.config.persistenceEnabled) {
      this.loadFromStorage();
    }

    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Record command execution
   */
  recordExecution(command: ICommand, result: CommandResult, userId?: string): void {
    const entry: CommandHistoryEntry = {
      id: this.generateEntryId(),
      command: command.metadata,
      result,
      executedAt: Date.now(),
      userId,
      sessionId: this.sessionId,
    };

    this.addEntry(entry);
    this.updateCommandFrequency(command.metadata.name);
    
    if (result.success && entry.executedAt && command.metadata.timestamp) {
      this.totalExecutionTime += entry.executedAt - command.metadata.timestamp;
    }

    this.eventBus.emit('commandhistory:recorded', { entry });
  }

  /**
   * Record command undo
   */
  recordUndo(command: ICommand, result: CommandResult): void {
    const entry = this.findLatestEntry(command.metadata.id);
    if (entry) {
      entry.undoneAt = Date.now();
      this.persist();
      this.eventBus.emit('commandhistory:undo-recorded', { entry });
    }
  }

  /**
   * Record command redo
   */
  recordRedo(command: ICommand, result: CommandResult): void {
    const entry = this.findLatestEntry(command.metadata.id);
    if (entry) {
      entry.redoneAt = Date.now();
      this.persist();
      this.eventBus.emit('commandhistory:redo-recorded', { entry });
    }
  }

  /**
   * Get command history
   */
  getHistory(filter?: {
    startTime?: number;
    endTime?: number;
    commandName?: string;
    userId?: string;
    sessionId?: string;
    onlySuccessful?: boolean;
  }): CommandHistoryEntry[] {
    let filtered = [...this.entries];

    if (filter) {
      if (filter.startTime) {
        filtered = filtered.filter(entry => entry.executedAt >= filter.startTime!);
      }
      if (filter.endTime) {
        filtered = filtered.filter(entry => entry.executedAt <= filter.endTime!);
      }
      if (filter.commandName) {
        filtered = filtered.filter(entry => entry.command.name === filter.commandName);
      }
      if (filter.userId) {
        filtered = filtered.filter(entry => entry.userId === filter.userId);
      }
      if (filter.sessionId) {
        filtered = filtered.filter(entry => entry.sessionId === filter.sessionId);
      }
      if (filter.onlySuccessful) {
        filtered = filtered.filter(entry => entry.result.success);
      }
    }

    return filtered;
  }

  /**
   * Get statistics
   */
  getStats(): CommandHistoryStats {
    const successful = this.entries.filter(entry => entry.result.success).length;
    const failed = this.entries.length - successful;
    const undone = this.entries.filter(entry => entry.undoneAt).length;
    const redone = this.entries.filter(entry => entry.redoneAt).length;

    const commandFrequency: Record<string, number> = {};
    this.commandFrequency.forEach((count, command) => {
      commandFrequency[command] = count;
    });

    return {
      totalCommands: this.entries.length,
      successfulCommands: successful,
      failedCommands: failed,
      undoneCommands: undone,
      redoneCommands: redone,
      averageExecutionTime: this.entries.length > 0 
        ? this.totalExecutionTime / this.entries.length 
        : 0,
      commandFrequency,
    };
  }

  /**
   * Generate audit report
   */
  generateAuditReport(
    startTime?: number,
    endTime?: number,
    filter?: Parameters<typeof this.getHistory>[0]
  ): CommandAuditReport {
    const entries = this.getHistory({
      ...filter,
      startTime: startTime || (this.entries[0]?.executedAt || Date.now()),
      endTime: endTime || Date.now(),
    });

    const stats = this.calculateStatsForEntries(entries);

    return {
      entries,
      stats,
      timeRange: {
        start: startTime || (entries[0]?.executedAt || Date.now()),
        end: endTime || Date.now(),
      },
      generatedAt: Date.now(),
    };
  }

  /**
   * Export history to JSON
   */
  exportToJSON(): string {
    return JSON.stringify({
      sessionId: this.sessionId,
      entries: this.entries,
      stats: this.getStats(),
      exportedAt: Date.now(),
    }, null, 2);
  }

  /**
   * Import history from JSON
   */
  importFromJSON(json: string): void {
    try {
      const data = JSON.parse(json);
      if (data.entries && Array.isArray(data.entries)) {
        this.entries = data.entries;
        this.rebuildFrequencyMap();
        this.persist();
        this.eventBus.emit('commandhistory:imported', {
          entriesCount: this.entries.length,
        });
      }
    } catch (error) {
      throw new Error(`Failed to import command history: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
    }
  }

  /**
   * Clear history
   */
  clear(): void {
    this.entries = [];
    this.commandFrequency.clear();
    this.totalExecutionTime = 0;
    this.persist();
    this.eventBus.emit('commandhistory:cleared', {});
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for command execution events from CommandQueue
    this.eventBus.on('commandqueue:executed', (data) => {
      // Extract command and result from event data
      // This would be implemented based on actual event structure
    });

    this.eventBus.on('commandqueue:undone', (data) => {
      // Extract command and result from event data
    });

    this.eventBus.on('commandqueue:redone', (data) => {
      // Extract command and result from event data
    });
  }

  /**
   * Add entry to history
   */
  private addEntry(entry: CommandHistoryEntry): void {
    this.entries.push(entry);

    // Trim history if it exceeds max size
    if (this.entries.length > this.config.maxEntries) {
      this.entries.shift();
    }

    this.persist();
  }

  /**
   * Find latest entry for command
   */
  private findLatestEntry(commandId: string): CommandHistoryEntry | undefined {
    return this.entries
      .slice()
      .reverse()
      .find(entry => entry.command.id === commandId);
  }

  /**
   * Update command frequency
   */
  private updateCommandFrequency(commandName: string): void {
    const current = this.commandFrequency.get(commandName) || 0;
    this.commandFrequency.set(commandName, current + 1);
  }

  /**
   * Rebuild frequency map from entries
   */
  private rebuildFrequencyMap(): void {
    this.commandFrequency.clear();
    this.totalExecutionTime = 0;

    this.entries.forEach(entry => {
      this.updateCommandFrequency(entry.command.name);
      if (entry.result.success && entry.executedAt && entry.command.timestamp) {
        this.totalExecutionTime += entry.executedAt - entry.command.timestamp;
      }
    });
  }

  /**
   * Calculate stats for specific entries
   */
  private calculateStatsForEntries(entries: CommandHistoryEntry[]): CommandHistoryStats {
    const successful = entries.filter(entry => entry.result.success).length;
    const failed = entries.length - successful;
    const undone = entries.filter(entry => entry.undoneAt).length;
    const redone = entries.filter(entry => entry.redoneAt).length;

    const commandFrequency: Record<string, number> = {};
    entries.forEach(entry => {
      commandFrequency[entry.command.name] = (commandFrequency[entry.command.name] || 0) + 1;
    });

    let totalTime = 0;
    entries.forEach(entry => {
      if (entry.result.success && entry.executedAt && entry.command.timestamp) {
        totalTime += entry.executedAt - entry.command.timestamp;
      }
    });

    return {
      totalCommands: entries.length,
      successfulCommands: successful,
      failedCommands: failed,
      undoneCommands: undone,
      redoneCommands: redone,
      averageExecutionTime: entries.length > 0 ? totalTime / entries.length : 0,
      commandFrequency,
    };
  }

  /**
   * Persist to storage
   */
  private persist(): void {
    if (!this.config.persistenceEnabled) {
      return;
    }

    try {
      const data = JSON.stringify(this.entries);
      localStorage.setItem(this.config.persistenceKey, data);
    } catch (error) {
      console.error('Failed to persist command history:', error);
    }
  }

  /**
   * Load from storage
   */
  private loadFromStorage(): void {
    if (!this.config.persistenceEnabled) {
      return;
    }

    try {
      const data = localStorage.getItem(this.config.persistenceKey);
      if (data) {
        this.entries = JSON.parse(data);
        this.rebuildFrequencyMap();
      }
    } catch (error) {
      console.error('Failed to load command history:', error);
    }
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate entry ID
   */
  private generateEntryId(): string {
    return `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}