/**
 * BassProcessor Plugin - Professional Bass Audio Processing
 *
 * Provides bass-specific audio processing including EQ, compression, and distortion
 * effects optimized for bass guitar frequencies. Demonstrates real-time audio
 * effects processing using the plugin architecture.
 *
 * Part of Story 2.1: Task 14, Subtask 14.4
 */

import * as Tone from 'tone';
import { BaseAudioPlugin } from '../BaseAudioPlugin.js';
import {
  PluginMetadata,
  PluginConfig,
  PluginCategory,
  PluginPriority,
  PluginAudioContext,
  PluginProcessingResult,
  ProcessingResultStatus,
  PluginParameterType,
} from '../../types/plugin.js';

export class BassProcessor extends BaseAudioPlugin {
  // Plugin metadata
  public readonly metadata: PluginMetadata = {
    id: 'bassnotion.bass-processor',
    name: 'Bass Processor',
    version: '1.0.0',
    description:
      'Professional bass guitar audio processing with EQ, compression, and distortion',
    author: 'BassNotion Team',
    homepage: 'https://bassnotion.com',
    license: 'MIT',
    category: PluginCategory.EFFECT,
    tags: ['bass', 'eq', 'compression', 'distortion', 'guitar'],
    capabilities: {
      supportsRealtimeProcessing: true,
      supportsOfflineProcessing: true,
      supportsAudioWorklet: false,
      supportsMIDI: false,
      supportsAutomation: true,
      supportsPresets: true,
      supportsSidechain: false,
      supportsMultiChannel: true,
      maxLatency: 10,
      cpuUsage: 0.15,
      memoryUsage: 8,
      minSampleRate: 44100,
      maxSampleRate: 192000,
      supportedBufferSizes: [128, 256, 512, 1024],
      supportsN8nPayload: true,
      supportsAssetLoading: false,
      supportsMobileOptimization: true,
    },
    dependencies: [],
    epicIntegration: {
      supportedMidiTypes: [],
      supportedAudioFormats: ['wav', 'mp3', 'ogg'],
      assetProcessingCapabilities: ['bass-enhancement', 'frequency-analysis'],
    },
  };

  public readonly config: PluginConfig = {
    id: this.metadata.id,
    name: this.metadata.name,
    version: this.metadata.version,
    category: PluginCategory.EFFECT,
    enabled: true,
    priority: PluginPriority.MEDIUM,
    autoStart: false,
    inputChannels: 2,
    outputChannels: 2,
    settings: {},
    maxCpuUsage: 20,
    maxMemoryUsage: 16,
    n8nIntegration: {
      acceptsPayload: true,
      payloadTypes: ['bass-settings', 'exercise-config'],
    },
  };

  public readonly capabilities = this.metadata.capabilities;

  // Audio processing chain
  private audioChain: Tone.ToneAudioNode[] = [];
  private eqLowShelf: Tone.EQ3 | null = null;
  private eqMid: Tone.Filter | null = null;
  private eqHighCut: Tone.Filter | null = null;
  private compressor: Tone.Compressor | null = null;
  private distortion: Tone.Distortion | null = null;
  private wetDryMix: Tone.CrossFade | null = null;
  private inputGain: Tone.Gain | null = null;
  private outputGain: Tone.Gain | null = null;

  // Processing state
  private processingMetrics = {
    processingTime: 0,
    cpuUsage: 0,
    memoryUsage: 0,
    samplesProcessed: 0,
  };

  // Effect bypass state
  private isBypassed = false;

  constructor() {
    super();
    this.initializeParameters();
  }

  protected async onLoad(): Promise<void> {
    console.log(`Loading BassProcessor plugin v${this.metadata.version}`);
  }

  protected async onInitialize(context: PluginAudioContext): Promise<void> {
    try {
      // Create audio processing chain
      await this.createAudioChain(context);

      // Initialize parameter values
      this.resetParametersToDefaults();

      console.log('BassProcessor initialized successfully');
    } catch (error) {
      console.error('Failed to initialize BassProcessor:', error);
      throw error;
    }
  }

