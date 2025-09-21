import { loadGlobalTone } from '../../../shared/loaders/toneLoader.js';
import { createStructuredLogger } from '../../../shared/index.js';

// Use global Tone instance to ensure same AudioContext
let Tone: any = null;

const logger = createStructuredLogger('WurlitzerVelocitySampler');

/**
 * Professional Wurlitzer Electric Piano sampler with variable velocity layers
 * Includes mechanical sounds: pedal press/release, key press, and key release
 */

export interface WurlitzerVelocityInfo {
  note: string;
  velocityCount: number;
}

export class WurlitzerVelocitySampler {
  private noteSamplers: Map<string, any[]> = new Map(); // Will be Tone.Sampler[]
  private pedalSampler: any | null = null; // Will be Tone.Player
  private pedalReleaseSampler: any | null = null; // Will be Tone.Player
  private keyPressSamplers: Map<string, any> = new Map(); // Will be Tone.Player Map
  private keyReleaseSamplers: any[] = []; // Will be Tone.Player[]
  private isInitialized = false;
  private destination: any | null = null; // Will be Tone.InputNode
  private mechanicalSoundCount = 0; // Debug counter
  private mechanicalVolume: any | null = null; // Will be Tone.Volume, initialized after Tone is loaded
  private audioEngine?: any; // Optional AudioEngine for DI
  private _mechanicalVolumeBase = -30; // Base volume at velocity 64
  private mechanicalTimingOffset = -0.004; // Default 4ms before note (negative = before)
  private mechanicalReleaseOffset = -0.01; // Start 10ms BEFORE note stops (negative = before)
  private noteReleaseTime = 0.2; // 200ms release time for electric piano
  private supabaseUrl =
    'https://htuztkrbuewheehjspcz.supabase.co/storage/v1/object/public/audio-samples';

  // Velocity distribution from metadata
  private readonly velocityInfo: Map<string, number> = new Map([
    // 3 velocities
    ['C6', 3],
    ['B5', 3],
    ['As5', 3],
    ['A5', 3],
    ['Gs5', 3],
    ['G5', 3],
    ['Fs5', 3],
    ['F5', 3],
    ['E5', 3],
    ['Ds5', 3],
    ['D5', 3],
    ['Cs5', 3],
    ['C5', 3],
    ['B4', 3],
    ['As4', 3],
    ['Gs4', 3],
    ['G4', 3],
    ['F4', 3],
    ['D4', 3],
    ['C3', 3],
    // 4 velocities
    ['A4', 4],
    ['Fs4', 4],
    ['E4', 4],
    ['Cs4', 4],
    ['C4', 4],
    ['B3', 4],
    ['As3', 4],
    ['Gs3', 4],
    ['G3', 4],
    ['Fs3', 4],
    ['E3', 4],
    ['Ds3', 4],
    ['Fs2', 4],
    ['F2', 4],
    ['E2', 4],
    ['Ds2', 4],
    ['D2', 4],
    ['Cs2', 4],
    ['As1', 4],
    ['A1', 4],
    ['Ds1', 4],
    // 5 velocities
    ['Ds4', 5],
    ['A3', 5],
    ['F3', 5],
    ['D3', 5],
    ['Cs3', 5],
    ['B2', 5],
    ['As2', 5],
    ['A2', 5],
    ['Gs2', 5],
    ['C2', 5],
    ['B1', 5],
    ['Gs1', 5],
    ['G1', 5],
    ['F1', 5],
    ['E1', 5],
    ['D1', 5],
    ['B0', 5],
    ['As0', 5],
    ['A0', 5],
    // Actually 5 velocities based on available files
    ['G2', 5],
    ['Fs1', 5],
    ['C1', 5],
    // Actually 5 velocities
    ['Cs1', 5],
  ]);

  constructor(audioEngine?: any) {
    this.audioEngine = audioEngine;
  }

