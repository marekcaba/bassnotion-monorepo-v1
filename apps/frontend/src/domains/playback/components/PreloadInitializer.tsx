'use client';

import { useEffect } from 'react';
import { getSamplePreloader } from '../services/InitialSamplePreloader';
import { getLogger } from '@/utils/logger.js';

const logger = getLogger('preload');

/**
 * Component that initializes preloading of audio resources
 * Uses InitialSamplePreloader which is triggered by ScrollTriggerLoader
 * 
 * @deprecated This component is no longer needed - preloading is handled by ScrollTriggerLoader
 */
export function PreloadInitializer() {
  useEffect(() => {
    // Note: Preloading is now handled by ScrollTriggerLoader which triggers
    // InitialSamplePreloader.loadEssentialSamples() on first user interaction
    logger.info('PreloadInitializer: Preloading is now handled by ScrollTriggerLoader');
    
    // You can optionally check the preloader status here
    const preloader = getSamplePreloader();
    const stats = preloader.getStats();
    logger.info('Current preloader stats:', stats);
  }, []);

  return null; // This component doesn't render anything
}