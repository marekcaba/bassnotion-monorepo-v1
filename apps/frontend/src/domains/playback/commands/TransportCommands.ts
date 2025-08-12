/**
 * TransportCommands - Transport-specific Command Implementations
 * Story 3.18.4: Service Architecture Implementation
 * 
 * All transport-related commands following the Command pattern.
 * Enables undo/redo for transport operations.
 */

import { Command, CommandResult } from './Command.js';
import { UnifiedTransport } from '../services/core/index.js';
import { EventBus } from '../services/core/EventBus.js';

export interface TransportState {
  isPlaying: boolean;
  position: number;
  bpm: number;
  loopStart: number;
  loopEnd: number;
  loopEnabled: boolean;
}

/**
 * Base class for transport commands
 */
abstract class TransportCommand<T = any> extends Command<T> {
  protected transportController: UnifiedTransport;
  protected eventBus: EventBus;
  protected previousState?: TransportState;

  constructor(
    name: string,
    transportController: UnifiedTransport,
    eventBus: EventBus,
    context?: Record<string, any>
  ) {
    super(name, context);
    this.transportController = transportController;
    this.eventBus = eventBus;
  }

  /**
   * Capture current transport state
   */
  protected captureState(): TransportState {
    return {
      isPlaying: this.transportController.isPlaying(),
      position: this.transportController.getPosition(),
      bpm: this.transportController.getBPM(),
      loopStart: this.transportController.getLoopStart(),
      loopEnd: this.transportController.getLoopEnd(),
      loopEnabled: this.transportController.isLoopEnabled(),
    };
  }

  /**
   * Restore transport state
   */
  protected async restoreState(state: TransportState): Promise<void> {
    await this.transportController.setPosition(state.position);
    await this.transportController.setBPM(state.bpm);
    
    if (state.loopEnabled) {
      await this.transportController.setLoop(state.loopStart, state.loopEnd);
    } else {
      await this.transportController.disableLoop();
    }

    if (state.isPlaying) {
      await this.transportController.start();
    } else {
      await this.transportController.stop();
    }
  }
}

/**
 * Start transport command
 */
export class StartCommand extends TransportCommand<void> {
  constructor(transportController: TransportController, eventBus: EventBus) {
    super('transport:start', transportController, eventBus);
  }

  async execute(): Promise<CommandResult<void>> {
    if (!this.canExecute()) {
      return {
        success: false,
        error: new Error('Command already executed'),
        timestamp: Date.now(),
      };
    }

    try {
      this.previousState = this.captureState();
      
      if (!this.previousState.isPlaying) {
        await this.transportController.start();
        this.eventBus.emit('command:executed', {
          command: this.metadata.name,
          timestamp: this.metadata.timestamp,
        });
      }

      const result = {
        success: true,
        timestamp: Date.now(),
      };
      this.markExecuted(result);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Failed to start transport'),
        timestamp: Date.now(),
      };
    }
  }

  async undo(): Promise<CommandResult<void>> {
    if (!this.canUndo()) {
      return {
        success: false,
        error: new Error('Command not executed or already undone'),
        timestamp: Date.now(),
      };
    }

    try {
      if (this.previousState && !this.previousState.isPlaying) {
        await this.transportController.stop();
        this.eventBus.emit('command:undone', {
          command: this.metadata.name,
          timestamp: Date.now(),
        });
      }

      const result = {
        success: true,
        timestamp: Date.now(),
      };
      this.markUndone(result);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Failed to undo start'),
        timestamp: Date.now(),
      };
    }
  }

  clone(): StartCommand {
    return new StartCommand(this.transportController, this.eventBus);
  }
}

/**
 * Stop transport command
 */
export class StopCommand extends TransportCommand<void> {
  constructor(transportController: TransportController, eventBus: EventBus) {
    super('transport:stop', transportController, eventBus);
  }

  async execute(): Promise<CommandResult<void>> {
    if (!this.canExecute()) {
      return {
        success: false,
        error: new Error('Command already executed'),
        timestamp: Date.now(),
      };
    }

    try {
      this.previousState = this.captureState();
      
      if (this.previousState.isPlaying) {
        await this.transportController.stop();
        this.eventBus.emit('command:executed', {
          command: this.metadata.name,
          timestamp: this.metadata.timestamp,
        });
      }

      const result = {
        success: true,
        timestamp: Date.now(),
      };
      this.markExecuted(result);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Failed to stop transport'),
        timestamp: Date.now(),
      };
    }
  }

  async undo(): Promise<CommandResult<void>> {
    if (!this.canUndo()) {
      return {
        success: false,
        error: new Error('Command not executed or already undone'),
        timestamp: Date.now(),
      };
    }

    try {
      if (this.previousState && this.previousState.isPlaying) {
        await this.transportController.start();
        this.eventBus.emit('command:undone', {
          command: this.metadata.name,
          timestamp: Date.now(),
        });
      }

      const result = {
        success: true,
        timestamp: Date.now(),
      };
      this.markUndone(result);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Failed to undo stop'),
        timestamp: Date.now(),
      };
    }
  }

  clone(): StopCommand {
    return new StopCommand(this.transportController, this.eventBus);
  }
}

