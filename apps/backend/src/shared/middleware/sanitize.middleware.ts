import {
  Injectable,
  NestMiddleware,
  BadRequestException } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { sanitizationConfig } from '../../config/security.config.js';
import { createStructuredLogger } from '@bassnotion/contracts';

@Injectable()
export class SanitizeMiddleware implements NestMiddleware {
  private logger = createStructuredLogger('sanitize-middleware');

  use(req: FastifyRequest, res: FastifyReply, next: () => void) {
    try {
      // Sanitize query parameters
      if (req.query && typeof req.query === 'object') {
        this.sanitizeObject(req.query as Record<string, any>);
      }

      // Sanitize route parameters
      if (req.params && typeof req.params === 'object') {
        this.sanitizeObject(req.params as Record<string, any>);
      }

      // Sanitize body (already validated by Zod, but extra safety)
      if (req.body && typeof req.body === 'object') {
        this.sanitizeObject(req.body as Record<string, any>);
      }

      // Check URL length
      if (req.url.length > 2048) {
        throw new BadRequestException('URL too long');
      }

      next();
    } catch (error) {
      this.logger.warn('Input sanitization failed', {
        error: error instanceof Error ? error.message : 'Unknown error', url: req.url, method: req.method });

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Invalid input detected');
    }
  }

  /**
   * Recursively sanitize an object
   */
  private sanitizeObject(obj: Record<string, any>, depth = 0): void {
    // Prevent deep object traversal attacks
    if (depth > 10) {
      throw new BadRequestException('Object nesting too deep');
    }

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];

        // Sanitize the key itself
        if (this.isDangerous(key)) {
          delete obj[key];
          continue;
        }

        // Handle different value types
        if (typeof value === 'string') {
          obj[key] = this.sanitizeString(value);
        } else if (Array.isArray(value)) {
          obj[key] = value.map((item) =>
            typeof item === 'string' ? this.sanitizeString(item) : item,
          );
        } else if (value && typeof value === 'object') {
          this.sanitizeObject(value, depth + 1);
        }
      }
    }
  }

  /**
   * Sanitize a string value
   */
  private sanitizeString(value: string): string {
    // Check length
    if (value.length > sanitizationConfig.maxParamLength) {
      throw new BadRequestException('Input too long');
    }

    // Check for forbidden patterns
    for (const pattern of sanitizationConfig.forbiddenPatterns) {
      if (pattern.test(value)) {
        throw new BadRequestException('Forbidden pattern detected');
      }
    }

    // Remove null bytes
    let sanitized = value.replace(/\0/g, '');

    // Escape MongoDB operators
    if (sanitized.startsWith('$')) {
      sanitized = '\\' + sanitized;
    }

    // Remove potential SQL injection patterns
    sanitized = sanitized
      .replace(
        /(--|\/\*|\*\/|;|'|"|`|xp_|sp_|exec|execute|union|select|insert|update|delete|drop|create|alter|script)/gi,
        '',
      )
      .trim();

    return sanitized;
  }

  /**
   * Check if a key is potentially dangerous
   */
  private isDangerous(key: string): boolean {
    const dangerousKeys = [
      '__proto__',
      'constructor',
      'prototype',
      '$where',
      '$ne',
      '$gt',
      '$gte',
      '$lt',
      '$lte',
      '$nin',
      '$exists',
      '$regex',
    ];

    return dangerousKeys.includes(key.toLowerCase());
  }
}
