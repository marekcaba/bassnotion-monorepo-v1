export interface Widget {
  id: string;
  type: string;
  configuration: WidgetConfiguration;
}

export interface WidgetConfiguration {
  [key: string]: unknown;
}

export interface YouTubeExercise {
  videoId: string;
  title: string;
  description: string;
  exercises: {
    startTime: number;
    endTime: number;
    title: string;
    description: string;
    tempo: number;
    difficulty: string;
    tags: string[];
  }[];
}
