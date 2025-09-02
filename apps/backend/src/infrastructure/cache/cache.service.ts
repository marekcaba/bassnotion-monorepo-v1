import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';

@Injectable()
export class CacheService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async get<T>(key: string): Promise<T | null> {
    const value = await this.cacheManager.get<T>(key);
    return value || null;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    await this.cacheManager.set(key, value, ttl);
  }

  async del(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  async reset(): Promise<void> {
    await this.cacheManager.del('*');
  }

  async wrap<T>(key: string, fn: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const fresh = await fn();
    await this.set(key, fresh, ttl);
    return fresh;
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const store = (this.cacheManager as any).store;
    if (store?.keys) {
      const keys = await store.keys(pattern);
      if (keys && keys.length > 0) {
        await Promise.all(keys.map((key: string) => this.del(key)));
      }
    }
  }
}
