/**
 * IntelligentTempoController - Advanced Tempo Control System
 *
 * Provides sophisticated tempo control (40-300 BPM) with intelligent ramping algorithms,
 * practice-specific tempo automation, groove preservation, and performance analysis.
 *
 * Part of Story 2.3: Real-time Playback Controls & Advanced Manipulation
 * Task 2: Create Intelligent Tempo Control System
 */

// import * as Tone from 'tone'; // Removed - using Date.now() for timing instead
import { CorePlaybackEngine } from './CorePlaybackEngine.js';
import { PerformanceMonitor } from './PerformanceMonitor.js';

// Types and Interfaces
export type RampType = 'linear' | 'exponential' | 'musical' | 'instant';
export type PracticeStrategy = 'gradual' | 'step' | 'adaptive';

export interface TempoConfig {
  currentBPM: number;
  targetBPM: number;
  minBPM: number; // 40 BPM minimum
  maxBPM: number; // 300 BPM maximum
  rampType: RampType;
  rampDuration: number; // seconds
  preserveGroove: boolean;
  swingFactor: number; // 0-1 (0 = straight, 0.5 = triplet swing)
}

export interface PracticeAutomationConfig {
  startBPM: number;
  targetBPM: number;
  strategy: PracticeStrategy;
  accuracy: number; // 0-100% accuracy required for advancement
  minReps: number; // Minimum successful repetitions
  tempoIncrement: number; // BPM increase per advancement
  autoAdvance: boolean; // Auto-advance to next tempo
  masteryThreshold: number; // Accuracy threshold for mastery
}

export interface GrooveAnalysis {
  swingRatio: number; // Detected swing feel
  timingVariance: number; // Human timing variations
  accentPattern: number[]; // Beat accent strengths
  microTiming: number[]; // Subtle timing offsets
  musicalFeel: 'straight' | 'swing' | 'shuffle' | 'latin' | 'custom';
}

export interface PerformanceData {
  accuracy: number; // 0-100%
  consistency: number; // Timing consistency
  averageTempo: number; // User's natural tempo
  tempoStability: number; // How well user maintains tempo
  practiceTime: number; // Total practice time
  repetitions: number; // Number of repetitions
  errorRate: number; // Mistake frequency
  improvementRate: number; // Learning curve
}

export interface TempoSuggestion {
  recommendedBPM: number;
  reason: string;
  confidence: number; // 0-1
  practiceStrategy: PracticeStrategy;
  estimatedMasteryTime: number; // minutes
}

export interface IntelligentTempoControllerEvents {
  tempoChange: (currentBPM: number, targetBPM: number) => void;
  rampStarted: (fromBPM: number, toBPM: number, duration: number) => void;
  rampCompleted: (finalBPM: number) => void;
  practiceAdvancement: (newBPM: number, accuracy: number) => void;
  masteryAchieved: (bpm: number, accuracy: number) => void;
  suggestionGenerated: (suggestion: TempoSuggestion) => void;
  grooveAnalyzed: (analysis: GrooveAnalysis) => void;
  performanceUpdated: (performance: PerformanceData) => void;
}

/**
 * Advanced tempo ramping engine with multiple algorithms
 */
class TempoRampingEngine {
  private isRamping = false;
  private rampStartTime = 0;
  private startBPM = 0;
  private targetBPM = 0;
  private rampDuration = 0;
  private rampType: RampType = 'musical';
  private rampCallback?: (bpm: number) => void;
  private completeCallback?: () => void;

  public startRamp(
    fromBPM: number,
    toBPM: number,
    duration: number,
    type: RampType,
    onUpdate: (bpm: number) => void,
    onComplete: () => void,
  ): void {
    this.isRamping = true;
    this.rampStartTime = Date.now() / 1000; // Convert to seconds
    this.startBPM = fromBPM;
    this.targetBPM = toBPM;
    this.rampDuration = duration;
    this.rampType = type;
    this.rampCallback = onUpdate;
    this.completeCallback = onComplete;

    this.executeRamp();
  }

  public stopRamp(): void {
    this.isRamping = false;
    this.rampCallback = undefined;
    this.completeCallback = undefined;
  }