/**
 * Pause transport command
 */
export class PauseCommand extends TransportCommand<void> {
  constructor(transportController: TransportController, eventBus: EventBus) {
    super('transport:pause', transportController, eventBus);
  }

  async execute(): Promise<CommandResult<void>> {
    if (!this.canExecute()) {
      return {
        success: false,
        error: new Error('Command already executed'),
        timestamp: Date.now(),
      };
    }

    try {
      this.previousState = this.captureState();
      
      if (this.previousState.isPlaying) {
        await this.transportController.pause();
        this.eventBus.emit('command:executed', {
          command: this.metadata.name,
          timestamp: this.metadata.timestamp,
        });
      }

      const result = {
        success: true,
        timestamp: Date.now(),
      };
      this.markExecuted(result);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Failed to pause transport'),
        timestamp: Date.now(),
      };
    }
  }

  async undo(): Promise<CommandResult<void>> {
    if (!this.canUndo()) {
      return {
        success: false,
        error: new Error('Command not executed or already undone'),
        timestamp: Date.now(),
      };
    }

    try {
      if (this.previousState && this.previousState.isPlaying) {
        await this.transportController.start();
        this.eventBus.emit('command:undone', {
          command: this.metadata.name,
          timestamp: Date.now(),
        });
      }

      const result = {
        success: true,
        timestamp: Date.now(),
      };
      this.markUndone(result);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Failed to undo pause'),
        timestamp: Date.now(),
      };
    }
  }

  clone(): PauseCommand {
    return new PauseCommand(this.transportController, this.eventBus);
  }
}

/**
 * Set tempo command
 */
export class SetTempoCommand extends TransportCommand<number> {
  private newBPM: number;

  constructor(
    transportController: UnifiedTransport,
    eventBus: EventBus,
    bpm: number
  ) {
    super('transport:set-tempo', transportController, eventBus, { bpm });
    this.newBPM = bpm;
  }

  async validate(): Promise<boolean> {
    return this.newBPM > 0 && this.newBPM <= 999;
  }

  async execute(): Promise<CommandResult<number>> {
    if (!this.canExecute()) {
      return {
        success: false,
        error: new Error('Command already executed'),
        timestamp: Date.now(),
      };
    }

    if (!(await this.validate())) {
      return {
        success: false,
        error: new Error(`Invalid BPM value: ${this.newBPM}`),
        timestamp: Date.now(),
      };
    }

    try {
      this.previousState = this.captureState();
      await this.transportController.setBPM(this.newBPM);
      
      this.eventBus.emit('command:executed', {
        command: this.metadata.name,
        timestamp: this.metadata.timestamp,
        data: { oldBPM: this.previousState.bpm, newBPM: this.newBPM },
      });

      const result = {
        success: true,
        data: this.newBPM,
        timestamp: Date.now(),
      };
      this.markExecuted(result);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Failed to set tempo'),
        timestamp: Date.now(),
      };
    }
  }

  async undo(): Promise<CommandResult<number>> {
    if (!this.canUndo()) {
      return {
        success: false,
        error: new Error('Command not executed or already undone'),
        timestamp: Date.now(),
      };
    }

    try {
      if (this.previousState) {
        await this.transportController.setBPM(this.previousState.bpm);
        this.eventBus.emit('command:undone', {
          command: this.metadata.name,
          timestamp: Date.now(),
          data: { bpm: this.previousState.bpm },
        });
      }

      const result = {
        success: true,
        data: this.previousState?.bpm || 120,
        timestamp: Date.now(),
      };
      this.markUndone(result);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Failed to undo tempo change'),
        timestamp: Date.now(),
      };
    }
  }

  clone(): SetTempoCommand {
    return new SetTempoCommand(this.transportController, this.eventBus, this.newBPM);
  }
}

/**
 * Set position command
 */
export class SetPositionCommand extends TransportCommand<number> {
  private newPosition: number;

  constructor(
    transportController: UnifiedTransport,
    eventBus: EventBus,
    position: number
  ) {
    super('transport:set-position', transportController, eventBus, { position });
    this.newPosition = position;
  }

  async validate(): Promise<boolean> {
    return this.newPosition >= 0;
  }

