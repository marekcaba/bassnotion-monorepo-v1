/**
 * Assessment Types
 *
 * Types for the interactive video assessment quiz that determines
 * user skill level, goals, and style preferences.
 */

// =============================================================================
// Skill Level & Goals
// =============================================================================

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

export type PrimaryGoal =
  | 'play_in_band'
  | 'learn_songs'
  | 'master_techniques'
  | 'create_music'
  | 'jam_for_fun';

export type BassTechnique =
  | 'fingerstyle'
  | 'slap'
  | 'pick'
  | 'tapping'
  | 'harmonics';

export type MusicGenre =
  | 'funk'
  | 'rock'
  | 'jazz'
  | 'metal'
  | 'rnb'
  | 'gospel'
  | 'pop';

// =============================================================================
// Question Types
// =============================================================================

export type QuestionType =
  | 'multiple-choice' // Radio buttons, pick one
  | 'multi-select' // Checkboxes, pick multiple
  | 'text-input' // Free text with flexible matching
  | 'drag-drop'; // Drag items to correct positions

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect?: boolean; // For knowledge questions
}

export interface DragDropConfig {
  draggableItems: string[]; // Items to drag (e.g., ['E', 'A', 'D', 'G'])
  dropZones: string[]; // Zone labels (e.g., ['String 4', 'String 3', 'String 2', 'String 1'])
  correctMapping: Record<string, string>; // { 'String 4': 'E', ... }
}

export interface TextInputConfig {
  acceptableAnswers: string[]; // Flexible matching variations
  placeholder?: string;
  caseSensitive?: boolean;
}

export interface AudioConfig {
  url: string; // URL to audio file (mp3, wav, etc.)
  label?: string; // Optional label like "Listen to the note"
}

/**
 * Assessment Question
 *
 * Represents a single question in the video assessment.
 * Questions are triggered at specific timestamps in the video.
 */
export interface AssessmentQuestion {
  id: string;
  type: QuestionType;
  category: 'knowledge' | 'goal' | 'preference';

  // Video integration
  timestamp: number; // Seconds into video when question appears

  // Question content
  question: string;
  description?: string; // Additional context

  // Type-specific config
  options?: QuestionOption[]; // For multiple-choice and multi-select
  dragDropConfig?: DragDropConfig; // For drag-drop
  textInputConfig?: TextInputConfig; // For text-input
  audioConfig?: AudioConfig; // For questions that require listening to audio

  // Scoring (for knowledge questions)
  points?: number;
  difficulty?: SkillLevel;
}

// =============================================================================
// User Answers
// =============================================================================

export interface QuizAnswer {
  questionId: string;
  questionType: QuestionType;
  timestamp: number; // When answer was submitted

  // Answer data varies by question type
  selectedOptionId?: string; // multiple-choice
  selectedOptionIds?: string[]; // multi-select
  textAnswer?: string; // text-input
  dragDropMapping?: Record<string, string>; // drag-drop

  // Scoring (calculated after answer)
  isCorrect?: boolean;
  pointsEarned?: number;
}

// =============================================================================
// Assessment Results
// =============================================================================

export interface AssessmentResult {
  // Answers
  answers: QuizAnswer[];

  // Score (from knowledge questions)
  totalScore: number;
  maxPossibleScore: number;
  percentageScore: number;

  // Determined values
  skillLevel: SkillLevel;
  primaryGoal: PrimaryGoal;
  preferredTechniques: BassTechnique[];
  preferredGenres: MusicGenre[];

  // Metadata
  completedAt: string;
  videoWatchedFully: boolean;
}

// =============================================================================
// Assessment Status (for checking if user completed)
// =============================================================================

export interface AssessmentStatus {
  completed: boolean;
  skillLevel: SkillLevel | null;
  primaryGoal: PrimaryGoal | null;
  completedAt: string | null;
  score: number | null;
}

// =============================================================================
// API DTOs
// =============================================================================

export interface CompleteAssessmentRequest {
  result: AssessmentResult;
}

export interface CompleteAssessmentResponse {
  success: boolean;
  skillLevel: SkillLevel;
  assignedJourneyId: string | null;
  message: string;
}

export interface GetAssessmentStatusResponse {
  status: AssessmentStatus;
}

// =============================================================================
// Quiz Configuration
// =============================================================================

export type VideoPlatform = 'bunny';

export interface AssessmentConfig {
  // Video configuration - Bunny Stream only
  videoPlatform: VideoPlatform;
  videoLibraryId: string; // Bunny Stream library ID
  videoId: string; // Bunny Stream video GUID

