/**
 * WAM Device Optimizer
 *
 * Optimizes WAM plugin performance based on device capabilities,
 * ensuring smooth playback across different hardware configurations.
 *
 * Features:
 * - Device-specific plugin configuration
 * - Dynamic quality adjustment
 * - CPU/memory usage monitoring
 * - Automatic plugin disabling on overload
 * - Mobile-specific optimizations
 *
 * Part of Story 3.21 Task 7 - Web Audio Standards Compliance
 */

import type { AudioPlugin, PluginConfig } from '../../../../types/plugin.js';
import type { WamPluginRegistration } from '../../../../types/wam.js';
import { WamHostManager } from './WamHostManager.js';
import { DeviceCapabilityDetector } from '../../../optimization/DeviceCapabilityDetector.js';
import { PerformanceOptimizer } from '../../../optimization/PerformanceOptimizer.js';
import { serviceRegistry } from '../../../../services/core/ServiceRegistry.js';
import { EventBus } from '../../../../services/core/EventBus.js';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('WamDeviceOptimizer');

/**
 * Device optimization profile
 */
export interface DeviceOptimizationProfile {
  name: string;
  maxPluginsPerTrack: number;
  maxTotalPlugins: number;
  maxCpuUsage: number;
  maxMemoryUsage: number;
  disableEffectsOnOverload: boolean;
  reduceSampleRateOnOverload: boolean;
  useSimplifiedGUI: boolean;
  disableVisualization: boolean;
  bufferSizeMultiplier: number;
}

/**
 * Plugin quality preset
 */
export interface PluginQualityPreset {
  name: string;
  oversampling: number;
  bufferSize: number;
  processingQuality: 'low' | 'medium' | 'high' | 'ultra';
  disabledFeatures: string[];
}

/**
 * Optimization state
 */
export interface OptimizationState {
  currentProfile: DeviceOptimizationProfile;
  currentQuality: PluginQualityPreset;
  isOverloaded: boolean;
  cpuUsage: number;
  memoryUsage: number;
  disabledPlugins: Set<string>;
  throttledPlugins: Set<string>;
}

/**
 * WAM Device Optimizer Service
 */
export class WamDeviceOptimizer {
  private static instance: WamDeviceOptimizer | null = null;

  // Optimization profiles
  private readonly profiles: Map<string, DeviceOptimizationProfile> = new Map([
    [
      'high-end',
      {
        name: 'high-end',
        maxPluginsPerTrack: 16,
        maxTotalPlugins: 64,
        maxCpuUsage: 0.8,
        maxMemoryUsage: 1024, // MB
        disableEffectsOnOverload: false,
        reduceSampleRateOnOverload: false,
        useSimplifiedGUI: false,
        disableVisualization: false,
        bufferSizeMultiplier: 1,
      },
    ],
    [
      'mid-range',
      {
        name: 'mid-range',
        maxPluginsPerTrack: 8,
        maxTotalPlugins: 32,
        maxCpuUsage: 0.6,
        maxMemoryUsage: 512,
        disableEffectsOnOverload: true,
        reduceSampleRateOnOverload: false,
        useSimplifiedGUI: false,
        disableVisualization: false,
        bufferSizeMultiplier: 2,
      },
    ],
    [
      'low-end',
      {
        name: 'low-end',
        maxPluginsPerTrack: 4,
        maxTotalPlugins: 16,
        maxCpuUsage: 0.4,
        maxMemoryUsage: 256,
        disableEffectsOnOverload: true,
        reduceSampleRateOnOverload: true,
        useSimplifiedGUI: true,
        disableVisualization: true,
        bufferSizeMultiplier: 4,
      },
    ],
    [
      'mobile',
      {
        name: 'mobile',
        maxPluginsPerTrack: 2,
        maxTotalPlugins: 8,
        maxCpuUsage: 0.3,
        maxMemoryUsage: 128,
        disableEffectsOnOverload: true,
        reduceSampleRateOnOverload: true,
        useSimplifiedGUI: true,
        disableVisualization: true,
        bufferSizeMultiplier: 8,
      },
    ],
  ]);

