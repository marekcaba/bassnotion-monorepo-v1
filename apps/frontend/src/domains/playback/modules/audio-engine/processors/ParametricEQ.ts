/**
 * Professional Parametric EQ
 *
 * A reusable, configurable multi-band parametric equalizer using Web Audio API.
 * Supports multiple filter types: highpass, lowpass, lowshelf, highshelf, peaking (notch/bell), bandpass, notch, allpass
 *
 * Usage:
 * ```typescript
 * const eq = new ParametricEQ(audioContext);
 * eq.configure(bands);
 * sourceNode.connect(eq.input);
 * eq.output.connect(destinationNode);
 * ```
 */

import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('ParametricEQ');

/**
 * Filter types supported by Web Audio API BiquadFilterNode
 */
export type EQFilterType =
  | 'lowpass'
  | 'highpass'
  | 'bandpass'
  | 'lowshelf'
  | 'highshelf'
  | 'peaking'
  | 'notch'
  | 'allpass';

/**
 * Configuration for a single EQ band
 */
export interface EQBandConfig {
  /** Unique identifier for this band */
  id: string;
  /** Filter type */
  type: EQFilterType;
  /** Center/cutoff frequency in Hz */
  frequency: number;
  /** Gain in dB (only applies to peaking, lowshelf, highshelf) */
  gain?: number;
  /** Q factor (resonance/bandwidth) */
  q?: number;
  /** Whether this band is enabled */
  enabled?: boolean;
  /**
   * For steep filters (like 48dB/oct highpass), specify the order.
   * Each order adds 12dB/oct, so order 4 = 48dB/oct
   * Default is 1 (12dB/oct)
   */
  order?: number;
}

/**
 * Full EQ configuration with multiple bands
 */
export interface ParametricEQConfig {
  /** Array of band configurations */
  bands: EQBandConfig[];
  /** Whether the entire EQ is bypassed */
  bypass?: boolean;
}

/**
 * Runtime state of an EQ band (includes the actual filter nodes)
 */
interface EQBandState {
  config: EQBandConfig;
  filters: BiquadFilterNode[];
  enabled: boolean;
}

/**
 * Professional multi-band parametric EQ
 */
export class ParametricEQ {
  private audioContext: AudioContext;
  private bands: Map<string, EQBandState> = new Map();
  private inputGain: GainNode;
  private outputGain: GainNode;
  private bypassGain: GainNode;
  private isBypassed = false;
  private isDisposed = false;

  /**
   * Create a new ParametricEQ
   * @param audioContext - The Web Audio API context
   */
  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;

    // Create input/output nodes
    this.inputGain = audioContext.createGain();
    this.outputGain = audioContext.createGain();
    this.bypassGain = audioContext.createGain();

    // Initial state: EQ active, bypass off
    this.inputGain.gain.value = 1;
    this.outputGain.gain.value = 1;
    this.bypassGain.gain.value = 0;

    // Connect bypass path (input -> bypass -> output)
    this.inputGain.connect(this.bypassGain);
    this.bypassGain.connect(this.outputGain);

