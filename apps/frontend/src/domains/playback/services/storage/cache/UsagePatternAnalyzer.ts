/**
 * Story 2.4 Task 4.4: Intelligent Sample Caching - Usage Pattern Analyzer
 * UsagePatternAnalyzer - Tracks and analyzes cache usage patterns for optimization
 *
 * Provides intelligent usage analysis including:
 * - Access frequency tracking
 * - Temporal usage patterns
 * - User behavior analysis
 * - Predictive usage modeling
 * - Cache optimization recommendations
 */

import {
  SampleCacheEntry,
  AudioSampleQualityProfile,
  AudioSampleCategory,
} from '@bassnotion/contracts';

/**
 * Usage pattern analysis interfaces
 */
export interface UsagePattern {
  sampleId: string;
  accessFrequency: number; // Accesses per time window
  recentAccesses: number[]; // Timestamps of recent accesses
  averageSessionDuration: number; // Average time sample is used
  timeOfDayPattern: number[]; // 24-hour usage distribution
  dayOfWeekPattern: number[]; // 7-day usage distribution
  qualityPreference: AudioSampleQualityProfile;
  categoryAffinity: number; // How much user likes this category
  sequentialPatterns: string[]; // Samples often accessed together
  lastAnalyzed: number;
}

export interface UsageAnalysisResult {
  totalSamples: number;
  activePatterns: number;
  averageAccessFrequency: number;
  peakUsageHours: number[];
  popularCategories: AudioSampleCategory[];
  qualityDistribution: Record<AudioSampleQualityProfile, number>;
  sequentialChains: SequentialChain[];
  cacheOptimizationRecommendations: CacheRecommendation[];
  analysisTimestamp: number;
}

export interface SequentialChain {
  sequence: string[]; // Sample IDs in order
  frequency: number; // How often this sequence occurs
  confidence: number; // Confidence in prediction (0-1)
  averageGap: number; // Average time between accesses in sequence
}

export interface CacheRecommendation {
  type: 'preload' | 'evict' | 'quality_adjust' | 'compression';
  sampleId: string;
  reason: string;
  confidence: number; // 0-1
  estimatedBenefit: number; // Estimated cache hit improvement
  priority: 'low' | 'medium' | 'high';
}

export interface UsageAnalyzerConfig {
  enabled: boolean;
  analysisWindow: number; // Time window for analysis in ms
  minAccessesForPattern: number; // Minimum accesses to establish pattern
  sequentialDetectionWindow: number; // Time window to detect sequences
  temporalAnalysisEnabled: boolean;
  behaviorPredictionEnabled: boolean;
  recommendationGenerationEnabled: boolean;
  maxPatternsToTrack: number;
  patternDecayFactor: number; // How quickly old patterns fade (0-1)
}

/**
 * Usage Pattern Analyzer
 *
 * Analyzes cache usage patterns to optimize caching strategies and predict future access.
 * Provides insights for intelligent eviction, predictive preloading, and cache optimization.
 */
export class UsagePatternAnalyzer {
  private config: UsageAnalyzerConfig;
  private patterns: Map<string, UsagePattern> = new Map();
  private accessHistory: Array<{ sampleId: string; timestamp: number }> = [];
  private analysisResults: UsageAnalysisResult | null = null;

  // Analysis state
  private lastAnalysisTime = 0;
  private isAnalyzing = false;

  constructor(config: UsageAnalyzerConfig) {
    this.config = config;
  }

  /**
   * Record a cache access for pattern analysis
   */
  public recordAccess(
    sampleId: string,
    entry: SampleCacheEntry,
    sessionDuration?: number,
  ): void {
    // TODO: Review non-null assertion - consider null safety
    if (!this.config.enabled) {
      return;
    }

    const timestamp = Date.now();

    // Add to access history
    this.accessHistory.push({ sampleId, timestamp });

    // Maintain history size
    this.pruneAccessHistory();

    // Update or create usage pattern
    this.updateUsagePattern(sampleId, entry, timestamp, sessionDuration);

    // Trigger analysis if needed
    if (this.shouldTriggerAnalysis()) {
      this.scheduleAnalysis();
    }
  }

  /**
   * Get usage pattern for a specific sample
   */
  public getUsagePattern(sampleId: string): UsagePattern | null {
    return this.patterns.get(sampleId) || null;
  }

