import {
  IUserRepository,
  PaginatedResult,
  PaginationOptions,
} from './user.repository.interface';
import { User } from '../entities/user.entity';
import { Email } from '../value-objects/email.vo';
import { UserId } from '../value-objects/user-id.vo';
import { UserRole } from '../value-objects/user-role.vo';
import { createStructuredLogger } from '@bassnotion/contracts';

export class CachedUserRepository implements IUserRepository {
  private readonly logger = createStructuredLogger('CachedUserRepository');
  private readonly cache = new Map<string, { data: any; timestamp: number }>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes
  private currentUserCache: { user: User | null; timestamp: number } | null =
    null;

  constructor(private readonly repository: IUserRepository) {}

  async findById(id: UserId): Promise<User | null> {
    const cacheKey = `user:${id.value}`;
    const cached = this.getFromCache(cacheKey);

    if (cached) {
      this.logger.debug('Cache hit for user by id', { id: id.value });
      return cached as User;
    }

    const user = await this.repository.findById(id);
    if (user) {
      this.setCache(cacheKey, user);
    }

    return user;
  }

  async findByEmail(email: Email): Promise<User | null> {
    const cacheKey = `user:email:${email.value}`;
    const cached = this.getFromCache(cacheKey);

    if (cached) {
      this.logger.debug('Cache hit for user by email', { email: email.value });
      return cached as User;
    }

    const user = await this.repository.findByEmail(email);
    if (user) {
      this.setCache(cacheKey, user);
      // Also cache by ID
      this.setCache(`user:${user.id}`, user);
    }

    return user;
  }

  async findAll(options: PaginationOptions): Promise<PaginatedResult<User>> {
    const cacheKey = `users:all:${options.page}:${options.limit}`;
    const cached = this.getFromCache(cacheKey);

    if (cached) {
      this.logger.debug('Cache hit for paginated users', options);
      return cached as PaginatedResult<User>;
    }

    const result = await this.repository.findAll(options);
    this.setCache(cacheKey, result);

    // Cache individual users
    result.items.forEach((user) => {
      this.setCache(`user:${user.id}`, user);
    });

    return result;
  }

  async findByRole(role: UserRole): Promise<User[]> {
    const cacheKey = `users:role:${role.value}`;
    const cached = this.getFromCache(cacheKey);

    if (cached) {
      this.logger.debug('Cache hit for users by role', { role: role.value });
      return cached as User[];
    }

    const users = await this.repository.findByRole(role);
    this.setCache(cacheKey, users);

    // Cache individual users
    users.forEach((user) => {
      this.setCache(`user:${user.id}`, user);
    });

    return users;
  }

  async search(query: string): Promise<User[]> {
    // Don't cache search results as they're too dynamic
    return this.repository.search(query);
  }

  async getCurrentUser(): Promise<User | null> {
    if (
      this.currentUserCache &&
      this.isValidCache(this.currentUserCache.timestamp)
    ) {
      this.logger.debug('Cache hit for current user');
      return this.currentUserCache.user;
    }

    const user = await this.repository.getCurrentUser();
    this.currentUserCache = { user, timestamp: Date.now() };

    if (user) {
      this.setCache(`user:${user.id}`, user);
    }

    return user;
  }

  async save(user: User): Promise<void> {
    await this.repository.save(user);
    this.invalidateUserCaches(user);
  }

  async update(user: User): Promise<void> {
    await this.repository.update(user);
    this.invalidateUserCaches(user);
  }

  async delete(id: UserId): Promise<void> {
    await this.repository.delete(id);
    this.invalidateCacheByPattern(`user:${id.value}`);
  }

  async exists(id: UserId): Promise<boolean> {
    const cacheKey = `user:exists:${id.value}`;
    const cached = this.getFromCache(cacheKey);

    if (cached !== null) {
      return cached as boolean;
    }

    const exists = await this.repository.exists(id);
    this.setCache(cacheKey, exists);
    return exists;
  }

  async existsByEmail(email: Email): Promise<boolean> {
    const cacheKey = `user:exists:email:${email.value}`;
    const cached = this.getFromCache(cacheKey);

    if (cached !== null) {
      return cached as boolean;
    }

    const exists = await this.repository.existsByEmail(email);
    this.setCache(cacheKey, exists);
    return exists;
  }

  async findByIds(ids: UserId[]): Promise<User[]> {
    // Check cache for all users
    const uncachedIds: UserId[] = [];
    const cachedUsers: User[] = [];

    for (const id of ids) {
      const cached = this.getFromCache(`user:${id.value}`);
      if (cached) {
        cachedUsers.push(cached as User);
      } else {
        uncachedIds.push(id);
      }
    }

    if (uncachedIds.length === 0) {
      return cachedUsers;
    }

    // Fetch uncached users
    const fetchedUsers = await this.repository.findByIds(uncachedIds);

    // Cache fetched users
    fetchedUsers.forEach((user) => {
      this.setCache(`user:${user.id}`, user);
    });

    return [...cachedUsers, ...fetchedUsers];
  }

  async saveMany(users: User[]): Promise<void> {
    await this.repository.saveMany(users);
    users.forEach((user) => this.invalidateUserCaches(user));
  }

  async updateMany(users: User[]): Promise<void> {
    await this.repository.updateMany(users);
    users.forEach((user) => this.invalidateUserCaches(user));
  }

  async deleteMany(ids: UserId[]): Promise<void> {
    await this.repository.deleteMany(ids);
    ids.forEach((id) => this.invalidateCacheByPattern(`user:${id.value}`));
  }

  async refreshCurrentUser(): Promise<User | null> {
    this.currentUserCache = null;
    const user = await this.repository.refreshCurrentUser();
    this.currentUserCache = { user, timestamp: Date.now() };

    if (user) {
      this.setCache(`user:${user.id}`, user);
    }

    return user;
  }

  async logout(): Promise<void> {
    await this.repository.logout();
    this.clearCache();
  }

  // Cache management methods
  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (!this.isValidCache(cached.timestamp)) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private isValidCache(timestamp: number): boolean {
    return Date.now() - timestamp < this.TTL;
  }

  private invalidateUserCaches(user: User): void {
    this.invalidateCacheByPattern(`user:${user.id}`);
    this.invalidateCacheByPattern(`user:email:${user.email}`);
    this.invalidateCacheByPattern('users:all:');
    this.invalidateCacheByPattern(`users:role:${user.role}`);

    // Invalidate current user cache if it's the same user
    if (this.currentUserCache?.user?.id === user.id) {
      this.currentUserCache = null;
    }
  }

  private invalidateCacheByPattern(pattern: string): void {
    const keysToDelete: string[] = [];

    this.cache.forEach((_, key) => {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  private clearCache(): void {
    this.cache.clear();
    this.currentUserCache = null;
  }
}
