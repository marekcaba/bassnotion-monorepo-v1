/**
 * AssetManifestProcessor - Enhanced Asset Processing for Epic 2
 *
 * Provides advanced asset manifest processing capabilities including
 * dependency resolution, optimization strategies, and loading prioritization.
 * Builds upon N8nPayloadProcessor for comprehensive asset management.
 *
 * Part of Story 2.1: Task 11, Subtask 11.3
 */

import type { AssetManifest, AssetReference } from '../types/audio.js';

export interface AssetDependency {
  assetUrl: string;
  dependsOn: string[];
  dependencyType: 'required' | 'optional' | 'performance';
}

export interface AssetOptimization {
  compressionLevel: 'none' | 'low' | 'medium' | 'high';
  qualityTarget: 'maximum' | 'balanced' | 'efficient' | 'minimal';
  deviceOptimized: boolean;
  networkOptimized: boolean;
}

export interface ProcessedAssetManifest extends AssetManifest {
  dependencies: AssetDependency[];
  loadingGroups: AssetLoadingGroup[];
  optimizations: Map<string, AssetOptimization>;
  totalSize: number;
  criticalPath: string[];
}

export interface AssetLoadingGroup {
  id: string;
  priority: number;
  assets: AssetReference[];
  parallelLoadable: boolean;
  requiredForPlayback: boolean;
}

export class AssetManifestProcessor {
  private static instance: AssetManifestProcessor;

  private constructor() {
    // Device capabilities will be detected on each processManifest call
    // to handle test environment changes and singleton persistence
  }

  public static getInstance(): AssetManifestProcessor {
    // TODO: Review non-null assertion - consider null safety
    if (!AssetManifestProcessor.instance) {
      AssetManifestProcessor.instance = new AssetManifestProcessor();
    }
    return AssetManifestProcessor.instance;
  }

  /**
   * Process asset manifest with advanced optimization and dependency resolution
   */
  public processManifest(manifest: AssetManifest): ProcessedAssetManifest {
    // Re-detect device capabilities for each processing call
    // This ensures test environment changes are properly captured
    const deviceCapabilities = this.detectDeviceCapabilities();

    // Analyze dependencies between assets
    const dependencies = this.analyzeDependencies(manifest.assets);

    // Create optimized loading groups
    const loadingGroups = this.createLoadingGroups(
      manifest.assets,
      dependencies,
    );

    // Generate optimization strategies per asset
    const optimizations = this.generateOptimizations(
      manifest.assets,
      deviceCapabilities,
    );

    // Calculate critical path for priority loading
    const criticalPath = this.calculateCriticalPath(
      manifest.assets,
      dependencies,
    );

    // Estimate total download size
    const totalSize = this.estimateTotalSize(manifest.assets);

    return {
      ...manifest,
      dependencies,
      loadingGroups,
      optimizations,
      totalSize,
      criticalPath,
    };
  }

  /**
   * Analyze dependencies between assets based on Epic 2 workflow
   */
  private analyzeDependencies(assets: AssetReference[]): AssetDependency[] {
    const dependencies: AssetDependency[] = [];

    // Epic 2: Bassline MIDI depends on chord MIDI for harmonic context
    const bassline = assets.find((a) => a.category === 'bassline');
    const chords = assets.find((a) => a.category === 'chords');
    if (bassline && chords) {
      dependencies.push({
        assetUrl: bassline.url,
        dependsOn: [chords.url],
        dependencyType: 'required',
      });
    }

    // Bass samples depend on bassline MIDI
    const bassSamples = assets.filter((a) => a.category === 'bass-sample');
    if (bassline && bassSamples.length > 0) {
      bassSamples.forEach((sample) => {
        dependencies.push({
          assetUrl: sample.url,
          dependsOn: [bassline.url],
          dependencyType: 'required',
        });
      });
    }

    // Drum samples can load independently but benefit from drum MIDI timing
    const drumMidi = assets.find((a) => a.category === 'drums');
    const drumSamples = assets.filter((a) => a.category === 'drum-sample');
    if (drumMidi && drumSamples.length > 0) {
      drumSamples.forEach((sample) => {
        dependencies.push({
          assetUrl: sample.url,
          dependsOn: [drumMidi.url],
          dependencyType: 'performance',
        });
      });
    }

    // Ambience is independent and optional
    const ambience = assets.find((a) => a.category === 'ambience');
    if (ambience) {
      dependencies.push({
        assetUrl: ambience.url,
        dependsOn: [],
        dependencyType: 'optional',
      });
    }

    return dependencies;
  }

