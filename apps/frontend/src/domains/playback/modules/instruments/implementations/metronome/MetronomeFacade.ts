/**
 * Metronome Facade
 *
 * Facade pattern to maintain backward compatibility while using modular components
 */

import { MetronomeCore } from '../../components/metronome/MetronomeCore.js';
import { MetronomeScheduler } from '../../components/metronome/MetronomeScheduler.js';
import { MetronomeVisualizer } from '../../components/metronome/MetronomeVisualizer.js';
import { useMetronomeStore } from '../../components/metronome/MetronomeState.js';
import type { MetronomeConfig as CoreConfig } from '../../components/metronome/MetronomeCore.js';
import type { TimeSignature } from '../../architecture/IInstrumentScheduler.js';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('MetronomeFacade');

// Re-export types for backward compatibility
export { TimeSignature };

export interface ClickSoundConfig {
  accent: any;
  regular: any;
  subdivision: any;
  currentPreset: string;
  customSounds: Map<string, any>;
}

export interface MetronomeConfig {
  clickSounds: ClickSoundConfig;
  timeSignature: TimeSignature;
  tempo: number;
  subdivision: number;
  accentPattern: number[];
  grooveTemplate: any;
  swingAmount: number;
  visualSync: any;
  advancedTiming: any;
  midiSync: any;
}

/**
 * Facade for MetronomeInstrumentProcessor
 * Maintains the same API while delegating to modular components
 */
export class MetronomeFacade {
  private static instance: MetronomeFacade | null = null;

  private core: MetronomeCore;
  private scheduler: MetronomeScheduler;
  private visualizer: MetronomeVisualizer;
  private store = useMetronomeStore;
  private isInitialized = false;

  constructor() {
    this.core = new MetronomeCore();
    this.scheduler = new MetronomeScheduler(this.core);
    this.visualizer = new MetronomeVisualizer();

    // Setup visual sync
    this.scheduler.addVisualCallback((beat, subdivision) => {
      this.visualizer.updateBeat(beat, subdivision);
      this.store.getState().updateBeat(beat, subdivision);
    });

    logger.info('MetronomeFacade created');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): MetronomeFacade {
    if (!MetronomeFacade.instance) {
      MetronomeFacade.instance = new MetronomeFacade();
    }
    return MetronomeFacade.instance;
  }

  /**
   * Initialize the metronome
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.core.initialize();
      this.visualizer.initialize();
      this.core.toDestination();
      this.isInitialized = true;

      logger.info('MetronomeFacade initialized');
    } catch (error) {
      logger.error('Failed to initialize MetronomeFacade', error);
      throw error;
    }
  }

  /**
   * Start the metronome
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const state = this.store.getState();

    // Create pattern from current state
    const pattern = this.scheduler.createPattern(state.timeSignature, {
      accentPattern: state.accentPattern,
      subdivisions: state.subdivisions,
      includeSubdivisions: state.includeSubdivisions,
    });

    // Configure scheduler
    this.scheduler.updateOptions({
      preClick: state.preClickCount,
      visualOffset: state.visualOptions.visualOffset,
      adaptiveTiming: state.adaptiveTiming,
    });

    // Configure swing
    this.scheduler.setOptions({
      swing: state.swing,
      tempo: state.tempo,
    });

    // Start playback
    this.scheduler.startWithPattern(pattern, { bpm: state.tempo });
    this.visualizer.setPlaying(true);
    this.store.getState().setPlaying(true);

    logger.info('Metronome started', {
      tempo: state.tempo,
      timeSignature: state.timeSignature,
    });
  }

  /**
   * Stop the metronome
   */
  stop(): void {
    this.scheduler.stop();
    this.visualizer.setPlaying(false);
    this.store.getState().setPlaying(false);

    logger.info('Metronome stopped');
  }

  /**
   * Set tempo
   */
  setTempo(bpm: number): void {
    this.store.getState().setTempo(bpm);
    this.scheduler.setOptions({ tempo: bpm });

    // Restart if playing to apply new tempo
    if (this.store.getState().isPlaying) {
      this.stop();
      this.start();
    }
  }

  /**
   * Get tempo
   */
  getTempo(): number {
    return this.store.getState().tempo;
  }

  /**
   * Set time signature
   */
  setTimeSignature(numerator: number, denominator: number): void {
    const timeSignature = { numerator, denominator };
    this.store.getState().setTimeSignature(timeSignature);
    this.visualizer.updateConfig({ timeSignature });

    // Restart if playing
    if (this.store.getState().isPlaying) {
      this.stop();
      this.start();
    }
  }

