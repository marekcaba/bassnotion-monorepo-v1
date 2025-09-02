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
    preload: true },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  noSniff: true } as any;

/**
 * Rate limiting configuration
 */
export const rateLimitConfig: RateLimitOptions = {
  max: 100, // Max requests per window
  timeWindow: '15 minutes',

  // Custom error response
  errorResponseBuilder: (request, context) => {
    return {
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Please retry after ${new Date(context.after).toISOString()}.`,
      rateLimit: {
        limit: context.max,
        resetTime: new Date(context.after).toISOString() } };
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
    timeWindow: '15 minutes' },

  // File upload endpoints
  upload: {
    max: 10,
    timeWindow: '1 hour' },

  // Public API endpoints
  public: {
    max: 200,
    timeWindow: '15 minutes' } };

/**
 * CORS configuration (already in main.ts, but centralized here)
 */
export const corsConfig = {
  origin: true, // Allow all origins for now, can be made more restrictive in production
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id'],
  exposedHeaders: ['x-correlation-id'] };

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
  ] };
