import type { Metadata } from 'next';

export const homeMetadata: Metadata = {
  title: 'Your Bass Learning Platform',
  description:
    'Learn bass guitar with AI-powered tools and interactive exercises.',
  openGraph: {
    title: 'BassNotion - Your Bass Learning Platform',
    description:
      'Learn bass guitar with AI-powered tools and interactive exercises.',
    type: 'website',
    images: ['/images/home-og.jpg'],
  },
};