  /**
   * Ensure Tone.js is loaded dynamically
   */
  private async ensureToneLoaded(): Promise<void> {
    if (!Tone) {
      Tone = await loadGlobalTone(undefined, this.audioEngine);
      logger.info(
        '🎵 Using global Tone.js instance in WurlitzerVelocitySampler',
      );
    }
  }

  /**
   * Initialize the Wurlitzer sampler
   * Loads the most common velocity layers first
   */
  async initialize(audioEngine?: any): Promise<void> {
    if (this.isInitialized) return;

    // Store audioEngine if provided
    if (audioEngine) {
      this.audioEngine = audioEngine;
    }

    logger.info('🎹 Initializing Wurlitzer Electric Piano...');

    try {
      // Ensure Tone is loaded before initializing
      await this.ensureToneLoaded();

      // Initialize mechanical volume now that Tone is loaded
      this.mechanicalVolume = this.createVolume(-30);

      // Load mechanical sounds first
      await this.loadMechanicalSounds();

      // Load middle velocity layers for all notes
      await this.loadInitialVelocityLayers();

      this.isInitialized = true;
      logger.info('✅ Wurlitzer ready with initial layers');
    } catch (error) {
      logger.error(
        'Failed to initialize Wurlitzer:',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Load mechanical sounds (pedal, key press, key release)
   */
  private async loadMechanicalSounds(): Promise<void> {
    try {
      // Load pedal sounds
      this.pedalSampler = this.createPlayer();
      this.pedalReleaseSampler = this.createPlayer();

      await Promise.all([
        this.pedalSampler
          .load(`${this.supabaseUrl}/Keyboards/wurlitzer/pedal/pedal-press.mp3`)
          .catch((e: unknown) =>
            logger.error(
              'Failed to load pedal-press.mp3:',
              e instanceof Error ? e : new Error(String(e)),
            ),
          ),
        this.pedalReleaseSampler
          .load(
            `${this.supabaseUrl}/Keyboards/wurlitzer/pedal/pedal-release.mp3`,
          )
          .catch((e: unknown) =>
            logger.error(
              'Failed to load pedal-release.mp3:',
              e instanceof Error ? e : new Error(String(e)),
            ),
          ),
      ]);

      // Wait for buffers to be ready
      await Promise.all([
        this.pedalSampler.loaded,
        this.pedalReleaseSampler.loaded,
      ]);

      if (this.destination) {
        this.pedalSampler.connect(this.destination);
        this.pedalReleaseSampler.connect(this.destination);
      }

      // Load note-specific CleanKeys sounds
      const keyPressPromises = [];

      // Load CleanKeys sounds for each note
      for (const note of this.velocityInfo.keys()) {
        const player = this.createPlayer();
        this.keyPressSamplers.set(note, player);

        // Convert note to lowercase for file path
        const noteForFile = note.toLowerCase();
        const url = `${this.supabaseUrl}/Keyboards/wurlitzer/key-press/${noteForFile}-clean.mp3`;

        keyPressPromises.push(
          player.load(url).catch((e: unknown) =>
            logger.warn(`Failed to load clean key for ${note}:`, {
              error: e as Record<string, unknown>,
            }),
          ),
        );
      }

      // Load a subset of generic key release sounds
      const keyReleasePromises = [];
      for (let i = 1; i <= 67; i += 5) {
        const url = `${this.supabaseUrl}/Keyboards/wurlitzer/key-release/key-release-${i}.mp3`;
        const player = this.createPlayer();
        this.keyReleaseSamplers.push(player);
        keyReleasePromises.push(
          player
            .load(url)
            .catch((e: unknown) =>
              logger.error(
                `Failed to load ${url}:`,
                e instanceof Error ? e : new Error(String(e)),
              ),
            ),
        );
      }

      await Promise.all([...keyPressPromises, ...keyReleasePromises]);

      // Wait for all buffers to be loaded
      await Promise.all([
        ...Array.from(this.keyPressSamplers.values()).map((p) => p.loaded),
        ...this.keyReleaseSamplers.map((p) => p.loaded),
      ]);

      // Connect to mechanical volume, then to destination
      if (this.destination) {
        this.mechanicalVolume.connect(this.destination);
        this.keyPressSamplers.forEach((p) => p.connect(this.mechanicalVolume));
        this.keyReleaseSamplers.forEach((p) =>
          p.connect(this.mechanicalVolume),
        );
      }

      // Mechanical sounds loaded successfully
    } catch (error) {
      logger.error(
        'Error in loadMechanicalSounds:',
        error instanceof Error ? error : new Error(String(error)),
      );
      // Don't throw - allow the sampler to work without mechanical sounds
    }
  }

  /**
   * Load initial velocity layers (middle velocities)
   */
  private async loadInitialVelocityLayers(): Promise<void> {
    const loadPromises = [];

    for (const [note, velocityCount] of this.velocityInfo) {
      // Initialize array for this note with correct size
      const samplers = new Array(velocityCount).fill(null);
      this.noteSamplers.set(note, samplers);

      // Load middle velocity layer(s)
      const middleVelocity = Math.ceil(velocityCount / 2);

      // For Tone.js, we need to map sharp notes (e.g., As4 -> A#4 for Tone.js, but file is As4.mp3)
      const toneNote = note.replace('s', '#'); // Convert for Tone.js
      const fileName = note; // Keep original for filename

      const sampler = this.createSampler({
        urls: { [toneNote]: `${fileName}.mp3` },
        baseUrl: `${this.supabaseUrl}/Keyboards/wurlitzer/v${middleVelocity}/`,
        release: this.noteReleaseTime, // Short release for electric piano - allows mechanical damper sound
        attack: 0.002,
        onload: () => {
          logger.info(`✅ Wurlitzer ${note} v${middleVelocity} loaded`);
        },
        onerror: (error: any) => {
          logger.error(
            `❌ Failed to load Wurlitzer ${note} v${middleVelocity}:`,
            error instanceof Error ? error : new Error(String(error)),
          );
        },
      });

      // Store at the correct velocity index
      samplers[middleVelocity - 1] = sampler;

      loadPromises.push(sampler.loaded);
    }

    await Promise.all(loadPromises);

    // Connect to destination
    if (this.destination) {
      for (const samplers of this.noteSamplers.values()) {
        samplers.forEach((s) => s?.connect(this.destination));
      }
    }
  }

  /**
   * Load specific velocity layer for a note
   */
  private async loadVelocityLayer(
    note: string,
    velocityIndex: number,
  ): Promise<void> {
    const velocityCount = this.velocityInfo.get(note);
    if (!velocityCount || velocityIndex > velocityCount) return;

    let samplers = this.noteSamplers.get(note);
    if (!samplers) {
      // Initialize array if it doesn't exist
      samplers = new Array(velocityCount).fill(null);
      this.noteSamplers.set(note, samplers);
    }

    if (samplers[velocityIndex - 1]) return; // Already loaded

    // Loading velocity layer

    // For Tone.js, we need to map sharp notes (e.g., As4 -> A#4 for Tone.js, but file is As4.mp3)
    const toneNote = note.replace('s', '#'); // Convert for Tone.js
    const fileName = note; // Keep original for filename

    const sampler = this.createSampler({
      urls: { [toneNote]: `${fileName}.mp3` },
      baseUrl: `${this.supabaseUrl}/Keyboards/wurlitzer/v${velocityIndex}/`,
      release: this.noteReleaseTime, // Use configured release time
      attack: 0.002,
      onload: () => {
        logger.info(`✅ Wurlitzer ${note} v${velocityIndex} loaded on demand`);
      },
      onerror: (error: any) => {
        logger.error(
          `❌ Failed to load Wurlitzer ${note} v${velocityIndex}:`,
          error instanceof Error ? error : new Error(String(error)),
        );
      },
    });

    // Store the sampler immediately so it can be found
    samplers[velocityIndex - 1] = sampler;

    // Wait for it to load
    await sampler.loaded;

    if (this.destination) {
      sampler.connect(this.destination);
    }
  }

  /**
   * Get the appropriate velocity layer for a MIDI velocity
   */
  private getVelocityLayer(note: string, velocity: number): number {
    const velocityCount = this.velocityInfo.get(note) || 3;
    // Ensure velocity is clamped to valid MIDI range
    velocity = Math.max(1, Math.min(127, velocity));
    const normalizedVelocity = velocity / 127;
    // Calculate layer, ensuring we get at least 1
    const layer = Math.max(1, Math.ceil(normalizedVelocity * velocityCount));
    return Math.min(layer, velocityCount);
  }

  /**
   * Play a note with velocity and mechanical sounds
   */
  async triggerAttackRelease(
    note: string | string[],
    duration: any,
    time?: any,
    velocity = 64,
    playMechanicalSounds = true,
  ): Promise<void> {
    const notes = Array.isArray(note) ? note : [note];
    const baseTime = time !== undefined ? time : Tone.now();

    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      if (!n) continue;

      // For arrays of notes (chords), all play at the same time
      // For single notes, use the provided time
      const noteTime = notes.length > 1 ? baseTime : baseTime;

      const noteForSampler = n.includes('#') ? n.replace('#', 's') : n;
      const velocityLayer = this.getVelocityLayer(noteForSampler, velocity);

      // Playing note

      // Ensure velocity layer is loaded
      await this.loadVelocityLayer(noteForSampler, velocityLayer);

      // Get the samplers array again after loading
      const samplers = this.noteSamplers.get(noteForSampler);
      const sampler = samplers?.[velocityLayer - 1];

      if (sampler && sampler.loaded) {
        try {
          // Double-check the sampler is loaded
          await sampler.loaded;
          const normalizedVelocity = velocity / 127;
          sampler.triggerAttackRelease(
            n,
            duration,
            noteTime,
            normalizedVelocity,
          );
        } catch (error) {
          logger.error(
            `Error playing note ${n}:`,
            error instanceof Error ? error : new Error(String(error)),
          );
        }

        // Play mechanical sounds for this specific note
        if (
          playMechanicalSounds &&
          this.keyPressSamplers.size > 0 &&
          this.keyReleaseSamplers.length > 0
        ) {
          // Calculate velocity-based volume for mechanical sounds
          const mechanicalVolume = this.calculateMechanicalVolume(velocity);
          try {
            // Play the note-specific CleanKeys sound as a one-shot
            const keyPressPlayer = this.keyPressSamplers.get(noteForSampler);
            // Check key press sampler

            if (
              keyPressPlayer &&
              keyPressPlayer.buffer &&
              keyPressPlayer.buffer.loaded
            ) {
              if (this.destination) {
                // Create a new player instance for this specific playback to avoid conflicts
                try {
                  // Create a volume node for this specific mechanical sound
                  const velocityVolume = new Tone.Volume(mechanicalVolume);
                  velocityVolume.connect(this.mechanicalVolume); // Chain to master mechanical volume

                  const oneShot = new Tone.Player(
                    keyPressPlayer.buffer,
                  ).connect(velocityVolume);
                  // Start mechanical sound before the note (realistic piano action delay)
                  const mechanicalTime = Math.max(
                    0,
                    noteTime + this.mechanicalTimingOffset,
                  );
                  oneShot.start(mechanicalTime);
                  this.mechanicalSoundCount++;
                  // Started key press sound
                  // Clean up after the sound has played (CleanKeys are typically < 1 second)
                  setTimeout(() => {
                    // Disposing key press player
                    oneShot.dispose();
                    velocityVolume.dispose();
                  }, 1000);
                } catch (e) {
                  logger.error(
                    `[Mechanical] Failed to create/start key press sound for ${noteForSampler}:`,
                    e instanceof Error ? e : new Error(String(e)),
                  );
                }
              } else {
                logger.warn(
                  `[Mechanical] No destination connected for clean key sound ${noteForSampler}`,
                );
              }
            } else {
              logger.warn(
                `[Mechanical] No clean key sound loaded for ${noteForSampler}`,
              );
            }

            // Schedule a random key release sound
            // The mechanical release sound should play when the key is released (note-off event)
            // For realistic timing, it plays slightly before the actual note-off to simulate the mechanical action
            const noteDurationSeconds = Tone.Time(duration).toSeconds();
            const actualNoteReleaseTime = noteTime + noteDurationSeconds;
            // Mechanical release happens slightly before the electrical note-off
            // This simulates the key mechanism starting to move before the tine is fully dampened
            const mechanicalReleaseTime =
              actualNoteReleaseTime + this.mechanicalReleaseOffset; // -10ms by default
            const keyReleaseIndex = Math.floor(
              Math.random() * this.keyReleaseSamplers.length,
            );
            const keyReleasePlayer = this.keyReleaseSamplers[keyReleaseIndex];
            // Check key release sampler

            if (
              keyReleasePlayer &&
              keyReleasePlayer.buffer &&
              keyReleasePlayer.buffer.loaded &&
              this.destination
            ) {
              // Calculate release-specific volume (slightly quieter than press)
              const releaseVolume =
                this.calculateMechanicalReleaseVolume(velocity);

              // Create volume node and player for release sound
              const releaseVelocityVolume = new Tone.Volume(releaseVolume);
              releaseVelocityVolume.connect(this.mechanicalVolume);

              const releaseOneShot = new Tone.Player(
                keyReleasePlayer.buffer,
              ).connect(releaseVelocityVolume);

              // Schedule the release sound at the exact time
              const releaseDuration = mechanicalReleaseTime - Tone.now();

              // Use Tone.js scheduling instead of setTimeout
              releaseOneShot.start(mechanicalReleaseTime);

              // Clean up after the sound has played (approximate duration + buffer)
              setTimeout(
                () => {
                  // Disposing key release player
                  releaseOneShot.dispose();
                  releaseVelocityVolume.dispose();
                },
                Math.max(releaseDuration * 1000 + 1000, 2000),
              );
            } else if (!this.destination) {
              logger.warn('[Mechanical] No destination for key release sound');
            }
          } catch (error) {
            logger.error(
              `[Mechanical] Error playing mechanical sounds for ${noteForSampler}:`,
              error instanceof Error ? error : new Error(String(error)),
            );
          }
        }
      } else {
        logger.error(
          `No sampler found for ${noteForSampler} velocity layer ${velocityLayer}`,
        );
      }
    }
  }

  /**
   * Trigger pedal press
   */
  triggerPedalPress(time?: any): void {
    // Tone.Unit.Time
    try {
      if (
        this.pedalSampler &&
        this.pedalSampler.buffer.loaded &&
        this.destination
      ) {
        // Create one-shot player for pedal press
        const oneShot = new Tone.Player(this.pedalSampler.buffer).connect(
          this.destination,
        );
        oneShot.start(time);
        setTimeout(() => {
          oneShot.dispose();
        }, 1000);
      } else {
        logger.warn('Pedal press sampler not loaded or no destination');
      }
    } catch (error) {
      logger.warn('Error playing pedal press:', {
        error: error as Record<string, unknown>,
      });
    }
  }

  /**
   * Trigger pedal release
   */
  triggerPedalRelease(time?: any): void {
    // Tone.Unit.Time
    try {
      if (
        this.pedalReleaseSampler &&
        this.pedalReleaseSampler.buffer.loaded &&
        this.destination
      ) {
        // Create one-shot player for pedal release
        const oneShot = new Tone.Player(
          this.pedalReleaseSampler.buffer,
        ).connect(this.destination);
        oneShot.start(time);
        setTimeout(() => {
          oneShot.dispose();
        }, 1000);
      } else {
        logger.warn('Pedal release sampler not loaded or no destination');
      }
    } catch (error) {
      logger.warn('Error playing pedal release:', {
        error: error as Record<string, unknown>,
      });
    }
  }

  /**
   * Calculate mechanical volume based on velocity
   * Scales from -45dB (velocity 1) to -15dB (velocity 127) with -30dB at velocity 64
   */
  private calculateMechanicalVolume(velocity: number): number {
    // Normalize velocity to 0-1 range
    const normalized = velocity / 127;

    // Create a curve that's -45dB at velocity 1, -30dB at velocity 64, and -15dB at velocity 127
    // Using a power curve for more realistic scaling
    const volumeRange = 30; // Total range from softest to loudest
    const minVolume = -45; // Quietest mechanical sound

    // Power curve (squared for more natural response)
    const scaledVolume = minVolume + volumeRange * Math.pow(normalized, 1.5);

    return scaledVolume;
  }

  /**
   * Calculate mechanical release volume based on velocity
   * Release sounds are typically slightly louder than press sounds
   * because the damper mechanism is more abrupt than the key press
   */
  private calculateMechanicalReleaseVolume(velocity: number): number {
    // Scale from 0dB at velocity 127 down to -30dB at velocity 1
    // This matches the loudest clean note (velocity 127 = 0dB)
    const normalized = velocity / 127;
    // Linear scaling from -30dB to 0dB
    const scaledVolume = -30 + 30 * normalized;
    return scaledVolume;
  }

  /**
   * Set mechanical sounds base volume (in dB)
   * This is the volume at velocity 64
   */
  setMechanicalVolume(volumeDb: number): void {
    // this._mechanicalVolumeBase = volumeDb;
    // Update current volume if playing at velocity 64
    this.mechanicalVolume.volume.value = volumeDb;
  }

  /**
   * Set mechanical timing offset (in seconds, negative = before note)
   * Typical values: -0.003 to -0.005 for realistic piano action
   */
  setMechanicalTimingOffset(offsetSeconds: number): void {
    this.mechanicalTimingOffset = offsetSeconds;
  }

  /**
   * Set mechanical release timing offset (in seconds, negative = before note release)
   * Typical values: -0.005 to -0.015 for electric piano damper action
   * The mechanical sound plays slightly before the electrical note-off
   * to simulate the key mechanism starting to move before the tine is fully dampened
   * Default: -0.010 (10ms before note release)
   */
  setMechanicalReleaseOffset(offsetSeconds: number): void {
    this.mechanicalReleaseOffset = offsetSeconds;
  }

  /**
   * Set the note release time (ADSR envelope release)
   * Shorter values make the mechanical release sound more audible
   * Typical values: 0.1 to 0.3 for electric piano
   */
  setNoteReleaseTime(releaseTime: number): void {
    this.noteReleaseTime = releaseTime;
    // Update all existing samplers
    for (const samplers of this.noteSamplers.values()) {
      samplers.forEach((sampler) => {
        if (sampler) {
          sampler.release = releaseTime;
        }
      });
    }
  }

  /**
   * Connect to audio destination
   */
  connect(destination: any): this {
    // Tone.InputNode
    this.destination = destination;

    // Connect all loaded samplers
    for (const samplers of this.noteSamplers.values()) {
      samplers.forEach((s) => s?.connect(destination));
    }

    // Connect mechanical volume to destination
    this.mechanicalVolume.connect(destination);

    // Connect mechanical sounds to mechanical volume (already done in loadMechanicalSounds)

    return this;
  }

  /**
   * Disconnect from audio
   */
  disconnect(): this {
    for (const samplers of this.noteSamplers.values()) {
      samplers.forEach((s) => s?.disconnect());
    }

    this.pedalSampler?.disconnect();
    this.pedalReleaseSampler?.disconnect();
    this.keyPressSamplers.forEach((p) => p.disconnect());
    this.keyReleaseSamplers.forEach((p) => p.disconnect());

    return this;
  }

  /**
   * Stop all currently playing notes immediately
   */
  stopAll(): void {
    // Stop all notes on all velocity layers
    for (const samplers of this.noteSamplers.values()) {
      samplers.forEach((sampler) => {
        if (sampler && sampler.loaded) {
          try {
            // Store original envelope
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

            // Restore envelope after a brief moment
            setTimeout(() => {
              sampler.attack = originalEnvelope.attack;
              sampler.decay = originalEnvelope.decay;
              sampler.sustain = originalEnvelope.sustain;
              sampler.release = originalEnvelope.release;
            }, 50);
          } catch (error) {
            logger.warn('Failed to release notes on sampler:', {
              error: error as Record<string, unknown>,
            });
          }
        }
      });
    }
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    // Stop all notes first
    this.stopAll();

    this.disconnect();

    for (const samplers of this.noteSamplers.values()) {
      samplers.forEach((s) => s?.dispose());
    }
    this.noteSamplers.clear();

    this.pedalSampler?.dispose();
    this.pedalReleaseSampler?.dispose();
    this.keyPressSamplers.forEach((p) => p.dispose());
    this.keyPressSamplers.clear();
    this.keyReleaseSamplers.forEach((p) => p.dispose());
    this.keyReleaseSamplers = [];
  }

  /**
   * Preload all velocity layers for specific notes
   */
  async preloadNotes(notes: string[]): Promise<void> {
    const loadPromises = [];

    for (const note of notes) {
      const noteForSampler = note.includes('#') ? note.replace('#', 's') : note;
      const velocityCount = this.velocityInfo.get(noteForSampler) || 3;

      for (let v = 1; v <= velocityCount; v++) {
        loadPromises.push(this.loadVelocityLayer(noteForSampler, v));
      }
    }

    await Promise.all(loadPromises);
  }

  /**
   * Get status information
   */
  getStatus() {
    let loadedCount = 0;
    let totalPossible = 0;

    for (const [note, velocityCount] of this.velocityInfo) {
      totalPossible += velocityCount;
      const samplers = this.noteSamplers.get(note) || [];
      loadedCount += samplers.filter((s) => s != null).length;
    }

    return {
      initialized: this.isInitialized,
      notesLoaded: `${loadedCount}/${totalPossible}`,
      mechanicalSoundsLoaded: true,
      totalNotes: this.velocityInfo.size,
    };
  }

  // Factory methods for DI support
  private createSampler(options?: any): any {
    if (this.audioEngine?.createSampler) {
      return this.audioEngine.createSampler(options);
    }
    // Fallback to Tone if available
    if (!Tone) {
      throw new Error('Tone.js not loaded and no audioEngine provided');
    }
    return new Tone.Sampler(options);
  }

  private createPlayer(options?: any): any {
    if (this.audioEngine?.createPlayer) {
      return this.audioEngine.createPlayer(options);
    }
    // Fallback to Tone if available
    if (!Tone) {
      throw new Error('Tone.js not loaded and no audioEngine provided');
    }
    return new Tone.Player(options);
  }

  private createVolume(volume?: number): any {
    if (this.audioEngine?.createVolume) {
      return this.audioEngine.createVolume(volume);
    }
    // Fallback to Tone if available
    if (!Tone) {
      throw new Error('Tone.js not loaded and no audioEngine provided');
    }
    return new Tone.Volume(volume);
  }
}

/**
 * Singleton instance for global use
 */
export const wurlitzerPiano = new WurlitzerVelocitySampler();
