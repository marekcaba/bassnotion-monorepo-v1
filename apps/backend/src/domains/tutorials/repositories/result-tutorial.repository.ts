import { Injectable, Inject } from '@nestjs/common';
import type {
  ITutorialRepository,
  PaginatedResult,
  PaginationOptions,
} from './tutorial.repository.interface.js';
import { Tutorial } from '../entities/tutorial.entity.js';
import { TutorialId } from '../value-objects/tutorial-id.vo.js';
import { TutorialSlug } from '../value-objects/tutorial-slug.vo.js';
import { Result, ResultUtils } from '../../shared/result.js';
import { createStructuredLogger } from '@bassnotion/contracts';
import { RequestContextService } from '../../../shared/services/request-context.service.js';

export interface IResultTutorialRepository {
  findById(id: TutorialId): Promise<Result<Tutorial | null>>;
  findBySlug(slug: TutorialSlug): Promise<Result<Tutorial | null>>;
  findAll(
    options: PaginationOptions,
  ): Promise<Result<PaginatedResult<Tutorial>>>;
  findByLevel(
    level: 'beginner' | 'intermediate' | 'advanced',
  ): Promise<Result<Tutorial[]>>;
  findPublished(
    options: PaginationOptions,
  ): Promise<Result<PaginatedResult<Tutorial>>>;
  search(query: string): Promise<Result<Tutorial[]>>;
  save(tutorial: Tutorial): Promise<Result<void>>;
  update(tutorial: Tutorial): Promise<Result<void>>;
  delete(id: TutorialId): Promise<Result<void>>;
  exists(id: TutorialId): Promise<Result<boolean>>;
  existsBySlug(slug: TutorialSlug): Promise<Result<boolean>>;
  findByIds(ids: TutorialId[]): Promise<Result<Tutorial[]>>;
  findByAuthor(authorName: string): Promise<Result<Tutorial[]>>;
  saveMany(tutorials: Tutorial[]): Promise<Result<void>>;
  updateMany(tutorials: Tutorial[]): Promise<Result<void>>;
  deleteMany(ids: TutorialId[]): Promise<Result<void>>;
}

@Injectable()
export class ResultTutorialRepository implements IResultTutorialRepository {
  private readonly staticLogger = createStructuredLogger(
    ResultTutorialRepository.name,
  );

