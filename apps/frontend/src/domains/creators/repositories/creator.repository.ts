import { apiClient } from '@/lib/api-client';
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

export class CreatorRepository implements ICreatorRepository {
  private readonly baseUrl = '/api/v1/creators';

  async findById(id: CreatorId): Promise<Result<Creator>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/${id.value}`);
      const creator = Creator.fromDTO(response.data);
      return Result.ok(creator);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to fetch creator');
    }
  }

  async findByChannelUrl(channelUrl: ChannelUrl): Promise<Result<Creator>> {
    try {
      const response = await apiClient.get(
        `${this.baseUrl}/channel-url/${encodeURIComponent(channelUrl.value)}`,
      );
      const creator = Creator.fromDTO(response.data);
      return Result.ok(creator);
    } catch (error: any) {
      return Result.fail(
        error.message || 'Failed to fetch creator by channel URL',
      );
    }
  }

  async findByChannelId(channelId: string): Promise<Result<Creator>> {
    try {
      const response = await apiClient.get(
        `${this.baseUrl}/channel-id/${channelId}`,
      );
      const creator = Creator.fromDTO(response.data);
      return Result.ok(creator);
    } catch (error: any) {
      return Result.fail(
        error.message || 'Failed to fetch creator by channel ID',
      );
    }
  }

  async findAll(
    options?: PaginationOptions,
  ): Promise<Result<PaginatedResult<Creator>>> {
    try {
      const params = new URLSearchParams();
      if (options) {
        params.append('page', options.page.toString());
        params.append('limit', options.limit.toString());
      }

      const response = await apiClient.get(
        `${this.baseUrl}?${params.toString()}`,
      );
      const { items, total, page, limit } = response.data;

      const creators = items.map((dto: any) => Creator.fromDTO(dto));
      const totalPages = Math.ceil(total / limit);

      return Result.ok({
        items: creators,
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      });
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to fetch creators');
    }
  }

  async findByIds(ids: CreatorId[]): Promise<Result<Creator[]>> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/batch`, {
        ids: ids.map((id) => id.value),
      });
      const creators = response.data.map((dto: any) => Creator.fromDTO(dto));
      return Result.ok(creators);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to fetch creators by ids');
    }
  }

  async search(
    query: string,
    filters?: CreatorFilters,
  ): Promise<Result<Creator[]>> {
    try {
      const params = new URLSearchParams();
      params.append('q', query);

      if (filters) {
        if (filters.subscriberCountMin !== undefined) {
          params.append('subscriberMin', filters.subscriberCountMin.toString());
        }

        if (filters.subscriberCountMax !== undefined) {
          params.append('subscriberMax', filters.subscriberCountMax.toString());
        }

        if (filters.country) {
          params.append('country', filters.country);
        }

        if (filters.isVerified !== undefined) {
          params.append('verified', filters.isVerified.toString());
        }

        if (filters.hasCustomUrl !== undefined) {
          params.append('customUrl', filters.hasCustomUrl.toString());
        }

        if (filters.isStale !== undefined) {
          params.append('stale', filters.isStale.toString());
        }
      }

      const response = await apiClient.get(
        `${this.baseUrl}/search?${params.toString()}`,
      );
      const creators = response.data.map((dto: any) => Creator.fromDTO(dto));
      return Result.ok(creators);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to search creators');
    }
  }

  async findStale(
    hoursThreshold = 24,
    limit = 100,
  ): Promise<Result<Creator[]>> {
    try {
      const response = await apiClient.get(
        `${this.baseUrl}/stale?hours=${hoursThreshold}&limit=${limit}`,
      );
      const creators = response.data.map((dto: any) => Creator.fromDTO(dto));
      return Result.ok(creators);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to fetch stale creators');
    }
  }

  async findVerified(
    options?: PaginationOptions,
  ): Promise<Result<PaginatedResult<Creator>>> {
    try {
      const params = new URLSearchParams();
      if (options) {
        params.append('page', options.page.toString());
        params.append('limit', options.limit.toString());
      }

      const response = await apiClient.get(
        `${this.baseUrl}/verified?${params.toString()}`,
      );
      const { items, total, page, limit } = response.data;

      const creators = items.map((dto: any) => Creator.fromDTO(dto));
      const totalPages = Math.ceil(total / limit);

      return Result.ok({
        items: creators,
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      });
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to fetch verified creators');
    }
  }

  async findTop(
    sortBy: CreatorSortOptions,
    limit = 10,
  ): Promise<Result<Creator[]>> {
    try {
      const response = await apiClient.get(
        `${this.baseUrl}/top?sortBy=${sortBy.field}&direction=${sortBy.direction}&limit=${limit}`,
      );
      const creators = response.data.map((dto: any) => Creator.fromDTO(dto));
      return Result.ok(creators);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to fetch top creators');
    }
  }

  async save(creator: Creator): Promise<Result<Creator>> {
    try {
      const response = await apiClient.post(this.baseUrl, creator.toDTO());
      const savedCreator = Creator.fromDTO(response.data);
      return Result.ok(savedCreator);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to save creator');
    }
  }

  async update(creator: Creator): Promise<Result<Creator>> {
    try {
      const response = await apiClient.put(
        `${this.baseUrl}/${creator.id.value}`,
        creator.toDTO(),
      );
      const updatedCreator = Creator.fromDTO(response.data);
      return Result.ok(updatedCreator);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to update creator');
    }
  }

  async delete(id: CreatorId): Promise<Result<void>> {
    try {
      await apiClient.delete(`${this.baseUrl}/${id.value}`);
      return Result.ok(undefined);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to delete creator');
    }
  }

  async saveMany(creators: Creator[]): Promise<Result<Creator[]>> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/batch/create`, {
        creators: creators.map((c) => c.toDTO()),
      });
      const savedCreators = response.data.map((dto: any) =>
        Creator.fromDTO(dto),
      );
      return Result.ok(savedCreators);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to save creators');
    }
  }

  async updateMany(creators: Creator[]): Promise<Result<Creator[]>> {
    try {
      const response = await apiClient.put(`${this.baseUrl}/batch/update`, {
        creators: creators.map((c) => c.toDTO()),
      });
      const updatedCreators = response.data.map((dto: any) =>
        Creator.fromDTO(dto),
      );
      return Result.ok(updatedCreators);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to update creators');
    }
  }

  async deleteMany(ids: CreatorId[]): Promise<Result<void>> {
    try {
      await apiClient.post(`${this.baseUrl}/batch/delete`, {
        ids: ids.map((id) => id.value),
      });
      return Result.ok(undefined);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to delete creators');
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
      const response = await apiClient.patch(
        `${this.baseUrl}/${id.value}/stats`,
        stats,
      );
      const updatedCreator = Creator.fromDTO(response.data);
      return Result.ok(updatedCreator);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to update creator stats');
    }
  }

  async markAsFetched(id: CreatorId): Promise<Result<void>> {
    try {
      await apiClient.post(`${this.baseUrl}/${id.value}/mark-fetched`);
      return Result.ok(undefined);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to mark creator as fetched');
    }
  }

  async exists(id: CreatorId): Promise<Result<boolean>> {
    try {
      const response = await apiClient.head(`${this.baseUrl}/${id.value}`);
      return Result.ok(response.status === 200);
    } catch (error: any) {
      if (error.response?.status === 404) {
        return Result.ok(false);
      }
      return Result.fail(error.message || 'Failed to check if creator exists');
    }
  }

  async existsByChannelUrl(channelUrl: ChannelUrl): Promise<Result<boolean>> {
    try {
      const response = await apiClient.head(
        `${this.baseUrl}/channel-url/${encodeURIComponent(channelUrl.value)}`,
      );
      return Result.ok(response.status === 200);
    } catch (error: any) {
      if (error.response?.status === 404) {
        return Result.ok(false);
      }
      return Result.fail(
        error.message || 'Failed to check if creator exists by channel URL',
      );
    }
  }

  async count(): Promise<Result<number>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/count`);
      return Result.ok(response.data.count);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to count creators');
    }
  }

  async countByCountry(country: string): Promise<Result<number>> {
    try {
      const response = await apiClient.get(
        `${this.baseUrl}/count/country/${encodeURIComponent(country)}`,
      );
      return Result.ok(response.data.count);
    } catch (error: any) {
      return Result.fail(
        error.message || 'Failed to count creators by country',
      );
    }
  }

  async countVerified(): Promise<Result<number>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/count/verified`);
      return Result.ok(response.data.count);
    } catch (error: any) {
      return Result.fail(error.message || 'Failed to count verified creators');
    }
  }
}
