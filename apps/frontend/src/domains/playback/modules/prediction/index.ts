/**
 * Prediction Module - Predictive loading and behavior analysis
 * 
 * Provides intelligent asset prediction and prefetching capabilities
 * through behavior analysis and machine learning models.
 */

export * from './behavior/index.js';
export * from './prefetch/index.js';
export * from './models/index.js';
export * from './learning/index.js';

// Export main orchestrator
export { PredictiveComponents } from './PredictiveComponents.js';