  protected async onActivate(): Promise<void> {
    if (!this.audioChain.length) {
      throw new Error('Audio chain not initialized');
    }

    // Connect audio chain
    this.connectAudioChain();

    console.log('BassProcessor activated');
  }

  protected async onDeactivate(): Promise<void> {
    // Disconnect audio chain
    this.disconnectAudioChain();

    console.log('BassProcessor deactivated');
  }

  protected async onDispose(): Promise<void> {
    // Dispose all Tone.js nodes
    this.audioChain.forEach((node) => {
      try {
        node.dispose();
      } catch (error) {
        console.warn('Error disposing audio node:', error);
      }
    });

    this.audioChain = [];
    this.eqLowShelf = null;
    this.eqMid = null;
    this.eqHighCut = null;
    this.compressor = null;
    this.distortion = null;
    this.wetDryMix = null;
    this.inputGain = null;
    this.outputGain = null;

    console.log('BassProcessor disposed');
  }

  protected async onParameterChanged(
    parameterId: string,
    value: unknown,
  ): Promise<void> {
    try {
      switch (parameterId) {
        case 'lowShelf':
          if (this.eqLowShelf) {
            this.eqLowShelf.low.value = value as number;
          }
          break;

        case 'lowShelfFreq':
          if (this.eqLowShelf) {
            this.eqLowShelf.lowFrequency.value = value as number;
          }
          break;

        case 'midGain':
          if (this.eqMid) {
            this.eqMid.gain.value = value as number;
          }
          break;

        case 'midFreq':
          if (this.eqMid) {
            this.eqMid.frequency.value = value as number;
          }
          break;

        case 'midQ':
          if (this.eqMid) {
            this.eqMid.Q.value = value as number;
          }
          break;

        case 'highCut':
          if (this.eqHighCut) {
            this.eqHighCut.frequency.value = value as number;
          }
          break;

        case 'compressorRatio':
          if (this.compressor) {
            this.compressor.ratio.value = value as number;
          }
          break;

        case 'compressorThreshold':
          if (this.compressor) {
            this.compressor.threshold.value = value as number;
          }
          break;

        case 'compressorAttack':
          if (this.compressor) {
            this.compressor.attack.value = value as number;
          }
          break;

        case 'compressorRelease':
          if (this.compressor) {
            this.compressor.release.value = value as number;
          }
          break;

        case 'compressorKnee':
          if (this.compressor) {
            this.compressor.knee.value = value as number;
          }
          break;

        case 'distortionDrive':
          if (this.distortion) {
            (this.distortion.distortion as any).value = (value as number) / 100;
          }
          break;

        case 'distortionLevel':
          if (this.outputGain) {
            this.outputGain.gain.value = Tone.dbToGain(
              ((value as number) / 100) * 12 - 12,
            );
          }
          break;

        case 'bypass':
          this.isBypassed = value as boolean;
          if (this.wetDryMix) {
            this.wetDryMix.fade.value = this.isBypassed
              ? 0
              : (this.getParameter('wetDryMix') as number) / 100;
          }
          break;

        case 'wetDryMix':
          if (this.wetDryMix && !this.isBypassed) {
            this.wetDryMix.fade.value = (value as number) / 100;
          }
          break;

        default:
          console.warn(`Unknown parameter: ${parameterId}`);
      }
    } catch (error) {
      console.error(`Error setting parameter ${parameterId}:`, error);
    }
  }

