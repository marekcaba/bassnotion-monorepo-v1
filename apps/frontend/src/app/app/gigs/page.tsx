'use client';

import { PageErrorBoundary } from '@/shared/components/ErrorBoundary';
import { Play } from 'lucide-react';

function GigsContent() {
  return (
    <div className="mx-auto max-w-4xl p-6 md:p-10">
      <div className="flex items-center gap-3">
        <Play className="size-8 text-[#ffc700]" />
        <h1 className="text-2xl font-bold text-zinc-100">Gigs</h1>
      </div>
      <p className="mt-4 text-zinc-400">
        Live performance features are coming soon.
      </p>
    </div>
  );
}

export default function GigsPage() {
  return (
    <>
      <PageErrorBoundary pageName="Gigs">
        <GigsContent />
      </PageErrorBoundary>
    </>
  );
}
