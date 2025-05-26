export interface AnalysisResult {
  id: string;
  type: 'youtube' | 'midi' | 'audio';
  data: YouTubeAnalysis | AudioAnalysis;
  createdAt: string;
}

export interface YouTubeAnalysis {
  videoId: string;
  title: string;
  description: string;
  duration: number;
  exercises: YouTubeExerciseAnalysis[];
  summary: string;
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
  genre?: string;
}

export interface YouTubeExerciseAnalysis {
  id: string;
  title: string;
  description: string;
  startTime: number;
  endTime: number;
  tempo?: number;
  key?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
}

export interface AudioAnalysis {
  tempo: number;
  key: string;
  notes: AudioNote[];
}

export interface AudioNote {
  pitch: number;
  startTime: number;
  duration: number;
  velocity: number;
}
