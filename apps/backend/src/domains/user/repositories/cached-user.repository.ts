import { Injectable } from '@nestjs/common';
import {
  IUserRepository,
  PaginationOptions,
} from './user.repository.interface.js';
import { User } from '../entities/user.entity.js';
import { UserId } from '../value-objects/user-id.vo.js';
import { Email } from '../value-objects/email.vo.js';
import { UserRole } from '../value-objects/user-role.vo.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { CachedRepository } from '../../../infrastructure/cache/cached-repository.base.js';
import { UserRepository } from './user.repository.js';

/**
 * Cached user data structure (snake_case from database/cache).
 * This interface matches the output of User.toPersistence().
 */
interface CachedUserData {
  id: string;
  email: string;
  role: string;
  display_name: string;
  avatar_url?: string;
  last_login_at?: string;
}

/**
 * Cached decorator for UserRepository.
 *
 * Extends CachedRepository base class to provide consistent caching behavior
 * while implementing domain-specific methods like findByEmail and findByRole.
 *
 * Cache key patterns:
 * - user:{id} - Single entity
 * - user:email:{email} - By email lookup
 * - user:exists:{id} - Existence check
 * - user:email:exists:{email} - Email existence check
 * - users:list:page:{n}:limit:{m} - Pagination
 * - users:role:{role} - By role
 */
@Injectable()
export class CachedUserRepository
  extends CachedRepository<User, UserId, UserRepository>
  implements IUserRepository
{
  constructor(repository: UserRepository, cache: CacheService) {
    super(repository, cache, { ttl: 3600 }); // 1 hour default TTL
  }

  // ============================================================================
  // Domain-Specific Methods
  // ============================================================================

  /**
   * Find a user by email with caching.
   */
  async findByEmail(email: Email): Promise<User | null> {
    return this.findByAlternateKey(this.getEmailKey(email), () =>
      this.repository.findByEmail(email),
    );
  }

  /**
   * Find users by role with caching.
   */
  async findByRole(role: UserRole): Promise<User[]> {
    return this.findListByCriteria(this.getRoleKey(role), () =>
      this.repository.findByRole(role),
    );
  }

  /**
   * Check if a user exists by email with caching.
   */
  async existsByEmail(email: Email): Promise<boolean> {
    return this.existsByAlternateKey(this.getEmailExistsKey(email), () =>
      this.repository.existsByEmail(email),
    );
  }

  // ============================================================================
  // Abstract Method Implementations
  // ============================================================================

  protected reconstitute(data: unknown): User {
    const d = data as CachedUserData;
    return User.reconstitute(
      UserId.create(d.id),
      Email.create(d.email),
      UserRole.create(d.role),
      d.display_name,
      d.avatar_url,
      d.last_login_at ? new Date(d.last_login_at) : undefined,
    );
  }

  protected toPersistence(entity: User): unknown {
    return entity.toPersistence();
  }

  protected getEntityKey(id: UserId): string {
    return `user:${id.value}`;
  }

  protected getExistsKey(id: UserId): string {
    return `user:exists:${id.value}`;
  }

  protected getPaginationKey(options: PaginationOptions): string {
    return `users:list:page:${options.page}:limit:${options.limit}`;
  }

  protected getEntityId(entity: User): UserId {
    return UserId.create(entity.id);
  }

  protected async invalidateEntityCache(user: User): Promise<void> {
    const userId = UserId.create(user.id);
    const email = Email.create(user.email);
    const role = UserRole.create(user.role);

    await Promise.all([
      this.cache.del(this.getEntityKey(userId)),
      this.cache.del(this.getEmailKey(email)),
      this.cache.del(this.getExistsKey(userId)),
      this.cache.del(this.getEmailExistsKey(email)),
      this.cache.del(this.getRoleKey(role)),
    ]);
  }

  protected async invalidateLists(): Promise<void> {
    await this.cache.del('users:list:*');
  }

  // ============================================================================
  // Domain-Specific Cache Keys
  // ============================================================================

  private getEmailKey(email: Email): string {
    return `user:email:${email.value.toLowerCase()}`;
  }

  private getEmailExistsKey(email: Email): string {
    return `user:email:exists:${email.value.toLowerCase()}`;
  }

  private getRoleKey(role: UserRole): string {
    return `users:role:${role.value}`;
  }
}
