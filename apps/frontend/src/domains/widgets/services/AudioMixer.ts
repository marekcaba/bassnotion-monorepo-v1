'use client';

/**
 * AudioMixer Service
 *
 * Manages multiple audio sources with independent volume controls,
 * audio ducking, prioritization, and smooth cross-fading.
 *
 * Part of Story 3.5: Core Playback Integration
 */

export interface AudioSource {
  id: string;
  type: 'youtube' | 'bass' | 'metronome' | 'drums' | 'ui';
  node: AudioNode;
  gainNode: GainNode;
  volume: number; // 0-1
  muted: boolean;
  priority: number; // 1-10, higher = higher priority
  duckingEnabled: boolean;
  crossFadeEnabled: boolean;
}

export interface AudioMixerConfig {
  masterVolume: number;
  audioContext: AudioContext;
  duckingThreshold: number; // Volume level to trigger ducking (0-1)
  duckingRatio: number; // How much to reduce volume during ducking (0-1)
  crossFadeDuration: number; // Cross-fade duration in ms
  enableDynamicRangeCompression: boolean;
}

export interface DuckingConfig {
  enabled: boolean;
  priority: number;
  duckAmount: number; // 0-1 how much to reduce other sources
  fadeTime: number; // ms for fade in/out
}

export interface CrossFadeConfig {
  fromSource: string;
  toSource: string;
  duration: number; // ms
  curve: 'linear' | 'exponential' | 'logarithmic';
}

export interface MixerMetrics {
  totalSources: number;
  activeSources: number;
  masterVolume: number;
  cpuUsage: number;
  memoryUsage: number;
  peakLevel: number;
  rmsLevel: number;
  clippingEvents: number;
}

export class AudioMixer {
  private config: AudioMixerConfig;
  private audioContext: AudioContext;
  private masterGainNode: GainNode;
  private compressorNode: DynamicsCompressorNode | null = null;
  private analyserNode: AnalyserNode;
  private sources = new Map<string, AudioSource>();
  private duckingState = new Map<string, boolean>();
  private crossFadeTimeouts = new Map<string, NodeJS.Timeout>();

  // Audio analysis
  private audioData: Float32Array;
  private frequencyData: Uint8Array;
  private peakLevel = 0;
  private rmsLevel = 0;
  private clippingCount = 0;

  // Callbacks
  private onVolumeChange?: (sourceId: string, volume: number) => void;
  private onClipping?: (level: number) => void;
  private onDucking?: (sourceId: string, isDucked: boolean) => void;

  constructor(config: AudioMixerConfig) {
    this.config = config;
    this.audioContext = config.audioContext;

    // Create master gain node
    this.masterGainNode = this.audioContext.createGain();
    this.masterGainNode.gain.value = config.masterVolume;

    // Create compressor for dynamic range management
    if (config.enableDynamicRangeCompression) {
      this.compressorNode = this.audioContext.createDynamicsCompressor();
      this.compressorNode.threshold.value = -24;
      this.compressorNode.knee.value = 30;
      this.compressorNode.ratio.value = 12;
      this.compressorNode.attack.value = 0.003;
      this.compressorNode.release.value = 0.25;

      this.masterGainNode.connect(this.compressorNode);
    }

    // Create analyser for audio level monitoring
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 2048;
    this.analyserNode.smoothingTimeConstant = 0.8;

    // Connect analysis chain
    const analysisSource = this.compressorNode || this.masterGainNode;
    analysisSource.connect(this.analyserNode);
    this.analyserNode.connect(this.audioContext.destination);

    // Initialize analysis arrays
    this.audioData = new Float32Array(this.analyserNode.fftSize);
    this.frequencyData = new Uint8Array(this.analyserNode.frequencyBinCount);

    // Start audio analysis
    this.startAudioAnalysis();

    console.log('🎛️ AudioMixer initialized');
  }

  /**
   * Add an audio source to the mixer
   */
  public addSource(
    id: string,
    type: AudioSource['type'],
    audioNode: AudioNode,
    options: Partial<
      Pick<AudioSource, 'volume' | 'priority' | 'duckingEnabled'>
    > = {},
  ): AudioSource {
    // Create gain node for this source
    const gainNode = this.audioContext.createGain();
    const volume = options.volume ?? 0.8;
    gainNode.gain.value = volume;

    // Connect audio chain: source -> gain -> master
    audioNode.connect(gainNode);
    gainNode.connect(this.masterGainNode);

    const source: AudioSource = {
      id,
      type,
      node: audioNode,
      gainNode,
      volume,
      muted: false,
      priority: options.priority ?? 5,
      duckingEnabled: options.duckingEnabled ?? false,
      crossFadeEnabled: true,
    };

    this.sources.set(id, source);
    console.log(`🎵 Audio source added: ${id} (${type})`);

    return source;
  }

