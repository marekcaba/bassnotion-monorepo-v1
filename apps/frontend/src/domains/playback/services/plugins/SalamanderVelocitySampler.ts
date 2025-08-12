/**
 * Professional 16-velocity Salamander Grand Piano sampler
 * Optimized for performance with lazy loading and memory management
 */

import { loadGlobalTone } from './toneLoader';

// Use global Tone instance to ensure same AudioContext
let Tone: any = null;

export interface VelocityRange {
  min: number;
  max: number;
  layer: string;
}

// Helper to ensure Tone.js is loaded from global instance
async function ensureToneLoaded(preferredContext?: AudioContext): Promise<void> {
  if (!Tone || preferredContext) {
    Tone = await loadGlobalTone(preferredContext);
    console.log('🎵 Using global Tone.js instance in SalamanderVelocitySampler', {
      context: Tone?.context,
      contextState: Tone?.context?.state,
      contextTime: Tone?.context?.currentTime,
      preferredContext: preferredContext,
    });
  }
}

// Helper to sync Tone.js context with a provided AudioContext
function syncToneContext(audioContext?: BaseAudioContext): void {
  if (!Tone || !audioContext) return;
  
  // Check if contexts are different
  const toneContext = Tone.context?._context || Tone.context;
  if (toneContext !== audioContext) {
    console.log('🎹 Syncing Tone.js context with provided AudioContext');
    try {
      Tone.setContext(audioContext);
      console.log('✅ Tone.js context synchronized');
    } catch (error) {
      console.error('❌ Failed to sync Tone.js context:', error);
    }
  }
}

// Helper to safely connect Tone.js nodes
function safeConnect(source: any, destination: any, label?: string): boolean {
  try {
    // Validate source
    if (!source || typeof source.connect !== 'function') {
      console.error(`Invalid source for connection ${label || ''}:`, source);
      return false;
    }

    // Validate destination
    if (!destination) {
      console.error(
        `Invalid destination (null/undefined) for connection ${label || ''}`,
      );
      return false;
    }

    // Check if Tone is loaded
    if (!Tone) {
      console.error('Tone.js not loaded, cannot check node types');
      return false;
    }

    // Special handling for Tone.js Volume nodes - they might be disposed
    if (destination?.constructor?.name === 'Volume') {
      // Check if the Volume node is disposed
      if (destination.disposed === true) {
        console.error(
          `Destination Volume node is disposed for connection ${label || ''}`,
        );
        return false;
      }
      // Volume nodes are valid destinations
      source.connect(destination);
      return true;
    }

    // Check if destination is a valid audio node
    const isValidDest =
      destination === Tone?.Destination ||
      (destination?.constructor &&
        destination.constructor.name?.includes('ToneAudioNode')) ||
      (destination &&
        typeof destination === 'object' &&
        (destination.input ||
          destination._internalChannels ||
          destination.numberOfInputs !== undefined));

    if (!isValidDest) {
      console.error(`Invalid destination type for connection ${label || ''}:`, {
        destination,
        constructor: destination?.constructor?.name,
        hasInput: !!destination?.input,
        type: typeof destination,
      });
      return false;
    }

    // Debug: Check AudioContext before connecting
    const sourceContext = source.context || source._context;
    const destContext = destination.context || destination._context;
    
    if (sourceContext && destContext && sourceContext !== destContext) {
      // Check if it's Tone.js Context vs native AudioContext
      const isSourceTone = sourceContext?.constructor?.name === 'Context';
      const isDestNative = destContext instanceof AudioContext;
      
      if (isSourceTone && isDestNative) {
        // This is expected when connecting Tone.js nodes to native Web Audio
        // Tone.js wraps the native context, so the underlying context should match
        const toneInternalContext = sourceContext._context || sourceContext.rawContext;
        if (toneInternalContext === destContext) {
          // The underlying contexts match, proceed with connection
          console.log(`✅ Tone.js wrapper detected, underlying contexts match for ${label}`);
        } else {
          console.error(`❌ AudioContext mismatch in ${label || 'connection'} - contexts are truly different`);
          return false;
        }
      } else {
        console.error(`AudioContext mismatch in ${label || 'connection'}:`, {
          sourceContext: sourceContext,
          destContext: destContext,
          sourceType: sourceContext?.constructor?.name,
          destType: destContext?.constructor?.name,
        });
        return false;
      }
    }
    
    // Attempt connection
    source.connect(destination);
    return true;
  } catch (error) {
    console.error(`Failed to connect ${label || 'nodes'}:`, error);
    return false;
  }
}

export class SalamanderVelocitySampler {
  private samplers: Map<string, any> = new Map(); // Will be Tone.Sampler
  private velocityRanges: VelocityRange[] = [];
  private loadedLayers: Set<string> = new Set();
  private isInitialized = false;
  private loadingPromises: Map<string, Promise<void>> = new Map();
  private destination: any | null = null; // Will be Tone.InputNode
  private damperReleaseSampler: any | null = null; // Will be Tone.Player
  private mechanicalVolumeDb = -10; // Base volume for mechanical sounds in dB
  private damperReleaseOffset = 0; // Play immediately when note ends
  private activeNotes: Map<string, number> = new Map(); // Track active notes and their velocities
  private volumeWasMuted = false; // Track if volume was muted by panic
  // Use Supabase samples
  private useLocalSamples = false;
  private localSamplesPath = '/samples/salamander-mp3';
  private supabaseUrl =
    'https://htuztkrbuewheehjspcz.supabase.co/storage/v1/object/public/audio-samples';
  private preferredContext: AudioContext | null = null; // Store the preferred AudioContext

  // Sample mapping for all layers
  // Using exact file names as they are in the directory
  private readonly sampleMapping = {
    A0: 'A0.mp3',
    C1: 'C1.mp3',
    Eb1: 'Ds1.mp3', // Tone.js prefers flats
    Gb1: 'Fs1.mp3',
    A1: 'A1.mp3',
    C2: 'C2.mp3',
    Eb2: 'Ds2.mp3',
    Gb2: 'Fs2.mp3',
    A2: 'A2.mp3',
    C3: 'C3.mp3',
    Eb3: 'Ds3.mp3',
    Gb3: 'Fs3.mp3',
    A3: 'A3.mp3',
    C4: 'C4.mp3',
    Eb4: 'Ds4.mp3',
    Gb4: 'Fs4.mp3',
    A4: 'A4.mp3',
    C5: 'C5.mp3',
    Eb5: 'Ds5.mp3',
    Gb5: 'Fs5.mp3',
    A5: 'A5.mp3',
    C6: 'C6.mp3',
    Eb6: 'Ds6.mp3',
    Gb6: 'Fs6.mp3',
    A6: 'A6.mp3',
    C7: 'C7.mp3',
    Eb7: 'Ds7.mp3',
    Gb7: 'Fs7.mp3',
    A7: 'A7.mp3',
    C8: 'C8.mp3',
  };

  /**
   * Set the preferred AudioContext to use for all Tone.js operations
   * This should be called BEFORE initialize()
   */
  setPreferredContext(context: AudioContext): void {
    this.preferredContext = context;
    console.log('🎹 SalamanderVelocitySampler: Preferred AudioContext set');
  }

