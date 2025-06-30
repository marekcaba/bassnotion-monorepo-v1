/**
 * Validation schemas and types for the BassNotion application
 *
 * This module provides a single source of truth for all validation logic
 * shared between frontend and backend applications.
 */

// Common validation utilities
export * from './common-schemas.js';

// Authentication validation
export * from './auth-schemas.js';

// User profile validation
export * from './user-schemas.js';

// Exercise validation - Epic 3 & 4 compatible
export * from './exercise-schemas.js';

// Playback domain validation - NEW for Task 15
export * from './playback-schemas.js';
