/**
 * Learning Journey Types
 *
 * Types for the personalized learning path system.
 * Journeys are curated sequences of tutorials and exercises
 * organized into milestones.
 */

import type { SkillLevel, PrimaryGoal, BassTechnique, MusicGenre } from './assessment.js';

// =============================================================================
// Journey Status
// =============================================================================

export type JourneyStatus = 'active' | 'paused' | 'completed' | 'abandoned';

// =============================================================================
// Milestone
// =============================================================================

export interface JourneyMilestone {
  id: string;
  title: string;
  description: string;
  order: number;

  // Content references (IDs of tutorials/exercises)
  tutorials?: string[];
  exercises?: string[];

  // Unlock criteria (for future use)
  unlockCriteria?: MilestoneUnlockCriteria;

  // Estimated time
  estimatedHours?: number;
}

export interface MilestoneUnlockCriteria {
  completePreviousMilestone?: boolean;
  minimumExercisesCompleted?: number;
  minimumTutorialsWatched?: number;
  skillCheckPassed?: boolean;
}

// =============================================================================
// Learning Journey (Template)
// =============================================================================

export interface LearningJourney {
  id: string;
  name: string;
  slug: string;
  description: string;

  // Targeting criteria (for matching with assessment results)
  targetSkillLevel: SkillLevel;
  targetGoals: PrimaryGoal[];
  targetTechniques: BassTechnique[];
  targetGenres: MusicGenre[];

  // Content
  milestones: JourneyMilestone[];
  estimatedWeeks: number;

  // Display
  iconUrl?: string;
  color?: string; // Primary color for UI

  // Status
  isActive: boolean;
  isFeatured: boolean;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// User Journey (Instance)
// =============================================================================

export interface UserJourney {
  id: string;
  userId: string;
  journeyId: string;

  // Progress
  startedAt: string;
  currentMilestoneIndex: number;
  completedMilestones: number[]; // Indices of completed milestones
  progress: number; // 0-100 percentage

  // Status
  status: JourneyStatus;
  completedAt?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Journey with Full Data
// =============================================================================

export interface UserJourneyWithDetails extends UserJourney {
  journey: LearningJourney;
}

// =============================================================================
// Journey Progress
// =============================================================================

export interface JourneyProgress {
  journeyId: string;
  totalMilestones: number;
  completedMilestones: number;
  currentMilestoneIndex: number;
  currentMilestone: JourneyMilestone | null;
  nextMilestone: JourneyMilestone | null;
  percentComplete: number;
  estimatedRemainingWeeks: number;
}

// =============================================================================
// API DTOs
// =============================================================================

export interface GetUserJourneyResponse {
  journey: UserJourneyWithDetails | null;
  progress: JourneyProgress | null;
}

export interface GetAvailableJourneysResponse {
  journeys: LearningJourney[];
}

export interface AssignJourneyRequest {
  journeyId: string;
}

export interface AssignJourneyResponse {
  success: boolean;
  userJourney: UserJourney;
  message: string;
}

export interface UpdateJourneyProgressRequest {
  milestoneIndex?: number;
  completedMilestoneIndex?: number;
  status?: JourneyStatus;
}

export interface UpdateJourneyProgressResponse {
  success: boolean;
  progress: JourneyProgress;
  message: string;
}

// =============================================================================
// Journey Matching
// =============================================================================

export interface JourneyMatchScore {
  journeyId: string;
  journey: LearningJourney;
  score: number; // 0-100
  matchReasons: string[];
}

export interface JourneyMatchResult {
  bestMatch: JourneyMatchScore | null;
  alternatives: JourneyMatchScore[];
}