  constructor() {
    // Initialize velocity ranges
    this.velocityRanges = [
      { min: 0, max: 8, layer: 'v1' },
      { min: 9, max: 16, layer: 'v2' },
      { min: 17, max: 24, layer: 'v3' },
      { min: 25, max: 32, layer: 'v4' },
      { min: 33, max: 40, layer: 'v5' },
      { min: 41, max: 48, layer: 'v6' },
      { min: 49, max: 56, layer: 'v7' },
      { min: 57, max: 64, layer: 'v8' },
      { min: 65, max: 72, layer: 'v9' },
      { min: 73, max: 80, layer: 'v10' },
      { min: 81, max: 88, layer: 'v11' },
      { min: 89, max: 96, layer: 'v12' },
      { min: 97, max: 104, layer: 'v13' },
      { min: 105, max: 112, layer: 'v14' },
      { min: 113, max: 120, layer: 'v15' },
      { min: 121, max: 127, layer: 'v16' },
    ];
  }

  /**
   * Ensure all loaded samplers are ready to play
   */
  async ensureReady(): Promise<void> {
    console.log('🎹 Ensuring all samplers are ready...');
    
    for (const [layer, sampler] of this.samplers) {
      if (sampler) {
        try {
          // Wait for the loaded promise
          await sampler.loaded;
          
          // Verify buffers are actually loaded
          if (!sampler._buffers || sampler._buffers.size === 0) {
            console.warn(`🎹 Layer ${layer} has no buffers after load promise resolved`);
            
            // Wait a bit more for buffers to load
            let retries = 0;
            while ((!sampler._buffers || sampler._buffers.size === 0) && retries < 10) {
              await new Promise(resolve => setTimeout(resolve, 100));
              retries++;
            }
            
            if (!sampler._buffers || sampler._buffers.size === 0) {
              console.error(`🎹 Layer ${layer} still has no buffers after waiting`);
            } else {
              const bufferCount = sampler._buffers ? (sampler._buffers.size || Object.keys(sampler._buffers).length) : 0;
              console.log(`🎹 Layer ${layer} now has ${bufferCount} buffers`);
            }
          } else {
            const bufferCount = sampler._buffers ? (sampler._buffers.size || Object.keys(sampler._buffers).length) : 0;
            console.log(`🎹 Layer ${layer} ready with ${bufferCount} buffers`);
          }
        } catch (err) {
          console.warn(`🎹 Layer ${layer} load failed:`, err);
        }
      }
    }
    
    console.log('🎹 All samplers checked and ready!');
  }

  /**
   * Initialize with commonly used velocity layers
   * Loads v1, v8, v16 by default (pp, mf, ff)
   * @param requiredNotes - If provided, only load these specific notes (smart loading)
   * @param velocityLayers - If provided, only load these velocity layers
   */
  async initialize(requiredNotes?: string[], velocityLayers?: string[]): Promise<void> {
    if (this.isInitialized) return;

    console.log('🎹 Initializing Salamander Grand Piano', {
      smartLoading: !!requiredNotes,
      notesCount: requiredNotes?.length || 'all',
      layers: velocityLayers || 'default'
    });

    // Ensure Tone.js is loaded with the preferred context if available
    await ensureToneLoaded(this.preferredContext || undefined);

    // Check if Tone is available after loading
    if (!Tone || typeof Tone === 'undefined') {
      throw new Error('Tone.js is not loaded');
    }

    // Ensure Tone.js context is started
    try {
      if (!Tone.context) {
        throw new Error('Tone.js context is not initialized');
      }
      if (Tone.context.state !== 'running') {
        await Tone.start();
      }
    } catch (error) {
      console.error('❌ Failed to start Tone.js context:', error);
      throw error;
    }

    // We don't need to initialize a separate mechanical volume node anymore
    // The volume will be calculated and applied directly when playing damper sounds

    // Load damper release sound first
    await this.loadDamperReleaseSound();

    // Determine which layers to load
    let layersToLoad: string[];
    
    if (velocityLayers && velocityLayers.length > 0) {
      // Use provided velocity layers
      layersToLoad = velocityLayers;
    } else {
      // Load optimized velocity layers - only 5 layers for faster loading
      // v1 (pp), v6 (p), v10 (mf), v14 (f), v16 (ff) - good dynamic range
      layersToLoad = [
        'v1',   // pianissimo (velocity 0-8)
        'v6',   // piano (velocity 41-48)
        'v10',  // mezzo-forte (velocity 73-80)
        'v14',  // forte (velocity 105-112)
        'v16',  // fortissimo (velocity 121-127)
      ];
    }

    console.log('🎹 Loading velocity layers:', layersToLoad.join(', '));

    // Load layers with smart loading support
    const loadPromises = layersToLoad.map(async (layer) => {
      try {
        if (requiredNotes && requiredNotes.length > 0) {
          // Smart loading: only load specific notes
          console.log(`🎹 Smart loading layer ${layer} with ONLY ${requiredNotes.length} notes`);
          await this.loadLayerWithNotes(layer, requiredNotes);
        } else {
          // Full loading: load all 30 samples
          console.log(`🎹 Full loading layer ${layer} with ALL 30 samples`);
          await this.loadLayer(layer);
        }
        console.log(`✅ Layer ${layer} loaded successfully`);
      } catch (error) {
        console.error(`❌ Failed to load layer ${layer}:`, error);
      }
    });

    await Promise.all(loadPromises);
    
    // CRITICAL: Wait for Tone.js to finish loading ALL buffers
    // This is a global wait that ensures all Tone.Sampler instances have their buffers ready
    console.log('🎹 Waiting for Tone.loaded() to ensure all buffers are ready...');
    try {
      await Tone.loaded();
      console.log('🎹 Tone.loaded() resolved - all buffers should be ready');
    } catch (error) {
      console.error('🎹 Tone.loaded() failed:', error);
    }
    
    // Extra wait to ensure all buffers are fully loaded
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify that samplers are actually loaded
    for (const layer of layersToLoad) {
      const sampler = this.samplers.get(layer);
      if (sampler && !sampler.loaded) {
        console.warn(`🎹 Layer ${layer} sampler exists but not fully loaded, waiting...`);
        try {
          await sampler.loaded;
        } catch (e) {
          console.error(`🎹 Failed to wait for layer ${layer} to load:`, e);
        }
      }
    }

    this.isInitialized = true;
    // console.log('✅ Salamander Grand Piano ready with initial layers');
    
    // Final check to ensure all samplers are ready
    await this.ensureReady();
  }

