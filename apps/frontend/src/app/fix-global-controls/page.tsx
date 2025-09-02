'use client';

import { useEffect } from 'react';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

export default function FixGlobalControlsPage() {
  useEffect(() => {
    logger.info('=== FIXING GLOBAL CONTROLS CLICK BLOCKING ===');

    // Function to fix the GlobalControls SVG issue
    const fixGlobalControls = () => {
      // Find all SVG elements in GlobalControls
      const globalControlsContainers = document.querySelectorAll(
        '[class*="global-controls"], [class*="GlobalControls"]',
      );
      logger.info(
        'Found GlobalControls containers:',
        globalControlsContainers.length,
      );

      globalControlsContainers.forEach((container) => {
        const svgs = container.querySelectorAll('svg');
        svgs.forEach((svg) => {
          logger.info('Processing SVG:', {
            width: svg.getAttribute('width'),
            height: svg.getAttribute('height'),
            viewBox: svg.getAttribute('viewBox'),
            parentClass: svg.parentElement?.className,
          });

          // Ensure SVG doesn't block clicks outside its bounds
          svg.style.pointerEvents = 'auto';
          svg.style.position = 'relative';
          svg.style.maxWidth = '100%';
          svg.style.overflow = 'visible';

          // Find all click handlers on SVG elements
          const clickableElements = svg.querySelectorAll(
            '[data-clickable="true"]',
          );
          logger.info('Found clickable elements:', clickableElements.length);

          // Remove stopPropagation from handlers
          clickableElements.forEach((el) => {
            const oldHandler = (el as any)._clickHandler;
            if (oldHandler) {
              el.removeEventListener('click', oldHandler);

              // Create new handler without stopPropagation
              const newHandler = (event: Event) => {
                // Let the original handler run but don't stop propagation
                const mouseEvent = event as MouseEvent;
                logger.info('Sheet music click:', {
                  target: mouseEvent.target,
                  currentTarget: mouseEvent.currentTarget,
                });
              };

              el.addEventListener('click', newHandler);
            }
          });
        });
      });

      // Also check for any overlays
      const allElements = document.querySelectorAll('*');
      let overlayCount = 0;

      allElements.forEach((el) => {
        const styles = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();

        // Check if element is a full-screen overlay
        if (
          (styles.position === 'fixed' || styles.position === 'absolute') &&
          rect.width >= window.innerWidth * 0.9 &&
          rect.height >= window.innerHeight * 0.9
        ) {
          logger.info('Found potential overlay:', {
            element: el,
            className: el.className,
            position: styles.position,
            zIndex: styles.zIndex,
            opacity: styles.opacity,
            pointerEvents: styles.pointerEvents,
          });
          overlayCount++;

          // If it's transparent and blocking, fix it
          if (
            parseFloat(styles.opacity) < 0.1 ||
            styles.background === 'transparent'
          ) {
            (el as HTMLElement).style.pointerEvents = 'none';
            logger.info('Fixed transparent overlay');
          }
        }
      });

      logger.info(`Total overlays found: ${overlayCount}`);

      // Test click functionality
      document.body.addEventListener(
        'click',
        (e) => {
          logger.info('Body click detected:', {
            target: e.target,
            x: e.clientX,
            y: e.clientY,
          });
        },
        { once: true },
      );
    };

    // Run the fix
    fixGlobalControls();

    // Run again after a delay to catch any dynamically added elements
    setTimeout(fixGlobalControls, 1000);
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Global Controls Click Fix</h1>
      <p className="mb-4">
        This page attempts to fix click blocking issues caused by the
        GlobalControls sheet music component.
      </p>
      <p className="mb-4">Check the console for debug information.</p>

      <div className="space-y-4">
        <button
          onClick={() => {
            logger.info('Test button clicked!');
            alert('Button works!');
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Test Click
        </button>

        <button
          onClick={() => (window.location.href = '/library/come-together')}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Go Back to Tutorial
        </button>

        <button
          onClick={() => (window.location.href = '/')}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Go to Home
        </button>
      </div>

      <div className="mt-8 p-4 bg-yellow-100 rounded">
        <h2 className="font-bold mb-2">What this fix does:</h2>
        <ul className="list-disc list-inside">
          <li>
            Finds GlobalControls SVG elements and ensures they don't block
            clicks
          </li>
          <li>Removes stopPropagation from sheet music click handlers</li>
          <li>Fixes any transparent overlays that might be blocking clicks</li>
        </ul>
      </div>
    </div>
  );
}
