/**
 * CC64 Sustain Pedal System
 *
 * SustainPedalManager merges CC64TimelineBuilder + SustainPedalAnalyzer
 * into a single class for timeline building and pedal state analysis.
 */

export { SustainPedalManager } from './SustainPedalManager.js';

// Type aliases for backward compatibility
export type { SustainPedalManager as CC64TimelineBuilder } from './SustainPedalManager.js';
export type { SustainPedalManager as SustainPedalAnalyzer } from './SustainPedalManager.js';
