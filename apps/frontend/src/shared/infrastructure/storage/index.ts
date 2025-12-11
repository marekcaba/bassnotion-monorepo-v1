/**
 * Storage Infrastructure Module
 *
 * Provides generic storage functionality that can be used
 * by all domains in the application.
 *
 * Architecture:
 * - types/: Shared type definitions
 * - client/: Connection management (pooling, failover)
 * - services/: Core storage operations
 * - auth/: Authentication and security
 * - monitoring/: Performance and health monitoring
 */

// Export all types
export * from './types/index.js';

// Export client management
export { SupabaseClientManager } from './client/index.js';

// Export services
export { FileStorageService } from './services/index.js';

// Export authentication infrastructure
export * from './auth/index.js';

// Export CDN infrastructure
export * from './cdn/index.js';

// Export monitoring infrastructure
export * from './monitoring/index.js';
