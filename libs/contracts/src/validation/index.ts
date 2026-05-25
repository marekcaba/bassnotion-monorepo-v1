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

// Musical time validation - Shared schemas for MIDI parsing and conversion
export * from './musical-time-schemas.js';

// Social features validation - Likes and Favorites
export * from './social-schemas.js';

// Waitlist (pre-launch landing page)
export * from './waitlist-schemas.js';

// Founder upsell card (admin-editable copy + sizes)
export * from './founder-card-schemas.js';
