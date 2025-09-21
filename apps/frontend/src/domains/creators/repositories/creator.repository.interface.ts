import { Creator } from '../entities/creator.entity';
import { CreatorId } from '../value-objects/creator-id.vo';
import { ChannelUrl } from '../value-objects/channel-url.vo';
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

export interface CreatorFilters {
  subscriberCountMin?: number;
  subscriberCountMax?: number;
  country?: string;
  isVerified?: boolean;
  hasCustomUrl?: boolean;
  isStale?: boolean;
}

export interface CreatorSortOptions {
  field:
    | 'subscriberCount'
    | 'videoCount'
    | 'viewCount'
    | 'createdAt'
    | 'updatedAt';
  direction: 'asc' | 'desc';
}

export interface ICreatorRepository {
  // Read operations
  findById(id: CreatorId): Promise<Result<Creator>>;
  findByChannelUrl(channelUrl: ChannelUrl): Promise<Result<Creator>>;
  findByChannelId(channelId: string): Promise<Result<Creator>>;
  findAll(
    options?: PaginationOptions,
  ): Promise<Result<PaginatedResult<Creator>>>;
  findByIds(ids: CreatorId[]): Promise<Result<Creator[]>>;
  search(query: string, filters?: CreatorFilters): Promise<Result<Creator[]>>;
  findStale(
    hoursThreshold?: number,
    limit?: number,
  ): Promise<Result<Creator[]>>;
  findVerified(
    options?: PaginationOptions,
  ): Promise<Result<PaginatedResult<Creator>>>;
  findTop(
    sortBy: CreatorSortOptions,
    limit?: number,
  ): Promise<Result<Creator[]>>;

  // Write operations
  save(creator: Creator): Promise<Result<Creator>>;
  update(creator: Creator): Promise<Result<Creator>>;
  delete(id: CreatorId): Promise<Result<void>>;

  // Batch operations
  saveMany(creators: Creator[]): Promise<Result<Creator[]>>;
  updateMany(creators: Creator[]): Promise<Result<Creator[]>>;
  deleteMany(ids: CreatorId[]): Promise<Result<void>>;

  // Stats operations
  updateStats(
    id: CreatorId,
    stats: {
      subscriberCount?: number;
      videoCount?: number;
      viewCount?: number;
    },
  ): Promise<Result<Creator>>;
  markAsFetched(id: CreatorId): Promise<Result<void>>;

  // Utility operations
  exists(id: CreatorId): Promise<Result<boolean>>;
  existsByChannelUrl(channelUrl: ChannelUrl): Promise<Result<boolean>>;
  count(): Promise<Result<number>>;
  countByCountry(country: string): Promise<Result<number>>;
  countVerified(): Promise<Result<number>>;
}
