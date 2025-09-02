import { apiClient } from '@/lib/api-client';
import { Result } from '@/shared/types/result';
import { Tutorial } from '../entities/tutorial.entity';
import { TutorialId } from '../value-objects/tutorial-id.vo';
import { TutorialSlug } from '../value-objects/tutorial-slug.vo';
import { TutorialLevel } from '../value-objects/tutorial-level.vo';
import {
  ITutorialRepository,
  PaginatedResult,
  PaginationOptions,
  TutorialFilters,
} from './tutorial.repository.interface';

export class TutorialRepository implements ITutorialRepository {
  private readonly baseUrl = '/api/v1/tutorials';

  async findById(id: TutorialId): Promise<Result<Tutorial>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/${id.value}`);
      const tutorial = Tutorial.fromDTO(response.data);
      return Result.ok(tutorial);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to fetch tutorial');
    }
  }

  async findBySlug(slug: TutorialSlug): Promise<Result<Tutorial>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/slug/${slug.value}`);
      const tutorial = Tutorial.fromDTO(response.data);
      return Result.ok(tutorial);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to fetch tutorial by slug');
    }
  }

  async findAll(options?: PaginationOptions): Promise<Result<PaginatedResult<Tutorial>>> {
    try {
      const params = new URLSearchParams();
      if (options) {
        params.append('page', options.page.toString());
        params.append('limit', options.limit.toString());
      }

      const response = await apiClient.get(`${this.baseUrl}?${params.toString()}`);
      const { items, total, page, limit } = response.data;
      
      const tutorials = items.map((dto: any) => Tutorial.fromDTO(dto));
      const totalPages = Math.ceil(total / limit);
      
      return Result.ok({
        items: tutorials,
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      });
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to fetch tutorials');
    }
  }

  async findByLevel(level: TutorialLevel): Promise<Result<Tutorial[]>> {
    try {
      const response = await apiClient.get(
        `${this.baseUrl}/level/${level.value}`
      );
      const tutorials = response.data.map((dto: any) => Tutorial.fromDTO(dto));
      return Result.ok(tutorials);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to fetch tutorials by level');
    }
  }

  async findByTag(tag: string): Promise<Result<Tutorial[]>> {
    try {
      const response = await apiClient.get(
        `${this.baseUrl}/tag/${encodeURIComponent(tag)}`
      );
      const tutorials = response.data.map((dto: any) => Tutorial.fromDTO(dto));
      return Result.ok(tutorials);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to fetch tutorials by tag');
    }
  }

  async findByAuthor(authorName: string): Promise<Result<Tutorial[]>> {
    try {
      const response = await apiClient.get(
        `${this.baseUrl}/author/${encodeURIComponent(authorName)}`
      );
      const tutorials = response.data.map((dto: any) => Tutorial.fromDTO(dto));
      return Result.ok(tutorials);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to fetch tutorials by author');
    }
  }

  async search(query: string, filters?: TutorialFilters): Promise<Result<Tutorial[]>> {
    try {
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

      const response = await apiClient.get(`${this.baseUrl}/search?${params.toString()}`);
      const tutorials = response.data.map((dto: any) => Tutorial.fromDTO(dto));
      return Result.ok(tutorials);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to search tutorials');
    }
  }

  async findByIds(ids: TutorialId[]): Promise<Result<Tutorial[]>> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/batch`, {
        ids: ids.map(id => id.value),
      });
      const tutorials = response.data.map((dto: any) => Tutorial.fromDTO(dto));
      return Result.ok(tutorials);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to fetch tutorials by ids');
    }
  }

  async findPublished(options?: PaginationOptions): Promise<Result<PaginatedResult<Tutorial>>> {
    try {
      const params = new URLSearchParams();
      if (options) {
        params.append('page', options.page.toString());
        params.append('limit', options.limit.toString());
      }

      const response = await apiClient.get(`${this.baseUrl}/published?${params.toString()}`);
      const { items, total, page, limit } = response.data;
      
      const tutorials = items.map((dto: any) => Tutorial.fromDTO(dto));
      const totalPages = Math.ceil(total / limit);
      
      return Result.ok({
        items: tutorials,
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      });
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to fetch published tutorials');
    }
  }

  async findRelated(tutorialId: TutorialId, limit: number = 5): Promise<Result<Tutorial[]>> {
    try {
      const response = await apiClient.get(
        `${this.baseUrl}/${tutorialId.value}/related?limit=${limit}`
      );
      const tutorials = response.data.map((dto: any) => Tutorial.fromDTO(dto));
      return Result.ok(tutorials);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to fetch related tutorials');
    }
  }

  async save(tutorial: Tutorial): Promise<Result<Tutorial>> {
    try {
      const response = await apiClient.post(this.baseUrl, tutorial.toDTO());
      const savedTutorial = Tutorial.fromDTO(response.data);
      return Result.ok(savedTutorial);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to save tutorial');
    }
  }

  async update(tutorial: Tutorial): Promise<Result<Tutorial>> {
    try {
      const response = await apiClient.put(
        `${this.baseUrl}/${tutorial.id.value}`,
        tutorial.toDTO()
      );
      const updatedTutorial = Tutorial.fromDTO(response.data);
      return Result.ok(updatedTutorial);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to update tutorial');
    }
  }

  async delete(id: TutorialId): Promise<Result<void>> {
    try {
      await apiClient.delete(`${this.baseUrl}/${id.value}`);
      return Result.ok(undefined);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to delete tutorial');
    }
  }

  async saveMany(tutorials: Tutorial[]): Promise<Result<Tutorial[]>> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/batch/create`, {
        tutorials: tutorials.map(t => t.toDTO()),
      });
      const savedTutorials = response.data.map((dto: any) => Tutorial.fromDTO(dto));
      return Result.ok(savedTutorials);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to save tutorials');
    }
  }

  async deleteMany(ids: TutorialId[]): Promise<Result<void>> {
    try {
      await apiClient.post(`${this.baseUrl}/batch/delete`, {
        ids: ids.map(id => id.value),
      });
      return Result.ok(undefined);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to delete tutorials');
    }
  }

  async exists(id: TutorialId): Promise<Result<boolean>> {
    try {
      const response = await apiClient.head(`${this.baseUrl}/${id.value}`);
      return Result.ok(response.status === 200);
    } catch (error: any) {
      if (error.response?.status === 404) {
        return Result.ok(false);
      }
      return Result.fail(error.message || 'Failed to check if tutorial exists');
    }
  }

  async existsBySlug(slug: TutorialSlug): Promise<Result<boolean>> {
    try {
      const response = await apiClient.head(`${this.baseUrl}/slug/${slug.value}`);
      return Result.ok(response.status === 200);
    } catch (error: any) {
      if (error.response?.status === 404) {
        return Result.ok(false);
      }
      return Result.fail(error.message || 'Failed to check if tutorial exists by slug');
    }
  }

  async count(): Promise<Result<number>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/count`);
      return Result.ok(response.data.count);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to count tutorials');
    }
  }

  async countByLevel(level: TutorialLevel): Promise<Result<number>> {
    try {
      const response = await apiClient.get(
        `${this.baseUrl}/count/level/${level.value}`
      );
      return Result.ok(response.data.count);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to count tutorials by level');
    }
  }

  async incrementViewCount(id: TutorialId): Promise<Result<void>> {
    try {
      await apiClient.post(`${this.baseUrl}/${id.value}/view`);
      return Result.ok(undefined);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to increment view count');
    }
  }
}