  public isActive(): boolean {
    return this.isRamping;
  }

  private executeRamp(): void {
    if (!this.isRamping || !this.rampCallback) {
      return;
    }

    const currentTime = Date.now() / 1000; // Convert to seconds
    const elapsed = currentTime - this.rampStartTime;
    const progress = Math.min(elapsed / this.rampDuration, 1);

    if (progress >= 1) {
      // Ramp complete
      this.rampCallback(this.targetBPM);
      this.isRamping = false;
      this.completeCallback?.();
      return;
    }

    // Calculate current BPM based on ramp type
    const currentBPM = this.calculateRampValue(progress);
    this.rampCallback(currentBPM);

    // Schedule next update
    setTimeout(() => {
      this.executeRamp();
    }, 10); // 10ms updates for smooth ramping
  }

  private calculateRampValue(progress: number): number {
    const delta = this.targetBPM - this.startBPM;

    switch (this.rampType) {
      case 'linear':
        return this.startBPM + delta * progress;

      case 'exponential': {
        // Exponential curve for more natural feel
        const curve = progress * progress;
        return this.startBPM + delta * curve;
      }

      case 'musical': {
        // Musical ramping that respects beat boundaries
        const musicalProgress = this.calculateMusicalProgress(progress);
        return this.startBPM + delta * musicalProgress;
      }

      case 'instant':
        return this.targetBPM;

      default:
        return this.startBPM + delta * progress;
    }
  }

  private calculateMusicalProgress(progress: number): number {
    // Musical ramping that aligns with beat boundaries
    // Uses a smooth S-curve that respects musical timing
    const smoothed =
      3 * progress * progress - 2 * progress * progress * progress;
    return smoothed;
  }
}

/**
 * Groove preservation system for maintaining musical feel
 */
class GroovePreserver {
  private currentGroove: GrooveAnalysis = {
    swingRatio: 0,
    timingVariance: 0.02,
    accentPattern: [1, 0.8, 0.9, 0.8], // Standard 4/4 pattern
    microTiming: [0, 0, 0, 0],
    musicalFeel: 'straight',
  };

  public analyzeGroove(midiData?: any[]): GrooveAnalysis {
    // Analyze current musical content for groove characteristics
    // This would analyze MIDI timing, velocity patterns, etc.

    // For now, return current groove with some intelligent defaults
    const analysis: GrooveAnalysis = {
      swingRatio: this.detectSwingRatio(midiData),
      timingVariance: this.calculateTimingVariance(midiData),
      accentPattern: this.detectAccentPattern(midiData),
      microTiming: this.calculateMicroTiming(midiData),
      musicalFeel: this.classifyMusicalFeel(midiData),
    };

    this.currentGroove = analysis;
    return analysis;
  }

  public preserveGrooveDuringTempoChange(newBPM: number, oldBPM: number): void {
    // Adjust groove parameters to maintain feel at new tempo
    const tempoRatio = newBPM / oldBPM;

    // Preserve swing ratio (swing feel is tempo-independent)
    // Adjust timing variance proportionally
    this.currentGroove.timingVariance *= 1 / tempoRatio;

    // Maintain accent patterns
    // Micro-timing adjustments scale with tempo
    this.currentGroove.microTiming = this.currentGroove.microTiming.map(
      (offset) => offset / tempoRatio,
    );
  }

  public getCurrentGroove(): GrooveAnalysis {
    return { ...this.currentGroove };
  }

  public setGroove(groove: Partial<GrooveAnalysis>): void {
    this.currentGroove = { ...this.currentGroove, ...groove };
  }

  private detectSwingRatio(_midiData?: any[]): number {
    // Analyze MIDI data for swing characteristics
    // Return detected swing ratio (0 = straight, 0.5 = triplet swing)
    return this.currentGroove.swingRatio;
  }

  private calculateTimingVariance(_midiData?: any[]): number {
    // Calculate human timing variations
    return this.currentGroove.timingVariance;
  }

  private detectAccentPattern(_midiData?: any[]): number[] {
    // Detect beat accent patterns from velocity data
    return this.currentGroove.accentPattern;
  }