  /**
   * Get all tracked usage patterns
   */
  public getAllPatterns(): UsagePattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Analyze usage patterns and generate insights
   */
  public async analyzePatterns(): Promise<UsageAnalysisResult> {
    if (this.isAnalyzing) {
      return this.analysisResults || this.getEmptyAnalysisResult();
    }

    this.isAnalyzing = true;

    try {
      const result = await this.performAnalysis();
      this.analysisResults = result;
      this.lastAnalysisTime = Date.now();
      return result;
    } finally {
      this.isAnalyzing = false;
    }
  }

  /**
   * Get the latest analysis results
   */
  public getLatestAnalysis(): UsageAnalysisResult | null {
    return this.analysisResults;
  }

  /**
   * Predict next likely accesses based on patterns
   */
  public predictNextAccesses(
    currentSampleId?: string,
    maxPredictions = 5,
  ): Array<{ sampleId: string; confidence: number; timeToAccess: number }> {
    // TODO: Review non-null assertion - consider null safety
    if (!this.config.behaviorPredictionEnabled) {
      return [];
    }

    const predictions: Array<{
      sampleId: string;
      confidence: number;
      timeToAccess: number;
    }> = [];

    // Time-based predictions
    const timeBasedPredictions = this.getTimeBasedPredictions();
    predictions.push(...timeBasedPredictions);

    // Sequential predictions
    if (currentSampleId) {
      const sequentialPredictions =
        this.getSequentialPredictions(currentSampleId);
      predictions.push(...sequentialPredictions);
    }

    // Frequency-based predictions
    const frequencyPredictions = this.getFrequencyBasedPredictions();
    predictions.push(...frequencyPredictions);

    // Sort by confidence and return top predictions
    return predictions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxPredictions);
  }

  /**
   * Generate cache optimization recommendations
   */
  public generateRecommendations(): CacheRecommendation[] {
    // TODO: Review non-null assertion - consider null safety
    if (!this.config.recommendationGenerationEnabled) {
      return [];
    }

    const recommendations: CacheRecommendation[] = [];

    // Preload recommendations
    recommendations.push(...this.generatePreloadRecommendations());

    // Eviction recommendations
    recommendations.push(...this.generateEvictionRecommendations());

    // Quality adjustment recommendations
    recommendations.push(...this.generateQualityRecommendations());

    return recommendations.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get cache efficiency score based on usage patterns
   */
  public getCacheEfficiencyScore(): number {
    const patterns = Array.from(this.patterns.values());
    if (patterns.length === 0) {
      return 0.5; // Neutral score
    }

    let totalScore = 0;
    let weightedCount = 0;

    for (const pattern of patterns) {
      // Score based on access frequency and recency
      const frequencyScore = Math.min(pattern.accessFrequency / 10, 1); // Normalize to 0-1
      const recencyScore = this.getRecencyScore(pattern.recentAccesses);
      const patternScore = (frequencyScore + recencyScore) / 2;

      // Weight by access frequency
      const weight = pattern.accessFrequency;
      totalScore += patternScore * weight;
      weightedCount += weight;
    }

    return weightedCount > 0 ? totalScore / weightedCount : 0.5;
  }

  /**
   * Clear all tracked patterns and history
   */
  public clearPatterns(): void {
    this.patterns.clear();
    this.accessHistory = [];
    this.analysisResults = null;
    this.lastAnalysisTime = 0;
  }

  // Private implementation methods

  private updateUsagePattern(
    sampleId: string,
    entry: SampleCacheEntry,
    timestamp: number,
    sessionDuration?: number,
  ): void {
    let pattern = this.patterns.get(sampleId);

    // TODO: Review non-null assertion - consider null safety
    if (!pattern) {
      pattern = this.createNewPattern(sampleId, entry, timestamp);
    }

    // Update access frequency
    pattern.accessFrequency = this.calculateAccessFrequency(
      pattern.recentAccesses,
    );

    // Add recent access
    pattern.recentAccesses.push(timestamp);
    this.pruneRecentAccesses(pattern);

    // Update session duration
    if (sessionDuration !== undefined) {
      pattern.averageSessionDuration =
        (pattern.averageSessionDuration + sessionDuration) / 2;
    }

    // Update temporal patterns
    if (this.config.temporalAnalysisEnabled) {
      this.updateTemporalPatterns(pattern, timestamp);
    }

    // Update sequential patterns
    this.updateSequentialPatterns(sampleId, timestamp);

    pattern.lastAnalyzed = timestamp;
    this.patterns.set(sampleId, pattern);

    // Maintain pattern count limit
    this.prunePatterns();
  }

  private createNewPattern(
    sampleId: string,
    entry: SampleCacheEntry,
    timestamp: number,
  ): UsagePattern {
    return {
      sampleId,
      accessFrequency: 1,
      recentAccesses: [timestamp],
      averageSessionDuration: entry.averagePlayDuration,
      timeOfDayPattern: new Array(24).fill(0),
      dayOfWeekPattern: new Array(7).fill(0),
      qualityPreference: entry.qualityProfile,
      categoryAffinity: 0.5, // Start neutral
      sequentialPatterns: [],
      lastAnalyzed: timestamp,
    };
  }

  private calculateAccessFrequency(recentAccesses: number[]): number {
    if (recentAccesses.length === 0) {
      return 0;
    }

    const now = Date.now();
    const windowStart = now - this.config.analysisWindow;
    const recentAccessesInWindow = recentAccesses.filter(
      (access) => access >= windowStart,
    );

    return (
      (recentAccessesInWindow.length / this.config.analysisWindow) * 1000 * 60
    ); // Accesses per minute
  }

  private updateTemporalPatterns(
    pattern: UsagePattern,
    timestamp: number,
  ): void {
    const date = new Date(timestamp);
    const hour = date.getHours();
    const dayOfWeek = date.getDay();

    // Update time of day pattern
    if (pattern.timeOfDayPattern[hour] !== undefined) {
      pattern.timeOfDayPattern[hour] += 1;
    }

    // Update day of week pattern
    if (pattern.dayOfWeekPattern[dayOfWeek] !== undefined) {
      pattern.dayOfWeekPattern[dayOfWeek] += 1;
    }

    // Normalize patterns to prevent unbounded growth
    this.normalizePattern(pattern.timeOfDayPattern);
    this.normalizePattern(pattern.dayOfWeekPattern);
  }

  private normalizePattern(pattern: number[]): void {
    const max = Math.max(...pattern);
    if (max > 100) {
      // Normalize when values get too large
      for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] !== undefined) {
          pattern[i] = (pattern[i] as number) / max;
        }
      }
    }
  }

  private updateSequentialPatterns(sampleId: string, timestamp: number): void {
    // Look for recent accesses to detect sequences
    const recentWindow = timestamp - this.config.sequentialDetectionWindow;
    const recentAccesses = this.accessHistory
      .filter((access) => access.timestamp >= recentWindow)
      .slice(-10); // Look at last 10 accesses

    if (recentAccesses.length >= 2) {
      const sequence = recentAccesses.map((access) => access.sampleId);
      this.recordSequentialPattern(sequence);
    }
  }

  private recordSequentialPattern(sequence: string[]): void {
    // This is a simplified implementation
    // In a full implementation, you'd use more sophisticated sequence mining
    for (let i = 0; i < sequence.length - 1; i++) {
      const current = sequence[i];
      const next = sequence[i + 1];

      if (current && next) {
        const pattern = this.patterns.get(current);
        // TODO: Review non-null assertion - consider null safety
        if (pattern && !pattern.sequentialPatterns.includes(next)) {
          pattern.sequentialPatterns.push(next);
          // Limit sequential patterns to prevent memory growth
          if (pattern.sequentialPatterns.length > 10) {
            pattern.sequentialPatterns.shift();
          }
        }
      }
    }
  }

  private pruneRecentAccesses(pattern: UsagePattern): void {
    const cutoff = Date.now() - this.config.analysisWindow;
    pattern.recentAccesses = pattern.recentAccesses.filter(
      (access) => access >= cutoff,
    );

    // Also limit total count
    if (pattern.recentAccesses.length > 1000) {
      pattern.recentAccesses = pattern.recentAccesses.slice(-1000);
    }
  }

  private pruneAccessHistory(): void {
    const cutoff = Date.now() - this.config.analysisWindow * 2; // Keep 2x window
    this.accessHistory = this.accessHistory.filter(
      (access) => access.timestamp >= cutoff,
    );

    // Also limit total count
    if (this.accessHistory.length > 10000) {
      this.accessHistory = this.accessHistory.slice(-10000);
    }
  }

  private prunePatterns(): void {
    if (this.patterns.size <= this.config.maxPatternsToTrack) {
      return;
    }

    // Remove least recently analyzed patterns
    const patterns = Array.from(this.patterns.entries());
    patterns.sort((a, b) => a[1].lastAnalyzed - b[1].lastAnalyzed);

    const toRemove = patterns.slice(
      0,
      patterns.length - this.config.maxPatternsToTrack,
    );
    for (const [sampleId] of toRemove) {
      this.patterns.delete(sampleId);
    }
  }

  private shouldTriggerAnalysis(): boolean {
    const timeSinceLastAnalysis = Date.now() - this.lastAnalysisTime;
    return timeSinceLastAnalysis > this.config.analysisWindow / 2; // Analyze every half window
  }

  private scheduleAnalysis(): void {
    // Use setTimeout to avoid blocking
    setTimeout(() => {
      this.analyzePatterns().catch((error) => {
        console.warn('Usage pattern analysis failed:', error);
      });
    }, 100);
  }

  private async performAnalysis(): Promise<UsageAnalysisResult> {
    const patterns = Array.from(this.patterns.values());

    const result: UsageAnalysisResult = {
      totalSamples: patterns.length,
      activePatterns: patterns.filter(
        (p) => Date.now() - p.lastAnalyzed < this.config.analysisWindow,
      ).length,
      averageAccessFrequency:
        patterns.reduce((sum, p) => sum + p.accessFrequency, 0) /
          patterns.length || 0,
      peakUsageHours: this.calculatePeakUsageHours(patterns),
      popularCategories: this.calculatePopularCategories(patterns),
      qualityDistribution: this.calculateQualityDistribution(patterns),
      sequentialChains: this.calculateSequentialChains(patterns),
      cacheOptimizationRecommendations: this.generateRecommendations(),
      analysisTimestamp: Date.now(),
    };

    return result;
  }

  private calculatePeakUsageHours(patterns: UsagePattern[]): number[] {
    const hourlyUsage = new Array(24).fill(0);

    for (const pattern of patterns) {
      for (let hour = 0; hour < 24; hour++) {
        hourlyUsage[hour] += pattern.timeOfDayPattern[hour];
      }
    }

    // Find top 3 peak hours
    const indexed = hourlyUsage.map((usage, hour) => ({ hour, usage }));
    indexed.sort((a, b) => b.usage - a.usage);
    return indexed.slice(0, 3).map((item) => item.hour);
  }

  private calculatePopularCategories(
    _patterns: UsagePattern[],
  ): AudioSampleCategory[] {
    // This would need to be implemented with access to sample metadata
    // For now, return empty array
    return [];
  }

  private calculateQualityDistribution(
    patterns: UsagePattern[],
  ): Record<AudioSampleQualityProfile, number> {
    const distribution: Record<AudioSampleQualityProfile, number> = {
      studio: 0,
      performance: 0,
      practice: 0,
      preview: 0,
      mobile: 0,
      streaming: 0,
    };

    for (const pattern of patterns) {
      distribution[pattern.qualityPreference] += pattern.accessFrequency;
    }

    return distribution;
  }

  private calculateSequentialChains(
    patterns: UsagePattern[],
  ): SequentialChain[] {
    // Simplified implementation
    const chains: SequentialChain[] = [];

    for (const pattern of patterns) {
      for (const nextSample of pattern.sequentialPatterns) {
        chains.push({
          sequence: [pattern.sampleId, nextSample],
          frequency: 1, // Would calculate from actual data
          confidence: 0.5, // Would calculate based on pattern strength
          averageGap: 5000, // 5 seconds average
        });
      }
    }

    return chains.slice(0, 10); // Return top 10 chains
  }

  private getTimeBasedPredictions(): Array<{
    sampleId: string;
    confidence: number;
    timeToAccess: number;
  }> {
    const now = new Date();
    const currentHour = now.getHours();
    const predictions: Array<{
      sampleId: string;
      confidence: number;
      timeToAccess: number;
    }> = [];

    for (const pattern of Array.from(this.patterns.values())) {
      const hourlyUsage = pattern.timeOfDayPattern[currentHour];
      const totalUsage = pattern.timeOfDayPattern.reduce(
        (sum: number, usage: number) => sum + usage,
        0,
      );

      if (totalUsage > 0 && hourlyUsage !== undefined) {
        const confidence = hourlyUsage / totalUsage;
        if (confidence > 0.1) {
          // Only predict if reasonably confident
          predictions.push({
            sampleId: pattern.sampleId,
            confidence,
            timeToAccess: 60000, // Predict within 1 minute
          });
        }
      }
    }

    return predictions;
  }

  private getSequentialPredictions(currentSampleId: string): Array<{
    sampleId: string;
    confidence: number;
    timeToAccess: number;
  }> {
    const pattern = this.patterns.get(currentSampleId);
    // TODO: Review non-null assertion - consider null safety
    if (!pattern) {
      return [];
    }

    return pattern.sequentialPatterns.map((nextSampleId) => ({
      sampleId: nextSampleId,
      confidence: 0.7, // Would calculate based on sequence strength
      timeToAccess: 10000, // Predict within 10 seconds
    }));
  }

  private getFrequencyBasedPredictions(): Array<{
    sampleId: string;
    confidence: number;
    timeToAccess: number;
  }> {
    const patterns = Array.from(this.patterns.values());
    patterns.sort((a, b) => b.accessFrequency - a.accessFrequency);

    return patterns.slice(0, 5).map((pattern) => ({
      sampleId: pattern.sampleId,
      confidence: Math.min(pattern.accessFrequency / 10, 0.8), // Cap at 0.8
      timeToAccess: 300000, // Predict within 5 minutes
    }));
  }

  private generatePreloadRecommendations(): CacheRecommendation[] {
    const predictions = this.predictNextAccesses();
    return predictions
      .filter((pred) => pred.confidence > 0.6)
      .map((pred) => ({
        type: 'preload' as const,
        sampleId: pred.sampleId,
        reason: `High prediction confidence (${(pred.confidence * 100).toFixed(1)}%)`,
        confidence: pred.confidence,
        estimatedBenefit: pred.confidence * 0.5, // Estimated cache hit improvement
        priority:
          pred.confidence > 0.8 ? ('high' as const) : ('medium' as const),
      }));
  }

  private generateEvictionRecommendations(): CacheRecommendation[] {
    const patterns = Array.from(this.patterns.values());
    const lowUsagePatterns = patterns
      .filter((p) => p.accessFrequency < 0.1) // Less than 0.1 accesses per minute
      .sort((a, b) => a.accessFrequency - b.accessFrequency);

    return lowUsagePatterns.slice(0, 5).map((pattern) => ({
      type: 'evict' as const,
      sampleId: pattern.sampleId,
      reason: `Low usage frequency (${pattern.accessFrequency.toFixed(2)} accesses/min)`,
      confidence: 0.8,
      estimatedBenefit: 0.2, // Memory savings
      priority: 'low' as const,
    }));
  }

  private generateQualityRecommendations(): CacheRecommendation[] {
    // This would analyze quality usage patterns and recommend adjustments
    // For now, return empty array
    return [];
  }

  private getRecencyScore(recentAccesses: number[]): number {
    if (recentAccesses.length === 0) {
      return 0;
    }

    const now = Date.now();
    const mostRecent = Math.max(...recentAccesses);
    const timeSinceLastAccess = now - mostRecent;

    // Score decreases exponentially with time
    return Math.exp(-timeSinceLastAccess / (this.config.analysisWindow / 4));
  }

  private getEmptyAnalysisResult(): UsageAnalysisResult {
    return {
      totalSamples: 0,
      activePatterns: 0,
      averageAccessFrequency: 0,
      peakUsageHours: [],
      popularCategories: [],
      qualityDistribution: {
        studio: 0,
        performance: 0,
        practice: 0,
        preview: 0,
        mobile: 0,
        streaming: 0,
      },
      sequentialChains: [],
      cacheOptimizationRecommendations: [],
      analysisTimestamp: Date.now(),
    };
  }
}

export default UsagePatternAnalyzer;
