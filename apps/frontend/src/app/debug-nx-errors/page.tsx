'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

export default function DebugNxErrorsPage() {
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);
  const [consoleMessages, setConsoleMessages] = useState<string[]>([]);

  useEffect(() => {
    logger.info('=== NX ERROR DEBUG PAGE ===');

    // Capture console errors
    const originalError = console.error;
    const capturedErrors: string[] = [];

    console.error = (...args) => {
      const errorMessage = args
        .map((arg) =>
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg),
        )
        .join(' ');

      capturedErrors.push(errorMessage);
      setErrors((prev) => [...prev, errorMessage]);

      // Still log to actual console
      originalError.apply(console, args);
    };

    // Capture all console messages
    const originalLog = console.log;
    const originalWarn = console.warn;
    const capturedMessages: string[] = [];

    const captureMessage = (type: string, ...args: any[]) => {
      const message = `[${type}] ${args
        .map((arg) =>
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg),
        )
        .join(' ')}`;

      capturedMessages.push(message);
      setConsoleMessages((prev) => [...prev, message]);
    };

    console.log = (...args) => {
      captureMessage('LOG', ...args);
      originalLog.apply(console, args);
    };

    console.warn = (...args) => {
      captureMessage('WARN', ...args);
      originalWarn.apply(console, args);
    };

    // Listen for unhandled errors
    const errorHandler = (event: ErrorEvent) => {
      const errorInfo = `Unhandled Error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`;
      setErrors((prev) => [...prev, errorInfo]);
    };

    window.addEventListener('error', errorHandler);

    // Listen for unhandled promise rejections
    const rejectionHandler = (event: PromiseRejectionEvent) => {
      const errorInfo = `Unhandled Promise Rejection: ${event.reason}`;
      setErrors((prev) => [...prev, errorInfo]);
    };

    window.addEventListener('unhandledrejection', rejectionHandler);

    // Check for NX-specific issues
    const checkNxIssues = () => {
      // Check if NX global is available
      if (typeof (window as any).__NX__ !== 'undefined') {
        logger.info('NX Global found:', (window as any).__NX__);
      }

      // Check for any elements with nx- attributes
      const nxElements = document.querySelectorAll(
        '[class*="nx-"], [id*="nx-"], [data-nx]',
      );
      logger.info(`Found ${nxElements.length} elements with NX attributes`);

      // Check for overlapping elements that might block clicks
      const allElements = document.querySelectorAll('*');
      const overlappingElements: Element[] = [];

      allElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const styles = window.getComputedStyle(el);

        if (
          (styles.position === 'fixed' || styles.position === 'absolute') &&
          rect.width > 0 &&
          rect.height > 0 &&
          styles.pointerEvents !== 'none'
        ) {
          // Check if this element overlaps with viewport
          if (
            rect.top < window.innerHeight &&
            rect.bottom > 0 &&
            rect.left < window.innerWidth &&
            rect.right > 0
          ) {
            overlappingElements.push(el);
          }
        }
      });

      logger.info(
        `Found ${overlappingElements.length} potentially overlapping elements`,
      );
      overlappingElements.forEach((el, index) => {
        const rect = el.getBoundingClientRect();
        const styles = window.getComputedStyle(el);
        logger.info(`Overlapping element ${index}:`, {
          tagName: el.tagName,
          className: el.className,
          id: el.id,
          position: styles.position,
          zIndex: styles.zIndex,
          dimensions: `${rect.width}x${rect.height}`,
          location: `(${rect.left}, ${rect.top})`,
        });
      });
    };

    // Run checks after page loads
    setTimeout(checkNxIssues, 1000);

    // Test click handler
    document.addEventListener('click', (e) => {
      logger.info('Click detected:', {
        target: e.target,
        clientX: e.clientX,
        clientY: e.clientY,
        propagationStopped: e.defaultPrevented,
      });
    });

    return () => {
      // Restore original console methods
      console.error = originalError;
      console.log = originalLog;
      console.warn = originalWarn;
      window.removeEventListener('error', errorHandler);
      window.removeEventListener('unhandledrejection', rejectionHandler);
    };
  }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">NX Error Debug Page</h1>

      <div className="mb-8 space-y-4">
        <button
          onClick={() => {
            logger.info('Test button clicked');
            alert('Button click works!');
          }}
          className="px-6 py-3 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Test Click Functionality
        </button>

        <button
          onClick={() => {
            // Force an error to test error capture
            throw new Error('Test NX Error');
          }}
          className="px-6 py-3 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Trigger Test Error
        </button>

        <button
          onClick={() => router.push('/safe-fix')}
          className="px-6 py-3 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Go to Safe Fix Page
        </button>
      </div>

      <div className="bg-red-100 border-2 border-red-500 p-4 rounded mb-6">
        <h2 className="text-xl font-semibold mb-2">
          Captured Errors ({errors.length})
        </h2>
        {errors.length === 0 ? (
          <p className="text-gray-600">No errors captured yet</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {errors.map((error, index) => (
              <div
                key={index}
                className="p-2 bg-white rounded text-sm font-mono"
              >
                {error}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-blue-100 border-2 border-blue-500 p-4 rounded">
        <h2 className="text-xl font-semibold mb-2">
          Console Messages ({consoleMessages.length})
        </h2>
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {consoleMessages.map((msg, index) => (
            <div key={index} className="p-1 bg-white rounded text-xs font-mono">
              {msg}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 p-4 bg-yellow-100 rounded">
        <h3 className="font-semibold mb-2">Debug Instructions:</h3>
        <ol className="list-decimal list-inside space-y-1">
          <li>This page captures all console errors and messages</li>
          <li>Check the red box for any NX-related errors</li>
          <li>Look for overlapping elements in the console messages</li>
          <li>Test if clicks work with the blue button</li>
          <li>Navigate to Safe Fix page if clicks are blocked</li>
        </ol>
      </div>
    </div>
  );
}
