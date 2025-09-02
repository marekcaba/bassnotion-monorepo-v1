'use client';

import React, { useEffect, useRef } from 'react';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

// V98: Just a simple div to test if the page structure works
export default function V98Page() {
  logger.info('✅ V98 - Baseline test - should definitely work');

  const renderCount = useRef(0);
  renderCount.current++;

  useEffect(() => {
    logger.info(`V98 rendered ${renderCount.current} times`);
  });

  return (
    <>
      <div className="min-h-screen bg-gray-900 p-8">
        <div className="fixed top-4 right-4 bg-green-500 text-white p-2 rounded z-50">
          Renders: {renderCount.current}
        </div>
        <h1 className="text-white text-2xl mb-4">
          V98: Baseline test - just a div
        </h1>
        <div className="max-w-4xl mx-auto bg-gray-800 p-8 rounded">
          <p className="text-white">
            If this page works (can click, low render count), then we know the
            issue is specifically in FretboardCard.
          </p>
          <button
            onClick={() => alert('Button clicked!')}
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Test Click
          </button>
        </div>
      </div>
    </>
  );
}