  /**
   * Create optimized loading groups for parallel and sequential loading
   */
  private createLoadingGroups(
    assets: AssetReference[],
    _dependencies: AssetDependency[],
  ): AssetLoadingGroup[] {
    const groups: AssetLoadingGroup[] = [];

    // Group 1: Critical MIDI files (highest priority, sequential)
    const criticalMidi = assets.filter(
      (a) => a.type === 'midi' && a.priority === 'high',
    );
    if (criticalMidi.length > 0) {
      groups.push({
        id: 'critical-midi',
        priority: 100,
        assets: criticalMidi,
        parallelLoadable: false, // Sequential for dependency resolution
        requiredForPlayback: true,
      });
    }

    // Group 2: Essential audio samples (high priority, parallel)
    const essentialSamples = assets.filter(
      (a) => a.type === 'audio' && a.priority === 'high',
    );
    if (essentialSamples.length > 0) {
      groups.push({
        id: 'essential-samples',
        priority: 90,
        assets: essentialSamples,
        parallelLoadable: true,
        requiredForPlayback: true,
      });
    }

    // Group 3: Supporting MIDI and samples (medium priority)
    const supportingAssets = assets.filter((a) => a.priority === 'medium');
    if (supportingAssets.length > 0) {
      groups.push({
        id: 'supporting-assets',
        priority: 50,
        assets: supportingAssets,
        parallelLoadable: true,
        requiredForPlayback: false,
      });
    }

    // Group 4: Optional enhancements (low priority)
    const optionalAssets = assets.filter((a) => a.priority === 'low');
    if (optionalAssets.length > 0) {
      groups.push({
        id: 'optional-enhancements',
        priority: 10,
        assets: optionalAssets,
        parallelLoadable: true,
        requiredForPlayback: false,
      });
    }

    return groups.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Generate device-specific optimization strategies
   */
  private generateOptimizations(
    assets: AssetReference[],
    deviceCapabilities: DeviceCapabilities,
  ): Map<string, AssetOptimization> {
    const optimizations = new Map<string, AssetOptimization>();

    assets.forEach((asset) => {
      let optimization: AssetOptimization;

      if (deviceCapabilities.isLowEnd) {
        // Aggressive optimization for low-end devices regardless of priority
        optimization = {
          compressionLevel: 'high',
          qualityTarget: 'efficient',
          deviceOptimized: true,
          networkOptimized: true,
        };
      } else if (deviceCapabilities.isSlowNetwork) {
        // Network-optimized for slow connections with priority consideration
        optimization = {
          compressionLevel: asset.priority === 'low' ? 'high' : 'medium',
          qualityTarget: asset.priority === 'low' ? 'efficient' : 'balanced',
          deviceOptimized: false,
          networkOptimized: true,
        };
      } else {
        // Priority-based optimization for capable devices
        if (asset.priority === 'high') {
          optimization = {
            compressionLevel: 'low',
            qualityTarget: 'maximum',
            deviceOptimized: deviceCapabilities.isMobile,
            networkOptimized: false,
          };
        } else if (asset.priority === 'medium') {
          optimization = {
            compressionLevel: 'medium',
            qualityTarget: 'balanced',
            deviceOptimized: deviceCapabilities.isMobile,
            networkOptimized: false,
          };
        } else {
          // Low priority assets get aggressive compression for bandwidth savings
          optimization = {
            compressionLevel: 'high',
            qualityTarget: 'minimal',
            deviceOptimized: true,
            networkOptimized: true,
          };
        }
      }

      optimizations.set(asset.url, optimization);
    });

    return optimizations;
  }

  /**
   * Calculate critical path for minimum viable playback
   */
  private calculateCriticalPath(
    assets: AssetReference[],
    dependencies: AssetDependency[],
  ): string[] {
    const criticalPath: string[] = [];

    // Epic 2: Minimum viable playback requires bassline + bass samples
    const bassline = assets.find((a) => a.category === 'bassline');
    const firstBassSample = assets.find((a) => a.category === 'bass-sample');

    if (bassline) {
      criticalPath.push(bassline.url);
    }
    if (firstBassSample) {
      criticalPath.push(firstBassSample.url);
    }

    // Add chord MIDI if bassline depends on it
    const basslineDep = dependencies.find((d) => d.assetUrl === bassline?.url);
    if (basslineDep && basslineDep.dependsOn.length > 0) {
      criticalPath.unshift(...basslineDep.dependsOn);
    }

    return criticalPath;
  }

  /**
   * Estimate total download size for progress calculation
   */
  private estimateTotalSize(assets: AssetReference[]): number {
    let totalSize = 0;

    assets.forEach((asset) => {
      if (asset.type === 'midi') {
        // MIDI files are typically 5-50KB
        totalSize += 25000; // 25KB average
      } else if (asset.type === 'audio') {
        if (
          asset.category === 'bass-sample' ||
          asset.category === 'drum-sample'
        ) {
          // Audio samples: 50-500KB each
          totalSize += 150000; // 150KB average
        } else if (asset.category === 'ambience') {
          // Ambience tracks: 1-5MB
          totalSize += 2000000; // 2MB average
        }
      }
    });

    return totalSize;
  }

  /**
   * Detect device capabilities for optimization
   */
  private detectDeviceCapabilities(): DeviceCapabilities {
    // Simple capability detection - can be enhanced with actual device detection
    let userAgent = '';
    let connection: any = undefined;

    try {
      userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      connection =
        typeof navigator !== 'undefined'
          ? (navigator as any)?.connection
          : undefined;
    } catch {
      // Handle cases where navigator is completely undefined or causes errors
      userAgent = '';
      connection = undefined;
    }

    // Improved low-end device detection
    const isLowEndDevice =
      // Android 4.x and lower
      /Android\s+[1-4]\./.test(userAgent) ||
      // Very old iOS versions (5-9)
      /iPhone.*OS\s+[5-9]_/.test(userAgent) ||
      // Old Android devices with SM- model numbers (Samsung Galaxy older models)
      /Android.*SM-G[0-9]{4}/.test(userAgent) ||
      // Generic low-end indicators
      /Android.*2\.|Android.*3\./.test(userAgent);

    // Improved slow network detection
    const isSlowNetwork =
      connection?.effectiveType === '2g' ||
      connection?.effectiveType === 'slow-2g' ||
      connection?.effectiveType === '3g';

    const capabilities: DeviceCapabilities = {
      isMobile: /Mobile|Android|iPhone|iPad/.test(userAgent),
      isLowEnd: isLowEndDevice,
      isSlowNetwork: isSlowNetwork,
      maxConcurrentDownloads: 6, // Will be set below
      supportedFormats: this.getSupportedAudioFormats(),
    };

    // Set max concurrent downloads based on detected capabilities
    capabilities.maxConcurrentDownloads =
      this.getMaxConcurrentDownloads(capabilities);

    return capabilities;
  }

  /**
   * Get maximum concurrent downloads based on device
   */
  private getMaxConcurrentDownloads(
    deviceCapabilities: DeviceCapabilities,
  ): number {
    if (deviceCapabilities.isLowEnd) return 2;
    if (deviceCapabilities.isMobile) return 4;
    return 6;
  }

  /**
   * Get supported audio formats for optimization
   */
  private getSupportedAudioFormats(): string[] {
    const formats = ['wav', 'mp3']; // Basic support

    if (typeof Audio !== 'undefined') {
      const audio = new Audio();
      if (audio.canPlayType('audio/ogg')) formats.push('ogg');
      if (audio.canPlayType('audio/webm')) formats.push('webm');
      if (audio.canPlayType('audio/flac')) formats.push('flac');
    }

    return formats;
  }

  /**
   * Validate processed manifest
   */
  public validateProcessedManifest(manifest: ProcessedAssetManifest): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate critical path
    if (manifest.criticalPath.length === 0) {
      errors.push(
        'No critical path defined - minimum viable playback not possible',
      );
    }

    // Validate loading groups
    if (manifest.loadingGroups.length === 0) {
      errors.push('No loading groups defined - asset loading strategy unclear');
    }

    // Check for circular dependencies
    const circularDeps = this.detectCircularDependencies(manifest.dependencies);
    if (circularDeps.length > 0) {
      errors.push(`Circular dependencies detected: ${circularDeps.join(', ')}`);
    }

    // Validate size estimates
    if (manifest.totalSize > 50 * 1024 * 1024) {
      // 50MB
      warnings.push('Total asset size exceeds 50MB - consider optimization');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Detect circular dependencies in asset dependency graph
   */
  private detectCircularDependencies(
    dependencies: AssetDependency[],
  ): string[] {
    const circular: string[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (assetUrl: string): boolean => {
      if (recursionStack.has(assetUrl)) {
        circular.push(assetUrl);
        return true;
      }

      if (visited.has(assetUrl)) {
        return false;
      }

      visited.add(assetUrl);
      recursionStack.add(assetUrl);

      const deps =
        dependencies.find((d) => d.assetUrl === assetUrl)?.dependsOn || [];
      for (const dep of deps) {
        if (dfs(dep)) {
          return true;
        }
      }

      recursionStack.delete(assetUrl);
      return false;
    };

    dependencies.forEach((dep) => {
      // TODO: Review non-null assertion - consider null safety
      if (!visited.has(dep.assetUrl)) {
        dfs(dep.assetUrl);
      }
    });

    return circular;
  }
}

interface DeviceCapabilities {
  isMobile: boolean;
  isLowEnd: boolean;
  isSlowNetwork: boolean;
  maxConcurrentDownloads: number;
  supportedFormats: string[];
}