  questions: AssessmentQuestion[];
  skillThresholds: {
    advanced: number; // Percentage threshold (e.g., 80)
    intermediate: number; // Percentage threshold (e.g., 50)
  };
}

// =============================================================================
// Progress Persistence (localStorage)
// =============================================================================

export interface AssessmentProgress {
  currentQuestionIndex: number;
  answers: QuizAnswer[];
  videoCurrentTime: number;
  startedAt: string;
  lastUpdatedAt: string;
}

// =============================================================================
// =============================================================================
// SEGMENT-BASED ASSESSMENT TYPES (V2)
// =============================================================================
// =============================================================================

// =============================================================================
// Skill Buckets (5-level system)
// =============================================================================

/**
 * Skill bucket represents the user's verified skill level.
 * This is more granular than the 3-level SkillLevel.
 */
export type SkillBucket =
  | 'true_beginner' // Never played, brand new
  | 'solid_beginner' // Can play basic songs, knows fundamentals
  | 'beginner_with_gaps' // Some experience but missing theory/technique
  | 'intermediate_theory_gaps' // Good technique but weak theory
  | 'solid_intermediate'; // Well-rounded intermediate player

// =============================================================================
// Video Segment Types
// =============================================================================

/**
 * Topic categorization for video segments.
 * Matches database CHECK constraint.
 */
export type SegmentTopic =
  | 'level_intro'
  | 'skill_check_response'
  | 'goals_beginner'
  | 'goals_intermediate'
  | 'struggle_true_beginner'
  | 'struggle_solid_beginner'
  | 'struggle_beginner_with_gaps'
  | 'struggle_intermediate_theory_gaps'
  | 'struggle_solid_intermediate'
  | 'learning_style'
  | 'practice_time'
  | 'genre'
  | 'genre_acknowledgment'
  | 'equipment'
  | 'equipment_response'
  | 'commitment';

/**
 * Represents a video segment in the assessment library.
 */
export interface VideoSegment {
  id: string;
  videoLibraryId: string;
  videoId: string;
  name: string;
  slug: string;
  description?: string;
  durationSeconds?: number;
  topic: SegmentTopic;
  targetBuckets: SkillBucket[];
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Flow Graph Types
// =============================================================================

/**
 * Type of node in the assessment flow graph.
 */
export type FlowNodeType =
  | 'segment' // Video segment to watch
  | 'question' // Question overlay (no video)
  | 'skill_verification' // Skill check with feedback
  | 'branch' // Decision point (no content, routing only)
  | 'result'; // Final results node

/**
 * Type of condition for flow edges.
 */
export type EdgeConditionType =
  | 'always' // Default path, no condition
  | 'answer_equals' // Take if answer matches value
  | 'bucket_equals' // Take if user's bucket matches
  | 'skill_verified' // Take if skill check passed
  | 'skill_failed'; // Take if skill check failed

/**
 * Represents a node in the assessment flow graph.
 */
export interface FlowNode {
  id: string;
  nodeId: string; // Human-readable identifier
  nodeType: FlowNodeType;
  segmentId?: string; // For segment nodes
  questionKey?: string; // For question nodes
  title?: string;
  description?: string;
  positionX: number;
  positionY: number;
  isActive: boolean;
  isEntryPoint: boolean;
}

/**
 * Condition value for flow edges.
 */
export interface EdgeConditionValue {
  questionKey?: string; // For answer_equals
  value?: string; // Answer value to match
  bucket?: SkillBucket; // For bucket_equals
}

/**
 * Represents an edge (transition) in the assessment flow graph.
 */
export interface FlowEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  conditionType: EdgeConditionType;
  conditionValue?: EdgeConditionValue;
  priority: number;
  label?: string;
}

/**
 * Complete flow graph for assessment navigation.
 */
export interface AssessmentFlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
  entryNodeId: string;
}

// =============================================================================
// Segment Question Types
// =============================================================================

/**
 * Question type for segment-based assessment.
 */
export type SegmentQuestionType =
  | 'multiple-choice' // Single select
  | 'multi-select' // Multiple select
  | 'text-input' // Free text
  | 'skill-verification'; // With correct answer and feedback

/**
 * Question category for segment-based assessment.
 */
export type SegmentQuestionCategory =
  | 'level' // Level self-report
  | 'verification' // Skill verification
  | 'goal' // Goals question
  | 'struggle' // Pain point question
  | 'style' // Learning style, practice, genre, equipment
  | 'commitment'; // Ready to start

/**
 * Option for segment questions.
 */