  /**
   * Load a specific velocity layer with only certain notes (smart loading)
   */
  private async loadLayerWithNotes(layer: string, notes: string[]): Promise<void> {
    if (this.loadedLayers.has(layer)) return;

    console.log(`🎹 Smart loading layer ${layer} with ${notes.length} notes`);

    const loadPromise = (async () => {
      const layerStartTime = performance.now();
      try {
        // Ensure Tone.js context is running before creating sampler
        if (Tone.context.state !== 'running') {
          try {
            await Tone.start();
          } catch (e) {
            // Context will be resumed when user interacts
          }
        }
        
        // Context should already be set from preferredContext in initialize()

        // Map notes to actual Salamander sample files
        // Salamander uses sparse sampling: only certain notes have samples
        const actualSamples = new Set<string>();
        const urls: Record<string, string> = {};
        
        notes.forEach(note => {
          // Find the nearest available sample for this note
          let sampleFile: string | null = null;
          
          // Direct match
          if (this.sampleMapping[note as keyof typeof this.sampleMapping]) {
            sampleFile = this.sampleMapping[note as keyof typeof this.sampleMapping];
          } else {
            // Find nearest sample (Tone.js will pitch-shift)
            // For notes between samples, use the nearest lower sample
            const noteNum = parseInt(note.match(/\d+/)?.[0] || '0');
            const noteName = note.replace(/\d+/, '');
            
            // Check same octave samples
            const octaveSamples = Object.keys(this.sampleMapping).filter(k => 
              k.includes(noteNum.toString())
            );
            
            if (octaveSamples.length > 0) {
              // Use first available in same octave
              sampleFile = this.sampleMapping[octaveSamples[0] as keyof typeof this.sampleMapping];
            } else {
              // Use C4 as fallback (middle of range)
              sampleFile = 'C4.mp3';
            }
          }
          
          if (sampleFile) {
            urls[note] = sampleFile;
            actualSamples.add(sampleFile);
          }
        });
        
        console.log(`🎹 Layer ${layer}: Mapped ${notes.length} notes to ${actualSamples.size} unique sample files`);

        const baseUrl = this.useLocalSamples 
          ? `${this.localSamplesPath}/${layer}/`
          : `${this.supabaseUrl}/Keyboards/salamander/${layer}/`;

        console.log(`🎹 Smart loading from: ${baseUrl}`);

        const sampler = new Tone.Sampler({
          urls,
          baseUrl,
          release: 0.05,
          attack: 0.002,
          onload: () => {
            const loadTime = ((performance.now() - layerStartTime) / 1000).toFixed(2);
            console.log(`✅ Smart loaded layer ${layer}: ${actualSamples.size} samples in ${loadTime}s`);
          },
          onerror: (error) => {
            console.error(`❌ Failed to smart load layer ${layer}:`, error);
          }
        });

        // Wait for sampler to load
        await sampler.loaded;
        
        // Store the sampler
        this.samplers.set(layer, sampler);
        this.loadedLayers.add(layer);
        this.loadingPromises.delete(layer);
        
      } catch (error) {
        console.error(`Failed to smart load layer ${layer}:`, error);
        this.loadingPromises.delete(layer);
        throw error;
      }
    })();

    this.loadingPromises.set(layer, loadPromise);
    return loadPromise;
  }

  /**
   * Load a specific velocity layer
   */
  private async loadLayer(layer: string): Promise<void> {
    if (this.loadedLayers.has(layer)) return;

    // Check if already loading
    const existingPromise = this.loadingPromises.get(layer);
    if (existingPromise) return existingPromise;

    // Loading velocity layer

    const loadPromise = (async () => {
      try {
        // Ensure Tone.js context is running before creating sampler
        if (Tone.context.state !== 'running') {
          // Silently handle suspended context - this is normal behavior
          try {
            await Tone.start();
          } catch (e) {
            // Context will be resumed when user interacts
          }
        }
        
        // Context should already be set from preferredContext in initialize()

        // Creating sampler for layer
        let sampler: Tone.Sampler;

        try {
          // console.log(`🎹 Creating sampler for layer ${layer}`);
          
          // Try local samples first
          const baseUrl = this.useLocalSamples 
            ? `${this.localSamplesPath}/${layer}/`
            : `${this.supabaseUrl}/Keyboards/salamander/${layer}/`;
            
          console.log(`🎹 Creating Tone.Sampler for layer ${layer} from: ${baseUrl}`);
          console.log(`🎹 Sample mapping has ${Object.keys(this.sampleMapping).length} entries`);
          
          sampler = new Tone.Sampler({
            urls: this.sampleMapping,
            baseUrl,
            release: 0.05, // Very short release (50ms) so the damper sound is audible
            attack: 0.002,
            onload: () => {
              console.log(`✅ Sampler layer ${layer} loaded successfully from ${this.useLocalSamples ? 'local' : 'Supabase'}`);
            },
            onerror: (error) => {
              console.error(
                `❌ Error loading sampler for layer ${layer} from ${this.useLocalSamples ? 'local' : 'Supabase'}:`,
                error,
              );
              
              // If local loading failed, try Supabase as fallback
              if (this.useLocalSamples) {
                console.log(`🔄 Retrying layer ${layer} from Supabase...`);
                this.useLocalSamples = false;
                // Retry with Supabase URL
                const fallbackSampler = new Tone.Sampler({
                  urls: this.sampleMapping,
                  baseUrl: `${this.supabaseUrl}/Keyboards/salamander/${layer}/`,
                  release: 0.05,
                  attack: 0.002,
                  onload: () => {
                    console.log(`✅ Sampler layer ${layer} loaded from Supabase fallback`);
                  },
                  onerror: (fallbackError) => {
                    console.error(`❌ Fallback also failed for layer ${layer}:`, fallbackError);
                  }
                });
                // Replace the failed sampler
                sampler = fallbackSampler;
              }
            },
          });
        } catch (samplerError) {
          console.error(
            `Failed to create Tone.Sampler for layer ${layer}:`,
            samplerError,
          );
          // Try creating a basic sampler without any options
          try {
            sampler = new Tone.Sampler();
            console.warn(
              `Created basic sampler for layer ${layer} as fallback`,
            );
          } catch (fallbackError) {
            console.error(
              `Failed to create even basic sampler:`,
              fallbackError,
            );
            throw fallbackError;
          }
        }

        // Important: Do NOT connect the sampler to any destination here
        // Tone.Sampler might have internal connections that fail if destination isn't ready

        // Wait for sampler to be loaded before attempting any connections
        try {
          console.log(`🎹 Waiting for layer ${layer} sampler.loaded promise...`);
          await sampler.loaded;
          console.log(`🎹 Layer ${layer} sampler.loaded promise resolved`);
          
          // CRITICAL: Also wait for global Tone.loaded() to ensure this new sampler's buffers are ready
          console.log(`🎹 Waiting for Tone.loaded() for layer ${layer}...`);
          await Tone.loaded();
          console.log(`🎹 Tone.loaded() resolved for layer ${layer}`);
          
          // Additional check: Verify buffers are actually loaded
          // Tone.js Sampler.loaded promise sometimes resolves before buffers are ready
          let retries = 0;
          const maxRetries = 20; // 2 seconds total
          
          while ((!sampler._buffers || sampler._buffers.size === 0) && retries < maxRetries) {
            console.log(`🎹 Waiting for layer ${layer} buffers to load... (attempt ${retries + 1})`);
            await new Promise(resolve => setTimeout(resolve, 100));
            retries++;
          }
          
          if (!sampler._buffers || sampler._buffers.size === 0) {
            console.error(`❌ Layer ${layer} buffers failed to load after ${maxRetries} attempts`);
            throw new Error(`Buffers not loaded for layer ${layer}`);
          }
          
          const bufferCount = sampler._buffers ? (sampler._buffers.size || Object.keys(sampler._buffers).length) : 0;
          console.log(`✅ Layer ${layer} has ${bufferCount} buffers loaded`);
          
        } catch (loadError) {
          console.warn(
            `Sampler load failed for layer ${layer}:`,
            loadError,
          );
          throw loadError; // Re-throw to handle at higher level
        }

        // Ensure sampler is properly initialized
        if (!sampler) {
          throw new Error(
            `Sampler for layer ${layer} is not properly initialized`,
          );
        }

        // Connect the sampler to destination if we have one
        if (this.destination) {
          try {
            safeConnect(sampler, this.destination, `sampler-${layer}-dynamic`);
            console.log(`✅ Connected newly loaded layer ${layer} to destination`);
          } catch (err) {
            console.error(`Failed to connect newly loaded layer ${layer}:`, err);
          }
        } else {
          console.log(
            `Sampler layer ${layer} created - will be connected when connect() is called`,
          );
        }

        this.samplers.set(layer, sampler);
        this.loadedLayers.add(layer);

        // Velocity layer loaded
      } catch (error) {
        console.error(`❌ Failed to load layer ${layer}:`, error);
        throw error;
      } finally {
        this.loadingPromises.delete(layer);
      }
    })();

    this.loadingPromises.set(layer, loadPromise);
    return loadPromise;
  }