  /**
   * Remove an audio source from the mixer
   */
  public removeSource(id: string): void {
    const source = this.sources.get(id);
    if (!source) return;

    // Cancel any ongoing cross-fades
    const timeout = this.crossFadeTimeouts.get(id);
    if (timeout) {
      clearTimeout(timeout);
      this.crossFadeTimeouts.delete(id);
    }

    // Disconnect audio nodes
    source.node.disconnect();
    source.gainNode.disconnect();

    // Remove from collections
    this.sources.delete(id);
    this.duckingState.delete(id);

    console.log(`🎵 Audio source removed: ${id}`);
  }

  /**
   * Set volume for a specific source
   */
  public setSourceVolume(id: string, volume: number): void {
    const source = this.sources.get(id);
    if (!source) return;

    volume = Math.max(0, Math.min(1, volume));
    source.volume = volume;

    // Apply volume with smooth transition
    const currentTime = this.audioContext.currentTime;
    source.gainNode.gain.cancelScheduledValues(currentTime);
    source.gainNode.gain.setTargetAtTime(
      source.muted ? 0 : volume,
      currentTime,
      0.05, // 50ms smooth transition
    );

    if (this.onVolumeChange) {
      this.onVolumeChange(id, volume);
    }

    console.log(`🔊 Source volume changed: ${id} = ${volume.toFixed(2)}`);
  }

  /**
   * Set master volume
   */
  public setMasterVolume(volume: number): void {
    volume = Math.max(0, Math.min(1, volume));
    this.config.masterVolume = volume;

    const currentTime = this.audioContext.currentTime;
    this.masterGainNode.gain.cancelScheduledValues(currentTime);
    this.masterGainNode.gain.setTargetAtTime(volume, currentTime, 0.05);

    console.log(`🔊 Master volume changed: ${volume.toFixed(2)}`);
  }

  /**
   * Mute or unmute a source
   */
  public setSourceMute(id: string, muted: boolean): void {
    const source = this.sources.get(id);
    if (!source) return;

    source.muted = muted;

    const currentTime = this.audioContext.currentTime;
    const targetVolume = muted ? 0 : source.volume;

    source.gainNode.gain.cancelScheduledValues(currentTime);
    source.gainNode.gain.setTargetAtTime(targetVolume, currentTime, 0.05);

    console.log(`🔇 Source ${muted ? 'muted' : 'unmuted'}: ${id}`);
  }

  /**
   * Enable/disable ducking for a source
   */
  public enableDucking(id: string, config: DuckingConfig): void {
    const source = this.sources.get(id);
    if (!source) return;

    source.duckingEnabled = config.enabled;

    if (config.enabled) {
      // Duck other lower-priority sources
      this.duckOtherSources(id, config);
    } else {
      // Restore other sources
      this.restoreOtherSources(id);
    }

    console.log(
      `🦆 Ducking ${config.enabled ? 'enabled' : 'disabled'} for: ${id}`,
    );
  }

  /**
   * Duck other sources based on priority
   */
  private duckOtherSources(dominantId: string, config: DuckingConfig): void {
    const dominantSource = this.sources.get(dominantId);
    if (!dominantSource) return;

    this.sources.forEach((source, id) => {
      if (id === dominantId) return;

      // Duck sources with lower priority
      if (source.priority < dominantSource.priority) {
        const isDucked = this.duckingState.get(id) || false;
        if (!isDucked) {
          this.duckSource(id, config.duckAmount, config.fadeTime);
          this.duckingState.set(id, true);

          if (this.onDucking) {
            this.onDucking(id, true);
          }
        }
      }
    });
  }

  /**
   * Restore other sources from ducking
   */
  private restoreOtherSources(releasedId: string): void {
    this.sources.forEach((source, id) => {
      if (id === releasedId) return;

      const isDucked = this.duckingState.get(id) || false;
      if (isDucked) {
        this.restoreSource(id, 0.1); // 100ms restore time
        this.duckingState.set(id, false);

        if (this.onDucking) {
          this.onDucking(id, false);
        }
      }
    });
  }

  /**
   * Duck a specific source
   */
  private duckSource(id: string, duckAmount: number, fadeTime: number): void {
    const source = this.sources.get(id);
    if (!source) return;

    const currentTime = this.audioContext.currentTime;
    const targetVolume = source.volume * (1 - duckAmount);

    source.gainNode.gain.cancelScheduledValues(currentTime);
    source.gainNode.gain.linearRampToValueAtTime(
      targetVolume,
      currentTime + fadeTime / 1000,
    );
  }

  /**
   * Restore a source from ducking
   */
  private restoreSource(id: string, fadeTime: number): void {
    const source = this.sources.get(id);
    if (!source) return;

    const currentTime = this.audioContext.currentTime;

    source.gainNode.gain.cancelScheduledValues(currentTime);
    source.gainNode.gain.linearRampToValueAtTime(
      source.muted ? 0 : source.volume,
      currentTime + fadeTime,
    );
  }

