'use client';

import { PageErrorBoundary } from '@/shared/components/ErrorBoundary';
import { Headphones } from 'lucide-react';

function StudioContent() {
  return (
    <div className="mx-auto max-w-4xl p-6 md:p-10">
      <div className="flex items-center gap-3">
        <Headphones className="size-8 text-[#ffc700]" />
        <h1 className="text-2xl font-bold text-zinc-100">Studio</h1>
      </div>
      <p className="mt-4 text-zinc-400">
        Your personal practice space is coming soon.
      </p>
    </div>
  );
}

export default function StudioPage() {
  return (
    <>
      <PageErrorBoundary pageName="Studio">
        <StudioContent />
      </PageErrorBoundary>
    </>
  );
}