  /**
   * Check if a sampler can play a specific note
   */
  private canSamplerPlayNote(sampler: any, note: string): boolean {
    if (!sampler) return false;
    
    // The real check is whether the sampler can actually play
    // Let's be optimistic and assume if the sampler exists and has been added to our map,
    // it should be able to play (even if buffers are still loading)
    // The actual triggerAttackRelease will handle any errors
    return true;
  }

  /**
   * Get the appropriate layer for a velocity value
   */
  private getLayerForVelocity(velocity: number): string {
    const v = Math.max(0, Math.min(127, velocity));
    const range = this.velocityRanges.find((r) => v >= r.min && v <= r.max);
    const layer = range ? range.layer : 'v8'; // Default to medium

    // Debug logging
    if (velocity > 85) {
      console.log(
        `🎹 Velocity ${velocity} -> layer ${layer} (range: ${range?.min}-${range?.max})`,
      );
    }

    return layer;
  }

  /**
   * Load the damper release sound
   */
  private async loadDamperReleaseSound(): Promise<void> {
    try {
      // Ensure Tone is loaded
      await ensureToneLoaded();

      // Try local file first
      const damperUrl = this.useLocalSamples
        ? `${this.localSamplesPath}/AT2035 XY Angle Dn RTN A2.wav`
        : `${this.supabaseUrl}/Keyboards/salamander/AT2035 XY Angle Dn RTN A2.wav`;
        
      this.damperReleaseSampler = new Tone.Player({
        url: damperUrl,
        onload: () => {
          console.log('Damper release sound loaded successfully');
        },
        onerror: (error) => {
          console.warn('Failed to load damper release sound:', error);
          // Non-critical - piano will work without mechanical sounds
        }
      });

      // Player with url in constructor loads automatically, just wait for it
      await this.damperReleaseSampler.loaded;

      // Don't connect damper release sampler here - we'll create connections on demand
      // This avoids AudioNode connection issues during initialization
      console.log('Damper release sampler ready (not connected yet)');
    } catch (error) {
      console.error('Failed to load damper release sound:', error);
      // Don't throw - allow piano to work without mechanical sounds
    }
  }

