/**
 * Metadata Analysis Module
 *
 * Provides comprehensive audio metadata extraction and analysis
 * through a modular architecture.
 */

export * from './MetadataAnalyzer.js';
export * from './types.js';

// Export sub-modules for direct access if needed
export * from './tempo/index.js';
export * from './key/index.js';
export * from './spectral/index.js';
export * from './quality/index.js';
export * from './features/index.js';
