/**
 * Base repository implementation with common CRUD operations
 */

import { ApiClient } from '@/shared/api/client';
import { createStructuredLogger } from '@/utils/logger';
import {
  IRepository,
  PaginationOptions,
  PaginatedResult,
} from './IRepository.js';

export abstract class BaseRepository<TEntity, TId, TDTO> implements IRepository<
  TEntity,
  TId
> {
  protected abstract readonly baseUrl: string;
  protected readonly logger = createStructuredLogger(this.constructor.name);

  constructor(protected readonly apiClient: ApiClient) {}

  async findById(id: TId): Promise<TEntity> {
    try {
      this.logger.info('Finding entity by ID', { id });
      const response = await this.apiClient.get<TDTO>(`${this.baseUrl}/${id}`);
      return this.mapFromDTO(response);
    } catch (error) {
      this.logger.error('Failed to find entity by ID', error as Error, { id });
      throw error;
    }
  }

  async findAll(
    options: PaginationOptions = {},
  ): Promise<PaginatedResult<TEntity>> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    try {
      this.logger.info('Finding all entities', {
        page,
        limit,
        sortBy,
        sortOrder,
      });

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy,
        sortOrder,
      });

      const response = await this.apiClient.get<{
        items: TDTO[];
        total: number;
      }>(`${this.baseUrl}?${params}`);

      const entities = response.items.map((dto) => this.mapFromDTO(dto));
      const totalPages = Math.ceil(response.total / limit);

      return {
        items: entities,
        total: response.total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      };
    } catch (error) {
      this.logger.error('Failed to find all entities', error as Error, options);
      throw error;
    }
  }

  async save(entity: TEntity): Promise<TEntity> {
    try {
      this.logger.info('Saving entity', { entity: this.extractId(entity) });
      const dto = this.mapToDTO(entity);
      const response = await this.apiClient.post<TDTO>(this.baseUrl, dto);
      return this.mapFromDTO(response);
    } catch (error) {
      this.logger.error('Failed to save entity', error as Error);
      throw error;
    }
  }

  async update(id: TId, entity: Partial<TEntity>): Promise<TEntity> {
    try {
      this.logger.info('Updating entity', { id });
      const dto = this.mapToPartialDTO(entity);
      const response = await this.apiClient.patch<TDTO>(
        `${this.baseUrl}/${id}`,
        dto,
      );
      return this.mapFromDTO(response);
    } catch (error) {
      this.logger.error('Failed to update entity', error as Error, { id });
      throw error;
    }
  }

  async delete(id: TId): Promise<void> {
    try {
      this.logger.info('Deleting entity', { id });
      await this.apiClient.delete(`${this.baseUrl}/${id}`);
    } catch (error) {
      this.logger.error('Failed to delete entity', error as Error, { id });
      throw error;
    }
  }

  async findByIds(ids: TId[]): Promise<TEntity[]> {
    try {
      this.logger.info('Finding entities by IDs', { count: ids.length });
      const promises = ids.map((id) => this.findById(id));
      return Promise.all(promises);
    } catch (error) {
      this.logger.error('Failed to find entities by IDs', error as Error);
      throw error;
    }
  }

  async saveMany(entities: TEntity[]): Promise<TEntity[]> {
    try {
      this.logger.info('Saving multiple entities', { count: entities.length });
      const dtos = entities.map((entity) => this.mapToDTO(entity));
      const response = await this.apiClient.post<TDTO[]>(
        `${this.baseUrl}/batch`,
        dtos,
      );
      return response.map((dto) => this.mapFromDTO(dto));
    } catch (error) {
      this.logger.error('Failed to save multiple entities', error as Error);
      throw error;
    }
  }

  async updateMany(
    updates: Array<{ id: TId; data: Partial<TEntity> }>,
  ): Promise<TEntity[]> {
    try {
      this.logger.info('Updating multiple entities', { count: updates.length });
      const promises = updates.map(({ id, data }) => this.update(id, data));
      return Promise.all(promises);
    } catch (error) {
      this.logger.error('Failed to update multiple entities', error as Error);
      throw error;
    }
  }

  async deleteMany(ids: TId[]): Promise<void> {
    try {
      this.logger.info('Deleting multiple entities', { count: ids.length });
      await this.apiClient.delete(`${this.baseUrl}/batch`, { ids });
    } catch (error) {
      this.logger.error('Failed to delete multiple entities', error as Error);
      throw error;
    }
  }

  async exists(id: TId): Promise<boolean> {
    try {
      this.logger.info('Checking if entity exists', { id });
      const response = await this.apiClient.head(`${this.baseUrl}/${id}`);
      return response.status === 200;
    } catch (error) {
      if ((error as any).status === 404) {
        return false;
      }
      this.logger.error('Failed to check if entity exists', error as Error, {
        id,
      });
      throw error;
    }
  }

  async count(): Promise<number> {
    try {
      this.logger.info('Counting entities');
      const response = await this.apiClient.get<{ count: number }>(
        `${this.baseUrl}/count`,
      );
      return response.count;
    } catch (error) {
      this.logger.error('Failed to count entities', error as Error);
      throw error;
    }
  }

  // Abstract methods that must be implemented by concrete repositories
  protected abstract mapFromDTO(dto: TDTO): TEntity;
  protected abstract mapToDTO(entity: TEntity): TDTO;
  protected abstract extractId(entity: TEntity): string;

  // Default implementation for partial DTO mapping
  protected mapToPartialDTO(entity: Partial<TEntity>): Partial<TDTO> {
    // Default implementation - override if needed
    return entity as any;
  }
}