    logger.info('ParametricEQ created');
  }

  /**
   * Get the input node to connect audio sources to
   */
  get input(): GainNode {
    return this.inputGain;
  }

  /**
   * Get the output node to connect to destination
   */
  get output(): GainNode {
    return this.outputGain;
  }

  /**
   * Configure the EQ with a set of bands
   * @param config - EQ configuration with band definitions
   */
  configure(config: ParametricEQConfig): void {
    if (this.isDisposed) {
      logger.warn('Cannot configure disposed EQ');
      return;
    }

    // Clear existing bands
    this.clearBands();

    // Create new bands
    for (const bandConfig of config.bands) {
      this.addBand(bandConfig);
    }

    // Rebuild the filter chain
    this.rebuildChain();

    // Set bypass state
    if (config.bypass !== undefined) {
      this.setBypass(config.bypass);
    }

    logger.info('ParametricEQ configured', {
      bands: config.bands.length,
      bypass: config.bypass ?? false,
    });
  }

  /**
   * Add a single band to the EQ
   */
  addBand(config: EQBandConfig): void {
    if (this.isDisposed) return;

    const filters: BiquadFilterNode[] = [];
    const order = config.order ?? 1;

    // Create filter(s) for this band
    // For steep slopes, we cascade multiple filters
    for (let i = 0; i < order; i++) {
      const filter = this.audioContext.createBiquadFilter();
      filter.type = config.type;
      filter.frequency.value = config.frequency;

      // Set Q factor
      if (config.q !== undefined) {
        filter.Q.value = config.q;
      }

      // Set gain (only for shelf and peaking filters)
      if (config.gain !== undefined) {
        if (['peaking', 'lowshelf', 'highshelf'].includes(config.type)) {
          filter.gain.value = config.gain;
        }
      }

      filters.push(filter);
    }

    // Chain the filters together
    for (let i = 0; i < filters.length - 1; i++) {
      const currentFilter = filters[i];
      const nextFilter = filters[i + 1];
      if (currentFilter && nextFilter) {
        currentFilter.connect(nextFilter);
      }
    }

    this.bands.set(config.id, {
      config,
      filters,
      enabled: config.enabled !== false,
    });

    logger.debug(`Band "${config.id}" added`, {
      type: config.type,
      frequency: config.frequency,
      gain: config.gain,
      q: config.q,
      order,
    });
  }

  /**
   * Update a specific band's parameters
   */
  updateBand(
    bandId: string,
    params: Partial<Omit<EQBandConfig, 'id' | 'type' | 'order'>>,
  ): void {
    const band = this.bands.get(bandId);
    if (!band) {
      logger.warn(`Band "${bandId}" not found`);
      return;
    }

    // Update each filter in the band
    for (const filter of band.filters) {
      if (params.frequency !== undefined) {
        filter.frequency.value = params.frequency;
        band.config.frequency = params.frequency;
      }

      if (params.q !== undefined) {
        filter.Q.value = params.q;
        band.config.q = params.q;
      }

      if (params.gain !== undefined) {
        if (['peaking', 'lowshelf', 'highshelf'].includes(band.config.type)) {
          filter.gain.value = params.gain;
          band.config.gain = params.gain;
        }
      }
    }

    if (params.enabled !== undefined) {
      band.enabled = params.enabled;
      band.config.enabled = params.enabled;
      this.rebuildChain();
    }

    logger.debug(`Band "${bandId}" updated`, params);
  }

  /**
   * Remove a band from the EQ
   */
  removeBand(bandId: string): void {
    const band = this.bands.get(bandId);
    if (!band) return;

    // Disconnect and cleanup filters
    for (const filter of band.filters) {
      filter.disconnect();
    }

    this.bands.delete(bandId);
    this.rebuildChain();

    logger.debug(`Band "${bandId}" removed`);
  }

  /**
   * Enable or disable bypass mode
   */
  setBypass(bypass: boolean): void {
    this.isBypassed = bypass;

    const now = this.audioContext.currentTime;
    const rampTime = 0.01; // 10ms crossfade to avoid clicks

    if (bypass) {
      // Bypass: mute EQ path, enable bypass path
      this.bypassGain.gain.linearRampToValueAtTime(1, now + rampTime);
      // Mute all band outputs (handled by chain disconnection)
    } else {
      // Active: enable EQ path, mute bypass path
      this.bypassGain.gain.linearRampToValueAtTime(0, now + rampTime);
    }

    this.rebuildChain();
    logger.info(`EQ bypass: ${bypass}`);
  }

  /**
   * Get the current bypass state
   */
  get bypassed(): boolean {
    return this.isBypassed;
  }

  /**
   * Get all band configurations
   */
  getBands(): EQBandConfig[] {
    return Array.from(this.bands.values()).map((b) => ({ ...b.config }));
  }

  /**
   * Get a specific band's configuration
   */
  getBand(bandId: string): EQBandConfig | undefined {
    return this.bands.get(bandId)?.config;
  }

  /**
   * Rebuild the filter chain based on enabled bands
   */
  private rebuildChain(): void {
    // Disconnect everything from input first
    this.inputGain.disconnect();

    // Reconnect bypass path
    this.inputGain.connect(this.bypassGain);
    this.bypassGain.connect(this.outputGain);

    if (this.isBypassed) {
      // In bypass mode, only the bypass path is active
      return;
    }

    // Get enabled bands in order (use Array.from for compatibility)
    const enabledBands = Array.from(this.bands.values()).filter(
      (b) => b.enabled,
    );

    if (enabledBands.length === 0) {
      // No enabled bands, connect input directly to output
      this.inputGain.connect(this.outputGain);
      return;
    }

    // Chain: input -> band1 -> band2 -> ... -> output
    let previousNode: AudioNode = this.inputGain;

    for (const band of enabledBands) {
      if (band.filters.length > 0) {
        const firstFilter = band.filters[0];
        const lastFilter = band.filters[band.filters.length - 1];
        if (firstFilter && lastFilter) {
          // Connect to first filter in band
          previousNode.connect(firstFilter);
          // Last filter in band becomes the previous node
          previousNode = lastFilter;
        }
      }
    }

    // Connect last band to output
    previousNode.connect(this.outputGain);
  }

  /**
   * Clear all bands
   */
  private clearBands(): void {
    for (const band of this.bands.values()) {
      for (const filter of band.filters) {
        filter.disconnect();
      }
    }
    this.bands.clear();
  }

  /**
   * Dispose of the EQ and release resources
   */
  dispose(): void {
    if (this.isDisposed) return;

    this.clearBands();

    this.inputGain.disconnect();
    this.outputGain.disconnect();
    this.bypassGain.disconnect();

    this.isDisposed = true;
    logger.info('ParametricEQ disposed');
  }

  /**
   * Create a ParametricEQ with a preset configuration
   */
  static createWithPreset(
    audioContext: AudioContext,
    preset: ParametricEQConfig,
  ): ParametricEQ {
    const eq = new ParametricEQ(audioContext);
    eq.configure(preset);
    return eq;
  }
}

