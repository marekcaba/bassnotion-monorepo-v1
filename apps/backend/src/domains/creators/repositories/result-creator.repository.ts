import { Injectable, Inject } from '@nestjs/common';
import type {
  ICreatorRepository,
  PaginatedResult,
  PaginationOptions } from './creator.repository.interface.js';
import { Creator } from '../entities/creator.entity.js';
import { CreatorId } from '../value-objects/creator-id.vo.js';
import { ChannelUrl } from '../value-objects/channel-url.vo.js';
import { Result, ResultUtils } from '../../shared/result.js';
import { createStructuredLogger } from '@bassnotion/contracts';
import { RequestContextService } from '../../../shared/services/request-context.service.js';

export interface IResultCreatorRepository {
  findById(id: CreatorId): Promise<Result<Creator | null>>;
  findByChannelUrl(channelUrl: ChannelUrl): Promise<Result<Creator | null>>;
  findAll(
    options: PaginationOptions,
  ): Promise<Result<PaginatedResult<Creator>>>;
  findByChannelId(channelId: string): Promise<Result<Creator | null>>;
  findByCreatorName(name: string): Promise<Result<Creator[]>>;
  findStaleCreators(hoursThreshold: number): Promise<Result<Creator[]>>;
  findTopCreators(limit: number): Promise<Result<Creator[]>>;
  search(query: string): Promise<Result<Creator[]>>;
  save(creator: Creator): Promise<Result<void>>;
  update(creator: Creator): Promise<Result<void>>;
  delete(id: CreatorId): Promise<Result<void>>;
  exists(id: CreatorId): Promise<Result<boolean>>;
  existsByChannelUrl(channelUrl: ChannelUrl): Promise<Result<boolean>>;
  findByIds(ids: CreatorId[]): Promise<Result<Creator[]>>;
  findByChannelUrls(urls: ChannelUrl[]): Promise<Result<Creator[]>>;
  saveMany(creators: Creator[]): Promise<Result<void>>;
  updateMany(creators: Creator[]): Promise<Result<void>>;
  deleteMany(ids: CreatorId[]): Promise<Result<void>>;
  getAllUniqueChannelUrls(): Promise<
    Result<Array<{ url: string; name: string }>>
  >;
  countBySubscriberRange(min: number, max: number): Promise<Result<number>>;
}

@Injectable()
export class ResultCreatorRepository implements IResultCreatorRepository {
  private readonly staticLogger = createStructuredLogger(ResultCreatorRepository.name);

