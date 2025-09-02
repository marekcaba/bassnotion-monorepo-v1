/**
 * PreloadStrategy - Intelligent preloading strategies for audio assets
 * 
 * Provides various preloading strategies including predictive loading,
 * priority-based loading, and adaptive preloading based on usage patterns.
 * Simplified from the more complex PredictiveLoadingEngine.
 */

import { AssetLoader, type AssetDefinition } from './AssetLoader.js';
import { EventBus } from '../../../services/core/EventBus.js';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('PreloadStrategy');

export type PreloadPriority = 'critical' | 'high' | 'medium' | 'low' | 'deferred';

export interface PreloadItem {
  assetId: string;
  priority: PreloadPriority;
  deadline?: number; // When the asset is likely to be needed
  confidence?: number; // Prediction confidence 0-1
  size?: number;
  dependencies?: string[];
}

export interface PreloadConfig {
  maxConcurrentLoads: number;
  maxPreloadSize: number; // Max total size to preload
  enablePredictive: boolean;
  enableAdaptive: boolean;
  networkAware: boolean;
  priorityWeights: Record<PreloadPriority, number>;
}

export interface PreloadProgress {
  total: number;
  loaded: number;
  failed: number;
  inProgress: number;
  totalSize: number;
  loadedSize: number;
}

export interface PreloadResult {
  successful: string[];
  failed: string[];
  skipped: string[];
  totalTime: number;
  totalSize: number;
}

export interface UsagePattern {
  assetId: string;
  accessCount: number;
  lastAccessed: number;
  averageLeadTime: number; // Average time between preload and use
  coOccurrence: Map<string, number>; // Assets often used together
}

/**
 * Strategy types for different preloading approaches
 */
export type StrategyType = 
  | 'priority'     // Load by priority
  | 'predictive'   // Load based on predictions
  | 'sequential'   // Load in sequence order
  | 'adaptive'     // Adapt based on usage
  | 'network'      // Adapt based on network conditions
  | 'hybrid';      // Combination of strategies

/**
 * Manages intelligent preloading of assets
 */
export class PreloadStrategy {
  private config: PreloadConfig;
  private assetLoader: AssetLoader;
  private eventBus?: EventBus;
  
  // Preload state
  private preloadQueue: PreloadItem[] = [];
  private activeLoads = new Map<string, Promise<void>>();
  private loadedAssets = new Set<string>();
  private failedAssets = new Set<string>();
  
  // Usage tracking
  private usagePatterns = new Map<string, UsagePattern>();
  private sessionStartTime = Date.now();
  
  // Network state
  private currentNetworkSpeed: 'slow' | 'medium' | 'fast' = 'medium';
  private lastNetworkCheck = 0;

  constructor(
    config: PreloadConfig,
    assetLoader: AssetLoader,
    eventBus?: EventBus
  ) {
    this.config = config;
    this.assetLoader = assetLoader;
    this.eventBus = eventBus;
    
    this.initializeNetworkMonitoring();
  }

  /**
   * Add items to preload queue
   */
  queuePreload(items: PreloadItem | PreloadItem[]): void {
    const itemsArray = Array.isArray(items) ? items : [items];
    
    for (const item of itemsArray) {
      // Skip if already loaded or failed
      if (this.loadedAssets.has(item.assetId) || 
          this.failedAssets.has(item.assetId)) {
        continue;
      }
      
      // Add or update in queue
      const existingIndex = this.preloadQueue.findIndex(
        i => i.assetId === item.assetId
      );
      
      if (existingIndex >= 0) {
        // Update priority if higher
        const existing = this.preloadQueue[existingIndex];
        if (this.getPriorityWeight(item.priority) > 
            this.getPriorityWeight(existing.priority)) {
          this.preloadQueue[existingIndex] = item;
        }
      } else {
        this.preloadQueue.push(item);
      }
    }
    
    // Re-sort queue
    this.sortQueue();
  }