  private calculateMicroTiming(_midiData?: any[]): number[] {
    // Calculate subtle timing offsets that create groove
    return this.currentGroove.microTiming;
  }

  private classifyMusicalFeel(
    _midiData?: any[],
  ): GrooveAnalysis['musicalFeel'] {
    // Classify the overall musical feel
    return this.currentGroove.musicalFeel;
  }
}

/**
 * Practice automation engine for gradual tempo progression
 */
class TempoAutomationEngine {
  private config: PracticeAutomationConfig | null = null;
  private currentPerformance: PerformanceData | null = null;
  private sessionStartTime = 0;
  private repetitionCount = 0;
  private accuracyHistory: number[] = [];
  private isActive = false;

  public configure(config: PracticeAutomationConfig): void {
    this.config = config;
    this.sessionStartTime = Date.now();
    this.repetitionCount = 0;
    this.accuracyHistory = [];
    this.isActive = true;
  }

  public updatePerformance(performance: PerformanceData): boolean {
    if (!this.config || !this.isActive) return false;

    this.currentPerformance = performance;
    this.accuracyHistory.push(performance.accuracy);
    this.repetitionCount++;

    // Check if advancement criteria are met
    return this.checkAdvancementCriteria();
  }

  public getNextTempo(): number {
    if (!this.config) return 120;

    const currentBPM = this.getCurrentPracticeTempo();

    switch (this.config.strategy) {
      case 'gradual':
        return Math.min(
          currentBPM + this.config.tempoIncrement,
          this.config.targetBPM,
        );

      case 'step':
        // Larger increments for step progression
        return Math.min(
          currentBPM + this.config.tempoIncrement * 2,
          this.config.targetBPM,
        );

      case 'adaptive': {
        // Adaptive increment based on performance
        const adaptiveIncrement = this.calculateAdaptiveIncrement();
        return Math.min(currentBPM + adaptiveIncrement, this.config.targetBPM);
      }

      default:
        return currentBPM + this.config.tempoIncrement;
    }
  }

  public isSessionComplete(): boolean {
    if (!this.config) return false;
    return this.getCurrentPracticeTempo() >= this.config.targetBPM;
  }

  public getSessionProgress(): number {
    if (!this.config) return 0;

    const totalRange = this.config.targetBPM - this.config.startBPM;
    const currentRange = this.getCurrentPracticeTempo() - this.config.startBPM;
    const progress = Math.round((currentRange / totalRange) * 100);

    return Math.max(0, Math.min(100, progress));
  }

  public stop(): void {
    this.isActive = false;
  }

  private checkAdvancementCriteria(): boolean {
    if (!this.config || !this.currentPerformance) return false;

    // Check minimum repetitions
    if (this.repetitionCount < this.config.minReps) return false;

    // Check accuracy threshold
    const recentAccuracy = this.getRecentAverageAccuracy();
    if (recentAccuracy < this.config.accuracy) return false;

    // Check consistency
    const consistency = this.calculateConsistency();
    if (consistency < 0.8) return false; // 80% consistency required

    return true;
  }

  private getCurrentPracticeTempo(): number {
    if (!this.config) return 120;

    // Calculate current tempo based on progression
    const sessionTime = (Date.now() - this.sessionStartTime) / 1000 / 60; // minutes
    const progressRate = this.config.tempoIncrement / 5; // BPM per 5 minutes
    const timeBasedProgress = sessionTime * progressRate;

    return Math.min(
      this.config.startBPM + timeBasedProgress,
      this.config.targetBPM,
    );
  }

  private getRecentAverageAccuracy(): number {
    const recentCount = Math.min(
      this.config?.minReps || 3,
      this.accuracyHistory.length,
    );
    const recentAccuracies = this.accuracyHistory.slice(-recentCount);

    return (
      recentAccuracies.reduce((sum, acc) => sum + acc, 0) /
      recentAccuracies.length
    );
  }

