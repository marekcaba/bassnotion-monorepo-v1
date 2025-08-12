/**
 * Initial Sample Preloader
 * 
 * Preloads and decodes audio samples on page load using OfflineAudioContext
 * to avoid any delays when user clicks play. This runs before any user
 * interaction is required.
 */

import { GlobalSampleCache } from './storage/GlobalSampleCache.js';

interface PreloadConfig {
  drums: {
    pad: number;
    file: string;
    name: string;
  }[];
  harmony: string[];
  bass?: string[];
}

export class InitialSamplePreloader {
  private static instance: InitialSamplePreloader;
  private isPreloading = false;
  private preloadComplete = false;
  
  private constructor() {}
  
  static getInstance(): InitialSamplePreloader {
    if (!InitialSamplePreloader.instance) {
      InitialSamplePreloader.instance = new InitialSamplePreloader();
    }
    return InitialSamplePreloader.instance;
  }
  
  /**
   * Check if preloading is complete
   */
  isComplete(): boolean {
    return this.preloadComplete;
  }
  
  /**
   * Start preloading samples immediately on page load
   * Uses OfflineAudioContext which doesn't require user gesture
   */
  async startPreloading(): Promise<void> {
    if (this.isPreloading || this.preloadComplete) {
      console.log('⏭️ Sample preloading already started or complete');
      return;
    }
    
    console.log('🚀 Starting initial sample preloading (no user gesture required)...');
    this.isPreloading = true;
    
    try {
      // Create OfflineAudioContext for decoding (no user gesture needed)
      const offlineContext = new OfflineAudioContext(2, 44100 * 10, 44100);
      
      // Preload in parallel
      await Promise.all([
        this.preloadDrumSamples(offlineContext),
        this.preloadHarmonySamples(offlineContext),
        // Add bass samples when implemented
      ]);
      
      this.preloadComplete = true;
      console.log('✅ Initial sample preloading complete!');
      
      // Dispatch event to notify that samples are ready
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('samplesPreloaded'));
      }
    } catch (error) {
      console.error('❌ Failed to preload samples:', error);
    } finally {
      this.isPreloading = false;
    }
  }
  
  /**
   * Preload drum samples
   */
  private async preloadDrumSamples(offlineContext: OfflineAudioContext): Promise<void> {
    console.log('🥁 Preloading drum samples...');
    
    try {
      const { supabase } = await import('@/infrastructure/supabase/client');
      const kitPath = 'drums/hydrogen-kits/mp3/electronic/boss-dr110';
      
      const samples = [
        { pad: 1, file: 'dr110kik.mp3', name: 'kick' },
        { pad: 3, file: 'dr110clp.mp3', name: 'snare' },
        { pad: 5, file: 'dr110cht.mp3', name: 'hihat' },
      ];
      
      const loadPromises = samples.map(async (sample) => {
        const fullPath = `${kitPath}/${sample.file}`;
        const url = supabase.storage
          .from('audio-samples')
          .getPublicUrl(fullPath).data.publicUrl;
        
        // Cache URL
        GlobalSampleCache.cacheUrl(fullPath, url);
        GlobalSampleCache.cacheUrl(`drum-pad-${sample.pad}`, url);
        
        try {
          // Fetch the audio data
          const response = await fetch(url, { mode: 'cors' });
          if (!response.ok) throw new Error(`Failed to fetch ${sample.name}`);
          
          const arrayBuffer = await response.arrayBuffer();
          
          // Decode using OfflineAudioContext (no user gesture needed)
          const audioBuffer = await offlineContext.decodeAudioData(arrayBuffer.slice(0));
          
          // Cache the decoded buffer
          GlobalSampleCache.cacheBuffer(fullPath, audioBuffer);
          GlobalSampleCache.cacheBuffer(`drum-pad-${sample.pad}`, audioBuffer);
          
          console.log(`  ✓ Preloaded drum: ${sample.name} (${audioBuffer.duration.toFixed(2)}s)`);
        } catch (error) {
          console.warn(`  ✗ Failed to preload drum ${sample.name}:`, error);
        }
      });
      
      await Promise.all(loadPromises);
      console.log('✅ Drum samples preloaded');
    } catch (error) {
      console.error('Failed to preload drum samples:', error);
    }
  }
  
  /**
   * Preload harmony/piano samples
   */
  private async preloadHarmonySamples(offlineContext: OfflineAudioContext): Promise<void> {
    console.log('🎹 Preloading harmony samples...');
    
    try {
      const { supabase } = await import('@/infrastructure/supabase/client');
      
      // Preload essential piano notes for chord playing
      // Salamander piano uses sparse sampling: C, Ds, Fs, A per octave
      const notes = [
        'C3', 'Ds3', 'Fs3', 'A3',
        'C4', 'Ds4', 'Fs4', 'A4', 
        'C5', 'Ds5', 'Fs5', 'A5',
      ];
      
      const loadPromises = notes.map(async (note) => {
        const path = `Keyboards/salamander/v10/${note}.mp3`;
        const url = supabase.storage
          .from('audio-samples')
          .getPublicUrl(path).data.publicUrl;
        
        // Cache URL
        GlobalSampleCache.cacheUrl(path, url);
        GlobalSampleCache.cacheUrl(`piano-${note}`, url);
        
        try {
          // Fetch the audio data
          const response = await fetch(url, { mode: 'cors' });
          if (!response.ok) throw new Error(`Failed to fetch ${note}`);
          
          const arrayBuffer = await response.arrayBuffer();
          
          // Decode using OfflineAudioContext (no user gesture needed)
          const audioBuffer = await offlineContext.decodeAudioData(arrayBuffer.slice(0));
          
          // Cache the decoded buffer
          GlobalSampleCache.cacheBuffer(path, audioBuffer);
          GlobalSampleCache.cacheBuffer(`piano-${note}`, audioBuffer);
          
          console.log(`  ✓ Preloaded piano: ${note} (${audioBuffer.duration.toFixed(2)}s)`);
        } catch (error) {
          console.warn(`  ✗ Failed to preload piano ${note}:`, error);
        }
      });
      
      await Promise.all(loadPromises);
      console.log('✅ Harmony samples preloaded');
    } catch (error) {
      console.error('Failed to preload harmony samples:', error);
    }
  }
  
  /**
   * Get statistics about preloaded samples
   */
  getStats(): {
    isComplete: boolean;
    isPreloading: boolean;
    cacheStats: ReturnType<typeof GlobalSampleCache.getStats>;
  } {
    return {
      isComplete: this.preloadComplete,
      isPreloading: this.isPreloading,
      cacheStats: GlobalSampleCache.getStats()
    };
  }
}

// Export singleton getter
export const getSamplePreloader = () => InitialSamplePreloader.getInstance();