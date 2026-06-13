import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';
import { createStructuredLogger } from '@bassnotion/contracts';
import { RateLimitOptions } from '../decorators/rate-limit.decorator.js';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private store: RateLimitStore = {};
  private logger = createStructuredLogger('rate-limit-guard');

  constructor(private reflector: Reflector) {
    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rateLimitOptions = this.reflector.get<RateLimitOptions>(
      'rateLimit',
      context.getHandler(),
    );

    // If no rate limit decorator, allow the request
    if (!rateLimitOptions) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const key = this.generateKey(request, rateLimitOptions);
    const now = Date.now();
    const windowMs = this.parseTimeWindow(
      rateLimitOptions.timeWindow || '15 minutes',
    );

    // Get or create rate limit entry
    let entry = this.store[key];

    if (!entry || entry.resetTime < now) {
      // Create new entry or reset expired one
      entry = {
        count: 0,
        resetTime: now + windowMs,
      };
      this.store[key] = entry;
    }

    // Increment counter
    entry.count++;

    // Check if limit exceeded
    if (entry.count > (rateLimitOptions.max || 100)) {
      const remainingTime = Math.ceil((entry.resetTime - now) / 1000);

      this.logger.warn('Rate limit exceeded', {
        key,
        limit: rateLimitOptions.max || 100,
        current: entry.count,
        remainingTime,
      });

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Please retry after ${remainingTime} seconds.`,
          rateLimit: {
            limit: rateLimitOptions.max || 100,
            current: entry.count,
            resetTime: new Date(entry.resetTime).toISOString(),
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private generateKey(
    request: FastifyRequest,
    options: RateLimitOptions,
  ): string {
    // Use custom key generator if provided
    if (options.keyGenerator) {
      return options.keyGenerator(request);
    }

    // Default: Use IP + route path. Fastify 5 removed `request.routerPath`
    // (use `request.routeOptions.url`); fall back to the raw url if the route
    // isn't matched yet (e.g. 404s) — same behaviour as before.
    const ip = this.extractClientIp(request);
    const route = request.routeOptions?.url || request.url;
    return `${ip}:${route}`;
  }

  private extractClientIp(request: FastifyRequest): string {
    // Same logic as in auth.controller.ts
    const xForwardedFor = request.headers['x-forwarded-for'];
    if (xForwardedFor) {
      const forwardedIps = Array.isArray(xForwardedFor)
        ? xForwardedFor[0]
        : xForwardedFor;
      const clientIp = forwardedIps.split(',')[0].trim();
      if (clientIp) return clientIp;
    }

    const headers = [
      request.headers['true-client-ip'],
      request.headers['cf-connecting-ip'],
      request.headers['x-real-ip'],
      request.headers['x-client-ip'],
    ];

    for (const header of headers) {
      if (header) return header.toString();
    }

    return request.ip || 'unknown';
  }

  private parseTimeWindow(timeWindow: string): number {
    const units: { [key: string]: number } = {
      second: 1000,
      seconds: 1000,
      minute: 60 * 1000,
      minutes: 60 * 1000,
      hour: 60 * 60 * 1000,
      hours: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000,
    };

    const match = timeWindow.match(/^(\d+)\s*(\w+)$/);
    if (!match) {
      throw new Error(`Invalid time window format: ${timeWindow}`);
    }

    const [, amount, unit] = match;
    const multiplier = units[unit.toLowerCase()];

    if (!multiplier) {
      throw new Error(`Unknown time unit: ${unit}`);
    }

    return parseInt(amount, 10) * multiplier;
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of Object.entries(this.store)) {
      if (entry.resetTime < now) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      delete this.store[key];
    }

    if (keysToDelete.length > 0) {
      this.logger.debug(
        `Cleaned up ${keysToDelete.length} expired rate limit entries`,
      );
    }
  }
}