  /**
   * Play a note with velocity
   * Automatically loads required layer if not already loaded
   */
  async triggerAttackRelease(
    note: string | string[],
    duration: Tone.Unit.Time,
    time?: Tone.Unit.Time,
    velocity = 64,
    playMechanicalSounds = true,
  ): Promise<void> {
    // Restore volume if it was muted by panic
    if (this.volumeWasMuted) {
      console.log('🎹 Restoring sampler volumes after panic');
      this.samplers.forEach((sampler, layer) => {
        if (sampler && sampler.loaded) {
          if (sampler.volume && sampler.volume.value !== undefined) {
            sampler.volume.value = 0; // 0dB = normal volume
            console.log(`🎹 Restored sampler.volume.value = 0 for layer ${layer}`);
          }
        }
      });
      this.volumeWasMuted = false;
    }

    // Ensure Tone is loaded before we proceed
    if (!Tone) {
      await ensureToneLoaded();
    }
    
    const notes = Array.isArray(note) ? note : [note];
    // CRITICAL FIX: Don't convert time parameter here - pass it through as-is
    // This preserves Transport-relative timing like "+0.05"

    // Play each note individually
    for (let i = 0; i < notes.length; i++) {
      const currentNote = notes[i];
      const layer = this.getLayerForVelocity(velocity);

      // Load layer if not already loaded
      if (!this.loadedLayers.has(layer)) {
        await this.loadLayer(layer);
      }

      // Get or load the sampler for this layer
      let sampler = this.samplers.get(layer);
      
      // If sampler doesn't exist or isn't loaded, load it now
      if (!sampler || !sampler.loaded) {
        console.log(`🎹 Sampler for layer ${layer} not ready, loading now...`);
        await this.loadLayer(layer);
        sampler = this.samplers.get(layer);
      }
      
      if (sampler) {
        try {
          // Wait for the sampler to be fully loaded
          try {
            await sampler.loaded;
            
            // Additional check: verify the sampler has the specific note buffer
            // The _buffers property is internal but we need to check it
            const buffers = (sampler as any)._buffers;
            if (!buffers || typeof buffers.has !== 'function') {
              console.warn(`🎹 Layer ${layer} sampler buffers not accessible, reloading...`);
              await this.loadLayer(layer);
              sampler = this.samplers.get(layer);
              if (sampler) {
                await sampler.loaded;
              }
            } else {
              // Check if this specific note has a buffer
              const noteHasBuffer = buffers.has(Tone.Frequency(currentNote).toMidi());
              if (!noteHasBuffer) {
                // This is expected for sparse sampling - Salamander only has C, Ds, Fs, A per octave
                // Tone.js will automatically pitch-shift the nearest sample
                // console.warn(`🎹 Layer ${layer} doesn't have buffer for note ${currentNote}, may use nearest sample`);
              }
            }
          } catch (e) {
            // If the loaded promise fails, try to reload
            console.warn(`🎹 Sampler loaded promise failed for layer ${layer}, reloading...`);
            await this.loadLayer(layer);
            sampler = this.samplers.get(layer);
            if (sampler) {
              try {
                await sampler.loaded;
              } catch (reloadError) {
                console.error(`🎹 Failed to reload layer ${layer}:`, reloadError);
                continue; // Skip this note
              }
            }
          }

          // Playing note

          // Convert MIDI velocity to Tone.js velocity (0-1)
          const normalizedVelocity = velocity / 127;

          // Store the velocity for this note
          this.activeNotes.set(currentNote, velocity);

          // Schedule the note
          // CRITICAL FIX: Use the original time parameter, not baseTime
          // This preserves Transport-relative timing like "+0.05"
          const noteTime = time;

          // For triggerAttackRelease, we need to handle the release manually
          // since we want to trigger the mechanical sound
          const noteDurationSeconds = Tone.Time(duration).toSeconds();
          // Only convert to absolute time when we need it for calculations
          const actualNoteTime = noteTime !== undefined ? Tone.Time(noteTime).toSeconds() : Tone.now();
          const releaseTime = actualNoteTime + noteDurationSeconds;

          // Debug log scheduling
          if (noteTime !== undefined) {
            console.log(`🎹 Scheduling note ${currentNote} at time ${noteTime} (current: ${Tone.now()})`);
          } else {
            console.log(`🎹 Playing note ${currentNote} immediately at ${Tone.now()}`);
          }

          // Use triggerAttackRelease but also schedule our custom release handling
          try {
            console.log(`🎹🎵 SalamanderVelocitySampler.triggerAttackRelease: note=${currentNote}, time=${noteTime}, Transport.state=${Tone.Transport.state}, Transport.seconds=${Tone.Transport.seconds}`);
            
            // Ensure sampler is connected before playing
            if (this.destination && !sampler.numberOfOutputs) {
              console.log(`🎹 Connecting sampler ${layer} before playing`);
              safeConnect(sampler, this.destination, `sampler-${layer}-play`);
            }
            
            // Final buffer check - access the internal _buffers to verify
            const buffers = (sampler as any)._buffers;
            const bufferSize = buffers ? (buffers.size || Object.keys(buffers).length) : 0;
            if (!buffers || bufferSize === 0) {
              throw new Error(`buffer not loaded for layer ${layer}`);
            }
            
            // Check if this specific note has a buffer or if a nearby note can be pitched
            const midiNote = Tone.Frequency(currentNote).toMidi();
            let hasBuffer = false;
            
            // Check if we have this exact note or a nearby one (Tone.Sampler can pitch shift)
            for (let offset = 0; offset <= 12; offset++) {
              if (buffers.has(midiNote) || 
                  buffers.has(midiNote + offset) || 
                  buffers.has(midiNote - offset)) {
                hasBuffer = true;
                break;
              }
            }
            
            if (!hasBuffer && bufferSize > 0) {
              // We have some buffers but not for this note - this is OK, sampler will pitch shift
              console.log(`🎹 Layer ${layer} will pitch-shift for note ${currentNote} (midi: ${midiNote})`);
            } else if (!hasBuffer) {
              throw new Error(`no buffer available for note ${currentNote} in layer ${layer}`);
            }
            
            // For test/preview playback, use immediate timing if Transport is stopped
            let finalTime = noteTime;
            if (typeof noteTime === 'string' && noteTime.startsWith('+')) {
              // Check if Tone is available in the correct scope
              if (Tone && Tone.Transport && Tone.Transport.state === 'stopped') {
                // Use immediate timing for stopped transport
                finalTime = Tone.now();
              }
            }
            
            sampler.triggerAttackRelease(
              currentNote,
              duration,
              finalTime,
              normalizedVelocity,
            );
          } catch (error) {
            // Don't log buffer errors to console.error - they're expected during loading
            if (error instanceof Error && error.message.includes('buffer')) {
              console.log(
                `🎹 Buffer not ready for note ${currentNote} in layer ${layer}, using fallback...`
              );
            } else {
              console.error(
                `Error playing note ${currentNote} in layer ${layer}:`,
                error,
              );
            }
            
            // If the error is about buffer not loaded, try to use a fallback layer
            if (error instanceof Error && error.message.includes('buffer')) {
              console.log(`🎹 Layer ${layer} not loaded, trying fallback...`);
              
              // Find a loaded layer close to the desired velocity
              let fallbackLayer = null;
              const velocityRange = this.getLayerForVelocity(velocity);
              
              // Try common layers first - optimized to match our default loading
              const commonLayers = ['v1', 'v6', 'v10', 'v14', 'v16'];
              console.log(`🎹 Looking for fallback layer for ${currentNote}...`);
              for (const commonLayer of commonLayers) {
                const candidateSampler = this.samplers.get(commonLayer);
                const canPlay = candidateSampler && this.canSamplerPlayNote(candidateSampler, currentNote);
                if (candidateSampler) {
                  console.log(`🎹 Checking layer ${commonLayer}: exists=true, canPlay=${canPlay}, buffers=${candidateSampler._buffers?.size || 0}`);
                }
                if (canPlay) {
                  fallbackLayer = commonLayer;
                  break;
                }
              }
              
              // If no common layer can play this note, try all loaded layers
              if (!fallbackLayer) {
                for (const [layerName, candidateSampler] of this.samplers) {
                  if (this.canSamplerPlayNote(candidateSampler, currentNote)) {
                    fallbackLayer = layerName;
                    break;
                  }
                }
              }
              
              if (fallbackLayer) {
                const fallbackSampler = this.samplers.get(fallbackLayer);
                if (fallbackSampler) {
                  try {
                    console.log(`🎹 Using fallback layer ${fallbackLayer} for note ${currentNote}`);
                    fallbackSampler.triggerAttackRelease(
                      currentNote,
                      duration,
                      noteTime,
                      normalizedVelocity,
                    );
                    // Don't return - continue with other notes
                  } catch (fallbackError) {
                    console.error(`🎹 Fallback also failed for ${currentNote}:`, fallbackError);
                  }
                }
              } else {
                console.error(`🎹 No loaded sampler can play note ${currentNote}`);
                console.log(`🎹 Checked samplers:`, Array.from(this.samplers.keys()).join(', '));
                console.log(`🎹 Loaded layers:`, Array.from(this.loadedLayers).join(', '));
              }
            }
            
            // Try loading this specific layer for future use
            if (!this.loadedLayers.has(layer)) {
              console.log(`🎹 Queuing layer ${layer} for background loading...`);
              this.loadLayer(layer).catch(err => 
                console.error(`🎹 Background loading of layer ${layer} failed:`, err)
              );
            }
          }

          // Schedule the mechanical release sound
          if (
            playMechanicalSounds &&
            this.damperReleaseSampler &&
            this.damperReleaseSampler.loaded
          ) {
            const releaseDelay = noteDurationSeconds * 1000; // Convert to milliseconds

            setTimeout(() => {
              try {
                // Play the mechanical damper release sound
                const mechanicalVolumeDb =
                  this.calculateMechanicalVolume(velocity);

                // Create a one-shot player for the damper release
                const releasePlayer = new Tone.Player(
                  this.damperReleaseSampler!.buffer,
                );

                // Track volume node for cleanup
                let volumeNode: Tone.Volume | null = null;

                // Calculate combined volume: mechanical volume + velocity-based adjustment
                const totalVolumeDb =
                  mechanicalVolumeDb + this.mechanicalVolumeDb;

                // Create a single volume node with the combined volume
                volumeNode = new Tone.Volume(totalVolumeDb);

                // Connect the chain: releasePlayer -> volumeNode -> destination
                if (
                  safeConnect(
                    releasePlayer,
                    volumeNode,
                    'releasePlayer->volumeNode',
                  )
                ) {
                  volumeNode.toDestination();
                } else {
                  // If connection fails, go direct
                  releasePlayer.toDestination();
                }

                // Play immediately (with small offset)
                const damperTime = Tone.now() + this.damperReleaseOffset;
                releasePlayer.start(damperTime);

                // Clean up after 1 second
                setTimeout(() => {
                  releasePlayer.dispose();
                  // Also dispose of the volume node we created
                  if (volumeNode) {
                    volumeNode.dispose();
                  }
                }, 1000);
              } catch (error) {
                console.warn('Failed to play damper release sound:', error);
              }

              // Remove from active notes
              this.activeNotes.delete(currentNote);
            }, releaseDelay);
          }
        } catch (error) {
          console.error(
            `Error playing note ${currentNote} in layer ${layer}:`,
            error,
          );
        }
      } else {
        console.warn(`Sampler for layer ${layer} not found`);
      }
    }
  }

  /**
   * Trigger attack (note on)
   */
  async triggerAttack(
    note: string | string[],
    time?: Tone.Unit.Time,
    velocity = 64,
  ): Promise<void> {
    const notes = Array.isArray(note) ? note : [note];
    const layer = this.getLayerForVelocity(velocity);

    if (!this.loadedLayers.has(layer)) {
      await this.loadLayer(layer);
    }

    const sampler = this.samplers.get(layer);
    if (sampler) {
      const normalizedVelocity = velocity / 127;
      sampler.triggerAttack(notes, time, normalizedVelocity);

      // Store the velocity for each note so we can use it for release
      for (const n of notes) {
        this.activeNotes.set(n, velocity);
      }
    }
  }

