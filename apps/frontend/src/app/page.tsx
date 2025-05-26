import Link from 'next/link';

import { Button } from '@/shared/components/ui/button';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <h1 className="text-4xl font-bold">Welcome to BassNotion</h1>
        <p className="mt-4 text-xl">Your Bass Learning Platform</p>

        <div className="mt-8 flex gap-4">
          <Link href="/dashboard">
            <Button>Go to Dashboard</Button>
          </Link>
          <Link href="/youtube-exerciser">
            <Button variant="outline">Try YouTube Exerciser</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
