import { loadGlobalTone } from './toneLoader';
import { createStructuredLogger } from '@bassnotion/contracts';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

// Use global Tone instance to ensure same AudioContext
let Tone: any = null;

/**
 * Long Pad sampler with ADSR envelope control and sustain looping
 * Single velocity layer with samples from C-1 to C4
 */

export interface ADSREnvelope {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export class LongPadSampler {
  private sampler: Tone.Sampler | null = null;
  private isInitialized = false;
  private destination: Tone.InputNode | null = null;
  private envelope: ADSREnvelope = {
    attack: 0.05, // 50ms default attack
    decay: 0.3, // 300ms default decay
    sustain: 1.0, // 100% sustain level
    release: 2.0, // 2s default release
  };
  private supabaseUrl =
    'https://htuztkrbuewheehjspcz.supabase.co/storage/v1/object/public/audio-samples';

  // Note mapping from C-1 to C4 (01.wav to 61.wav)
  private readonly noteMapping: { [key: string]: string } = {};

  constructor() {
    // Build note mapping
    const notes = [
      'C-1',
      'C#-1',
      'D-1',
      'D#-1',
      'E-1',
      'F-1',
      'F#-1',
      'G-1',
      'G#-1',
      'A-1',
      'A#-1',
      'B-1',
      'C0',
      'C#0',
      'D0',
      'D#0',
      'E0',
      'F0',
      'F#0',
      'G0',
      'G#0',
      'A0',
      'A#0',
      'B0',
      'C1',
      'C#1',
      'D1',
      'D#1',
      'E1',
      'F1',
      'F#1',
      'G1',
      'G#1',
      'A1',
      'A#1',
      'B1',
      'C2',
      'C#2',
      'D2',
      'D#2',
      'E2',
      'F2',
      'F#2',
      'G2',
      'G#2',
      'A2',
      'A#2',
      'B2',
      'C3',
      'C#3',
      'D3',
      'D#3',
      'E3',
      'F3',
      'F#3',
      'G3',
      'G#3',
      'A3',
      'A#3',
      'B3',
      'C4',
    ];

    // Map notes to file numbers (01-61)
    notes.forEach((note, index) => {
      const fileNumber = (index + 1).toString().padStart(2, '0');
      // Convert sharp notes to flats for Tone.js (C#-1 -> Db-1, etc.)
      let toneNote = note;
      if (note.includes('#')) {
        const noteBase = note[0];
        const octave = note.substring(2);
        // Convert C# to Db, D# to Eb, etc.
        const sharpToFlat: { [key: string]: string } = {
          'C#': 'Db',
          'D#': 'Eb',
          'F#': 'Gb',
          'G#': 'Ab',
          'A#': 'Bb',
        };
        toneNote = sharpToFlat[`${noteBase}#`] + octave;
      }
      // Keep the original note name for the file
      // All files in Supabase include octave numbers (C0, Cs0, etc.)
      let fileNote = note;
      // Replace # with s in filename to avoid URL issues
      fileNote = fileNote.replace('#', 's');
      // Use simple file names as uploaded to Supabase
      this.noteMapping[toneNote] = `${fileNote}.mp3`;
    });
  }

  /**
   * Ensure Tone.js is loaded dynamically
   */
  private async ensureToneLoaded(): Promise<void> {
    if (!Tone) {
      Tone = await loadGlobalTone();
      logger.info('🎵 Using global Tone.js instance in LongPadSampler');
    }
  }

  /**
   * Initialize the Long Pad sampler
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    logger.info('🎹 Initializing Long Pad...');

    try {
      // Ensure Tone is loaded before initializing
      await this.ensureToneLoaded();

      // Ensure Tone.js context is started
      if (Tone.context.state !== 'running') {
        await Tone.start();
      }
      // Create sampler with loop enabled for sustain
      this.sampler = new Tone.Sampler({
        urls: this.noteMapping, // Use full mapping
        baseUrl: `${this.supabaseUrl}/Keyboards/longpad/`,
        attack: this.envelope.attack,
        release: this.envelope.release,
        curve: 'exponential',
        onload: () => {
          logger.info('✅ Long Pad samples loaded successfully');
          if (this.sampler && this.sampler._buffers) {
            logger.info(
              'Loaded buffer count:',
              Object.keys(this.sampler._buffers._buffers || {}).length,
            );
          }
        },
        onerror: (error: any) => {
          logger.error('❌ Error loading Long Pad samples:', error);
          if (error && error.toString) {
            logger.error('Error details:', error.toString());
          }
        },
      });

      // Wait for sampler to load with a proper promise
      await new Promise<void>((resolve, reject) => {
        const checkLoaded = () => {
          if (this.sampler!.loaded) {
            resolve();
          } else {
            // Keep checking
            setTimeout(checkLoaded, 100);
          }
        };

        // Start checking after a small delay
        setTimeout(checkLoaded, 100);

        // Timeout after 10 seconds
        setTimeout(() => {
          reject(new Error('Timeout loading Long Pad samples'));
        }, 10000);
      });

      // Connect to destination if available
      if (this.destination) {
        this.sampler.connect(this.destination);
      }

      this.isInitialized = true;
      logger.info('✅ Long Pad ready');
    } catch (error) {
      logger.error('Failed to initialize Long Pad:', error);
      throw error;
    }
  }

  /**
   * Set ADSR envelope parameters
   */
  setEnvelope(envelope: Partial<ADSREnvelope>): void {
    this.envelope = { ...this.envelope, ...envelope };

    if (this.sampler) {
      // Update sampler envelope
      if (envelope.attack !== undefined) {
        this.sampler.attack = envelope.attack;
      }
      if (envelope.release !== undefined) {
        this.sampler.release = envelope.release;
      }
      // Note: Decay and Sustain need to be handled differently in Tone.js
      // as Sampler doesn't have direct decay/sustain controls
    }
  }

