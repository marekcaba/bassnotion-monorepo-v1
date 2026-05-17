import { apiClient } from '@/lib/api-client';
import { Result } from '@/shared/types/result';
import { Tutorial } from '../entities/tutorial.entity';
import { TutorialId } from '../value-objects/tutorial-id.vo';
import { TutorialSlug } from '../value-objects/tutorial-slug.vo';
import { TutorialLevel } from '../value-objects/tutorial-level.vo';
import { supabase } from '@/infrastructure/supabase/client';
import { createStructuredLogger } from '@bassnotion/contracts';
import {
  ITutorialRepository,
  PaginatedResult,
  PaginationOptions,
  TutorialFilters,
} from './tutorial.repository.interface';
import { Exercise } from '@/domains/exercises/entities/exercise.entity';
import type {
  TutorialDTO,
  ExerciseDTO,
  TutorialListResponseDTO as TutorialListResponse,
  TutorialWithExercisesResponseDTO as TutorialWithExercisesResponse,
  SaveWithExercisesResponseDTO as SaveWithExercisesResponse,
} from '@bassnotion/contracts';

const logger = createStructuredLogger('TutorialRepository');

/** Helper to check if error has response status for HTTP errors */
function getErrorStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { status?: number } }).response;
    return response?.status;
  }
  return undefined;
}

export class TutorialRepository implements ITutorialRepository {
  private readonly baseUrl = '/api/v1/tutorials';

