import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import cacheManagerIoredis from 'cache-manager-ioredis';
import { CacheService } from './cache.service.js';

const { redisStore } = cacheManagerIoredis;

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get('REDIS_URL');

        // If no Redis URL, use in-memory cache
        if (!redisUrl) {
          return {
            ttl: 3600, // 1 hour default
            max: 100, // max items in memory
          };
        }

        // Parse Redis URL
        const url = new URL(redisUrl);

        return {
          store: redisStore,
          host: url.hostname,
          port: parseInt(url.port || '6379'),
          password: url.password || undefined,
          ttl: 3600, // 1 hour default
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