  /**
   * Trigger release (note off) with mechanical damper sound
   */
  triggerRelease(
    note: string | string[],
    time?: Tone.Unit.Time,
    playMechanicalSounds = true,
  ): void {
    const notes = Array.isArray(note) ? note : [note];
    const releaseTime = time !== undefined ? time : Tone.now();

    // Release on all loaded samplers to handle velocity changes
    this.samplers.forEach((sampler) => {
      sampler.triggerRelease(notes, releaseTime);
    });

    // Play mechanical damper release sounds for each note
    if (
      playMechanicalSounds &&
      this.damperReleaseSampler &&
      this.damperReleaseSampler.loaded
    ) {
      for (const currentNote of notes) {
        try {
          // Get the velocity that was used when this note was played
          const velocity = this.activeNotes.get(currentNote) || 64;

          // Schedule the mechanical damper release sound
          const damperTime = releaseTime + this.damperReleaseOffset;
          const mechanicalVolumeDb = this.calculateMechanicalVolume(velocity);

          // Create a one-shot player for the damper release
          const releasePlayer = new Tone.Player(
            this.damperReleaseSampler.buffer,
          );

          // Track volume node for cleanup
          let volumeNode: Tone.Volume | null = null;

          // Calculate combined volume: mechanical volume + velocity-based adjustment
          const totalVolumeDb = mechanicalVolumeDb + this.mechanicalVolumeDb;

          // Create a single volume node with the combined volume
          volumeNode = new Tone.Volume(totalVolumeDb);

          // Connect the chain: releasePlayer -> volumeNode -> destination
          if (
            safeConnect(releasePlayer, volumeNode, 'releasePlayer->volumeNode')
          ) {
            volumeNode.toDestination();
          } else {
            // If connection fails, go direct
            releasePlayer.toDestination();
          }

          releasePlayer.start(damperTime);

          // Clean up after 1 second
          setTimeout(() => {
            releasePlayer.dispose();
            // Also dispose of the volume node we created
            if (volumeNode) {
              volumeNode.dispose();
            }
          }, 1000);
        } catch (error) {
          console.warn(
            'Failed to play damper release sound for note:',
            currentNote,
            error,
          );
        }

        // Remove from active notes
        this.activeNotes.delete(currentNote);
      }
    }
  }

  /**
   * Calculate mechanical volume based on velocity
   * Similar to Wurlitzer but adapted for grand piano characteristics
   */
  private calculateMechanicalVolume(velocity: number): number {
    // Salamander piano: Scale from 0dB at velocity 127 down to -30dB at velocity 1
    const normalized = velocity / 127;
    // Linear scaling from -30dB to 0dB
    const scaledVolume = -30 + 30 * normalized;
    return scaledVolume;
  }

  /**
   * Set mechanical sounds base volume (in dB)
   */
  setMechanicalVolume(volumeDb: number): void {
    this.mechanicalVolumeDb = volumeDb;
  }

  /**
   * Set damper release timing offset (in seconds after note release)
   * Typical value for acoustic grand piano: 0.080 (80ms)
   */
  setDamperReleaseOffset(offsetSeconds: number): void {
    this.damperReleaseOffset = offsetSeconds;
  }

  /**
   * Connect all samplers to destination
   */
  connect(destination: Tone.InputNode): this {
    console.log('SalamanderVelocitySampler.connect called with:', destination);

    // Validate destination
    if (!destination) {
      console.error('Cannot connect to null/undefined destination');
      return this;
    }

    // Check if destination is a native Web Audio API node and ensure Tone uses the same context
    if (destination && (destination instanceof GainNode || destination instanceof AudioNode)) {
      const destinationContext = destination.context;
      if (destinationContext) {
        // Ensure Tone.js is loaded with the correct context
        (async () => {
          await ensureToneLoaded(destinationContext);
          
          if (Tone && Tone.context && destinationContext !== Tone.context._context) {
            console.log('🎹 SalamanderVelocitySampler: Setting Tone.js to use destination AudioContext');
            try {
              Tone.setContext(destinationContext);
              console.log('✅ Tone.js context synchronized with destination');
            } catch (error) {
              console.error('❌ Failed to set Tone.js context:', error);
            }
          }
        })();
      }
    }

    // Check if destination is a valid audio node
    // Accept Tone.js nodes, native Web Audio API nodes, or objects with input property
    const isValidDestination =
      (Tone &&
        (destination instanceof Tone.ToneAudioNode ||
          destination === Tone.Destination)) ||
      (destination &&
        typeof destination === 'object' &&
        ('input' in destination ||
          destination.constructor?.name === 'GainNode' ||
          destination.constructor?.name === 'AudioNode' ||
          destination instanceof GainNode ||
          destination instanceof AudioNode ||
          typeof destination.connect === 'function'));

    if (!isValidDestination) {
      console.error('Invalid destination type:', destination);
      return this;
    }

    this.destination = destination;

    // Connect all loaded samplers
    this.samplers.forEach((sampler, layer) => {
      if (sampler) {
        try {
          console.log(`Connecting sampler layer ${layer} to destination`);
          // Always reconnect to ensure proper destination
          try {
            // First disconnect any existing connections
            if (sampler.disconnect) {
              sampler.disconnect();
            }
            // Then connect to the new destination
            safeConnect(sampler, destination, `sampler-${layer}`);
            console.log(`✅ Connected sampler layer ${layer} to destination`);
          } catch (err) {
            console.error(`Failed to reconnect sampler layer ${layer}:`, err);
          }
        } catch (err) {
          console.error(`Failed to connect sampler layer ${layer}:`, err);
        }
      }
    });

    // No need to reconnect mechanical volume since we're calculating it per-note now

    return this;
  }

  /**
   * Disconnect all samplers
   */
  disconnect(): this {
    this.samplers.forEach((sampler) => {
      sampler.disconnect();
    });
    return this;
  }

  /**
   * Preload specific velocity layers
   */
  async preloadLayers(layers: string[]): Promise<void> {
    await Promise.all(layers.map((layer) => this.loadLayer(layer)));
  }

  /**
   * Smart loading: Preload only specific notes needed for an exercise
   * This dramatically reduces loading time from Supabase
   */
  async preloadNotes(notes: string[]): Promise<void> {
    console.log('🎹 Smart loading: Preloading only notes:', notes);
    
    // Determine which velocity layers to load based on typical dynamics
    const velocityLayers = ['v6', 'v10', 'v14']; // p, mf, f - most common for practice
    
    // Load layers if not already loaded
    for (const layer of velocityLayers) {
      if (!this.loadedLayers.has(layer)) {
        console.log(`🎹 Loading velocity layer ${layer} for smart loading...`);
        
        try {
          // Create a minimal sampler with only the required notes
          const sampler = new Tone.Sampler({
            urls: notes.reduce((acc, note) => {
              // Map note to sample file (e.g., C4 -> C4.mp3)
              acc[note] = `${note}.mp3`;
              return acc;
            }, {} as Record<string, string>),
            baseUrl: this.useLocalSamples 
              ? `${this.localSamplesPath}/${layer}/`
              : `${this.supabaseUrl}/Keyboards/salamander/${layer}/`,
            release: 0.05,
            attack: 0.002,
            onload: () => {
              console.log(`✅ Smart loaded ${notes.length} notes for layer ${layer}`);
            },
            onerror: (error) => {
              console.error(`❌ Failed to smart load layer ${layer}:`, error);
            }
          });
          
          await sampler.loaded;
          this.samplers.set(layer, sampler);
          this.loadedLayers.add(layer);
          
        } catch (error) {
          console.error(`❌ Failed to create sampler for layer ${layer}:`, error);
        }
      }
    }
    
    console.log('✅ Smart loading complete!');
  }

