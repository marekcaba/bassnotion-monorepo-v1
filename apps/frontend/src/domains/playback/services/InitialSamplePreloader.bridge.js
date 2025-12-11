/**
 * Bridge file for InitialSamplePreloader to make tests work
 * Re-exports the preloader functionality
 */

import { InitialSamplePreloader } from './InitialSamplePreloader.js';

export function getSamplePreloader() {
  return InitialSamplePreloader.getInstance();
}

export { InitialSamplePreloader };
