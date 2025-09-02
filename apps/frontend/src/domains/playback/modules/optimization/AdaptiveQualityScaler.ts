/**
 * Adaptive Quality Scaler
 * 
 * Automatically adjusts quality settings based on device capabilities
 * to maintain optimal performance. Extracted from PerformanceOptimizer.
 */

import type { 
  DeviceCapabilities, 
  QualitySettings,
  IAdaptiveQualityScaler 
} from './types';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('AdaptiveQualityScaler');

export class AdaptiveQualityScaler implements IAdaptiveQualityScaler {
  private recommendations: string[] = [];
  
  /**
   * Calculate optimal quality settings based on device capabilities
   */
  async calculateOptimalSettings(capabilities: DeviceCapabilities): Promise<QualitySettings> {
    logger.info('🎯 Calculating optimal quality settings...', {
      platform: capabilities.platform,
      cpuPerformance: capabilities.cpu.performance,
      memoryTotal: capabilities.memory.total,
      batteryLevel: capabilities.battery.level,
    });
    
    this.recommendations = [];
    
    const settings: QualitySettings = {
      audio: this.calculateAudioSettings(capabilities),
      instruments: this.calculateInstrumentSettings(capabilities),
      processing: this.calculateProcessingSettings(capabilities),
      visual: this.calculateVisualSettings(capabilities),
    };
    
    this.generateRecommendations(capabilities, settings);
    
    logger.info('✅ Optimal quality settings calculated:', {
      audioSampleRate: settings.audio.sampleRate,
      instrumentPolyphony: settings.instruments.polyphony,
      processingFeatures: Object.values(settings.processing).filter(Boolean).length,
      visualFrameRate: settings.visual.frameRate,
    });
    
    return settings;
  }
  
  /**
   * Calculate audio quality settings
   */
  private calculateAudioSettings(capabilities: DeviceCapabilities): QualitySettings['audio'] {
    const { cpu, memory, network, battery, platform } = capabilities;
    
    let sampleRate = capabilities.audio.sampleRate;
    let bitDepth = 24;
    let bufferSize = 256;
    let compression: 'none' | 'low' | 'medium' | 'high' = 'none';
    
    // Platform-specific audio settings
    if (platform === 'mobile') {
      bufferSize = 512; // Higher buffer for mobile stability
      if (battery.level < 20) {
        sampleRate = Math.min(sampleRate, 44100);
        bitDepth = 16;
        compression = 'medium';
      }
    }
    
    // CPU performance adjustments
    if (cpu.performance === 'low') {
      sampleRate = Math.min(sampleRate, 44100);
      bitDepth = 16;
      bufferSize = 512;
      compression = 'medium';
    } else if (cpu.performance === 'ultra') {
      sampleRate = Math.max(sampleRate, 48000);
      bitDepth = 24;
      bufferSize = 128;
    }
    
    // Memory constraints
    if (memory.total < 2048) { // Less than 2GB
      compression = 'high';
    } else if (memory.usage > 80) {
      compression = 'medium';
    }
    
    // Network-based compression
    if (network.speed === 'slow') {
      compression = 'high';
    } else if (network.speed === 'medium') {
      compression = compression === 'none' ? 'low' : compression;
    }
    
    return {
      sampleRate,
      bitDepth,
      bufferSize,
      compression,
    };
  }
  
  /**
   * Calculate instrument quality settings
   */
  private calculateInstrumentSettings(capabilities: DeviceCapabilities): QualitySettings['instruments'] {
    const { cpu, memory, battery, platform } = capabilities;
    
    let polyphony = 16;
    let velocityLayers = 6;
    let roundRobinSamples = 3;
    let reverbQuality: 'off' | 'low' | 'medium' | 'high' = 'high';
    
    // CPU performance scaling
    switch (cpu.performance) {
      case 'low':
        polyphony = 8;
        velocityLayers = 3;
        roundRobinSamples = 1;
        reverbQuality = 'low';
        break;
      case 'medium':
        polyphony = 12;
        velocityLayers = 4;
        roundRobinSamples = 2;
        reverbQuality = 'medium';
        break;
      case 'high':
        polyphony = 16;
        velocityLayers = 6;
        roundRobinSamples = 3;
        reverbQuality = 'high';
        break;
      case 'ultra':
        polyphony = 24;
        velocityLayers = 8;
        roundRobinSamples = 4;
        reverbQuality = 'high';
        break;
    }
    
    // Memory constraints
    if (memory.total < 2048) {
      polyphony = Math.min(polyphony, 8);
      velocityLayers = Math.min(velocityLayers, 3);
      roundRobinSamples = 1;
    } else if (memory.total < 4096) {
      polyphony = Math.min(polyphony, 12);
      velocityLayers = Math.min(velocityLayers, 4);
    }
    
    // Platform-specific adjustments
    if (platform === 'mobile') {
      polyphony = Math.min(polyphony, 12);
      if (battery.level < 30) {
        polyphony = Math.min(polyphony, 8);
        reverbQuality = reverbQuality === 'high' ? 'medium' : 'low';
      }
    }
    
    return {
      polyphony,
      velocityLayers,
      roundRobinSamples,
      reverbQuality,
    };
  }
  