  constructor(
    private readonly repository: ICreatorRepository,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  async findById(id: CreatorId): Promise<Result<Creator | null>> {
    try {
      const creator = await this.repository.findById(id);
      return ResultUtils.ok(creator);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      
      logger.error(`Failed to find creator ${id.value}:`, error as Error, { correlationId });
      return ResultUtils.fail(error as Error);
    }
  }

  async findByChannelUrl(
    channelUrl: ChannelUrl,
  ): Promise<Result<Creator | null>> {
    try {
      const creator = await this.repository.findByChannelUrl(channelUrl);
      return ResultUtils.ok(creator);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      
      logger.error(
        `Failed to find creator by channel URL ${channelUrl.value}:`,
        error as Error,
        { correlationId }
      );
      return ResultUtils.fail(error as Error);
    }
  }

  async findAll(
    options: PaginationOptions,
  ): Promise<Result<PaginatedResult<Creator>>> {
    try {
      const result = await this.repository.findAll(options);
      return ResultUtils.ok(result);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Failed to find all creators:', error as Error, { correlationId });
      return ResultUtils.fail(error as Error);
    }
  }

  async findByChannelId(channelId: string): Promise<Result<Creator | null>> {
    try {
      const creator = await this.repository.findByChannelId(channelId);
      return ResultUtils.ok(creator);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(
        `Failed to find creator by channel ID ${channelId}:`,
        error as Error,
        { correlationId }
      );
      return ResultUtils.fail(error as Error);
    }
  }

  async findByCreatorName(name: string): Promise<Result<Creator[]>> {
    try {
      const creators = await this.repository.findByCreatorName(name);
      return ResultUtils.ok(creators);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(`Failed to find creators by name ${name}:`, error as Error, { correlationId });
      return ResultUtils.fail(error as Error);
    }
  }

  async findStaleCreators(hoursThreshold: number): Promise<Result<Creator[]>> {
    try {
      const creators = await this.repository.findStaleCreators(hoursThreshold);
      return ResultUtils.ok(creators);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(
        `Failed to find stale creators with threshold ${hoursThreshold}:`,
        error as Error,
        { correlationId }
      );
      return ResultUtils.fail(error as Error);
    }
  }

  async findTopCreators(limit: number): Promise<Result<Creator[]>> {
    try {
      const creators = await this.repository.findTopCreators(limit);
      return ResultUtils.ok(creators);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(`Failed to find top ${limit} creators:`, error as Error, { correlationId });
      return ResultUtils.fail(error as Error);
    }
  }

  async search(query: string): Promise<Result<Creator[]>> {
    try {
      const creators = await this.repository.search(query);
      return ResultUtils.ok(creators);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(
        `Failed to search creators with query "${query}":`,
        error as Error,
        { correlationId }
      );
      return ResultUtils.fail(error as Error);
    }
  }

  async save(creator: Creator): Promise<Result<void>> {
    try {
      await this.repository.save(creator);
      return ResultUtils.ok(undefined);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Failed to save creator:', error as Error, { correlationId });
      return ResultUtils.fail(error as Error);
    }
  }

  async update(creator: Creator): Promise<Result<void>> {
    try {
      await this.repository.update(creator);
      return ResultUtils.ok(undefined);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(`Failed to update creator ${creator.id.value}:`, error as Error, { correlationId });
      return ResultUtils.fail(error as Error);
    }
  }

  async delete(id: CreatorId): Promise<Result<void>> {
    try {
      await this.repository.delete(id);
      return ResultUtils.ok(undefined);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(`Failed to delete creator ${id.value}:`, error as Error, { correlationId });
      return ResultUtils.fail(error as Error);
    }
  }

  async exists(id: CreatorId): Promise<Result<boolean>> {
    try {
      const exists = await this.repository.exists(id);
      return ResultUtils.ok(exists);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(
        `Failed to check creator existence ${id.value}:`,
        error as Error,
        { correlationId }
      );
      return ResultUtils.fail(error as Error);
    }
  }

  async existsByChannelUrl(channelUrl: ChannelUrl): Promise<Result<boolean>> {
    try {
      const exists = await this.repository.existsByChannelUrl(channelUrl);
      return ResultUtils.ok(exists);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(
        `Failed to check creator existence by channel URL ${channelUrl.value}:`,
        error as Error,
        { correlationId }
      );
      return ResultUtils.fail(error as Error);
    }
  }

  async findByIds(ids: CreatorId[]): Promise<Result<Creator[]>> {
    try {
      const creators = await this.repository.findByIds(ids);
      return ResultUtils.ok(creators);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Failed to find creators by ids:', error as Error, { correlationId });
      return ResultUtils.fail(error as Error);
    }
  }

  async findByChannelUrls(urls: ChannelUrl[]): Promise<Result<Creator[]>> {
    try {
      const creators = await this.repository.findByChannelUrls(urls);
      return ResultUtils.ok(creators);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Failed to find creators by channel URLs:', error as Error, { correlationId });
      return ResultUtils.fail(error as Error);
    }
  }

  async saveMany(creators: Creator[]): Promise<Result<void>> {
    try {
      await this.repository.saveMany(creators);
      return ResultUtils.ok(undefined);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Failed to save creators batch:', error as Error, { correlationId });
      return ResultUtils.fail(error as Error);
    }
  }

  async updateMany(creators: Creator[]): Promise<Result<void>> {
    try {
      await this.repository.updateMany(creators);
      return ResultUtils.ok(undefined);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Failed to update creators batch:', error as Error, { correlationId });
      return ResultUtils.fail(error as Error);
    }
  }

  async deleteMany(ids: CreatorId[]): Promise<Result<void>> {
    try {
      await this.repository.deleteMany(ids);
      return ResultUtils.ok(undefined);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Failed to delete creators batch:', error as Error, { correlationId });
      return ResultUtils.fail(error as Error);
    }
  }

  async getAllUniqueChannelUrls(): Promise<
    Result<Array<{ url: string; name: string }>>
  > {
    try {
      const urls = await this.repository.getAllUniqueChannelUrls();
      return ResultUtils.ok(urls);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Failed to get all unique channel URLs:', error as Error, { correlationId });
      return ResultUtils.fail(error as Error);
    }
  }

  async countBySubscriberRange(
    min: number,
    max: number,
  ): Promise<Result<number>> {
    try {
      const count = await this.repository.countBySubscriberRange(min, max);
      return ResultUtils.ok(count);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      
      logger.error(
        `Failed to count creators by subscriber range ${min}-${max}:`,
        error as Error,
        { correlationId }
      );
      return ResultUtils.fail(error as Error);
    }
  }
}
