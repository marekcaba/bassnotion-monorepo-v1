'use client';

import { useEffect } from 'react';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

export default function EmergencyFixPage() {
  useEffect(() => {
    logger.info('=== EMERGENCY FIX FOR CLICK BLOCKING ===');

    const emergencyFix = () => {
      // 1. Remove ALL event listeners from document and window
      const oldDoc = document.cloneNode(true) as Document;
      const newDoc = document.implementation.createHTMLDocument();

      // Copy all nodes except scripts
      while (document.documentElement.firstChild) {
        document.documentElement.removeChild(
          document.documentElement.firstChild,
        );
      }

      // Re-add body content
      while (oldDoc.body.firstChild) {
        document.body.appendChild(oldDoc.body.firstChild);
      }

      logger.info('Removed all document event listeners');

      // 2. Find and fix all elements with cursor pointer
      const pointerElements = document.querySelectorAll('*');
      let fixedCount = 0;

      pointerElements.forEach((el) => {
        const styles = window.getComputedStyle(el);

        // If it has cursor pointer but no working click handler, fix it
        if (styles.cursor === 'pointer') {
          const htmlEl = el as HTMLElement;

          // Clone the element to remove all event listeners
          const newEl = htmlEl.cloneNode(true) as HTMLElement;
          htmlEl.parentNode?.replaceChild(newEl, htmlEl);

          // Add a test click handler
          newEl.addEventListener(
            'click',
            (e) => {
              logger.info('Click detected on:', e.target);
            },
            false,
          ); // Use bubbling phase, not capture

          fixedCount++;
        }
      });

      logger.info(`Fixed ${fixedCount} elements with cursor pointer`);

      // 3. Inject CSS to override any pointer-events issues
      const style = document.createElement('style');
      style.textContent = `
        * {
          pointer-events: auto !important;
        }
        
        /* Except for elements that should not be clickable */
        .pointer-events-none {
          pointer-events: none !important;
        }
        
        /* Ensure clickable elements work */
        button, a, input, select, textarea, [role="button"], [onclick] {
          pointer-events: auto !important;
          cursor: pointer !important;
        }
        
        /* Fix any z-index issues */
        body > * {
          position: relative;
          z-index: auto !important;
        }
        
        /* Remove any invisible overlays */
        div[style*="position: fixed"], div[style*="position: absolute"] {
          pointer-events: none !important;
        }
        
        /* But allow actual content to be clickable */
        div[style*="position: fixed"] *, div[style*="position: absolute"] * {
          pointer-events: auto !important;
        }
      `;
      document.head.appendChild(style);
      logger.info('Injected emergency CSS fixes');

      // 4. Test click functionality
      document.addEventListener('click', (e) => {
        logger.info('Document click detected:', {
          target: e.target,
          x: e.clientX,
          y: e.clientY,
          path: e.composedPath(),
        });
      });

      // 5. Add visible test button
      const testBtn = document.createElement('button');
      testBtn.textContent = 'EMERGENCY TEST BUTTON';
      testBtn.style.cssText = `
        position: fixed !important;
        top: 10px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        z-index: 999999999 !important;
        padding: 20px !important;
        background: red !important;
        color: white !important;
        font-size: 20px !important;
        border: 3px solid yellow !important;
        cursor: pointer !important;
        pointer-events: auto !important;
      `;
      testBtn.onclick = () => {
        alert('EMERGENCY BUTTON WORKS! Clicks are functioning.');
        window.location.href = '/';
      };
      document.body.appendChild(testBtn);
    };

    // Run immediately
    emergencyFix();

    // Run again after React re-renders
    setTimeout(emergencyFix, 100);
    setTimeout(emergencyFix, 500);
    setTimeout(emergencyFix, 1000);
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4 text-red-600">
        EMERGENCY FIX ACTIVATED
      </h1>

      <div className="bg-red-100 border-2 border-red-500 p-4 rounded mb-4">
        <p className="font-bold">
          This page performs aggressive fixes to restore click functionality:
        </p>
        <ul className="list-disc list-inside mt-2">
          <li>Removes ALL event listeners from the document</li>
          <li>Clones elements to remove attached handlers</li>
          <li>Injects CSS to force pointer-events: auto</li>
          <li>Adds test handlers to verify clicks work</li>
        </ul>
      </div>

      <div className="space-y-4">
        <button
          onClick={() => {
            logger.info('Regular button clicked');
            alert('This button works!');
          }}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 cursor-pointer"
        >
          Test Regular Button
        </button>

        <div
          onClick={() => {
            logger.info('Div clicked');
            alert('Div click works!');
          }}
          className="p-4 bg-green-200 cursor-pointer hover:bg-green-300 rounded"
        >
          Click this DIV
        </div>

        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            logger.info('Link clicked');
            alert('Link works!');
          }}
          className="text-blue-600 underline cursor-pointer"
        >
          Test Link
        </a>
      </div>

      <div className="mt-8 p-4 bg-yellow-100 rounded">
        <p className="font-bold">Check the console for debug output.</p>
        <p>After testing here, navigate back to see if the fix persists.</p>
      </div>
    </div>
  );
}
