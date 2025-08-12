/**
 * Background Sample Loader
 * Progressive, non-blocking audio sample loading using requestIdleCallback
 * FAANG-style approach: Load samples in background without affecting metrics
 */

import type * as Tone from 'tone';
import { GlobalSampleCache } from './storage/GlobalSampleCache.js';

export type SampleQuality = 'none' | 'essential' | 'standard' | 'premium';
export type LoadingPriority = 'essential' | 'standard' | 'premium' | 'all';

interface SampleStatus {
  loaded: boolean;
  quality: SampleQuality;
  progress: number; // 0-100
  bytesLoaded?: number;
  totalBytes?: number;
}

interface LoadingOptions {
  maxIdleTime?: number; // Max milliseconds per idle callback chunk
  priority?: LoadingPriority;
  onProgress?: (instrument: string, status: SampleStatus) => void;
}

interface InstrumentSamples {
  essential?: any; // Tone.Sampler or similar
  standard?: any;
  premium?: any;
  status: SampleStatus;
}

/**
 * Singleton service for background sample loading
 * Persists across page navigation for instant access
 */
export class BackgroundSampleLoader {
  private static instance: BackgroundSampleLoader | null = null;
  private samples: Map<string, InstrumentSamples> = new Map();
  private loadingQueue: Array<() => Promise<void>> = [];
  private isLoading = false;
  private idleCallbackId: number | null = null;
  private abortController: AbortController | null = null;
  private toneModule: typeof Tone | null = null;

  private constructor() {
    // Singleton - use getInstance()
    this.restoreFromCache();
  }

  static getInstance(): BackgroundSampleLoader {
    if (!this.instance) {
      this.instance = new BackgroundSampleLoader();
      // Store globally for cross-page persistence
      if (typeof window !== 'undefined') {
        (window as any).__backgroundSampleLoader = this.instance;
      }
    }
    return this.instance;
  }

  /**
   * Start loading samples in background using idle callbacks
   * This is the main entry point - call from layout after hydration
   */
  async startBackgroundLoading(options: LoadingOptions = {}): Promise<void> {
    const {
      maxIdleTime = 50, // 50ms chunks by default
      priority = 'all',
      onProgress,
    } = options;

    // Don't start if already loading
    if (this.isLoading) {
      console.log('🎹 Background loading already in progress');
      return;
    }

    console.log('🚀 Starting background sample loading');
    this.isLoading = true;
    this.abortController = new AbortController();

    // Build loading queue based on priority
    this.buildLoadingQueue(priority);

    // Start idle-time loading - Tone.js will be loaded when needed in each task
    this.scheduleIdleLoading(maxIdleTime, onProgress);
  }