  // Quality presets
  private readonly qualityPresets: Map<string, PluginQualityPreset> = new Map([
    [
      'ultra',
      {
        name: 'ultra',
        oversampling: 4,
        bufferSize: 128,
        processingQuality: 'ultra',
        disabledFeatures: [],
      },
    ],
    [
      'high',
      {
        name: 'high',
        oversampling: 2,
        bufferSize: 256,
        processingQuality: 'high',
        disabledFeatures: [],
      },
    ],
    [
      'medium',
      {
        name: 'medium',
        oversampling: 1,
        bufferSize: 512,
        processingQuality: 'medium',
        disabledFeatures: ['convolution', 'granular'],
      },
    ],
    [
      'low',
      {
        name: 'low',
        oversampling: 1,
        bufferSize: 1024,
        processingQuality: 'low',
        disabledFeatures: [
          'convolution',
          'granular',
          'reverb-tails',
          'modulation',
        ],
      },
    ],
  ]);

  // Current state
  private state: OptimizationState;

  // Services
  private hostManager: WamHostManager;
  private deviceCapabilityDetector?: DeviceCapabilityDetector;
  private performanceOptimizer?: PerformanceOptimizer;
  private eventBus?: EventBus;

  // Monitoring
  private monitoringInterval: number | null = null;
  private readonly monitoringPeriod = 1000; // 1 second

  private constructor() {
    // Get services
    this.hostManager = WamHostManager.getInstance();

    try {
      this.deviceCapabilityDetector =
        serviceRegistry.get<DeviceCapabilityDetector>(
          'deviceCapabilityDetector',
        );
      this.performanceOptimizer = serviceRegistry.get<PerformanceOptimizer>(
        'performanceOptimizer',
      );
      this.eventBus = serviceRegistry.get<EventBus>('eventBus');
    } catch (e) {
      logger.warn('Some services not found in ServiceRegistry');
    }

    // Initialize state
    this.state = {
      currentProfile: this.profiles.get('high-end')!,
      currentQuality: this.qualityPresets.get('high')!,
      isOverloaded: false,
      cpuUsage: 0,
      memoryUsage: 0,
      disabledPlugins: new Set(),
      throttledPlugins: new Set(),
    };

    // Select initial profile based on device
    this.selectOptimalProfile();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): WamDeviceOptimizer {
    if (!WamDeviceOptimizer.instance) {
      WamDeviceOptimizer.instance = new WamDeviceOptimizer();
    }
    return WamDeviceOptimizer.instance;
  }

  /**
   * Start optimization monitoring
   */
  startMonitoring(): void {
    if (this.monitoringInterval) return;

    this.monitoringInterval = window.setInterval(() => {
      this.monitorPerformance();
    }, this.monitoringPeriod);

    logger.info('✅ WAM Device Optimizer monitoring started');
  }

  /**
   * Stop optimization monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Get optimal plugin configuration for current device
   */
  getOptimalPluginConfig(baseConfig: Partial<PluginConfig>): PluginConfig {
    const profile = this.state.currentProfile;
    const quality = this.state.currentQuality;

    return {
      ...baseConfig,
      settings: {
        ...baseConfig.settings,
        bufferSize: quality.bufferSize * profile.bufferSizeMultiplier,
        oversampling: quality.oversampling,
        quality: quality.processingQuality,
        useSimplifiedGUI: profile.useSimplifiedGUI,
        disableVisualization: profile.disableVisualization,
        disabledFeatures: quality.disabledFeatures,
      },
    } as PluginConfig;
  }

