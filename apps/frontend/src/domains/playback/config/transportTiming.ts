/**
 * Professional Transport Timing Configuration
 *
 * Centralized timing settings to ensure all widgets and components
 * use consistent, professional-grade timing parameters.
 *
 * These settings prioritize timing accuracy and stability over
 * low latency, which is essential for a DAW-like experience.
 */

import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('TransportTiming');

export const TRANSPORT_TIMING_CONFIG = {
  /**
   * Startup lookahead in seconds
   * This is the buffer time added when starting playback to ensure
   * all instruments and samples are loaded before the first audio plays.
   * This offset MUST be accounted for in the visual clock display
   * to keep the clock synchronized with audio playback.
   */
  startupLookahead: 0.3, // 300ms - buffer for stable playback start

  /**
   * Look-ahead time in seconds
   * This is how far ahead the scheduler looks to schedule events.
   * Professional DAWs typically use 50-200ms.
   * Lower values = lower latency but less stable timing
   * Higher values = more stable timing but higher latency
   */
  lookAheadTime: 0.15, // 150ms - increased for rock-solid timing stability

  /**
   * Update interval in seconds
   * How often the scheduler checks for new events to schedule.
   * Should be less than lookAheadTime.
   */
  updateInterval: 0.02, // 20ms - 50 updates per second for tighter timing

  /**
   * Maximum scheduling distance in seconds
   * Events further than this won't be scheduled yet.
   */
  maxScheduleDistance: 2.0,

  /**
   * Quantization settings
   */
  quantizationEnabled: true,
  defaultQuantization: '16n',

  /**
   * Performance settings
   */
  sampleAccurateTiming: true,
  enablePerformanceMonitoring: true,

  /**
   * UI update settings
   * For visual updates that don't affect audio timing
   */
  uiUpdateInterval: 16, // 60fps for smooth UI

  /**
   * Get configured Tone.js context settings
   */
  getToneContextSettings() {
    return {
      lookAhead: this.lookAheadTime,
      updateInterval: this.updateInterval,
      latencyHint: 'balanced', // 'balanced' is better for DAW use than 'interactive'
    };
  },
};

/**
 * Apply timing configuration to Tone.js
 * This should be called once when initializing the audio engine
 */
export function applyTransportTimingConfig(Tone: any) {
  const settings = TRANSPORT_TIMING_CONFIG.getToneContextSettings();

  // Apply to the audio context
  Tone.context.lookAhead = settings.lookAhead;
  Tone.context.updateInterval = settings.updateInterval;

  // Note: latencyHint is set when creating the AudioContext, not after
  // It's a constructor option, not a property that can be changed

  logger.info('🎛️ Transport timing configured:', {
    lookAhead: `${settings.lookAhead * 1000}ms`,
    updateInterval: `${settings.updateInterval * 1000}ms`,
    contextState: Tone.context.state,
  });
}

/**
 * Check if current timing settings match the recommended configuration
 */
export function validateTransportTiming(Tone: any): boolean {
  const settings = TRANSPORT_TIMING_CONFIG.getToneContextSettings();
  const currentLookAhead = Tone.context.lookAhead;
  const currentUpdateInterval = Tone.context.updateInterval;

  const isValid =
    Math.abs(currentLookAhead - settings.lookAhead) < 0.001 &&
    Math.abs(currentUpdateInterval - settings.updateInterval) < 0.001;

  if (!isValid) {
    logger.warn('⚠️ Transport timing mismatch:', {
      current: {
        lookAhead: `${currentLookAhead * 1000}ms`,
        updateInterval: `${currentUpdateInterval * 1000}ms`,
      },
      expected: {
        lookAhead: `${settings.lookAhead * 1000}ms`,
        updateInterval: `${settings.updateInterval * 1000}ms`,
      },
    });
  }

  return isValid;
}
