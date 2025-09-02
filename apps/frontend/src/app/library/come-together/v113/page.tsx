'use client';

import React, { useEffect, useState } from 'react';
import { SyncProvider } from '@/domains/widgets/components/base/SyncProvider';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

// V113: Just test SyncProvider
export default function V113Page() {
  logger.info('🔄 V113 - Testing SyncProvider');
  const [renderCount, setRenderCount] = useState(0);

  useEffect(() => {
    setRenderCount((prev) => prev + 1);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 p-8 text-white">
      <h1 className="text-2xl mb-4">V113: SyncProvider Test</h1>
      <p className="mb-4">Renders: {renderCount}</p>

      <SyncProvider tutorialSlug="come-together">
        <div className="p-4 bg-gray-800 rounded">
          <p>If you see this and can click, SyncProvider works!</p>
          <button
            onClick={() => logger.info('Button in SyncProvider clicked!')}
            className="mt-2 bg-blue-500 px-4 py-2 rounded hover:bg-blue-600"
          >
            Test Click Inside Provider
          </button>
        </div>
      </SyncProvider>
    </div>
  );
}
