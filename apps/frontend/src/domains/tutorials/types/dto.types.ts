/**
 * Tutorial DTO Types
 *
 * Re-exports shared DTO types from @bassnotion/contracts for backward compatibility.
 * New code should import directly from @bassnotion/contracts.
 *
 * NOTE: The canonical definitions are in libs/contracts/src/types/api-dto.ts
 * This file exists for backward compatibility during the migration.
 */

// Re-export shared types from contracts
export type {
  ExerciseDTO,
  TutorialDTO,
  TutorialLevelType,
  TutorialStatusType,
  TutorialSectionDTO,
  TutorialListResponseDTO,
  TutorialWithExercisesResponseDTO,
  SaveWithExercisesResponseDTO,
  PaginatedResponseDTO,
} from '@bassnotion/contracts';

// Backward compatibility aliases
import type {
  TutorialListResponseDTO,
  TutorialWithExercisesResponseDTO,
  SaveWithExercisesResponseDTO,
  PaginatedResponseDTO,
} from '@bassnotion/contracts';

/**
 * @deprecated Use TutorialListResponseDTO from @bassnotion/contracts
 */
export type TutorialListResponse = TutorialListResponseDTO;

/**
 * @deprecated Use TutorialWithExercisesResponseDTO from @bassnotion/contracts
 */
export type TutorialWithExercisesResponse = TutorialWithExercisesResponseDTO;

/**
 * @deprecated Use SaveWithExercisesResponseDTO from @bassnotion/contracts
 */
export type SaveWithExercisesResponse = SaveWithExercisesResponseDTO;

/**
 * @deprecated Use PaginatedResponseDTO from @bassnotion/contracts
 */
export type PaginatedResponse<T> = PaginatedResponseDTO<T>;