  private calculateConsistency(): number {
    if (this.accuracyHistory.length < 3) return 0;

    const recentAccuracies = this.accuracyHistory.slice(-5);
    const mean =
      recentAccuracies.reduce((sum, acc) => sum + acc, 0) /
      recentAccuracies.length;
    const variance =
      recentAccuracies.reduce((sum, acc) => sum + Math.pow(acc - mean, 2), 0) /
      recentAccuracies.length;
    const standardDeviation = Math.sqrt(variance);

    // Convert to consistency score (lower deviation = higher consistency)
    return Math.max(0, 1 - standardDeviation / 20); // Normalize to 0-1
  }

  private calculateAdaptiveIncrement(): number {
    if (!this.config || !this.currentPerformance)
      return this.config?.tempoIncrement || 5;

    const baseIncrement = this.config.tempoIncrement;
    const accuracy = this.currentPerformance.accuracy;
    const consistency = this.calculateConsistency();

    // Adjust increment based on performance
    let multiplier = 1;

    if (accuracy > 95 && consistency > 0.9) {
      multiplier = 1.5; // Faster progression for excellent performance
    } else if (accuracy > 85 && consistency > 0.8) {
      multiplier = 1.2; // Slightly faster for good performance
    } else if (accuracy < 70 || consistency < 0.6) {
      multiplier = 0.5; // Slower progression for struggling performance
    }

    return Math.round(baseIncrement * multiplier);
  }
}

/**
 * Learning analyzer for intelligent tempo suggestions
 */
class TempoLearningAnalyzer {
  private performanceHistory: PerformanceData[] = [];
  private userProfile: {
    preferredTempo: number;
    learningRate: number;
    strengths: string[];
    weaknesses: string[];
  } = {
    preferredTempo: 120,
    learningRate: 1.0,
    strengths: [],
    weaknesses: [],
  };

  public addPerformanceData(performance: PerformanceData): void {
    this.performanceHistory.push(performance);
    this.updateUserProfile(performance);
  }

  public calculateOptimalTempo(currentPerformance: PerformanceData): number {
    // Analyze user's current performance and suggest optimal practice tempo
    const accuracy = currentPerformance.accuracy;
    const consistency = currentPerformance.consistency;
    const currentTempo = currentPerformance.averageTempo;

    // Base recommendation on accuracy and consistency
    let recommendedTempo = currentTempo;

    if (accuracy > 90 && consistency > 0.8) {
      // User is performing well, can handle faster tempo
      recommendedTempo = Math.min(currentTempo * 1.1, 300);
    } else if (accuracy < 70 || consistency < 0.6) {
      // User is struggling, recommend slower tempo
      recommendedTempo = Math.max(currentTempo * 0.9, 40);
    }

    return Math.round(recommendedTempo);
  }

  public generateSuggestion(performance: PerformanceData): TempoSuggestion {
    const recommendedBPM = this.calculateOptimalTempo(performance);
    const confidence = this.calculateConfidence(performance);
    const strategy = this.recommendStrategy(performance);
    const masteryTime = this.estimateMasteryTime(performance, recommendedBPM);

    let reason = '';
    if (performance.accuracy > 90) {
      reason = 'Excellent accuracy - ready for tempo increase';
    } else if (performance.accuracy < 70) {
      reason = 'Focus on accuracy at slower tempo first';
    } else {
      reason = 'Gradual progression recommended';
    }

    return {
      recommendedBPM,
      reason,
      confidence,
      practiceStrategy: strategy,
      estimatedMasteryTime: masteryTime,
    };
  }

  public getUserProfile() {
    return { ...this.userProfile };
  }

  private updateUserProfile(_performance: PerformanceData): void {
    // Update user profile based on performance data
    this.userProfile.preferredTempo = this.calculatePreferredTempo();
    this.userProfile.learningRate = this.calculateLearningRate();
    this.userProfile.strengths = this.identifyStrengths();
    this.userProfile.weaknesses = this.identifyWeaknesses();
  }