  /**
   * Execute preloading with specified strategy
   */
  async executePreload(
    strategy: StrategyType = 'priority'
  ): Promise<PreloadResult> {
    const startTime = performance.now();
    const result: PreloadResult = {
      successful: [],
      failed: [],
      skipped: [],
      totalTime: 0,
      totalSize: 0,
    };
    
    try {
      // Apply strategy-specific sorting/filtering
      const itemsToLoad = this.applyStrategy(strategy);
      
      // Check size limits
      const filteredItems = this.applyResourceLimits(itemsToLoad);
      result.skipped = itemsToLoad
        .filter(item => !filteredItems.includes(item))
        .map(item => item.assetId);
      
      // Execute preloading
      await this.executePreloadBatch(filteredItems, result);
      
      result.totalTime = performance.now() - startTime;
      
      // Emit completion
      this.eventBus?.emit('preload:completed', result);
      
      return result;
    } catch (error) {
      logger.error('Preload execution failed:', error);
      throw error;
    }
  }

  /**
   * Predict next assets to load
   */
  predictNextAssets(
    currentAssetId: string,
    limit: number = 10
  ): PreloadItem[] {
    if (!this.config.enablePredictive) {
      return [];
    }
    
    const predictions: PreloadItem[] = [];
    const pattern = this.usagePatterns.get(currentAssetId);
    
    if (pattern && pattern.coOccurrence.size > 0) {
      // Sort by co-occurrence frequency
      const sorted = Array.from(pattern.coOccurrence.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);
      
      for (const [assetId, count] of sorted) {
        const confidence = count / pattern.accessCount;
        
        predictions.push({
          assetId,
          priority: confidence > 0.7 ? 'high' : 'medium',
          confidence,
          deadline: Date.now() + pattern.averageLeadTime,
        });
      }
    }
    
    return predictions;
  }

  /**
   * Record asset usage for adaptive learning
   */
  recordAssetUsage(assetId: string, context?: {
    previousAsset?: string;
    sessionTime?: number;
  }): void {
    if (!this.config.enableAdaptive) return;
    
    // Update usage pattern
    let pattern = this.usagePatterns.get(assetId);
    if (!pattern) {
      pattern = {
        assetId,
        accessCount: 0,
        lastAccessed: Date.now(),
        averageLeadTime: 0,
        coOccurrence: new Map(),
      };
      this.usagePatterns.set(assetId, pattern);
    }
    
    pattern.accessCount++;
    pattern.lastAccessed = Date.now();
    
    // Update co-occurrence
    if (context?.previousAsset) {
      const coCount = pattern.coOccurrence.get(context.previousAsset) || 0;
      pattern.coOccurrence.set(context.previousAsset, coCount + 1);
    }
    
    // Update lead time if this was preloaded
    if (this.loadedAssets.has(assetId)) {
      const leadTime = Date.now() - (context?.sessionTime || this.sessionStartTime);
      pattern.averageLeadTime = 
        (pattern.averageLeadTime * (pattern.accessCount - 1) + leadTime) / 
        pattern.accessCount;
    }
    
    this.eventBus?.emit('preload:assetUsed', {
      assetId,
      pattern,
    });
  }

  /**
   * Clear preload queue
   */
  clearQueue(): void {
    this.preloadQueue = [];
  }

  /**
   * Get current preload progress
   */
  getProgress(): PreloadProgress {
    return {
      total: this.preloadQueue.length + this.loadedAssets.size,
      loaded: this.loadedAssets.size,
      failed: this.failedAssets.size,
      inProgress: this.activeLoads.size,
      totalSize: 0, // Would need asset sizes
      loadedSize: 0, // Would need to track
    };
  }

  /**
   * Apply strategy-specific logic
   */
  private applyStrategy(strategy: StrategyType): PreloadItem[] {
    switch (strategy) {
      case 'priority':
        return this.applyPriorityStrategy();
        
      case 'predictive':
        return this.applyPredictiveStrategy();
        
      case 'sequential':
        return this.applySequentialStrategy();
        
      case 'adaptive':
        return this.applyAdaptiveStrategy();
        
      case 'network':
        return this.applyNetworkStrategy();
        
      case 'hybrid':
        return this.applyHybridStrategy();
        
      default:
        return this.preloadQueue;
    }
  }

