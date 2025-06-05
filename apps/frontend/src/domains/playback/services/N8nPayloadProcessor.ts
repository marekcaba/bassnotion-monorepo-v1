/**
 * N8nPayloadProcessor - Epic 2 Architecture Payload Processing
 *
 * Handles the complete data flow from n8n AI agent to the playback engine.
 * Extracts asset manifests, processes tutorial-specific MIDI, library MIDI,
 * and audio samples for coordinated playback.
 *
 * Part of Story 2.1: Task 11, Subtask 11.2
 */

import type {
  N8nPayloadConfig,
  AssetManifest,
  AssetReference,
  N8nPayloadProcessorConfig,
  AssetLoadingState,
} from '../types/audio.js';

export class N8nPayloadProcessor {
  private static instance: N8nPayloadProcessor;
  private config: N8nPayloadProcessorConfig;
  private assetCache: Map<string, ArrayBuffer | AudioBuffer> = new Map();
  private loadingState: AssetLoadingState = {
    midiFiles: new Map(),
    audioSamples: new Map(),
    totalAssets: 0,
    loadedAssets: 0,
  };

  private constructor(config: Partial<N8nPayloadProcessorConfig> = {}) {
    this.config = {
      enableCaching: true,
      maxCacheSize: 100 * 1024 * 1024, // 100MB cache
      assetTimeout: 30000, // 30 seconds
      retryAttempts: 3,
      fallbackEnabled: true,
      ...config,
    };
  }

  public static getInstance(
    config?: Partial<N8nPayloadProcessorConfig>,
  ): N8nPayloadProcessor {
    if (!N8nPayloadProcessor.instance) {
      N8nPayloadProcessor.instance = new N8nPayloadProcessor(config);
    }
    return N8nPayloadProcessor.instance;
  }

  /**
   * Extract asset manifest from n8n payload
   * Epic 2 workflow step 1: Identify and prepare all assets
   */
  public extractAssetManifest(payload: N8nPayloadConfig): AssetManifest {
    const assets: AssetReference[] = [];

    // Tutorial-specific MIDI files (Epic 2 Section 9)
    assets.push({
      type: 'midi',
      category: 'bassline',
      url: payload.tutorialSpecificMidi.basslineUrl,
      priority: 'high',
    });

    assets.push({
      type: 'midi',
      category: 'chords',
      url: payload.tutorialSpecificMidi.chordsUrl,
      priority: 'high',
    });

    // Library MIDI patterns
    assets.push({
      type: 'midi',
      category: 'drums',
      url: this.resolveDrumPatternUrl(payload.libraryMidi.drumPatternId),
      priority: 'medium',
    });

    // Audio samples per Epic 2 Section 7.2
    payload.audioSamples.bassNotes.forEach((url, index) => {
      assets.push({
        type: 'audio',
        category: 'bass-sample',
        url,
        priority: 'high',
        noteIndex: index,
      });
    });

    payload.audioSamples.drumHits.forEach((url, index) => {
      assets.push({
        type: 'audio',
        category: 'drum-sample',
        url,
        priority: 'medium',
        drumPiece: this.identifyDrumPiece(index),
      });
    });

    // Ambient audio (Epic 2 Section 7.5)
    if (payload.audioSamples.ambienceTrack) {
      assets.push({
        type: 'audio',
        category: 'ambience',
        url: payload.audioSamples.ambienceTrack,
        priority: 'low',
      });
    }

    const manifest: AssetManifest = {
      assets,
      totalCount: assets.length,
      estimatedLoadTime: this.calculateLoadTime(assets),
    };

    // Update loading state
    this.loadingState.totalAssets = manifest.totalCount;
    this.loadingState.loadedAssets = 0;

    return manifest;
  }

  /**
   * Validate n8n payload structure and data integrity
   */
  public validatePayload(payload: N8nPayloadConfig): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate tutorial MIDI
    if (!payload.tutorialSpecificMidi?.basslineUrl) {
      errors.push('Missing bassline URL in tutorial MIDI');
    }
    if (!payload.tutorialSpecificMidi?.chordsUrl) {
      errors.push('Missing chords URL in tutorial MIDI');
    }

