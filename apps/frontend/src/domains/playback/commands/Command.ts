/**
 * Command - Base Command Pattern Implementation
 * Story 3.18.4: Service Architecture Implementation
 *
 * Base interface and abstract class for all commands in the system.
 * Enables undo/redo functionality and command history tracking.
 */

export interface CommandMetadata {
  id: string;
  name: string;
  timestamp: number;
  userId?: string;
  context?: Record<string, any>;
}

export interface CommandResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
  timestamp: number;
}

export interface ICommand<T = any> {
  metadata: CommandMetadata;
  execute(): Promise<CommandResult<T>>;
  undo(): Promise<CommandResult<T>>;
  canUndo(): boolean;
  canExecute(): boolean;
  validate(): Promise<boolean>;
}

export abstract class Command<T = any> implements ICommand<T> {
  public readonly metadata: CommandMetadata;
  protected executed = false;
  protected undone = false;
  protected result?: CommandResult<T>;

  constructor(name: string, context?: Record<string, any>) {
    this.metadata = {
      id: this.generateCommandId(),
      name,
      timestamp: Date.now(),
      context,
    };
  }

  /**
   * Execute the command
   */
  abstract execute(): Promise<CommandResult<T>>;

  /**
   * Undo the command
   */
  abstract undo(): Promise<CommandResult<T>>;

  /**
   * Check if command can be undone
   */
  canUndo(): boolean {
    return this.executed && !this.undone;
  }

  /**
   * Check if command can be executed
   */
  canExecute(): boolean {
    return !this.executed || this.undone;
  }

  /**
   * Reset command state for re-execution
   */
  protected resetForReExecution(): void {
    this.executed = false;
    this.undone = false;
    this.result = undefined;
  }

  /**
   * Validate command before execution
   */
  async validate(): Promise<boolean> {
    return true; // Override in subclasses for specific validation
  }

  /**
   * Mark command as executed
   */
  protected markExecuted(result: CommandResult<T>): void {
    this.executed = true;
    this.undone = false;
    this.result = result;
  }

  /**
   * Mark command as undone
   */
  protected markUndone(result: CommandResult<T>): void {
    this.undone = true;
    this.result = result;
  }

  /**
   * Generate unique command ID
   */
  private generateCommandId(): string {
    return `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get command execution result
   */
  getResult(): CommandResult<T> | undefined {
    return this.result;
  }

  /**
   * Clone command for re-execution
   */
  abstract clone(): Command<T>;
}

/**
 * Composite command for executing multiple commands as one
 */
export class CompositeCommand<T = any> extends Command<T[]> {
  private commands: Command<any>[] = [];

  constructor(name: string, commands: Command<any>[] = []) {
    super(name);
    this.commands = commands;
  }

  /**
   * Add command to composite
   */
  addCommand(command: Command<any>): void {
    this.commands.push(command);
  }

  /**
   * Execute all commands in order
   */
  async execute(): Promise<CommandResult<T[]>> {
    if (!this.canExecute()) {
      return {
        success: false,
        error: new Error('Command already executed'),
        timestamp: Date.now(),
      };
    }

    const results: T[] = [];
    const executedCommands: Command<any>[] = [];

    try {
      for (const command of this.commands) {
        const result = await command.execute();
        if (!result.success) {
          // Rollback on failure
          for (const executed of executedCommands.reverse()) {
            try {
              await executed.undo();
            } catch (rollbackError) {
              // Log rollback failure but continue with other rollbacks
              logger.error(
                `Failed to rollback command ${executed.metadata.name}:`,
                rollbackError,
              );
            }
          }
          return {
            success: false,
            error: result.error,
            timestamp: Date.now(),
          };
        }
        results.push(result.data);
        executedCommands.push(command);
      }

      const result = {
        success: true,
        data: results,
        timestamp: Date.now(),
      };
      this.markExecuted(result);
      return result;
    } catch (error) {
      // Rollback on exception
      for (const executed of executedCommands.reverse()) {
        try {
          await executed.undo();
        } catch (rollbackError) {
          // Log rollback failure but continue with other rollbacks
          logger.error(
            `Failed to rollback command ${executed.metadata.name}:`,
            rollbackError,
          );
        }
      }
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Undo all commands in reverse order
   */
  async undo(): Promise<CommandResult<T[]>> {
    if (!this.canUndo()) {
      return {
        success: false,
        error: new Error('Command not executed or already undone'),
        timestamp: Date.now(),
      };
    }

    const results: T[] = [];

    try {
      for (const command of this.commands.slice().reverse()) {
        const result = await command.undo();
        if (!result.success) {
          return {
            success: false,
            error: result.error,
            timestamp: Date.now(),
          };
        }
        results.push(result.data);
      }

      const result = {
        success: true,
        data: results,
        timestamp: Date.now(),
      };
      this.markUndone(result);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Validate all commands
   */
  async validate(): Promise<boolean> {
    for (const command of this.commands) {
      if (!(await command.validate())) {
        return false;
      }
    }
    return true;
  }

  /**
   * Clone composite command
   */
  clone(): CompositeCommand<T> {
    return new CompositeCommand(
      this.metadata.name,
      this.commands.map((cmd) => cmd.clone()),
    );
  }
}
