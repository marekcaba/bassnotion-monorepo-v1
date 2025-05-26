export interface LearningProgress {
  userId: string;
  exerciseId: string;
  completedAt: string;
  score: number;
  timeSpent: number;
  attempts: number;
  notes: string;
}
