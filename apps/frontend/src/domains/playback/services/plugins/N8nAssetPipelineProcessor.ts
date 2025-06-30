/**
 * N8nAssetPipelineProcessor - Task 7.4
 *
 * Enhances Epic 2 n8n payload integration with existing CDN infrastructure
 * and asset loading pipeline with intelligent routing and failover.
 *
 * Part of Story 2.2: Task 7, Subtask 7.4
 */

import { AssetManager } from '../AssetManager.js';
import { MusicalContextAnalyzer } from './MusicalContextAnalyzer.js';
import { InstrumentAssetOptimizer } from './InstrumentAssetOptimizer.js';
import type {
  N8nPayloadConfig,
  AssetLoadResult,
  AssetManifest,
  ProcessedAssetManifest,
  AssetLoadingGroup,
  AssetOptimization,
} from '../../types/audio.js';

export interface N8nIntegrationConfig {
  enableCdnOptimization: boolean;
  enableFailoverRouting: boolean;
  enableAssetPreprocessing: boolean;
  enableMusicalAnalysis: boolean;
  enableQualityAdaptation: boolean;
  enableLoadBalancing: boolean;
  enableCacheOptimization: boolean;
  retryStrategy: 'exponential' | 'linear' | 'adaptive';
  maxRetries: number;
  timeoutMs: number;
}

export interface N8nAssetRoute {
  id: string;
  primary: string;
  fallbacks: string[];
  cdnEndpoints: string[];
  priority: number;
  healthStatus: 'healthy' | 'degraded' | 'unavailable';
  latency: number;
  successRate: number;
  currentLoad: number;
  lastFailureTime?: number;
}

export interface N8nProcessingResult {
  processedAssets: AssetLoadResult[];
  failedAssets: string[];
  totalProcessingTime: number;
  cdnOptimizationSavings: number;
  musicalContextInsights: any;
  qualityAdaptations: number;
  cacheHits: number;
  routingDecisions: N8nRoutingDecision[];
}

export interface N8nRoutingDecision {
  assetUrl: string;
  selectedRoute: string;
  reason: string;
  alternativesConsidered: string[];
  latencyExpected: number;
  qualityLevel: string;
  originalUrl?: string;
  optimizedUrl?: string;
  timestamp?: number;
  category?: string;
  preprocessing?: boolean;
}

export class N8nAssetPipelineProcessor {
  private assetManager: AssetManager;
  private musicalAnalyzer: MusicalContextAnalyzer;
  private assetOptimizer: InstrumentAssetOptimizer;
  private config: N8nIntegrationConfig;
  private assetRoutes: Map<string, N8nAssetRoute> = new Map();
  private routingHistory: N8nRoutingDecision[] = [];
  private performanceMetrics: Map<string, number> = new Map();
  private processedAssets: string[] = [];
  private failedAssets: string[] = [];
  private cacheHits = 0;
  private cdnOptimizationSavings = 0;

  constructor(config?: Partial<N8nIntegrationConfig>) {
    this.assetManager = AssetManager.getInstance();
    this.musicalAnalyzer = new MusicalContextAnalyzer();
    this.assetOptimizer = new InstrumentAssetOptimizer();

    this.config = {
      enableCdnOptimization: true,
      enableFailoverRouting: true,
      enableAssetPreprocessing: true,
      enableMusicalAnalysis: true,
      enableQualityAdaptation: true,
      enableLoadBalancing: true,
      enableCacheOptimization: true,
      retryStrategy: 'adaptive',
      maxRetries: 3,
      timeoutMs: 10000,
      ...config,
    };

    this.initializeAssetRoutes();
  }

  /**
   * Initialize CDN asset routes with Epic 2 n8n endpoints
   */
  private initializeAssetRoutes(): void {
    // Primary CDN routes for Epic 2
    this.assetRoutes.set('bassnotion-cdn-primary', {
      id: 'bassnotion-cdn-primary',
      primary: 'https://cdn.bassnotion.com',
      fallbacks: [
        'https://cdn-backup.bassnotion.com',
        'https://cdn-eu.bassnotion.com',
        'https://cdn-asia.bassnotion.com',
      ],
      cdnEndpoints: [
        'https://cdn.bassnotion.com',
        'https://cdn-backup.bassnotion.com',
      ],
      priority: 1,
      healthStatus: 'healthy',
      latency: 50,
      successRate: 0.99,
      currentLoad: 0.3,
    });

    // Supabase Storage integration
    this.assetRoutes.set('supabase-storage', {
      id: 'supabase-storage',
      primary: 'https://storage.supabase.co',
      fallbacks: ['https://backup-storage.supabase.co'],
      cdnEndpoints: ['https://storage.supabase.co'],
      priority: 2,
      healthStatus: 'healthy',
      latency: 80,
      successRate: 0.98,
      currentLoad: 0.5,
    });

    // Regional CDN endpoints
    this.assetRoutes.set('cloudflare-global', {
      id: 'cloudflare-global',
      primary: 'https://bassnotion.global.ssl.fastly.com',
      fallbacks: [
        'https://bassnotion.eu.ssl.fastly.com',
        'https://bassnotion.asia.ssl.fastly.com',
      ],
      cdnEndpoints: [
        'https://bassnotion.global.ssl.fastly.com',
        'https://bassnotion.eu.ssl.fastly.com',
      ],
      priority: 3,
      healthStatus: 'healthy',
      latency: 30,
      successRate: 0.97,
      currentLoad: 0.2,
    });
  }

