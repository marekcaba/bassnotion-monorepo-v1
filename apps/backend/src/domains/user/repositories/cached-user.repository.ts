import { Injectable } from '@nestjs/common';
import {
  IUserRepository,
  PaginatedResult,
  PaginationOptions,
} from './user.repository.interface.js';
import { User } from '../entities/user.entity.js';
import { UserId } from '../value-objects/user-id.vo.js';
import { Email } from '../value-objects/email.vo.js';
import { UserRole } from '../value-objects/user-role.vo.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { UserRepository } from './user.repository.js';

@Injectable()
export class CachedUserRepository implements IUserRepository {
  private readonly TTL = 3600; // 1 hour

  constructor(
    public readonly repository: UserRepository,
    private readonly cache: CacheService,
  ) {}

  async findById(id: UserId): Promise<User | null> {
    const key = this.getUserKey(id);

    return this.cache
      .wrap(
        key,
        async () => {
          const user = await this.repository.findById(id);
          return user ? user.toPersistence() : null;
        },
        this.TTL,
      )
      .then((data) => {
        if (!data) return null;
        return this.reconstitute(data);
      });
  }

  async findByEmail(email: Email): Promise<User | null> {
    const key = this.getEmailKey(email);

    return this.cache
      .wrap(
        key,
        async () => {
          const user = await this.repository.findByEmail(email);
          return user ? user.toPersistence() : null;
        },
        this.TTL,
      )
      .then((data) => {
        if (!data) return null;
        return this.reconstitute(data);
      });
  }

  async findAll(options: PaginationOptions): Promise<PaginatedResult<User>> {
    const key = this.getPaginationKey(options);

    return this.cache
      .wrap(
        key,
        async () => {
          const result = await this.repository.findAll(options);
          return {
            ...result,
            items: result.items.map((u) => u.toPersistence()),
          };
        },
        this.TTL / 2, // 30 minutes for list queries
      )
      .then((result) => ({
        ...result,
        items: result.items.map((data) => this.reconstitute(data)),
      }));
  }

  async findByRole(role: UserRole): Promise<User[]> {
    const key = this.getRoleKey(role);

    return this.cache
      .wrap(
        key,
        async () => {
          const users = await this.repository.findByRole(role);
          return users.map((u) => u.toPersistence());
        },
        this.TTL,
      )
      .then((items) => items.map((data) => this.reconstitute(data)));
  }

  async search(query: string): Promise<User[]> {
    // Don't cache search results as they're too dynamic
    return this.repository.search(query);
  }

  async save(user: User): Promise<void> {
    await this.repository.save(user);
    await this.invalidateCache(user);
  }

  async update(user: User): Promise<void> {
    await this.repository.update(user);
    await this.invalidateCache(user);
  }

  async delete(id: UserId): Promise<void> {
    // Get the user first to invalidate email cache
    const user = await this.repository.findById(id);
    await this.repository.delete(id);

    if (user) {
      await this.invalidateCache(user);
    }
    await this.cache.del(this.getUserKey(id));
    await this.invalidateLists();
  }

  async exists(id: UserId): Promise<boolean> {
    const key = this.getExistsKey(id);

    return this.cache.wrap(key, () => this.repository.exists(id), this.TTL);
  }

  async existsByEmail(email: Email): Promise<boolean> {
    const key = this.getEmailExistsKey(email);

    return this.cache.wrap(
      key,
      () => this.repository.existsByEmail(email),
      this.TTL,
    );
  }

  async findByIds(ids: UserId[]): Promise<User[]> {
    if (ids.length === 0) return [];

    // For batch operations, we'll check cache for each individual item
    // and only fetch missing ones from the database
    const cachedResults: (User | null)[] = await Promise.all(
      ids.map((id) => this.findById(id)),
    );

    return cachedResults.filter((user): user is User => user !== null);
  }

  async saveMany(users: User[]): Promise<void> {
    await this.repository.saveMany(users);

    // Invalidate cache for all saved users
    await Promise.all(users.map((user) => this.invalidateCache(user)));
    await this.invalidateLists();
  }

  async updateMany(users: User[]): Promise<void> {
    await this.repository.updateMany(users);

    // Invalidate cache for all updated users
    await Promise.all(users.map((user) => this.invalidateCache(user)));
    await this.invalidateLists();
  }

  async deleteMany(ids: UserId[]): Promise<void> {
    // Get users first to invalidate email caches
    const users = await this.repository.findByIds(ids);
    await this.repository.deleteMany(ids);

    // Invalidate cache for all deleted users
    await Promise.all([
      ...users.map((user) => this.invalidateCache(user)),
      ...ids.map((id) => this.cache.del(this.getUserKey(id))),
    ]);
    await this.invalidateLists();
  }

  private async invalidateCache(user: User): Promise<void> {
    const userId = UserId.create(user.id);
    const email = Email.create(user.email);

    await Promise.all([
      this.cache.del(this.getUserKey(userId)),
      this.cache.del(this.getEmailKey(email)),
      this.cache.del(this.getExistsKey(userId)),
      this.cache.del(this.getEmailExistsKey(email)),
    ]);

    // Also invalidate role-based cache
    const role = UserRole.create(user.role);
    await this.cache.del(this.getRoleKey(role));
  }

  private async invalidateLists(): Promise<void> {
    // Invalidate all paginated results
    // In production, you might want to track specific keys
    await this.cache.del('users:list:*');
  }

  private reconstitute(data: any): User {
    return User.reconstitute(
      UserId.create(data.id),
      Email.create(data.email),
      UserRole.create(data.role),
      data.display_name,
      data.avatar_url,
      data.last_login_at ? new Date(data.last_login_at) : undefined,
    );
  }

  private getUserKey(id: UserId): string {
    return `user:${id.value}`;
  }

  private getEmailKey(email: Email): string {
    return `user:email:${email.value.toLowerCase()}`;
  }

  private getExistsKey(id: UserId): string {
    return `user:exists:${id.value}`;
  }

  private getEmailExistsKey(email: Email): string {
    return `user:email:exists:${email.value.toLowerCase()}`;
  }

  private getRoleKey(role: UserRole): string {
    return `users:role:${role.value}`;
  }

  private getPaginationKey(options: PaginationOptions): string {
    return `users:list:page:${options.page}:limit:${options.limit}`;
  }
}
