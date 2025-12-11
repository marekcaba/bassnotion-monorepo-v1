import { RateLimitOptions } from '@fastify/rate-limit';

/**
 * Security configuration for the BassNotion backend
 * Centralizes all security-related settings
 */

/**
 * Helmet configuration for security headers
 */
export const helmetConfig = {
  // Basic security headers
  contentSecurityPolicy: false, // Disable for API server
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  noSniff: true,
} as any;

/**
 * Rate limiting configuration
 * NOTE: Increased limits for development to handle React Strict Mode double-rendering
 * and multiple browser tabs. Adjust for production deployment.
 */
export const rateLimitConfig: RateLimitOptions = {
  max: 500, // Max requests per window (increased for development)
  timeWindow: '15 minutes',

  // Custom error response
  errorResponseBuilder: (request, context) => {
    // Safely handle the reset time
    let resetTime: string | undefined;
    let retryAfter: string | undefined;

    if (context.after && !isNaN(Number(context.after))) {
      try {
        const resetDate = new Date(Number(context.after));
        if (!isNaN(resetDate.getTime())) {
          resetTime = resetDate.toISOString();
          retryAfter = resetDate.toISOString();
        }
      } catch (error) {
        // If date conversion fails, use a default message
        retryAfter = 'a few minutes';
      }
    } else {
      retryAfter = 'a few minutes';
    }

    return {
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Please retry after ${retryAfter}.`,
      rateLimit: {
        limit: context.max,
        resetTime: resetTime || 'unknown',
      },
    };
  },

  // Skip rate limiting in development for easier testing
  // Note: skip is not a standard option, implement in middleware if needed

  // Store rate limit data in memory (consider Redis for production)
  // For now, using in-memory store
};

/**
 * Specific rate limits for different endpoints
 */
export const endpointRateLimits = {
  // Stricter limits for auth endpoints
  auth: {
    max: 5,
    timeWindow: '15 minutes',
  },

  // File upload endpoints
  upload: {
    max: 10,
    timeWindow: '1 hour',
  },

  // User profile endpoint (higher limit for development with React Strict Mode)
  userProfile: {
    max: 500,
    timeWindow: '15 minutes',
  },

  // Public API endpoints
  public: {
    max: 200,
    timeWindow: '15 minutes',
  },
};

/**
 * CORS configuration (already in main.ts, but centralized here)
 */
export const corsConfig = {
  origin: ['http://localhost:3001', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id'],
  exposedHeaders: ['x-correlation-id'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

/**
 * Input sanitization options
 */
export const sanitizationConfig = {
  // Strip dangerous characters from strings
  stripDangerousChars: true,

  // Maximum request body size (10MB)
  maxBodySize: 10 * 1024 * 1024,

  // Maximum URL parameter length
  maxParamLength: 200,

  // Forbidden patterns in input
  forbiddenPatterns: [
    /<script[^>]*>.*?<\/script>/gi, // Script tags
    /javascript:/gi, // JavaScript protocol
    /on\w+\s*=/gi, // Event handlers
  ],
};
