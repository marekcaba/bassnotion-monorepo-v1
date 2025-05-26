import type { Metadata } from 'next';

export const rootMetadata: Metadata = {
  title: {
    default: 'BassNotion',
    template: '%s | BassNotion',
  },
  description:
    'Learn bass guitar with AI-powered tools and interactive exercises.',
  keywords: [
    'bass guitar',
    'music learning',
    'AI',
    'exercises',
    'bass tutorials',
    'music education',
    'bass practice',
  ],
  authors: [{ name: 'BassNotion Team' }],
  creator: 'BassNotion',
  publisher: 'BassNotion',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    type: 'website',
    siteName: 'BassNotion',
    title: 'BassNotion - AI-Powered Bass Learning Platform',
    description:
      'Learn bass guitar with AI-powered tools and interactive exercises.',
    images: [
      {
        url: '/images/bassnotion-og.jpg',
        width: 1200,
        height: 630,
        alt: 'BassNotion - AI-Powered Bass Learning Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BassNotion - AI-Powered Bass Learning Platform',
    description:
      'Learn bass guitar with AI-powered tools and interactive exercises.',
    images: ['/images/bassnotion-og.jpg'],
    creator: '@bassnotion',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  manifest: '/site.webmanifest',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
};
