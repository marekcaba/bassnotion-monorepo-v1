export interface Content {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContentExercise extends Content {
  type: 'youtube' | 'midi' | 'audio';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tempo: number;
  duration: number;
  tags: string[];
}

export interface ExerciseMetadata {
  startTime: number;
  endTime: number;
  tempo: number;
  difficulty: string;
  description: string;
  tags: string[];
}
