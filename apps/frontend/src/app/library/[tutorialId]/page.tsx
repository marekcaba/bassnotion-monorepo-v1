'use client';

import React from 'react';
import { YouTubeWidgetPage } from '@/domains/widgets/components/YouTubeWidgetPage';

interface TutorialPageProps {
  params: Promise<{
    tutorialId: string;
  }>;
}

// Mock tutorial data - in real app this would come from an API
const getTutorialData = (tutorialId: string) => {
  const tutorials = {
    'never-gonna-give-you-up': {
      id: 'never-gonna-give-you-up',
      title: 'Never Gonna Give You Up',
      artist: 'Rick Astley',
      difficulty: 'Intermediate',
      duration: '15 min',
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      concepts: ['Modal Interchange', 'Tension & Release', 'II-V-I Variations'],
    },
    'billie-jean': {
      id: 'billie-jean',
      title: 'Billie Jean',
      artist: 'Michael Jackson',
      difficulty: 'Beginner',
      duration: '12 min',
      videoUrl: 'https://www.youtube.com/watch?v=Zi_XLOBDo_Y',
      concepts: ['Rhythm Fundamentals', 'Groove Patterns', 'Syncopation'],
    },
    'come-together': {
      id: 'come-together',
      title: 'Come Together',
      artist: 'The Beatles',
      difficulty: 'Advanced',
      duration: '20 min',
      videoUrl: 'https://www.youtube.com/watch?v=45cYwDMibGo',
      concepts: ['Complex Rhythms', 'Chromatic Runs', 'Advanced Techniques'],
    },
    'another-one-bites-dust': {
      id: 'another-one-bites-dust',
      title: 'Another One Bites the Dust',
      artist: 'Queen',
      difficulty: 'Intermediate',
      duration: '18 min',
      videoUrl: 'https://www.youtube.com/watch?v=rY0WxgSXdEE',
      concepts: ['Precision Playing', 'Timing', 'Rock Fundamentals'],
    },
  };

  return (
    tutorials[tutorialId as keyof typeof tutorials] ||
    tutorials['never-gonna-give-you-up']
  );
};

export default function TutorialPage({ params }: TutorialPageProps) {
  // Unwrap the params Promise using React.use()
  const resolvedParams = React.use(params);
  const tutorialData = getTutorialData(resolvedParams.tutorialId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Tutorial Content */}
      <YouTubeWidgetPage tutorialData={tutorialData} />
    </div>
  );
}
