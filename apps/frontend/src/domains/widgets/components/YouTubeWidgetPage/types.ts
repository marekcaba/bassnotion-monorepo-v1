// Mock data interfaces for Story 3.0

export interface MockExercise {
  id: string;
  title: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: string;
  bpm: number;
  description: string;
}

export interface MockTutorial {
  id: string;
  title: string;
  instructor: string;
  youtubeUrl: string;
  exercises: MockExercise[];
}

export interface MockTakeaway {
  id: number;
  type: 'key-concept' | 'technique' | 'practice-tip';
  text: string;
  icon: any; // Lucide icon component
  color: string;
}

export interface SubwidgetState {
  metronome: {
    bpm: number;
    timeSignature: string;
    isActive: boolean;
  };
  drummer: {
    pattern: string;
    isActive: boolean;
  };
  bassline: {
    type: string;
    isActive: boolean;
  };
  harmony: {
    progression: string;
    currentChord: string;
  };
}
