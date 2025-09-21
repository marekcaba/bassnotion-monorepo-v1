import { Tutorial } from '../entities/tutorial.entity';
import { TutorialId } from '../value-objects/tutorial-id.vo';
import { TutorialSlug } from '../value-objects/tutorial-slug.vo';
import { TutorialLevel } from '../value-objects/tutorial-level.vo';
import { Result } from '@/shared/types/result';

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface TutorialFilters {
  level?: TutorialLevel;
  tags?: string[];
  isActive?: boolean;
  isPublished?: boolean;
  authorName?: string;
  durationRange?: {
    min: number;
    max: number;
  };
}

export interface ITutorialRepository {
  // Read operations
  findById(id: TutorialId): Promise<Result<Tutorial>>;
  findBySlug(slug: TutorialSlug): Promise<Result<Tutorial>>;
  findAll(
    options?: PaginationOptions,
  ): Promise<Result<PaginatedResult<Tutorial>>>;
  findByLevel(level: TutorialLevel): Promise<Result<Tutorial[]>>;
  findByTag(tag: string): Promise<Result<Tutorial[]>>;
  findByAuthor(authorName: string): Promise<Result<Tutorial[]>>;
  search(query: string, filters?: TutorialFilters): Promise<Result<Tutorial[]>>;
  findByIds(ids: TutorialId[]): Promise<Result<Tutorial[]>>;
  findPublished(
    options?: PaginationOptions,
  ): Promise<Result<PaginatedResult<Tutorial>>>;
  findRelated(
    tutorialId: TutorialId,
    limit?: number,
  ): Promise<Result<Tutorial[]>>;

  // Write operations
  save(tutorial: Tutorial): Promise<Result<Tutorial>>;
  update(tutorial: Tutorial): Promise<Result<Tutorial>>;
  delete(id: TutorialId): Promise<Result<void>>;

  // Batch operations
  saveMany(tutorials: Tutorial[]): Promise<Result<Tutorial[]>>;
  deleteMany(ids: TutorialId[]): Promise<Result<void>>;

  // Utility operations
  exists(id: TutorialId): Promise<Result<boolean>>;
  existsBySlug(slug: TutorialSlug): Promise<Result<boolean>>;
  count(): Promise<Result<number>>;
  countByLevel(level: TutorialLevel): Promise<Result<number>>;
  incrementViewCount(id: TutorialId): Promise<Result<void>>;
}
