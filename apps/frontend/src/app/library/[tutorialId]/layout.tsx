import type { Metadata } from 'next';

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ tutorialId: string }>;
}

// Generate dynamic metadata including canonical URL
export async function generateMetadata({
  params,
}: {
  params: Promise<{ tutorialId: string }>;
}): Promise<Metadata> {
  const { tutorialId } = await params;

  // Base URL for production
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || 'https://bassnotion.com';

  return {
    title: `${tutorialId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} | Bassicology`,
    description: `Learn bass guitar with the ${tutorialId.replace(/-/g, ' ')} tutorial on Bassicology`,
    alternates: {
      canonical: `${baseUrl}/library/${tutorialId}`,
    },
    openGraph: {
      title: `${tutorialId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} | Bassicology`,
      description: `Learn bass guitar with the ${tutorialId.replace(/-/g, ' ')} tutorial`,
      url: `${baseUrl}/library/${tutorialId}`,
      type: 'website',
    },
  };
}

export default async function TutorialLayout({ children }: LayoutProps) {
  return <>{children}</>;
}
