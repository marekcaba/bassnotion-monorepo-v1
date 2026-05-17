/**
 * Story 4.4 Task 3.8: Unit tests for enhanced CRUD operations
 * Tests for upsert pattern, notes array support, and temp MIDI migration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminExercisesService } from '../admin-exercises.service.js';
import { SupabaseService } from '../../../infrastructure/supabase/supabase.service.js';

describe('AdminExercisesService - Story 4.4 CRUD Enhancements', () => {
  let service: AdminExercisesService;
  let mockSupabaseService: any;
  let mockSupabaseClient: any;

  beforeEach(() => {
    // Create mock Supabase client with chainable query builder
    mockSupabaseClient = {
      from: vi.fn(() => mockSupabaseClient),
      select: vi.fn(() => mockSupabaseClient),
      insert: vi.fn(() => mockSupabaseClient),
      update: vi.fn(() => mockSupabaseClient),
      delete: vi.fn(() => mockSupabaseClient),
      eq: vi.fn(() => mockSupabaseClient),
      order: vi.fn(() => mockSupabaseClient),
      limit: vi.fn(() => mockSupabaseClient),
      single: vi.fn(),
    };

    mockSupabaseService = {
      getClient: vi.fn(() => mockSupabaseClient),
      moveToPermanent: vi.fn(),
    } as unknown as SupabaseService;

    service = new AdminExercisesService(mockSupabaseService);
  });

  describe('create() - Notes array support (Task 3.4)', () => {
    it('should create exercise with notes array from MIDI conversion', async () => {
      const exerciseWithNotes = {
        tutorial_id: 'tutorial-123',
        title: 'Intro Riff',
        description: 'Opening bassline',
        bpm: 120,
        duration: 8000,
        total_bars: 4,
        time_signature: { numerator: 4, denominator: 4 },
        difficulty: 'intermediate',
        key: 'E',
        notes: [
          {
            id: 'note-1',
            string: 1,
            fret: 0,
            note: 'E',
            color: 'red',
            duration: 'quarter',
            position: { measure: 1, beat: 1, subdivision: 0 },
          },
          {
            id: 'note-2',
            string: 2,
            fret: 2,
            note: 'B',
            color: 'blue',
            duration: 'quarter',
            position: { measure: 1, beat: 2, subdivision: 0 },
          },
        ],
        created_by: 'user-123',
      };

      const mockCreated = { id: 'exercise-456', ...exerciseWithNotes };
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: mockCreated,
        error: null,
      });

      const result = await service.create(exerciseWithNotes);

      expect(result).toEqual(mockCreated);
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: exerciseWithNotes.notes,
        }),
      );
    });

    it('should create exercise with empty notes array if not provided', async () => {
      const exerciseWithoutNotes = {
        tutorial_id: 'tutorial-123',
        title: 'Manual Entry Exercise',
        bpm: 100,
        duration: 4000,
        difficulty: 'beginner',
        key: 'C',
        created_by: 'user-123',
      };

      const mockCreated = {
        id: 'exercise-789',
        ...exerciseWithoutNotes,
        notes: [],
      };
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: mockCreated,
        error: null,
      });

      await service.create(exerciseWithoutNotes);

      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: [],
        }),
      );
    });
  });

  describe('create() - Temp MIDI file migration (Task 3.4)', () => {
    it('should move MIDI from temp to permanent storage during create', async () => {
      const exerciseWithTempMidi = {
        tutorial_id: 'tutorial-123',
        title: 'Exercise with Temp MIDI',
        bpm: 140,
        duration: 6000,
        difficulty: 'advanced',
        key: 'A',
        temp_bassline_midi_path: 'exercise-midi-temp/abc123.mid',
        created_by: 'user-123',
      };

      const permanentUrl =
        'https://storage.supabase.co/exercise-midi-files/exercises/exercise-456/123456_bassline.mid';
      mockSupabaseService.moveToPermanent.mockResolvedValueOnce(permanentUrl);

      const mockCreated = {
        id: 'exercise-456',
        ...exerciseWithTempMidi,
        bassline_midi_url: permanentUrl,
      };
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: mockCreated,
        error: null,
      });

      await service.create(exerciseWithTempMidi);

      expect(mockSupabaseService.moveToPermanent).toHaveBeenCalledWith(
        'exercise-midi-temp/abc123.mid',
        'exercise-midi-files',
        expect.stringContaining('exercises/'),
      );

      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          bassline_midi_url: permanentUrl,
        }),
      );
    });

    it('should use existing bassline_midi_url if no temp path provided', async () => {
      const exerciseWithExistingMidi = {
        tutorial_id: 'tutorial-123',
        title: 'Exercise with Existing MIDI',
        bpm: 100,
        duration: 4000,
        difficulty: 'beginner',
        key: 'C',
        bassline_midi_url: 'https://storage.supabase.co/existing.mid',
        created_by: 'user-123',
      };

      const mockCreated = { id: 'exercise-789', ...exerciseWithExistingMidi };
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: mockCreated,
        error: null,
      });

      await service.create(exerciseWithExistingMidi);

      expect(mockSupabaseService.moveToPermanent).not.toHaveBeenCalled();
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          bassline_midi_url: 'https://storage.supabase.co/existing.mid',
        }),
      );
    });
  });

  describe('update() - Notes array support (Task 3.4)', () => {
    it('should update notes array when provided', async () => {
      const updateWithNotes = {
        notes: [
          {
            id: 'note-updated-1',
            string: 3,
            fret: 5,
            note: 'D',
            color: 'green',
            duration: 'eighth',
            position: { measure: 2, beat: 1, subdivision: 0 },
          },
        ],
      };

      const mockUpdated = { id: 'exercise-123', ...updateWithNotes };
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: mockUpdated,
        error: null,
      });

      await service.update('exercise-123', updateWithNotes);

      expect(mockSupabaseClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: updateWithNotes.notes,
        }),
      );
    });

    it('should not update notes if not provided (partial update)', async () => {
      const updateWithoutNotes = {
        title: 'Updated Title',
        bpm: 130,
      };

      const mockUpdated = { id: 'exercise-123', ...updateWithoutNotes };
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: mockUpdated,
        error: null,
      });

      await service.update('exercise-123', updateWithoutNotes);

      const updateCall = mockSupabaseClient.update.mock.calls[0][0];
      expect(updateCall).not.toHaveProperty('notes');
      expect(updateCall).toHaveProperty('title', 'Updated Title');
      expect(updateCall).toHaveProperty('bpm', 130);
    });
  });

  describe('update() - Temp MIDI file migration (Task 3.4)', () => {
    it('should move MIDI from temp to permanent storage during update', async () => {
      const updateWithTempMidi = {
        temp_bassline_midi_path: 'exercise-midi-temp/xyz789.mid',
        title: 'Updated with new MIDI',
      };

      const permanentUrl =
        'https://storage.supabase.co/exercise-midi-files/exercises/exercise-123/789012_bassline.mid';
      mockSupabaseService.moveToPermanent.mockResolvedValueOnce(permanentUrl);

      const mockUpdated = {
        id: 'exercise-123',
        bassline_midi_url: permanentUrl,
      };
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: mockUpdated,
        error: null,
      });

      await service.update('exercise-123', updateWithTempMidi);

      expect(mockSupabaseService.moveToPermanent).toHaveBeenCalledWith(
        'exercise-midi-temp/xyz789.mid',
        'exercise-midi-files',
        expect.stringContaining('exercises/exercise-123/'),
      );

      expect(mockSupabaseClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          bassline_midi_url: permanentUrl,
        }),
      );
    });
  });

  describe('upsert() - Smart create or update (Task 3.7)', () => {
    it('should create new exercise when no ID provided', async () => {
      const newExercise = {
        tutorial_id: 'tutorial-123',
        title: 'New Exercise',
        bpm: 120,
        duration: 8000,
        difficulty: 'intermediate',
        key: 'E',
        created_by: 'user-123',
      };

      const mockCreated = { id: 'exercise-new-456', ...newExercise };
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: mockCreated,
        error: null,
      });

      const result = await service.upsert(newExercise);

      expect(result.id).toBe('exercise-new-456');
      expect(mockSupabaseClient.insert).toHaveBeenCalled();
    });

    it('should update existing exercise when ID is provided and exists', async () => {
      const existingExercise = {
        id: 'exercise-existing-123',
        title: 'Updated Exercise',
        bpm: 140,
      };

      // Mock findById to return existing exercise
      mockSupabaseClient.single
        .mockResolvedValueOnce({
          data: { id: 'exercise-existing-123' },
          error: null,
        }) // findById
        .mockResolvedValueOnce({ data: { ...existingExercise }, error: null }); // update

      const result = await service.upsert(existingExercise);

      expect(result.id).toBe('exercise-existing-123');
      expect(mockSupabaseClient.update).toHaveBeenCalled();
    });

    it('should create exercise with provided ID if it does not exist', async () => {
      const exerciseWithNewId = {
        id: 'exercise-client-generated-789',
        tutorial_id: 'tutorial-123',
        title: 'Client-Generated ID Exercise',
        bpm: 100,
        duration: 4000,
        difficulty: 'beginner',
        key: 'C',
        created_by: 'user-123',
      };

      // Mock findById to return null (not found)
      mockSupabaseClient.single
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } }) // findById (not found)
        .mockResolvedValueOnce({ data: exerciseWithNewId, error: null }); // create

      const result = await service.upsert(exerciseWithNewId);

      expect(result.id).toBe('exercise-client-generated-789');
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'exercise-client-generated-789',
        }),
      );
    });
  });

  describe('Validation edge cases (Task 3.5)', () => {
    it('should handle invalid BPM gracefully', async () => {
      const invalidBpm = {
        tutorial_id: 'tutorial-123',
        title: 'Invalid BPM Exercise',
        bpm: 500, // Invalid: > 300
        duration: 4000,
        difficulty: 'beginner',
        key: 'C',
        created_by: 'user-123',
      };

      // Supabase will return error for validation failures (if we add constraints)
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'BPM must be between 40-300' },
      });

      await expect(service.create(invalidBpm)).rejects.toThrow();
    });

    it('should handle notes with invalid string numbers gracefully', async () => {
      const invalidNotes = {
        tutorial_id: 'tutorial-123',
        title: 'Invalid Notes Exercise',
        bpm: 120,
        duration: 4000,
        difficulty: 'intermediate',
        key: 'E',
        notes: [
          {
            id: 'note-invalid',
            string: 7, // Invalid: > 6
            fret: 0,
            note: 'E',
            color: 'red',
            duration: 'quarter',
            position: { measure: 1, beat: 1, subdivision: 0 },
          },
        ],
        created_by: 'user-123',
      };

      // Validation should catch this (either in DTO or database constraints)
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'String must be between 1-6' },
      });

      await expect(service.create(invalidNotes)).rejects.toThrow();
    });
  });

  describe('Error handling', () => {
    it('should throw error when create fails', async () => {
      const exercise = {
        tutorial_id: 'tutorial-123',
        title: 'Failing Exercise',
        bpm: 120,
        duration: 4000,
        difficulty: 'beginner',
        key: 'C',
        created_by: 'user-123',
      };

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(service.create(exercise)).rejects.toThrow(
        'Failed to create exercise',
      );
    });

    it('should return null when update finds no exercise', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await service.update('nonexistent-id', {
        title: 'Updated',
      });

      expect(result).toBeNull();
    });

    it('should handle MIDI file move failure gracefully', async () => {
      const exerciseWithTempMidi = {
        tutorial_id: 'tutorial-123',
        title: 'Exercise with Failing MIDI Move',
        bpm: 120,
        duration: 4000,
        difficulty: 'intermediate',
        key: 'E',
        temp_bassline_midi_path: 'exercise-midi-temp/nonexistent.mid',
        created_by: 'user-123',
      };

      mockSupabaseService.moveToPermanent.mockRejectedValueOnce(
        new Error('File not found'),
      );

      await expect(service.create(exerciseWithTempMidi)).rejects.toThrow();
    });
  });
});