  public async process(
    inputBuffer: AudioBuffer,
    outputBuffer: AudioBuffer,
    _context: PluginAudioContext,
  ): Promise<PluginProcessingResult> {
    const startTime = performance.now();

    try {
      // If bypassed, copy input to output
      if (this.isBypassed) {
        this.copyAudioBuffer(inputBuffer, outputBuffer);
        return {
          status: ProcessingResultStatus.SUCCESS,
          success: true,
          bypassMode: true,
          processedSamples: inputBuffer.length,
          processingTime: performance.now() - startTime,
          cpuUsage: 0,
          memoryUsage: this.processingMetrics.memoryUsage,
          metadata: { bypassed: true },
        };
      }

      // Audio processing is handled by Tone.js audio graph
      // This is primarily for metrics and monitoring
      this.processingMetrics.samplesProcessed += inputBuffer.length;
      this.processingMetrics.processingTime = performance.now() - startTime;
      this.processingMetrics.cpuUsage = this.estimateCpuUsage();
      this.processingMetrics.memoryUsage = this.estimateMemoryUsage();

      return {
        status: ProcessingResultStatus.SUCCESS,
        success: true,
        bypassMode: false,
        processedSamples: inputBuffer.length,
        processingTime: this.processingMetrics.processingTime,
        cpuUsage: this.processingMetrics.cpuUsage,
        memoryUsage: this.processingMetrics.memoryUsage,
        metadata: {
          lowShelf: this.getParameter('lowShelf'),
          compression: this.getParameter('compressorRatio'),
          distortion: this.getParameter('distortionDrive'),
        },
      };
    } catch (error) {
      return {
        status: ProcessingResultStatus.ERROR,
        success: false,
        bypassMode: false,
        processedSamples: 0,
        processingTime: performance.now() - startTime,
        cpuUsage: 0,
        memoryUsage: this.processingMetrics.memoryUsage,
        error: error as Error,
        metadata: { error: (error as Error).message },
      };
    }
  }

  public getToneNode(): Tone.ToneAudioNode | null {
    return this.inputGain;
  }

  public connectToTone(destination: Tone.ToneAudioNode): void {
    if (this.outputGain) {
      this.outputGain.connect(destination);
    }
  }

  public disconnectFromTone(): void {
    if (this.outputGain) {
      this.outputGain.disconnect();
    }
  }

  public async processN8nPayload(payload: unknown): Promise<void> {
    try {
      const bassPayload = payload as {
        bassSettings?: {
          style?: 'rock' | 'jazz' | 'funk' | 'metal';
          intensity?: number;
          frequency?: 'low' | 'mid' | 'high';
        };
      };

      if (bassPayload.bassSettings) {
        await this.applyBassStylePreset(bassPayload.bassSettings);
      }
    } catch (error) {
      console.error('Error processing n8n payload:', error);
    }
  }

  // Private methods

  private async createAudioChain(_context: PluginAudioContext): Promise<void> {
    // Input gain
    this.inputGain = new Tone.Gain(1);

    // EQ - Low shelf
    this.eqLowShelf = new Tone.EQ3();

    // EQ - Mid frequency
    this.eqMid = new Tone.Filter(800, 'peaking');

    // EQ - High cut
    this.eqHighCut = new Tone.Filter(4000, 'lowpass');

    // Compressor
    this.compressor = new Tone.Compressor({
      ratio: 4,
      threshold: -24,
      attack: 0.003,
      release: 0.1,
      knee: 30,
    });

    // Distortion
    this.distortion = new Tone.Distortion(0.2);

    // Output gain
    this.outputGain = new Tone.Gain(1);

    // Wet/dry mix
    this.wetDryMix = new Tone.CrossFade(1);

    // Store in audio chain for management
    this.audioChain = [
      this.inputGain,
      this.eqLowShelf,
      this.eqMid,
      this.eqHighCut,
      this.compressor,
      this.distortion,
      this.outputGain,
      this.wetDryMix,
    ];
  }

