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
import { TutorialRepository } from './tutorial.repository';
import { CachedTutorialRepository } from './cached-tutorial.repository';

export class ResultTutorialRepository implements ITutorialRepository {
  private readonly repository: ITutorialRepository;

  constructor() {
    const baseRepository = new TutorialRepository();
    this.repository = new CachedTutorialRepository(baseRepository);
  }

  async findById(id: TutorialId): Promise<Result<Tutorial>> {
    try {
      return await this.repository.findById(id);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while fetching tutorial'
      );
    }
  }

  async findBySlug(slug: TutorialSlug): Promise<Result<Tutorial>> {
    try {
      return await this.repository.findBySlug(slug);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while fetching tutorial by slug'
      );
    }
  }

  async findAll(options?: PaginationOptions): Promise<Result<PaginatedResult<Tutorial>>> {
    try {
      return await this.repository.findAll(options);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while fetching tutorials'
      );
    }
  }

  async findByLevel(level: TutorialLevel): Promise<Result<Tutorial[]>> {
    try {
      return await this.repository.findByLevel(level);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while fetching tutorials by level'
      );
    }
  }

  async findByTag(tag: string): Promise<Result<Tutorial[]>> {
    try {
      return await this.repository.findByTag(tag);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while fetching tutorials by tag'
      );
    }
  }

  async findByAuthor(authorName: string): Promise<Result<Tutorial[]>> {
    try {
      return await this.repository.findByAuthor(authorName);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while fetching tutorials by author'
      );
    }
  }

  async search(query: string, filters?: TutorialFilters): Promise<Result<Tutorial[]>> {
    try {
      return await this.repository.search(query, filters);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while searching tutorials'
      );
    }
  }

  async findByIds(ids: TutorialId[]): Promise<Result<Tutorial[]>> {
    try {
      return await this.repository.findByIds(ids);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while fetching tutorials by ids'
      );
    }
  }

  async findPublished(options?: PaginationOptions): Promise<Result<PaginatedResult<Tutorial>>> {
    try {
      return await this.repository.findPublished(options);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while fetching published tutorials'
      );
    }
  }

  async findRelated(tutorialId: TutorialId, limit?: number): Promise<Result<Tutorial[]>> {
    try {
      return await this.repository.findRelated(tutorialId, limit);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while fetching related tutorials'
      );
    }
  }

  async save(tutorial: Tutorial): Promise<Result<Tutorial>> {
    try {
      return await this.repository.save(tutorial);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while saving tutorial'
      );
    }
  }

  async update(tutorial: Tutorial): Promise<Result<Tutorial>> {
    try {
      return await this.repository.update(tutorial);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while updating tutorial'
      );
    }
  }

  async delete(id: TutorialId): Promise<Result<void>> {
    try {
      return await this.repository.delete(id);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while deleting tutorial'
      );
    }
  }

  async saveMany(tutorials: Tutorial[]): Promise<Result<Tutorial[]>> {
    try {
      return await this.repository.saveMany(tutorials);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while saving tutorials'
      );
    }
  }

  async deleteMany(ids: TutorialId[]): Promise<Result<void>> {
    try {
      return await this.repository.deleteMany(ids);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while deleting tutorials'
      );
    }
  }

  async exists(id: TutorialId): Promise<Result<boolean>> {
    try {
      return await this.repository.exists(id);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while checking tutorial existence'
      );
    }
  }

  async existsBySlug(slug: TutorialSlug): Promise<Result<boolean>> {
    try {
      return await this.repository.existsBySlug(slug);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while checking tutorial existence by slug'
      );
    }
  }

  async count(): Promise<Result<number>> {
    try {
      return await this.repository.count();
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while counting tutorials'
      );
    }
  }

  async countByLevel(level: TutorialLevel): Promise<Result<number>> {
    try {
      return await this.repository.countByLevel(level);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while counting tutorials by level'
      );
    }
  }

  async incrementViewCount(id: TutorialId): Promise<Result<void>> {
    try {
      return await this.repository.incrementViewCount(id);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while incrementing view count'
      );
    }
  }

  // Utility method to access cache clearing if needed
  clearCache(): void {
    if (this.repository instanceof CachedTutorialRepository) {
      this.repository.clearCache();
    }
  }
}