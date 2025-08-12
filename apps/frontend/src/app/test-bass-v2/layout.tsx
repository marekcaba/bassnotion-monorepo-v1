import { AudioProvider } from '@/domains/playback/providers/AudioProvider';

export default function TestBassV2Layout({
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