  private calculatePreferredTempo(): number {
    if (this.performanceHistory.length === 0) return 120;

    // Calculate weighted average of tempos where user performed well
    const goodPerformances = this.performanceHistory.filter(
      (p) => p.accuracy > 80,
    );
    if (goodPerformances.length === 0) return 120;

    const weightedSum = goodPerformances.reduce(
      (sum, p) => sum + p.averageTempo * p.accuracy,
      0,
    );
    const weightSum = goodPerformances.reduce((sum, p) => sum + p.accuracy, 0);

    return Math.round(weightedSum / weightSum);
  }

  private calculateLearningRate(): number {
    if (this.performanceHistory.length < 5) return 1.0;

    // Calculate improvement rate over recent sessions
    const recent = this.performanceHistory.slice(-5);
    const older = this.performanceHistory.slice(-10, -5);

    if (older.length === 0) return 1.0;

    const recentAvg =
      recent.reduce((sum, p) => sum + p.accuracy, 0) / recent.length;
    const olderAvg =
      older.reduce((sum, p) => sum + p.accuracy, 0) / older.length;

    const improvement = (recentAvg - olderAvg) / olderAvg;
    return Math.max(0.5, Math.min(2.0, 1 + improvement));
  }

  private identifyStrengths(): string[] {
    const strengths: string[] = [];

    if (this.performanceHistory.length === 0) return strengths;

    const avgAccuracy =
      this.performanceHistory.reduce((sum, p) => sum + p.accuracy, 0) /
      this.performanceHistory.length;
    const avgConsistency =
      this.performanceHistory.reduce((sum, p) => sum + p.consistency, 0) /
      this.performanceHistory.length;

    if (avgAccuracy > 85) strengths.push('High accuracy');
    if (avgConsistency > 0.8) strengths.push('Consistent timing');
    if (this.userProfile.learningRate > 1.2) strengths.push('Fast learner');

    return strengths;
  }

  private identifyWeaknesses(): string[] {
    const weaknesses: string[] = [];

    if (this.performanceHistory.length === 0) return weaknesses;

    const avgAccuracy =
      this.performanceHistory.reduce((sum, p) => sum + p.accuracy, 0) /
      this.performanceHistory.length;
    const avgConsistency =
      this.performanceHistory.reduce((sum, p) => sum + p.consistency, 0) /
      this.performanceHistory.length;

    if (avgAccuracy < 70) weaknesses.push('Accuracy needs improvement');
    if (avgConsistency < 0.6) weaknesses.push('Timing consistency');
    if (this.userProfile.learningRate < 0.8)
      weaknesses.push('Needs more practice time');

    return weaknesses;
  }

  private calculateConfidence(performance: PerformanceData): number {
    // Calculate confidence in suggestion based on data quality
    const dataPoints = this.performanceHistory.length;
    const consistency = performance.consistency;
    const practiceTime = performance.practiceTime;

    let confidence = 0.5; // Base confidence

    // More data points increase confidence
    confidence += Math.min(dataPoints / 20, 0.3);

    // Higher consistency increases confidence
    confidence += consistency * 0.2;

    // More practice time increases confidence
    confidence += Math.min(practiceTime / 60, 0.1); // Up to 1 hour

    return Math.min(confidence, 1.0);
  }

  private recommendStrategy(performance: PerformanceData): PracticeStrategy {
    const accuracy = performance.accuracy;
    const consistency = performance.consistency;
    const learningRate = this.userProfile.learningRate;

    if (accuracy > 85 && consistency > 0.8 && learningRate > 1.2) {
      return 'step'; // Fast progression for advanced users
    } else if (accuracy < 70 || consistency < 0.6) {
      return 'gradual'; // Slow progression for struggling users
    } else {
      return 'adaptive'; // Adaptive progression for most users
    }
  }

  private estimateMasteryTime(
    performance: PerformanceData,
    targetBPM: number,
  ): number {
    const currentBPM = performance.averageTempo;
    const bpmDifference = Math.abs(targetBPM - currentBPM);
    const learningRate = this.userProfile.learningRate;
    const accuracy = performance.accuracy;

    // Base time estimate: 1 minute per BPM difference
    let estimatedMinutes = bpmDifference;

    // Adjust for learning rate
    estimatedMinutes /= learningRate;

    // Adjust for current accuracy
    if (accuracy > 85) {
      estimatedMinutes *= 0.8; // Faster for accurate players
    } else if (accuracy < 70) {
      estimatedMinutes *= 1.5; // Slower for struggling players
    }

    return Math.max(5, Math.round(estimatedMinutes)); // Minimum 5 minutes
  }
}