  private async ensureAuth() {
    logger.debug('Ensuring authentication...');
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      logger.debug('Setting auth token', { hasToken: true });
      apiClient.setAuthToken(session.access_token);
    } else {
      logger.warn('No auth session available');
    }
  }

  async findById(id: TutorialId): Promise<Result<Tutorial>> {
    try {
      await this.ensureAuth();
      const response = await apiClient.get(`${this.baseUrl}/${id.value}`);

      logger.debug('findById response', {
        id: id.value,
        hasResponse: !!response,
        responseType: typeof response,
        responseKeys: response ? Object.keys(response) : [],
      });

      // The response IS the data (not response.data)
      const data = response as TutorialDTO;

      if (!data) {
        logger.error('No data in findById response');
        return Result.failure(new Error('Tutorial not found'));
      }

      const tutorial = Tutorial.fromDTO(data);
      return Result.success(tutorial);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch tutorial';
      logger.error('Failed to fetch tutorial by id', {
        error: errorMessage,
        id: id.value,
      });
      return Result.failure(new Error(errorMessage));
    }
  }

  async findBySlug(slug: TutorialSlug): Promise<Result<Tutorial>> {
    try {
      await this.ensureAuth();
      const response = await apiClient.get(
        `${this.baseUrl}/slug/${slug.value}`,
      );

      logger.debug('findBySlug response', {
        slug: slug.value,
        hasResponse: !!response,
        responseType: typeof response,
        responseKeys: response ? Object.keys(response) : [],
      });

      // The response IS the data (not response.data)
      const data = response as TutorialDTO;

      if (!data) {
        logger.error('No data in findBySlug response');
        return Result.failure(new Error('Tutorial not found'));
      }

      const tutorial = Tutorial.fromDTO(data);
      return Result.success(tutorial);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to fetch tutorial by slug';
      logger.error('Failed to fetch tutorial by slug', {
        error: errorMessage,
        slug: slug.value,
      });
      return Result.failure(new Error(errorMessage));
    }
  }

  // OPTIMIZATION: Batch fetch tutorial with exercises to reduce API calls
  async findBySlugWithExercises(
    slug: TutorialSlug,
  ): Promise<Result<{ tutorial: Tutorial; exercises: Exercise[] }>> {
    try {
      await this.ensureAuth();
      const response = await apiClient.get(
        `${this.baseUrl}/slug/${slug.value}?includeExercises=true`,
      );

      // Cast to typed response
      const data = response as TutorialWithExercisesResponse;

      logger.debug('findBySlugWithExercises response', {
        slug: slug.value,
        hasResponse: !!response,
        hasTutorial: !!data.tutorial,
        hasExercises: !!data.exercises,
        exerciseCount: data.exercises?.length || 0,
      });

      if (!data || !data.tutorial) {
        logger.error('No tutorial data in findBySlugWithExercises response');
        return Result.failure(new Error('Tutorial not found'));
      }

      const tutorial = Tutorial.fromDTO(data.tutorial);
      const exercises = (data.exercises || []).map((dto: ExerciseDTO) =>
        Exercise.fromDTO(dto),
      );

      return Result.success({ tutorial, exercises });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to fetch tutorial with exercises by slug';
      logger.error('Failed to fetch tutorial with exercises by slug', {
        error: errorMessage,
        slug: slug.value,
      });
      return Result.failure(new Error(errorMessage));
    }
  }

  async findAll(
    options?: PaginationOptions,
  ): Promise<Result<PaginatedResult<Tutorial>>> {
    try {
      await this.ensureAuth();
      const params = new URLSearchParams();
      if (options) {
        params.append('page', options.page.toString());
        params.append('limit', options.limit.toString());
      }

      const url = `${this.baseUrl}?${params.toString()}`;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      logger.info('Fetching tutorials', {
        url,
        options,
        hasAuth: !!session?.access_token,
      });

      const response = await apiClient.get(url);

      logger.debug('API Response received', {
        status: response?.status,
        hasData: !!response,
        dataType: typeof response,
        responseKeys: response ? Object.keys(response) : [],
      });

      // Check if response exists
      if (!response) {
        logger.error('No response from API');
        return Result.failure(new Error('No response from API'));
      }

      // The response IS the data (not response.data)
      const data = response as TutorialListResponse;

      logger.debug('Response structure', {
        hasItems: 'items' in data,
        hasTutorials: 'tutorials' in data,
        keys: Object.keys(data),
        itemsLength: data.items?.length || data.tutorials?.length || 0,
      });

      // Handle both possible response formats
      const tutorialDtos = data.items || data.tutorials || [];
      const total = data.total || tutorialDtos.length;

      const page = options?.page || 1;
      const limit = options?.limit || 10;

      logger.info('Processing tutorials', {
        count: tutorialDtos.length,
        total,
        page,
        limit,
      });

      const tutorials = tutorialDtos.map((dto: TutorialDTO) =>
        Tutorial.fromDTO(dto),
      );
      const totalPages = Math.ceil(total / limit);

      return Result.success({
        items: tutorials,
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch tutorials';
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error('Failed to fetch tutorials', {
        error: errorMessage,
        stack: errorStack,
      });
      return Result.failure(new Error(errorMessage));
    }
  }

  async findByLevel(level: TutorialLevel): Promise<Result<Tutorial[]>> {
    try {
      await this.ensureAuth();
      const response = await apiClient.get(
        `${this.baseUrl}/level/${level.value}`,
      );
      const tutorials = (response.data as TutorialDTO[]).map(
        (dto: TutorialDTO) => Tutorial.fromDTO(dto),
      );
      return Result.success(tutorials);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to fetch tutorials by level';
      return Result.failure(new Error(errorMessage));
    }
  }

  async findByTag(tag: string): Promise<Result<Tutorial[]>> {
    try {
      await this.ensureAuth();
      const response = await apiClient.get(
        `${this.baseUrl}/tag/${encodeURIComponent(tag)}`,
      );
      const tutorials = (response.data as TutorialDTO[]).map(
        (dto: TutorialDTO) => Tutorial.fromDTO(dto),
      );
      return Result.success(tutorials);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to fetch tutorials by tag';
      return Result.failure(new Error(errorMessage));
    }
  }

  async findByAuthor(authorName: string): Promise<Result<Tutorial[]>> {
    try {
      await this.ensureAuth();
      const response = await apiClient.get(
        `${this.baseUrl}/author/${encodeURIComponent(authorName)}`,
      );
      const tutorials = (response.data as TutorialDTO[]).map(
        (dto: TutorialDTO) => Tutorial.fromDTO(dto),
      );
      return Result.success(tutorials);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to fetch tutorials by author';
      return Result.failure(new Error(errorMessage));
    }
  }

  async search(
    query: string,
    filters?: TutorialFilters,
  ): Promise<Result<Tutorial[]>> {
    try {
      await this.ensureAuth();
      const params = new URLSearchParams();
      params.append('q', query);

      if (filters) {
        if (filters.level) {
          params.append('level', filters.level.value);
        }

        if (filters.tags && filters.tags.length > 0) {
          params.append('tags', filters.tags.join(','));
        }

        if (filters.isActive !== undefined) {
          params.append('active', filters.isActive.toString());
        }

        if (filters.isPublished !== undefined) {
          params.append('published', filters.isPublished.toString());
        }

        if (filters.authorName) {
          params.append('author', filters.authorName);
        }

        if (filters.durationRange) {
          params.append('durationMin', filters.durationRange.min.toString());
          params.append('durationMax', filters.durationRange.max.toString());
        }
      }

      const response = await apiClient.get(
        `${this.baseUrl}/search?${params.toString()}`,
      );
      const tutorials = (response.data as TutorialDTO[]).map(
        (dto: TutorialDTO) => Tutorial.fromDTO(dto),
      );
      return Result.success(tutorials);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to search tutorials';
      return Result.failure(new Error(errorMessage));
    }
  }

  async findByIds(ids: TutorialId[]): Promise<Result<Tutorial[]>> {
    try {
      await this.ensureAuth();
      const response = await apiClient.post(`${this.baseUrl}/batch`, {
        ids: ids.map((id) => id.value),
      });
      const tutorials = (response.data as TutorialDTO[]).map(
        (dto: TutorialDTO) => Tutorial.fromDTO(dto),
      );
      return Result.success(tutorials);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to fetch tutorials by ids';
      return Result.failure(new Error(errorMessage));
    }
  }

  async findPublished(
    options?: PaginationOptions,
  ): Promise<Result<PaginatedResult<Tutorial>>> {
    try {
      await this.ensureAuth();
      const params = new URLSearchParams();
      if (options) {
        params.append('page', options.page.toString());
        params.append('limit', options.limit.toString());
      }

      const response = await apiClient.get(
        `${this.baseUrl}/published?${params.toString()}`,
      );
      const { items, total, page, limit } = response.data as {
        items: TutorialDTO[];
        total: number;
        page: number;
        limit: number;
      };

      const tutorials = items.map((dto: TutorialDTO) => Tutorial.fromDTO(dto));
      const totalPages = Math.ceil(total / limit);

      return Result.success({
        items: tutorials,
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to fetch published tutorials';
      return Result.failure(new Error(errorMessage));
    }
  }

  async findRelated(
    tutorialId: TutorialId,
    limit = 5,
  ): Promise<Result<Tutorial[]>> {
    try {
      await this.ensureAuth();
      const response = await apiClient.get(
        `${this.baseUrl}/${tutorialId.value}/related?limit=${limit}`,
      );
      const tutorials = (response.data as TutorialDTO[]).map(
        (dto: TutorialDTO) => Tutorial.fromDTO(dto),
      );
      return Result.success(tutorials);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to fetch related tutorials';
      return Result.failure(new Error(errorMessage));
    }
  }

  async save(tutorial: Tutorial): Promise<Result<Tutorial>> {
    try {
      await this.ensureAuth();
      const tutorialData = tutorial.toDTO();

      logger.info('Saving new tutorial', {
        title: tutorialData.title,
        status: tutorialData.status,
        hasAuth: apiClient.hasAuthToken(),
      });

      const response = await apiClient.post(this.baseUrl, tutorialData);

      logger.debug('Save response', {
        hasResponse: !!response,
        responseType: typeof response,
        responseKeys: response ? Object.keys(response) : [],
      });

      if (!response) {
        logger.error('No response from save API');
        return Result.failure(new Error('No response from server'));
      }

      // The response IS the data (not response.data)
      const savedTutorial = Tutorial.fromDTO(response as TutorialDTO);
      logger.info('Tutorial saved successfully', {
        id: savedTutorial.id.value,
        slug: savedTutorial.slug.value,
      });

      return Result.success(savedTutorial);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to save tutorial';
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error('Failed to save tutorial', {
        error: errorMessage,
        stack: errorStack,
      });
      return Result.failure(new Error(errorMessage));
    }
  }

  // Alias for save method to match common naming conventions
  async create(tutorial: Tutorial): Promise<Result<Tutorial>> {
    return this.save(tutorial);
  }

  /**
   * FAANG-level batch save - atomically saves tutorial and exercises
   * Uses optimistic updates pattern with server reconciliation
   */
  async saveWithExercises(
    tutorial: Tutorial,
    exercises: Array<{ exercise: any; isExisting: boolean }>,
    tempMidiPathsMap?: WeakMap<
      Exercise,
      {
        temp_bassline_midi_path?: string;
        temp_drummer_midi_path?: string;
        temp_harmony_midi_path?: string;
        temp_metronome_midi_path?: string;
      }
    >,
  ): Promise<Result<{ tutorial: Tutorial; exercises: any[] }>> {
    try {
      await this.ensureAuth();

      logger.info('Batch saving tutorial with exercises', {
        tutorialId: tutorial.id.value,
        exerciseCount: exercises.length,
        hasAuth: apiClient.hasAuthToken(),
      });

      // Prepare payload - strip IDs from new exercises
      const exerciseDtos = exercises.map(({ exercise, isExisting }) => {
        const dto = exercise.toDTO();

        // If not existing in DB, remove the client-generated ID
        // Backend will create new exercise with server-assigned ID
        if (!isExisting) {
          delete dto.id;
        }

        // Preserve temp MIDI paths for backend migration (Story 4.4 - Task 4.2)
        // Use WeakMap to retrieve paths since Exercise entities are frozen/non-extensible
        const tempMidiPaths = tempMidiPathsMap?.get(exercise);
        if (tempMidiPaths) {
          dto.temp_bassline_midi_path = tempMidiPaths.temp_bassline_midi_path;
          dto.temp_drummer_midi_path = tempMidiPaths.temp_drummer_midi_path;
          dto.temp_harmony_midi_path = tempMidiPaths.temp_harmony_midi_path;
          dto.temp_metronome_midi_path = tempMidiPaths.temp_metronome_midi_path;

          logger.debug('Including temp MIDI paths in exercise DTO', {
            exerciseId: dto.id || 'NEW',
            hasBassline: !!tempMidiPaths.temp_bassline_midi_path,
            hasDrummer: !!tempMidiPaths.temp_drummer_midi_path,
            hasHarmony: !!tempMidiPaths.temp_harmony_midi_path,
            hasMetronome: !!tempMidiPaths.temp_metronome_midi_path,
          });
        }

        return dto;
      });

      const payload = {
        id: tutorial.id.value,
        ...tutorial.toDTO(),
        exercises: exerciseDtos,
      };

      logger.debug('Batch save payload prepared', {
        tutorialId: payload.id,
        tutorialTitle: payload.title,
        exerciseCount: payload.exercises.length,
        exerciseIds: payload.exercises.map((e: ExerciseDTO) => e.id || 'NEW'),
        newExerciseCount: payload.exercises.filter((e: ExerciseDTO) => !e.id)
          .length,
      });

      const response = await apiClient.put(
        `${this.baseUrl}/${tutorial.id.value}/save-with-exercises`,
        payload,
      );

      if (!response) {
        logger.error('No response from batch save API');
        return Result.failure(
          new Error('Failed to save tutorial with exercises'),
        );
      }

      const data = response as SaveWithExercisesResponse;

      // Reconstruct entities from server response
      const savedTutorial = Tutorial.fromDTO(data.tutorial);
      const savedExercises = data.exercises;

      logger.info('Batch save successful', {
        tutorialId: savedTutorial.id.value,
        exerciseCount: savedExercises.length,
      });

      return Result.success({
        tutorial: savedTutorial,
        exercises: savedExercises,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to save tutorial with exercises';
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error('Failed to batch save tutorial with exercises', {
        error: errorMessage,
        tutorialId: tutorial.id.value,
        stack: errorStack,
      });
      return Result.failure(new Error(errorMessage));
    }
  }

  async update(tutorial: Tutorial): Promise<Result<Tutorial>> {
    try {
      await this.ensureAuth();

      logger.info('Updating tutorial', {
        id: tutorial.id.value,
        hasAuth: apiClient.hasAuthToken(),
      });

      const response = await apiClient.put(
        `${this.baseUrl}/${tutorial.id.value}`,
        tutorial.toDTO(),
      );

      if (!response) {
        logger.error('No response from update API');
        return Result.failure(new Error('No response from server'));
      }

      // The response IS the data (not response.data)
      const updatedTutorial = Tutorial.fromDTO(response as TutorialDTO);
      logger.info('Tutorial updated successfully', {
        id: updatedTutorial.id.value,
      });

      return Result.success(updatedTutorial);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to update tutorial';
      logger.error('Failed to update tutorial', {
        error: errorMessage,
      });
      return Result.failure(new Error(errorMessage));
    }
  }

  async delete(id: TutorialId): Promise<Result<void>> {
    try {
      await this.ensureAuth();
      await apiClient.delete(`${this.baseUrl}/${id.value}`);
      return Result.success(undefined);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to delete tutorial';
      return Result.failure(new Error(errorMessage));
    }
  }

  async saveMany(tutorials: Tutorial[]): Promise<Result<Tutorial[]>> {
    try {
      await this.ensureAuth();
      const response = await apiClient.post(`${this.baseUrl}/batch/create`, {
        tutorials: tutorials.map((t) => t.toDTO()),
      });
      const savedTutorials = (response.data as TutorialDTO[]).map(
        (dto: TutorialDTO) => Tutorial.fromDTO(dto),
      );
      return Result.success(savedTutorials);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to save tutorials';
      return Result.failure(new Error(errorMessage));
    }
  }

  async deleteMany(ids: TutorialId[]): Promise<Result<void>> {
    try {
      await this.ensureAuth();
      await apiClient.post(`${this.baseUrl}/batch/delete`, {
        ids: ids.map((id) => id.value),
      });
      return Result.success(undefined);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to delete tutorials';
      return Result.failure(new Error(errorMessage));
    }
  }

  async exists(id: TutorialId): Promise<Result<boolean>> {
    try {
      await this.ensureAuth();
      const response = await apiClient.head(`${this.baseUrl}/${id.value}`);
      return Result.success(response.status === 200);
    } catch (error: unknown) {
      if (getErrorStatus(error) === 404) {
        return Result.success(false);
      }
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to check if tutorial exists';
      return Result.failure(new Error(errorMessage));
    }
  }

  async existsBySlug(slug: TutorialSlug): Promise<Result<boolean>> {
    try {
      await this.ensureAuth();
      const response = await apiClient.head(
        `${this.baseUrl}/slug/${slug.value}`,
      );
      return Result.success(response.status === 200);
    } catch (error: unknown) {
      if (getErrorStatus(error) === 404) {
        return Result.success(false);
      }
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to check if tutorial exists by slug';
      return Result.failure(new Error(errorMessage));
    }
  }

  async count(): Promise<Result<number>> {
    try {
      await this.ensureAuth();
      const response = await apiClient.get(`${this.baseUrl}/count`);
      return Result.success((response.data as { count: number }).count);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to count tutorials';
      return Result.failure(new Error(errorMessage));
    }
  }

  async countByLevel(level: TutorialLevel): Promise<Result<number>> {
    try {
      await this.ensureAuth();
      const response = await apiClient.get(
        `${this.baseUrl}/count/level/${level.value}`,
      );
      return Result.success((response.data as { count: number }).count);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to count tutorials by level';
      return Result.failure(new Error(errorMessage));
    }
  }

  async incrementViewCount(id: TutorialId): Promise<Result<void>> {
    try {
      await this.ensureAuth();
      await apiClient.post(`${this.baseUrl}/${id.value}/view`);
      return Result.success(undefined);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to increment view count';
      return Result.failure(new Error(errorMessage));
    }
  }
}
