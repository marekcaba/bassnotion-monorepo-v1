/**
 * Base Sampler Class
 * 
 * Provides common functionality for sample-based instruments.
 * Handles sample loading, caching, and playback.
 */

import { BaseInstrument, type InstrumentConfig, type InstrumentEvent } from './Instrument.js';
import type { InstrumentType } from '../../../services/plugins/TrackManagerProcessor.js';

export interface SampleMap {
  [note: string]: string | string[]; // URL or array of URLs for round-robin
}

export interface SamplerConfig extends InstrumentConfig {
  /** Map of notes to sample URLs */
  samples?: SampleMap;
  /** Base URL for sample loading */
  baseUrl?: string;
  /** Attack time in seconds */
  attack?: number;
  /** Release time in seconds */
  release?: number;
  /** Curve type for envelope */
  curve?: 'linear' | 'exponential';
  /** Whether to enable round-robin sampling */
  roundRobin?: boolean;
  /** Number of velocity layers */
  velocityLayers?: number;
}

export interface LoadedSample {
  /** The audio buffer */
  buffer: AudioBuffer | any;
  /** The note this sample represents */
  note: string;
  /** Velocity range if applicable */
  velocityRange?: [number, number];
  /** Round-robin index */
  roundRobinIndex?: number;
}

/**
 * Base class for sample-based instruments
 */
export abstract class Sampler extends BaseInstrument {
  protected samples: Map<string, LoadedSample[]> = new Map();
  protected roundRobinCounters: Map<string, number> = new Map();
  protected attack: number;
  protected release: number;
  protected curve: 'linear' | 'exponential';
  protected roundRobin: boolean;
  protected velocityLayers: number;
  protected baseUrl?: string;
  protected sampler: any; // Tone.js sampler instance

  constructor(config: SamplerConfig) {
    super(config);
    this.attack = config.attack ?? 0.01;
    this.release = config.release ?? 0.1;
    this.curve = config.curve ?? 'exponential';
    this.roundRobin = config.roundRobin ?? false;
    this.velocityLayers = config.velocityLayers ?? 1;
    this.baseUrl = config.baseUrl;
  }

  /**
   * Load samples from URLs
   */
  async loadSamples(sampleMap: SampleMap): Promise<void> {
    this._state.isLoading = true;
    
    try {
      // Implementation depends on the audio library (Tone.js)
      // This is a placeholder for the actual loading logic
      await this.performSampleLoading(sampleMap);
      
      // Initialize round-robin counters
      if (this.roundRobin) {
        for (const note of this.samples.keys()) {
          this.roundRobinCounters.set(note, 0);
        }
      }
      
      this._state.isLoading = false;
    } catch (error) {
      this._state.isLoading = false;
      this._state.error = `Failed to load samples: ${error}`;
      throw error;
    }
  }

  /**
   * Get the next sample for round-robin playback
   */
  protected getNextSample(note: string, velocity: number = 64): LoadedSample | undefined {
    const samples = this.samples.get(note);
    if (!samples || samples.length === 0) return undefined;

    // Find samples matching velocity range
    const velocitySamples = this.velocityLayers > 1
      ? samples.filter(s => {
          if (!s.velocityRange) return true;
          return velocity >= s.velocityRange[0] && velocity <= s.velocityRange[1];
        })
      : samples;

    if (velocitySamples.length === 0) return samples[0]; // Fallback to first sample

    if (this.roundRobin && velocitySamples.length > 1) {
      const counter = this.roundRobinCounters.get(note) || 0;
      const sample = velocitySamples[counter % velocitySamples.length];
      this.roundRobinCounters.set(note, counter + 1);
      return sample;
    }

    return velocitySamples[0];
  }

  /**
   * Clear all loaded samples
   */
  clearSamples(): void {
    this.samples.clear();
    this.roundRobinCounters.clear();
  }

  /**
   * Get sample statistics
   */
  getSampleStats(): {
    totalSamples: number;
    loadedNotes: string[];
    memorySizeMB: number;
  } {
    let totalSamples = 0;
    let memorySize = 0;
    const loadedNotes: string[] = [];

    for (const [note, samples] of this.samples) {
      loadedNotes.push(note);
      totalSamples += samples.length;
      // Estimate memory size (simplified)
      samples.forEach(s => {
        if (s.buffer && typeof s.buffer === 'object') {
          // Rough estimate: 4 bytes per sample * sample rate * duration * channels
          memorySize += 4 * 48000 * 2 * 2; // Assume 2 seconds, stereo
        }
      });
    }

    return {
      totalSamples,
      loadedNotes,
      memorySizeMB: memorySize / (1024 * 1024),
    };
  }

  /**
   * Abstract method for actual sample loading implementation
   */
  protected abstract performSampleLoading(sampleMap: SampleMap): Promise<void>;

  getMetrics() {
    const baseMetrics = super.getMetrics();
    const stats = this.getSampleStats();
    
    return {
      ...baseMetrics,
      memoryUsage: stats.memorySizeMB,
      voiceCount: stats.totalSamples,
    };
  }
}