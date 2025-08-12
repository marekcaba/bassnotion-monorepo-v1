import { AudioProvider } from '@/domains/playback/providers/AudioProvider';

export default function TestMetronomeV2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AudioProvider>
      {children}
    </AudioProvider>
  );
}