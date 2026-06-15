import type {
  GoalSnapshot,
  EnrollmentStatus,
  LadderLevel,
  RepResultOutcome,
  MasteryTier,
  ProgressSignal,
  TutorialBlock,
} from '@bassnotion/contracts';

/** Raw `rep_results` row (snake_case as stored). */
export interface RepResultRow {
  id: string;
  user_id: string;
  goal_enrollment_id: string;
  drill_session_id: string | null;
  block_id: string;
  ladder_level: LadderLevel;
  tempo_bpm: number | null;
  signal_kind: string | null;
  signal_value: Record<string, unknown> | null;
  result: RepResultOutcome;
  achieved_tier: MasteryTier | null;
  completed_at: string;
}

/** Raw `goal_enrollments` row (snake_case as stored). */
export interface GoalEnrollmentRow {
  id: string;
  user_id: string;
  goal_id: string;
  started_at: string;
  status: EnrollmentStatus;
  goal_snapshot: GoalSnapshot;
  placement: Record<string, unknown> | null;
  virtual_tutorial_slug: string | null;
  graduated_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Arguments for appending a rep result (server stamps id/completedAt). */
export interface InsertRepResult {
  userId: string;
  goalEnrollmentId: string;
  drillSessionId?: string | null;
  blockId: string;
  ladderLevel: LadderLevel;
  tempoBpm?: number | null;
  signal: ProgressSignal | null;
  result: RepResultOutcome;
  achievedTier?: MasteryTier | null;
}

/** Arguments for minting the reserved virtual-tutorial row (§7a). */
export interface MintVirtualTutorial {
  slug: string;
  title: string;
  blocks: TutorialBlock[];
}
