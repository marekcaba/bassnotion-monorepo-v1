import { Injectable, Inject } from '@nestjs/common';
import type {
  IUserRepository,
  PaginatedResult,
  PaginationOptions } from './user.repository.interface.js';
import { User } from '../entities/user.entity.js';
import { UserId } from '../value-objects/user-id.vo.js';
import { Email } from '../value-objects/email.vo.js';
import { UserRole } from '../value-objects/user-role.vo.js';
import { Result, ResultUtils } from '../../shared/result.js';
import { createStructuredLogger } from '@bassnotion/contracts';
import { RequestContextService } from '../../../shared/services/request-context.service.js';

export interface IResultUserRepository {
  findById(id: UserId): Promise<Result<User | null>>;
  findByEmail(email: Email): Promise<Result<User | null>>;
  findAll(options: PaginationOptions): Promise<Result<PaginatedResult<User>>>;
  findByRole(role: UserRole): Promise<Result<User[]>>;
  search(query: string): Promise<Result<User[]>>;
  save(user: User): Promise<Result<void>>;
  update(user: User): Promise<Result<void>>;
  delete(id: UserId): Promise<Result<void>>;
  exists(id: UserId): Promise<Result<boolean>>;
  existsByEmail(email: Email): Promise<Result<boolean>>;
  findByIds(ids: UserId[]): Promise<Result<User[]>>;
  saveMany(users: User[]): Promise<Result<void>>;
  updateMany(users: User[]): Promise<Result<void>>;
  deleteMany(ids: UserId[]): Promise<Result<void>>;
}

@Injectable()
export class ResultUserRepository implements IResultUserRepository {
  private readonly staticLogger = createStructuredLogger(ResultUserRepository.name);

  constructor(
    private readonly repository: IUserRepository,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  async findById(id: UserId): Promise<Result<User | null>> {
    try {
      const user = await this.repository.findById(id);
      return ResultUtils.ok(user);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(`Failed to find user ${id.value}:`, error as Error, { correlationId });
      return ResultUtils.fail(error as Error);
    }
  }

  async findByEmail(email: Email): Promise<Result<User | null>> {
    try {
      const user = await this.repository.findByEmail(email);
      return ResultUtils.ok(user);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(`Failed to find user by email ${email.value}:`, error as Error, { correlationId });
      return ResultUtils.fail(error as Error);
    }
  }

  async findAll(
    options: PaginationOptions,
  ): Promise<Result<PaginatedResult<User>>> {
    try {
      const result = await this.repository.findAll(options);
      return ResultUtils.ok(result);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Failed to find all users:', error as Error, { correlationId });
      return ResultUtils.fail(error as Error);
    }
  }

  async findByRole(role: UserRole): Promise<Result<User[]>> {
    try {
      const users = await this.repository.findByRole(role);
      return ResultUtils.ok(users);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(`Failed to find users by role ${role.value}:`, error as Error, { correlationId });
      return ResultUtils.fail(error as Error);
    }
  }

  async search(query: string): Promise<Result<User[]>> {
    try {
      const users = await this.repository.search(query);
      return ResultUtils.ok(users);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(`Failed to search users with query "${query}":`, error as Error, { correlationId });
      return ResultUtils.fail(error as Error);
    }
  }

  async save(user: User): Promise<Result<void>> {
    try {
      await this.repository.save(user);
      return ResultUtils.ok(undefined);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Failed to save user:', error as Error, { correlationId });
      return ResultUtils.fail(error as Error);
    }
  }

  async update(user: User): Promise<Result<void>> {
    try {
      await this.repository.update(user);
      return ResultUtils.ok(undefined);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(`Failed to update user ${user.id}:`, error as Error, { correlationId });
      return ResultUtils.fail(error as Error);
    }
  }

  async delete(id: UserId): Promise<Result<void>> {
    try {
      await this.repository.delete(id);
      return ResultUtils.ok(undefined);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(`Failed to delete user ${id.value}:`, error as Error, { correlationId });
      return ResultUtils.fail(error as Error);
    }
  }

  async exists(id: UserId): Promise<Result<boolean>> {
    try {
      const exists = await this.repository.exists(id);
      return ResultUtils.ok(exists);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(`Failed to check user existence ${id.value}:`, error as Error, { correlationId });
      return ResultUtils.fail(error as Error);
    }
  }

  async existsByEmail(email: Email): Promise<Result<boolean>> {
    try {
      const exists = await this.repository.existsByEmail(email);
      return ResultUtils.ok(exists);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(
        `Failed to check user existence by email ${email.value}:`,
        error as Error,
        { correlationId }
      );
      return ResultUtils.fail(error as Error);
    }
  }

  async findByIds(ids: UserId[]): Promise<Result<User[]>> {
    try {
      const users = await this.repository.findByIds(ids);
      return ResultUtils.ok(users);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Failed to find users by ids:', error as Error, { correlationId });
      return ResultUtils.fail(error as Error);
    }
  }

  async saveMany(users: User[]): Promise<Result<void>> {
    try {
      await this.repository.saveMany(users);
      return ResultUtils.ok(undefined);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Failed to save users batch:', error as Error, { correlationId });
      return ResultUtils.fail(error as Error);
    }
  }

  async updateMany(users: User[]): Promise<Result<void>> {
    try {
      await this.repository.updateMany(users);
      return ResultUtils.ok(undefined);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Failed to update users batch:', error as Error, { correlationId });
      return ResultUtils.fail(error as Error);
    }
  }

  async deleteMany(ids: UserId[]): Promise<Result<void>> {
    try {
      await this.repository.deleteMany(ids);
      return ResultUtils.ok(undefined);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Failed to delete users batch:', error as Error, { correlationId });
      return ResultUtils.fail(error as Error);
    }
  }
}