// ============================================================================
// PRESET CONFIGURATIONS
// ============================================================================

/**
 * Grand Piano EQ preset
 * Designed to polish raw grand piano samples:
 * - High-pass at 50Hz (48dB/oct) to remove rumble
 * - Low shelf boost at 230Hz for warmth
 * - Notch cut at 500Hz to reduce muddiness
 * - Notch boost at 1120Hz for presence
 * - High shelf cut at 535Hz to tame harshness
 */
export const GRAND_PIANO_EQ_PRESET: ParametricEQConfig = {
  bands: [
    {
      id: 'highpass',
      type: 'highpass',
      frequency: 50,
      q: 0.71,
      order: 4, // 48dB/oct = 4 x 12dB/oct
      enabled: true,
    },
    {
      id: 'low-shelf',
      type: 'lowshelf',
      frequency: 230,
      gain: 3,
      q: 1.0,
      enabled: true,
    },
    {
      id: 'notch-500',
      type: 'peaking',
      frequency: 500,
      gain: -4,
      q: 2.5,
      enabled: true,
    },
    {
      id: 'notch-1120',
      type: 'peaking',
      frequency: 1120,
      gain: 2.6,
      q: 1.8,
      enabled: true,
    },
    {
      id: 'high-shelf',
      type: 'highshelf',
      frequency: 535,
      gain: -2.8,
      q: 1.0,
      enabled: true,
    },
  ],
  bypass: false,
};

/**
 * EXTREME TEST preset - use this to verify EQ is working
 * Very obvious changes - should sound VERY different
 * After testing, switch back to GRAND_PIANO_EQ_PRESET
 */
export const EXTREME_TEST_EQ_PRESET: ParametricEQConfig = {
  bands: [
    {
      id: 'highpass',
      type: 'highpass',
      frequency: 300, // EXTREME: Cut all bass below 300Hz
      q: 0.71,
      order: 4,
      enabled: true,
    },
    {
      id: 'mid-boost',
      type: 'peaking',
      frequency: 1000,
      gain: 12, // EXTREME: +12dB at 1kHz - very nasal sound
      q: 2.0,
      enabled: true,
    },
    {
      id: 'high-cut',
      type: 'lowpass',
      frequency: 3000, // EXTREME: Cut all highs above 3kHz - very muffled
      q: 0.71,
      order: 2,
      enabled: true,
    },
  ],
  bypass: false,
};

/**
 * Export presets for easy access
 */
export const EQ_PRESETS = {
  grandPiano: GRAND_PIANO_EQ_PRESET,
} as const;
