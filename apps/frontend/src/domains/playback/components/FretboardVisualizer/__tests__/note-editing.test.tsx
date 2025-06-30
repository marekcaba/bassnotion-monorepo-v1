import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NoteEditor } from '../editing/NoteEditor';
import {
  EditHistory,
  CreateNoteCommand,
  DeleteNoteCommand,
  MoveNoteCommand,
} from '../editing/EditHistory';
import { NoteEditSync } from '../../../../widgets/services/NoteEditSync';
import type { ExerciseNote } from '../types/fretboard';

describe('NoteEditor', () => {
  let noteEditor: NoteEditor;

  beforeEach(() => {
    noteEditor = new NoteEditor();
  });

  describe('Note Creation', () => {
    it('should create a valid note with correct properties', () => {
      const result = noteEditor.createNote(5, 2, 1000);

      expect(result.success).toBe(true);
      expect(result.note).toBeDefined();
      expect(result.note?.fret).toBe(5);
      expect(result.note?.string).toBe(2);
      expect(result.note?.timestamp).toBe(1000);
      expect(result.note?.note).toBe('D2'); // A string, 5th fret
    });

    it('should reject invalid fret numbers', () => {
      const result = noteEditor.createNote(-1, 2, 1000);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Fret must be between');
    });

    it('should reject invalid string numbers', () => {
      const result = noteEditor.createNote(5, 5, 1000);

      expect(result.success).toBe(false);
      expect(result.error).toContain('String must be between');
    });
  });

  describe('Note Movement', () => {
    it('should move a note to a new position', () => {
      const originalNote: ExerciseNote = {
        id: 'test-note',
        timestamp: 1000,
        string: 2,
        fret: 5,
        duration: 500,
        note: 'D3',
      };

      const result = noteEditor.moveNote(originalNote, 7, 3, 1500);

      expect(result.success).toBe(true);
      expect(result.note?.fret).toBe(7);
      expect(result.note?.string).toBe(3);
      expect(result.note?.timestamp).toBe(1500);
      expect(result.note?.note).toBe('A3'); // D string, 7th fret
    });

    it('should validate constraints when moving notes', () => {
      const originalNote: ExerciseNote = {
        id: 'test-note',
        timestamp: 1000,
        string: 2,
        fret: 5,
        duration: 500,
        note: 'D3',
      };

      const result = noteEditor.moveNote(originalNote, 25, 2); // Invalid fret

      expect(result.success).toBe(false);
      expect(result.error).toContain('Fret must be between');
    });
  });

  describe('Note Name Generation', () => {
    it('should generate correct note names for different strings', () => {
      expect(noteEditor.getNoteName(1, 0)).toBe('E2'); // E string open
      expect(noteEditor.getNoteName(2, 0)).toBe('A2'); // A string open
      expect(noteEditor.getNoteName(3, 0)).toBe('D3'); // D string open
      expect(noteEditor.getNoteName(4, 0)).toBe('G3'); // G string open
    });

    it('should generate correct note names for fretted positions', () => {
      expect(noteEditor.getNoteName(1, 3)).toBe('G2'); // E string, 3rd fret
      expect(noteEditor.getNoteName(2, 5)).toBe('D2'); // A string, 5th fret
      expect(noteEditor.getNoteName(3, 7)).toBe('A3'); // D string, 7th fret
      expect(noteEditor.getNoteName(4, 12)).toBe('G4'); // G string, 12th fret (octave)
    });
  });
});

