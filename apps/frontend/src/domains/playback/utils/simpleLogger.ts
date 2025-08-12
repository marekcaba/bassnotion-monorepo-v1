/**
 * Simple logger for critical initialization messages only
 */

export const initLogger = {
  toneInitialized: () => {
    console.log('✅ Tone.JS initialized');
  },
  
  widgetsLoaded: () => {
    console.log('✅ Widgets loaded');
  }
};