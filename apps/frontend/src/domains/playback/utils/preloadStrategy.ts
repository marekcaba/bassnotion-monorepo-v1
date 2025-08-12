/**
 * Preload Strategy for Audio Resources
 * Two-phase approach:
 * 1. Immediate: Minimal setup for instant playback (no samples)
 * 2. Background: Progressive sample loading without affecting metrics
 */

import { BackgroundSampleLoader } from '../services/BackgroundSampleLoader';
import { getRecommendedQuality } from '../config/sampleManifest';

export type PreloadMode = 'immediate' | 'background' | 'full';

export class PreloadStrategy {
  private static preloadStarted = false;
  private static preloadPromise: Promise<void> | null = null;
  private static backgroundLoader: BackgroundSampleLoader | null = null;
  
  /**
   * Start preloading based on mode
   * - immediate: Just warm up audio context, no sample loading
   * - background: Start progressive loading in idle time
   * - full: Legacy mode for backwards compatibility (blocks)
   */
  static async startPreload(mode: PreloadMode = 'immediate') {
    if (typeof window === 'undefined') return; // SSR guard
    
    // If already started, return the existing promise
    if (this.preloadPromise) {
      console.log('🎹 PreloadStrategy: Already loading, returning existing promise...');
      return this.preloadPromise;
    }
    
    if (this.preloadStarted) {
      console.log('🎹 PreloadStrategy: Already completed');
      return;
    }
    
    // Create and store the promise based on mode
    if (mode === 'immediate') {
      this.preloadPromise = this.doImmediatePreload();
    } else if (mode === 'background') {
      this.preloadPromise = this.doBackgroundPreload();
    } else {
      this.preloadPromise = this.doFullPreload();
    }
    
    return this.preloadPromise;
  }
  
  /**
   * Immediate preload - just essentials, no blocking
   */
  private static async doImmediatePreload() {
    this.preloadStarted = true;
    
    try {
      // 1. Warm up AudioContext on first user interaction
      this.setupAudioContextWarming();
      
      // 2. Mark that widgets should handle their own loading
      (window as any).__preloadComplete = true;
      (window as any).__samplesLoadOnDemand = true;
      (window as any).__drumsLoadOnDemand = true;
      
      console.log('✅ PreloadStrategy: Immediate mode - ready for on-demand loading');
      
      // 3. Start background loading after a short delay
      setTimeout(() => {
        this.startBackgroundLoading();
      }, 1000); // Wait 1 second for page to stabilize
      
    } catch (error) {
      console.warn('PreloadStrategy: Failed immediate preload', error);
    }
  }
  
  /**
   * Background preload - progressive loading in idle time
   */
  private static async doBackgroundPreload() {
    this.preloadStarted = true;
    
    try {
      // Warm up audio context
      this.setupAudioContextWarming();
      
      // Start background loading immediately
      await this.startBackgroundLoading();
      
      console.log('✅ PreloadStrategy: Background loading initiated');
    } catch (error) {
      console.warn('PreloadStrategy: Failed background preload', error);
    }
  }
  
  /**
   * Start background sample loading
   */
  private static async startBackgroundLoading() {
    // Check if background loading is disabled (for test pages)
    if (typeof window !== 'undefined' && (window as any).DISABLE_BACKGROUND_LOADING) {
      console.log('🚫 Background loading disabled by page');
      return;
    }
    
    if (this.backgroundLoader) {
      console.log('Background loader already running');
      return;
    }
    
    // Get background loader singleton
    this.backgroundLoader = BackgroundSampleLoader.getInstance();
    
    // Determine quality based on connection
    const quality = getRecommendedQuality();
    
    // Start loading with progress tracking
    this.backgroundLoader.startBackgroundLoading({
      priority: quality === 'essential' ? 'essential' : 'all',
      maxIdleTime: 50, // 50ms chunks
      onProgress: (instrument, status) => {
        console.log(`📊 ${instrument}: ${status.quality} (${status.progress}%)`);
        
        // Notify widgets that better samples are available
        if (status.quality === 'premium') {
          window.dispatchEvent(new CustomEvent('samplesUpgraded', {
            detail: { instrument, quality: status.quality }
          }));
        }
      },
    });
  }
  