  /**
   * Calculate processing feature settings
   */
  private calculateProcessingSettings(capabilities: DeviceCapabilities): QualitySettings['processing'] {
    const { cpu, battery, platform } = capabilities;
    
    let humanization = true;
    let microTiming = true;
    let advancedArticulation = true;
    let contextAnalysis = true;
    
    // CPU performance scaling
    if (cpu.performance === 'low') {
      humanization = false;
      microTiming = false;
      advancedArticulation = false;
      contextAnalysis = false;
    } else if (cpu.performance === 'medium') {
      humanization = true;
      microTiming = false;
      advancedArticulation = false;
      contextAnalysis = true;
    } else if (cpu.performance === 'high') {
      humanization = true;
      microTiming = true;
      advancedArticulation = false;
      contextAnalysis = true;
    }
    // Ultra keeps all features enabled
    
    // Mobile and battery optimizations
    if (platform === 'mobile' && battery.level < 20) {
      humanization = false;
      microTiming = false;
      advancedArticulation = false;
    } else if (platform === 'mobile' && battery.level < 50) {
      advancedArticulation = false;
    }
    
    return {
      humanization,
      microTiming,
      advancedArticulation,
      contextAnalysis,
    };
  }
  
  /**
   * Calculate visual quality settings
   */
  private calculateVisualSettings(capabilities: DeviceCapabilities): QualitySettings['visual'] {
    const { cpu, battery, platform } = capabilities;
    
    let frameRate = 60;
    let animations = true;
    let effects: 'minimal' | 'standard' | 'enhanced' = 'enhanced';
    
    // Platform-specific visual settings
    if (platform === 'mobile') {
      frameRate = 30; // Mobile devices often benefit from 30fps
      if (battery.level < 30) {
        animations = false;
        effects = 'minimal';
      } else if (battery.level < 60) {
        effects = 'standard';
      }
    }
    
    // CPU performance scaling
    if (cpu.performance === 'low') {
      frameRate = 30;
      animations = false;
      effects = 'minimal';
    } else if (cpu.performance === 'medium') {
      frameRate = 60;
      effects = 'standard';
    }
    // High and ultra keep enhanced settings
    
    return {
      frameRate,
      animations,
      effects,
    };
  }
  
  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(capabilities: DeviceCapabilities, settings: QualitySettings): void {
    const { cpu, memory, battery, platform, network } = capabilities;
    
    // CPU recommendations
    if (cpu.performance === 'low') {
      this.recommendations.push('Consider closing other applications to improve CPU performance');
    }
    
    // Memory recommendations
    if (memory.usage > 80) {
      this.recommendations.push('High memory usage detected - consider reducing sample quality');
    }
    if (memory.total < 4096) {
      this.recommendations.push('Limited memory available - reduced polyphony and samples');
    }
    
    // Battery recommendations
    if (platform === 'mobile') {
      if (battery.level < 20) {
        this.recommendations.push('Low battery detected - enabled aggressive power saving');
      } else if (battery.level < 50 && !battery.charging) {
        this.recommendations.push('Battery optimization enabled - some features reduced');
      }
    }
    
    // Network recommendations
    if (network.speed === 'slow') {
      this.recommendations.push('Slow network detected - enabled high compression');
    }
    if (network.type === 'cellular') {
      this.recommendations.push('Cellular connection detected - optimized for data usage');
    }
    
    // Quality settings feedback
    if (settings.audio.compression !== 'none') {
      this.recommendations.push(`Audio compression set to ${settings.audio.compression} for optimal performance`);
    }
    if (settings.instruments.polyphony < 16) {
      this.recommendations.push(`Polyphony limited to ${settings.instruments.polyphony} for device compatibility`);
    }
    
    // General recommendations
    this.recommendations.push('Quality settings automatically optimized for your device');
    if (platform === 'mobile') {
      this.recommendations.push('Mobile optimizations applied for better battery life');
    }
  }
  
  /**
   * Get current recommendations
   */
  getRecommendations(): string[] {
    return [...this.recommendations];
  }
  
  /**
   * Dispose of the adaptive quality scaler
   */
  async dispose(): Promise<void> {
    this.recommendations = [];
    logger.info('🧹 AdaptiveQualityScaler disposed');
  }
}