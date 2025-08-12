'use client';

import { useEffect } from 'react';
import { PreloadStrategy } from '../utils/preloadStrategy';
import { getSamplePreloader } from '../services/InitialSamplePreloader';

/**
 * Component that initializes preloading of audio resources
 * Two-phase approach:
 * 1. Immediate: Decode samples using OfflineAudioContext (no user gesture needed)
 * 2. Background: Progressive sample loading after page loads
 */
export function PreloadInitializer() {
  useEffect(() => {
    // Phase 1: Start immediate sample decoding with OfflineAudioContext
    const initializeImmediate = async () => {
      console.log('🚀 PreloadInitializer: Starting immediate sample preloading...');
      
      // Start decoding samples immediately (no user gesture required)
      const preloader = getSamplePreloader();
      preloader.startPreloading().then(() => {
        console.log('✅ Initial sample decoding complete');
        
        // Mark that samples are ready
        (window as any).__samplesPreloaded = true;
        
        // Also start the legacy preload strategy for compatibility
        PreloadStrategy.startPreload('immediate');
      });
    };
    
    // Start immediately when component mounts
    initializeImmediate();
    
    // Phase 2: Background loading starts automatically via PreloadStrategy
    // No need to do anything here - it's handled internally
    
    // Optional: Listen for page visibility changes to pause/resume
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, might want to pause background loading
        console.log('📱 Page hidden, background loading will pause');
      } else {
        // Page is visible again
        console.log('📱 Page visible, background loading can resume');
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
  
  return null; // This component doesn't render anything
}