  private connectAudioChain(): void {
    if (!this.inputGain || !this.outputGain || !this.wetDryMix) return;

    // Connect dry signal path
    this.inputGain.connect(this.wetDryMix.a);

    // Connect wet signal path
    if (
      this.eqLowShelf &&
      this.eqMid &&
      this.eqHighCut &&
      this.compressor &&
      this.distortion &&
      this.wetDryMix
    ) {
      this.inputGain.chain(
        this.eqLowShelf,
        this.eqMid,
        this.eqHighCut,
        this.compressor,
        this.distortion,
        this.wetDryMix.b,
      );
    }

    // Connect output
    this.wetDryMix.connect(this.outputGain);
  }

  private disconnectAudioChain(): void {
    this.audioChain.forEach((node) => {
      try {
        node.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    });
  }

  protected initializeParameters(): void {
    // EQ parameters
    this.addParameter({
      id: 'lowShelf',
      name: 'Low Shelf',
      type: PluginParameterType.FLOAT,
      defaultValue: 0,
      minValue: -12,
      maxValue: 12,
      unit: 'dB',
      description: 'Low frequency shelf gain',
      automatable: true,
    });

    this.addParameter({
      id: 'lowShelfFreq',
      name: 'Low Shelf Frequency',
      type: PluginParameterType.FLOAT,
      defaultValue: 100,
      minValue: 40,
      maxValue: 200,
      unit: 'Hz',
      description: 'Low shelf frequency',
      automatable: true,
    });

    this.addParameter({
      id: 'midGain',
      name: 'Mid Gain',
      type: PluginParameterType.FLOAT,
      defaultValue: 0,
      minValue: -12,
      maxValue: 12,
      unit: 'dB',
      description: 'Mid frequency gain',
      automatable: true,
    });

    this.addParameter({
      id: 'midFreq',
      name: 'Mid Frequency',
      type: PluginParameterType.FLOAT,
      defaultValue: 800,
      minValue: 200,
      maxValue: 2000,
      unit: 'Hz',
      description: 'Mid frequency',
      automatable: true,
    });

    this.addParameter({
      id: 'midQ',
      name: 'Mid Q',
      type: PluginParameterType.FLOAT,
      defaultValue: 1,
      minValue: 0.1,
      maxValue: 10,
      unit: '',
      description: 'Mid frequency Q factor',
      automatable: true,
    });

    this.addParameter({
      id: 'highCut',
      name: 'High Cut',
      type: PluginParameterType.FLOAT,
      defaultValue: 4000,
      minValue: 2000,
      maxValue: 8000,
      unit: 'Hz',
      description: 'High cut frequency',
      automatable: true,
    });

    // Compression parameters
    this.addParameter({
      id: 'compressorRatio',
      name: 'Compression Ratio',
      type: PluginParameterType.FLOAT,
      defaultValue: 4,
      minValue: 1,
      maxValue: 10,
      unit: ':1',
      description: 'Compression ratio',
      automatable: true,
    });

    this.addParameter({
      id: 'compressorThreshold',
      name: 'Compression Threshold',
      type: PluginParameterType.FLOAT,
      defaultValue: -24,
      minValue: -40,
      maxValue: 0,
      unit: 'dB',
      description: 'Compression threshold',
      automatable: true,
    });

    this.addParameter({
      id: 'compressorAttack',
      name: 'Compression Attack',
      type: PluginParameterType.FLOAT,
      defaultValue: 0.003,
      minValue: 0.001,
      maxValue: 0.1,
      unit: 's',
      description: 'Compression attack time',
      automatable: true,
    });

    this.addParameter({
      id: 'compressorRelease',
      name: 'Compression Release',
      type: PluginParameterType.FLOAT,
      defaultValue: 0.1,
      minValue: 0.01,
      maxValue: 1,
      unit: 's',
      description: 'Compression release time',
      automatable: true,
    });

    this.addParameter({
      id: 'compressorKnee',
      name: 'Compression Knee',
      type: PluginParameterType.FLOAT,
      defaultValue: 30,
      minValue: 0,
      maxValue: 40,
      unit: 'dB',
      description: 'Compression knee',
      automatable: true,
    });

    // Distortion parameters
    this.addParameter({
      id: 'distortionDrive',
      name: 'Distortion Drive',
      type: PluginParameterType.FLOAT,
      defaultValue: 20,
      minValue: 0,
      maxValue: 100,
      unit: '%',
      description: 'Distortion drive amount',
      automatable: true,
    });

    this.addParameter({
      id: 'distortionTone',
      name: 'Distortion Tone',
      type: PluginParameterType.FLOAT,
      defaultValue: 50,
      minValue: 0,
      maxValue: 100,
      unit: '%',
      description: 'Distortion tone control',
      automatable: true,
    });

    this.addParameter({
      id: 'distortionLevel',
      name: 'Distortion Level',
      type: PluginParameterType.FLOAT,
      defaultValue: 50,
      minValue: 0,
      maxValue: 100,
      unit: '%',
      description: 'Distortion output level',
      automatable: true,
    });

    // Global parameters
    this.addParameter({
      id: 'bypass',
      name: 'Bypass',
      type: PluginParameterType.BOOLEAN,
      defaultValue: false,
      description: 'Effect bypass',
      automatable: false,
    });

    this.addParameter({
      id: 'wetDryMix',
      name: 'Wet/Dry Mix',
      type: PluginParameterType.FLOAT,
      defaultValue: 100,
      minValue: 0,
      maxValue: 100,
      unit: '%',
      description: 'Wet/dry mix ratio',
      automatable: true,
    });
  }

  private resetParametersToDefaults(): void {
    this.parameters.forEach((param) => {
      this.setParameter(param.id, param.defaultValue);
    });
  }

  private async applyBassStylePreset(settings: any): Promise<void> {
    const { style = 'rock', intensity = 50, frequency = 'mid' } = settings;

    switch (style) {
      case 'rock':
        await this.setParameter('lowShelf', 2 + intensity / 50);
        await this.setParameter('midGain', 1 + intensity / 100);
        await this.setParameter('distortionDrive', 30 + intensity / 2);
        break;

      case 'jazz':
        await this.setParameter('lowShelf', -1);
        await this.setParameter('midGain', -0.5);
        await this.setParameter('compressorRatio', 2 + intensity / 50);
        await this.setParameter('distortionDrive', 5);
        break;

      case 'funk':
        await this.setParameter('lowShelf', 3);
        await this.setParameter('midGain', 2);
        await this.setParameter('compressorRatio', 6 + intensity / 25);
        await this.setParameter('distortionDrive', 15);
        break;

      case 'metal':
        await this.setParameter('lowShelf', 1);
        await this.setParameter('midGain', 3);
        await this.setParameter('distortionDrive', 60 + intensity / 2);
        await this.setParameter('compressorRatio', 8);
        break;
    }

    // Adjust for frequency preference
    switch (frequency) {
      case 'low':
        await this.setParameter('lowShelfFreq', 80);
        await this.setParameter('midFreq', 400);
        break;
      case 'mid':
        await this.setParameter('lowShelfFreq', 100);
        await this.setParameter('midFreq', 800);
        break;
      case 'high':
        await this.setParameter('lowShelfFreq', 150);
        await this.setParameter('midFreq', 1200);
        break;
    }
  }

  private copyAudioBuffer(source: AudioBuffer, destination: AudioBuffer): void {
    for (
      let channel = 0;
      channel < Math.min(source.numberOfChannels, destination.numberOfChannels);
      channel++
    ) {
      const sourceData = source.getChannelData(channel);
      const destData = destination.getChannelData(channel);
      destData.set(sourceData);
    }
  }

  private estimateCpuUsage(): number {
    // Estimate CPU usage based on active effects
    let usage = 0.02; // Base usage

    if (!this.isBypassed) {
      usage += 0.03; // EQ
      usage += 0.04; // Compressor
      usage += 0.03; // Distortion
    }

    return Math.min(usage, this.capabilities.cpuUsage);
  }

  private estimateMemoryUsage(): number {
    return this.capabilities.memoryUsage;
  }
}