export interface SegmentQuestionOption {
  id: string;
  text: string;
  value: string; // Value to store in answers
  nextBucket?: SkillBucket; // For bucket-determining questions
  isCorrect?: boolean; // For skill verification
}

/**
 * Configuration for skill verification questions.
 */
export interface SkillVerificationConfig {
  correctAnswer: string;
  wrongAnswerFeedback: string; // Text overlay when wrong
  audioUrl?: string; // Audio to play with question
}

/**
 * Represents a question in the segment-based assessment.
 */
export interface SegmentQuestion {
  id: string;
  questionKey: string;
  questionText: string;
  description?: string;
  questionType: SegmentQuestionType;
  options?: SegmentQuestionOption[];
  verificationConfig?: SkillVerificationConfig;
  audioConfig?: AudioConfig;
  category: SegmentQuestionCategory;
  points?: number;
  sortOrder: number;
  isActive: boolean;
}

// =============================================================================
// Coach Insight Templates
// =============================================================================

/**
 * Template for personalized coach insights on results page.
 */
export interface CoachInsightTemplate {
  id: string;

  // Targeting criteria
  targetBucket: SkillBucket;
  targetGoal?: string;
  targetStruggle?: string;
  targetPracticeTime?: string;

  // Content
  insightTitle: string;
  insightBody: string; // Supports markdown, template variables

  // Coach persona
  coachName: string;
  coachAvatarUrl?: string;

  // Skill check acknowledgment
  skillCheckAcknowledgment?: string;

  // 3-Day Plan customization
  day1Title?: string;
  day1Description?: string;
  day2Title?: string;
  day2Description?: string;
  day3Title?: string;
  day3Description?: string;

  // Call to action
  ctaText: string;
  ctaLink?: string;

  // Metadata
  priority: number;
  isActive: boolean;
}

// =============================================================================
// Assessment Session State
// =============================================================================

/**
 * Status of an assessment session.
 */
export type SessionStatus = 'in_progress' | 'completed' | 'abandoned';

/**
 * Represents a user's assessment session state.
 */
export interface AssessmentSession {
  id: string;
  userId?: string;
  currentNodeId?: string;
  answers: Record<string, unknown>;
  visitedNodeIds: string[];
  selfReportedLevel?: string;
  determinedBucket?: SkillBucket;
  skillCheckPassed?: boolean;
  skillCheckScore?: number;
  startedAt: string;
  lastActivityAt: string;
  completedAt?: string;
  status: SessionStatus;
}

/**
 * Client-side session state for the state machine.
 */
export interface AssessmentSessionState {
  sessionId: string;
  currentNodeId: string;
  answers: Record<string, unknown>;
  visitedNodeIds: string[];
  selfReportedLevel?: string;
  determinedBucket?: SkillBucket;
  skillCheckPassed?: boolean;
  startedAt: string;
  lastActivityAt: string;
}

// =============================================================================
// Segment Assessment Results
// =============================================================================

/**
 * Result of completing the segment-based assessment.
 */
export interface SegmentAssessmentResult {
  bucket: SkillBucket;
  answers: Record<string, unknown>;
  skillCheckScore?: number;
  coachInsight: CoachInsightTemplate;
  assignedJourneyId?: string;
  completedAt: string;
}

// =============================================================================
// Segment Assessment API DTOs
// =============================================================================

/**
 * Request to create a new assessment session.
 */
export interface CreateSessionRequest {
  userId?: string;
}

/**
 * Response from creating a session.
 */
export interface CreateSessionResponse {
  session: AssessmentSession;
}

/**
 * Request to update session progress.
 */
export interface UpdateSessionRequest {
  currentNodeId: string;
  answers: Record<string, unknown>;
  visitedNodeIds?: string[];
  determinedBucket?: SkillBucket;
  skillCheckPassed?: boolean;
}

/**
 * Request to match a coach insight template.
 */
export interface MatchInsightRequest {
  bucket: SkillBucket;
  goal?: string;
  struggle?: string;
  practiceTime?: string;
}

/**
 * Response from matching insight.
 */
export interface MatchInsightResponse {
  insight: CoachInsightTemplate;
}

/**
 * Request to complete segment-based assessment.
 */
export interface CompleteSegmentAssessmentRequest {
  sessionId: string;
  bucket: SkillBucket;
  answers: Record<string, unknown>;
  skillCheckScore?: number;
}

/**
 * Response from completing segment assessment.
 */
export interface CompleteSegmentAssessmentResponse {
  success: boolean;
  result: SegmentAssessmentResult;
}
