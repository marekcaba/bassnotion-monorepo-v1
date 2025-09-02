/**
 * Simple logger for critical initialization messages only
 */

export const initLogger = {
  toneInitialized: () => {
    logger.info('✅ Tone.JS initialized');
  },

  widgetsLoaded: () => {
    logger.info('✅ Widgets loaded');
  },
};
