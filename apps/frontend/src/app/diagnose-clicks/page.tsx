'use client';

import { useEffect, useState } from 'react';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

interface BlockingElement {
  tagName: string;
  className: string;
  id: string;
  zIndex: string;
  position: string;
  pointerEvents: string;
  dimensions: string;
  hasClickHandler: boolean;
  path: string;
}

export default function DiagnoseClicksPage() {
  const [blockingElements, setBlockingElements] = useState<BlockingElement[]>(
    [],
  );
  const [clickTrace, setClickTrace] = useState<string[]>([]);
  const [clickWorking, setClickWorking] = useState<boolean>(false);

  useEffect(() => {
    logger.info('=== CLICK DIAGNOSIS PAGE ===');

    // Test if clicks work on document
    const testClickHandler = (e: MouseEvent) => {
      logger.info('Document click detected!', e.target);
      setClickWorking(true);

      // Get the event path
      const path = e.composedPath();
      const trace = path.map((el: any) => {
        if (el.nodeType === 1) {
          // Element node
          return `${el.tagName}.${el.className || 'no-class'}#${el.id || 'no-id'}`;
        }
        return el.toString();
      });

      setClickTrace(trace);
    };

    document.addEventListener('click', testClickHandler, true); // Use capture phase

    // Find all elements that might be blocking clicks
    const findBlockingElements = () => {
      const elements: BlockingElement[] = [];
      const allElements = document.querySelectorAll('*');

      allElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const styles = window.getComputedStyle(el);

        // Check if element could be blocking clicks
        const isPositioned = ['fixed', 'absolute'].includes(styles.position);
        const coversViewport =
          rect.width > 0 &&
          rect.height > 0 &&
          rect.top < window.innerHeight &&
          rect.bottom > 0 &&
          rect.left < window.innerWidth &&
          rect.right > 0;
        const hasHighZIndex =
          parseInt(styles.zIndex) > 1 || styles.zIndex === 'auto';

        // Check for event listeners
        const hasClickHandler =
          !!(el as any).onclick ||
          !!(el as any)._clickHandler ||
          el.hasAttribute('onclick');

        // Check if it's an SVG element with click handlers
        const isSVGWithHandlers =
          el.tagName.toLowerCase() === 'svg' || el.closest('svg') !== null;

        if (
          (isPositioned && coversViewport && hasHighZIndex) ||
          (hasClickHandler && styles.pointerEvents !== 'none') ||
          (isSVGWithHandlers && el.hasAttribute('data-clickable'))
        ) {
          // Get the element's path in DOM
          const path = [];
          let current = el;
          while (current && current !== document.body) {
            path.unshift(`${current.tagName}.${current.className || ''}`);
            current = current.parentElement!;
          }

          elements.push({
            tagName: el.tagName,
            className: el.className.toString(),
            id: el.id,
            zIndex: styles.zIndex,
            position: styles.position,
            pointerEvents: styles.pointerEvents,
            dimensions: `${Math.round(rect.width)}x${Math.round(rect.height)} at (${Math.round(rect.left)}, ${Math.round(rect.top)})`,
            hasClickHandler,
            path: path.join(' > '),
          });
        }
      });

      // Sort by z-index (higher first)
      elements.sort((a, b) => {
        const zA = a.zIndex === 'auto' ? 0 : parseInt(a.zIndex);
        const zB = b.zIndex === 'auto' ? 0 : parseInt(b.zIndex);
        return zB - zA;
      });

      setBlockingElements(elements);
    };

    // Run diagnosis after page loads
    setTimeout(findBlockingElements, 1000);

    // Check for global event handlers
    const checkGlobalHandlers = () => {
      logger.info('=== GLOBAL EVENT HANDLERS ===');

      // Check window handlers
      const windowHandlers = [];
      for (const prop in window) {
        if (prop.startsWith('on')) {
          const handler = (window as any)[prop];
          if (handler) {
            windowHandlers.push(prop);
          }
        }
      }
      logger.info('Window handlers:', windowHandlers);

      // Check document handlers
      const docHandlers = [];
      for (const prop in document) {
        if (prop.startsWith('on')) {
          const handler = (document as any)[prop];
          if (handler) {
            docHandlers.push(prop);
          }
        }
      }
      logger.info('Document handlers:', docHandlers);
    };

    checkGlobalHandlers();

    return () => {
      document.removeEventListener('click', testClickHandler, true);
    };
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Click Blocking Diagnosis</h1>

      <div className="mb-8 space-y-4">
        <button
          onClick={() => {
            logger.info('Button clicked!');
            alert('Button works!');
          }}
          className="px-6 py-3 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Test Button
        </button>

        <div
          onClick={() => logger.info('Div clicked!')}
          className="p-4 bg-green-200 cursor-pointer hover:bg-green-300 rounded"
        >
          Click this DIV
        </div>
      </div>

      <div
        className={`mb-6 p-4 rounded ${clickWorking ? 'bg-green-100 border-green-500' : 'bg-red-100 border-red-500'} border-2`}
      >
        <h2 className="text-xl font-semibold mb-2">Click Status</h2>
        <p>
          {clickWorking
            ? '✅ Clicks are working!'
            : '❌ No clicks detected yet'}
        </p>
      </div>

      {clickTrace.length > 0 && (
        <div className="mb-6 p-4 bg-blue-100 rounded">
          <h2 className="text-xl font-semibold mb-2">Last Click Event Path</h2>
          <ol className="list-decimal list-inside space-y-1">
            {clickTrace.map((element, index) => (
              <li key={index} className="text-sm font-mono">
                {element}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="bg-gray-100 p-4 rounded">
        <h2 className="text-xl font-semibold mb-4">
          Potential Blocking Elements ({blockingElements.length})
        </h2>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {blockingElements.map((element, index) => (
            <div key={index} className="p-3 bg-white rounded shadow-sm border">
              <div className="font-mono text-sm">
                <div>
                  <strong>Element:</strong> {element.tagName}.
                  {element.className || 'no-class'}#{element.id || 'no-id'}
                </div>
                <div>
                  <strong>Position:</strong> {element.position} |{' '}
                  <strong>Z-Index:</strong> {element.zIndex}
                </div>
                <div>
                  <strong>Pointer Events:</strong> {element.pointerEvents}
                </div>
                <div>
                  <strong>Dimensions:</strong> {element.dimensions}
                </div>
                <div>
                  <strong>Has Click Handler:</strong>{' '}
                  {element.hasClickHandler ? 'Yes' : 'No'}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  <strong>Path:</strong> {element.path}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 text-sm text-gray-600">
        <p>This page diagnoses what elements might be blocking clicks.</p>
        <p>Check the console for additional debug information.</p>
      </div>
    </div>
  );
}
