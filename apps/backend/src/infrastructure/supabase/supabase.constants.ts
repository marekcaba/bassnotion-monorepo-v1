export const SUPABASE_BUCKETS = {
  PATTERNS: 'patterns',
  EXERCISES: 'exercises',
  TUTORIALS: 'tutorials',
} as const;

export const SUPABASE_TABLES = {
  USERS: 'users',
  PATTERNS: 'patterns',
  EXERCISES: 'exercises',
  TUTORIALS: 'tutorials',
  EXERCISE_RESULTS: 'exercise_results',
} as const;

export type SupabaseBucket = typeof SUPABASE_BUCKETS[keyof typeof SUPABASE_BUCKETS];
export type SupabaseTable = typeof SUPABASE_TABLES[keyof typeof SUPABASE_TABLES];