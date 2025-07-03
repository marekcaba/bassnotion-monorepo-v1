export interface TutorialResponseDto {
  id: string;
  slug: string;
  title: string;
  artist: string;
  youtube_url?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration?: string;
  description?: string;
  concepts?: string[];
  thumbnail?: string;
  rating?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TutorialSummaryDto extends TutorialResponseDto {
  exercise_count: number;
}

export interface TutorialsResponseDto {
  tutorials: TutorialSummaryDto[];
  total: number;
}

export interface TutorialExercisesResponseDto {
  tutorial: TutorialResponseDto;
  exercises: any[]; // Using any for now, will be properly typed when integrated
}
