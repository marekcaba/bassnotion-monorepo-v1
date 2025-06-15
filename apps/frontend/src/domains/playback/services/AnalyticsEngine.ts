/**
 * AnalyticsEngine - Comprehensive Analytics & Learning Intelligence System
 *
 * Task 6: Analytics & Learning Intelligence (Story 2.3)
 *
 * Provides comprehensive practice analytics, behavior pattern recognition,
 * intelligent suggestions, adaptive automation, and performance tracking
 * for enhanced learning experience.
 *
 * Features:
 * - Practice session tracking and analysis
 * - Behavior pattern recognition and learning style detection
 * - Intelligent suggestions for tempo progression and transposition practice
 * - Adaptive automation based on user learning patterns
 * - Performance improvement tracking and milestone recognition
 * - Real-time analytics and insights generation
 *
 * Integration:
 * - ProfessionalPlaybackController (playback patterns)
 * - IntelligentTempoController (tempo preferences and progression)
 * - TranspositionController (key/transposition patterns)
 * - PrecisionSynchronizationEngine (timing accuracy)
 * - ComprehensiveStateManager (existing behavior data)
 *
 * @author Claude Sonnet 4
 * @version 1.0.0
 */

import { EventEmitter } from 'events';

// Core Interfaces
export interface PracticeSession {
  id: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  controlInteractions: ControlInteraction[];
  qualityMetrics: SessionQualityMetrics;
  achievements: Achievement[];
  context: PracticeContext;
}

export interface ControlInteraction {
  id: string;
  timestamp: number;
  controllerType:
    | 'playback'
    | 'tempo'
    | 'transposition'
    | 'synchronization'
    | 'state';
  action: string;
  parameters: Record<string, any>;
  context: InteractionContext;
  performance: InteractionPerformance;
}

export interface SessionQualityMetrics {
  accuracy: number; // 0-100%
  consistency: number; // 0-100%
  engagement: number; // 0-100%
  completionRate: number; // 0-100%
  errorRate: number; // 0-100%
  focusScore: number; // 0-100%
}

export interface BehaviorPattern {
  id: string;
  type:
    | 'tempo_progression'
    | 'transposition_preference'
    | 'practice_routine'
    | 'learning_style'
    | 'session_timing';
  confidence: number; // 0-100%
  frequency: number;
  lastDetected: number;
  characteristics: Record<string, any>;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface PracticeSuggestion {
  id: string;
  type:
    | 'tempo_progression'
    | 'transposition_practice'
    | 'session_structure'
    | 'automation_config';
  priority: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-100%
  title: string;
  description: string;
  actionable: boolean;
  parameters: Record<string, any>;
  expectedBenefit: string;
  estimatedImpact: number; // 0-100%
}

export interface ProgressMetrics {
  overallProgress: number; // 0-100%
  skillAreas: SkillAreaProgress[];
  learningVelocity: number;
  consistencyScore: number;
  improvementTrend: 'accelerating' | 'steady' | 'plateauing' | 'declining';
  timeToNextMilestone: number; // estimated days
  strengths: string[];
  areasForImprovement: string[];
}

export interface SkillAreaProgress {
  area:
    | 'tempo_control'
    | 'transposition'
    | 'timing_accuracy'
    | 'consistency'
    | 'technique';
  currentLevel: number; // 0-100%
  previousLevel: number;
  improvement: number;
  trend: 'improving' | 'stable' | 'declining';
  practiceTime: number; // minutes
  lastPracticed: number;
}

export interface Achievement {
  id: string;
  type: 'milestone' | 'streak' | 'mastery' | 'improvement' | 'consistency';
  title: string;
  description: string;
  earnedAt: number;
  value: number;
  category: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

export interface PracticeInsights {
  patterns: BehaviorPattern[];
  suggestions: PracticeSuggestion[];
  progress: ProgressMetrics;
  achievements: Achievement[];
  sessionSummary: SessionSummary;
  trends: AnalyticsTrend[];
}

export interface SessionSummary {
  totalSessions: number;
  totalPracticeTime: number; // minutes
  averageSessionLength: number; // minutes
  streakDays: number;
  lastSessionDate: number;
  favoriteTimeOfDay: string;
  mostUsedControls: string[];
  improvementHighlights: string[];
}

export interface AnalyticsTrend {
  metric: string;
  direction: 'up' | 'down' | 'stable';
  magnitude: number; // percentage change
  timeframe: string;
  significance: 'low' | 'medium' | 'high';
}

export interface AutomationConfig {
  tempoProgression: TempoAutomationConfig;
  transpositionSequence: TranspositionAutomationConfig;
  sessionStructure: SessionAutomationConfig;
  adaptiveSettings: AdaptiveSettingsConfig;
}

export interface TempoAutomationConfig {
  startBPM: number;
  targetBPM: number;
  progressionType: 'gradual' | 'step' | 'adaptive';
  incrementSize: number;
  masteryThreshold: number;
  adaptToPerformance: boolean;
}

export interface TranspositionAutomationConfig {
  keySequence: string[];
  progressionStrategy: 'circle_of_fifths' | 'chromatic' | 'modal' | 'adaptive';
  difficultyProgression: boolean;
  focusAreas: string[];
}

export interface SessionAutomationConfig {
  warmupDuration: number; // minutes
  focusAreas: string[];
  cooldownDuration: number; // minutes
  breakIntervals: number[]; // minutes
  adaptiveLength: boolean;
}

export interface AdaptiveSettingsConfig {
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'mixed';
  preferredPace: 'slow' | 'moderate' | 'fast' | 'adaptive';
  challengeLevel: 'conservative' | 'moderate' | 'aggressive';
  feedbackFrequency: 'minimal' | 'moderate' | 'frequent';
}

// Supporting Interfaces
export interface PracticeContext {
  sessionType: 'practice' | 'lesson' | 'performance' | 'exploration';
  focusArea: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  goals: string[];
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  environment: 'quiet' | 'moderate' | 'noisy';
}

export interface InteractionContext {
  sessionPhase: 'warmup' | 'main' | 'cooldown';
  previousAction: string;
  timeInSession: number; // seconds
  userIntent: string;
  difficulty: number; // 0-100%
}

export interface InteractionPerformance {
  responseTime: number; // ms
  accuracy: number; // 0-100%
  confidence: number; // 0-100%
  errorCount: number;
  successRate: number; // 0-100%
}

/**
 * PracticeSessionTracker - Tracks and analyzes practice sessions
 */
export class PracticeSessionTracker extends EventEmitter {
  private currentSession: PracticeSession | null = null;
  private sessionHistory: PracticeSession[] = [];
  private readonly maxHistorySize = 1000;

  constructor() {
    super();
  }

  public startSession(context: PracticeContext): PracticeSession {
    if (this.currentSession) {
      this.endSession();
    }

    this.currentSession = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startTime: Date.now(),
      controlInteractions: [],
      qualityMetrics: {
        accuracy: 0,
        consistency: 0,
        engagement: 0,
        completionRate: 0,
        errorRate: 0,
        focusScore: 0,
      },
      achievements: [],
      context,
    };

    this.emit('sessionStarted', this.currentSession);
    return this.currentSession;
  }