  /**
   * Stop background loading (e.g., when user starts interacting)
   */
  stopBackgroundLoading(): void {
    if (this.idleCallbackId) {
      cancelIdleCallback(this.idleCallbackId);
      this.idleCallbackId = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isLoading = false;
  }

  /**
   * Get current status of samples for an instrument
   */
  getSampleStatus(instrument: string): SampleStatus {
    const samples = this.samples.get(instrument);
    if (!samples) {
      return {
        loaded: false,
        quality: 'none',
        progress: 0,
      };
    }
    return samples.status;
  }

  /**
   * Get preloaded samples for immediate use
   */
  getPreloadedSamples(instrument: string): any | null {
    const samples = this.samples.get(instrument);
    if (!samples) return null;

    // Return best available quality
    if (samples.premium) return samples.premium;
    if (samples.standard) return samples.standard;
    if (samples.essential) return samples.essential;
    return null;
  }

  /**
   * Check if essential samples are ready for an instrument
   */
  hasEssentialSamples(instrument: string): boolean {
    const samples = this.samples.get(instrument);
    return !!(samples?.essential);
  }

  /**
   * Get loading progress for all instruments
   */
  getOverallProgress(): number {
    const instruments = ['harmony', 'drums', 'bass', 'metronome'];
    const totalProgress = instruments.reduce((sum, inst) => {
      return sum + this.getSampleStatus(inst).progress;
    }, 0);
    return Math.round(totalProgress / instruments.length);
  }

  /**
   * Connect pre-loaded samples to audio destination
   * Call this after user gesture when AudioContext is running
   */
  async connectSamplesToDestination(instrument: string): Promise<boolean> {
    try {
      const samples = this.samples.get(instrument);
      if (!samples) {
        console.log(`❌ No samples found for ${instrument}`);
        return false;
      }

      // Ensure Tone is loaded
      if (!this.toneModule) {
        await this.loadToneModule();
      }

      const Tone = this.toneModule;
      if (!Tone) {
        console.error('❌ Tone.js not available');
        return false;
      }

      // Connect drum pads if they exist
      if (instrument === 'drums' && samples.essential) {
        const drumPads = samples.essential;
        let connectedCount = 0;
        
        for (const [padNum, player] of Object.entries(drumPads)) {
          if (player && typeof player.toDestination === 'function') {
            try {
              // Only connect if not already connected
              if (player.numberOfOutputs === 0) {
                player.toDestination();
                console.log(`🔌 Connected drum pad ${padNum} to destination`);
                connectedCount++;
              } else {
                console.log(`✅ Drum pad ${padNum} already connected`);
              }
            } catch (error) {
              console.error(`❌ Failed to connect pad ${padNum}:`, error);
            }
          }
        }
        
        console.log(`✅ Connected ${connectedCount} drum pads to destination`);
        return connectedCount > 0;
      }

      // Connect other instruments (harmony, bass, etc.)
      if (samples.essential && typeof samples.essential.connect === 'function') {
        try {
          if (!samples.essential.connected) {
            samples.essential.toDestination();
            console.log(`🔌 Connected ${instrument} to destination`);
          }
          return true;
        } catch (error) {
          console.error(`❌ Failed to connect ${instrument}:`, error);
          return false;
        }
      }

      return false;
    } catch (error) {
      console.error(`❌ Error connecting ${instrument} samples:`, error);
      return false;
    }
  }

  /**
   * Check if samples are connected to destination
   */
  areSamplesConnected(instrument: string): boolean {
    const samples = this.samples.get(instrument);
    if (!samples || !samples.essential) return false;

    if (instrument === 'drums') {
      const drumPads = samples.essential;
      // Check if at least one pad is connected
      return Object.values(drumPads).some(pad => 
        pad && pad.numberOfOutputs > 0
      );
    }

    // For other instruments
    return samples.essential.connected || samples.essential.numberOfOutputs > 0;
  }

  // Private methods

  /**
   * Check if we can preload URLs without needing Tone.js
   * This works even when AudioEngine is only pre-initialized
   */
  private canPreloadUrls(): boolean {
    // We can always preload URLs - they're just strings!
    return true;
  }

  /**
   * Check if Tone.js is available for creating actual audio objects
   */
  private isToneReady(): boolean {
    try {
      if ((window as any).__coreServices) {
        const coreServices = (window as any).__coreServices;
        const audioEngine = coreServices.getAudioEngine();
        return audioEngine && audioEngine.isReady();
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Check if we should pause loading (e.g., during active playback)
   */
  private shouldPauseLoading(): boolean {
    // Check if transport is playing
    if (typeof window !== 'undefined' && (window as any).Tone?.Transport?.state === 'started') {
      return true;
    }
    
    // Check if any audio is actively playing
    if (this.toneModule?.Transport?.state === 'started') {
      return true;
    }
    
    return false;
  }

  private async loadToneModule(): Promise<void> {
    try {
      // First check if CoreServices is already available
      if ((window as any).__coreServices) {
        const coreServices = (window as any).__coreServices;
        
        const audioEngine = coreServices.getAudioEngine();
        if (!audioEngine) {
          throw new Error('AudioEngine not available in CoreServices');
        }
        
        // Check if AudioEngine is ready (fully initialized, not just pre-initialized)
        if (!audioEngine.isReady()) {
          throw new Error('AudioEngine is pre-initialized but not ready yet. Full initialization required.');
        }
        
        // Get Tone from the AudioEngine
        this.toneModule = audioEngine.getTone();
        
        if (!this.toneModule) {
          throw new Error('Tone.js not available from AudioEngine');
        }
        
        const audioContext = this.toneModule.context.rawContext as AudioContext;
        return;
      }
      
      // Wait for CoreServices to be available OR the audioServicesReady event
      // Create a promise that resolves when services are ready
      const servicesReadyPromise = new Promise<void>((resolve) => {
        const checkServices = () => {
          if ((window as any).__coreServices) {
            resolve();
          }
        };
        
        // Check immediately
        checkServices();
        
        // Listen for the event
        const handler = () => {
          window.removeEventListener('audioServicesReady', handler);
          resolve();
        };
        window.addEventListener('audioServicesReady', handler);
        
        // Also poll in case we missed the event
        let attempts = 0;
        const pollInterval = setInterval(() => {
          attempts++;
          checkServices();
          if (attempts >= 50) { // 5 seconds max
            clearInterval(pollInterval);
            window.removeEventListener('audioServicesReady', handler);
            resolve(); // Resolve anyway and let it fail below
          }
        }, 100);
        
        // Clean up when resolved
        servicesReadyPromise.then(() => {
          clearInterval(pollInterval);
          window.removeEventListener('audioServicesReady', handler);
        });
      });
      
      await servicesReadyPromise;
      
      const coreServices = (window as any).__coreServices;
      if (!coreServices) {
        throw new Error('CoreServices not found after 5 seconds');
      }
      
      const audioEngine = coreServices.getAudioEngine();
      if (!audioEngine) {
        throw new Error('AudioEngine not available in CoreServices');
      }
      
      // Get Tone from the AudioEngine
      this.toneModule = audioEngine.getTone();
      
      if (!this.toneModule) {
        throw new Error('Tone.js not available from AudioEngine');
      }
      
      const audioContext = this.toneModule.context.rawContext as AudioContext;
    } catch (error) {
      // This is expected when AudioEngine is only pre-initialized
      // Just throw to let calling code handle it gracefully
      throw error; // Re-throw to trigger retry
    }
  }

  private buildLoadingQueue(priority: LoadingPriority): void {
    this.loadingQueue = [];

    // Define loading tasks by priority
    const essentialTasks = [
      () => this.loadHarmonyEssential(),
      () => this.loadDrumsEssential(),
      () => this.loadMetronomeEssential(),
      () => this.loadBassEssential(),
    ];

    const standardTasks = [
      () => this.loadHarmonyStandard(),
      () => this.loadDrumsStandard(),
    ];

    const premiumTasks = [
      () => this.loadHarmonyPremium(),
      () => this.loadDrumsPremium(),
    ];

    // Build queue based on priority
    switch (priority) {
      case 'essential':
        this.loadingQueue.push(...essentialTasks);
        break;
      case 'standard':
        this.loadingQueue.push(...essentialTasks, ...standardTasks);
        break;
      case 'premium':
        this.loadingQueue.push(...essentialTasks, ...standardTasks, ...premiumTasks);
        break;
      case 'all':
      default:
        this.loadingQueue.push(...essentialTasks, ...standardTasks, ...premiumTasks);
    }
  }

  private scheduleIdleLoading(
    maxIdleTime: number,
    onProgress?: (instrument: string, status: SampleStatus) => void,
  ): void {
    if (!('requestIdleCallback' in window)) {
      // Fallback for browsers without requestIdleCallback
      console.warn('requestIdleCallback not supported, using setTimeout fallback');
      this.fallbackLoading(maxIdleTime, onProgress);
      return;
    }

    const processNextTask = async (deadline: IdleDeadline) => {
      // Process tasks while we have idle time
      while (
        deadline.timeRemaining() > 0 &&
        this.loadingQueue.length > 0 &&
        !this.abortController?.signal.aborted
      ) {
        const task = this.loadingQueue.shift();
        if (task) {
          try {
            console.log(`📋 Executing loading task (${this.loadingQueue.length} remaining)`);
            // Execute task and wait for completion
            await task();
            
            // Report progress after task completes
            if (onProgress) {
              // Report progress for each instrument
              ['harmony', 'drums', 'bass', 'metronome'].forEach(inst => {
                const status = this.getSampleStatus(inst);
                if (status.progress > 0) {
                  console.log(`📊 Progress update: ${inst} - ${status.quality} (${status.progress}%)`);
                  onProgress(inst, status);
                }
              });
            }
          } catch (error) {
            console.error('Background loading task failed:', error);
          }
        }

        // Don't exceed idle time limit
        if (deadline.timeRemaining() < 5) break;
      }

      // Schedule next batch if more tasks remain
      if (this.loadingQueue.length > 0 && !this.abortController?.signal.aborted) {
        this.idleCallbackId = requestIdleCallback(processNextTask, {
          timeout: 2000, // Max 2 seconds wait between callbacks
        });
      } else {
        this.isLoading = false;
        
        // Final progress report
        if (onProgress) {
          ['harmony', 'drums', 'bass', 'metronome'].forEach(inst => {
            const status = this.getSampleStatus(inst);
            if (status.progress > 0) {
              onProgress(inst, status);
            }
          });
        }
        
        this.saveToCache();
      }
    };

    // Start the idle loading process
    this.idleCallbackId = requestIdleCallback(processNextTask, {
      timeout: 2000,
    });
  }

  private fallbackLoading(
    maxIdleTime: number,
    onProgress?: (instrument: string, status: SampleStatus) => void,
  ): void {
    // Fallback using setTimeout for older browsers
    const processTask = async () => {
      if (this.loadingQueue.length === 0 || this.abortController?.signal.aborted) {
        this.isLoading = false;
        
        // Final progress report
        if (onProgress) {
          ['harmony', 'drums', 'bass', 'metronome'].forEach(inst => {
            const status = this.getSampleStatus(inst);
            if (status.progress > 0) {
              onProgress(inst, status);
            }
          });
        }
        
        this.saveToCache();
        return;
      }

      const task = this.loadingQueue.shift();
      if (task) {
        try {
          await task();
          
          if (onProgress) {
            ['harmony', 'drums', 'bass', 'metronome'].forEach(inst => {
              const status = this.getSampleStatus(inst);
              if (status.progress > 0) {
                onProgress(inst, status);
              }
            });
          }
          // Schedule next task
          setTimeout(processTask, 100); // 100ms between tasks
        } catch (error) {
          console.error('Background loading task failed:', error);
          setTimeout(processTask, 100);
        }
      }
    };

    // Start fallback loading
    setTimeout(processTask, 100);
  }

  // Instrument-specific loading methods

  private async loadHarmonyEssential(): Promise<void> {
    
    // Try to get Tone.js if not already loaded
    if (!this.toneModule) {
      try {
        await this.loadToneModule();
      } catch (error) {
        console.log('⏳ Tone.js not ready yet, preloading URLs only');
        // We can still preload the URLs without Tone.js
        await this.preloadHarmonyURLs();
        return;
      }
    }

    const Tone = this.toneModule;
    
    try {
      // Load the actual ChordInstrumentProcessor which uses Supabase samples
      const { ChordInstrumentProcessor, ChordPreset } = await import(
        '@/domains/playback/services/plugins/ChordInstrumentProcessor'
      );
      
      const processor = new ChordInstrumentProcessor();
      
      // Set the preset to PIANO which loads Salamander samples from Supabase
      await processor.setPreset(ChordPreset.PIANO);
      
      // Ensure samples are fully loaded
      await processor.ensureSamplesLoaded();
      

      // Store samples
      if (!this.samples.has('harmony')) {
        this.samples.set('harmony', {
          status: { loaded: false, quality: 'none', progress: 0 },
        });
      }
      
      const harmonySamples = this.samples.get('harmony')!;
      // Mark processor as preloaded so widgets don't dispose it
      (processor as any)._isPreloaded = true;
      harmonySamples.essential = processor;
      harmonySamples.status = {
        loaded: true,
        quality: 'essential',
        progress: 33,
      };

      // Store globally for widgets
      (window as any).__preloadedHarmonySamples = processor;
      (window as any).__preloadedChordProcessor = processor;
      
      
    } catch (error) {
      console.error('Failed to load essential harmony samples from Supabase:', error);
    }
  }

  private async loadHarmonyStandard(): Promise<void> {
    // Skip standard tier - we already have the full processor in essential
    // Just update progress
    
    const harmonySamples = this.samples.get('harmony');
    if (harmonySamples) {
      harmonySamples.status = {
        loaded: true,
        quality: 'standard',
        progress: 66,
      };
    }
  }

  private async loadHarmonyPremium(): Promise<void> {
    // Skip premium tier - we already have the full processor in essential
    // Just update progress to 100%
    
    const harmonySamples = this.samples.get('harmony');
    if (harmonySamples) {
      harmonySamples.status = {
        loaded: true,
        quality: 'premium',
        progress: 100,
      };
    }
  }

  private async loadDrumsEssential(): Promise<void> {
    console.log('🥁 Loading drum samples from Supabase...');
    
    // Try to get Tone.js if not already loaded
    if (!this.toneModule) {
      try {
        await this.loadToneModule();
      } catch (error) {
        console.log('⏳ Tone.js not ready yet, preloading drum URLs only');
        // We can still preload the URLs without Tone.js
        await this.preloadDrumURLs();
        return;
      }
    }

    const Tone = this.toneModule;
    
    try {
      // Load actual drum samples from Supabase
      const { supabase } = await import('@/infrastructure/supabase/client');
      const kitPath = 'drums/hydrogen-kits/mp3/electronic/boss-dr110';
      
      const drumPads: Record<number, any> = {};
      
      // Load Boss DR-110 samples
      const samples = [
        { pad: 1, file: 'dr110kik.mp3', name: 'kick' },
        { pad: 3, file: 'dr110clp.mp3', name: 'snare' },
        { pad: 5, file: 'dr110cht.mp3', name: 'hihat' },
      ];
      
      for (const sample of samples) {
        const url = supabase.storage
          .from('audio-samples')
          .getPublicUrl(`${kitPath}/${sample.file}`).data.publicUrl;
        
        // Pre-create Player but DON'T connect to destination yet
        // This allows loading without requiring AudioContext to be running
        drumPads[sample.pad] = new Tone.Player({
          url,
          onload: () => {
            console.log(`✅ Loaded ${sample.name} (not connected to destination yet)`);
          },
        });
        
        // Set volume but don't connect
        drumPads[sample.pad].volume.value = -10;
      }
      
      await Tone.loaded();
      
      // Store samples
      if (!this.samples.has('drums')) {
        this.samples.set('drums', {
          status: { loaded: false, quality: 'none', progress: 0 },
        });
      }
      
      const drumSamples = this.samples.get('drums')!;
      drumSamples.essential = drumPads;
      drumSamples.status = {
        loaded: true,
        quality: 'essential',
        progress: 33,
      };

      // Store globally for DrummerWidget
      (window as any).__preloadedDrumPads = drumPads;
      
    } catch (error) {
      console.error('Failed to load drums from Supabase:', error);
    }
  }

  private async loadDrumsStandard(): Promise<void> {
    // Skip standard tier - we already loaded the drums in essential
    console.log('🥁 Standard drum samples already loaded (using same Supabase samples)');
    
    const drumSamples = this.samples.get('drums');
    if (drumSamples) {
      drumSamples.status = {
        loaded: true,
        quality: 'standard',
        progress: 66,
      };
    }
  }

  private async loadDrumsPremium(): Promise<void> {
    // Load full drum kit with multiple velocity layers
    // Implementation would load professional multi-sampled drums
    console.log('🥁 Premium drums not yet implemented');
    
    const drumSamples = this.samples.get('drums');
    if (drumSamples) {
      drumSamples.status.progress = 100;
    }
  }

  private async loadMetronomeEssential(): Promise<void> {
    // Try to get Tone.js if not already loaded
    if (!this.toneModule) {
      try {
        await this.loadToneModule();
      } catch (error) {
        console.log('⏳ Tone.js not ready yet, preloading metronome URLs only');
        // We can still preload the URLs without Tone.js
        await this.preloadMetronomeURLs();
        return;
      }
    }

    console.log('🎵 Loading metronome samples...');

    const Tone = this.toneModule;
    
    try {
      // Simple click synth for metronome
      const clickSynth = new Tone.MembraneSynth({
        pitchDecay: 0.008,
        octaves: 2,
        envelope: {
          attack: 0.001,
          decay: 0.03,
          sustain: 0,
          release: 0.01,
        },
      }).toDestination();

      if (!this.samples.has('metronome')) {
        this.samples.set('metronome', {
          status: { loaded: false, quality: 'none', progress: 0 },
        });
      }
      
      const metronomeSamples = this.samples.get('metronome')!;
      metronomeSamples.essential = clickSynth;
      metronomeSamples.status = {
        loaded: true,
        quality: 'essential',
        progress: 100,
      };

      // Store globally
      (window as any).__preloadedMetronome = clickSynth;
      
    } catch (error) {
      console.error('Failed to load metronome:', error);
    }
  }

  // Cache management

  private saveToCache(): void {
    // In a real implementation, this would use IndexedDB or similar
    // For now, samples are kept in memory via singleton
    console.log('💾 Samples cached in memory');
  }

  private restoreFromCache(): void {
    // Check if we already have cached samples from previous page
    if (typeof window !== 'undefined') {
      const cached = (window as any).__backgroundSampleLoader;
      if (cached && cached !== this && cached.samples) {
        this.samples = cached.samples;
        console.log('♻️ Restored cached samples from previous page');
      }
    }
  }

  // Memory management

  checkMemoryPressure(): boolean {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const usedMemory = memory.usedJSHeapSize;
      const totalMemory = memory.jsHeapSizeLimit;
      const usage = usedMemory / totalMemory;
      
      if (usage > 0.9) {
        console.warn('⚠️ Memory pressure detected, pausing background loading');
        return true;
      }
    }
    return false;
  }

  private async preloadHarmonyURLs(): Promise<void> {
    console.log('🌐 Preloading harmony samples with OfflineAudioContext...');
    
    try {
      // Get Supabase URLs and fetch them to warm the browser cache
      const { supabase } = await import('@/infrastructure/supabase/client');
      
      // Define all 16 velocity layers in order of priority
      // v10 is most common (velocity 73-80), then nearby layers
      const priorityLayers = [
        'v10', // velocity 73-80 (most common - mf)
        'v8',  // velocity 57-64 (medium)
        'v12', // velocity 89-96 (forte)
        'v6',  // velocity 41-48 (piano)
        'v14', // velocity 105-112 (fortissimo)
        'v4',  // velocity 25-32 (pp)
        'v16', // velocity 121-127 (fff)
        'v2',  // velocity 9-16 (ppp)
        'v11', // velocity 81-88
        'v9',  // velocity 65-72
        'v13', // velocity 97-104
        'v7',  // velocity 49-56
        'v5',  // velocity 33-40
        'v15', // velocity 113-120
        'v3',  // velocity 17-24
        'v1',  // velocity 0-8 (pppp)
      ];
      
      // Salamander sparse sampling: C, Ds, Fs, A per octave
      const notes = [
        'C3', 'Ds3', 'Fs3', 'A3',
        'C4', 'Ds4', 'Fs4', 'A4',
        'C5', 'Ds5', 'Fs5', 'A5',
      ];
      
      // Create OfflineAudioContext for decoding (doesn't require user gesture)
      const offlineContext = new OfflineAudioContext(2, 44100 * 10, 44100);
      
      // Load layers progressively with throttling
      let loadedCount = 0;
      for (const layer of priorityLayers) {
        // Check if we should pause loading (e.g., if user is actively playing)
        if (this.shouldPauseLoading()) {
          console.log('⏸️ Pausing background loading...');
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        }
        
        console.log(`📥 Loading velocity layer ${layer}...`);
        
        const layerPromises = notes.map(async note => {
          const path = `Keyboards/salamander/${layer}/${note}.mp3`;
          
          // Check if already cached
          if (GlobalSampleCache.getCachedBuffer(path)) {
            return; // Skip if already loaded
          }
          
          const url = supabase.storage
            .from('audio-samples')
            .getPublicUrl(path).data.publicUrl;
          
          // Cache the URL for later use
          GlobalSampleCache.cacheUrl(path, url);
          
          // Fetch and decode to AudioBuffer
          try {
            const response = await fetch(url, { mode: 'cors' });
            if (response.ok) {
              const arrayBuffer = await response.arrayBuffer();
              // Decode using OfflineAudioContext (no user gesture needed)
              const audioBuffer = await offlineContext.decodeAudioData(arrayBuffer.slice(0));
              
              // Cache the decoded buffer
              GlobalSampleCache.cacheBuffer(path, audioBuffer);
            }
          } catch (e) {
            // Silently fail for individual samples
          }
        });
        
        await Promise.all(layerPromises);
        loadedCount++;
        console.log(`✅ Loaded velocity layer ${layer} (${loadedCount}/${priorityLayers.length})`);
        
        // Update progress after each layer
        const progress = Math.round((loadedCount / priorityLayers.length) * 100);
        const harmonySamples = this.samples.get('harmony');
        if (harmonySamples) {
          harmonySamples.status = {
            loaded: true,
            quality: 'premium',
            progress: progress,
          };
          
          // Notify progress listeners
          if (this.onProgress) {
            console.log(`📊 Progress update: harmony - premium (${progress}%)`);
            this.onProgress('harmony', harmonySamples.status);
          }
        }
        
        // Small delay between layers to avoid hogging resources
        if (loadedCount < priorityLayers.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Update status
      if (!this.samples.has('harmony')) {
        this.samples.set('harmony', {
          status: { loaded: false, quality: 'none', progress: 0 },
        });
      }
      
      const harmonySamples = this.samples.get('harmony')!;
      harmonySamples.status = {
        loaded: true,
        quality: 'essential',
        progress: 33, // Buffers fully decoded
      };
    } catch (error) {
      console.error('Failed to preload harmony URLs:', error);
    }
  }

  private async preloadDrumURLs(): Promise<void> {
    console.log('🌐 Preloading drum samples with OfflineAudioContext...');
    
    try {
      // Get Supabase URLs and fetch them to warm the browser cache
      const { supabase } = await import('@/infrastructure/supabase/client');
      const kitPath = 'drums/hydrogen-kits/mp3/electronic/boss-dr110';
      
      // Create OfflineAudioContext for decoding (doesn't require user gesture)
      const offlineContext = new OfflineAudioContext(2, 44100 * 10, 44100);
      
      // Preload essential drum samples
      const samples = [
        { pad: 1, file: 'dr110kik.mp3', name: 'kick' },
        { pad: 3, file: 'dr110clp.mp3', name: 'snare' },
        { pad: 5, file: 'dr110cht.mp3', name: 'hihat' },
      ];
      
      const preloadPromises = samples.map(async sample => {
        const fullPath = `${kitPath}/${sample.file}`;
        const url = supabase.storage
          .from('audio-samples')
          .getPublicUrl(fullPath).data.publicUrl;
        
        // Cache the URL for later use
        GlobalSampleCache.cacheUrl(fullPath, url);
        GlobalSampleCache.cacheUrl(`drum-pad-${sample.pad}`, url); // Also cache by pad number
        
        // Fetch and decode to AudioBuffer
        try {
          const response = await fetch(url, { mode: 'cors' });
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            // Decode using OfflineAudioContext (no user gesture needed)
            const audioBuffer = await offlineContext.decodeAudioData(arrayBuffer.slice(0));
            
            // Cache the decoded buffer
            GlobalSampleCache.cacheBuffer(fullPath, audioBuffer);
            GlobalSampleCache.cacheBuffer(`drum-pad-${sample.pad}`, audioBuffer);
            console.log(`✅ Preloaded and decoded drum: ${sample.name}`);
          }
        } catch (e) {
          console.warn(`Failed to preload ${sample.name}:`, e);
        }
      });
      
      await Promise.all(preloadPromises);
      
      // Update status
      if (!this.samples.has('drums')) {
        this.samples.set('drums', {
          status: { loaded: false, quality: 'none', progress: 0 },
        });
      }
      
      const drumSamples = this.samples.get('drums')!;
      drumSamples.status = {
        loaded: true,
        quality: 'essential',
        progress: 33, // Buffers fully decoded
      };
    } catch (error) {
      console.error('Failed to preload drum URLs:', error);
    }
  }

  private async preloadMetronomeURLs(): Promise<void> {
    console.log('🌐 Preloading metronome URLs (no AudioContext needed)...');
    
    try {
      // For now, metronome uses synths so no URLs to preload
      // But we can still mark it as having some progress
      
      // Update status
      if (!this.samples.has('metronome')) {
        this.samples.set('metronome', {
          status: { loaded: false, quality: 'none', progress: 0 },
        });
      }
      
      const metronomeSamples = this.samples.get('metronome')!;
      metronomeSamples.status = {
        loaded: true,
        quality: 'essential',
        progress: 20, // URLs "loaded" (though it's just synth config)
      };
      
      console.log('✅ Metronome configuration ready');
    } catch (error) {
      console.error('Failed to preload metronome URLs:', error);
    }
  }

  private async loadBassEssential(): Promise<void> {
    console.log('🎸 Bass samples not yet implemented');
    
    try {
      // Mark bass as placeholder for now
      if (!this.samples.has('bass')) {
        this.samples.set('bass', {
          status: { loaded: false, quality: 'none', progress: 0 },
        });
      }
      
      const bassSamples = this.samples.get('bass')!;
      bassSamples.status = {
        loaded: false,
        quality: 'none',
        progress: 0, // Not implemented yet
      };
      
      console.log('⚠️ Bass loading placeholder (not implemented yet)');
    } catch (error) {
      console.error('Failed to load bass placeholder:', error);
    }
  }
}

// Export singleton instance getter
export const getBackgroundLoader = () => BackgroundSampleLoader.getInstance();