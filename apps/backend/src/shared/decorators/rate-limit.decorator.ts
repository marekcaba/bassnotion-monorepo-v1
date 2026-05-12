import { SetMetadata } from '@nestjs/common';

/**
 * Rate limit configuration for specific endpoints
 */
export interface RateLimitOptions {
  max: number;
  timeWindow: string; // e.g., '15 minutes', '1 hour'
  keyGenerator?: (req: any) => string; // Custom key generator
}

/**
 * Decorator to apply custom rate limiting to specific endpoints
 * @param options Rate limit configuration
 */
export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata('rateLimit', options);

/**
 * Pre-configured rate limit decorators for common use cases
 */
export const AuthRateLimit = () =>
  RateLimit({
    max: 5,
    timeWindow: '15 minutes',
  });

export const UploadRateLimit = () =>
  RateLimit({
    max: 10,
    timeWindow: '1 hour',
  });

export const PublicApiRateLimit = () =>
  RateLimit({
    max: 200,
    timeWindow: '15 minutes',
  });

/**
 * Rate limit for MIDI parsing and conversion endpoints
 * More restrictive than uploads since MIDI processing is CPU-intensive
 * 20 requests per 15 minutes per user
 */
export const MidiProcessingRateLimit = () =>
  RateLimit({
    max: 20,
    timeWindow: '15 minutes',
  });

/**
 * Rate limit for heavy MIDI operations (convert-drums, convert-harmony)
 * Most restrictive since these involve multiple processing steps
 * 15 requests per 15 minutes per user
 */
export const MidiConversionRateLimit = () =>
  RateLimit({
    max: 15,
    timeWindow: '15 minutes',
  });
