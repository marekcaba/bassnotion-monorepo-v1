'use client';

import { useEffect, useState } from 'react';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

interface ElementInfo {
  path: string;
  tagName: string;
  className: string;
  id: string;
  computedStyle: {
    position: string;
    zIndex: string;
    pointerEvents: string;
    overflow: string;
    transform: string;
    opacity: string;
  };
}

export default function ClickComparisonPage() {
  const [currentPageInfo, setCurrentPageInfo] = useState<ElementInfo[]>([]);
  const [eventListeners, setEventListeners] = useState<string[]>([]);
  const [documentStyles, setDocumentStyles] = useState<string[]>([]);

  useEffect(() => {
    logger.info('=== CLICK COMPARISON TOOL ===');

    // Function to analyze what's at a specific point
    const analyzePoint = (x: number, y: number): ElementInfo[] => {
      const elements: ElementInfo[] = [];
      const elementsAtPoint = document.elementsFromPoint(x, y);

      elementsAtPoint.forEach((el, index) => {
        const computed = window.getComputedStyle(el);
        elements.push({
          path: `Level ${index}`,
          tagName: el.tagName.toLowerCase(),
          className: el.className.toString(),
          id: el.id,
          computedStyle: {
            position: computed.position,
            zIndex: computed.zIndex,
            pointerEvents: computed.pointerEvents,
            overflow: computed.overflow,
            transform: computed.transform,
            opacity: computed.opacity,
          },
        });
      });

      return elements;
    };

    // Analyze center of viewport
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    setCurrentPageInfo(analyzePoint(centerX, centerY));

    // Check for event listeners that might prevent default
    const checkEventListeners = () => {
      const listeners: string[] = [];

      // Check window listeners
      const windowListeners = (window as any).eventListeners;
      if (windowListeners) {
        listeners.push(
          'Window has event listeners: ' +
            JSON.stringify(Object.keys(windowListeners)),
        );
      }

      // Check document listeners
      const events = [
        'click',
        'mousedown',
        'mouseup',
        'touchstart',
        'touchend',
        'pointerdown',
      ];
      events.forEach((event) => {
        // This is a hack to check if listeners exist
        const hasListener = document.addEventListener
          .toString()
          .includes(event);
        if (hasListener) {
          listeners.push(`Document might have ${event} listener`);
        }
      });

      setEventListeners(listeners);
    };

    checkEventListeners();

    // Check for any injected styles
    const checkStyles = () => {
      const styles: string[] = [];
      const styleSheets = Array.from(document.styleSheets);

      styleSheets.forEach((sheet, index) => {
        try {
          if (sheet.href) {
            styles.push(`External stylesheet: ${sheet.href}`);
          } else {
            const rules = Array.from(sheet.cssRules || []);
            rules.forEach((rule) => {
              if (
                rule.cssText.includes('pointer-events') ||
                rule.cssText.includes('z-index') ||
                rule.cssText.includes('position: fixed') ||
                rule.cssText.includes('position: absolute')
              ) {
                styles.push(rule.cssText.substring(0, 100) + '...');
              }
            });
          }
        } catch (e) {
          styles.push(`Stylesheet ${index}: Access denied (cross-origin)`);
        }
      });

      setDocumentStyles(styles);
    };

    checkStyles();

    // Monitor for dynamically added elements
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            // Element node
            const el = node as HTMLElement;
            const computed = window.getComputedStyle(el);
            if (
              computed.position === 'fixed' ||
              parseInt(computed.zIndex) > 1000 ||
              el.className.toString().includes('tsqd')
            ) {
              logger.info('⚠️ Dynamically added element:', {
                tagName: el.tagName,
                className: el.className.toString(),
                position: computed.position,
                zIndex: computed.zIndex,
              });
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Test click handler
    const testClickHandler = (e: MouseEvent) => {
      logger.info('🎯 Click detected at:', e.clientX, e.clientY);
      logger.info('Target:', e.target);
      logger.info('Current target:', e.currentTarget);
      logger.info('Event phase:', e.eventPhase);
      logger.info('Bubbles:', e.bubbles);
      logger.info('Default prevented:', e.defaultPrevented);

      // Re-analyze on click
      setCurrentPageInfo(analyzePoint(e.clientX, e.clientY));
    };

    document.addEventListener('click', testClickHandler, true);

    return () => {
      observer.disconnect();
      document.removeEventListener('click', testClickHandler, true);
    };
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Click Event Analysis</h1>

      <div className="mb-6 p-4 bg-blue-100 rounded">
        <h2 className="text-xl font-semibold mb-2">Instructions</h2>
        <ol className="list-decimal list-inside space-y-1">
          <li>Open this page and a tutorial page side by side</li>
          <li>Click anywhere on this page - it should log to console</li>
          <li>Try clicking on the tutorial page</li>
          <li>Compare the "Elements at Center" sections</li>
          <li>Look for differences in z-index, position, or pointer-events</li>
        </ol>
      </div>

      <div className="mb-6 p-4 bg-gray-100 rounded">
        <h2 className="text-xl font-semibold mb-2">
          Elements at Center of Viewport
        </h2>
        <div className="space-y-2">
          {currentPageInfo.map((info, index) => (
            <div key={index} className="p-2 bg-white rounded text-sm font-mono">
              <div className="font-bold">
                {info.path}: {info.tagName}
                {info.id && `#${info.id}`}
                {info.className && `.${info.className}`}
              </div>
              <div>
                Position: {info.computedStyle.position} | Z-Index:{' '}
                {info.computedStyle.zIndex}
              </div>
              <div>Pointer Events: {info.computedStyle.pointerEvents}</div>
              <div>
                Opacity: {info.computedStyle.opacity} | Transform:{' '}
                {info.computedStyle.transform}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6 p-4 bg-yellow-100 rounded">
        <h2 className="text-xl font-semibold mb-2">
          Potential Event Listeners
        </h2>
        {eventListeners.length === 0 ? (
          <p>No suspicious event listeners detected</p>
        ) : (
          <ul className="list-disc list-inside">
            {eventListeners.map((listener, index) => (
              <li key={index} className="text-sm">
                {listener}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mb-6 p-4 bg-green-100 rounded">
        <h2 className="text-xl font-semibold mb-2">Suspicious Styles</h2>
        {documentStyles.length === 0 ? (
          <p>No suspicious styles found</p>
        ) : (
          <div className="space-y-1">
            {documentStyles.map((style, index) => (
              <div key={index} className="text-xs font-mono">
                {style}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 bg-purple-100 rounded">
        <h2 className="text-xl font-semibold mb-2">Click Test Area</h2>
        <button
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          onClick={() => alert('Button clicked successfully!')}
        >
          Test Button
        </button>
        <p className="mt-2 text-sm">
          Check console for detailed click information
        </p>
      </div>
    </div>
  );
}