  /**
   * Check if plugin should be loaded
   */
  shouldLoadPlugin(
    registration: WamPluginRegistration,
    trackPluginCount: number,
  ): boolean {
    const profile = this.state.currentProfile;

    // Check track limit
    if (trackPluginCount >= profile.maxPluginsPerTrack) {
      return false;
    }

    // Check total limit
    const totalPlugins = this.hostManager.getPerformanceReport().totalPlugins;
    if (totalPlugins >= profile.maxTotalPlugins) {
      return false;
    }

    // Check if plugin is disabled due to overload
    if (this.state.disabledPlugins.has(registration.moduleId)) {
      return false;
    }

    // Check CPU headroom
    if (this.state.cpuUsage > profile.maxCpuUsage * 0.9) {
      // Only allow essential plugins when near limit
      return registration.descriptor.keywords.includes('essential');
    }

    return true;
  }

  /**
   * Optimize plugin for device
   */
  optimizePlugin(plugin: AudioPlugin): void {
    const instanceId = plugin.config.id;

    // Apply quality settings
    const quality = this.state.currentQuality;

    if (plugin.setParameter) {
      // Set quality parameters if supported
      plugin.setParameter('oversampling', quality.oversampling);
      plugin.setParameter('bufferSize', quality.bufferSize);
      plugin.setParameter('quality', quality.processingQuality);
    }

    // Disable features if needed
    if (quality.disabledFeatures.length > 0) {
      for (const feature of quality.disabledFeatures) {
        plugin.setParameter(`disable_${feature}`, true);
      }
    }

    // Track optimization
    this.eventBus?.emit('wam:optimizer:plugin-optimized', {
      instanceId,
      profile: this.state.currentProfile.name,
      quality: quality.name,
    });
  }

  /**
   * Handle performance overload
   */
  handleOverload(): void {
    if (this.state.isOverloaded) return;

    this.state.isOverloaded = true;
    const profile = this.state.currentProfile;

    logger.warn('⚠️ Performance overload detected, applying optimizations...');

    // Step 1: Reduce quality
    this.reduceQuality();

    // Step 2: Disable non-essential effects
    if (profile.disableEffectsOnOverload) {
      this.disableNonEssentialEffects();
    }

    // Step 3: Reduce sample rate if still overloaded
    if (
      profile.reduceSampleRateOnOverload &&
      this.state.cpuUsage > profile.maxCpuUsage
    ) {
      this.reduceSampleRate();
    }

    // Emit overload event
    this.eventBus?.emit('wam:optimizer:overload', {
      cpuUsage: this.state.cpuUsage,
      memoryUsage: this.state.memoryUsage,
      actions: ['reduce-quality', 'disable-effects', 'reduce-sample-rate'],
    });
  }

  /**
   * Recover from overload
   */
  recoverFromOverload(): void {
    if (!this.state.isOverloaded) return;

    this.state.isOverloaded = false;

    logger.info('✅ Performance recovered, restoring settings...');

    // Re-enable disabled plugins gradually
    const disabledPlugins = Array.from(this.state.disabledPlugins);
    for (const pluginId of disabledPlugins) {
      // Re-enable one at a time and monitor
      this.state.disabledPlugins.delete(pluginId);

      // Check if we're still OK
      if (this.state.cpuUsage > this.state.currentProfile.maxCpuUsage * 0.8) {
        // Stop re-enabling
        this.state.disabledPlugins.add(pluginId);
        break;
      }
    }

    // Restore quality if CPU allows
    if (this.state.cpuUsage < this.state.currentProfile.maxCpuUsage * 0.5) {
      this.increaseQuality();
    }
  }

  /**
   * Get optimization state
   */
  getState(): OptimizationState {
    return { ...this.state };
  }

  /**
   * Set device profile manually
   */
  setProfile(profileName: string): void {
    const profile = this.profiles.get(profileName);
    if (!profile) {
      console.warn(`Unknown profile: ${profileName}`);
      return;
    }

    this.state.currentProfile = profile;

    // Update host capabilities
    const capabilities = this.hostManager.getHostCapabilities();
    capabilities.maxPluginsPerTrack = profile.maxPluginsPerTrack;

    logger.info(`Device profile set to: ${profileName}`);
  }

  // Private methods

