/**
 * Assessment Quiz Questions
 *
 * Sample questions for the entrance assessment.
 * In production, configure via admin panel with your Bunny Stream video.
 */

import type { AssessmentQuestion, AssessmentConfig } from '@bassnotion/contracts';

// Bunny Stream video configuration (fallback/default values)
// These are used as fallback if database config is unavailable
export const BUNNY_LIBRARY_ID = '583585';
export const BUNNY_VIDEO_ID = '032167b4-e074-4c76-ba39-f3ee9d16966d';

/**
 * Helper to get Supabase storage URL for assessment audio files
 * Files should be uploaded to: audio-samples/assessment/{filename}
 *
 * NOTE: We store just the filename here. The full URL is resolved at runtime
 * in the AudioPlayer component to ensure NEXT_PUBLIC_SUPABASE_URL is available.
 */
function getAssessmentAudioPath(filename: string): string {
  return `assessment/${filename}`;
}

export const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  // ==========================================================================
  // KNOWLEDGE QUESTIONS (for skill level determination)
  // ==========================================================================
  {
    id: 'q1-instrument',
    type: 'multiple-choice',
    category: 'knowledge',
    timestamp: 15, // 15 seconds into video
    question: 'What instrument is this?',
    description: 'Listen to the audio and identify the instrument.',
    audioConfig: {
      url: getAssessmentAudioPath('q1-instrument.mp3'),
      label: 'Listen to the instrument',
    },
    options: [
      { id: 'q1-a', text: 'Harp', isCorrect: true },
      { id: 'q1-b', text: 'Piano', isCorrect: false },
      { id: 'q1-c', text: 'Guitar', isCorrect: false },
      { id: 'q1-d', text: 'Koto', isCorrect: false },
    ],
    points: 10,
    difficulty: 'beginner',
  },
  {
    id: 'q2-time-signature',
    type: 'multiple-choice',
    category: 'knowledge',
    timestamp: 35, // 35 seconds into video
    question: "What's the time signature of this groove?",
    description: 'Count the beats and identify the time signature.',
    audioConfig: {
      url: getAssessmentAudioPath('q2-groove.mp3'),
      label: 'Listen to the groove',
    },
    options: [
      { id: 'q2-a', text: '4/4', isCorrect: false },
      { id: 'q2-b', text: '3/4', isCorrect: false },
      { id: 'q2-c', text: '6/8', isCorrect: true },
      { id: 'q2-d', text: '5/4', isCorrect: false },
    ],
    points: 15,
    difficulty: 'intermediate',
  },
  {
    id: 'q3-open-strings',
    type: 'drag-drop',
    category: 'knowledge',
    timestamp: 55, // 55 seconds into video
    question: 'Name the open strings on a 4-string bass',
    description: 'Drag the note names to the correct string positions (low to high).',
    dragDropConfig: {
      draggableItems: ['E', 'A', 'D', 'G', 'B', 'C'], // Extra items as distractors
      dropZones: ['String 4 (lowest)', 'String 3', 'String 2', 'String 1 (highest)'],
      correctMapping: {
        'String 4 (lowest)': 'E',
        'String 3': 'A',
        'String 2': 'D',
        'String 1 (highest)': 'G',
      },
    },
    points: 20,
    difficulty: 'beginner',
  },
  {
    id: 'q4-harmonics',
    type: 'multiple-choice',
    category: 'knowledge',
    timestamp: 80, // 1:20 into video
    question: 'Who is famous for using false harmonics on bass?',
    options: [
      { id: 'q4-a', text: 'Flea', isCorrect: false },
      { id: 'q4-b', text: 'Marcus Miller', isCorrect: false },
      { id: 'q4-c', text: 'Jaco Pastorius', isCorrect: true },
      { id: 'q4-d', text: 'Victor Wooten', isCorrect: false },
    ],
    points: 15,
    difficulty: 'intermediate',
  },
  {
    id: 'q5-note-name',
    type: 'text-input',
    category: 'knowledge',
    timestamp: 100, // 1:40 into video
    question: 'What note is being played?',
    description: 'Type the name of the note you hear.',
    audioConfig: {
      url: getAssessmentAudioPath('q5-note.mp3'),
      label: 'Listen to the note',
    },
    textInputConfig: {
      acceptableAnswers: ['e', 'E', 'e note', 'the note e'],
      placeholder: 'Enter note name...',
      caseSensitive: false,
    },
    points: 10,
    difficulty: 'beginner',
  },

  // ==========================================================================
  // GOAL QUESTION (what do they want to achieve)
  // ==========================================================================
  {
    id: 'q6-goal',
    type: 'multiple-choice',
    category: 'goal',
    timestamp: 120, // 2:00 into video
    question: "What's your main goal with learning bass?",
    description: 'This helps us personalize your learning journey.',
    options: [
      { id: 'q6-a', text: 'Play in a band' },
      { id: 'q6-b', text: 'Learn my favorite songs' },
      { id: 'q6-c', text: 'Master advanced techniques' },
      { id: 'q6-d', text: 'Just have fun jamming' },
    ],
  },

  // ==========================================================================
  // PREFERENCE QUESTIONS (techniques and genres they like)
  // ==========================================================================
  {
    id: 'q7-techniques',
    type: 'multi-select',
    category: 'preference',
    timestamp: 140, // 2:20 into video
    question: 'Which techniques interest you most?',
    description: 'Select all that apply.',
    options: [
      { id: 'q7-a', text: 'Fingerstyle' },
      { id: 'q7-b', text: 'Slap' },
      { id: 'q7-c', text: 'Pick' },
      { id: 'q7-d', text: 'Tapping' },
    ],
  },
  {
    id: 'q8-genres',
    type: 'multi-select',
    category: 'preference',
    timestamp: 160, // 2:40 into video
    question: 'What genres do you want to play?',
    description: 'Select all that appeal to you.',
    options: [
      { id: 'q8-a', text: 'Funk' },
      { id: 'q8-b', text: 'Rock' },
      { id: 'q8-c', text: 'Jazz' },
      { id: 'q8-d', text: 'Metal' },
    ],
  },
];

export const ASSESSMENT_CONFIG: AssessmentConfig = {
  videoPlatform: 'bunny',
  videoLibraryId: BUNNY_LIBRARY_ID,
  videoId: BUNNY_VIDEO_ID,
  questions: ASSESSMENT_QUESTIONS,
  skillThresholds: {
    advanced: 80, // 80%+ = advanced
    intermediate: 50, // 50-79% = intermediate, below 50% = beginner
  },
};

export default ASSESSMENT_CONFIG;