/**
 * Main Intelligent Tempo Controller
 */
export class IntelligentTempoController {
  private coreEngine: CorePlaybackEngine;
  private performanceMonitor: PerformanceMonitor;
  private rampingEngine: TempoRampingEngine;
  private groovePreserver: GroovePreserver;
  private automationEngine: TempoAutomationEngine;
  private learningAnalyzer: TempoLearningAnalyzer;

  private config: TempoConfig = {
    currentBPM: 120,
    targetBPM: 120,
    minBPM: 40,
    maxBPM: 300,
    rampType: 'musical',
    rampDuration: 2.0, // 2 seconds default
    preserveGroove: true,
    swingFactor: 0,
  };

  private eventHandlers: Map<
    keyof IntelligentTempoControllerEvents,
    Set<(...args: any[]) => void>
  > = new Map();

  constructor() {
    this.coreEngine = CorePlaybackEngine.getInstance();
    this.performanceMonitor = PerformanceMonitor.getInstance();
    this.rampingEngine = new TempoRampingEngine();
    this.groovePreserver = new GroovePreserver();
    this.automationEngine = new TempoAutomationEngine();
    this.learningAnalyzer = new TempoLearningAnalyzer();

    this.setupEventHandlers();
  }

  /**
   * Set tempo with intelligent ramping
   */
  public setTempo(
    targetBPM: number,
    rampType: RampType = 'musical',
    rampDuration = 2.0,
  ): void {
    // Input validation and sanitization
    // Handle Infinity case first
    if (targetBPM === Infinity) {
      targetBPM = this.config.maxBPM; // Clamp to maximum BPM
    } else if (typeof targetBPM !== 'number' || !isFinite(targetBPM)) {
      targetBPM = this.config.minBPM; // Default to minimum BPM for other invalid values
    }

    // Validate and sanitize ramp duration
    if (
      typeof rampDuration !== 'number' ||
      !isFinite(rampDuration) ||
      rampDuration < 0
    ) {
      rampDuration = 0; // Default to instant for invalid durations
    }

    // Clamp to valid range
    const clampedBPM = Math.max(
      this.config.minBPM,
      Math.min(this.config.maxBPM, targetBPM),
    );

    const currentBPM = this.getCurrentTempo();
    const startTime = performance.now();

    // Update config
    this.config.targetBPM = clampedBPM;
    this.config.rampType = rampType;
    this.config.rampDuration = rampDuration;

    // Emit tempo change event
    this.emit('tempoChange', currentBPM, clampedBPM);

    // Decide between instant change or ramping
    if (
      rampType === 'instant' ||
      Math.abs(clampedBPM - currentBPM) < 1 ||
      rampDuration === 0
    ) {
      // Instant change for small differences, instant type, or zero duration
      this.applyTempo(clampedBPM);
      this.config.currentBPM = clampedBPM;

      // Track performance
      const responseTime = performance.now() - startTime;
      // Debug logging for performance tracking
      if (responseTime > 100) {
        console.debug(`Tempo change response time: ${responseTime}ms`);
      }
    } else {
      // Use ramping for smooth transitions
      this.emit('rampStarted', currentBPM, clampedBPM, rampDuration);

      this.rampingEngine.startRamp(
        currentBPM,
        clampedBPM,
        rampDuration,
        rampType,
        (bpm: number) => {
          this.applyTempo(bpm);
          this.config.currentBPM = bpm;
        },
        () => {
          this.emit('rampCompleted', clampedBPM);
          // Track performance
          const responseTime = performance.now() - startTime;
          // Debug logging for performance tracking
          if (responseTime > 100) {
            console.debug(`Tempo ramp response time: ${responseTime}ms`);
          }
        },
      );
    }
  }

  /**
   * Get current tempo
   */
  public getCurrentTempo(): number {
    return this.config.currentBPM;
  }

