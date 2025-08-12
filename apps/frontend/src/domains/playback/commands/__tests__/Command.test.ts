/**
 * Command Pattern Tests
 * Story 3.18.4: Service Architecture Implementation
 * 
 * Tests for base Command class and CompositeCommand
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Command, CompositeCommand, CommandResult } from '../Command.js';

// Test implementation of Command
class TestCommand extends Command<string> {
  private executeCount = 0;
  private undoCount = 0;
  
  constructor(
    private value: string,
    private shouldFail = false
  ) {
    super('test-command', { value });
  }

  async execute(): Promise<CommandResult<string>> {
    if (!this.canExecute()) {
      return {
        success: false,
        error: new Error('Command already executed'),
        timestamp: Date.now(),
      };
    }

    if (this.shouldFail) {
      return {
        success: false,
        error: new Error('Command failed'),
        timestamp: Date.now(),
      };
    }

    this.executeCount++;
    const result = {
      success: true,
      data: `Executed: ${this.value}`,
      timestamp: Date.now(),
    };
    this.markExecuted(result);
    return result;
  }

  async undo(): Promise<CommandResult<string>> {
    if (!this.canUndo()) {
      return {
        success: false,
        error: new Error('Command not executed or already undone'),
        timestamp: Date.now(),
      };
    }

    this.undoCount++;
    const result = {
      success: true,
      data: `Undone: ${this.value}`,
      timestamp: Date.now(),
    };
    this.markUndone(result);
    return result;
  }

  clone(): TestCommand {
    return new TestCommand(this.value, this.shouldFail);
  }

  getExecuteCount(): number {
    return this.executeCount;
  }

  getUndoCount(): number {
    return this.undoCount;
  }
}

describe('Command', () => {
  describe('Basic Command Operations', () => {
    it('should execute command successfully', async () => {
      const command = new TestCommand('test');
      
      const result = await command.execute();
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('Executed: test');
      expect(command.canExecute()).toBe(false);
      expect(command.canUndo()).toBe(true);
    });

    it('should prevent double execution', async () => {
      const command = new TestCommand('test');
      
      await command.execute();
      const result = await command.execute();
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('already executed');
    });

    it('should undo executed command', async () => {
      const command = new TestCommand('test');
      
      await command.execute();
      const undoResult = await command.undo();
      
      expect(undoResult.success).toBe(true);
      expect(undoResult.data).toBe('Undone: test');
      expect(command.canUndo()).toBe(false);
      expect(command.canExecute()).toBe(true);
    });

    it('should prevent undo on non-executed command', async () => {
      const command = new TestCommand('test');
      
      const result = await command.undo();
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('not executed');
    });

    it('should handle failed execution', async () => {
      const command = new TestCommand('test', true);
      
      const result = await command.execute();
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Command failed');
      expect(command.canExecute()).toBe(true); // Can retry
      expect(command.canUndo()).toBe(false);
    });

    it('should store and retrieve result', async () => {
      const command = new TestCommand('test');
      
      expect(command.getResult()).toBeUndefined();
      
      const executeResult = await command.execute();
      expect(command.getResult()).toEqual(executeResult);
      
      const undoResult = await command.undo();
      expect(command.getResult()).toEqual(undoResult);
    });

    it('should have unique metadata', () => {
      const command1 = new TestCommand('test1');
      const command2 = new TestCommand('test2');
      
      expect(command1.metadata.id).not.toBe(command2.metadata.id);
      expect(command1.metadata.name).toBe('test-command');
      expect(command1.metadata.timestamp).toBeDefined();
      expect(command1.metadata.context).toEqual({ value: 'test1' });
    });

    it('should validate before execution', async () => {
      const command = new TestCommand('test');
      
      const isValid = await command.validate();
      expect(isValid).toBe(true);
    });

    it('should clone command', () => {
      const original = new TestCommand('test');
      const clone = original.clone();
      
      expect(clone).not.toBe(original);
      expect(clone.metadata.name).toBe(original.metadata.name);
      expect(clone.metadata.context).toEqual(original.metadata.context);
    });
  });

  describe('Composite Command', () => {
    let command1: TestCommand;
    let command2: TestCommand;
    let command3: TestCommand;
    let composite: CompositeCommand;

    beforeEach(() => {
      command1 = new TestCommand('cmd1');
      command2 = new TestCommand('cmd2');
      command3 = new TestCommand('cmd3');
      composite = new CompositeCommand('composite', [command1, command2, command3]);
    });

    it('should execute all commands in order', async () => {
      const result = await composite.execute();
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      expect(result.data?.[0]).toBe('Executed: cmd1');
      expect(result.data?.[1]).toBe('Executed: cmd2');
      expect(result.data?.[2]).toBe('Executed: cmd3');
      
      expect(command1.getExecuteCount()).toBe(1);
      expect(command2.getExecuteCount()).toBe(1);
      expect(command3.getExecuteCount()).toBe(1);
    });

    it('should undo all commands in reverse order', async () => {
      await composite.execute();
      const result = await composite.undo();
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      expect(result.data?.[0]).toBe('Undone: cmd3'); // Reverse order
      expect(result.data?.[1]).toBe('Undone: cmd2');
      expect(result.data?.[2]).toBe('Undone: cmd1');
      
      expect(command1.getUndoCount()).toBe(1);
      expect(command2.getUndoCount()).toBe(1);
      expect(command3.getUndoCount()).toBe(1);
    });

    it('should rollback on failure', async () => {
      const failingCommand = new TestCommand('failing', true);
      const composite = new CompositeCommand('composite', [
        command1,
        command2,
        failingCommand,
        command3,
      ]);
      
      const result = await composite.execute();
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Command failed');
      
      // First two should have been executed and then undone
      expect(command1.getExecuteCount()).toBe(1);
      expect(command2.getExecuteCount()).toBe(1);
      expect(command1.getUndoCount()).toBe(1);
      expect(command2.getUndoCount()).toBe(1);
      
      // Last command should not have been executed
      expect(command3.getExecuteCount()).toBe(0);
    });

    it('should handle rollback failures gracefully', async () => {
      // Create command that fails to undo
      const badCommand = new TestCommand('bad');
      badCommand.undo = vi.fn().mockRejectedValue(new Error('Undo failed'));
      
      const failingCommand = new TestCommand('failing', true);
      const composite = new CompositeCommand('composite', [
        badCommand,
        failingCommand,
      ]);
      
      await composite.execute();
      
      // Even though rollback failed, execute should still return the original error
      expect(badCommand.undo).toHaveBeenCalled();
    });

    it('should add commands dynamically', async () => {
      const composite = new CompositeCommand('composite');
      
      composite.addCommand(command1);
      composite.addCommand(command2);
      
      const result = await composite.execute();
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('should validate all sub-commands', async () => {
      const invalidCommand = new TestCommand('invalid');
      invalidCommand.validate = vi.fn().mockResolvedValue(false);
      
      const composite = new CompositeCommand('composite', [
        command1,
        invalidCommand,
      ]);
      
      const isValid = await composite.validate();
      expect(isValid).toBe(false);
    });

    it('should clone composite command with all sub-commands', () => {
      const clone = composite.clone();
      
      expect(clone).not.toBe(composite);
      expect(clone.metadata.name).toBe('composite');
      
      // Execute clone and verify original commands are not affected
      clone.execute();
      expect(command1.getExecuteCount()).toBe(0);
    });

    it('should prevent double execution of composite', async () => {
      await composite.execute();
      const result = await composite.execute();
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('already executed');
    });

    it('should handle empty composite command', async () => {
      const empty = new CompositeCommand('empty');
      
      const result = await empty.execute();
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should handle exceptions during execution', async () => {
      const throwingCommand = new TestCommand('throwing');
      throwingCommand.execute = vi.fn().mockRejectedValue(new Error('Unexpected error'));
      
      const composite = new CompositeCommand('composite', [
        command1,
        throwingCommand,
        command2,
      ]);
      
      const result = await composite.execute();
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Unexpected error');
      
      // Should have rolled back command1
      expect(command1.getUndoCount()).toBe(1);
      // command2 should not have executed
      expect(command2.getExecuteCount()).toBe(0);
    });

    it('should fail undo if composite not executed', async () => {
      const result = await composite.undo();
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('not executed');
    });

    it('should handle partial undo failures', async () => {
      await composite.execute();
      
      // Make one command fail to undo
      command2.undo = vi.fn().mockResolvedValue({
        success: false,
        error: new Error('Undo failed'),
        timestamp: Date.now(),
      });
      
      const result = await composite.undo();
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Undo failed');
    });
  });
});