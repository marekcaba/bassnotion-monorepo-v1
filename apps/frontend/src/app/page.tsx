import Link from 'next/link';

import { Button } from '@/shared/components/ui/button';
import { ResponsiveDebug } from '@/shared/components/ui/responsive-debug';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-8 sm:p-24">
      {/* Add debug component for responsive testing */}
      <ResponsiveDebug showAlways={true} />

      <div className="z-10 max-w-6xl w-full">
        {/* Responsive layout: vertical on mobile (< 600px), horizontal on desktop */}
        <div className="flex flex-col items-center text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          {/* Left side: Title and subtitle */}
          <div className="mb-6 sm:mb-0 sm:flex-1">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
              Welcome to BassNotion
            </h1>
            <p className="mt-2 text-lg sm:text-xl text-muted-foreground">
              Your Bass Learning Platform
            </p>
          </div>

          {/* Right side: Button group */}
          <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4 sm:flex-shrink-0">
            <Link href="/dashboard">
              <Button className="w-full sm:w-auto min-w-[160px]">
                Go to Dashboard
              </Button>
            </Link>
            <Button
              variant="outline"
              className="w-full sm:w-auto min-w-[160px]"
              disabled
            >
              Try YouTube Exercises (Coming Soon)
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