  /**
   * Process Epic 2 n8n payload with enhanced asset management
   */
  public async processN8nPayload(
    payload: N8nPayloadConfig,
  ): Promise<N8nProcessingResult> {
    console.log('🔄 Processing Epic 2 n8n payload with enhanced pipeline:', {
      assetCount: payload.assetManifest?.totalCount || 0,
      midiFiles: payload.tutorialSpecificMidi ? 'present' : 'missing',
      audioSamples: payload.audioSamples ? 'present' : 'missing',
    });

    const startTime = performance.now();
    const processedAssets: AssetLoadResult[] = [];
    const failedAssets: string[] = [];
    const routingDecisions: N8nRoutingDecision[] = [];
    let cdnOptimizationSavings = 0;
    const qualityAdaptations = 0;
    let cacheHits = 0;

    try {
      // Step 1: Enhance asset manifest with CDN optimization
      const enhancedManifest = await this.enhanceAssetManifest(
        payload.assetManifest,
      );

      // Step 2: Apply musical context analysis if enabled
      let musicalInsights = null;
      if (this.config.enableMusicalAnalysis && payload.tutorialSpecificMidi) {
        musicalInsights = await this.analyzeMusicalContext(payload);
      }

      // Step 3: Process audio samples with optimization
      if (payload.audioSamples) {
        const audioResults = await this.processAudioSamples(
          payload.audioSamples,
          enhancedManifest,
          musicalInsights,
        );
        processedAssets.push(...audioResults.successful);
        failedAssets.push(...audioResults.failed);
        routingDecisions.push(...audioResults.routingDecisions);
        cdnOptimizationSavings += audioResults.cdnSavings;
        cacheHits += audioResults.cacheHits;
      }

      // Step 4: Process MIDI files
      if (payload.tutorialSpecificMidi) {
        const midiResults = await this.processMidiFiles(
          payload.tutorialSpecificMidi,
        );
        processedAssets.push(...midiResults.successful);
        failedAssets.push(...midiResults.failed);
        routingDecisions.push(...midiResults.routingDecisions);
      }

      // Step 5: Process library assets
      if (payload.libraryMidi) {
        const libraryResults = await this.processLibraryAssets(
          payload.libraryMidi,
        );
        processedAssets.push(...libraryResults.successful);
        failedAssets.push(...libraryResults.failed);
      }

      const totalProcessingTime = performance.now() - startTime;

      console.log('✅ N8n payload processing complete:', {
        processedAssets: processedAssets.length,
        failedAssets: failedAssets.length,
        processingTime: `${totalProcessingTime.toFixed(2)}ms`,
        cdnSavings: `${cdnOptimizationSavings.toFixed(2)}ms`,
        cacheHitRate: `${((cacheHits / (processedAssets.length || 1)) * 100).toFixed(1)}%`,
      });

      return {
        processedAssets,
        failedAssets,
        totalProcessingTime,
        cdnOptimizationSavings,
        musicalContextInsights: musicalInsights,
        qualityAdaptations,
        cacheHits,
        routingDecisions,
      };
    } catch (error) {
      console.error('❌ N8n payload processing failed:', error);
      throw new Error(
        `N8n processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Enhance asset manifest with CDN optimization and routing
   */
  private async enhanceAssetManifest(
    manifest?: AssetManifest,
  ): Promise<ProcessedAssetManifest | null> {
    // TODO: Review non-null assertion - consider null safety
    if (!manifest || !this.config.enableCdnOptimization) {
      return null;
    }

    console.log('🔧 Enhancing asset manifest with CDN optimization...');

    const enhancedAssets = await Promise.all(
      manifest.assets.map(async (asset) => {
        const route = await this.selectOptimalRoute(asset.url);
        const optimizedUrl = this.optimizeAssetUrl(asset.url, route);

        return {
          ...asset,
          url: optimizedUrl,
          route: route.selectedRoute,
          expectedLatency: route.latencyExpected,
        };
      }),
    );

    const loadingGroups: AssetLoadingGroup[] =
      this.createLoadingGroups(enhancedAssets);
    const optimizations = new Map<string, AssetOptimization>();
    optimizations.set('cdn', {
      compressionLevel: 'high',
      qualityTarget: 'balanced',
      deviceOptimized: true,
      networkOptimized: true,
    });
    optimizations.set('compression', {
      compressionLevel: 'medium',
      qualityTarget: 'balanced',
      deviceOptimized: true,
      networkOptimized: true,
    });
    optimizations.set('caching', {
      compressionLevel: this.config.enableCacheOptimization ? 'high' : 'none',
      qualityTarget: 'balanced',
      deviceOptimized: true,
      networkOptimized: true,
    });

    return {
      ...manifest,
      assets: enhancedAssets,
      dependencies: [],
      loadingGroups,
      optimizations,
      totalSize: enhancedAssets.reduce(
        (sum, _asset) => sum + 0, // Size not available in AssetReference
        0,
      ),
      criticalPath: this.identifyCriticalPath(enhancedAssets),
    };
  }

  /**
   * Select optimal CDN route for asset
   */
  private async selectOptimalRoute(
    assetUrl: string,
  ): Promise<N8nRoutingDecision> {
    const availableRoutes = Array.from(this.assetRoutes.entries())
      .filter(([, route]) => route.healthStatus !== 'unavailable')
      .sort((a, b) => {
        // Sort by priority, then by latency and success rate
        if (a[1].priority !== b[1].priority) {
          return a[1].priority - b[1].priority;
        }
        return (
          a[1].latency * (1 - a[1].successRate) -
          b[1].latency * (1 - b[1].successRate)
        );
      });

    if (availableRoutes.length === 0) {
      throw new Error('No available CDN routes');
    }

    const selectedRoute = availableRoutes[0];
    // TODO: Review non-null assertion - consider null safety
    if (!selectedRoute) {
      throw new Error('No route selected');
    }

    const [selectedRouteId, selectedRouteData] = selectedRoute;
    const alternativesConsidered = availableRoutes
      .slice(1, 4)
      .map(([id]) => id);

    const decision: N8nRoutingDecision = {
      assetUrl,
      selectedRoute: selectedRouteId,
      reason: this.determineRoutingReason(selectedRouteData),
      alternativesConsidered,
      latencyExpected: selectedRouteData.latency,
      qualityLevel: 'optimal',
    };

    this.routingHistory.push(decision);
    return decision;
  }

  /**
   * Determine reasoning for route selection
   */
  private determineRoutingReason(selectedRoute: N8nAssetRoute): string {
    if (selectedRoute.priority === 1) {
      return 'Primary CDN with highest priority';
    }
    if (selectedRoute.latency < 50) {
      return 'Lowest latency route selected';
    }
    if (selectedRoute.successRate > 0.98) {
      return 'Highest reliability route selected';
    }
    return 'Best overall performance route selected';
  }

  /**
   * Optimize asset URL for selected route
   */
  private optimizeAssetUrl(
    originalUrl: string,
    routingDecision: N8nRoutingDecision,
  ): string {
    const route = this.assetRoutes.get(routingDecision.selectedRoute);
    // TODO: Review non-null assertion - consider null safety
    if (!route) return originalUrl;

    // Extract asset path from original URL
    const urlParts = new URL(originalUrl);
    const assetPath = urlParts.pathname;

    // Construct optimized URL with selected CDN
    const optimizedUrl = `${route.primary}${assetPath}`;

    // Add optimization parameters
    const params = new URLSearchParams();
    if (this.config.enableQualityAdaptation) {
      params.set('quality', 'auto');
    }
    if (this.config.enableCacheOptimization) {
      params.set('cache', 'aggressive');
    }

    return params.toString()
      ? `${optimizedUrl}?${params.toString()}`
      : optimizedUrl;
  }

  /**
   * Create intelligent loading groups for assets
   */
  private createLoadingGroups(assets: any[]): AssetLoadingGroup[] {
    const groups = {
      critical: [] as string[],
      high: [] as string[],
      medium: [] as string[],
      low: [] as string[],
    };

    assets.forEach((asset) => {
      if (asset.category === 'metronome' || asset.priority === 'critical') {
        groups.critical.push(asset.url);
      } else if (
        asset.category === 'bass-sample' ||
        asset.priority === 'high'
      ) {
        groups.high.push(asset.url);
      } else if (
        asset.category === 'drum-sample' ||
        asset.priority === 'medium'
      ) {
        groups.medium.push(asset.url);
      } else {
        groups.low.push(asset.url);
      }
    });

    return [
      {
        id: 'critical',
        priority: 1,
        assets: groups.critical.map((url) => ({
          url,
          type: 'audio' as const,
          category: 'metronome' as const,
          priority: 'high' as const,
        })),
        parallelLoadable: false,
        requiredForPlayback: true,
      },
      {
        id: 'high',
        priority: 2,
        assets: groups.high.map((url) => ({
          url,
          type: 'audio' as const,
          category: 'bass-sample' as const,
          priority: 'high' as const,
        })),
        parallelLoadable: true,
        requiredForPlayback: true,
      },
      {
        id: 'medium',
        priority: 3,
        assets: groups.medium.map((url) => ({
          url,
          type: 'audio' as const,
          category: 'drum-sample' as const,
          priority: 'medium' as const,
        })),
        parallelLoadable: true,
        requiredForPlayback: false,
      },
      {
        id: 'low',
        priority: 4,
        assets: groups.low.map((url) => ({
          url,
          type: 'audio' as const,
          category: 'ambience' as const,
          priority: 'low' as const,
        })),
        parallelLoadable: true,
        requiredForPlayback: false,
      },
    ].filter((group) => group.assets.length > 0);
  }

  /**
   * Identify critical path assets that block functionality
   */
  private identifyCriticalPath(assets: any[]): string[] {
    return assets
      .filter(
        (asset) =>
          asset.priority === 'critical' ||
          asset.category === 'metronome' ||
          (asset.category === 'bass-sample' && asset.url.includes('C2')),
      )
      .map((asset) => asset.url);
  }

  /**
   * Analyze musical context from n8n payload
   */
  private async analyzeMusicalContext(payload: N8nPayloadConfig): Promise<any> {
    console.log('🎼 Analyzing musical context from n8n payload...');

    // Enhanced intelligence: Only generate insights when there's actual musical content
    const hasMidiContent =
      payload.tutorialSpecificMidi?.basslineUrl ||
      payload.tutorialSpecificMidi?.chordsUrl ||
      payload.libraryMidi?.drumPatternId ||
      payload.libraryMidi?.metronomeStyleId;

    const hasAudioContent =
      payload.audioSamples?.bassNotes?.length > 0 ||
      payload.audioSamples?.drumHits?.length > 0 ||
      payload.audioSamples?.ambienceTrack;

    // Return null if no meaningful musical content to analyze
    // TODO: Review non-null assertion - consider null safety
    if (!hasMidiContent && !hasAudioContent) {
      console.log('🎼 No musical content found - skipping analysis');
      return null;
    }

    // This would integrate with the MusicalContextAnalyzer
    // For now, return insights based on payload structure
    return {
      bpm: payload.synchronization?.bpm || 120,
      key: payload.synchronization?.keySignature || 'C',
      timeSignature: payload.synchronization?.timeSignature || '4/4',
      complexity: this.estimateComplexity(payload),
      recommendedAssets: this.generateAssetRecommendations(payload),
      contentAnalysis: {
        hasMidiContent,
        hasAudioContent,
        totalAssets:
          (payload.audioSamples?.bassNotes?.length || 0) +
          (payload.audioSamples?.drumHits?.length || 0) +
          (payload.audioSamples?.ambienceTrack ? 1 : 0),
      },
    };
  }

  /**
   * Estimate musical complexity from payload
   */
  private estimateComplexity(payload: N8nPayloadConfig): number {
    let complexity = 0.5; // Base complexity

    // Factor in BPM
    const bpm = payload.synchronization?.bpm || 120;
    if (bpm > 140) complexity += 0.2;
    if (bpm < 80) complexity += 0.1;

    // Factor in time signature
    if (payload.synchronization?.timeSignature !== '4/4') {
      complexity += 0.2;
    }

    // Factor in asset count
    const assetCount = payload.assetManifest?.totalCount || 0;
    if (assetCount > 20) complexity += 0.1;

    return Math.min(complexity, 1.0);
  }

  /**
   * Generate asset recommendations based on musical context
   */
  private generateAssetRecommendations(payload: N8nPayloadConfig): string[] {
    const recommendations: string[] = [];

    // Recommend metronome click based on BPM
    const bpm = payload.synchronization?.bpm || 120;
    if (bpm > 120) {
      recommendations.push('metronome-electronic.wav');
    } else {
      recommendations.push('metronome-wood.wav');
    }

    // Recommend bass samples based on key
    const key = payload.synchronization?.keySignature || 'C';
    recommendations.push(`bass-${key}.wav`);

    return recommendations;
  }

  /**
   * Process audio samples with optimization
   */
  private async processAudioSamples(
    audioSamples: any,
    _manifest: ProcessedAssetManifest | null,
    _musicalInsights: any,
  ): Promise<{
    successful: AssetLoadResult[];
    failed: string[];
    routingDecisions: N8nRoutingDecision[];
    cdnSavings: number;
    qualityAdaptations: number;
    cacheHits: number;
  }> {
    console.log('🎵 Processing audio samples with optimization...');

    const successful: AssetLoadResult[] = [];
    const failed: string[] = [];
    const routingDecisions: N8nRoutingDecision[] = [];
    let cdnSavings = 0;
    const qualityAdaptations = 0;
    let cacheHits = 0;

    // Process bass notes
    if (audioSamples.bassNotes && Array.isArray(audioSamples.bassNotes)) {
      for (const bassNote of audioSamples.bassNotes) {
        try {
          const startTime = performance.now();
          const routingDecision = await this.selectOptimalRoute(bassNote);
          const optimizedUrl = this.optimizeAssetUrl(bassNote, routingDecision);

          const asset = await this.loadAssetWithOptions(optimizedUrl, {
            priority: 'high',
            timeout: this.config.timeoutMs,
            retryAttempts: this.config.maxRetries,
            enableCompression: true,
            enableCaching: this.config.enableCacheOptimization,
          });

          successful.push(asset);
          routingDecisions.push(routingDecision);

          const loadTime = performance.now() - startTime;
          cdnSavings += Math.max(0, 200 - loadTime); // Estimated savings

          if (asset.source === 'cache') cacheHits++;
        } catch (error) {
          console.error(`Failed to load bass note ${bassNote}:`, error);
          failed.push(bassNote);
        }
      }
    }

    // Process drum hits
    if (audioSamples.drumHits && Array.isArray(audioSamples.drumHits)) {
      for (const drumHit of audioSamples.drumHits) {
        try {
          const routingDecision = await this.selectOptimalRoute(drumHit);
          const optimizedUrl = this.optimizeAssetUrl(drumHit, routingDecision);

          const asset = await this.loadAssetWithOptions(optimizedUrl, {
            priority: 'high',
            timeout: this.config.timeoutMs,
            retryAttempts: this.config.maxRetries,
            enableCompression: true,
            enableCaching: this.config.enableCacheOptimization,
          });

          successful.push(asset);
          routingDecisions.push(routingDecision);

          if (asset.source === 'cache') cacheHits++;
        } catch (error) {
          console.error(`Failed to load drum hit ${drumHit}:`, error);
          failed.push(drumHit);
        }
      }
    }

    // Process ambience track if present
    if (audioSamples.ambienceTrack) {
      try {
        const routingDecision = await this.selectOptimalRoute(
          audioSamples.ambienceTrack,
        );
        const optimizedUrl = this.optimizeAssetUrl(
          audioSamples.ambienceTrack,
          routingDecision,
        );

        const asset = await this.loadAssetWithOptions(optimizedUrl, {
          priority: 'medium',
          timeout: this.config.timeoutMs,
          retryAttempts: this.config.maxRetries,
          enableCompression: true,
          enableCaching: this.config.enableCacheOptimization,
        });

        successful.push(asset);
        routingDecisions.push(routingDecision);

        if (asset.source === 'cache') cacheHits++;
      } catch (error) {
        console.error(`Failed to load ambience track:`, error);
        failed.push(audioSamples.ambienceTrack);
      }
    }

    return {
      successful,
      failed,
      routingDecisions,
      cdnSavings,
      qualityAdaptations,
      cacheHits,
    };
  }

  /**
   * Process MIDI files from tutorial specific section
   */
  private async processMidiFiles(tutorialMidi: any): Promise<{
    successful: AssetLoadResult[];
    failed: string[];
    routingDecisions: N8nRoutingDecision[];
  }> {
    console.log('🎼 Processing tutorial-specific MIDI files...');

    const successful: AssetLoadResult[] = [];
    const failed: string[] = [];
    const routingDecisions: N8nRoutingDecision[] = [];

    const midiUrls = [tutorialMidi.basslineUrl, tutorialMidi.chordsUrl].filter(
      Boolean,
    );

    for (const midiUrl of midiUrls) {
      try {
        const routingDecision = await this.selectOptimalRoute(midiUrl);
        const optimizedUrl = this.optimizeAssetUrl(midiUrl, routingDecision);

        const asset = await this.loadAssetWithOptions(optimizedUrl, {
          priority: 'high',
          timeout: this.config.timeoutMs,
          retryAttempts: this.config.maxRetries,
          enableCompression: false, // MIDI files don't need compression
          enableCaching: this.config.enableCacheOptimization,
        });

        successful.push(asset);
        routingDecisions.push(routingDecision);
      } catch (error) {
        console.error(`Failed to load MIDI file ${midiUrl}:`, error);
        failed.push(midiUrl);
      }
    }

    return { successful, failed, routingDecisions };
  }

  /**
   * Process library assets (drum patterns, metronome styles)
   */
  private async processLibraryAssets(libraryMidi: any): Promise<{
    successful: AssetLoadResult[];
    failed: string[];
  }> {
    console.log('📚 Processing library assets...');

    const successful: AssetLoadResult[] = [];
    const failed: string[] = [];

    // Note: Library assets are typically referenced by ID, not URL
    // This would integrate with a library asset resolver
    if (libraryMidi.drumPatternId) {
      console.log(`Processing drum pattern: ${libraryMidi.drumPatternId}`);
      // Would load from library
    }

    if (libraryMidi.metronomeStyleId) {
      console.log(
        `Processing metronome style: ${libraryMidi.metronomeStyleId}`,
      );
      // Would load from library
    }

    return { successful, failed };
  }

  /**
   * Enhanced asset loading with sophisticated options
   * Upgrades the basic AssetManager interface to support advanced options
   */
  private async loadAssetWithOptions(
    url: string,
    options: {
      priority: string;
      timeout: number;
      retryAttempts?: number;
      enableCompression?: boolean;
      enableCaching?: boolean;
    },
  ): Promise<AssetLoadResult> {
    // Determine asset type from URL extension
    const assetType = url.toLowerCase().includes('.mid') ? 'midi' : 'audio';

    // Create enhanced asset reference with proper category detection
    let category:
      | 'bassline'
      | 'chords'
      | 'drums'
      | 'metronome'
      | 'bass-sample'
      | 'drum-sample'
      | 'ambience';

    if (assetType === 'midi') {
      if (
        url.toLowerCase().includes('bassline') ||
        url.toLowerCase().includes('bass')
      ) {
        category = 'bassline';
      } else if (url.toLowerCase().includes('chord')) {
        category = 'chords';
      } else if (url.toLowerCase().includes('drum')) {
        category = 'drums';
      } else {
        category = 'bassline'; // Default for MIDI
      }
    } else {
      if (
        url.toLowerCase().includes('drum') ||
        url.toLowerCase().includes('kick') ||
        url.toLowerCase().includes('snare')
      ) {
        category = 'drum-sample';
      } else if (
        url.toLowerCase().includes('ambience') ||
        url.toLowerCase().includes('ambient')
      ) {
        category = 'ambience';
      } else {
        category = 'bass-sample'; // Default for audio
      }
    }

    const assetReference = {
      url,
      category,
      priority: options.priority as 'high' | 'medium' | 'low',
      type: assetType as 'midi' | 'audio',
    };

    // Use the sophisticated AssetManager interface
    return await this.assetManager.loadAsset(assetReference, assetType);
  }

  /**
   * Update route health status based on performance
   */
  public updateRouteHealth(
    routeId: string,
    latency: number,
    success: boolean,
  ): void {
    const route = this.assetRoutes.get(routeId);
    // TODO: Review non-null assertion - consider null safety
    if (!route) return;

    // Update latency (rolling average)
    route.latency = (route.latency + latency) / 2;

    // Update success rate (rolling average with more weight on recent)
    const successValue = success ? 1 : 0;
    route.successRate = route.successRate * 0.9 + successValue * 0.1;

    // Update health status based on metrics - Enhanced with more aggressive thresholds
    if (route.successRate < 0.7 || route.latency > 800) {
      route.healthStatus = 'unavailable';
      route.lastFailureTime = Date.now();
    } else if (route.successRate < 0.9 || route.latency > 400) {
      route.healthStatus = 'degraded';
    } else {
      route.healthStatus = 'healthy';
    }

    console.log(`Route ${routeId} health updated:`, {
      latency: route.latency,
      successRate: route.successRate,
      healthStatus: route.healthStatus,
    });
  }

  /**
   * Get routing performance metrics
   */
  public getRoutingMetrics(): {
    totalRoutes: number;
    healthyRoutes: number;
    averageLatency: number;
    averageSuccessRate: number;
    recentDecisions: N8nRoutingDecision[];
  } {
    const routes = Array.from(this.assetRoutes.values());
    const healthyRoutes = routes.filter(
      (r) => r.healthStatus === 'healthy',
    ).length;
    const averageLatency =
      routes.reduce((sum, r) => sum + r.latency, 0) / routes.length;
    const averageSuccessRate =
      routes.reduce((sum, r) => sum + r.successRate, 0) / routes.length;

    return {
      totalRoutes: routes.length,
      healthyRoutes,
      averageLatency,
      averageSuccessRate,
      recentDecisions: this.routingHistory.slice(-10),
    };
  }

  /**
   * Clear routing history and reset metrics
   */
  public clearRoutingHistory(): void {
    this.routingHistory = [];
    this.performanceMetrics.clear();
    this.processedAssets = [];
    this.failedAssets = [];
    this.cacheHits = 0;
    this.cdnOptimizationSavings = 0;
    console.log('🧹 N8n routing history cleared');
  }

  /**
   * Add URL parameter helper method
   */
  private addUrlParameter(url: string, key: string, value: string): string {
    const urlObj = new URL(url);
    urlObj.searchParams.set(key, value);
    return urlObj.toString();
  }

  /**
   * Optimize URL for specific route
   */
  private optimizeUrlForRoute(originalUrl: string, routeId: string): string {
    const route = this.assetRoutes.get(routeId);
    // TODO: Review non-null assertion - consider null safety
    if (!route) return originalUrl;

    try {
      const urlParts = new URL(originalUrl);
      const assetPath = urlParts.pathname;
      return `${route.primary}${assetPath}`;
    } catch {
      return originalUrl;
    }
  }

  /**
   * Enhanced retry strategy processor
   * Implements exponential backoff, jitter, and circuit breaker patterns
   */
  private async retryAssetLoad(
    url: string,
    options: any,
    routeId: string,
  ): Promise<AssetLoadResult> {
    const maxRetries = this.config.maxRetries;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const startTime = Date.now();

      try {
        console.log(
          `🔄 Asset loading attempt ${attempt + 1}/${maxRetries + 1}: ${url}`,
        );
        const result = await this.assetManager.loadAsset(url, options);

        // Update route health on success
        const loadTime = Date.now() - startTime;
        this.updateRouteHealth(routeId, loadTime, true);

        return result;
      } catch (error) {
        lastError = error as Error;
        const loadTime = Date.now() - startTime;

        // Update route health on failure
        this.updateRouteHealth(routeId, loadTime, false);

        if (attempt < maxRetries) {
          // Calculate backoff delay with jitter
          const baseDelay = Math.pow(2, attempt) * 100; // Exponential backoff
          const jitter = Math.random() * 100; // Add randomness
          const delay = baseDelay + jitter;

          console.log(`⏳ Retrying asset load in ${delay.toFixed(0)}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));

          // Try alternative route if available
          if (this.config.enableFailoverRouting) {
            const alternativeRoute = this.selectAlternativeRoute(routeId);
            if (alternativeRoute) {
              url = this.optimizeUrlForRoute(url, alternativeRoute.id);
              routeId = alternativeRoute.id;
              console.log(`🔀 Switching to alternative route: ${routeId}`);
            }
          }
        }
      }
    }

    // All retries exhausted
    console.error(
      `❌ Asset load failed after ${maxRetries + 1} attempts: ${url}`,
    );
    throw lastError || new Error('Asset load failed with unknown error');
  }

  /**
   * Select alternative route for failover
   */
  private selectAlternativeRoute(currentRouteId: string): N8nAssetRoute | null {
    const alternatives = Array.from(this.assetRoutes.values())
      .filter(
        (route) =>
          route.id !== currentRouteId && route.healthStatus !== 'unavailable',
      )
      .sort((a, b) => {
        // Prefer healthy routes, then by priority
        if (a.healthStatus !== b.healthStatus) {
          return a.healthStatus === 'healthy' ? -1 : 1;
        }
        return a.priority - b.priority;
      });

    return alternatives[0] || null;
  }

  /**
   * Calculate route score for load balancing
   */
  private calculateRouteScore(route: N8nAssetRoute): number {
    // Factors: success rate (40%), latency (30%), priority (20%), current load (10%)
    const successScore = route.successRate * 40;
    const latencyScore = Math.max(0, (200 - route.latency) / 200) * 30; // Lower latency is better
    const priorityScore = (4 - route.priority) * 5; // Higher priority is better (lower number)
    const loadScore = Math.max(0, (100 - route.currentLoad * 100) / 100) * 10; // Lower load is better

    return successScore + latencyScore + priorityScore + loadScore;
  }

  /**
   * Load balancer for asset requests
   * Distributes load across available CDN routes
   */
  private selectOptimalRouteWithLoadBalancing(
    _assetUrl: string,
  ): N8nAssetRoute {
    const availableRoutes = Array.from(this.assetRoutes.values())
      .filter((route) => route.healthStatus === 'healthy')
      .sort((a, b) => {
        // Multi-factor scoring
        const scoreA = this.calculateRouteScore(a);
        const scoreB = this.calculateRouteScore(b);
        return scoreB - scoreA; // Higher score is better
      });

    if (availableRoutes.length === 0) {
      console.warn('⚠️ No healthy routes available, using degraded routes');
      const degradedRoutes = Array.from(this.assetRoutes.values())
        .filter((route) => route.healthStatus === 'degraded')
        .sort((a, b) => a.latency - b.latency);

      const fallbackRoute =
        degradedRoutes[0] || Array.from(this.assetRoutes.values())[0];
      // TODO: Review non-null assertion - consider null safety
      if (!fallbackRoute) {
        throw new Error('No routes available');
      }
      return fallbackRoute;
    }

    // Weighted selection for load balancing
    const totalScore = availableRoutes.reduce(
      (sum, route) => sum + this.calculateRouteScore(route),
      0,
    );
    const random = Math.random() * totalScore;

    let cumulativeScore = 0;
    for (const route of availableRoutes) {
      cumulativeScore += this.calculateRouteScore(route);
      if (random <= cumulativeScore) {
        return route;
      }
    }

    const fallbackRoute = availableRoutes[0];
    // TODO: Review non-null assertion - consider null safety
    if (!fallbackRoute) {
      throw new Error('No available routes for load balancing');
    }
    return fallbackRoute;
  }

  /**
   * Detect device capabilities for optimization
   */
  private detectDeviceCapabilities(): any {
    // Simplified device detection (in real implementation, use User Agent, etc.)
    const cores = navigator.hardwareConcurrency || 4;
    const memory = (navigator as any).deviceMemory || 4; // GB

    return {
      lowEnd: cores <= 2 || memory <= 2,
      premium: cores >= 8 && memory >= 8,
      // TODO: Review non-null assertion - consider null safety
      webGL: !!window.WebGLRenderingContext,
      cores,
      memory,
    };
  }

  /**
   * Detect network quality for optimization
   */
  private detectNetworkQuality(): 'slow' | 'medium' | 'fast' {
    const connection = (navigator as any).connection;
    // TODO: Review non-null assertion - consider null safety
    if (!connection) return 'medium';

    const effectiveType = connection.effectiveType;
    if (effectiveType === 'slow-2g' || effectiveType === '2g') return 'slow';
    if (effectiveType === '4g' || connection.downlink > 10) return 'fast';
    return 'medium';
  }

  /**
   * Circuit breaker for route health management
   */
  private shouldUseRoute(routeId: string): boolean {
    const route = this.assetRoutes.get(routeId);
    // TODO: Review non-null assertion - consider null safety
    if (!route) return false;

    // Circuit breaker logic
    if (route.healthStatus === 'unavailable') {
      // Check if enough time has passed to try again
      const lastFailure = route.lastFailureTime || 0;
      const circuitBreakerTimeout = 30000; // 30 seconds

      if (Date.now() - lastFailure > circuitBreakerTimeout) {
        route.healthStatus = 'degraded'; // Allow testing
        console.log(`🔄 Circuit breaker reset for route ${routeId}`);
        return true;
      }
      return false;
    }

    return true;
  }

  /**
   * Export current configuration and routes
   */
  public exportConfiguration(): {
    config: N8nIntegrationConfig & {
      loadBalancingEnabled: boolean;
      preprocessingEnabled: boolean;
      circuitBreakerEnabled: boolean;
      retryStrategies: string[];
    };
    routes: Record<string, N8nAssetRoute>;
    recentMetrics: {
      routingDecisions: number;
      loadBalancingDecisions: number;
      preprocessingOptimizations: number;
      circuitBreakerActivations: number;
      averageOptimizationSavings: number;
    };
  } {
    return {
      config: {
        ...this.config,
        loadBalancingEnabled: this.config.enableLoadBalancing,
        preprocessingEnabled: this.config.enableAssetPreprocessing,
        circuitBreakerEnabled: true,
        retryStrategies: ['exponential-backoff', 'jitter', 'route-failover'],
      },
      routes: Object.fromEntries(this.assetRoutes),
      recentMetrics: {
        routingDecisions: this.routingHistory.length,
        loadBalancingDecisions: this.routingHistory.filter((h) =>
          h.reason?.includes('Load-balanced'),
        ).length,
        preprocessingOptimizations: this.routingHistory.filter(
          (h) => h.preprocessing === true,
        ).length,
        circuitBreakerActivations: Array.from(this.assetRoutes.values()).filter(
          (r) => r.healthStatus === 'unavailable',
        ).length,
        averageOptimizationSavings:
          this.cdnOptimizationSavings /
          Math.max(1, this.processedAssets.length),
      },
    };
  }
}

export default N8nAssetPipelineProcessor;
