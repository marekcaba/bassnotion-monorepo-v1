import { Creator } from '../entities/creator.entity.js';
import { CreatorId } from '../value-objects/creator-id.vo.js';
import { ChannelUrl } from '../value-objects/channel-url.vo.js';

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

export interface ICreatorRepository {
  // Basic CRUD operations
  findById(id: CreatorId): Promise<Creator | null>;
  findByChannelUrl(channelUrl: ChannelUrl): Promise<Creator | null>;
  findAll(options: PaginationOptions): Promise<PaginatedResult<Creator>>;
  save(creator: Creator): Promise<void>;
  update(creator: Creator): Promise<void>;
  delete(id: CreatorId): Promise<void>;

  // Query operations
  findByChannelId(channelId: string): Promise<Creator | null>;
  findByCreatorName(name: string): Promise<Creator[]>;
  findStaleCreators(hoursThreshold: number): Promise<Creator[]>;
  findTopCreators(limit: number): Promise<Creator[]>;
  search(query: string): Promise<Creator[]>;

  // Existence checks
  exists(id: CreatorId): Promise<boolean>;
  existsByChannelUrl(channelUrl: ChannelUrl): Promise<boolean>;

  // Batch operations
  findByIds(ids: CreatorId[]): Promise<Creator[]>;
  findByChannelUrls(urls: ChannelUrl[]): Promise<Creator[]>;
  saveMany(creators: Creator[]): Promise<void>;
  updateMany(creators: Creator[]): Promise<void>;
  deleteMany(ids: CreatorId[]): Promise<void>;

  // Specialized queries
  getAllUniqueChannelUrls(): Promise<Array<{ url: string; name: string }>>;
  countBySubscriberRange(min: number, max: number): Promise<number>;
}