  /**
   * Legacy full preload (backwards compatibility)
   */
  private static async doFullPreload() {
    this.preloadStarted = true;
    
    try {
      // 1. Warm up AudioContext on first user interaction
      this.setupAudioContextWarming();
      
      // 2. Prefetch critical audio samples if they exist
      // Note: These are optional optimizations, not critical for functionality
      this.prefetchAudioSamples();
      
      // 3. CRITICAL: Load all widget samples in parallel
      // Run these concurrently for faster loading
      await Promise.all([
        this.loadSalamanderSamples(),
        this.loadDrumSamples()
        // Bass samples not ready yet - skip for now
      ]);
      
      console.log('PreloadStrategy: Started preloading optimizations');
    } catch (error) {
      console.warn('PreloadStrategy: Failed to start preload', error);
    }
  }
  
  private static preloadScript(url: string) {
    try {
      const link = document.createElement('link');
      link.rel = 'modulepreload';
      link.href = url;
      document.head.appendChild(link);
    } catch (error) {
      console.warn('PreloadStrategy: Failed to preload script', url, error);
    }
  }
  
  private static prefetchAudioSamples() {
    // Use Supabase URLs for audio samples
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      console.warn('PreloadStrategy: Supabase URL not configured, skipping audio prefetch');
      return;
    }
    
    // Only prefetch if we know these samples exist
    const criticalSamples = [
      `${supabaseUrl}/storage/v1/object/public/audio-samples/metronome/Clicks_01.mp3`,
      // TODO: Add bass samples when they are uploaded to Supabase
      // `${supabaseUrl}/storage/v1/object/public/audio-samples/bass/E1.mp3`,
      // TODO: Add drum samples when curated kits are ready
      // `${supabaseUrl}/storage/v1/object/public/audio-samples/drums/curated/rock-kit/kick.mp3`
    ];
    
    criticalSamples.forEach(url => {
      try {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.as = 'fetch'; // Use 'fetch' instead of 'audio' for better compatibility
        link.href = url;
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
      } catch (error) {
        // Silently fail - these are optimizations, not critical
      }
    });
  }
  
  private static setupAudioContextWarming() {
    // Create AudioContext on first user interaction (hover, scroll, etc)
    const warmupHandler = () => {
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass && !(window as any).__audioContextWarmed) {
        const ctx = new AudioContextClass();
        ctx.suspend(); // Keep suspended until needed
        (window as any).__warmAudioContext = ctx;
        (window as any).__audioContextWarmed = true;
      }
      
      // Remove listeners after warming
      ['mouseenter', 'touchstart', 'scroll'].forEach(event => {
        document.removeEventListener(event, warmupHandler, { passive: true });
      });
    };
    
    // Listen for any user interaction
    ['mouseenter', 'touchstart', 'scroll'].forEach(event => {
      document.addEventListener(event, warmupHandler, { passive: true, once: true });
    });
  }
  
  /**
   * Use pre-warmed AudioContext if available
   */
  static getWarmedContext(): AudioContext | null {
    return (window as any).__warmAudioContext || null;
  }
  
  /**
   * QUICK: Just mark that samples should be loaded on-demand by widgets
   * Don't actually load them - let widgets handle it when they need it
   */
  private static async loadSalamanderSamples() {
    console.log('🎹 PreloadStrategy: Marking Salamander for on-demand loading...');
    
    // Don't actually load samples - just mark that preloading is "complete"
    // Widgets will load their own samples when they initialize
    (window as any).__preloadComplete = true;
    (window as any).__samplesLoadOnDemand = true;
    
    console.log('✅ PreloadStrategy: Ready for on-demand sample loading');
  }

  /**
   * QUICK: Mark drums for on-demand loading
   */
  private static async loadDrumSamples() {
    console.log('🥁 PreloadStrategy: Marking drums for on-demand loading...');
    
    // Don't actually load samples - widgets will handle it
    (window as any).__drumsLoadOnDemand = true;
    
    console.log('✅ PreloadStrategy: Ready for on-demand drum loading');
  }

  /**
   * Load bass samples for the BassLineWidget
   */
  private static async loadBassSamples() {
    console.log('🎸 PreloadStrategy: Starting bass sample loading...');
    
    try {
      // Import and initialize BassInstrumentProcessor
      const { BassInstrumentProcessor } = await import(
        '@/domains/playback/services/plugins/BassInstrumentProcessor'
      );
      
      // Create processor and initialize
      const processor = new BassInstrumentProcessor();
      await processor.initialize();
      
      // Store globally for BassLineWidget to use
      (window as any).__preloadedBassProcessor = processor;
      (window as any).__bassPreloaded = true;
      
      console.log('✅ PreloadStrategy: Bass samples loaded and ready!');
    } catch (error) {
      console.error('PreloadStrategy: Failed to load bass samples:', error);
    }
  }
}