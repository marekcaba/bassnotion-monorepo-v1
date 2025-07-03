import React from 'react';
import type { ExerciseNote } from '../../playback/components/FretboardVisualizer/types/fretboard';

export interface NoteEditEvent {
  type:
    | 'NOTE_CREATED'
    | 'NOTE_UPDATED'
    | 'NOTE_DELETED'
    | 'NOTES_BATCH_UPDATED';
  noteId?: string;
  note?: ExerciseNote;
  notes?: ExerciseNote[];
  timestamp: number;
  source: string;
}

export interface NoteEditSyncOptions {
  batchTimeoutMs?: number;
  maxBatchSize?: number;
  enableOptimisticUpdates?: boolean;
}

export type NoteEditEventHandler = (event: NoteEditEvent) => void;

export class NoteEditSync {
  private eventHandlers = new Set<NoteEditEventHandler>();
  private batchedEvents: NoteEditEvent[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private options: Required<NoteEditSyncOptions>;

  constructor(options: NoteEditSyncOptions = {}) {
    this.options = {
      batchTimeoutMs: 16, // ~60fps
      maxBatchSize: 10,
      enableOptimisticUpdates: true,
      ...options,
    };
  }

  /**
   * Subscribe to note edit events
   */
  subscribe(handler: NoteEditEventHandler): () => void {
    this.eventHandlers.add(handler);

    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  /**
   * Emit a note creation event
   */
  emitNoteCreated(note: ExerciseNote, source = 'fretboard-editor'): void {
    const event: NoteEditEvent = {
      type: 'NOTE_CREATED',
      noteId: note.id,
      note,
      timestamp: Date.now(),
      source,
    };

    this.emitEvent(event);
  }

  /**
   * Emit a note update event
   */
  emitNoteUpdated(note: ExerciseNote, source = 'fretboard-editor'): void {
    const event: NoteEditEvent = {
      type: 'NOTE_UPDATED',
      noteId: note.id,
      note,
      timestamp: Date.now(),
      source,
    };

    this.emitEvent(event);
  }

  /**
   * Emit a note deletion event
   */
  emitNoteDeleted(noteId: string, source = 'fretboard-editor'): void {
    const event: NoteEditEvent = {
      type: 'NOTE_DELETED',
      noteId,
      timestamp: Date.now(),
      source,
    };

    this.emitEvent(event);
  }

  /**
   * Emit a batch update event
   */
  emitBatchUpdate(notes: ExerciseNote[], source = 'fretboard-editor'): void {
    const event: NoteEditEvent = {
      type: 'NOTES_BATCH_UPDATED',
      notes,
      timestamp: Date.now(),
      source,
    };

    this.emitEvent(event);
  }

  /**
   * Internal event emission with batching support
   */
  private emitEvent(event: NoteEditEvent): void {
    if (this.options.enableOptimisticUpdates) {
      // Emit immediately for real-time feedback
      this.broadcast(event);
    }

    // Add to batch for conflicted resolution
    this.batchedEvents.push(event);

    // Process batch if full or start timer
    if (this.batchedEvents.length >= this.options.maxBatchSize) {
      this.processBatch();
    } else if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => {
        this.processBatch();
      }, this.options.batchTimeoutMs);
    }
  }

  /**
   * Process batched events
   */
  private processBatch(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    if (this.batchedEvents.length === 0) return;

    // Group events by note ID to resolve conflicts
    const conflictGroups = this.groupEventsByNote(this.batchedEvents);

    // Resolve conflicts and emit final events
    conflictGroups.forEach((events) => {
      const resolvedEvent = this.resolveConflicts(events);
      if (resolvedEvent && !this.options.enableOptimisticUpdates) {
        this.broadcast(resolvedEvent);
      }
    });

    this.batchedEvents = [];
  }

  /**
   * Group events by note ID for conflict resolution
   */
  private groupEventsByNote(events: NoteEditEvent[]): NoteEditEvent[][] {
    const groups = new Map<string, NoteEditEvent[]>();

    events.forEach((event) => {
      const key = event.noteId || 'batch';
      const group = groups.get(key);
      if (!group) {
        groups.set(key, [event]);
      } else {
        group.push(event);
      }
    });

    return Array.from(groups.values());
  }

  /**
   * Resolve conflicts between multiple events for the same note
   */
  private resolveConflicts(events: NoteEditEvent[]): NoteEditEvent | null {
    if (events.length === 0) return null;
    if (events.length === 1) return events[0] || null;

    // Sort by timestamp
    events.sort((a, b) => a.timestamp - b.timestamp);

    // Take the most recent event
    const latestEvent = events[events.length - 1];
    if (!latestEvent) return null;

    // If the latest event is a delete, emit delete
    if (latestEvent.type === 'NOTE_DELETED') {
      return latestEvent;
    }

    // Otherwise, emit the latest update
    return latestEvent;
  }

  /**
   * Broadcast event to all handlers
   */
  private broadcast(event: NoteEditEvent): void {
    this.eventHandlers.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in note edit event handler:', error);
      }
    });
  }

  /**
   * Clear all pending batches and handlers
   */
  destroy(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    this.batchedEvents = [];
    this.eventHandlers.clear();
  }

  /**
   * Get current sync statistics for debugging
   */
  getStats(): {
    subscriberCount: number;
    pendingEvents: number;
    hasPendingBatch: boolean;
  } {
    return {
      subscriberCount: this.eventHandlers.size,
      pendingEvents: this.batchedEvents.length,
      hasPendingBatch: this.batchTimeout !== null,
    };
  }
}

// Global singleton instance
export const noteEditSync = new NoteEditSync();

// React hook for easy integration
export function useNoteEditSync(handler: NoteEditEventHandler): void {
  React.useEffect(() => {
    const unsubscribe = noteEditSync.subscribe(handler);
    return unsubscribe;
  }, [handler]);
}
