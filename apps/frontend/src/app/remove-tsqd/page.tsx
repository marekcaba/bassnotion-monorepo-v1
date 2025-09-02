'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

export default function RemoveTsqdPage() {
  const router = useRouter();

  useEffect(() => {
    logger.info('=== REMOVING TSQD BLOCKING ELEMENTS ===');

    const removeTsqdElements = () => {
      // Find and remove all tsqd elements
      const tsqdElements = document.querySelectorAll('[class*="tsqd"]');
      logger.info(`Found ${tsqdElements.length} tsqd elements`);

      tsqdElements.forEach((el) => {
        logger.info('Removing:', el.className);
        el.remove();
      });

      // Also look for parent containers that might contain tsqd
      const containers = document.querySelectorAll('.tsqd-parent-container');
      containers.forEach((container) => {
        logger.info('Removing parent container');
        container.remove();
      });

      // Look for any fixed positioned elements with very high z-index
      const allElements = document.querySelectorAll('*');
      allElements.forEach((el) => {
        const styles = window.getComputedStyle(el);
        const zIndex = parseInt(styles.zIndex);

        // Remove suspicious high z-index elements that aren't part of your app
        if (zIndex > 9999 && styles.position === 'fixed') {
          const className = el.className.toString();
          const id = el.id;

          // Don't remove known UI elements (like toasts)
          if (
            !className.includes('toast') &&
            !className.includes('modal') &&
            !id
          ) {
            logger.info(
              `Removing high z-index element: ${el.tagName} z-index: ${zIndex}`,
            );
            el.remove();
          }
        }
      });

      // Add CSS to hide any remaining tsqd elements
      const style = document.createElement('style');
      style.id = 'tsqd-blocker';
      style.textContent = `
        /* Hide all tsqd elements */
        [class*="tsqd"] {
          display: none !important;
          pointer-events: none !important;
        }
        
        .tsqd-parent-container {
          display: none !important;
        }
        
        /* Ensure page content is clickable */
        body * {
          pointer-events: auto !important;
        }
        
        /* Except elements that should not be clickable */
        .pointer-events-none {
          pointer-events: none !important;
        }
      `;

      if (!document.getElementById('tsqd-blocker')) {
        document.head.appendChild(style);
      }

      logger.info('TSQD elements removed and blocked');
    };

    // Run immediately
    removeTsqdElements();

    // Run again after delays to catch dynamically added elements
    setTimeout(removeTsqdElements, 500);
    setTimeout(removeTsqdElements, 1000);
    setTimeout(removeTsqdElements, 2000);

    // Set up observer to remove any new tsqd elements
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            // Element node
            const element = node as Element;
            if (
              element.className &&
              element.className.toString().includes('tsqd')
            ) {
              logger.info('Removing newly added tsqd element');
              element.remove();
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Remove TSQD Blocking Elements</h1>

      <div className="bg-blue-100 border-2 border-blue-500 p-4 rounded mb-6">
        <p className="font-semibold mb-2">
          This page removes TSQD elements that are blocking clicks.
        </p>
        <p>TSQD appears to be a third-party tool or browser extension.</p>
      </div>

      <div className="space-y-4 mb-8">
        <h2 className="text-xl font-semibold">Test Buttons:</h2>

        <button
          onClick={() => {
            alert('Button works! Clicks are functioning.');
          }}
          className="block w-full px-4 py-3 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Test Button - Alert
        </button>

        <button
          onClick={() => {
            logger.info('Navigating to tutorial');
            router.push('/library/come-together');
          }}
          className="block w-full px-4 py-3 bg-purple-500 text-white rounded hover:bg-purple-600"
        >
          Go to Tutorial Page
        </button>
      </div>

      <div className="bg-yellow-100 border-2 border-yellow-500 p-4 rounded">
        <h3 className="font-semibold mb-2">What is TSQD?</h3>
        <p className="mb-2">Based on the element structure, TSQD might be:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>A browser extension for debugging or recording</li>
          <li>A session recording tool (like FullStory, Hotjar)</li>
          <li>A development tool that injects UI elements</li>
        </ul>
        <p className="mt-2">
          Check your browser extensions or any third-party scripts on your site.
        </p>
      </div>
    </div>
  );
}