  /**
   * Priority-based strategy
   */
  private applyPriorityStrategy(): PreloadItem[] {
    return [...this.preloadQueue].sort((a, b) => {
      const weightA = this.getPriorityWeight(a.priority);
      const weightB = this.getPriorityWeight(b.priority);
      return weightB - weightA;
    });
  }

  /**
   * Predictive strategy based on confidence
   */
  private applyPredictiveStrategy(): PreloadItem[] {
    return [...this.preloadQueue]
      .filter(item => item.confidence !== undefined)
      .sort((a, b) => {
        const confA = a.confidence || 0;
        const confB = b.confidence || 0;
        return confB - confA;
      });
  }

  /**
   * Sequential strategy (FIFO)
   */
  private applySequentialStrategy(): PreloadItem[] {
    return [...this.preloadQueue];
  }

  /**
   * Adaptive strategy based on usage patterns
   */
  private applyAdaptiveStrategy(): PreloadItem[] {
    return [...this.preloadQueue].sort((a, b) => {
      const patternA = this.usagePatterns.get(a.assetId);
      const patternB = this.usagePatterns.get(b.assetId);
      
      const scoreA = patternA ? patternA.accessCount / (Date.now() - patternA.lastAccessed) : 0;
      const scoreB = patternB ? patternB.accessCount / (Date.now() - patternB.lastAccessed) : 0;
      
      return scoreB - scoreA;
    });
  }

  /**
   * Network-aware strategy
   */
  private applyNetworkStrategy(): PreloadItem[] {
    this.updateNetworkSpeed();
    
    return [...this.preloadQueue].filter(item => {
      // Filter based on network speed and asset size
      if (this.currentNetworkSpeed === 'slow') {
        return item.priority === 'critical' || item.priority === 'high';
      } else if (this.currentNetworkSpeed === 'medium') {
        return item.priority !== 'deferred';
      }
      return true;
    });
  }

  /**
   * Hybrid strategy combining multiple approaches
   */
  private applyHybridStrategy(): PreloadItem[] {
    return [...this.preloadQueue].sort((a, b) => {
      // Combine priority, confidence, and usage
      const priorityA = this.getPriorityWeight(a.priority);
      const priorityB = this.getPriorityWeight(b.priority);
      
      const confidenceA = a.confidence || 0.5;
      const confidenceB = b.confidence || 0.5;
      
      const patternA = this.usagePatterns.get(a.assetId);
      const patternB = this.usagePatterns.get(b.assetId);
      const usageScoreA = patternA ? patternA.accessCount / 10 : 0;
      const usageScoreB = patternB ? patternB.accessCount / 10 : 0;
      
      const totalA = priorityA * 0.4 + confidenceA * 0.4 + usageScoreA * 0.2;
      const totalB = priorityB * 0.4 + confidenceB * 0.4 + usageScoreB * 0.2;
      
      return totalB - totalA;
    });
  }

  /**
   * Apply resource limits
   */
  private applyResourceLimits(items: PreloadItem[]): PreloadItem[] {
    let totalSize = 0;
    const filtered: PreloadItem[] = [];
    
    for (const item of items) {
      const estimatedSize = item.size || 1024 * 1024; // 1MB default
      
      if (totalSize + estimatedSize <= this.config.maxPreloadSize) {
        filtered.push(item);
        totalSize += estimatedSize;
      } else {
        break;
      }
    }
    
    return filtered;
  }

  /**
   * Execute preload batch
   */
  private async executePreloadBatch(
    items: PreloadItem[],
    result: PreloadResult
  ): Promise<void> {
    const batches = this.createBatches(items);
    
    for (const batch of batches) {
      const promises = batch.map(item => this.preloadAsset(item, result));
      await Promise.all(promises);
    }
  }

