'use client';

import Link from 'next/link';

import { Button } from '@/shared/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-6xl font-bold">500</h1>
        <h2 className="mt-4 text-2xl">Something went wrong</h2>
        <p className="mt-2 text-muted-foreground">
          {error.message ||
            'We encountered an error while processing your request.'}
          {error.digest && (
            <span className="block mt-1 text-sm">Error ID: {error.digest}</span>
          )}
        </p>
        <div className="mt-8 flex gap-4">
          <Link href="/">
            <Button>Return Home</Button>
          </Link>
          <Button onClick={() => reset()} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    </main>
  );
}