  /**
   * Cross-fade between two sources
   */
  public crossFade(config: CrossFadeConfig): void {
    const fromSource = this.sources.get(config.fromSource);
    const toSource = this.sources.get(config.toSource);

    if (!fromSource || !toSource) {
      console.warn('❌ Cross-fade failed: source not found');
      return;
    }

    const currentTime = this.audioContext.currentTime;
    const duration = config.duration / 1000; // Convert to seconds

    // Cancel any existing scheduled values
    fromSource.gainNode.gain.cancelScheduledValues(currentTime);
    toSource.gainNode.gain.cancelScheduledValues(currentTime);

    // Set initial states
    fromSource.gainNode.gain.setValueAtTime(fromSource.volume, currentTime);
    toSource.gainNode.gain.setValueAtTime(0, currentTime);

    // Apply cross-fade curve
    switch (config.curve) {
      case 'linear':
        fromSource.gainNode.gain.linearRampToValueAtTime(
          0,
          currentTime + duration,
        );
        toSource.gainNode.gain.linearRampToValueAtTime(
          toSource.volume,
          currentTime + duration,
        );
        break;

      case 'exponential':
        fromSource.gainNode.gain.exponentialRampToValueAtTime(
          0.001,
          currentTime + duration,
        );
        toSource.gainNode.gain.exponentialRampToValueAtTime(
          toSource.volume,
          currentTime + duration,
        );
        break;

      case 'logarithmic':
        // Custom logarithmic curve using multiple linear segments
        this.applyLogarithmicCrossFade(
          fromSource,
          toSource,
          currentTime,
          duration,
        );
        break;
    }

    console.log(
      `🔄 Cross-fade: ${config.fromSource} → ${config.toSource} (${config.duration}ms)`,
    );
  }

  /**
   * Apply logarithmic cross-fade curve
   */
  private applyLogarithmicCrossFade(
    fromSource: AudioSource,
    toSource: AudioSource,
    startTime: number,
    duration: number,
  ): void {
    const segments = 10;
    const segmentDuration = duration / segments;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const time = startTime + i * segmentDuration;

      // Logarithmic curves
      const fromVolume = fromSource.volume * (1 - Math.log10(1 + 9 * t));
      const toVolume = toSource.volume * Math.log10(1 + 9 * t);

      fromSource.gainNode.gain.linearRampToValueAtTime(fromVolume, time);
      toSource.gainNode.gain.linearRampToValueAtTime(toVolume, time);
    }
  }

  /**
   * Start audio level analysis
   */
  private startAudioAnalysis(): void {
    const analyze = () => {
      if (this.audioContext.state !== 'running') {
        requestAnimationFrame(analyze);
        return;
      }

      // Get audio data
      this.analyserNode.getFloatTimeDomainData(this.audioData);
      this.analyserNode.getByteFrequencyData(this.frequencyData);

      // Calculate levels
      this.calculateAudioLevels();

      // Continue analysis
      requestAnimationFrame(analyze);
    };

    analyze();
  }

  /**
   * Calculate peak and RMS levels
   */
  private calculateAudioLevels(): void {
    let sum = 0;
    let peak = 0;

    for (let i = 0; i < this.audioData.length; i++) {
      const sample = Math.abs(this.audioData[i] || 0);
      sum += sample * sample;
      peak = Math.max(peak, sample);
    }

    this.peakLevel = peak;
    this.rmsLevel = Math.sqrt(sum / this.audioData.length);

    // Detect clipping
    if (peak > 0.99) {
      this.clippingCount++;
      if (this.onClipping) {
        this.onClipping(peak);
      }
    }
  }

  /**
   * Get current mixer metrics
   */
  public getMetrics(): MixerMetrics {
    return {
      totalSources: this.sources.size,
      activeSources: Array.from(this.sources.values()).filter((s) => !s.muted)
        .length,
      masterVolume: this.config.masterVolume,
      cpuUsage: 0, // Would need Web Audio API performance monitoring
      memoryUsage: 0, // Would need Memory API
      peakLevel: this.peakLevel,
      rmsLevel: this.rmsLevel,
      clippingEvents: this.clippingCount,
    };
  }

  /**
   * Set volume change callback
   */
  public onVolumeChanged(
    callback: (sourceId: string, volume: number) => void,
  ): void {
    this.onVolumeChange = callback;
  }

  /**
   * Set clipping detection callback
   */
  public onClippingDetected(callback: (level: number) => void): void {
    this.onClipping = callback;
  }

  /**
   * Set ducking callback
   */
  public onDuckingChanged(
    callback: (sourceId: string, isDucked: boolean) => void,
  ): void {
    this.onDucking = callback;
  }

  /**
   * Dispose of the mixer
   */
  public dispose(): void {
    // Clear timeouts
    this.crossFadeTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.crossFadeTimeouts.clear();

    // Disconnect all sources
    this.sources.forEach((source) => {
      source.node.disconnect();
      source.gainNode.disconnect();
    });
    this.sources.clear();

    // Disconnect master nodes
    this.masterGainNode.disconnect();
    if (this.compressorNode) {
      this.compressorNode.disconnect();
    }
    this.analyserNode.disconnect();

    // Clear callbacks
    this.onVolumeChange = undefined;
    this.onClipping = undefined;
    this.onDucking = undefined;

    console.log('🗑️ AudioMixer disposed');
  }
}
