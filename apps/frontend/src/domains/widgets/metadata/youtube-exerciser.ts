import type { Metadata } from 'next';

export const youtubeExerciserMetadata: Metadata = {
  title: 'YouTube Exerciser',
  description:
    'Extract bass exercises from YouTube videos using AI-powered analysis.',
  openGraph: {
    title: 'Bassicology YouTube Exerciser',
    description:
      'Extract bass exercises from YouTube videos using AI-powered analysis.',
    type: 'website',
    images: ['/images/youtube-exerciser-og.jpg'],
  },
  robots: {
    index: false,
    follow: true,
  },
};
