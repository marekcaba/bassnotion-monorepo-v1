/**
 * AudioEventRouter Migration Example
 *
 * This example shows how the AudioEventRouter can be updated to use
 * the new instruments module while maintaining backward compatibility.
 */

import type { Instrument } from '../base/Instrument.js';
import { createInstrumentAdapter } from '../base/InstrumentAdapter.js';
import { Metronome } from '../implementations/metronome/Metronome.js';

// Legacy processors
import { BassInstrumentProcessor } from '../implementations/bass/BassInstrumentProcessor.js';
import { DrumInstrumentProcessor } from '../implementations/drums/DrumInstrumentProcessor.js';
import { createStructuredLogger } from '../../shared/index.js';

const logger = createStructuredLogger('AudioEventRouterMigration');

/**
 * Example of how to update AudioEventRouter to support both
 * new Instrument interface and legacy processors
 */
export class ModernAudioEventRouter {
  // Store instruments using the new interface
  private instruments: Map<string, Instrument> = new Map();

  /**
   * Initialize instruments with gradual migration approach
   */
  async initializeInstruments(): Promise<void> {
    // Option 1: Use new Metronome implementation directly
    const metronome = new Metronome({
      type: 'metronome',
      name: 'Main Metronome',
      clickSounds: {
        click: 'url-to-click-sound',
        accent: 'url-to-accent-sound',
      },
    });
    await metronome.initialize();
    this.instruments.set('metronome', metronome);

    // Option 2: Wrap existing processors with adapter
    const bassProcessor = new BassInstrumentProcessor();
    const bassInstrument = createInstrumentAdapter('bass', bassProcessor);
    await bassInstrument.initialize();
    this.instruments.set('bass', bassInstrument);

    // Option 3: Gradual migration - check feature flag
    if (this.useNewDrumImplementation()) {
      // Use new implementation when ready
      // const drums = new DrumKit({ ... });
    } else {
      // Use adapter for existing processor
      const drumProcessor = new DrumInstrumentProcessor();
      const drumInstrument = createInstrumentAdapter('drums', drumProcessor);
      await drumInstrument.initialize();
      this.instruments.set('drums', drumInstrument);
    }
  }

  /**
   * Handle trigger events using unified interface
   */
  public handleTrigger(instrumentType: string, event: any): void {
    const instrument = this.instruments.get(instrumentType);

    if (!instrument) {
      logger.warn(`Instrument ${instrumentType} not found`);
      return;
    }

    // All instruments now use the same trigger interface
    instrument.trigger({
      audioTime: event.audioTime,
      timestamp: event.timestamp,
      velocity: event.velocity,
      duration: event.duration,
      data: event, // Pass original event data
    });
  }

  /**
   * Example event handlers that work with both old and new
   * These would be used like: this.handleMetronomeTrigger(data)
   */
  // private handleMetronomeTrigger(data: any): void {
  //   this.handleTrigger('metronome', {
  //     ...data,
  //     data: { type: data.type }, // Extract metronome-specific data
  //   });
  // }

  // private handleBassTrigger(data: any): void {
  //   this.handleTrigger('bass', {
  //     ...data,
  //     data: { note: data.note, technique: data.technique },
  //   });
  // }

  // private handleDrumTrigger(data: any): void {
  //   this.handleTrigger('drums', {
  //     ...data,
  //     data: { drum: data.drum },
  //   });
  // }

  /**
   * Dispose all instruments
   */
  async dispose(): Promise<void> {
    for (const instrument of this.instruments.values()) {
      await instrument.dispose();
    }
    this.instruments.clear();
  }

  /**
   * Feature flag example
   */
  private useNewDrumImplementation(): boolean {
    // Check feature flag or environment variable
    return process.env.USE_NEW_DRUM_IMPLEMENTATION === 'true';
  }
}

/**
 * Migration benefits:
 *
 * 1. Unified Interface: All instruments follow the same pattern
 * 2. Backward Compatible: Existing processors work through adapters
 * 3. Gradual Migration: Can migrate one instrument at a time
 * 4. Type Safety: Better TypeScript support with interfaces
 * 5. Testability: Easier to mock and test instruments
 * 6. Modularity: Clear separation between instrument types
 */
