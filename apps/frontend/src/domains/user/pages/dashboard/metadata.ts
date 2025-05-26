import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Manage your bass learning journey and track your progress.',
  openGraph: {
    title: 'BassNotion Dashboard',
    description: 'Manage your bass learning journey and track your progress.',
    type: 'website',
    images: ['/images/dashboard-og.jpg'],
  },
  robots: {
    index: false,
    follow: true,
  },
};
