/**
 * Base repository interface defining common operations for all repositories
 */

import { Result } from '@/shared/patterns/result';

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
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

export interface IRepository<TEntity, TId> {
  // Basic CRUD operations
  findById(id: TId): Promise<TEntity>;
  findAll(options?: PaginationOptions): Promise<PaginatedResult<TEntity>>;
  save(entity: TEntity): Promise<TEntity>;
  update(id: TId, entity: Partial<TEntity>): Promise<TEntity>;
  delete(id: TId): Promise<void>;

  // Batch operations
  findByIds(ids: TId[]): Promise<TEntity[]>;
  saveMany(entities: TEntity[]): Promise<TEntity[]>;
  updateMany(
    updates: Array<{ id: TId; data: Partial<TEntity> }>,
  ): Promise<TEntity[]>;
  deleteMany(ids: TId[]): Promise<void>;

  // Utility operations
  exists(id: TId): Promise<boolean>;
  count(): Promise<number>;
}

// Result-based repository interface for error handling
export interface IResultRepository<TEntity, TId> {
  // Basic CRUD operations
  findById(id: TId): Promise<Result<TEntity>>;
  findAll(
    options?: PaginationOptions,
  ): Promise<Result<PaginatedResult<TEntity>>>;
  save(entity: TEntity): Promise<Result<TEntity>>;
  update(id: TId, entity: Partial<TEntity>): Promise<Result<TEntity>>;
  delete(id: TId): Promise<Result<void>>;

  // Batch operations
  findByIds(ids: TId[]): Promise<Result<TEntity[]>>;
  saveMany(entities: TEntity[]): Promise<Result<TEntity[]>>;
  updateMany(
    updates: Array<{ id: TId; data: Partial<TEntity> }>,
  ): Promise<Result<TEntity[]>>;
  deleteMany(ids: TId[]): Promise<Result<void>>;

  // Utility operations
  exists(id: TId): Promise<Result<boolean>>;
  count(): Promise<Result<number>>;
}