  /**
   * Preload specific velocity layers based on velocity values
   */
  async preloadVelocities(velocities: number[]): Promise<void> {
    const layersToLoad = new Set<string>();

    // Determine which layers we need
    for (const velocity of velocities) {
      const layer = this.getLayerForVelocity(velocity);
      layersToLoad.add(layer);
    }

    // Load all required layers
    await this.preloadLayers(Array.from(layersToLoad));
  }

  /**
   * Preload all 16 velocity layers
   * Warning: This will use ~150MB of memory
   */
  async preloadAll(): Promise<void> {
    const allLayers = this.velocityRanges.map((r) => r.layer);
    await this.preloadLayers(allLayers);
  }

  /**
   * Unload specific layers to free memory
   */
  unloadLayers(layers: string[]): void {
    layers.forEach((layer) => {
      const sampler = this.samplers.get(layer);
      if (sampler) {
        sampler.dispose();
        this.samplers.delete(layer);
        this.loadedLayers.delete(layer);
        // Unloaded velocity layer
      }
    });
  }

  /**
   * Get loading status
   */
  getStatus(): {
    initialized: boolean;
    loadedLayers: string[];
    totalLayers: number;
    memoryEstimate: string;
  } {
    const loadedCount = this.loadedLayers.size;
    const memoryMB = loadedCount * 9.5; // ~9.5MB per layer

    return {
      initialized: this.isInitialized,
      loadedLayers: Array.from(this.loadedLayers).sort(),
      totalLayers: this.velocityRanges.length,
      memoryEstimate: `~${memoryMB.toFixed(0)}MB`,
    };
  }

  /**
   * Stop all active notes immediately without mechanical sounds
   * Professional DAW implementation - cuts sound regardless of scheduled duration
   */
  stopAll(): void {
    // console.log(
    //   '🚨 SalamanderVelocitySampler.stopAll() - PROFESSIONAL DAW STOP - cuts scheduled duration active notes:',
    //   'active notes:', this.activeNotes.size,
    // );

    // CRITICAL: Cancel all scheduled Transport events to prevent future notes
    if (Tone && Tone.Transport) {
      try {
        // Cancel all events starting from slightly in the past to catch any that might be "in flight"
        const now = Tone.Transport.seconds;
        const cancelFrom = Math.max(0, now - 0.1); // Go back 100ms to catch in-flight events
        Tone.Transport.cancel(cancelFrom);
        // console.log(`🚨 Cancelled all Transport events from ${cancelFrom} (now: ${now})`);
      } catch (error) {
        console.warn('Failed to cancel Transport events:', error);
      }
    }

    // Stop all notes on all samplers immediately - PROFESSIONAL DAW APPROACH
    this.samplers.forEach((sampler, layer) => {
      try {
        // console.log(`🚨 EMERGENCY STOP: layer ${layer} - cutting volume and stopping all voices`);

        // CRITICAL: IMMEDIATE GAIN CUTTING - This stops sound instantly regardless of scheduled duration
        if (sampler.volume && sampler.volume.value !== undefined) {
          sampler.volume.value = -Infinity; // Immediate silence
          // console.log(`🚨 Set sampler.volume.value = -Infinity for layer ${layer}`);
        } else if (sampler.volume && sampler.volume.gain) {
          sampler.volume.gain.value = 0; // Immediate silence
          // console.log(`🚨 Set sampler.volume.gain.value = 0 for layer ${layer}`);
        }

        // Set envelope to immediate release
        const originalEnvelope = {
          attack: sampler.attack,
          decay: sampler.decay,
          sustain: sampler.sustain,
          release: sampler.release,
        };

        // Set to immediate silence
        sampler.attack = 0;
        sampler.decay = 0;
        sampler.sustain = 0;
        sampler.release = 0;

        // Release all notes
        sampler.releaseAll(Tone.immediate());

        // Also try to access internal voices for more aggressive stopping
        if (sampler._voices && Array.isArray(sampler._voices)) {
          console.log(`🚨 Found ${sampler._voices.length} internal voices to stop in layer ${layer}`);
          sampler._voices.forEach((voice: any, idx: number) => {
            // IMMEDIATE GAIN CUTTING on individual voices
            if (voice && voice.volume) {
              if (voice.volume.value !== undefined) {
                voice.volume.value = -Infinity;
                console.log(`🚨 Set voice[${idx}].volume.value = -Infinity`);
              } else if (voice.volume.gain) {
                voice.volume.gain.value = 0;
                console.log(`🚨 Set voice[${idx}].volume.gain.value = 0`);
              }
            }
            if (voice && voice.stop) {
              voice.stop(Tone.immediate());
              console.log(`🚨 Called voice[${idx}].stop(immediate)`);
            }
          });
        }
        
        // Try to clear any internal scheduled events
        if ((sampler as any)._scheduled && Array.isArray((sampler as any)._scheduled)) {
          console.log(`🚨 Clearing ${(sampler as any)._scheduled.length} scheduled events`);
          (sampler as any)._scheduled.length = 0;
        }
        
        // Force disconnect and reconnect to ensure clean state
        try {
          sampler.disconnect();
          if (this.destination) {
            safeConnect(sampler, this.destination, `sampler-${layer}-reconnect`);
          }
        } catch (err) {
          console.warn(`Failed to disconnect/reconnect sampler ${layer}:`, err);
        }

        // Also manually stop all voices if available
        if (sampler.voice && typeof sampler.voice === 'function') {
          const voices = sampler.voice(-1); // Get all voices
          if (voices && voices.stop) {
            voices.stop(Tone.immediate());
          }
        }

        // Restore envelope and volume after emergency stop
        setTimeout(() => {
          sampler.attack = originalEnvelope.attack;
          sampler.decay = originalEnvelope.decay;
          sampler.sustain = originalEnvelope.sustain;
          sampler.release = originalEnvelope.release;
          
          // DO NOT restore volume here - it will be restored when playing next note
          // This prevents scheduled notes from resuming after panic
          // console.log(`🎹 Volume remains muted for layer ${layer} until next play`);
          this.volumeWasMuted = true;
        }, 100);
      } catch (error) {
        console.warn(`Failed to stop voices on layer ${layer}:`, error);
      }
    });

    // Clear active notes tracking
    this.activeNotes.clear();
    // console.log('🚨 PROFESSIONAL STOP: All samplers emergency stopped - sound cut regardless of scheduled duration');
  }

  /**
   * MIDI Panic - All Notes Off (Professional DAW implementation)
   * Implements CC#123 (All Notes Off)
   */
  public allNotesOff(): void {
    // console.log('🚨 SalamanderVelocitySampler.allNotesOff() - MIDI CC#123');
    this.stopAll();
  }

