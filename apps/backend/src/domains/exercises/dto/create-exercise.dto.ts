import {
  CreateExerciseRequestSchema,
  UpdateExerciseRequestSchema,
  type CreateExerciseRequestInput,
  type UpdateExerciseRequestInput,
} from '@bassnotion/contracts';

// Epic 5 Admin Operation DTOs - Use contract types directly
export type CreateExerciseDto = CreateExerciseRequestInput;
export type UpdateExerciseDto = UpdateExerciseRequestInput;

// Validation functions using contracts schemas
export const validateCreateExercise = (data: unknown): CreateExerciseDto => {
  return CreateExerciseRequestSchema.parse(data);
};

export const validateUpdateExercise = (data: unknown): UpdateExerciseDto => {
  return UpdateExerciseRequestSchema.parse(data);
};