  /**
   * Get current envelope settings
   */
  getEnvelope(): ADSREnvelope {
    return { ...this.envelope };
  }

  /**
   * Play a note with the long pad sound
   */
  async triggerAttackRelease(
    note: string | string[],
    duration: Tone.Unit.Time,
    time?: Tone.Unit.Time,
    velocity = 0.7,
  ): Promise<void> {
    if (!this.sampler || !this.isInitialized) {
      logger.warn('Long Pad not initialized');
      return;
    }

    try {
      const notes = Array.isArray(note) ? note : [note];
      const noteTime = time !== undefined ? time : Tone.now();

      // Trigger all notes
      this.sampler.triggerAttackRelease(notes, duration, noteTime, velocity);
    } catch (error) {
      logger.error('Error playing Long Pad note:', error);
      logger.error('Note requested:', note);
    }
  }

  /**
   * Trigger attack (note on)
   */
  async triggerAttack(
    note: string | string[],
    time?: Tone.Unit.Time,
    velocity = 0.7,
  ): Promise<void> {
    if (!this.sampler || !this.isInitialized) {
      logger.warn('Long Pad not initialized');
      return;
    }

    try {
      this.sampler.triggerAttack(note, time, velocity);
    } catch (error) {
      logger.error('Error triggering Long Pad attack:', error);
    }
  }

  /**
   * Trigger release (note off)
   */
  triggerRelease(note: string | string[], time?: Tone.Unit.Time): void {
    if (!this.sampler) return;

    this.sampler.triggerRelease(note, time);
  }

  /**
   * Connect to audio destination
   */
  connect(destination: Tone.InputNode): this {
    this.destination = destination;

    if (this.sampler) {
      this.sampler.connect(destination);
    }

    return this;
  }

  /**
   * Disconnect from audio
   */
  disconnect(): this {
    if (this.sampler) {
      this.sampler.disconnect();
    }

    return this;
  }

  /**
   * Get status information
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      envelope: this.envelope,
      notesLoaded: this.isInitialized
        ? Object.keys(this.noteMapping).length
        : 0,
    };
  }

  /**
   * Stop all currently playing notes immediately
   */
  stopAll(): void {
    if (this.sampler && this.sampler.loaded) {
      try {
        // Store original envelope
        const originalEnvelope = {
          attack: this.sampler.attack,
          decay: this.sampler.decay,
          sustain: this.sampler.sustain,
          release: this.sampler.release,
        };

        // Set to immediate silence
        this.sampler.attack = 0;
        this.sampler.decay = 0;
        this.sampler.sustain = 0;
        this.sampler.release = 0;

        // Release all notes
        this.sampler.releaseAll(Tone.immediate());

        // Restore envelope after a brief moment
        setTimeout(() => {
          if (this.sampler) {
            this.sampler.attack = originalEnvelope.attack;
            this.sampler.decay = originalEnvelope.decay;
            this.sampler.sustain = originalEnvelope.sustain;
            this.sampler.release = originalEnvelope.release;
          }
        }, 50);
      } catch (error) {
        logger.warn('Failed to release notes on Long Pad sampler:', error);
      }
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    // Stop all notes first
    this.stopAll();

    if (this.sampler) {
      this.sampler.dispose();
      this.sampler = null;
    }

    this.isInitialized = false;
    logger.info('🗑️ Disposed Long Pad sampler');
  }
}

/**
 * Singleton instance for global use
 */
export const longPadSampler = new LongPadSampler();
