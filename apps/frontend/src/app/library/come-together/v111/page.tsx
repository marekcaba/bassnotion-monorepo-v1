'use client';

import React, { useEffect, useState } from 'react';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

// V111: Ultra minimal test - no components at all
export default function V111Page() {
  const [clickCount, setClickCount] = useState(0);

  logger.info('🟢 V111 Page rendered');

  useEffect(() => {
    logger.info('🟢 V111 useEffect running');

    // Test console is working
    const interval = setInterval(() => {
      logger.info('🟢 V111 is alive:', new Date().toISOString());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 p-8 text-white">
      <h1 className="text-2xl mb-4">V111: Ultra Minimal Test</h1>
      <p className="mb-4">This page has NO components - just basic React</p>

      <button
        onClick={() => {
          logger.info('🟢 Button clicked!');
          setClickCount((prev) => prev + 1);
        }}
        className="bg-blue-500 px-4 py-2 rounded hover:bg-blue-600"
      >
        Click me ({clickCount} clicks)
      </button>

      <div className="mt-8 p-4 bg-gray-800 rounded">
        <h2 className="text-lg mb-2">Debug Info:</h2>
        <p>
          If you can click the button and see console logs, the page is working.
        </p>
        <p>
          If not, there's a fundamental issue with the routing or React itself.
        </p>
      </div>
    </div>
  );
}
