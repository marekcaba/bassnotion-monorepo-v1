import { z } from 'zod';
import { TechniqueTypes } from '../types/exercise.js';

// Epic 4 Advanced Technique Schema
export const TechniqueTypeSchema = z.enum(TechniqueTypes);

// Epic 4 Compatible Note Schema
export const ExerciseNoteSchema = z.object({
  // Epic 3 Core Properties
  id: z.string().min(1, 'Note ID is required'),
  timestamp: z.number().min(0, 'Timestamp must be non-negative'),
  string: z.number().int().min(1).max(6, 'String must be between 1-6'),
  fret: z.number().int().min(0).max(24, 'Fret must be between 0-24'),
  duration: z.number().min(1, 'Duration must be positive'),
  note: z.string().min(1, 'Note value is required'),
  color: z.string().min(1, 'Color is required'),

  // Epic 4 Advanced Technique Properties (Optional)
  techniques: z.array(TechniqueTypeSchema).optional(),
  target_note_id: z.string().optional(),
  slide_to_fret: z.number().int().min(0).max(24).optional(),
  slide_type: z.enum(['legato', 'shift']).optional(),

  is_ghost_note: z.boolean().optional(),
  is_accented: z.boolean().optional(),
  accent_level: z.enum(['light', 'medium', 'heavy']).optional(),

  is_muted: z.boolean().optional(),
  mute_type: z
    .enum(['palm_mute', 'fretting_hand_mute', 'dead_note'])
    .optional(),

  is_tapped: z.boolean().optional(),
  tapping_hand: z.enum(['right', 'left', 'both']).optional(),

  bend_target_pitch: z.enum(['half_step', 'full_step']).optional(),
  vibrato_intensity: z.enum(['light', 'medium', 'heavy']).optional(),

  is_harmonic: z.boolean().optional(),
  pluck_position: z.enum(['neck', 'middle', 'bridge']).optional(),
  finger_index: z.number().int().min(1).max(4).optional(),

  display_symbol: z.string().optional(),
});

// Exercise Difficulty Schema
export const ExerciseDifficultySchema = z.enum([
  'beginner',
  'intermediate',
  'advanced',
]);

// Epic 4 Compatible Exercise Schema
export const ExerciseSchema = z.object({
  id: z.string().min(1, 'Exercise ID is required'),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  difficulty: ExerciseDifficultySchema,
  duration: z.number().min(1000, 'Duration must be at least 1 second'),
  bpm: z.number().int().min(40).max(300, 'BPM must be between 40-300'),
  key: z.string().min(1, 'Key is required'),
  youtube_video_id: z.string().optional(),
  start_timestamp: z.number().min(0).optional(),
  end_timestamp: z.number().min(0).optional(),
  notes: z.array(ExerciseNoteSchema).min(1, 'At least one note is required'),
  teaching_summary: z
    .string()
    .max(2000, 'Teaching summary too long')
    .optional(),
  is_active: z.boolean(),
  created_by: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

// Custom Bassline Schema
export const CustomBasslineSchema = z.object({
  id: z.string().min(1, 'Bassline ID is required'),
  exercise_id: z.string().min(1, 'Exercise ID is required'),
  user_id: z.string().min(1, 'User ID is required'),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  notes: z.array(ExerciseNoteSchema).min(1, 'At least one note is required'),
  created_at: z.string(),
  updated_at: z.string(),
});

// API Request/Response Schemas
export const GetExercisesResponseSchema = z.object({
  exercises: z.array(ExerciseSchema),
});

export const GetExerciseResponseSchema = z.object({
  exercise: ExerciseSchema,
});

export const GetCustomBasslinesResponseSchema = z.object({
  basslines: z.array(CustomBasslineSchema),
});

// Epic 5 Admin Schemas (Forward Compatible)
export const CreateExerciseRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  difficulty: ExerciseDifficultySchema,
  duration: z.number().min(1000, 'Duration must be at least 1 second'),
  bpm: z.number().int().min(40).max(300, 'BPM must be between 40-300'),
  key: z.string().min(1, 'Key is required'),
  youtube_video_id: z.string().optional(),
  start_timestamp: z.number().min(0).optional(),
  end_timestamp: z.number().min(0).optional(),
  notes: z.array(ExerciseNoteSchema).min(1, 'At least one note is required'),
  teaching_summary: z
    .string()
    .max(2000, 'Teaching summary too long')
    .optional(),
});

export const UpdateExerciseRequestSchema = CreateExerciseRequestSchema.partial().extend({
  id: z.string().min(1, 'Exercise ID is required'),
});

// Epic 3 Widget-Specific Schemas
export const SaveCustomBasslineRequestSchema = z.object({
  exercise_id: z.string().min(1, 'Exercise ID is required'),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  notes: z.array(ExerciseNoteSchema).min(1, 'At least one note is required'),
});

// Validation refinements for Epic 4 compatibility
export const ValidatedExerciseNoteSchema = ExerciseNoteSchema.refine(
  (note) => {
    // If slide techniques are present, slide_to_fret should be provided
    if (
      note.techniques?.some((t) => t.includes('slide')) &&
      !note.slide_to_fret
    ) {
      return false;
    }
    // If target-based techniques are present, target_note_id should be provided
    if (
      note.techniques?.some((t) => ['hammer_on', 'pull_off'].includes(t)) &&
      !note.target_note_id
    ) {
      return false;
    }
    return true;
  },
  {
    message: 'Technique properties must be consistent with applied techniques',
  },
);

export const ValidatedExerciseSchema = ExerciseSchema.extend({
  notes: z.array(ValidatedExerciseNoteSchema),
}).refine(
  (exercise) => {
    // YouTube timestamp validation
    if (exercise.start_timestamp && exercise.end_timestamp) {
      return exercise.start_timestamp < exercise.end_timestamp;
    }
    return true;
  },
  {
    message: 'Start timestamp must be before end timestamp',
  },
);

// Type inference from schemas
export type ExerciseNoteInput = z.infer<typeof ExerciseNoteSchema>;
export type ExerciseInput = z.infer<typeof ExerciseSchema>;
export type CustomBasslineInput = z.infer<typeof CustomBasslineSchema>;
export type CreateExerciseRequestInput = z.infer<typeof CreateExerciseRequestSchema>;
export type UpdateExerciseRequestInput = z.infer<typeof UpdateExerciseRequestSchema>;
export type SaveCustomBasslineRequestInput = z.infer<typeof SaveCustomBasslineRequestSchema>; 