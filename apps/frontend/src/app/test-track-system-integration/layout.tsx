export default function TestTrackSystemIntegrationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // AudioProvider is already in root layout, no need to duplicate
  return <>{children}</>;
}