    // Validate library MIDI
    if (!payload.libraryMidi?.drumPatternId) {
      errors.push('Missing drum pattern ID in library MIDI');
    }
    if (!payload.libraryMidi?.metronomeStyleId) {
      warnings.push('Missing metronome style ID - using default');
    }

    // Validate audio samples
    if (!payload.audioSamples?.bassNotes?.length) {
      errors.push('No bass note samples provided');
    }
    if (!payload.audioSamples?.drumHits?.length) {
      warnings.push('No drum hit samples provided');
    }

    // Validate synchronization
    if (!payload.synchronization?.bpm || payload.synchronization.bpm <= 0) {
      errors.push('Invalid BPM in synchronization settings');
    }
    if (!payload.synchronization?.timeSignature) {
      warnings.push('Missing time signature - using 4/4 default');
    }
    if (!payload.synchronization?.keySignature) {
      warnings.push('Missing key signature - using C major default');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get current loading state for Epic 2 asset management
   */
  public getLoadingState(): AssetLoadingState {
    return { ...this.loadingState };
  }

  /**
   * Get loading progress percentage
   */
  public getLoadingProgress(): number {
    if (this.loadingState.totalAssets === 0) return 0;
    return (
      (this.loadingState.loadedAssets / this.loadingState.totalAssets) * 100
    );
  }

  /**
   * Mark asset as loaded
   */
  public markAssetLoaded(url: string, data: ArrayBuffer | AudioBuffer): void {
    if (this.config.enableCaching) {
      this.assetCache.set(url, data);
    }

    // Update loading state
    if (data instanceof ArrayBuffer) {
      this.loadingState.midiFiles.set(url, data);
    } else {
      this.loadingState.audioSamples.set(url, data);
    }

    this.loadingState.loadedAssets++;
  }

  /**
   * Get cached asset
   */
  public getCachedAsset(url: string): ArrayBuffer | AudioBuffer | null {
    return this.assetCache.get(url) || null;
  }

  /**
   * Clear asset cache
   */
  public clearCache(): void {
    this.assetCache.clear();
    this.loadingState = {
      midiFiles: new Map(),
      audioSamples: new Map(),
      totalAssets: 0,
      loadedAssets: 0,
    };
  }

  /**
   * Get cache size in bytes
   */
  public getCacheSize(): number {
    let totalSize = 0;
    this.assetCache.forEach((data) => {
      if (data instanceof ArrayBuffer) {
        totalSize += data.byteLength;
      } else if (data instanceof AudioBuffer) {
        // Estimate AudioBuffer size
        totalSize += data.length * data.numberOfChannels * 4; // 32-bit float
      }
    });
    return totalSize;
  }

  /**
   * Resolve drum pattern URL from library ID
   */
  private resolveDrumPatternUrl(drumPatternId: string): string {
    // Epic 2: Direct Supabase Storage integration
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const storageBucket = 'library-midi';
    return `${baseUrl}/storage/v1/object/public/${storageBucket}/drum-patterns/${drumPatternId}.mid`;
  }

  /**
   * Identify drum piece from index for better organization
   */
  private identifyDrumPiece(index: number): string {
    const drumPieces = [
      'kick',
      'snare',
      'hihat-closed',
      'hihat-open',
      'crash',
      'ride',
      'tom-high',
      'tom-mid',
      'tom-low',
      'percussion',
    ];
    return drumPieces[index] || `drum-${index}`;
  }

  /**
   * Calculate estimated loading time based on asset size and priority
   */
  private calculateLoadTime(assets: AssetReference[]): number {
    // Simple estimation: base time + priority weighting
    const baseTimePerAsset = 500; // 500ms base
    const priorityWeights = { high: 1.5, medium: 1.0, low: 0.5 };

    return assets.reduce((total, asset) => {
      const weight = priorityWeights[asset.priority] || 1.0;
      return total + baseTimePerAsset * weight;
    }, 0);
  }

  /**
   * Get processor configuration
   */
  public getConfig(): N8nPayloadProcessorConfig {
    return { ...this.config };
  }

  /**
   * Update processor configuration
   */
  public updateConfig(newConfig: Partial<N8nPayloadProcessorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Dispose and cleanup
   */
  public dispose(): void {
    this.clearCache();
  }
}