  public endSession(): PracticeSession | null {
    if (!this.currentSession) {
      return null;
    }

    this.currentSession.endTime = Date.now();
    this.currentSession.duration =
      this.currentSession.endTime - this.currentSession.startTime;

    // Calculate final quality metrics
    this.currentSession.qualityMetrics = this.calculateSessionQuality(
      this.currentSession,
    );

    // Add to history
    this.sessionHistory.push(this.currentSession);

    // Maintain history size limit
    if (this.sessionHistory.length > this.maxHistorySize) {
      this.sessionHistory.shift();
    }

    const completedSession = this.currentSession;
    this.currentSession = null;

    this.emit('sessionEnded', completedSession);
    return completedSession;
  }

  public recordInteraction(interaction: ControlInteraction): void {
    if (!this.currentSession) {
      return;
    }

    this.currentSession.controlInteractions.push(interaction);
    this.emit('interactionRecorded', interaction);
  }

  public getCurrentSession(): PracticeSession | null {
    return this.currentSession;
  }

  public getSessionHistory(limit?: number): PracticeSession[] {
    const sessions = [...this.sessionHistory].reverse();
    return limit ? sessions.slice(0, limit) : sessions;
  }

  public getSessionStats(): SessionSummary {
    const sessions = this.sessionHistory;
    const totalSessions = sessions.length;

    if (totalSessions === 0) {
      return {
        totalSessions: 0,
        totalPracticeTime: 0,
        averageSessionLength: 0,
        streakDays: 0,
        lastSessionDate: 0,
        favoriteTimeOfDay: 'evening',
        mostUsedControls: [],
        improvementHighlights: [],
      };
    }

    const totalPracticeTime =
      sessions.reduce((sum, session) => sum + (session.duration || 0), 0) /
      (1000 * 60); // minutes
    const averageSessionLength = totalPracticeTime / totalSessions;
    const lastSessionDate = Math.max(...sessions.map((s) => s.startTime));

    // Calculate streak
    const streakDays = this.calculateStreakDays(sessions);

    // Find favorite time of day
    const timeOfDayCount = sessions.reduce(
      (acc, session) => {
        const timeOfDay = session.context.timeOfDay;
        acc[timeOfDay] = (acc[timeOfDay] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const favoriteTimeOfDay =
      Object.entries(timeOfDayCount).sort(([, a], [, b]) => b - a)[0]?.[0] ||
      'evening';

    // Find most used controls
    const controlUsage = sessions
      .flatMap((s) => s.controlInteractions)
      .reduce(
        (acc, interaction) => {
          const key = `${interaction.controllerType}_${interaction.action}`;
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

    const mostUsedControls = Object.entries(controlUsage)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([control]) => control);

    return {
      totalSessions,
      totalPracticeTime,
      averageSessionLength,
      streakDays,
      lastSessionDate,
      favoriteTimeOfDay,
      mostUsedControls,
      improvementHighlights: this.generateImprovementHighlights(sessions),
    };
  }

  private calculateSessionQuality(
    session: PracticeSession,
  ): SessionQualityMetrics {
    const interactions = session.controlInteractions;

    if (interactions.length === 0) {
      return {
        accuracy: 0,
        consistency: 0,
        engagement: 0,
        completionRate: 0,
        errorRate: 0,
        focusScore: 0,
      };
    }

    // Calculate accuracy (average of all interaction accuracies)
    const accuracy =
      interactions.reduce((sum, i) => sum + i.performance.accuracy, 0) /
      interactions.length;

    // Calculate consistency (inverse of standard deviation of response times)
    const responseTimes = interactions.map((i) => i.performance.responseTime);
    const avgResponseTime =
      responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length;
    const variance =
      responseTimes.reduce(
        (sum, rt) => sum + Math.pow(rt - avgResponseTime, 2),
        0,
      ) / responseTimes.length;
    const consistency = Math.max(
      0,
      100 - (Math.sqrt(variance) / avgResponseTime) * 100,
    );

    // Calculate engagement (interactions per minute)
    const sessionDurationMinutes = (session.duration || 0) / (1000 * 60);
    const interactionsPerMinute =
      sessionDurationMinutes > 0
        ? interactions.length / sessionDurationMinutes
        : 0;
    const engagement = Math.min(100, interactionsPerMinute * 10); // Scale to 0-100

    // Calculate completion rate (successful interactions / total interactions)
    const successfulInteractions = interactions.filter(
      (i) => i.performance.successRate > 70,
    ).length;
    const completionRate = (successfulInteractions / interactions.length) * 100;

    // Calculate error rate
    const totalErrors = interactions.reduce(
      (sum, i) => sum + i.performance.errorCount,
      0,
    );
    const errorRate = (totalErrors / interactions.length) * 10; // Scale to percentage

    // Calculate focus score (based on consistency and engagement)
    const focusScore = consistency * 0.6 + engagement * 0.4;

    return {
      accuracy: Math.round(accuracy),
      consistency: Math.round(consistency),
      engagement: Math.round(engagement),
      completionRate: Math.round(completionRate),
      errorRate: Math.round(Math.min(100, errorRate)),
      focusScore: Math.round(focusScore),
    };
  }

  private calculateStreakDays(sessions: PracticeSession[]): number {
    if (sessions.length === 0) return 0;

    const sortedSessions = sessions.sort((a, b) => b.startTime - a.startTime);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let streak = 0;
    const currentDate = new Date(today);

    for (const session of sortedSessions) {
      const sessionDate = new Date(session.startTime);
      sessionDate.setHours(0, 0, 0, 0);

      if (sessionDate.getTime() === currentDate.getTime()) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else if (sessionDate.getTime() < currentDate.getTime()) {
        break;
      }
    }

    return streak;
  }

  private generateImprovementHighlights(sessions: PracticeSession[]): string[] {
    const highlights: string[] = [];

    if (sessions.length < 2) return highlights;

    const recent = sessions.slice(-5);
    const older = sessions.slice(-10, -5);

    if (recent.length === 0 || older.length === 0) return highlights;

    // Compare recent vs older sessions
    const recentAvgAccuracy =
      recent.reduce((sum, s) => sum + s.qualityMetrics.accuracy, 0) /
      recent.length;
    const olderAvgAccuracy =
      older.reduce((sum, s) => sum + s.qualityMetrics.accuracy, 0) /
      older.length;

    if (recentAvgAccuracy > olderAvgAccuracy + 5) {
      highlights.push(
        `Accuracy improved by ${Math.round(recentAvgAccuracy - olderAvgAccuracy)}%`,
      );
    }

    const recentAvgConsistency =
      recent.reduce((sum, s) => sum + s.qualityMetrics.consistency, 0) /
      recent.length;
    const olderAvgConsistency =
      older.reduce((sum, s) => sum + s.qualityMetrics.consistency, 0) /
      older.length;

    if (recentAvgConsistency > olderAvgConsistency + 5) {
      highlights.push(
        `Consistency improved by ${Math.round(recentAvgConsistency - olderAvgConsistency)}%`,
      );
    }

    return highlights;
  }

  public dispose(): void {
    if (this.currentSession) {
      this.endSession();
    }
    this.removeAllListeners();
    this.sessionHistory.length = 0;
  }
}

/**
 * BehaviorPatternRecognizer - Analyzes user behavior patterns and learning styles
 */
export class BehaviorPatternRecognizer extends EventEmitter {
  private patterns: Map<string, BehaviorPattern> = new Map();
  private interactionHistory: ControlInteraction[] = [];
  private readonly maxHistorySize = 5000;

  constructor() {
    super();
  }

  public analyzeInteraction(interaction: ControlInteraction): void {
    this.interactionHistory.push(interaction);

    // Maintain history size limit
    if (this.interactionHistory.length > this.maxHistorySize) {
      this.interactionHistory.shift();
    }

    // Analyze patterns
    this.detectTempoProgressionPattern();
    this.detectTranspositionPreferencePattern();
    this.detectPracticeRoutinePattern();
    this.detectLearningStylePattern();
    this.detectSessionTimingPattern();
  }

  public getPatterns(): BehaviorPattern[] {
    return Array.from(this.patterns.values());
  }

  public getPattern(type: string): BehaviorPattern | undefined {
    return this.patterns.get(type);
  }

  public extractUserPreferences(): Record<string, any> {
    const patterns = this.getPatterns();
    const preferences: Record<string, any> = {};

    patterns.forEach((pattern) => {
      if (pattern.confidence > 70) {
        preferences[pattern.type] = pattern.characteristics;
      }
    });

    return preferences;
  }

  private detectTempoProgressionPattern(): void {
    const tempoInteractions = this.interactionHistory
      .filter((i) => i.controllerType === 'tempo' && i.action === 'setTempo')
      .slice(-50); // Last 50 tempo changes

    if (tempoInteractions.length < 10) return;

    // Analyze tempo progression preferences
    const tempoChanges = [];
    for (let i = 1; i < tempoInteractions.length; i++) {
      const prev = tempoInteractions[i - 1];
      const curr = tempoInteractions[i];
      if (prev && curr) {
        const change = curr.parameters.targetBPM - prev.parameters.targetBPM;
        const timeDiff = curr.timestamp - prev.timestamp;

        tempoChanges.push({ change, timeDiff });
      }
    }

    // Detect patterns
    const avgChange =
      tempoChanges.reduce((sum, c) => sum + Math.abs(c.change), 0) /
      tempoChanges.length;
    const avgTimeDiff =
      tempoChanges.reduce((sum, c) => sum + c.timeDiff, 0) /
      tempoChanges.length;

    const gradualChanges = tempoChanges.filter(
      (c) => Math.abs(c.change) <= 5,
    ).length;
    const stepChanges = tempoChanges.filter(
      (c) => Math.abs(c.change) > 5 && Math.abs(c.change) <= 15,
    ).length;
    const largeChanges = tempoChanges.filter(
      (c) => Math.abs(c.change) > 15,
    ).length;

    let preferredStyle = 'gradual';
    if (stepChanges > gradualChanges && stepChanges > largeChanges) {
      preferredStyle = 'step';
    } else if (largeChanges > gradualChanges && largeChanges > stepChanges) {
      preferredStyle = 'large';
    }

    const pattern: BehaviorPattern = {
      id: 'tempo_progression',
      type: 'tempo_progression',
      confidence: Math.min(100, (tempoInteractions.length / 50) * 100),
      frequency: tempoInteractions.length,
      lastDetected: Date.now(),
      characteristics: {
        preferredStyle,
        averageChange: avgChange,
        averageTimeBetweenChanges: avgTimeDiff,
        gradualChangeRatio: gradualChanges / tempoChanges.length,
        stepChangeRatio: stepChanges / tempoChanges.length,
        largeChangeRatio: largeChanges / tempoChanges.length,
      },
      trend: this.calculateTrend('tempo_progression', tempoInteractions.length),
    };

    this.patterns.set('tempo_progression', pattern);
    this.emit('patternDetected', pattern);
  }

  private detectTranspositionPreferencePattern(): void {
    const transpositionInteractions = this.interactionHistory
      .filter(
        (i) => i.controllerType === 'transposition' && i.action === 'transpose',
      )
      .slice(-30);

    if (transpositionInteractions.length < 5) return;

    // Analyze transposition preferences
    const semitoneChanges = transpositionInteractions.map(
      (i) => i.parameters.semitones,
    );
    const keyPreferences = transpositionInteractions.map(
      (i) => i.parameters.targetKey || 'unknown',
    );

    // Calculate preferred semitone ranges
    const smallChanges = semitoneChanges.filter((s) => Math.abs(s) <= 2).length;
    const mediumChanges = semitoneChanges.filter(
      (s) => Math.abs(s) > 2 && Math.abs(s) <= 7,
    ).length;
    const largeChanges = semitoneChanges.filter((s) => Math.abs(s) > 7).length;

    // Find most common keys
    const keyCount = keyPreferences.reduce(
      (acc, key) => {
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const favoriteKeys = Object.entries(keyCount)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 3)
      .map(([key]) => key);

    const pattern: BehaviorPattern = {
      id: 'transposition_preference',
      type: 'transposition_preference',
      confidence: Math.min(100, (transpositionInteractions.length / 30) * 100),
      frequency: transpositionInteractions.length,
      lastDetected: Date.now(),
      characteristics: {
        preferredRange:
          smallChanges > mediumChanges
            ? 'small'
            : mediumChanges > largeChanges
              ? 'medium'
              : 'large',
        smallChangeRatio: smallChanges / semitoneChanges.length,
        mediumChangeRatio: mediumChanges / semitoneChanges.length,
        largeChangeRatio: largeChanges / semitoneChanges.length,
        favoriteKeys,
        averageSemitoneChange:
          semitoneChanges.reduce((sum, s) => sum + Math.abs(s), 0) /
          semitoneChanges.length,
      },
      trend: this.calculateTrend(
        'transposition_preference',
        transpositionInteractions.length,
      ),
    };

    this.patterns.set('transposition_preference', pattern);
    this.emit('patternDetected', pattern);
  }

  private detectPracticeRoutinePattern(): void {
    const allInteractions = this.interactionHistory.slice(-200);

    if (allInteractions.length < 50) return;

    // Group interactions by session (assuming 30-minute gaps indicate new sessions)
    const sessions: ControlInteraction[][] = [];
    let currentSession: ControlInteraction[] = [];

    for (let i = 0; i < allInteractions.length; i++) {
      const interaction = allInteractions[i];
      if (!interaction) continue;

      if (currentSession.length === 0) {
        currentSession.push(interaction);
      } else {
        const lastInteraction = currentSession[currentSession.length - 1];
        if (!lastInteraction) continue;

        const timeDiff = interaction.timestamp - lastInteraction.timestamp;

        if (timeDiff > 30 * 60 * 1000) {
          // 30 minutes
          sessions.push([...currentSession]);
          currentSession = [interaction];
        } else {
          currentSession.push(interaction);
        }
      }
    }

    if (currentSession.length > 0) {
      sessions.push(currentSession);
    }

    if (sessions.length < 3) return;

    // Analyze routine patterns
    const sessionStartPatterns = sessions.map((session) => {
      const first5 = session.slice(0, 5);
      return first5.map((i) => `${i.controllerType}_${i.action}`).join('->');
    });

    // Find common starting patterns
    const patternCount = sessionStartPatterns.reduce(
      (acc, pattern) => {
        acc[pattern] = (acc[pattern] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const commonPatterns = Object.entries(patternCount)
      .filter(([, count]) => count >= 2)
      .sort(([, a], [, b]) => (b as number) - (a as number));

    const pattern: BehaviorPattern = {
      id: 'practice_routine',
      type: 'practice_routine',
      confidence: Math.min(100, (sessions.length / 10) * 100),
      frequency: sessions.length,
      lastDetected: Date.now(),
      characteristics: {
        averageSessionLength:
          sessions.reduce((sum, s) => sum + s.length, 0) / sessions.length,
        commonStartingPatterns: commonPatterns
          .slice(0, 3)
          .map(([pattern]) => pattern),
        routineConsistency:
          commonPatterns.length > 0
            ? ((commonPatterns[0]?.[1] || 0) / sessions.length) * 100
            : 0,
        preferredControllers: this.getMostUsedControllers(allInteractions),
      },
      trend: this.calculateTrend('practice_routine', sessions.length),
    };

    this.patterns.set('practice_routine', pattern);
    this.emit('patternDetected', pattern);
  }

  private detectLearningStylePattern(): void {
    const recentInteractions = this.interactionHistory.slice(-100);

    if (recentInteractions.length < 20) return;

    // Analyze learning style indicators
    const visualIndicators = recentInteractions.filter(
      (i) =>
        i.parameters.visualFeedback ||
        i.action.includes('visual') ||
        i.controllerType === 'synchronization',
    ).length;

    const auditoryIndicators = recentInteractions.filter(
      (i) =>
        i.parameters.audioFeedback ||
        i.action.includes('audio') ||
        i.controllerType === 'tempo',
    ).length;

    const kinestheticIndicators = recentInteractions.filter(
      (i) =>
        i.parameters.hapticFeedback ||
        i.action.includes('gesture') ||
        i.controllerType === 'playback',
    ).length;

    const total = visualIndicators + auditoryIndicators + kinestheticIndicators;

    if (total === 0) return;

    let dominantStyle = 'mixed';
    const visualRatio = visualIndicators / total;
    const auditoryRatio = auditoryIndicators / total;
    const kinestheticRatio = kinestheticIndicators / total;

    if (visualRatio > 0.5) dominantStyle = 'visual';
    else if (auditoryRatio > 0.5) dominantStyle = 'auditory';
    else if (kinestheticRatio > 0.5) dominantStyle = 'kinesthetic';

    const pattern: BehaviorPattern = {
      id: 'learning_style',
      type: 'learning_style',
      confidence: Math.min(100, (recentInteractions.length / 100) * 100),
      frequency: recentInteractions.length,
      lastDetected: Date.now(),
      characteristics: {
        dominantStyle,
        visualRatio,
        auditoryRatio,
        kinestheticRatio,
        preferredFeedbackTypes:
          this.getPreferredFeedbackTypes(recentInteractions),
      },
      trend: this.calculateTrend('learning_style', recentInteractions.length),
    };

    this.patterns.set('learning_style', pattern);
    this.emit('patternDetected', pattern);
  }

  private detectSessionTimingPattern(): void {
    const sessionStarts = this.interactionHistory
      .filter((i) => i.context.sessionPhase === 'warmup')
      .slice(-20);

    if (sessionStarts.length < 5) return;

    // Analyze session timing patterns
    const hours = sessionStarts.map((i) => new Date(i.timestamp).getHours());
    const daysOfWeek = sessionStarts.map((i) => new Date(i.timestamp).getDay());

    // Find preferred hours
    const hourCount = hours.reduce(
      (acc, hour) => {
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>,
    );

    const preferredHours = Object.entries(hourCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));

    // Find preferred days
    const dayCount = daysOfWeek.reduce(
      (acc, day) => {
        acc[day] = (acc[day] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>,
    );

    const preferredDays = Object.entries(dayCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([day]) => parseInt(day));

    const pattern: BehaviorPattern = {
      id: 'session_timing',
      type: 'session_timing',
      confidence: Math.min(100, (sessionStarts.length / 20) * 100),
      frequency: sessionStarts.length,
      lastDetected: Date.now(),
      characteristics: {
        preferredHours,
        preferredDays,
        mostCommonHour: preferredHours[0],
        mostCommonDay: preferredDays[0],
        consistencyScore: this.calculateTimingConsistency(hours, daysOfWeek),
      },
      trend: this.calculateTrend('session_timing', sessionStarts.length),
    };

    this.patterns.set('session_timing', pattern);
    this.emit('patternDetected', pattern);
  }

  private calculateTrend(
    patternType: string,
    currentFrequency: number,
  ): 'increasing' | 'decreasing' | 'stable' {
    const existingPattern = this.patterns.get(patternType);

    if (!existingPattern) {
      return 'stable';
    }

    const previousFrequency = existingPattern.frequency;
    const change = currentFrequency - previousFrequency;

    if (change > 2) return 'increasing';
    if (change < -2) return 'decreasing';
    return 'stable';
  }

  private getMostUsedControllers(interactions: ControlInteraction[]): string[] {
    const controllerCount = interactions.reduce(
      (acc, i) => {
        acc[i.controllerType] = (acc[i.controllerType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return Object.entries(controllerCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([controller]) => controller);
  }

  private getPreferredFeedbackTypes(
    interactions: ControlInteraction[],
  ): string[] {
    const feedbackTypes: string[] = [];

    interactions.forEach((i) => {
      if (i.parameters.visualFeedback) feedbackTypes.push('visual');
      if (i.parameters.audioFeedback) feedbackTypes.push('audio');
      if (i.parameters.hapticFeedback) feedbackTypes.push('haptic');
    });

    const typeCount = feedbackTypes.reduce(
      (acc, type) => {
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return Object.entries(typeCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([type]) => type);
  }

  private calculateTimingConsistency(hours: number[], days: number[]): number {
    // Calculate consistency based on variance in timing
    const hourVariance = this.calculateVariance(hours);
    const dayVariance = this.calculateVariance(days);

    // Lower variance = higher consistency
    const hourConsistency = Math.max(0, 100 - hourVariance * 10);
    const dayConsistency = Math.max(0, 100 - dayVariance * 20);

    return (hourConsistency + dayConsistency) / 2;
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;

    return Math.sqrt(variance);
  }

  public dispose(): void {
    this.patterns.clear();
    this.interactionHistory.length = 0;
    this.removeAllListeners();
  }
}

/**
 * IntelligentSuggestionEngine - Generates intelligent practice suggestions
 */
export class IntelligentSuggestionEngine extends EventEmitter {
  private suggestions: Map<string, PracticeSuggestion> = new Map();

  constructor() {
    super();
  }

  public generateSuggestions(
    patterns: BehaviorPattern[],
    progress: ProgressMetrics,
  ): PracticeSuggestion[] {
    const suggestions: PracticeSuggestion[] = [];

    // Generate tempo progression suggestions
    suggestions.push(...this.generateTempoSuggestions(patterns, progress));

    // Generate transposition practice suggestions
    suggestions.push(
      ...this.generateTranspositionSuggestions(patterns, progress),
    );

    // Generate session structure suggestions
    suggestions.push(
      ...this.generateSessionStructureSuggestions(patterns, progress),
    );

    // Generate automation configuration suggestions
    suggestions.push(...this.generateAutomationSuggestions(patterns, progress));

    // Sort by priority and confidence
    suggestions.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff =
        priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.confidence - a.confidence;
    });

    // Store suggestions
    suggestions.forEach((suggestion) => {
      this.suggestions.set(suggestion.id, suggestion);
    });

    this.emit('suggestionsGenerated', suggestions);
    return suggestions;
  }

  private generateTempoSuggestions(
    patterns: BehaviorPattern[],
    progress: ProgressMetrics,
  ): PracticeSuggestion[] {
    const suggestions: PracticeSuggestion[] = [];
    const tempoPattern = patterns.find((p) => p.type === 'tempo_progression');
    const tempoProgress = progress.skillAreas.find(
      (a) => a.area === 'tempo_control',
    );

    if (!tempoPattern || !tempoProgress) return suggestions;

    // Suggest tempo progression strategy based on patterns
    if (
      tempoPattern.characteristics.preferredStyle === 'large' &&
      tempoProgress.currentLevel < 70
    ) {
      suggestions.push({
        id: `tempo_suggestion_${Date.now()}`,
        type: 'tempo_progression',
        priority: 'medium',
        confidence: 85,
        title: 'Try Gradual Tempo Increases',
        description:
          'Your current large tempo jumps might be hindering progress. Try smaller, more gradual increases for better muscle memory development.',
        actionable: true,
        parameters: {
          recommendedStyle: 'gradual',
          maxIncrement: 5,
          masteryThreshold: 85,
        },
        expectedBenefit: 'Improved tempo control accuracy and consistency',
        estimatedImpact: 75,
      });
    }

    // Suggest optimal BPM range based on performance
    if (tempoProgress.currentLevel > 80 && tempoProgress.trend === 'stable') {
      suggestions.push({
        id: `tempo_challenge_${Date.now()}`,
        type: 'tempo_progression',
        priority: 'low',
        confidence: 70,
        title: 'Challenge Yourself with Higher Tempos',
        description:
          "You've mastered your current tempo range. Try pushing to higher BPMs to continue improving.",
        actionable: true,
        parameters: {
          suggestedBPMIncrease: 10,
          challengeLevel: 'moderate',
        },
        expectedBenefit: 'Expanded tempo range and improved technical ability',
        estimatedImpact: 60,
      });
    }

    return suggestions;
  }

  private generateTranspositionSuggestions(
    patterns: BehaviorPattern[],
    progress: ProgressMetrics,
  ): PracticeSuggestion[] {
    const suggestions: PracticeSuggestion[] = [];
    const transpositionPattern = patterns.find(
      (p) => p.type === 'transposition_preference',
    );
    const transpositionProgress = progress.skillAreas.find(
      (a) => a.area === 'transposition',
    );

    if (!transpositionPattern || !transpositionProgress) return suggestions;

    // Suggest key exploration based on preferences
    if (transpositionPattern.characteristics.favoriteKeys.length <= 2) {
      suggestions.push({
        id: `transposition_exploration_${Date.now()}`,
        type: 'transposition_practice',
        priority: 'medium',
        confidence: 80,
        title: 'Explore More Key Signatures',
        description:
          'You tend to practice in the same keys. Exploring different key signatures will improve your overall musicianship.',
        actionable: true,
        parameters: {
          suggestedKeys: ['D', 'A', 'E', 'B', 'F#'],
          practiceStrategy: 'circle_of_fifths',
        },
        expectedBenefit:
          'Better key signature recognition and fretboard knowledge',
        estimatedImpact: 70,
      });
    }

    // Suggest interval training based on semitone preferences
    if (
      transpositionPattern.characteristics.preferredRange === 'small' &&
      transpositionProgress.currentLevel > 60
    ) {
      suggestions.push({
        id: `interval_training_${Date.now()}`,
        type: 'transposition_practice',
        priority: 'low',
        confidence: 75,
        title: 'Practice Larger Interval Transpositions',
        description:
          "You're comfortable with small transpositions. Try larger intervals to challenge your ear and expand your range.",
        actionable: true,
        parameters: {
          suggestedIntervals: [5, 7, 10, 12],
          progressionType: 'gradual',
        },
        expectedBenefit:
          'Improved interval recognition and transposition flexibility',
        estimatedImpact: 65,
      });
    }

    return suggestions;
  }

  private generateSessionStructureSuggestions(
    patterns: BehaviorPattern[],
    _progress: ProgressMetrics,
  ): PracticeSuggestion[] {
    const suggestions: PracticeSuggestion[] = [];
    const routinePattern = patterns.find((p) => p.type === 'practice_routine');
    const timingPattern = patterns.find((p) => p.type === 'session_timing');

    if (!routinePattern) return suggestions;

    // Suggest routine optimization
    if (routinePattern.characteristics.routineConsistency < 50) {
      suggestions.push({
        id: `routine_consistency_${Date.now()}`,
        type: 'session_structure',
        priority: 'high',
        confidence: 90,
        title: 'Establish a Consistent Practice Routine',
        description:
          'Your practice sessions vary significantly. A consistent routine will improve your learning efficiency.',
        actionable: true,
        parameters: {
          suggestedStructure: ['warmup', 'technique', 'repertoire', 'cooldown'],
          timeAllocation: [10, 30, 40, 10], // percentages
        },
        expectedBenefit:
          'More efficient practice sessions and faster skill development',
        estimatedImpact: 85,
      });
    }

    // Suggest optimal session timing
    if (timingPattern && timingPattern.characteristics.consistencyScore < 60) {
      suggestions.push({
        id: `timing_optimization_${Date.now()}`,
        type: 'session_structure',
        priority: 'medium',
        confidence: 75,
        title: 'Optimize Your Practice Schedule',
        description:
          'Consistent practice timing can improve focus and retention. Try to practice at the same time each day.',
        actionable: true,
        parameters: {
          recommendedTime: timingPattern.characteristics.mostCommonHour,
          recommendedDays: timingPattern.characteristics.preferredDays,
        },
        expectedBenefit: 'Better focus and more consistent progress',
        estimatedImpact: 70,
      });
    }

    return suggestions;
  }

  private generateAutomationSuggestions(
    patterns: BehaviorPattern[],
    _progress: ProgressMetrics,
  ): PracticeSuggestion[] {
    const suggestions: PracticeSuggestion[] = [];
    const learningStylePattern = patterns.find(
      (p) => p.type === 'learning_style',
    );

    if (!learningStylePattern) return suggestions;

    // Suggest automation based on learning style
    const dominantStyle = learningStylePattern.characteristics.dominantStyle;

    if (dominantStyle === 'visual') {
      suggestions.push({
        id: `visual_automation_${Date.now()}`,
        type: 'automation_config',
        priority: 'low',
        confidence: 80,
        title: 'Enable Visual Feedback Automation',
        description:
          'As a visual learner, you might benefit from automated visual cues and feedback during practice.',
        actionable: true,
        parameters: {
          visualFeedbackEnabled: true,
          visualCueIntensity: 'high',
          colorCodingEnabled: true,
        },
        expectedBenefit: 'Enhanced visual learning experience',
        estimatedImpact: 60,
      });
    } else if (dominantStyle === 'auditory') {
      suggestions.push({
        id: `auditory_automation_${Date.now()}`,
        type: 'automation_config',
        priority: 'low',
        confidence: 80,
        title: 'Optimize Audio Feedback Settings',
        description:
          "Your auditory learning style suggests you'd benefit from enhanced audio feedback and metronome settings.",
        actionable: true,
        parameters: {
          audioFeedbackEnabled: true,
          metronomeIntensity: 'high',
          auditoryCluesEnabled: true,
        },
        expectedBenefit: 'Better auditory learning integration',
        estimatedImpact: 60,
      });
    }

    return suggestions;
  }

  public getSuggestion(id: string): PracticeSuggestion | undefined {
    return this.suggestions.get(id);
  }

  public getAllSuggestions(): PracticeSuggestion[] {
    return Array.from(this.suggestions.values());
  }

  public generateOptimalAutomation(
    userPreferences: Record<string, any>,
  ): AutomationConfig {
    const tempoPrefs = userPreferences.tempo_progression || {};
    const transpositionPrefs = userPreferences.transposition_preference || {};
    const routinePrefs = userPreferences.practice_routine || {};
    const learningStylePrefs = userPreferences.learning_style || {};

    return {
      tempoProgression: {
        startBPM: 80,
        targetBPM: 120,
        progressionType: tempoPrefs.preferredStyle || 'gradual',
        incrementSize: tempoPrefs.averageChange || 5,
        masteryThreshold: 85,
        adaptToPerformance: true,
      },
      transpositionSequence: {
        keySequence: transpositionPrefs.favoriteKeys || [
          'C',
          'G',
          'D',
          'A',
          'E',
        ],
        progressionStrategy: 'circle_of_fifths',
        difficultyProgression: true,
        focusAreas: ['major_scales', 'chord_progressions'],
      },
      sessionStructure: {
        warmupDuration: 10,
        focusAreas: routinePrefs.preferredControllers || ['tempo', 'technique'],
        cooldownDuration: 5,
        breakIntervals: [25, 50], // Pomodoro-style
        adaptiveLength: true,
      },
      adaptiveSettings: {
        learningStyle: learningStylePrefs.dominantStyle || 'mixed',
        preferredPace: 'moderate',
        challengeLevel: 'moderate',
        feedbackFrequency: 'moderate',
      },
    };
  }

  public dispose(): void {
    this.suggestions.clear();
    this.removeAllListeners();
  }
}

/**
 * ProgressAnalyzer - Analyzes user progress and performance trends
 */
export class ProgressAnalyzer extends EventEmitter {
  private progressHistory: Map<string, number[]> = new Map();
  private milestones: Achievement[] = [];

  constructor() {
    super();
  }

  public analyzeProgress(
    sessions: PracticeSession[],
    _patterns: BehaviorPattern[],
  ): ProgressMetrics {
    if (sessions.length === 0) {
      return this.getEmptyProgressMetrics();
    }

    // Analyze skill areas
    const skillAreas = this.analyzeSkillAreas(sessions);

    // Calculate overall progress
    const overallProgress =
      skillAreas.reduce((sum, area) => sum + area.currentLevel, 0) /
      skillAreas.length;

    // Calculate learning velocity
    const learningVelocity = this.calculateLearningVelocity(sessions);

    // Calculate consistency score
    const consistencyScore = this.calculateConsistencyScore(sessions);

    // Determine improvement trend
    const improvementTrend = this.determineImprovementTrend(sessions);

    // Estimate time to next milestone
    const timeToNextMilestone = this.estimateTimeToNextMilestone(
      overallProgress,
      learningVelocity,
    );

    // Identify strengths and areas for improvement
    const { strengths, areasForImprovement } =
      this.identifyStrengthsAndWeaknesses(skillAreas);

    return {
      overallProgress,
      skillAreas,
      learningVelocity,
      consistencyScore,
      improvementTrend,
      timeToNextMilestone,
      strengths,
      areasForImprovement,
    };
  }

  private analyzeSkillAreas(sessions: PracticeSession[]): SkillAreaProgress[] {
    const skillAreas: SkillAreaProgress[] = [
      {
        area: 'tempo_control',
        currentLevel: 0,
        previousLevel: 0,
        improvement: 0,
        trend: 'stable',
        practiceTime: 0,
        lastPracticed: 0,
      },
      {
        area: 'transposition',
        currentLevel: 0,
        previousLevel: 0,
        improvement: 0,
        trend: 'stable',
        practiceTime: 0,
        lastPracticed: 0,
      },
      {
        area: 'timing_accuracy',
        currentLevel: 0,
        previousLevel: 0,
        improvement: 0,
        trend: 'stable',
        practiceTime: 0,
        lastPracticed: 0,
      },
      {
        area: 'consistency',
        currentLevel: 0,
        previousLevel: 0,
        improvement: 0,
        trend: 'stable',
        practiceTime: 0,
        lastPracticed: 0,
      },
      {
        area: 'technique',
        currentLevel: 0,
        previousLevel: 0,
        improvement: 0,
        trend: 'stable',
        practiceTime: 0,
        lastPracticed: 0,
      },
    ];

    // Analyze tempo control
    const tempoInteractions = sessions.flatMap((s) =>
      s.controlInteractions.filter((i) => i.controllerType === 'tempo'),
    );
    if (tempoInteractions.length > 0) {
      const tempoAccuracy =
        tempoInteractions.reduce((sum, i) => sum + i.performance.accuracy, 0) /
        tempoInteractions.length;
      const tempoConsistency =
        tempoInteractions.reduce(
          (sum, i) => sum + i.performance.successRate,
          0,
        ) / tempoInteractions.length;

      const tempoArea = skillAreas[0];
      if (tempoArea) {
        tempoArea.currentLevel = (tempoAccuracy + tempoConsistency) / 2;
        tempoArea.practiceTime = tempoInteractions.length * 0.5; // Estimate 30 seconds per interaction
        tempoArea.lastPracticed = Math.max(
          ...tempoInteractions.map((i) => i.timestamp),
        );
      }
    }

    // Analyze transposition
    const transpositionInteractions = sessions.flatMap((s) =>
      s.controlInteractions.filter((i) => i.controllerType === 'transposition'),
    );
    if (transpositionInteractions.length > 0) {
      const transpositionAccuracy =
        transpositionInteractions.reduce(
          (sum, i) => sum + i.performance.accuracy,
          0,
        ) / transpositionInteractions.length;
      const transpositionConsistency =
        transpositionInteractions.reduce(
          (sum, i) => sum + i.performance.successRate,
          0,
        ) / transpositionInteractions.length;

      const transpositionArea = skillAreas[1];
      if (transpositionArea) {
        transpositionArea.currentLevel =
          (transpositionAccuracy + transpositionConsistency) / 2;
        transpositionArea.practiceTime = transpositionInteractions.length * 0.5;
        transpositionArea.lastPracticed = Math.max(
          ...transpositionInteractions.map((i) => i.timestamp),
        );
      }
    }

    // Analyze timing accuracy
    const syncInteractions = sessions.flatMap((s) =>
      s.controlInteractions.filter(
        (i) => i.controllerType === 'synchronization',
      ),
    );
    if (syncInteractions.length > 0) {
      const timingAccuracy =
        syncInteractions.reduce((sum, i) => sum + i.performance.accuracy, 0) /
        syncInteractions.length;

      const timingArea = skillAreas[2];
      if (timingArea) {
        timingArea.currentLevel = timingAccuracy;
        timingArea.practiceTime = syncInteractions.length * 0.3;
        timingArea.lastPracticed = Math.max(
          ...syncInteractions.map((i) => i.timestamp),
        );
      }
    }

    // Analyze consistency (based on session quality metrics)
    const avgConsistency =
      sessions.reduce((sum, s) => sum + s.qualityMetrics.consistency, 0) /
      sessions.length;
    const consistencyArea = skillAreas[3];
    if (consistencyArea) {
      consistencyArea.currentLevel = avgConsistency;
      consistencyArea.practiceTime =
        sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / (1000 * 60); // Total practice time in minutes
      consistencyArea.lastPracticed = Math.max(
        ...sessions.map((s) => s.startTime),
      );
    }

    // Analyze technique (based on overall performance)
    const avgAccuracy =
      sessions.reduce((sum, s) => sum + s.qualityMetrics.accuracy, 0) /
      sessions.length;
    const avgEngagement =
      sessions.reduce((sum, s) => sum + s.qualityMetrics.engagement, 0) /
      sessions.length;
    const techniqueArea = skillAreas[4];
    if (techniqueArea && consistencyArea) {
      techniqueArea.currentLevel = (avgAccuracy + avgEngagement) / 2;
      techniqueArea.practiceTime = consistencyArea.practiceTime; // Same as consistency
      techniqueArea.lastPracticed = consistencyArea.lastPracticed;
    }

    // Calculate trends and improvements
    skillAreas.forEach((area) => {
      const historyKey = area.area;
      const history = this.progressHistory.get(historyKey) || [];

      if (history.length > 0) {
        const lastLevel = history[history.length - 1];
        if (lastLevel !== undefined) {
          area.previousLevel = lastLevel;
          area.improvement = area.currentLevel - area.previousLevel;

          if (area.improvement > 5) area.trend = 'improving';
          else if (area.improvement < -5) area.trend = 'declining';
          else area.trend = 'stable';
        }
      }

      // Update history
      history.push(area.currentLevel);
      if (history.length > 20) history.shift(); // Keep last 20 measurements
      this.progressHistory.set(historyKey, history);
    });

    return skillAreas;
  }

  private calculateLearningVelocity(sessions: PracticeSession[]): number {
    if (sessions.length < 2) return 0;

    const recentSessions = sessions.slice(-10);
    const olderSessions = sessions.slice(-20, -10);

    if (recentSessions.length === 0 || olderSessions.length === 0) return 0;

    const recentAvgQuality =
      recentSessions.reduce((sum, s) => sum + s.qualityMetrics.accuracy, 0) /
      recentSessions.length;
    const olderAvgQuality =
      olderSessions.reduce((sum, s) => sum + s.qualityMetrics.accuracy, 0) /
      olderSessions.length;

    const improvement = recentAvgQuality - olderAvgQuality;
    const lastRecentSession = recentSessions[recentSessions.length - 1];
    const firstOlderSession = olderSessions[0];

    if (!lastRecentSession || !firstOlderSession) return 0;

    const timeSpan = lastRecentSession.startTime - firstOlderSession.startTime;
    const days = timeSpan / (1000 * 60 * 60 * 24);

    return days > 0 ? improvement / days : 0;
  }

  private calculateConsistencyScore(sessions: PracticeSession[]): number {
    if (sessions.length === 0) return 0;

    // Calculate consistency based on session quality variance
    const qualityScores = sessions.map((s) => s.qualityMetrics.accuracy);
    const avgQuality =
      qualityScores.reduce((sum, q) => sum + q, 0) / qualityScores.length;
    const variance =
      qualityScores.reduce((sum, q) => sum + Math.pow(q - avgQuality, 2), 0) /
      qualityScores.length;

    // Lower variance = higher consistency
    return Math.max(0, 100 - Math.sqrt(variance));
  }

  private determineImprovementTrend(
    sessions: PracticeSession[],
  ): 'accelerating' | 'steady' | 'plateauing' | 'declining' {
    if (sessions.length < 6) return 'steady';

    const recent = sessions.slice(-3);
    const middle = sessions.slice(-6, -3);
    const older = sessions.slice(-9, -6);

    if (recent.length === 0 || middle.length === 0) return 'steady';

    const recentAvg =
      recent.reduce((sum, s) => sum + s.qualityMetrics.accuracy, 0) /
      recent.length;
    const middleAvg =
      middle.reduce((sum, s) => sum + s.qualityMetrics.accuracy, 0) /
      middle.length;
    const olderAvg =
      older.length > 0
        ? older.reduce((sum, s) => sum + s.qualityMetrics.accuracy, 0) /
          older.length
        : middleAvg;

    const recentImprovement = recentAvg - middleAvg;
    const middleImprovement = middleAvg - olderAvg;

    if (recentImprovement > middleImprovement + 5) return 'accelerating';
    if (recentImprovement < middleImprovement - 5) return 'declining';
    if (Math.abs(recentImprovement) < 2 && Math.abs(middleImprovement) < 2)
      return 'plateauing';
    return 'steady';
  }

  private estimateTimeToNextMilestone(
    currentProgress: number,
    learningVelocity: number,
  ): number {
    const nextMilestone = Math.ceil(currentProgress / 10) * 10; // Next 10% milestone
    const progressNeeded = nextMilestone - currentProgress;

    if (learningVelocity <= 0) return 999; // Unknown/very long time

    return Math.ceil(progressNeeded / learningVelocity);
  }

  private identifyStrengthsAndWeaknesses(skillAreas: SkillAreaProgress[]): {
    strengths: string[];
    areasForImprovement: string[];
  } {
    const sorted = [...skillAreas].sort(
      (a, b) => b.currentLevel - a.currentLevel,
    );

    const strengths = sorted
      .slice(0, 2)
      .filter((area) => area.currentLevel > 70)
      .map((area) => this.formatSkillAreaName(area.area));

    const areasForImprovement = sorted
      .slice(-2)
      .filter((area) => area.currentLevel < 60)
      .map((area) => this.formatSkillAreaName(area.area));

    return { strengths, areasForImprovement };
  }

  private formatSkillAreaName(area: string): string {
    return area.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }

  private getEmptyProgressMetrics(): ProgressMetrics {
    return {
      overallProgress: 0,
      skillAreas: [],
      learningVelocity: 0,
      consistencyScore: 0,
      improvementTrend: 'steady',
      timeToNextMilestone: 999,
      strengths: [],
      areasForImprovement: [],
    };
  }

  public trackMilestone(achievement: Achievement): void {
    this.milestones.push(achievement);
    this.emit('milestoneAchieved', achievement);
  }

  public getMilestones(): Achievement[] {
    return [...this.milestones];
  }

  public dispose(): void {
    this.progressHistory.clear();
    this.milestones.length = 0;
    this.removeAllListeners();
  }
}

/**
 * AnalyticsEngine - Main orchestrator for analytics and learning intelligence
 */
export class AnalyticsEngine extends EventEmitter {
  private practiceTracker: PracticeSessionTracker;
  private patternRecognizer: BehaviorPatternRecognizer;
  private suggestionEngine: IntelligentSuggestionEngine;
  private progressAnalyzer: ProgressAnalyzer;
  private isInitialized = false;

  constructor() {
    super();

    this.practiceTracker = new PracticeSessionTracker();
    this.patternRecognizer = new BehaviorPatternRecognizer();
    this.suggestionEngine = new IntelligentSuggestionEngine();
    this.progressAnalyzer = new ProgressAnalyzer();

    this.setupEventHandlers();
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize all components
      this.emit('initializationStarted');

      // Setup cross-component communication
      this.practiceTracker.on('interactionRecorded', (interaction) => {
        this.patternRecognizer.analyzeInteraction(interaction);
      });

      this.patternRecognizer.on('patternDetected', (pattern) => {
        this.emit('behaviorPatternDetected', pattern);
      });

      this.progressAnalyzer.on('milestoneAchieved', (achievement) => {
        this.emit('milestoneAchieved', achievement);
      });

      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      this.emit('initializationError', error);
      throw error;
    }
  }

  public trackControlUsage(controlType: string, parameters: any): void {
    if (!this.isInitialized) {
      console.warn('AnalyticsEngine not initialized. Call initialize() first.');
      return;
    }

    const interaction: ControlInteraction = {
      id: `interaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      controllerType: controlType as any,
      action: parameters.action || 'unknown',
      parameters,
      context: {
        sessionPhase: parameters.sessionPhase || 'main',
        previousAction: parameters.previousAction || '',
        timeInSession: parameters.timeInSession || 0,
        userIntent: parameters.userIntent || 'practice',
        difficulty: parameters.difficulty || 50,
      },
      performance: {
        responseTime: parameters.responseTime || 100,
        accuracy: parameters.accuracy || 80,
        confidence: parameters.confidence || 75,
        errorCount: parameters.errorCount || 0,
        successRate: parameters.successRate || 85,
      },
    };

    this.practiceTracker.recordInteraction(interaction);
    this.emit('controlUsageTracked', interaction);
  }

  public startPracticeSession(
    context?: Partial<PracticeContext>,
  ): PracticeSession {
    const fullContext: PracticeContext = {
      sessionType: 'practice',
      focusArea: 'general',
      difficulty: 'intermediate',
      goals: ['improve_technique'],
      timeOfDay: this.getCurrentTimeOfDay(),
      environment: 'quiet',
      ...context,
    };

    const session = this.practiceTracker.startSession(fullContext);
    this.emit('practiceSessionStarted', session);
    return session;
  }

  public endPracticeSession(): PracticeSession | null {
    const session = this.practiceTracker.endSession();
    if (session) {
      this.emit('practiceSessionEnded', session);

      // Generate insights after session ends
      setTimeout(() => {
        this.generatePracticeInsights();
      }, 1000);
    }
    return session;
  }

  public generatePracticeInsights(): PracticeInsights {
    if (!this.isInitialized) {
      throw new Error('AnalyticsEngine not initialized');
    }

    const sessions = this.practiceTracker.getSessionHistory();
    const patterns = this.patternRecognizer.getPatterns();
    const progress = this.progressAnalyzer.analyzeProgress(sessions, patterns);
    const suggestions = this.suggestionEngine.generateSuggestions(
      patterns,
      progress,
    );
    const sessionSummary = this.practiceTracker.getSessionStats();
    const trends = this.generateAnalyticsTrends(sessions, patterns);

    const insights: PracticeInsights = {
      patterns,
      suggestions,
      progress,
      achievements: this.progressAnalyzer.getMilestones(),
      sessionSummary,
      trends,
    };

    this.emit('insightsGenerated', insights);
    return insights;
  }

  public adaptAutomationToUser(): AutomationConfig {
    const userPreferences = this.patternRecognizer.extractUserPreferences();
    const automationConfig =
      this.suggestionEngine.generateOptimalAutomation(userPreferences);

    this.emit('automationConfigGenerated', automationConfig);
    return automationConfig;
  }

  public getCurrentPracticeContext(): PracticeContext {
    const currentSession = this.practiceTracker.getCurrentSession();

    if (currentSession) {
      return currentSession.context;
    }

    return {
      sessionType: 'practice',
      focusArea: 'general',
      difficulty: 'intermediate',
      goals: ['improve_technique'],
      timeOfDay: this.getCurrentTimeOfDay(),
      environment: 'quiet',
    };
  }

  public getSessionHistory(limit?: number): PracticeSession[] {
    return this.practiceTracker.getSessionHistory(limit);
  }

  public getBehaviorPatterns(): BehaviorPattern[] {
    return this.patternRecognizer.getPatterns();
  }

  public getProgressMetrics(): ProgressMetrics {
    const sessions = this.practiceTracker.getSessionHistory();
    const patterns = this.patternRecognizer.getPatterns();
    return this.progressAnalyzer.analyzeProgress(sessions, patterns);
  }

  public getSuggestions(): PracticeSuggestion[] {
    return this.suggestionEngine.getAllSuggestions();
  }

  public recordAchievement(achievement: Achievement): void {
    this.progressAnalyzer.trackMilestone(achievement);
    this.emit('achievementRecorded', achievement);
  }

  private setupEventHandlers(): void {
    // Handle errors from sub-components
    [
      this.practiceTracker,
      this.patternRecognizer,
      this.suggestionEngine,
      this.progressAnalyzer,
    ].forEach((component) => {
      component.on('error', (error) => {
        this.emit('componentError', {
          component: component.constructor.name,
          error,
        });
      });
    });
  }

  private getCurrentTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = new Date().getHours();

    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
  }

  private generateAnalyticsTrends(
    sessions: PracticeSession[],
    _patterns: BehaviorPattern[],
  ): AnalyticsTrend[] {
    const trends: AnalyticsTrend[] = [];

    if (sessions.length < 5) return trends;

    // Accuracy trend
    const recentAccuracy =
      sessions
        .slice(-5)
        .reduce((sum, s) => sum + s.qualityMetrics.accuracy, 0) / 5;
    const olderAccuracy =
      sessions
        .slice(-10, -5)
        .reduce((sum, s) => sum + s.qualityMetrics.accuracy, 0) / 5;

    if (!isNaN(recentAccuracy) && !isNaN(olderAccuracy)) {
      const accuracyChange =
        ((recentAccuracy - olderAccuracy) / olderAccuracy) * 100;

      trends.push({
        metric: 'Accuracy',
        direction:
          accuracyChange > 2 ? 'up' : accuracyChange < -2 ? 'down' : 'stable',
        magnitude: Math.abs(accuracyChange),
        timeframe: 'Last 10 sessions',
        significance:
          Math.abs(accuracyChange) > 10
            ? 'high'
            : Math.abs(accuracyChange) > 5
              ? 'medium'
              : 'low',
      });
    }

    // Practice frequency trend
    const recentSessions = sessions.filter(
      (s) => s.startTime > Date.now() - 7 * 24 * 60 * 60 * 1000,
    );
    const olderSessions = sessions.filter(
      (s) =>
        s.startTime > Date.now() - 14 * 24 * 60 * 60 * 1000 &&
        s.startTime <= Date.now() - 7 * 24 * 60 * 60 * 1000,
    );

    if (recentSessions.length > 0 && olderSessions.length > 0) {
      const frequencyChange =
        ((recentSessions.length - olderSessions.length) /
          olderSessions.length) *
        100;

      trends.push({
        metric: 'Practice Frequency',
        direction:
          frequencyChange > 10
            ? 'up'
            : frequencyChange < -10
              ? 'down'
              : 'stable',
        magnitude: Math.abs(frequencyChange),
        timeframe: 'Last 2 weeks',
        significance:
          Math.abs(frequencyChange) > 50
            ? 'high'
            : Math.abs(frequencyChange) > 25
              ? 'medium'
              : 'low',
      });
    }

    return trends;
  }

  public dispose(): void {
    this.practiceTracker.dispose();
    this.patternRecognizer.dispose();
    this.suggestionEngine.dispose();
    this.progressAnalyzer.dispose();

    this.removeAllListeners();
    this.isInitialized = false;
  }
}
