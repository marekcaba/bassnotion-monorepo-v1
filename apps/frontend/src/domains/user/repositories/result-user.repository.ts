import { Result } from '@/shared/patterns/result';
import { 
  IUserRepository, 
  PaginatedResult, 
  PaginationOptions 
} from './user.repository.interface';
import { User } from '../entities/user.entity';
import { Email } from '../value-objects/email.vo';
import { UserId } from '../value-objects/user-id.vo';
import { UserRole } from '../value-objects/user-role.vo';
import { createStructuredLogger } from '@bassnotion/contracts';

export class ResultUserRepository implements IUserRepository {
  private readonly logger = createStructuredLogger('ResultUserRepository');

  constructor(private readonly repository: IUserRepository) {}

  async findById(id: UserId): Promise<User | null> {
    try {
      return await this.repository.findById(id);
    } catch (error) {
      this.logger.error('Error in findById', error as Error);
      return null;
    }
  }

  async findByEmail(email: Email): Promise<User | null> {
    try {
      return await this.repository.findByEmail(email);
    } catch (error) {
      this.logger.error('Error in findByEmail', error as Error);
      return null;
    }
  }

  async findAll(options: PaginationOptions): Promise<PaginatedResult<User>> {
    try {
      return await this.repository.findAll(options);
    } catch (error) {
      this.logger.error('Error in findAll', error as Error);
      return {
        items: [],
        total: 0,
        page: options.page,
        limit: options.limit,
      };
    }
  }

  async findByRole(role: UserRole): Promise<User[]> {
    try {
      return await this.repository.findByRole(role);
    } catch (error) {
      this.logger.error('Error in findByRole', error as Error);
      return [];
    }
  }

  async search(query: string): Promise<User[]> {
    try {
      return await this.repository.search(query);
    } catch (error) {
      this.logger.error('Error in search', error as Error);
      return [];
    }
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      return await this.repository.getCurrentUser();
    } catch (error) {
      this.logger.error('Error in getCurrentUser', error as Error);
      return null;
    }
  }

  async save(user: User): Promise<void> {
    try {
      await this.repository.save(user);
    } catch (error) {
      this.logger.error('Error in save', error as Error);
      throw error;
    }
  }

  async update(user: User): Promise<void> {
    try {
      await this.repository.update(user);
    } catch (error) {
      this.logger.error('Error in update', error as Error);
      throw error;
    }
  }

  async delete(id: UserId): Promise<void> {
    try {
      await this.repository.delete(id);
    } catch (error) {
      this.logger.error('Error in delete', error as Error);
      throw error;
    }
  }

  async exists(id: UserId): Promise<boolean> {
    try {
      return await this.repository.exists(id);
    } catch (error) {
      this.logger.error('Error in exists', error as Error);
      return false;
    }
  }

  async existsByEmail(email: Email): Promise<boolean> {
    try {
      return await this.repository.existsByEmail(email);
    } catch (error) {
      this.logger.error('Error in existsByEmail', error as Error);
      return false;
    }
  }

  async findByIds(ids: UserId[]): Promise<User[]> {
    try {
      return await this.repository.findByIds(ids);
    } catch (error) {
      this.logger.error('Error in findByIds', error as Error);
      return [];
    }
  }

  async saveMany(users: User[]): Promise<void> {
    try {
      await this.repository.saveMany(users);
    } catch (error) {
      this.logger.error('Error in saveMany', error as Error);
      throw error;
    }
  }

  async updateMany(users: User[]): Promise<void> {
    try {
      await this.repository.updateMany(users);
    } catch (error) {
      this.logger.error('Error in updateMany', error as Error);
      throw error;
    }
  }

  async deleteMany(ids: UserId[]): Promise<void> {
    try {
      await this.repository.deleteMany(ids);
    } catch (error) {
      this.logger.error('Error in deleteMany', error as Error);
      throw error;
    }
  }

  async refreshCurrentUser(): Promise<User | null> {
    try {
      return await this.repository.refreshCurrentUser();
    } catch (error) {
      this.logger.error('Error in refreshCurrentUser', error as Error);
      return null;
    }
  }

  async logout(): Promise<void> {
    try {
      await this.repository.logout();
    } catch (error) {
      this.logger.error('Error in logout', error as Error);
      throw error;
    }
  }

  // Result-based methods for better error handling
  async findByIdResult(id: UserId): Promise<Result<User | null>> {
    try {
      const user = await this.repository.findById(id);
      return Result.ok(user);
    } catch (error) {
      const message = `Failed to find user by id: ${(error as Error).message}`;
      this.logger.error(message, error as Error);
      return Result.fail(message);
    }
  }

  async saveResult(user: User): Promise<Result<void>> {
    try {
      await this.repository.save(user);
      return Result.ok(undefined);
    } catch (error) {
      const message = `Failed to save user: ${(error as Error).message}`;
      this.logger.error(message, error as Error);
      return Result.fail(message);
    }
  }

  async updateResult(user: User): Promise<Result<void>> {
    try {
      await this.repository.update(user);
      return Result.ok(undefined);
    } catch (error) {
      const message = `Failed to update user: ${(error as Error).message}`;
      this.logger.error(message, error as Error);
      return Result.fail(message);
    }
  }

  async deleteResult(id: UserId): Promise<Result<void>> {
    try {
      await this.repository.delete(id);
      return Result.ok(undefined);
    } catch (error) {
      const message = `Failed to delete user: ${(error as Error).message}`;
      this.logger.error(message, error as Error);
      return Result.fail(message);
    }
  }
}