  constructor(
    private readonly repository: ITutorialRepository,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  async findById(id: TutorialId): Promise<Result<Tutorial | null>> {
    try {
      const tutorial = await this.repository.findById(id);
      return ResultUtils.ok(tutorial);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(`Failed to find tutorial ${id.value}:`, error as Error, {
        correlationId,
      });
      return ResultUtils.fail(error as Error);
    }
  }

  async findBySlug(slug: TutorialSlug): Promise<Result<Tutorial | null>> {
    try {
      const tutorial = await this.repository.findBySlug(slug);
      return ResultUtils.ok(tutorial);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(
        `Failed to find tutorial by slug ${slug.value}:`,
        error as Error,
        { correlationId },
      );
      return ResultUtils.fail(error as Error);
    }
  }

  async findAll(
    options: PaginationOptions,
  ): Promise<Result<PaginatedResult<Tutorial>>> {
    try {
      const result = await this.repository.findAll(options);
      return ResultUtils.ok(result);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Failed to find all tutorials:', error as Error, {
        correlationId,
      });
      return ResultUtils.fail(error as Error);
    }
  }

  async findByLevel(
    level: 'beginner' | 'intermediate' | 'advanced',
  ): Promise<Result<Tutorial[]>> {
    try {
      const tutorials = await this.repository.findByLevel(level);
      return ResultUtils.ok(tutorials);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(
        `Failed to find tutorials by level ${level}:`,
        error as Error,
        { correlationId },
      );
      return ResultUtils.fail(error as Error);
    }
  }

  async findPublished(
    options: PaginationOptions,
  ): Promise<Result<PaginatedResult<Tutorial>>> {
    try {
      const result = await this.repository.findPublished(options);
      return ResultUtils.ok(result);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Failed to find published tutorials:', error as Error, {
        correlationId,
      });
      return ResultUtils.fail(error as Error);
    }
  }

  async search(query: string): Promise<Result<Tutorial[]>> {
    try {
      const tutorials = await this.repository.search(query);
      return ResultUtils.ok(tutorials);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(
        `Failed to search tutorials with query "${query}":`,
        error as Error,
        { correlationId },
      );
      return ResultUtils.fail(error as Error);
    }
  }

  async findByAuthor(authorName: string): Promise<Result<Tutorial[]>> {
    try {
      const tutorials = await this.repository.findByAuthor(authorName);
      return ResultUtils.ok(tutorials);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(
        `Failed to find tutorials by author ${authorName}:`,
        error as Error,
        { correlationId },
      );
      return ResultUtils.fail(error as Error);
    }
  }

  async save(tutorial: Tutorial): Promise<Result<void>> {
    try {
      await this.repository.save(tutorial);
      return ResultUtils.ok(undefined);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Failed to save tutorial:', error as Error, {
        correlationId,
      });
      return ResultUtils.fail(error as Error);
    }
  }

  async update(tutorial: Tutorial): Promise<Result<void>> {
    try {
      await this.repository.update(tutorial);
      return ResultUtils.ok(undefined);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(
        `Failed to update tutorial ${tutorial.id.value}:`,
        error as Error,
        { correlationId },
      );
      return ResultUtils.fail(error as Error);
    }
  }

  async delete(id: TutorialId): Promise<Result<void>> {
    try {
      await this.repository.delete(id);
      return ResultUtils.ok(undefined);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(`Failed to delete tutorial ${id.value}:`, error as Error, {
        correlationId,
      });
      return ResultUtils.fail(error as Error);
    }
  }

  async exists(id: TutorialId): Promise<Result<boolean>> {
    try {
      const exists = await this.repository.exists(id);
      return ResultUtils.ok(exists);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(
        `Failed to check tutorial existence ${id.value}:`,
        error as Error,
        { correlationId },
      );
      return ResultUtils.fail(error as Error);
    }
  }

  async existsBySlug(slug: TutorialSlug): Promise<Result<boolean>> {
    try {
      const exists = await this.repository.existsBySlug(slug);
      return ResultUtils.ok(exists);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(
        `Failed to check tutorial existence by slug ${slug.value}:`,
        error as Error,
        { correlationId },
      );
      return ResultUtils.fail(error as Error);
    }
  }

  async findByIds(ids: TutorialId[]): Promise<Result<Tutorial[]>> {
    try {
      const tutorials = await this.repository.findByIds(ids);
      return ResultUtils.ok(tutorials);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Failed to find tutorials by ids:', error as Error, {
        correlationId,
      });
      return ResultUtils.fail(error as Error);
    }
  }

  async saveMany(tutorials: Tutorial[]): Promise<Result<void>> {
    try {
      await this.repository.saveMany(tutorials);
      return ResultUtils.ok(undefined);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Failed to save tutorials batch:', error as Error, {
        correlationId,
      });
      return ResultUtils.fail(error as Error);
    }
  }

  async updateMany(tutorials: Tutorial[]): Promise<Result<void>> {
    try {
      await this.repository.updateMany(tutorials);
      return ResultUtils.ok(undefined);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Failed to update tutorials batch:', error as Error, {
        correlationId,
      });
      return ResultUtils.fail(error as Error);
    }
  }

  async deleteMany(ids: TutorialId[]): Promise<Result<void>> {
    try {
      await this.repository.deleteMany(ids);
      return ResultUtils.ok(undefined);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Failed to delete tutorials batch:', error as Error, {
        correlationId,
      });
      return ResultUtils.fail(error as Error);
    }
  }
}
