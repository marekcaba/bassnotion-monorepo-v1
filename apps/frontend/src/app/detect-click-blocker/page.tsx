'use client';

import { useEffect, useState } from 'react';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

interface BlockingElement {
  tagName: string;
  className: string;
  id: string;
  styles: {
    position: string;
    zIndex: string;
    pointerEvents: string;
    width: string;
    height: string;
    top: string;
    left: string;
    right: string;
    bottom: string;
  };
  rect: DOMRect;
  isVisible: boolean;
  isClickable: boolean;
  parent: string;
}

export default function DetectClickBlockerPage() {
  const [blockingElements, setBlockingElements] = useState<BlockingElement[]>(
    [],
  );
  const [clickTestResults, setClickTestResults] = useState<string[]>([]);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    logger.info('=== CLICK BLOCKER DETECTOR INITIALIZED ===');

    // Track mouse position
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Function to detect what element would receive a click
    const detectClickBlockers = () => {
      const results: BlockingElement[] = [];

      // Get all elements
      const allElements = document.querySelectorAll('*');

      allElements.forEach((element) => {
        const el = element as HTMLElement;
        const computedStyle = window.getComputedStyle(el);

        // Check if element could be blocking clicks
        const rect = el.getBoundingClientRect();
        const isVisible =
          rect.width > 0 &&
          rect.height > 0 &&
          computedStyle.display !== 'none' &&
          computedStyle.visibility !== 'hidden' &&
          computedStyle.opacity !== '0';

        const hasHighZIndex =
          parseInt(computedStyle.zIndex) > 1000 ||
          computedStyle.zIndex === 'auto';
        const isFixed = computedStyle.position === 'fixed';
        const isAbsolute = computedStyle.position === 'absolute';
        const coversViewport =
          rect.width >= window.innerWidth * 0.8 &&
          rect.height >= window.innerHeight * 0.8;

        if (
          isVisible &&
          (hasHighZIndex || isFixed || (isAbsolute && coversViewport))
        ) {
          results.push({
            tagName: el.tagName.toLowerCase(),
            className: el.className.toString(),
            id: el.id,
            styles: {
              position: computedStyle.position,
              zIndex: computedStyle.zIndex,
              pointerEvents: computedStyle.pointerEvents,
              width: computedStyle.width,
              height: computedStyle.height,
              top: computedStyle.top,
              left: computedStyle.left,
              right: computedStyle.right,
              bottom: computedStyle.bottom,
            },
            rect,
            isVisible,
            isClickable: computedStyle.pointerEvents !== 'none',
            parent: el.parentElement?.className.toString() || 'body',
          });
        }
      });

      // Sort by z-index (highest first)
      results.sort((a, b) => {
        const zIndexA =
          a.styles.zIndex === 'auto' ? 0 : parseInt(a.styles.zIndex);
        const zIndexB =
          b.styles.zIndex === 'auto' ? 0 : parseInt(b.styles.zIndex);
        return zIndexB - zIndexA;
      });

      setBlockingElements(results);
    };

    // Test click propagation
    const testClickAt = (x: number, y: number) => {
      const element = document.elementFromPoint(x, y);
      const path: string[] = [];

      if (element) {
        let current: Element | null = element;
        while (current) {
          const desc = `${current.tagName.toLowerCase()}${current.id ? '#' + current.id : ''}${current.className ? '.' + current.className.toString().split(' ').join('.') : ''}`;
          path.push(desc);
          current = current.parentElement;
        }
      }

      return path;
    };

    // Perform click tests at various points
    const performClickTests = () => {
      const testPoints = [
        {
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
          label: 'Center',
        },
        { x: 100, y: 100, label: 'Top-left' },
        { x: window.innerWidth - 100, y: 100, label: 'Top-right' },
        { x: 100, y: window.innerHeight - 100, label: 'Bottom-left' },
        {
          x: window.innerWidth - 100,
          y: window.innerHeight - 100,
          label: 'Bottom-right',
        },
      ];

      const results: string[] = [];
      testPoints.forEach((point) => {
        const path = testClickAt(point.x, point.y);
        results.push(
          `${point.label} (${point.x}, ${point.y}): ${path[0] || 'nothing'}`,
        );
      });

      setClickTestResults(results);
    };

    // Initial scan
    detectClickBlockers();
    performClickTests();

    // Re-scan after a delay
    const interval = setInterval(() => {
      detectClickBlockers();
      performClickTests();
    }, 2000);

    // Add global click handler to see what actually gets clicked
    const handleGlobalClick = (e: MouseEvent) => {
      logger.info('Click detected on:', {
        target: e.target,
        currentTarget: e.currentTarget,
        clientX: e.clientX,
        clientY: e.clientY,
        element: (e.target as HTMLElement).tagName,
        className: (e.target as HTMLElement).className,
        id: (e.target as HTMLElement).id,
      });
    };

    document.addEventListener('click', handleGlobalClick, true);

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('click', handleGlobalClick, true);
    };
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Click Blocker Detector</h1>

      <div className="mb-6 p-4 bg-gray-100 rounded">
        <h2 className="text-xl font-semibold mb-2">Mouse Position</h2>
        <p>
          X: {mousePosition.x}, Y: {mousePosition.y}
        </p>
      </div>

      <div className="mb-6 p-4 bg-blue-100 rounded">
        <h2 className="text-xl font-semibold mb-2">Click Test Results</h2>
        <p className="text-sm mb-2">
          What element would receive a click at these positions:
        </p>
        {clickTestResults.map((result, index) => (
          <div key={index} className="font-mono text-sm">
            {result}
          </div>
        ))}
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">
          Potential Blocking Elements ({blockingElements.length})
        </h2>
        <div className="space-y-4">
          {blockingElements.map((element, index) => (
            <div key={index} className="p-4 bg-white border rounded shadow">
              <div className="font-mono text-sm space-y-1">
                <div>
                  <strong>Element:</strong> {element.tagName}
                  {element.id && ` #${element.id}`}
                  {element.className && ` .${element.className}`}
                </div>
                <div>
                  <strong>Parent:</strong> {element.parent}
                </div>
                <div>
                  <strong>Position:</strong> {element.styles.position} |{' '}
                  <strong>Z-Index:</strong> {element.styles.zIndex}
                </div>
                <div>
                  <strong>Pointer Events:</strong>{' '}
                  {element.styles.pointerEvents}
                </div>
                <div>
                  <strong>Size:</strong> {element.styles.width} x{' '}
                  {element.styles.height}
                </div>
                <div>
                  <strong>Location:</strong> top: {element.styles.top}, left:{' '}
                  {element.styles.left}, right: {element.styles.right}, bottom:{' '}
                  {element.styles.bottom}
                </div>
                <div>
                  <strong>Rect:</strong> {Math.round(element.rect.left)},{' '}
                  {Math.round(element.rect.top)} -{' '}
                  {Math.round(element.rect.right)},{' '}
                  {Math.round(element.rect.bottom)}
                </div>
                <div className="flex gap-4 mt-2">
                  <span
                    className={
                      element.isVisible ? 'text-green-600' : 'text-red-600'
                    }
                  >
                    {element.isVisible ? '✓ Visible' : '✗ Hidden'}
                  </span>
                  <span
                    className={
                      element.isClickable ? 'text-green-600' : 'text-red-600'
                    }
                  >
                    {element.isClickable ? '✓ Clickable' : '✗ Not Clickable'}
                  </span>
                  {element.rect.width >= window.innerWidth * 0.8 &&
                    element.rect.height >= window.innerHeight * 0.8 && (
                      <span className="text-orange-600">
                        ⚠️ Covers most of viewport
                      </span>
                    )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 p-4 bg-yellow-100 rounded">
        <h2 className="text-xl font-semibold mb-2">
          Test Interactive Elements
        </h2>
        <div className="space-y-2">
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={() => alert('Button clicked!')}
          >
            Test Button
          </button>
          <div>
            <input
              type="text"
              placeholder="Test input field"
              className="px-3 py-1 border rounded"
            />
          </div>
          <div>
            <a
              href="#"
              className="text-blue-600 underline"
              onClick={(e) => {
                e.preventDefault();
                alert('Link clicked!');
              }}
            >
              Test Link
            </a>
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-green-100 rounded">
        <h2 className="text-xl font-semibold mb-2">Instructions</h2>
        <ol className="list-decimal list-inside space-y-1">
          <li>Open this page in a new tab</li>
          <li>Look for elements with high z-index or fixed positioning</li>
          <li>Check if any element covers most of the viewport</li>
          <li>Test if the interactive elements above are clickable</li>
          <li>Open the tutorial page in another tab and compare results</li>
          <li>Look for differences in blocking elements between pages</li>
        </ol>
      </div>
    </div>
  );
}