  async execute(): Promise<CommandResult<number>> {
    if (!this.canExecute()) {
      return {
        success: false,
        error: new Error('Command already executed'),
        timestamp: Date.now(),
      };
    }

    if (!(await this.validate())) {
      return {
        success: false,
        error: new Error(`Invalid position value: ${this.newPosition}`),
        timestamp: Date.now(),
      };
    }

    try {
      this.previousState = this.captureState();
      await this.transportController.setPosition(this.newPosition);
      
      this.eventBus.emit('command:executed', {
        command: this.metadata.name,
        timestamp: this.metadata.timestamp,
        data: { oldPosition: this.previousState.position, newPosition: this.newPosition },
      });

      const result = {
        success: true,
        data: this.newPosition,
        timestamp: Date.now(),
      };
      this.markExecuted(result);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Failed to set position'),
        timestamp: Date.now(),
      };
    }
  }

  async undo(): Promise<CommandResult<number>> {
    if (!this.canUndo()) {
      return {
        success: false,
        error: new Error('Command not executed or already undone'),
        timestamp: Date.now(),
      };
    }

    try {
      if (this.previousState) {
        await this.transportController.setPosition(this.previousState.position);
        this.eventBus.emit('command:undone', {
          command: this.metadata.name,
          timestamp: Date.now(),
          data: { position: this.previousState.position },
        });
      }

      const result = {
        success: true,
        data: this.previousState?.position || 0,
        timestamp: Date.now(),
      };
      this.markUndone(result);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Failed to undo position change'),
        timestamp: Date.now(),
      };
    }
  }

  clone(): SetPositionCommand {
    return new SetPositionCommand(this.transportController, this.eventBus, this.newPosition);
  }
}

/**
 * Set loop command
 */
export class SetLoopCommand extends TransportCommand<{ start: number; end: number }> {
  private loopStart: number;
  private loopEnd: number;

  constructor(
    transportController: UnifiedTransport,
    eventBus: EventBus,
    start: number,
    end: number
  ) {
    super('transport:set-loop', transportController, eventBus, { start, end });
    this.loopStart = start;
    this.loopEnd = end;
  }

  async validate(): Promise<boolean> {
    return this.loopStart >= 0 && this.loopEnd > this.loopStart;
  }

  async execute(): Promise<CommandResult<{ start: number; end: number }>> {
    if (!this.canExecute()) {
      return {
        success: false,
        error: new Error('Command already executed'),
        timestamp: Date.now(),
      };
    }

    if (!(await this.validate())) {
      return {
        success: false,
        error: new Error(`Invalid loop range: ${this.loopStart} - ${this.loopEnd}`),
        timestamp: Date.now(),
      };
    }

    try {
      this.previousState = this.captureState();
      await this.transportController.setLoop(this.loopStart, this.loopEnd);
      
      this.eventBus.emit('command:executed', {
        command: this.metadata.name,
        timestamp: this.metadata.timestamp,
        data: { 
          oldLoop: { 
            start: this.previousState.loopStart, 
            end: this.previousState.loopEnd,
            enabled: this.previousState.loopEnabled
          },
          newLoop: { 
            start: this.loopStart, 
            end: this.loopEnd,
            enabled: true
          }
        },
      });

      const result = {
        success: true,
        data: { start: this.loopStart, end: this.loopEnd },
        timestamp: Date.now(),
      };
      this.markExecuted(result);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Failed to set loop'),
        timestamp: Date.now(),
      };
    }
  }

  async undo(): Promise<CommandResult<{ start: number; end: number }>> {
    if (!this.canUndo()) {
      return {
        success: false,
        error: new Error('Command not executed or already undone'),
        timestamp: Date.now(),
      };
    }

    try {
      if (this.previousState) {
        if (this.previousState.loopEnabled) {
          await this.transportController.setLoop(
            this.previousState.loopStart,
            this.previousState.loopEnd
          );
        } else {
          await this.transportController.disableLoop();
        }
        
        this.eventBus.emit('command:undone', {
          command: this.metadata.name,
          timestamp: Date.now(),
          data: { 
            start: this.previousState.loopStart, 
            end: this.previousState.loopEnd,
            enabled: this.previousState.loopEnabled
          },
        });
      }

      const result = {
        success: true,
        data: { 
          start: this.previousState?.loopStart || 0, 
          end: this.previousState?.loopEnd || 0 
        },
        timestamp: Date.now(),
      };
      this.markUndone(result);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Failed to undo loop change'),
        timestamp: Date.now(),
      };
    }
  }

  clone(): SetLoopCommand {
    return new SetLoopCommand(
      this.transportController, 
      this.eventBus, 
      this.loopStart, 
      this.loopEnd
    );
  }
}