  /**
   * MIDI Panic - All Sound Off (Professional DAW implementation)  
   * Implements CC#120 (All Sound Off) - immediate silence
   */
  public allSoundOff(): void {
    // console.log('🚨 SalamanderVelocitySampler.allSoundOff() - MIDI CC#120 - IMMEDIATE GAIN CUTTING');
    // console.log(`🚨 BEFORE allSoundOff: activeNotes=${this.activeNotes.size}, samplers=${this.samplers.size}`);
    
    // CRITICAL: IMMEDIATE GAIN CUTTING - Set volume to 0 immediately to stop ALL sound
    this.samplers.forEach((sampler, layer) => {
      if (sampler && sampler.loaded) {
        try {
          // console.log(`🚨 EMERGENCY: Cutting gain to 0 for layer ${layer}`);
          
          // 1. IMMEDIATE GAIN CUTTING - This stops the sound instantly
          if (sampler.volume && sampler.volume.value !== undefined) {
            sampler.volume.value = -Infinity; // Immediate silence
            // console.log(`🚨 Set sampler.volume.value = -Infinity for layer ${layer}`);
          } else if (sampler.volume && sampler.volume.gain) {
            sampler.volume.gain.value = 0; // Immediate silence
            // console.log(`🚨 Set sampler.volume.gain.value = 0 for layer ${layer}`);
          }
          
          // 2. Force immediate stop of all voices without release envelope
          sampler.releaseAll(0); // Immediate release
          // console.log(`🚨 Called releaseAll(0) for layer ${layer}`);
          
          // 3. Try to access and stop internal voices directly
          if (sampler._voices && Array.isArray(sampler._voices)) {
            console.log(`🚨 Found ${sampler._voices.length} internal voices in layer ${layer}`);
            sampler._voices.forEach((voice: any, idx: number) => {
              if (voice && voice.volume) {
                if (voice.volume.value !== undefined) {
                  voice.volume.value = -Infinity;
                  console.log(`🚨 Set voice[${idx}].volume.value = -Infinity`);
                } else if (voice.volume.gain) {
                  voice.volume.gain.value = 0;
                  console.log(`🚨 Set voice[${idx}].volume.gain.value = 0`);
                }
              }
              if (voice && voice.stop) {
                voice.stop(Tone.immediate());
                console.log(`🚨 Called voice[${idx}].stop(immediate)`);
              }
            });
          }
          
          // console.log(`🚨 Emergency gain cutting completed for layer ${layer}`);
        } catch (error) {
          console.error(`🚨 Failed to emergency stop layer ${layer}:`, error);
        }
      }
    });

    // Clear active notes tracking
    this.activeNotes.clear();
    // console.log(`🚨 AFTER allSoundOff: activeNotes cleared, samplers processed`);
  }

  /**
   * MIDI Panic - General panic button
   * Combines CC#120 (All Sound Off) and CC#123 (All Notes Off)
   */
  public panic(): void {
    // console.log('🚨 SalamanderVelocitySampler.panic() - Professional MIDI Panic');
    this.allSoundOff();
    this.allNotesOff();
  }

  /**
   * MIDI Panic - Emergency stop with node disposal
   * Nuclear option when normal panic doesn't work
   */
  public midiPanic(): void {
    // console.log('🚨 SalamanderVelocitySampler.midiPanic() - Emergency MIDI Panic');
    
    try {
      // 1. Immediate stop all
      this.allSoundOff();
      
      // 2. Cancel all scheduled Transport events
      if (this.Tone && this.Tone.getTransport) {
        const transport = this.Tone.getTransport();
        if (transport) {
          transport.cancel(0);
          console.log('🚨 Cancelled all Salamander Transport events');
        }
      }

      // 3. Emergency: Disconnect and reconnect samplers to force audio cessation
      setTimeout(() => {
        this.samplers.forEach((sampler, layer) => {
          if (sampler && sampler.loaded) {
            try {
              // Force disconnect and reconnect to destination
              sampler.disconnect();
              if (this.destination) {
                sampler.connect(this.destination);
              }
              // console.log(`🚨 Emergency reconnected layer ${layer}`);
            } catch (error) {
              console.warn(`🚨 Emergency reconnection failed for layer ${layer}:`, error);
            }
          }
        });
      }, 10);

    } catch (error) {
      console.error('🚨 SalamanderVelocitySampler.midiPanic() failed:', error);
    }
  }

  /**
   * Preview a note - plays sound even when in STOP/panic state
   * This allows auditioning sounds while transport is stopped
   */
  public previewNote(note: string, velocity: number = 127, duration: string = "8n"): void {
    console.log(`🎹 SalamanderVelocitySampler.previewNote(${note}, velocity=${velocity}) - PREVIEW MODE`);
    
    if (!this.isInitialized) {
      console.warn('🎹 Cannot preview - sampler not initialized');
      return;
    }

    // Check if we're currently in a STOP/panic state (volume muted)
    const isInPanicState = Array.from(this.samplers.values()).some(sampler => {
      if (sampler && sampler.volume) {
        return sampler.volume.value === -Infinity || (sampler.volume.gain && sampler.volume.gain.value === 0);
      }
      return false;
    });

    if (isInPanicState) {
      console.log('🎹 Preview: Temporarily restoring volume for preview playback');
      
      // Temporarily restore volume for all samplers
      this.samplers.forEach((sampler, layer) => {
        if (sampler && sampler.loaded && sampler.volume) {
          try {
            // Restore to a reasonable preview volume (slightly lower than normal)
            const previewVolume = -6; // -6dB for preview
            if (sampler.volume.value !== undefined) {
              sampler.volume.value = previewVolume;
            } else if (sampler.volume.gain) {
              sampler.volume.gain.value = Math.pow(10, previewVolume / 20); // Convert dB to linear gain
            }
            console.log(`🎹 Restored preview volume for layer ${layer}`);
          } catch (error) {
            console.warn(`🎹 Failed to restore preview volume for layer ${layer}:`, error);
          }
        }
      });
    }

    // Play the preview note
    try {
      this.triggerAttackRelease(note, duration, "+0.01", velocity);
      console.log(`🎹 Preview note played: ${note}`);
    } catch (error) {
      console.warn('🎹 Failed to play preview note:', error);
    }

    // If we were in panic state, restore the muted state after preview
    if (isInPanicState) {
      setTimeout(() => {
        console.log('🎹 Preview: Restoring STOP muting after preview');
        this.samplers.forEach((sampler, layer) => {
          if (sampler && sampler.loaded && sampler.volume) {
            try {
              if (sampler.volume.value !== undefined) {
                sampler.volume.value = -Infinity;
              } else if (sampler.volume.gain) {
                sampler.volume.gain.value = 0;
              }
              console.log(`🎹 Restored STOP muting for layer ${layer}`);
            } catch (error) {
              console.warn(`🎹 Failed to restore STOP muting for layer ${layer}:`, error);
            }
          }
        });
      }, 800); // Allow enough time for the note to be heard
    }
  }

  /**
   * Dispose all samplers and free memory
   */
  dispose(): void {
    // Stop all active notes first
    this.stopAll();

    this.samplers.forEach((sampler) => sampler.dispose());
    this.samplers.clear();
    this.loadedLayers.clear();
    this.loadingPromises.clear();

    if (this.damperReleaseSampler) {
      this.damperReleaseSampler.dispose();
      this.damperReleaseSampler = null;
    }

    // No mechanical volume node to dispose anymore

    this.isInitialized = false;
    // Disposed sampler
  }
}

/**
 * Singleton instance for global use
 */
export const salamanderPiano = new SalamanderVelocitySampler();
