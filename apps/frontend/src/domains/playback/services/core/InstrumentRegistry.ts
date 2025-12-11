/**
 * InstrumentRegistry - Central registry for active instruments
 *
 * This service manages the active instruments used for playback,
 * allowing widgets to register their instruments and the AudioEventRouter
 * to use them. Follows the same pattern as ServiceRegistry.
 *
 * FAANG-style approach: Simple today, extensible tomorrow.
 */

import { EventBus } from './EventBus.js';
import { getLogger } from '@/utils/logger.js';

export type InstrumentType =
  | 'drums'
  | 'bass'
  | 'harmony'
  | 'metronome'
  | 'voice-cue';

export interface InstrumentRegistryEvent {
  type: InstrumentType;
  instrument?: any;
  previous?: any;
  current?: any;
}

export class InstrumentRegistry {
  private activeInstruments = new Map<InstrumentType, any>();
  private eventBus: EventBus;
  private logger = getLogger('InstrumentRegistry');

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.logger.info('InstrumentRegistry initialized');
  }

  /**
   * Set the active instrument for a type
   * This is what will be used for playback
   */
  setActive(type: InstrumentType, instrument: any): void {
    if (!instrument) {
      this.logger.warn(`Attempted to register null instrument for ${type}`);
      return;
    }

    const previous = this.activeInstruments.get(type);
    this.activeInstruments.set(type, instrument);

    this.logger.info(`Registered active ${type} instrument`);
    this.eventBus.emit('instrument:registered', {
      type,
      instrument,
    } as InstrumentRegistryEvent);

    // Notify if we replaced an existing instrument
    if (previous && previous !== instrument) {
      this.eventBus.emit('instrument:replaced', {
        type,
        previous,
        current: instrument,
      } as InstrumentRegistryEvent);
      this.logger.info(`Replaced ${type} instrument`);
    }
  }

  /**
   * Get the active instrument for a type
   */
  getActive(type: InstrumentType): any | undefined {
    return this.activeInstruments.get(type);
  }

  /**
   * Check if we have an active instrument for a type
   */
  hasActive(type: InstrumentType): boolean {
    return this.activeInstruments.has(type);
  }

  /**
   * Remove an instrument
   */
  removeActive(type: InstrumentType): void {
    const instrument = this.activeInstruments.get(type);
    if (instrument) {
      this.activeInstruments.delete(type);
      this.eventBus.emit('instrument:removed', {
        type,
        instrument,
      } as InstrumentRegistryEvent);
      this.logger.info(`Removed ${type} instrument`);
    }
  }

  /**
   * Get all registered types
   */
  getRegisteredTypes(): InstrumentType[] {
    return Array.from(this.activeInstruments.keys());
  }

  /**
   * Clear all instruments (useful for cleanup)
   */
  clearAll(): void {
    const types = this.getRegisteredTypes();
    types.forEach((type) => this.removeActive(type));
    this.logger.info('Cleared all instruments');
  }

  /**
   * Get a summary of registered instruments (for debugging)
   */
  getSummary(): Record<string, boolean> {
    return {
      drums: this.hasActive('drums'),
      bass: this.hasActive('bass'),
      harmony: this.hasActive('harmony'),
      metronome: this.hasActive('metronome'),
    };
  }

  /**
   * Get all active instruments
   */
  getAllActive(): any[] {
    return Array.from(this.activeInstruments.values());
  }

  /**
   * Clear a specific instrument (alias for removeActive for backward compatibility)
   */
  clearActive(type: InstrumentType): void {
    this.removeActive(type);
  }
}