  /**
   * Get time signature
   */
  getTimeSignature(): TimeSignature {
    return this.store.getState().timeSignature;
  }

  /**
   * Set accent pattern
   */
  setAccentPattern(pattern: number[]): void {
    this.store.getState().setAccentPattern(pattern);
    this.visualizer.updateConfig({ accentPattern: pattern });

    if (this.store.getState().isPlaying) {
      this.stop();
      this.start();
    }
  }

  /**
   * Get accent pattern
   */
  getAccentPattern(): number[] {
    return this.store.getState().accentPattern;
  }

  /**
   * Set subdivision
   */
  setSubdivision(subdivision: number): void {
    this.store.getState().setSubdivisions(subdivision);

    if (this.store.getState().isPlaying) {
      this.stop();
      this.start();
    }
  }

  /**
   * Enable/disable subdivisions
   */
  setSubdivisionsEnabled(enabled: boolean): void {
    this.store.getState().toggleSubdivisions();

    if (this.store.getState().isPlaying) {
      this.stop();
      this.start();
    }
  }

  /**
   * Set swing amount
   */
  setSwing(amount: number): void {
    this.store.getState().setSwing(amount);
    this.scheduler.setOptions({ swing: amount });
  }

  /**
   * Get swing amount
   */
  getSwing(): number {
    return this.store.getState().swing;
  }

  /**
   * Set volume
   */
  setVolume(volume: number): void {
    this.store.getState().setVolume(volume);
    this.core.setVolume(volume);
  }

  /**
   * Get volume
   */
  getVolume(): number {
    return this.store.getState().volume;
  }

  /**
   * Tap tempo
   */
  tapTempo(): void {
    this.store.getState().tapTempo();
  }

  /**
   * Get configuration (for backward compatibility)
   */
  getConfig(): MetronomeConfig {
    const state = this.store.getState();
    const coreConfig = this.core.getConfig();

    return {
      clickSounds: {
        accent: coreConfig.accentClick,
        regular: coreConfig.regularClick,
        subdivision: coreConfig.subdivisionClick,
        currentPreset: 'default',
        customSounds: new Map(),
      },
      timeSignature: state.timeSignature,
      tempo: state.tempo,
      subdivision: state.subdivisions,
      accentPattern: state.accentPattern,
      grooveTemplate: null,
      swingAmount: state.swing,
      visualSync: state.visualOptions,
      advancedTiming: {
        adaptiveTiming: state.adaptiveTiming,
        preClickCount: state.preClickCount,
      },
      midiSync: { enabled: false },
    };
  }

  /**
   * Update configuration (partial)
   */
  updateConfig(config: Partial<MetronomeConfig>): void {
    if (config.tempo !== undefined) {
      this.setTempo(config.tempo);
    }

    if (config.timeSignature) {
      this.setTimeSignature(
        config.timeSignature.numerator,
        config.timeSignature.denominator,
      );
    }

    if (config.accentPattern) {
      this.setAccentPattern(config.accentPattern);
    }

    if (config.subdivision !== undefined) {
      this.setSubdivision(config.subdivision);
    }

    if (config.swingAmount !== undefined) {
      this.setSwing(config.swingAmount);
    }

    logger.info('Configuration updated', { config });
  }

  /**
   * Load preset
   */
  loadPreset(presetId: string): void {
    this.store.getState().loadPreset(presetId);

    if (this.store.getState().isPlaying) {
      this.stop();
      this.start();
    }
  }

  /**
   * Save current settings as preset
   */
  savePreset(name: string): string {
    return this.store.getState().savePreset(name);
  }

  /**
   * Get available presets
   */
  getPresets(): any[] {
    return this.store.getState().presets;
  }

  /**
   * Get visual element (for UI integration)
   */
  getVisualizer(): MetronomeVisualizer {
    return this.visualizer;
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    this.stop();
    await this.core.dispose();
    this.visualizer.dispose();
    this.isInitialized = false;

    logger.info('MetronomeFacade disposed');
  }

  /**
   * Check if playing
   */
  isPlaying(): boolean {
    return this.store.getState().isPlaying;
  }

  /**
   * Get current beat
   */
  getCurrentBeat(): number {
    return this.store.getState().currentBeat;
  }

  /**
   * Get current subdivision
   */
  getCurrentSubdivision(): number {
    return this.store.getState().currentSubdivision;
  }
}

// Export singleton instance getter for backward compatibility
export const getMetronomeInstance = () => MetronomeFacade.getInstance();
