import { ReactNode } from 'react';

export default function YouTubeExerciserLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="min-h-screen bg-background">{children}</div>;
}