describe('EditHistory', () => {
  let editHistory: EditHistory;
  let mockNotes: ExerciseNote[];
  let mockAddNote: (note: ExerciseNote) => void;
  let mockRemoveNote: (noteId: string) => void;
  let mockUpdateNote: (noteId: string, note: ExerciseNote) => void;

  beforeEach(() => {
    editHistory = new EditHistory();
    mockNotes = [];

    mockAddNote = vi.fn((note: ExerciseNote) => {
      mockNotes.push(note);
    });

    mockRemoveNote = vi.fn((noteId: string) => {
      mockNotes = mockNotes.filter((n) => n.id !== noteId);
    });

    mockUpdateNote = vi.fn((noteId: string, note: ExerciseNote) => {
      const index = mockNotes.findIndex((n) => n.id === noteId);
      if (index !== -1) {
        mockNotes[index] = note;
      }
    });
  });

  describe('Command Execution', () => {
    it('should execute and undo create note commands', () => {
      const testNote: ExerciseNote = {
        id: 'test-note',
        timestamp: 1000,
        string: 2,
        fret: 5,
        duration: 500,
        note: 'D3',
      };

      const command = new CreateNoteCommand(
        testNote,
        mockAddNote,
        mockRemoveNote,
      );

      editHistory.executeCommand(command);
      expect(mockNotes).toHaveLength(1);
      expect(mockNotes[0]).toEqual(testNote);

      const undoResult = editHistory.undo();
      expect(undoResult).toBe(true);
      expect(mockNotes).toHaveLength(0);
    });

    it('should execute and undo delete note commands', () => {
      const testNote: ExerciseNote = {
        id: 'test-note',
        timestamp: 1000,
        string: 2,
        fret: 5,
        duration: 500,
        note: 'D3',
      };

      mockNotes.push(testNote);

      const command = new DeleteNoteCommand(
        testNote,
        mockAddNote,
        mockRemoveNote,
      );

      editHistory.executeCommand(command);
      expect(mockNotes).toHaveLength(0);

      const undoResult = editHistory.undo();
      expect(undoResult).toBe(true);
      expect(mockNotes).toHaveLength(1);
      expect(mockNotes[0]).toEqual(testNote);
    });

    it('should execute and undo move note commands', () => {
      const originalNote: ExerciseNote = {
        id: 'test-note',
        timestamp: 1000,
        string: 2,
        fret: 5,
        duration: 500,
        note: 'D3',
      };

      const movedNote: ExerciseNote = {
        ...originalNote,
        fret: 7,
        note: 'E3',
      };

      mockNotes.push(originalNote);

      const command = new MoveNoteCommand(
        'test-note',
        originalNote,
        movedNote,
        mockUpdateNote,
      );

      editHistory.executeCommand(command);
      expect(mockNotes[0]?.fret).toBe(7);

      const undoResult = editHistory.undo();
      expect(undoResult).toBe(true);
      expect(mockNotes[0]?.fret).toBe(5);
    });
  });

  describe('Redo Functionality', () => {
    it('should redo commands after undo', () => {
      const testNote: ExerciseNote = {
        id: 'test-note',
        timestamp: 1000,
        string: 2,
        fret: 5,
        duration: 500,
        note: 'D3',
      };

      const command = new CreateNoteCommand(
        testNote,
        mockAddNote,
        mockRemoveNote,
      );

      editHistory.executeCommand(command);
      editHistory.undo();

      const redoResult = editHistory.redo();
      expect(redoResult).toBe(true);
      expect(mockNotes).toHaveLength(1);
      expect(mockNotes[0]).toEqual(testNote);
    });

    it('should clear redo stack when new command is executed', () => {
      const testNote1: ExerciseNote = {
        id: 'test-note-1',
        timestamp: 1000,
        string: 2,
        fret: 5,
        duration: 500,
        note: 'D3',
      };

      const testNote2: ExerciseNote = {
        id: 'test-note-2',
        timestamp: 2000,
        string: 3,
        fret: 7,
        duration: 500,
        note: 'A3',
      };

      const command1 = new CreateNoteCommand(
        testNote1,
        mockAddNote,
        mockRemoveNote,
      );
      const command2 = new CreateNoteCommand(
        testNote2,
        mockAddNote,
        mockRemoveNote,
      );

      editHistory.executeCommand(command1);
      editHistory.undo();
      editHistory.executeCommand(command2);

      const redoResult = editHistory.redo();
      expect(redoResult).toBe(false); // Should not be able to redo after new command
    });
  });
});

describe('NoteEditSync', () => {
  let noteEditSync: NoteEditSync;

  beforeEach(() => {
    noteEditSync = new NoteEditSync({
      batchTimeoutMs: 1,
      maxBatchSize: 2,
      enableOptimisticUpdates: true,
    });
  });

  afterEach(() => {
    noteEditSync.destroy();
  });

  it('should emit note creation events', () => {
    const mockHandler = vi.fn();
    noteEditSync.subscribe(mockHandler);

    const testNote: ExerciseNote = {
      id: 'test-note',
      timestamp: 1000,
      string: 2,
      fret: 5,
      duration: 500,
      note: 'D3',
    };

    noteEditSync.emitNoteCreated(testNote);

    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'NOTE_CREATED',
        noteId: 'test-note',
        note: testNote,
      }),
    );
  });

  it('should batch events when max batch size is reached', async () => {
    const mockHandler = vi.fn();
    noteEditSync.subscribe(mockHandler);

    const testNote1: ExerciseNote = {
      id: 'test-note-1',
      timestamp: 1000,
      string: 2,
      fret: 5,
      duration: 500,
      note: 'D3',
    };

    const testNote2: ExerciseNote = {
      id: 'test-note-2',
      timestamp: 2000,
      string: 3,
      fret: 7,
      duration: 500,
      note: 'A3',
    };

    noteEditSync.emitNoteCreated(testNote1);
    noteEditSync.emitNoteCreated(testNote2);

    // With batch size 2, should have triggered batch processing
    expect(mockHandler).toHaveBeenCalledTimes(2); // One for each optimistic update
  });

  it('should provide sync statistics', () => {
    const mockHandler = vi.fn();
    const unsubscribe = noteEditSync.subscribe(mockHandler);

    const stats = noteEditSync.getStats();
    expect(stats.subscriberCount).toBe(1);
    expect(stats.pendingEvents).toBe(0);

    unsubscribe();

    const newStats = noteEditSync.getStats();
    expect(newStats.subscriberCount).toBe(0);
  });
});
