'use client';

import { PageErrorBoundary } from '@/shared/components/ErrorBoundary';
import { Martini } from 'lucide-react';

function BackstageContent() {
  return (
    <div className="mx-auto max-w-4xl p-6 md:p-10">
      <div className="flex items-center gap-3">
        <Martini className="size-8 text-[#ffc700]" />
        <h1 className="text-2xl font-bold text-zinc-100">Backstage</h1>
      </div>
      <p className="mt-4 text-zinc-400">
        Exclusive backstage content is coming soon.
      </p>
    </div>
  );
}

export default function BackstagePage() {
  return (
    <>
      <PageErrorBoundary pageName="Backstage">
        <BackstageContent />
      </PageErrorBoundary>
    </>
  );
}
