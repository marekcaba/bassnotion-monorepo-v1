import { Tutorial } from '../entities/tutorial.entity.js';
import { TutorialId } from '../value-objects/tutorial-id.vo.js';
import { TutorialSlug } from '../value-objects/tutorial-slug.vo.js';

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ITutorialRepository {
  findById(id: TutorialId): Promise<Tutorial | null>;
  findBySlug(slug: TutorialSlug): Promise<Tutorial | null>;
  findAll(options: PaginationOptions): Promise<PaginatedResult<Tutorial>>;
  findByLevel(
    level: 'beginner' | 'intermediate' | 'advanced',
  ): Promise<Tutorial[]>;
  findPublished(options: PaginationOptions): Promise<PaginatedResult<Tutorial>>;
  search(query: string): Promise<Tutorial[]>;
  save(tutorial: Tutorial): Promise<void>;
  update(tutorial: Tutorial): Promise<void>;
  delete(id: TutorialId): Promise<void>;
  exists(id: TutorialId): Promise<boolean>;
  existsBySlug(slug: TutorialSlug): Promise<boolean>;
  findByIds(ids: TutorialId[]): Promise<Tutorial[]>;
  findByAuthor(authorName: string): Promise<Tutorial[]>;

  // Batch operations
  saveMany(tutorials: Tutorial[]): Promise<void>;
  updateMany(tutorials: Tutorial[]): Promise<void>;
  deleteMany(ids: TutorialId[]): Promise<void>;
}
