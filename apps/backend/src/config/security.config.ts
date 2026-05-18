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

/** Default browser origins for local dev (localhost vs 127.0.0.1 are different Origins). */
const LOCAL_DEV_ORIGINS = [
  'http://localhost:3001',
  'http://localhost:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3000',
] as const;

async function resolveCorsOrigin(
  origin: string | undefined,
): Promise<boolean | string> {
  if (!origin) {
    return true;
  }

  const allowedEnv = process.env.ALLOWED_ORIGINS;

  // main.ts sets this to * when FRONTEND_URL is unset; with credentials we reflect the request origin.
  if (allowedEnv === '*') {
    return true;
  }

  const fromEnv =
    allowedEnv
      ?.split(',')
      .map((o) => o.trim())
      .filter(Boolean) ?? [];

  const allow = new Set<string>([...LOCAL_DEV_ORIGINS, ...fromEnv]);
  if (allow.has(origin)) {
    return true;
  }

  // Distinguish staging from production: Railway sets RAILWAY_ENVIRONMENT_NAME
  // ("staging" / "production"); fall back to NODE_ENV for local dev. Production
  // backend never relaxes CORS.
  const railwayEnv = process.env.RAILWAY_ENVIRONMENT_NAME;
  const isProdBackend =
    railwayEnv === 'production' ||
    (!railwayEnv && process.env.NODE_ENV === 'production');

  if (!isProdBackend) {
    try {
      const u = new URL(origin);
      const localHost =
        u.hostname === 'localhost' || u.hostname === '127.0.0.1';
      if (localHost && (u.protocol === 'http:' || u.protocol === 'https:')) {
        return true;
      }
      // Vercel preview deploys produce a new hostname per commit
      // (e.g. bassnotion-monorepo-v1-frontend-<hash>.vercel.app). Project-scoped
      // and only created by trusted CI, so allow them on non-prod backends.
      if (
        u.protocol === 'https:' &&
        /^bassnotion-monorepo-v1-frontend[-a-z0-9]*\.vercel\.app$/.test(
          u.hostname,
        )
      ) {
        return true;
      }
    } catch {
      // ignore invalid origin
    }
  }

  return false;
}

/**
 * CORS configuration (honors ALLOWED_ORIGINS from main.ts + local dev hostnames)
 */
export const corsConfig = {
  origin: resolveCorsOrigin,
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
