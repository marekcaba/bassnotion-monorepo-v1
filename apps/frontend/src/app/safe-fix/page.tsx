'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

export default function SafeFixPage() {
  const router = useRouter();

  useEffect(() => {
    logger.info('=== SAFE FIX FOR CLICK BLOCKING ===');

    // Add a global CSS fix without breaking React
    const style = document.createElement('style');
    style.id = 'click-fix-styles';
    style.textContent = `
      /* Force all elements to be clickable */
      * {
        pointer-events: auto !important;
      }
      
      /* Except elements explicitly marked as non-interactive */
      .pointer-events-none {
        pointer-events: none !important;
      }
      
      /* Ensure buttons and links work */
      button, a, input, select, textarea, [role="button"], [onclick], [href] {
        pointer-events: auto !important;
        cursor: pointer !important;
        position: relative !important;
        z-index: 1 !important;
      }
      
      /* Fix any SVG blocking issues */
      svg {
        pointer-events: none !important;
      }
      
      svg * {
        pointer-events: auto !important;
      }
      
      /* Remove any invisible overlays */
      div[style*="position: fixed"]:empty,
      div[style*="position: absolute"]:empty {
        display: none !important;
      }
    `;

    // Only add if not already present
    if (!document.getElementById('click-fix-styles')) {
      document.head.appendChild(style);
    }

    logger.info('CSS fixes applied');

    // Test click functionality
    const testHandler = (e: MouseEvent) => {
      logger.info('Click detected:', {
        target: e.target,
        tagName: (e.target as HTMLElement).tagName,
        className: (e.target as HTMLElement).className,
      });
    };

    document.addEventListener('click', testHandler);

    return () => {
      document.removeEventListener('click', testHandler);
      // Don't remove the style on cleanup - let it persist
    };
  }, []);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Safe Click Fix</h1>

      <div className="bg-blue-100 border-2 border-blue-500 p-4 rounded mb-6">
        <p className="font-semibold mb-2">
          This page applies safe CSS fixes to restore click functionality.
        </p>
        <p>The fixes will persist when you navigate to other pages.</p>
      </div>

      <div className="space-y-4 mb-8">
        <h2 className="text-xl font-semibold">Test Buttons:</h2>

        <button
          onClick={() => {
            alert('Button 1 works! Clicks are functioning.');
          }}
          className="block w-full px-4 py-3 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Test Button 1 - Alert
        </button>

        <button
          onClick={() => {
            logger.info('Button 2 clicked');
            router.push('/');
          }}
          className="block w-full px-4 py-3 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Test Button 2 - Go to Home
        </button>

        <button
          onClick={() => {
            logger.info('Button 3 clicked');
            router.push('/library/another-one-bites-dust');
          }}
          className="block w-full px-4 py-3 bg-purple-500 text-white rounded hover:bg-purple-600"
        >
          Test Button 3 - Go to Tutorial
        </button>
      </div>

      <div className="bg-yellow-100 border-2 border-yellow-500 p-4 rounded">
        <h3 className="font-semibold mb-2">Instructions:</h3>
        <ol className="list-decimal list-inside space-y-1">
          <li>Test the buttons above to ensure clicks work</li>
          <li>Check the console for click event logs</li>
          <li>Navigate to your tutorial page using Button 3</li>
          <li>The CSS fixes should persist and allow clicking</li>
        </ol>
      </div>

      <div className="mt-6 text-sm text-gray-600">
        <p>
          If clicks still don't work after this fix, the issue may require
          restarting the development server.
        </p>
      </div>
    </div>
  );
}
