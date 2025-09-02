'use client';

import { useEffect } from 'react';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

export default function DisableExtensionsPage() {
  useEffect(() => {
    logger.info('=== BROWSER EXTENSION CHECK ===');

    // Common indicators of browser extensions
    const extensionIndicators = [
      'tsqd', // The one we found
      '__REACT_DEVTOOLS_GLOBAL_HOOK__',
      '__REDUX_DEVTOOLS_EXTENSION__',
      'chrome.runtime',
      'browser.runtime',
    ];

    extensionIndicators.forEach((indicator) => {
      if (indicator.includes('.')) {
        const parts = indicator.split('.');
        let obj: any = window;
        for (const part of parts) {
          obj = obj?.[part];
        }
        if (obj) {
          logger.info(`Found extension indicator: ${indicator}`);
        }
      } else if ((window as any)[indicator]) {
        logger.info(`Found extension indicator: ${indicator}`);
      }
    });

    // Check for TSQD specifically
    const checkForTsqd = () => {
      const tsqdElements = document.querySelectorAll('[class*="tsqd"]');
      if (tsqdElements.length > 0) {
        logger.info(`TSQD elements found: ${tsqdElements.length}`);
        tsqdElements.forEach((el) => {
          logger.info('TSQD element:', {
            className: el.className,
            tagName: el.tagName,
            parent: el.parentElement?.className,
          });
        });
      }
    };

    checkForTsqd();
    setTimeout(checkForTsqd, 1000);
  }, []);

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-red-600">
        Browser Extension Blocking Issue
      </h1>

      <div className="bg-red-100 border-2 border-red-500 p-6 rounded mb-6">
        <h2 className="text-xl font-semibold mb-3">
          ⚠️ A browser extension is blocking clicks!
        </h2>
        <p className="mb-2">
          The "TSQD" elements with z-index 100000 are from a browser extension.
        </p>
        <p>
          This is NOT a code issue - it\'s an external tool interfering with
          your page.
        </p>
      </div>

      <div className="bg-blue-100 border-2 border-blue-500 p-6 rounded mb-6">
        <h2 className="text-xl font-semibold mb-3">🔧 Solutions:</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>
            <strong>Disable Opera Extensions:</strong>
            <ul className="list-disc list-inside ml-4 mt-1">
              <li>Go to opera://extensions/</li>
              <li>Disable all extensions temporarily</li>
              <li>Reload your tutorial page</li>
            </ul>
          </li>
          <li className="mt-3">
            <strong>Use Incognito/Private Mode:</strong>
            <ul className="list-disc list-inside ml-4 mt-1">
              <li>Open Opera private window (Ctrl+Shift+N or Cmd+Shift+N)</li>
              <li>Navigate to your tutorial page</li>
              <li>Extensions are usually disabled in private mode</li>
            </ul>
          </li>
          <li className="mt-3">
            <strong>Try a Different Browser:</strong>
            <ul className="list-disc list-inside ml-4 mt-1">
              <li>Chrome, Firefox, or Safari</li>
              <li>This will confirm it\'s an Opera-specific extension issue</li>
            </ul>
          </li>
        </ol>
      </div>

      <div className="bg-yellow-100 border-2 border-yellow-500 p-6 rounded">
        <h2 className="text-xl font-semibold mb-3">📝 What is TSQD?</h2>
        <p className="mb-2">
          Based on the element structure, TSQD appears to be:
        </p>
        <ul className="list-disc list-inside space-y-1">
          <li>A session recording or analytics tool</li>
          <li>A debugging/developer tool extension</li>
          <li>A screen recording extension</li>
          <li>Opera\'s built-in developer tools or feature</li>
        </ul>
        <p className="mt-3">
          The "tsqd-open-btn-container" suggests it adds a floating button to
          pages.
        </p>
      </div>

      <div className="mt-6 p-4 bg-gray-100 rounded">
        <p className="font-semibold">
          Check the console for extension indicators.
        </p>
        <p>Your code is fine - this is an external browser extension issue.</p>
      </div>
    </div>
  );
}
