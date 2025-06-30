import { describe, it, expect } from 'vitest';
import {
  ExerciseNoteSchema,
  ExerciseSchema,
  CustomBasslineSchema,
  ExerciseDifficultySchema,
  TechniqueTypeSchema,
  ValidatedExerciseNoteSchema,
  ValidatedExerciseSchema,
  CreateExerciseRequestSchema,
  SaveCustomBasslineRequestSchema,
  GetExercisesResponseSchema,
} from '../exercise-schemas.js';

describe('Exercise Validation Schemas', () => {
  describe('TechniqueTypeSchema', () => {
    it('should accept valid technique types', () => {
      const validTechniques = [
        'hammer_on',
        'pull_off',
        'slide_up',
        'slide_down',
        'slap',
        'pop',
        'tap',
        'harmonic',
        'vibrato',
        'bend',
      ];

      validTechniques.forEach((technique) => {
        expect(() => TechniqueTypeSchema.parse(technique)).not.toThrow();
      });
    });

    it('should reject invalid technique types', () => {
      const invalidTechniques = ['invalid_technique', '', 123, null];

      invalidTechniques.forEach((technique) => {
        expect(() => TechniqueTypeSchema.parse(technique)).toThrow();
      });
    });
  });

  describe('ExerciseDifficultySchema', () => {
    it('should accept valid difficulty levels', () => {
      const validDifficulties = ['beginner', 'intermediate', 'advanced'];

      validDifficulties.forEach((difficulty) => {
        expect(() => ExerciseDifficultySchema.parse(difficulty)).not.toThrow();
      });
    });

    it('should reject invalid difficulty levels', () => {
      const invalidDifficulties = ['expert', 'easy', '', 123, null];

      invalidDifficulties.forEach((difficulty) => {
        expect(() => ExerciseDifficultySchema.parse(difficulty)).toThrow();
      });
    });
  });

  describe('ExerciseNoteSchema', () => {
    const validNote = {
      id: 'note-1',
      timestamp: 1000,
      string: 4,
      fret: 3,
      duration: 500,
      note: 'G',
      color: '#FF6B6B',
    };

    it('should accept valid basic note', () => {
      expect(() => ExerciseNoteSchema.parse(validNote)).not.toThrow();
    });

    it('should accept note with Epic 4 technique properties', () => {
      const noteWithTechniques = {
        ...validNote,
        techniques: ['hammer_on', 'vibrato'],
        target_note_id: 'note-2',
        is_accented: true,
        accent_level: 'medium',
        vibrato_intensity: 'light',
      };

      expect(() => ExerciseNoteSchema.parse(noteWithTechniques)).not.toThrow();
    });

    it('should require all mandatory fields', () => {
      const requiredFields = [
        'id',
        'timestamp',
        'string',
        'fret',
        'duration',
        'note',
        'color',
      ];

      requiredFields.forEach((field) => {
        const invalidNote = { ...validNote };
        delete (invalidNote as any)[field];
        expect(() => ExerciseNoteSchema.parse(invalidNote)).toThrow();
      });
    });

    it('should validate string range (1-6)', () => {
      expect(() =>
        ExerciseNoteSchema.parse({ ...validNote, string: 0 }),
      ).toThrow();
      expect(() =>
        ExerciseNoteSchema.parse({ ...validNote, string: 7 }),
      ).toThrow();
      expect(() =>
        ExerciseNoteSchema.parse({ ...validNote, string: 1 }),
      ).not.toThrow();
      expect(() =>
        ExerciseNoteSchema.parse({ ...validNote, string: 6 }),
      ).not.toThrow();
    });

    it('should validate fret range (0-24)', () => {
      expect(() =>
        ExerciseNoteSchema.parse({ ...validNote, fret: -1 }),
      ).toThrow();
      expect(() =>
        ExerciseNoteSchema.parse({ ...validNote, fret: 25 }),
      ).toThrow();
      expect(() =>
        ExerciseNoteSchema.parse({ ...validNote, fret: 0 }),
      ).not.toThrow();
      expect(() =>
        ExerciseNoteSchema.parse({ ...validNote, fret: 24 }),
      ).not.toThrow();
    });

    it('should validate timestamp is non-negative', () => {
      expect(() =>
        ExerciseNoteSchema.parse({ ...validNote, timestamp: -1 }),
      ).toThrow();
      expect(() =>
        ExerciseNoteSchema.parse({ ...validNote, timestamp: 0 }),
      ).not.toThrow();
    });

    it('should validate duration is positive', () => {
      expect(() =>
        ExerciseNoteSchema.parse({ ...validNote, duration: 0 }),
      ).toThrow();
      expect(() =>
        ExerciseNoteSchema.parse({ ...validNote, duration: -1 }),
      ).toThrow();
      expect(() =>
        ExerciseNoteSchema.parse({ ...validNote, duration: 1 }),
      ).not.toThrow();
    });

    it('should validate Epic 4 enum fields', () => {
      // Valid enum values
      expect(() =>
        ExerciseNoteSchema.parse({
          ...validNote,
          slide_type: 'legato',
        }),
      ).not.toThrow();

      expect(() =>
        ExerciseNoteSchema.parse({
          ...validNote,
          accent_level: 'heavy',
        }),
      ).not.toThrow();

      // Invalid enum values
      expect(() =>
        ExerciseNoteSchema.parse({
          ...validNote,
          slide_type: 'invalid',
        }),
      ).toThrow();

      expect(() =>
        ExerciseNoteSchema.parse({
          ...validNote,
          accent_level: 'extreme',
        }),
      ).toThrow();
    });
  });

  describe('ExerciseSchema', () => {
    const validExercise = {
      id: 'exercise-1',
      title: 'Test Exercise',
      description: 'A test exercise',
      difficulty: 'beginner' as const,
      duration: 30000,
      bpm: 120,
      key: 'C',
      youtube_video_id: 'abc123',
      start_timestamp: 10,
      end_timestamp: 40,
      notes: [
        {
          id: 'note-1',
          timestamp: 1000,
          string: 4,
          fret: 3,
          duration: 500,
          note: 'G',
          color: '#FF6B6B',
        },
      ],
      teaching_summary: 'Practice this exercise slowly',
      is_active: true,
      created_by: 'user-1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    it('should accept valid exercise', () => {
      expect(() => ExerciseSchema.parse(validExercise)).not.toThrow();
    });

    it('should require all mandatory fields', () => {
      const requiredFields = [
        'id',
        'title',
        'difficulty',
        'duration',
        'bpm',
        'key',
        'notes',
        'is_active',
        'created_at',
        'updated_at',
      ];

      requiredFields.forEach((field) => {
        const invalidExercise = { ...validExercise };
        delete (invalidExercise as any)[field];
        expect(() => ExerciseSchema.parse(invalidExercise)).toThrow();
      });
    });

    it('should validate title length', () => {
      expect(() =>
        ExerciseSchema.parse({
          ...validExercise,
          title: '',
        }),
      ).toThrow();

      expect(() =>
        ExerciseSchema.parse({
          ...validExercise,
          title: 'a'.repeat(201),
        }),
      ).toThrow();

      expect(() =>
        ExerciseSchema.parse({
          ...validExercise,
          title: 'Valid Title',
        }),
      ).not.toThrow();
    });

    it('should validate BPM range (40-300)', () => {
      expect(() =>
        ExerciseSchema.parse({ ...validExercise, bpm: 39 }),
      ).toThrow();
      expect(() =>
        ExerciseSchema.parse({ ...validExercise, bpm: 301 }),
      ).toThrow();
      expect(() =>
        ExerciseSchema.parse({ ...validExercise, bpm: 40 }),
      ).not.toThrow();
      expect(() =>
        ExerciseSchema.parse({ ...validExercise, bpm: 300 }),
      ).not.toThrow();
    });

    it('should validate minimum duration (1 second)', () => {
      expect(() =>
        ExerciseSchema.parse({ ...validExercise, duration: 999 }),
      ).toThrow();
      expect(() =>
        ExerciseSchema.parse({ ...validExercise, duration: 1000 }),
      ).not.toThrow();
    });

    it('should require at least one note', () => {
      expect(() =>
        ExerciseSchema.parse({ ...validExercise, notes: [] }),
      ).toThrow();
    });

    it('should validate description length', () => {
      expect(() =>
        ExerciseSchema.parse({
          ...validExercise,
          description: 'a'.repeat(1001),
        }),
      ).toThrow();

      expect(() =>
        ExerciseSchema.parse({
          ...validExercise,
          description: 'Valid description',
        }),
      ).not.toThrow();
    });

    it('should validate teaching summary length', () => {
      expect(() =>
        ExerciseSchema.parse({
          ...validExercise,
          teaching_summary: 'a'.repeat(2001),
        }),
      ).toThrow();

      expect(() =>
        ExerciseSchema.parse({
          ...validExercise,
          teaching_summary: 'Valid teaching summary',
        }),
      ).not.toThrow();
    });
  });

  describe('ValidatedExerciseNoteSchema', () => {
    const baseNote = {
      id: 'note-1',
      timestamp: 1000,
      string: 4,
      fret: 3,
      duration: 500,
      note: 'G',
      color: '#FF6B6B',
    };

    it('should require slide_to_fret for slide techniques', () => {
      const slideNote = {
        ...baseNote,
        techniques: ['slide_up'],
        // Missing slide_to_fret
      };

      expect(() => ValidatedExerciseNoteSchema.parse(slideNote)).toThrow();

      const validSlideNote = {
        ...slideNote,
        slide_to_fret: 5,
      };

      expect(() =>
        ValidatedExerciseNoteSchema.parse(validSlideNote),
      ).not.toThrow();
    });

    it('should require target_note_id for hammer_on/pull_off techniques', () => {
      const hammerOnNote = {
        ...baseNote,
        techniques: ['hammer_on'],
        // Missing target_note_id
      };

      expect(() => ValidatedExerciseNoteSchema.parse(hammerOnNote)).toThrow();

      const validHammerOnNote = {
        ...hammerOnNote,
        target_note_id: 'note-2',
      };

      expect(() =>
        ValidatedExerciseNoteSchema.parse(validHammerOnNote),
      ).not.toThrow();
    });
  });

  describe('ValidatedExerciseSchema', () => {
    const baseExercise = {
      id: 'exercise-1',
      title: 'Test Exercise',
      difficulty: 'beginner' as const,
      duration: 30000,
      bpm: 120,
      key: 'C',
      notes: [
        {
          id: 'note-1',
          timestamp: 1000,
          string: 4,
          fret: 3,
          duration: 500,
          note: 'G',
          color: '#FF6B6B',
        },
      ],
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    it('should validate YouTube timestamp order', () => {
      const invalidTimestampExercise = {
        ...baseExercise,
        start_timestamp: 40,
        end_timestamp: 10, // End before start
      };

      expect(() =>
        ValidatedExerciseSchema.parse(invalidTimestampExercise),
      ).toThrow();

      const validTimestampExercise = {
        ...baseExercise,
        start_timestamp: 10,
        end_timestamp: 40,
      };

      expect(() =>
        ValidatedExerciseSchema.parse(validTimestampExercise),
      ).not.toThrow();
    });
  });

  describe('CustomBasslineSchema', () => {
    const validBassline = {
      id: 'bassline-1',
      exercise_id: 'exercise-1',
      user_id: 'user-1',
      title: 'My Custom Bassline',
      notes: [
        {
          id: 'note-1',
          timestamp: 1000,
          string: 4,
          fret: 3,
          duration: 500,
          note: 'G',
          color: '#FF6B6B',
        },
      ],
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    it('should accept valid custom bassline', () => {
      expect(() => CustomBasslineSchema.parse(validBassline)).not.toThrow();
    });

    it('should require all mandatory fields', () => {
      const requiredFields = [
        'id',
        'exercise_id',
        'user_id',
        'title',
        'notes',
        'created_at',
        'updated_at',
      ];

      requiredFields.forEach((field) => {
        const invalidBassline = { ...validBassline };
        delete (invalidBassline as any)[field];
        expect(() => CustomBasslineSchema.parse(invalidBassline)).toThrow();
      });
    });

    it('should require at least one note', () => {
      expect(() =>
        CustomBasslineSchema.parse({
          ...validBassline,
          notes: [],
        }),
      ).toThrow();
    });
  });

  describe('API Request Schemas', () => {
    describe('CreateExerciseRequestSchema', () => {
      const validRequest = {
        title: 'New Exercise',
        description: 'A new exercise',
        difficulty: 'intermediate' as const,
        duration: 45000,
        bpm: 140,
        key: 'D',
        notes: [
          {
            id: 'note-1',
            timestamp: 1000,
            string: 4,
            fret: 3,
            duration: 500,
            note: 'G',
            color: '#FF6B6B',
          },
        ],
      };

      it('should accept valid create request', () => {
        expect(() =>
          CreateExerciseRequestSchema.parse(validRequest),
        ).not.toThrow();
      });

      it('should not require optional fields', () => {
        const minimalRequest = {
          title: 'Minimal Exercise',
          difficulty: 'beginner' as const,
          duration: 30000,
          bpm: 120,
          key: 'C',
          notes: [
            {
              id: 'note-1',
              timestamp: 1000,
              string: 4,
              fret: 3,
              duration: 500,
              note: 'G',
              color: '#FF6B6B',
            },
          ],
        };

        expect(() =>
          CreateExerciseRequestSchema.parse(minimalRequest),
        ).not.toThrow();
      });
    });

    describe('SaveCustomBasslineRequestSchema', () => {
      const validRequest = {
        exercise_id: 'exercise-1',
        title: 'My Bassline',
        notes: [
          {
            id: 'note-1',
            timestamp: 1000,
            string: 4,
            fret: 3,
            duration: 500,
            note: 'G',
            color: '#FF6B6B',
          },
        ],
      };

      it('should accept valid save bassline request', () => {
        expect(() =>
          SaveCustomBasslineRequestSchema.parse(validRequest),
        ).not.toThrow();
      });

      it('should require all mandatory fields', () => {
        const requiredFields = ['exercise_id', 'title', 'notes'];

        requiredFields.forEach((field) => {
          const invalidRequest = { ...validRequest };
          delete (invalidRequest as any)[field];
          expect(() =>
            SaveCustomBasslineRequestSchema.parse(invalidRequest),
          ).toThrow();
        });
      });
    });
  });

  describe('API Response Schemas', () => {
    describe('GetExercisesResponseSchema', () => {
      const validResponse = {
        exercises: [
          {
            id: 'exercise-1',
            title: 'Test Exercise',
            difficulty: 'beginner' as const,
            duration: 30000,
            bpm: 120,
            key: 'C',
            notes: [
              {
                id: 'note-1',
                timestamp: 1000,
                string: 4,
                fret: 3,
                duration: 500,
                note: 'G',
                color: '#FF6B6B',
              },
            ],
            is_active: true,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ],
      };

      it('should accept valid exercises response', () => {
        expect(() =>
          GetExercisesResponseSchema.parse(validResponse),
        ).not.toThrow();
      });

      it('should accept empty exercises array', () => {
        expect(() =>
          GetExercisesResponseSchema.parse({ exercises: [] }),
        ).not.toThrow();
      });
    });
  });
});
