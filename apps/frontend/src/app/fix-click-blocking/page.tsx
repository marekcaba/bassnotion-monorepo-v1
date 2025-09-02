'use client';

import { useEffect } from 'react';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

export default function FixClickBlockingPage() {
  useEffect(() => {
    // Function to find and fix blocking elements
    const fixBlockingElements = () => {
      logger.info('=== FIXING CLICK BLOCKING ISSUES ===');

      // 1. Find all SVG elements that might be blocking
      const svgElements = document.querySelectorAll('svg');
      svgElements.forEach((svg) => {
        const rect = svg.getBoundingClientRect();
        const styles = window.getComputedStyle(svg);

        // Check if SVG is taking up the whole screen
        if (
          rect.width > window.innerWidth * 0.9 ||
          rect.height > window.innerHeight * 0.9
        ) {
          logger.info('Found oversized SVG:', {
            element: svg,
            width: rect.width,
            height: rect.height,
            position: styles.position,
            zIndex: styles.zIndex,
          });

          // If it's blocking, set pointer-events to none on the container
          const parent = svg.parentElement;
          if (
            (parent && styles.position === 'absolute') ||
            styles.position === 'fixed'
          ) {
            parent.style.pointerEvents = 'none';
            svg.style.pointerEvents = 'none';
            logger.info('Set pointer-events: none on oversized SVG');
          }
        }
      });

      // 2. Find elements with click handlers that might be capturing all clicks
      const elementsWithHandlers = document.querySelectorAll(
        '[onclick], [onmousedown], [onpointerdown]',
      );
      logger.info(
        'Elements with inline handlers:',
        elementsWithHandlers.length,
      );

      // 3. Check for invisible overlays
      const allElements = document.querySelectorAll('*');
      allElements.forEach((el) => {
        const styles = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();

        // Check for full-screen invisible elements
        if (
          (styles.position === 'fixed' || styles.position === 'absolute') &&
          rect.width >= window.innerWidth &&
          rect.height >= window.innerHeight &&
          parseFloat(styles.opacity) < 0.1
        ) {
          logger.info('Found invisible overlay:', {
            element: el,
            className: el.className,
            id: el.id,
            opacity: styles.opacity,
          });

          // Remove it or set pointer-events none
          (el as HTMLElement).style.pointerEvents = 'none';
        }
      });

      // 4. Remove any global click capture
      const newBody = document.body.cloneNode(true) as HTMLElement;
      document.body.parentNode?.replaceChild(newBody, document.body);
      logger.info('Removed all global event listeners');

      // 5. Test click functionality
      setTimeout(() => {
        const testButton = document.createElement('button');
        testButton.textContent = 'Test Click';
        testButton.style.cssText =
          'position: fixed; top: 10px; right: 10px; z-index: 999999; padding: 10px; background: red; color: white;';
        testButton.onclick = () => alert('Clicks are working!');
        document.body.appendChild(testButton);
      }, 100);
    };

    // Run the fix
    fixBlockingElements();

    // Also run after a delay to catch any dynamically added elements
    setTimeout(fixBlockingElements, 1000);
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Click Blocking Fix</h1>
      <p className="mb-4">This page attempts to fix click blocking issues.</p>
      <p className="mb-4">Check the console for debug information.</p>

      <div className="space-y-4">
        <button
          onClick={() => (window.location.href = '/')}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Go to Home Page
        </button>

        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Reload Page
        </button>
      </div>

      <div className="mt-8 p-4 bg-yellow-100 rounded">
        <p>
          After this fix runs, try navigating back to the home page to see if
          clicks work.
        </p>
      </div>
    </div>
  );
}