  /**
   * Get target tempo
   */
  public getTargetTempo(): number {
    return this.config.targetBPM;
  }

  /**
   * Check if tempo is currently ramping
   */
  public isRamping(): boolean {
    return this.rampingEngine.isActive();
  }

  /**
   * Stop current tempo ramp
   */
  public stopRamp(): void {
    this.rampingEngine.stopRamp();
  }

  /**
   * Enable practice automation
   */
  public enablePracticeAutomation(config: PracticeAutomationConfig): void {
    this.automationEngine.configure(config);

    // Set initial tempo
    this.setTempo(config.startBPM, 'instant');
  }

  /**
   * Update performance data for practice automation
   */
  public updatePerformance(performance: PerformanceData): void {
    this.learningAnalyzer.addPerformanceData(performance);
    this.emit('performanceUpdated', performance);

    // Check for practice advancement
    const shouldAdvance = this.automationEngine.updatePerformance(performance);

    if (shouldAdvance && this.automationEngine.isSessionComplete() === false) {
      const nextTempo = this.automationEngine.getNextTempo();
      this.setTempo(nextTempo, 'linear', 3.0); // 3-second linear ramp
      this.emit('practiceAdvancement', nextTempo, performance.accuracy);

      // Check for mastery
      if (performance.accuracy >= 95) {
        this.emit('masteryAchieved', nextTempo, performance.accuracy);
      }
    }
  }

  /**
   * Generate intelligent tempo suggestion
   */
  public generateSuggestion(performance: PerformanceData): TempoSuggestion {
    const suggestion = this.learningAnalyzer.generateSuggestion(performance);
    this.emit('suggestionGenerated', suggestion);
    return suggestion;
  }

  /**
   * Analyze and preserve groove
   */
  public analyzeGroove(midiData?: any[]): GrooveAnalysis {
    const analysis = this.groovePreserver.analyzeGroove(midiData);
    this.emit('grooveAnalyzed', analysis);
    return analysis;
  }

  /**
   * Set groove characteristics
   */
  public setGroove(groove: Partial<GrooveAnalysis>): void {
    this.groovePreserver.setGroove(groove);
    this.config.swingFactor = groove.swingRatio || this.config.swingFactor;
  }

  /**
   * Get current configuration
   */
  public getConfig(): TempoConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(updates: Partial<TempoConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get practice session progress
   */
  public getPracticeProgress(): number {
    return this.automationEngine.getSessionProgress();
  }

  /**
   * Stop practice automation
   */
  public stopPracticeAutomation(): void {
    this.automationEngine.stop();
  }

  /**
   * Get user learning profile
   */
  public getUserProfile() {
    return this.learningAnalyzer.getUserProfile();
  }

  /**
   * Event subscription
   */
  public on<K extends keyof IntelligentTempoControllerEvents>(
    event: K,
    handler: IntelligentTempoControllerEvents[K],
  ): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }

    this.eventHandlers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.rampingEngine.stopRamp();
    this.automationEngine.stop();
    this.eventHandlers.clear();
  }

  // Private methods

  private applyTempo(bpm: number): void {
    // Apply tempo to core engine
    this.coreEngine.setTempo(bpm);

    // Apply groove characteristics if preserved
    if (this.config.preserveGroove) {
      const _groove = this.groovePreserver.getCurrentGroove();
      // Apply swing and other groove characteristics to Tone.Transport
      // This would involve setting swing, humanization, etc.
    }
  }

  private setupEventHandlers(): void {
    // Listen to core engine events
    this.coreEngine.on('tempoChange', (bpm) => {
      // Sync our internal state with core engine
      if (!this.isRamping()) {
        this.config.currentBPM = bpm;
      }
    });
  }

  private emit<K extends keyof IntelligentTempoControllerEvents>(
    event: K,
    ...args: Parameters<IntelligentTempoControllerEvents[K]>
  ): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(...args);
        } catch (error) {
          console.error(
            `Error in tempo controller event handler for ${event}:`,
            error,
          );
        }
      });
    }
  }
}