  private selectOptimalProfile(): void {
    if (!this.deviceCapabilityDetector) {
      // Default to mid-range if no device info
      this.state.currentProfile = this.profiles.get('mid-range')!;
      return;
    }

    const capabilities = this.deviceCapabilityDetector.getCapabilities();

    // Select profile based on device
    if (capabilities.device.isMobile) {
      this.state.currentProfile = this.profiles.get('mobile')!;
    } else if (capabilities.performance.tier === 'high') {
      this.state.currentProfile = this.profiles.get('high-end')!;
    } else if (capabilities.performance.tier === 'medium') {
      this.state.currentProfile = this.profiles.get('mid-range')!;
    } else {
      this.state.currentProfile = this.profiles.get('low-end')!;
    }

    // Select quality based on performance
    if (capabilities.performance.score > 0.8) {
      this.state.currentQuality = this.qualityPresets.get('high')!;
    } else if (capabilities.performance.score > 0.5) {
      this.state.currentQuality = this.qualityPresets.get('medium')!;
    } else {
      this.state.currentQuality = this.qualityPresets.get('low')!;
    }

    logger.info(`Selected device profile: ${this.state.currentProfile.name}`);
    logger.info(`Selected quality preset: ${this.state.currentQuality.name}`);
  }

  private monitorPerformance(): void {
    // Get performance metrics
    const performanceReport = this.hostManager.getPerformanceReport();

    this.state.cpuUsage = performanceReport.totalCpuUsage;

    // Estimate memory usage (simplified)
    if (performance.memory) {
      this.state.memoryUsage =
        performance.memory.usedJSHeapSize / (1024 * 1024);
    }

    // Check for overload
    const profile = this.state.currentProfile;
    const isOverloaded =
      this.state.cpuUsage > profile.maxCpuUsage ||
      this.state.memoryUsage > profile.maxMemoryUsage;

    if (isOverloaded && !this.state.isOverloaded) {
      this.handleOverload();
    } else if (!isOverloaded && this.state.isOverloaded) {
      this.recoverFromOverload();
    }
  }

  private reduceQuality(): void {
    const qualities = ['ultra', 'high', 'medium', 'low'];
    const currentIndex = qualities.indexOf(this.state.currentQuality.name);

    if (currentIndex < qualities.length - 1) {
      const newQuality = this.qualityPresets.get(qualities[currentIndex + 1])!;
      this.state.currentQuality = newQuality;

      logger.info(`Reduced quality to: ${newQuality.name}`);

      // Apply to all active plugins
      this.applyQualityToAllPlugins();
    }
  }

  private increaseQuality(): void {
    const qualities = ['ultra', 'high', 'medium', 'low'];
    const currentIndex = qualities.indexOf(this.state.currentQuality.name);

    if (currentIndex > 0) {
      const newQuality = this.qualityPresets.get(qualities[currentIndex - 1])!;
      this.state.currentQuality = newQuality;

      logger.info(`Increased quality to: ${newQuality.name}`);

      // Apply to all active plugins
      this.applyQualityToAllPlugins();
    }
  }

  private disableNonEssentialEffects(): void {
    const registrations = this.hostManager.getRegisteredPlugins();

    for (const registration of registrations) {
      // Skip essential plugins
      if (registration.descriptor.keywords.includes('essential')) {
        continue;
      }

      // Disable effect plugins
      if (!registration.descriptor.isInstrument) {
        this.state.disabledPlugins.add(registration.moduleId);
        logger.info(`Disabled non-essential effect: ${registration.moduleId}`);
      }
    }
  }

  private reduceSampleRate(): void {
    // This would interface with the audio context
    // For now, we just log the intent
    logger.warn('Sample rate reduction requested (not implemented)');
  }

  private applyQualityToAllPlugins(): void {
    // This would iterate through all active plugins and update their quality
    // The actual implementation would depend on the plugin management system
    this.eventBus?.emit('wam:optimizer:quality-changed', {
      quality: this.state.currentQuality.name,
    });
  }
}
