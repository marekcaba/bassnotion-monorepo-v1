// Mock data for practice chart dashboard
// Replace with real Supabase data fetching later

// ─── Exercise Completions (Bar Chart) ────────────────────────────────
export interface ExerciseCompletionData {
  exercise: string;
  completions: number; // 0-10
}

export const exerciseCompletionData: ExerciseCompletionData[] = [
  { exercise: 'Root Notes', completions: 8 },
  { exercise: 'Octaves', completions: 6 },
  { exercise: 'Fifths', completions: 10 },
  { exercise: 'Walking', completions: 4 },
  { exercise: 'Groove', completions: 2 },
  { exercise: 'Slap Basics', completions: 7 },
  { exercise: 'Hammer-ons', completions: 3 },
  { exercise: 'Pull-offs', completions: 5 },
];

// ─── Tempo Progress (Area Chart) ─────────────────────────────────────
export interface TempoProgressData {
  exercise: string;
  currentBpm: number;
  targetBpm: number;
}

export const tempoProgressData: TempoProgressData[] = [
  { exercise: 'Root Notes', currentBpm: 110, targetBpm: 120 },
  { exercise: 'Octaves', currentBpm: 85, targetBpm: 100 },
  { exercise: 'Fifths', currentBpm: 120, targetBpm: 120 },
  { exercise: 'Walking', currentBpm: 70, targetBpm: 100 },
  { exercise: 'Groove', currentBpm: 65, targetBpm: 90 },
  { exercise: 'Slap Basics', currentBpm: 95, targetBpm: 110 },
];

// ─── Journey Progress (Radial Chart) ─────────────────────────────────
export interface JourneyProgressData {
  label: string;
  value: number; // 0-100
  fill: string;
}

export const journeyProgressData: JourneyProgressData[] = [
  { label: 'Tutorials', value: 65, fill: 'var(--color-tutorials)' },
  { label: 'Exercises', value: 45, fill: 'var(--color-exercises)' },
  { label: 'Journey', value: 38, fill: 'var(--color-journey)' },
];

// ─── Weekly Practice Activity (Area Chart) ───────────────────────────
export interface WeeklyActivityData {
  day: string;
  minutes: number;
  exercises: number;
}

export const weeklyActivityData: WeeklyActivityData[] = [
  { day: 'Mon', minutes: 45, exercises: 3 },
  { day: 'Tue', minutes: 30, exercises: 2 },
  { day: 'Wed', minutes: 0, exercises: 0 },
  { day: 'Thu', minutes: 60, exercises: 5 },
  { day: 'Fri', minutes: 25, exercises: 2 },
  { day: 'Sat', minutes: 90, exercises: 7 },
  { day: 'Sun', minutes: 15, exercises: 1 },
];
