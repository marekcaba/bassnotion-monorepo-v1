import { Result } from '@/shared/types/result';
import { Creator } from '../entities/creator.entity';
import { CreatorId } from '../value-objects/creator-id.vo';
import { ChannelUrl } from '../value-objects/channel-url.vo';
import {
  ICreatorRepository,
  PaginatedResult,
  PaginationOptions,
  CreatorFilters,
  CreatorSortOptions,
} from './creator.repository.interface';
import { CreatorRepository } from './creator.repository';
import { CachedCreatorRepository } from './cached-creator.repository';

export class ResultCreatorRepository implements ICreatorRepository {
  private readonly repository: ICreatorRepository;

  constructor() {
    const baseRepository = new CreatorRepository();
    this.repository = new CachedCreatorRepository(baseRepository);
  }

  async findById(id: CreatorId): Promise<Result<Creator>> {
    try {
      return await this.repository.findById(id);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while fetching creator',
      );
    }
  }

  async findByChannelUrl(channelUrl: ChannelUrl): Promise<Result<Creator>> {
    try {
      return await this.repository.findByChannelUrl(channelUrl);
    } catch (error: any) {
      return Result.fail(
        error.message ||
          'An unexpected error occurred while fetching creator by channel URL',
      );
    }
  }

  async findByChannelId(channelId: string): Promise<Result<Creator>> {
    try {
      return await this.repository.findByChannelId(channelId);
    } catch (error: any) {
      return Result.fail(
        error.message ||
          'An unexpected error occurred while fetching creator by channel ID',
      );
    }
  }

  async findAll(
    options?: PaginationOptions,
  ): Promise<Result<PaginatedResult<Creator>>> {
    try {
      return await this.repository.findAll(options);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while fetching creators',
      );
    }
  }

  async findByIds(ids: CreatorId[]): Promise<Result<Creator[]>> {
    try {
      return await this.repository.findByIds(ids);
    } catch (error: any) {
      return Result.fail(
        error.message ||
          'An unexpected error occurred while fetching creators by ids',
      );
    }
  }

  async search(
    query: string,
    filters?: CreatorFilters,
  ): Promise<Result<Creator[]>> {
    try {
      return await this.repository.search(query, filters);
    } catch (error: any) {
      return Result.fail(
        error.message ||
          'An unexpected error occurred while searching creators',
      );
    }
  }

  async findStale(
    hoursThreshold?: number,
    limit?: number,
  ): Promise<Result<Creator[]>> {
    try {
      return await this.repository.findStale(hoursThreshold, limit);
    } catch (error: any) {
      return Result.fail(
        error.message ||
          'An unexpected error occurred while fetching stale creators',
      );
    }
  }

  async findVerified(
    options?: PaginationOptions,
  ): Promise<Result<PaginatedResult<Creator>>> {
    try {
      return await this.repository.findVerified(options);
    } catch (error: any) {
      return Result.fail(
        error.message ||
          'An unexpected error occurred while fetching verified creators',
      );
    }
  }

  async findTop(
    sortBy: CreatorSortOptions,
    limit?: number,
  ): Promise<Result<Creator[]>> {
    try {
      return await this.repository.findTop(sortBy, limit);
    } catch (error: any) {
      return Result.fail(
        error.message ||
          'An unexpected error occurred while fetching top creators',
      );
    }
  }

  async save(creator: Creator): Promise<Result<Creator>> {
    try {
      return await this.repository.save(creator);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while saving creator',
      );
    }
  }

  async update(creator: Creator): Promise<Result<Creator>> {
    try {
      return await this.repository.update(creator);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while updating creator',
      );
    }
  }

  async delete(id: CreatorId): Promise<Result<void>> {
    try {
      return await this.repository.delete(id);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while deleting creator',
      );
    }
  }

  async saveMany(creators: Creator[]): Promise<Result<Creator[]>> {
    try {
      return await this.repository.saveMany(creators);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while saving creators',
      );
    }
  }

  async updateMany(creators: Creator[]): Promise<Result<Creator[]>> {
    try {
      return await this.repository.updateMany(creators);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while updating creators',
      );
    }
  }

  async deleteMany(ids: CreatorId[]): Promise<Result<void>> {
    try {
      return await this.repository.deleteMany(ids);
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while deleting creators',
      );
    }
  }

  async updateStats(
    id: CreatorId,
    stats: {
      subscriberCount?: number;
      videoCount?: number;
      viewCount?: number;
    },
  ): Promise<Result<Creator>> {
    try {
      return await this.repository.updateStats(id, stats);
    } catch (error: any) {
      return Result.fail(
        error.message ||
          'An unexpected error occurred while updating creator stats',
      );
    }
  }

  async markAsFetched(id: CreatorId): Promise<Result<void>> {
    try {
      return await this.repository.markAsFetched(id);
    } catch (error: any) {
      return Result.fail(
        error.message ||
          'An unexpected error occurred while marking creator as fetched',
      );
    }
  }

  async exists(id: CreatorId): Promise<Result<boolean>> {
    try {
      return await this.repository.exists(id);
    } catch (error: any) {
      return Result.fail(
        error.message ||
          'An unexpected error occurred while checking creator existence',
      );
    }
  }

  async existsByChannelUrl(channelUrl: ChannelUrl): Promise<Result<boolean>> {
    try {
      return await this.repository.existsByChannelUrl(channelUrl);
    } catch (error: any) {
      return Result.fail(
        error.message ||
          'An unexpected error occurred while checking creator existence by channel URL',
      );
    }
  }

  async count(): Promise<Result<number>> {
    try {
      return await this.repository.count();
    } catch (error: any) {
      return Result.fail(
        error.message || 'An unexpected error occurred while counting creators',
      );
    }
  }

  async countByCountry(country: string): Promise<Result<number>> {
    try {
      return await this.repository.countByCountry(country);
    } catch (error: any) {
      return Result.fail(
        error.message ||
          'An unexpected error occurred while counting creators by country',
      );
    }
  }

  async countVerified(): Promise<Result<number>> {
    try {
      return await this.repository.countVerified();
    } catch (error: any) {
      return Result.fail(
        error.message ||
          'An unexpected error occurred while counting verified creators',
      );
    }
  }

  // Utility method to access cache clearing if needed
  clearCache(): void {
    if (this.repository instanceof CachedCreatorRepository) {
      this.repository.clearCache();
    }
  }
}
