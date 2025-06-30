import type { ExerciseNote } from '../types/fretboard.js';

export interface EditCommand {
  execute(): void;
  undo(): void;
  redo(): void;
  description: string;
  timestamp: number;
}

export interface EditHistoryState {
  canUndo: boolean;
  canRedo: boolean;
  undoDescription?: string;
  redoDescription?: string;
}

// Command implementations
export class CreateNoteCommand implements EditCommand {
  public timestamp: number = Date.now();

  constructor(
    private note: ExerciseNote,
    private addNoteFn: (note: ExerciseNote) => void,
    private removeNoteFn: (noteId: string) => void,
  ) {}

  execute(): void {
    this.addNoteFn(this.note);
  }

  undo(): void {
    this.removeNoteFn(this.note.id);
  }

  redo(): void {
    this.execute();
  }

  get description(): string {
    return `Create note ${this.note.note} at fret ${this.note.fret}`;
  }
}

export class DeleteNoteCommand implements EditCommand {
  public timestamp: number = Date.now();

  constructor(
    private note: ExerciseNote,
    private addNoteFn: (note: ExerciseNote) => void,
    private removeNoteFn: (noteId: string) => void,
  ) {}

  execute(): void {
    this.removeNoteFn(this.note.id);
  }

  undo(): void {
    this.addNoteFn(this.note);
  }

  redo(): void {
    this.execute();
  }

  get description(): string {
    return `Delete note ${this.note.note} at fret ${this.note.fret}`;
  }
}

export class MoveNoteCommand implements EditCommand {
  public timestamp: number = Date.now();

  constructor(
    private noteId: string,
    private oldNote: ExerciseNote,
    private newNote: ExerciseNote,
    private updateNoteFn: (noteId: string, note: ExerciseNote) => void,
  ) {}

  execute(): void {
    this.updateNoteFn(this.noteId, this.newNote);
  }

  undo(): void {
    this.updateNoteFn(this.noteId, this.oldNote);
  }

  redo(): void {
    this.execute();
  }

  get description(): string {
    return `Move note from fret ${this.oldNote.fret} to fret ${this.newNote.fret}`;
  }
}

export class BatchEditCommand implements EditCommand {
  public timestamp: number = Date.now();

  constructor(
    private commands: EditCommand[],
    public description: string,
  ) {}

  execute(): void {
    this.commands.forEach((cmd) => cmd.execute());
  }

  undo(): void {
    // Undo in reverse order
    [...this.commands].reverse().forEach((cmd) => cmd.undo());
  }

  redo(): void {
    this.execute();
  }
}

export class EditHistory {
  private undoStack: EditCommand[] = [];
  private redoStack: EditCommand[] = [];
  private maxHistorySize = 100;

  /**
   * Executes a command and adds it to the history
   */
  executeCommand(command: EditCommand): void {
    // Clear redo stack when a new command is executed
    this.redoStack = [];

    // Execute the command
    command.execute();

    // Add to undo stack
    this.undoStack.push(command);

    // Limit history size
    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift();
    }
  }

  /**
   * Undoes the last command
   */
  undo(): boolean {
    const command = this.undoStack.pop();
    if (!command) return false;

    command.undo();
    this.redoStack.push(command);

    return true;
  }

  /**
   * Redoes the last undone command
   */
  redo(): boolean {
    const command = this.redoStack.pop();
    if (!command) return false;

    command.redo();
    this.undoStack.push(command);

    return true;
  }

  /**
   * Gets the current state of the edit history
   */
  getState(): EditHistoryState {
    return {
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
      undoDescription: this.undoStack[this.undoStack.length - 1]?.description,
      redoDescription: this.redoStack[this.redoStack.length - 1]?.description,
    };
  }

  /**
   * Clears the entire history
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  /**
   * Gets the undo stack for debugging
   */
  getUndoStack(): readonly EditCommand[] {
    return [...this.undoStack];
  }

  /**
   * Gets the redo stack for debugging
   */
  getRedoStack(): readonly EditCommand[] {
    return [...this.redoStack];
  }

  /**
   * Sets the maximum history size
   */
  setMaxHistorySize(size: number): void {
    this.maxHistorySize = Math.max(1, size);

    // Trim existing history if necessary
    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack = this.undoStack.slice(-this.maxHistorySize);
    }
  }

  /**
   * Creates a batch command for multiple operations
   */
  createBatchCommand(
    commands: EditCommand[],
    description: string,
  ): BatchEditCommand {
    return new BatchEditCommand(commands, description);
  }
}
