import type { ReactNode } from 'react';
import { AudioProvider } from '@/domains/playback/providers/AudioProvider';

export default function TutorialEditLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AudioProvider>{children}</AudioProvider>;
}