  /**
   * Preload single asset
   */
  private async preloadAsset(
    item: PreloadItem,
    result: PreloadResult
  ): Promise<void> {
    if (this.activeLoads.has(item.assetId)) {
      await this.activeLoads.get(item.assetId);
      return;
    }
    
    const loadPromise = this.assetLoader.loadAsset(item.assetId, {
      priority: item.priority === 'critical' ? 'high' : 'normal',
      preload: true,
    }).then(loadResult => {
      if (loadResult.success) {
        this.loadedAssets.add(item.assetId);
        result.successful.push(item.assetId);
        result.totalSize += loadResult.size;
      } else {
        this.failedAssets.add(item.assetId);
        result.failed.push(item.assetId);
      }
    }).catch(error => {
      logger.error(`Failed to preload ${item.assetId}:`, error);
      this.failedAssets.add(item.assetId);
      result.failed.push(item.assetId);
    }).finally(() => {
      this.activeLoads.delete(item.assetId);
    });
    
    this.activeLoads.set(item.assetId, loadPromise);
    await loadPromise;
  }

  /**
   * Create batches for concurrent loading
   */
  private createBatches(items: PreloadItem[]): PreloadItem[][] {
    const batches: PreloadItem[][] = [];
    const batchSize = this.config.maxConcurrentLoads;
    
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    
    return batches;
  }

  /**
   * Sort preload queue
   */
  private sortQueue(): void {
    this.preloadQueue.sort((a, b) => {
      const weightA = this.getPriorityWeight(a.priority);
      const weightB = this.getPriorityWeight(b.priority);
      
      if (weightA !== weightB) {
        return weightB - weightA;
      }
      
      // Secondary sort by deadline
      if (a.deadline && b.deadline) {
        return a.deadline - b.deadline;
      }
      
      return 0;
    });
  }

  /**
   * Get priority weight
   */
  private getPriorityWeight(priority: PreloadPriority): number {
    return this.config.priorityWeights[priority] || 0;
  }

  /**
   * Initialize network monitoring
   */
  private initializeNetworkMonitoring(): void {
    if (!this.config.networkAware) return;
    
    // Monitor connection changes
    if (typeof window !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        connection.addEventListener('change', () => {
          this.updateNetworkSpeed();
        });
      }
    }
  }

  /**
   * Update network speed estimation
   */
  private updateNetworkSpeed(): void {
    const now = Date.now();
    if (now - this.lastNetworkCheck < 10000) return; // Check every 10s
    
    this.lastNetworkCheck = now;
    
    if (typeof window !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection && connection.effectiveType) {
        switch (connection.effectiveType) {
          case 'slow-2g':
          case '2g':
            this.currentNetworkSpeed = 'slow';
            break;
          case '3g':
            this.currentNetworkSpeed = 'medium';
            break;
          case '4g':
            this.currentNetworkSpeed = 'fast';
            break;
        }
      }
    }
  }

  /**
   * Get usage statistics
   */
  getUsageStats(): {
    totalPatterns: number;
    averageAccessCount: number;
    mostUsedAssets: Array<{ assetId: string; count: number }>;
  } {
    const patterns = Array.from(this.usagePatterns.values());
    
    return {
      totalPatterns: patterns.length,
      averageAccessCount: patterns.length > 0
        ? patterns.reduce((sum, p) => sum + p.accessCount, 0) / patterns.length
        : 0,
      mostUsedAssets: patterns
        .sort((a, b) => b.accessCount - a.accessCount)
        .slice(0, 10)
        .map(p => ({ assetId: p.assetId, count: p.accessCount })),
    };
  }

  /**
   * Clear all state
   */
  clear(): void {
    this.preloadQueue = [];
    this.activeLoads.clear();
    this.loadedAssets.clear();
    this.failedAssets.clear();
    this.usagePatterns.clear();
  }
}