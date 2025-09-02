/**
 * Initial Sample Preloader
 *
 * Preloads and decodes audio samples on page load using OfflineAudioContext
 * to avoid any delays when user clicks play. This runs before any user
 * interaction is required.
 */

import { GlobalSampleCache } from './storage/GlobalSampleCache.js';
import { createStructuredLogger } from '@bassnotion/contracts';
import * as Tone from 'tone';
import { wamPluginSingleton } from '@/domains/widgets/utils/wamPluginSingleton.js';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

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
  private harmonyInstrument: any = null; // WamKeyboard instance
  private drumInstrument: any = null; // WamDrummer instance

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
   * Load only essential samples for basic functionality
   * Called on first user interaction (like scroll)
   * IMPORTANT: This should NOT start AudioContext, only download samples
   */
  async loadEssentialSamples(): Promise<void> {
    if (this.isPreloading) {
      logger.info('⏭️ Essential sample loading already in progress');
      return;
    }

    logger.info('🚀 Phase 2: Downloading essential samples (AudioContext not required)...');
    
    // Check if AudioEngine exists first
    const coreServices = (window as any).__globalCoreServices || (window as any).__coreServices;
    const audioEngine = coreServices?.getAudioEngine?.();
    
    // Check AudioEngine readiness but DON'T try to start it
    // Scroll is not a valid user gesture for audio context
    let audioEngineReady = false;
    if (audioEngine?.isReady()) {
      audioEngineReady = true;
      logger.info('  → AudioEngine already ready');
      try {
        const contextState = audioEngine.getContext()?.state || 'unknown';
        logger.info('  → AudioContext state:', contextState);
      } catch (contextError) {
        logger.warn('  → Could not get AudioContext state:', contextError);
        audioEngineReady = false;
      }
    } else {
      logger.info('  → AudioEngine not ready, skipping context check');
    }
    logger.info('  → Creating instruments with preloaded samples...');
    this.isPreloading = true;

    try {
      // Create OfflineAudioContext for decoding (no user gesture needed)
      const offlineContext = new OfflineAudioContext(2, 44100 * 10, 44100);

      // Load essential samples AND create instruments
      await Promise.all([
        this.loadEssentialHarmonyInstrument(), // Creates instrument with essential samples
        this.loadEssentialDrumInstrument(), // Creates drum instruments with essential samples
        this.loadEssentialMetronomeInstrument(), // Creates metronome instrument with samples
      ]);

      logger.info('✅ Essential samples loaded!');
      
      // Log cache stats
      const stats = GlobalSampleCache.getStats();
      logger.info('📊 GlobalSampleCache stats:', {
        instruments: stats.instrumentsCount,
        samples: stats.samplesCount,
        totalCached: stats.totalSize
      });

      // Dispatch event to notify that essential samples are ready
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('essentialSamplesReady'));
      }
    } catch (error) {
      logger.error('❌ Failed to load essential samples:', error);
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * Load all remaining samples for full quality
   * Called when ExerciseSelector becomes visible
   */
  async loadFullSamples(): Promise<void> {
    // DISABLED - Using essential samples only for debugging
    logger.info('🚀 Phase 3: DISABLED - Using essential samples only');
    logger.info('  → Skipping full quality sample loading to debug audio chain issues');
    logger.info('  → Essential samples should be sufficient for testing harmony output');
    return;

    /* Commented out for debugging
    try {
      // Load remaining samples into existing instruments
      await Promise.all([
        this.loadFullHarmonyInstrument(), // Adds remaining layers to existing instrument
        // TODO: Add loadFullDrumInstrument() when we need more drum samples
        // TODO: Add loadFullBassInstrument() when bass is implemented
      ]);

      this.preloadComplete = true;
      logger.info('✅ Full sample preloading complete!');
      
      // Log final cache stats
      const stats = GlobalSampleCache.getStats();
      logger.info('📊 Final GlobalSampleCache stats:', {
        instruments: stats.instrumentsCount,
        samples: stats.samplesCount,
        totalCached: stats.totalSize,
        memoryInfo: GlobalSampleCache.getCacheStats()
      });

      // Dispatch event to notify that all samples are ready
      if (typeof window !== 'undefined') {
        (window as any).__samplesPreloaded = true;
        window.dispatchEvent(new Event('samplesPreloaded'));
      }
    } catch (error) {
      logger.error('❌ Failed to load full samples:', error);
    }
    */
  }

  /**
   * Start preloading samples immediately on page load
   * Uses OfflineAudioContext which doesn't require user gesture
   * @deprecated Use loadEssentialSamples() and loadFullSamples() instead
   */
  async startPreloading(): Promise<void> {
    if (this.isPreloading || this.preloadComplete) {
      logger.info('⏭️ Sample preloading already started or complete');
      return;
    }

    logger.info(
      '🚀 Starting initial sample preloading (no user gesture required)...',
    );
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
      logger.info('✅ Initial sample preloading complete!');

      // Dispatch event to notify that samples are ready
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('samplesPreloaded'));
      }
    } catch (error) {
      logger.error('❌ Failed to preload samples:', error);
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * Load only essential harmony samples (v10 layer, critical notes)
   */
  /**
   * Create harmony instrument and load essential samples
   * This creates the WamKeyboard instance with initial samples
   */
  private async loadEssentialHarmonyInstrument(): Promise<void> {
    logger.info('🎹 Creating harmony instrument with essential samples...');
    
    try {
      // Step 1: Check if CoreServices are available
      const coreServices = (window as any).__globalCoreServices || (window as any).__coreServices;
      if (!coreServices) {
        logger.info('CoreServices not ready yet, falling back to URL caching only');
        const offlineContext = new OfflineAudioContext(2, 44100 * 10, 44100);
        return this.loadEssentialHarmonySamples(offlineContext);
      }
      
      // Step 2: Check if AudioEngine is ready
      const audioEngine = coreServices.getAudioEngine?.();
      if (!audioEngine || !audioEngine.isReady()) {
        logger.info('AudioEngine not ready, falling back to URL caching only');
        const offlineContext = new OfflineAudioContext(2, 44100 * 10, 44100);
        return this.loadEssentialHarmonySamples(offlineContext);
      }
      
      // Step 3: Get AudioContext from AudioEngine - this is now persistent!
      const context = audioEngine.getContext();
      logger.info(`🎹 Phase 2 - AudioContext check:`, {
        hasContext: !!context,
        contextState: context?.state,
        contextType: context?.constructor?.name,
        isOffline: context instanceof OfflineAudioContext
      });
      
      if (!context || context.state !== 'running') {
        logger.info(`AudioContext state: ${context?.state || 'null'}, falling back to URL caching`);
        // DON'T try to resume during scroll - not a valid user gesture
        // Just fall back to URL caching which will download samples
        const offlineContext = new OfflineAudioContext(2, 44100 * 10, 44100);
        return this.loadEssentialHarmonySamples(offlineContext);
      }
      
      // Step 4: Create WamKeyboard instance through singleton
      logger.info('AudioContext is running! Creating WamKeyboard instance for preloading...');
      this.harmonyInstrument = await wamPluginSingleton.getOrCreateKeyboardPlugin(context);
      
      // Connect to destination if needed
      if (this.harmonyInstrument.audioNode && !this.harmonyInstrument.audioNode.isConnected) {
        this.harmonyInstrument.audioNode.connect(context.destination);
        logger.info('Connected harmony instrument to destination');
      }
      
      // The WamKeyboard will load its default samples automatically
      logger.info('🎹 Harmony instrument created, samples downloading in background...');
      
      // Store in global cache immediately so widgets can access it
      GlobalSampleCache.cacheInstrument('harmony-preloaded', this.harmonyInstrument);
      logger.info('✅ Instrument cached in GlobalSampleCache as "harmony-preloaded"');
      
      // Start monitoring download progress but DON'T WAIT
      // This allows scroll trigger to complete quickly while downloads continue
      if (this.harmonyInstrument.audioNode && this.harmonyInstrument.audioNode.hasInstrumentLoaded()) {
        // Monitor v10 layer specifically since it's needed for test button
        setTimeout(async () => {
          const audioNode = this.harmonyInstrument.audioNode;
          if (audioNode.activeSampler) {
            const sampler = audioNode.activeSampler;
            if (sampler.samplers && sampler.samplers.has('v10')) {
              const v10Sampler = sampler.samplers.get('v10');
              if (v10Sampler && v10Sampler.loaded) {
                try {
                  await v10Sampler.loaded;
                  logger.info('✅ Priority layer v10 loaded - test button ready!');
                } catch (err) {
                  logger.debug('v10 layer still loading...');
                }
              }
            }
          }
        }, 100); // Check after 100ms
      }
      
    } catch (error) {
      logger.error('Failed to create harmony instrument:', error);
      // Fall back to traditional loading
      const offlineContext = new OfflineAudioContext(2, 44100 * 10, 44100);
      return this.loadEssentialHarmonySamples(offlineContext);
    }
  }
  
  private async loadEssentialHarmonySamples(
    offlineContext: OfflineAudioContext,
  ): Promise<void> {
    logger.info('🎹 Loading essential harmony samples...');

    try {
      const { supabase } = await import('@/infrastructure/supabase/client');

      // Load v10 (medium velocity) layer with ALL notes
      const layer = 'v10';
      const essentialNotes = [
        'A0',
        'C1',
        'Ds1',
        'Fs1',
        'A1',
        'C2',
        'Ds2',
        'Fs2',
        'A2',
        'C3',
        'Ds3',
        'Fs3',
        'A3',
        'C4',
        'Ds4',
        'Fs4',
        'A4',
        'C5',
        'Ds5',
        'Fs5',
        'A5',
        'C6',
        'Ds6',
        'Fs6',
        'A6',
        'C7',
        'Ds7',
        'Fs7',
        'A7',
        'C8',
      ];

      const loadPromises = essentialNotes.map(async (note) => {
        const path = `Keyboards/salamander/${layer}/${note}.mp3`;
        const url = supabase.storage.from('audio-samples').getPublicUrl(path)
          .data.publicUrl;

        // Cache URL
        GlobalSampleCache.cacheUrl(path, url);
        GlobalSampleCache.cacheUrl(`piano-${layer}-${note}`, url);

        try {
          const response = await fetch(url, { mode: 'cors' });
          if (!response.ok) throw new Error(`Failed to fetch ${note}`);

          const arrayBuffer = await response.arrayBuffer();

          // Just verify we can decode it, but don't cache the buffer
          // because it's decoded with OfflineAudioContext, not Tone's context
          const audioBuffer = await offlineContext.decodeAudioData(
            arrayBuffer.slice(0),
          );

          // DON'T cache the decoded buffer - it won't work with Tone.js!
          // Only the URL is cached above
          // GlobalSampleCache.cacheBuffer(path, audioBuffer);
          // GlobalSampleCache.cacheBuffer(`piano-${layer}-${note}`, audioBuffer);

          logger.info(
            `  ✓ Essential harmony: ${layer}/${note} verified (${audioBuffer.duration.toFixed(2)}s)`,
          );
        } catch (error) {
          logger.warn(`  ✗ Failed to load essential ${note}:`, error);
        }
      });

      await Promise.all(loadPromises);
      logger.info('✅ Essential harmony samples loaded');
    } catch (error) {
      logger.error('Failed to load essential harmony samples:', error);
    }
  }

  /**
   * Load essential drum samples (kick, snare, hihat only)
   */
  /**
   * Create drum instrument and load essential samples
   * This creates Tone.Player instances for kick, snare, and hihat
   */
  private async loadEssentialDrumInstrument(): Promise<void> {
    logger.info('🥁 Creating drum instrument with essential samples...');
    
    try {
      // Step 1: Check if CoreServices are available
      const coreServices = (window as any).__globalCoreServices || (window as any).__coreServices;
      if (!coreServices) {
        logger.info('CoreServices not ready yet, falling back to URL caching only');
        const offlineContext = new OfflineAudioContext(2, 44100 * 10, 44100);
        return this.loadEssentialDrumSamples(offlineContext);
      }
      
      // Step 2: Check if AudioEngine is ready
      const audioEngine = coreServices.getAudioEngine?.();
      if (!audioEngine || !audioEngine.isReady()) {
        logger.info('AudioEngine not ready, falling back to URL caching only');
        const offlineContext = new OfflineAudioContext(2, 44100 * 10, 44100);
        return this.loadEssentialDrumSamples(offlineContext);
      }
      
      // Step 3: Get Tone.js from AudioEngine first
      const ToneInstance = audioEngine.getTone();
      if (!ToneInstance) {
        logger.info('Tone.js not available, falling back to URL caching');
        const offlineContext = new OfflineAudioContext(2, 44100 * 10, 44100);
        return this.loadEssentialDrumSamples(offlineContext);
      }
      
      // Step 4: Use Tone's context to ensure compatibility
      const context = ToneInstance.context;
      if (!context || context.state !== 'running') {
        logger.info(`Tone context state: ${context?.state || 'null'}, will create drums on demand`);
        const offlineContext = new OfflineAudioContext(2, 44100 * 10, 44100);
        return this.loadEssentialDrumSamples(offlineContext);
      }
      
      // Step 5: Create drum samplers
      logger.info('AudioContext is running! Creating drum samplers...');
      const { supabase } = await import('@/infrastructure/supabase/client');
      const kitPath = 'drums/hydrogen-kits/mp3/electronic/boss-dr110';
      
      const drumPads: Record<number, any> = {};
      const essentialDrums = [
        { pad: 1, file: 'dr110kik.mp3', name: 'kick' },
        { pad: 3, file: 'dr110clp.mp3', name: 'snare' },
        { pad: 5, file: 'dr110cht.mp3', name: 'hihat' },
      ];
      
      // Create Players for each drum
      const loadPromises: Promise<void>[] = [];
      
      for (const drum of essentialDrums) {
        const url = supabase.storage.from('audio-samples')
          .getPublicUrl(`${kitPath}/${drum.file}`).data.publicUrl;
        
        logger.info(`Loading drum pad ${drum.pad} (${drum.name}): ${url}`);
        
        // Create a promise that resolves when this drum is loaded
        const loadPromise = new Promise<void>((resolve, reject) => {
          drumPads[drum.pad] = new ToneInstance.Player({
            url,
            volume: -10, // Reasonable default volume
            onload: () => {
              logger.info(`✅ Drum pad ${drum.pad} (${drum.name}) loaded`);
              resolve();
            },
            onerror: (error: any) => {
              logger.error(`❌ Failed to load drum pad ${drum.pad} (${drum.name}):`, error);
              reject(error);
            }
          }).toDestination();
        });
        
        loadPromises.push(loadPromise);
      }
      
      // Wait for all drums to load individually
      try {
        await Promise.all(loadPromises);
        logger.info('✅ All drum samples loaded successfully');
      } catch (error) {
        logger.error('Failed to load some drum samples:', error);
        // Continue anyway - some drums might have loaded
      }
      
      // Store in global cache for widgets to access
      GlobalSampleCache.cacheInstrument('drums-preloaded', drumPads);
      logger.info('✅ Drums cached in GlobalSampleCache as "drums-preloaded"');
      
      // Also store for legacy compatibility
      this.drumInstrument = drumPads;
      
    } catch (error) {
      logger.error('Failed to create drum instrument:', error);
      // Fall back to traditional loading
      const offlineContext = new OfflineAudioContext(2, 44100 * 10, 44100);
      return this.loadEssentialDrumSamples(offlineContext);
    }
  }
  
  private async loadEssentialDrumSamples(
    offlineContext: OfflineAudioContext,
  ): Promise<void> {
    logger.info('🥁 Loading essential drum samples...');

    try {
      const { supabase } = await import('@/infrastructure/supabase/client');
      const kitPath = 'drums/hydrogen-kits/mp3/electronic/boss-dr110';

      const essentialDrums = [
        { pad: 1, file: 'dr110kik.mp3', name: 'kick' },
        { pad: 3, file: 'dr110clp.mp3', name: 'snare' },
        { pad: 5, file: 'dr110cht.mp3', name: 'hihat' },
      ];

      const loadPromises = essentialDrums.map(async (sample) => {
        const fullPath = `${kitPath}/${sample.file}`;
        const url = supabase.storage
          .from('audio-samples')
          .getPublicUrl(fullPath).data.publicUrl;

        GlobalSampleCache.cacheUrl(fullPath, url);
        GlobalSampleCache.cacheUrl(`drum-pad-${sample.pad}`, url);

        try {
          const response = await fetch(url, { mode: 'cors' });
          if (!response.ok) throw new Error(`Failed to fetch ${sample.name}`);

          const arrayBuffer = await response.arrayBuffer();

          // Just verify we can decode it, but don't cache the buffer
          const audioBuffer = await offlineContext.decodeAudioData(
            arrayBuffer.slice(0),
          );

          // DON'T cache the decoded buffer - it won't work with Tone.js!
          // GlobalSampleCache.cacheBuffer(fullPath, audioBuffer);
          // GlobalSampleCache.cacheBuffer(`drum-pad-${sample.pad}`, audioBuffer);

          logger.info(
            `  ✓ Essential drum: ${sample.name} verified (${audioBuffer.duration.toFixed(2)}s)`,
          );
        } catch (error) {
          logger.warn(`  ✗ Failed to load drum ${sample.name}:`, error);
        }
      });

      await Promise.all(loadPromises);
      logger.info('✅ Essential drum samples loaded');
    } catch (error) {
      logger.error('Failed to load essential drum samples:', error);
    }
  }

  /**
   * Create metronome instrument and load samples
   * This creates the WamMetronome instance with samples loaded
   */
  private async loadEssentialMetronomeInstrument(): Promise<void> {
    logger.info('🔔 Creating metronome instrument with essential samples...');
    
    try {
      // Step 1: Check if CoreServices are available
      const coreServices = (window as any).__globalCoreServices || (window as any).__coreServices;
      if (!coreServices) {
        logger.info('CoreServices not ready yet, falling back to URL caching only');
        const offlineContext = new OfflineAudioContext(2, 44100 * 10, 44100);
        return this.loadEssentialMetronomeSamples(offlineContext);
      }
      
      // Step 2: Check if AudioEngine is ready
      const audioEngine = coreServices.getAudioEngine?.();
      if (!audioEngine || !audioEngine.isReady()) {
        logger.info('AudioEngine not ready, falling back to URL caching only');
        const offlineContext = new OfflineAudioContext(2, 44100 * 10, 44100);
        return this.loadEssentialMetronomeSamples(offlineContext);
      }
      
      // Step 3: Get AudioContext from AudioEngine
      const context = audioEngine.getContext();
      if (!context || context.state !== 'running') {
        logger.info(`AudioContext state: ${context?.state || 'null'}, falling back to URL caching`);
        const offlineContext = new OfflineAudioContext(2, 44100 * 10, 44100);
        return this.loadEssentialMetronomeSamples(offlineContext);
      }
      
      // Step 4: Create WamMetronome instance
      logger.info('AudioContext is running! Creating WamMetronome instance...');
      const { default: WamMetronome } = await import('@/domains/playback/modules/instruments/adapters/wam/WamMetronome');
      
      // Create the metronome plugin
      const metronomePlugin = await WamMetronome.createInstance(context);
      
      // Create audio node - this will load the default sample
      await metronomePlugin.createAudioNode();
      
      // Connect to destination
      if (metronomePlugin.audioNode) {
        metronomePlugin.audioNode.connect(context.destination);
        logger.info('Connected metronome to destination');
      }
      
      // The WamMetronome loads its default sample automatically
      logger.info('✅ Metronome instrument created with samples');
      
      // Store in global cache for widgets to access
      GlobalSampleCache.cacheInstrument('metronome-preloaded', metronomePlugin);
      logger.info('✅ Metronome cached in GlobalSampleCache as "metronome-preloaded"');
      
    } catch (error) {
      logger.error('Failed to create metronome instrument:', error);
      // Fall back to traditional loading
      const offlineContext = new OfflineAudioContext(2, 44100 * 10, 44100);
      return this.loadEssentialMetronomeSamples(offlineContext);
    }
  }

  /**
   * Load essential metronome samples (fallback)
   */
  private async loadEssentialMetronomeSamples(
    offlineContext: OfflineAudioContext,
  ): Promise<void> {
    logger.info('🔔 Loading essential metronome samples...');

    try {
      const { supabase } = await import('@/infrastructure/supabase/client');

      const samples = [
        { name: 'click_hi', file: 'metronome/Clicks_03.mp3' }, // High pitched
        { name: 'click_lo', file: 'metronome/Clicks_01.mp3' }, // Low pitched
      ];

      const loadPromises = samples.map(async (sample) => {
        const url = supabase.storage
          .from('audio-samples')
          .getPublicUrl(sample.file).data.publicUrl;

        GlobalSampleCache.cacheUrl(sample.file, url);
        GlobalSampleCache.cacheUrl(`metronome-${sample.name}`, url);

        try {
          const response = await fetch(url, { mode: 'cors' });
          if (!response.ok) throw new Error(`Failed to fetch ${sample.name}`);

          const arrayBuffer = await response.arrayBuffer();

          // Just verify we can decode it, but don't cache the buffer
          const audioBuffer = await offlineContext.decodeAudioData(
            arrayBuffer.slice(0),
          );

          // DON'T cache the decoded buffer - it won't work with Tone.js!
          // GlobalSampleCache.cacheBuffer(sample.file, audioBuffer);
          // GlobalSampleCache.cacheBuffer(`metronome-${sample.name}`, audioBuffer);

          logger.info(
            `  ✓ Essential metronome: ${sample.name} verified (${audioBuffer.duration.toFixed(2)}s)`,
          );
        } catch (error) {
          logger.warn(`  ✗ Failed to load metronome ${sample.name}:`, error);
        }
      });

      await Promise.all(loadPromises);
      logger.info('✅ Essential metronome samples loaded');
    } catch (error) {
      logger.error('Failed to load essential metronome samples:', error);
    }
  }

  /**
   * Load remaining harmony samples into existing instrument
   * This adds the additional velocity layers for full quality
   */
  private async loadFullHarmonyInstrument(): Promise<void> {
    logger.info('🎹 Loading full harmony samples into instrument...');
    
    try {
      // Check if we have a pre-created instrument
      if (!this.harmonyInstrument) {
        // Try to get from cache
        this.harmonyInstrument = GlobalSampleCache.getCachedInstrument('harmony-preloaded');
        
        if (!this.harmonyInstrument) {
          logger.info('No harmony instrument found, falling back to traditional loading');
          const offlineContext = new OfflineAudioContext(2, 44100 * 10, 44100);
          return this.loadFullHarmonySamples(offlineContext);
        }
      }
      
      // The instrument already has default samples loaded
      // In phase 3, we don't need to do anything extra as WamKeyboard
      // loads all velocity layers by default
      logger.info('✅ Harmony instrument already has full samples loaded');
      
    } catch (error) {
      logger.error('Failed to load full harmony samples:', error);
      const offlineContext = new OfflineAudioContext(2, 44100 * 10, 44100);
      return this.loadFullHarmonySamples(offlineContext);
    }
  }
  
  /**
   * Load remaining harmony samples for full quality (legacy)
   */
  private async loadFullHarmonySamples(
    offlineContext: OfflineAudioContext,
  ): Promise<void> {
    logger.info('🎹 Loading full harmony samples...');

    try {
      const { supabase } = await import('@/infrastructure/supabase/client');

      // Load remaining velocity layers to match SalamanderVelocitySampler defaults
      // v10 is already loaded in essential, so load v1, v6, v14, v16
      const remainingLayers = ['v1', 'v6', 'v14', 'v16'];

      // Load ALL 30 samples that SalamanderVelocitySampler expects
      const allNotes = [
        'A0',
        'C1',
        'Ds1',
        'Fs1',
        'A1',
        'C2',
        'Ds2',
        'Fs2',
        'A2',
        'C3',
        'Ds3',
        'Fs3',
        'A3',
        'C4',
        'Ds4',
        'Fs4',
        'A4',
        'C5',
        'Ds5',
        'Fs5',
        'A5',
        'C6',
        'Ds6',
        'Fs6',
        'A6',
        'C7',
        'Ds7',
        'Fs7',
        'A7',
        'C8',
      ];

      const loadPromises: Promise<void>[] = [];

      for (const layer of remainingLayers) {
        for (const note of allNotes) {
          const loadPromise = (async () => {
            const path = `Keyboards/salamander/${layer}/${note}.mp3`;

            // Skip if already cached
            if (GlobalSampleCache.getCachedBuffer(path)) {
              return;
            }

            const url = supabase.storage
              .from('audio-samples')
              .getPublicUrl(path).data.publicUrl;

            GlobalSampleCache.cacheUrl(path, url);
            GlobalSampleCache.cacheUrl(`piano-${layer}-${note}`, url);

            try {
              const response = await fetch(url, { mode: 'cors' });
              if (!response.ok)
                throw new Error(`Failed to fetch ${layer}/${note}`);

              const arrayBuffer = await response.arrayBuffer();
              const audioBuffer = await offlineContext.decodeAudioData(
                arrayBuffer.slice(0),
              );

              // DON'T cache the decoded buffer - it won't work with Tone.js!
              // GlobalSampleCache.cacheBuffer(path, audioBuffer);
              // GlobalSampleCache.cacheBuffer(`piano-${layer}-${note}`, audioBuffer);

              logger.info(
                `  ✓ Full harmony: ${layer}/${note} verified (${audioBuffer.duration.toFixed(2)}s)`,
              );
            } catch (error) {
              // Silently skip missing samples
            }
          })();

          loadPromises.push(loadPromise);
        }
      }

      // Load in batches to avoid overwhelming the browser
      const batchSize = 10;
      for (let i = 0; i < loadPromises.length; i += batchSize) {
        const batch = loadPromises.slice(i, i + batchSize);
        await Promise.all(batch);

        // Use requestIdleCallback if available
        if ('requestIdleCallback' in window) {
          await new Promise((resolve) => requestIdleCallback(resolve));
        } else {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }

      logger.info('✅ Full harmony samples loaded');
    } catch (error) {
      logger.error('Failed to load full harmony samples:', error);
    }
  }

  /**
   * Preload drum samples
   * @deprecated Use loadEssentialDrumSamples() instead
   */
  private async preloadDrumSamples(
    offlineContext: OfflineAudioContext,
  ): Promise<void> {
    logger.info('🥁 Preloading drum samples...');

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
          const audioBuffer = await offlineContext.decodeAudioData(
            arrayBuffer.slice(0),
          );

          // DON'T cache the decoded buffer - it won't work with Tone.js!
          // GlobalSampleCache.cacheBuffer(fullPath, audioBuffer);
          // GlobalSampleCache.cacheBuffer(`drum-pad-${sample.pad}`, audioBuffer);

          logger.info(
            `  ✓ Preloaded drum: ${sample.name} verified (${audioBuffer.duration.toFixed(2)}s)`,
          );
        } catch (error) {
          logger.warn(`  ✗ Failed to preload drum ${sample.name}:`, error);
        }
      });

      await Promise.all(loadPromises);
      logger.info('✅ Drum samples preloaded');
    } catch (error) {
      logger.error('Failed to preload drum samples:', error);
    }
  }

  /**
   * Preload harmony/piano samples AND create Tone.js Samplers
   */
  private async preloadHarmonySamples(
    offlineContext: OfflineAudioContext,
  ): Promise<void> {
    logger.info('🎹 Preloading harmony samples and creating samplers...');

    try {
      const { supabase } = await import('@/infrastructure/supabase/client');

      // Preload essential piano notes for all 4 velocity layers
      // Salamander piano uses sparse sampling: C, Ds, Fs, A per octave
      const velocityLayers = ['v1', 'v8', 'v10', 'v16']; // pp, mf, f, ff
      const notePatterns = [
        'C1',
        'Ds1',
        'Fs1',
        'A1',
        'C2',
        'Ds2',
        'Fs2',
        'A2',
        'C3',
        'Ds3',
        'Fs3',
        'A3',
        'C4',
        'Ds4',
        'Fs4',
        'A4',
        'C5',
        'Ds5',
        'Fs5',
        'A5',
        'C6',
        'Ds6',
        'Fs6',
        'A6',
        'C7',
        'Ds7',
        'Fs7',
        'A7',
      ];

      const loadPromises: Promise<void>[] = [];

      // Load samples for each velocity layer
      for (const layer of velocityLayers) {
        for (const note of notePatterns) {
          const loadPromise = (async () => {
            const path = `Keyboards/salamander/${layer}/${note}.mp3`;
            const url = supabase.storage
              .from('audio-samples')
              .getPublicUrl(path).data.publicUrl;

            // Cache URL with layer info
            GlobalSampleCache.cacheUrl(path, url);
            GlobalSampleCache.cacheUrl(`piano-${layer}-${note}`, url);

            try {
              // Fetch the audio data
              const response = await fetch(url, { mode: 'cors' });
              if (!response.ok)
                throw new Error(`Failed to fetch ${layer}/${note}`);

              const arrayBuffer = await response.arrayBuffer();

              // Decode using OfflineAudioContext (no user gesture needed)
              const audioBuffer = await offlineContext.decodeAudioData(
                arrayBuffer.slice(0),
              );

              // Cache the decoded buffer
              // DON'T cache the decoded buffer - it won't work with Tone.js!
              // GlobalSampleCache.cacheBuffer(path, audioBuffer);
              // GlobalSampleCache.cacheBuffer(`piano-${layer}-${note}`, audioBuffer);

              logger.info(
                `  ✓ Preloaded piano: ${layer}/${note} verified (${audioBuffer.duration.toFixed(2)}s)`,
              );
            } catch (error) {
              // Don't warn for every missing sample, this is expected
              // Salamander doesn't have all notes in all layers
            }
          })();

          loadPromises.push(loadPromise);
        }
      }

      await Promise.all(loadPromises);
      logger.info('✅ Harmony samples preloaded');
    } catch (error) {
      logger.error('Failed to preload harmony samples:', error);
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
      cacheStats: GlobalSampleCache.getStats(),
    };
  }
}

// Export singleton getter
export const getSamplePreloader = () => InitialSamplePreloader.getInstance();

/**
 * Get pre-loaded harmony instrument if available
 */
export function getPreloadedHarmonyInstrument(): any {
  return GlobalSampleCache.getCachedInstrument('harmony-preloaded');
}
