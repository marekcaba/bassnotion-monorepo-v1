'use client';

import { useEffect, useState } from 'react';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

interface ExtensionInfo {
  className: string;
  attributes: { [key: string]: string };
  styles: { [key: string]: string };
  innerHTML: string;
  parentInfo: string;
}

export default function IdentifyTsqdPage() {
  const [tsqdInfo, setTsqdInfo] = useState<ExtensionInfo[]>([]);
  const [scriptSources, setScriptSources] = useState<string[]>([]);

  useEffect(() => {
    logger.info('=== IDENTIFYING TSQD EXTENSION ===');

    const investigateTsqd = () => {
      const info: ExtensionInfo[] = [];

      // Find all TSQD elements
      const tsqdElements = document.querySelectorAll(
        '[class*="tsqd"], [id*="tsqd"]',
      );

      tsqdElements.forEach((el) => {
        const htmlEl = el as HTMLElement;

        // Get all attributes
        const attributes: { [key: string]: string } = {};
        for (let i = 0; i < el.attributes.length; i++) {
          const attr = el.attributes[i];
          attributes[attr.name] = attr.value;
        }

        // Get computed styles
        const computedStyles = window.getComputedStyle(el);
        const importantStyles: { [key: string]: string } = {
          position: computedStyles.position,
          zIndex: computedStyles.zIndex,
          width: computedStyles.width,
          height: computedStyles.height,
          background: computedStyles.background,
          backgroundImage: computedStyles.backgroundImage,
          content: computedStyles.content,
        };

        info.push({
          className: el.className.toString(),
          attributes,
          styles: importantStyles,
          innerHTML: htmlEl.innerHTML.substring(0, 200),
          parentInfo: el.parentElement?.className.toString() || 'no parent',
        });
      });

      setTsqdInfo(info);

      // Look for script sources that might be from extensions
      const scripts = document.querySelectorAll('script');
      const sources: string[] = [];

      scripts.forEach((script) => {
        if (
          script.src &&
          (script.src.includes('extension://') || script.src.includes('tsqd'))
        ) {
          sources.push(script.src);
        }
      });

      setScriptSources(sources);

      // Check for global objects that might give us clues
      const globalChecks = [
        'tsqd',
        'TSQD',
        'tsqdConfig',
        'tsqdSettings',
        '__tsqd__',
        '_tsqd',
      ];

      logger.info('=== Checking global objects ===');
      globalChecks.forEach((globalName) => {
        if ((window as any)[globalName]) {
          logger.info(
            `Found global: ${globalName}`,
            (window as any)[globalName],
          );
        }
      });

      // Look for any comments or data attributes that might identify the extension
      const allElements = document.querySelectorAll('*');
      allElements.forEach((el) => {
        Array.from(el.attributes).forEach((attr) => {
          if (
            attr.value.toLowerCase().includes('tsqd') ||
            attr.name.toLowerCase().includes('tsqd')
          ) {
            logger.info('Found TSQD reference:', {
              element: el.tagName,
              attribute: attr.name,
              value: attr.value,
            });
          }
        });
      });

      // Check for CSS rules
      try {
        const styleSheets = Array.from(document.styleSheets);
        styleSheets.forEach((sheet) => {
          try {
            const rules = Array.from(sheet.cssRules || []);
            rules.forEach((rule) => {
              if (rule.cssText && rule.cssText.includes('tsqd')) {
                logger.info('Found TSQD in CSS:', rule.cssText);
              }
            });
          } catch (e) {
            // Cross-origin stylesheets will throw
          }
        });
      } catch (e) {
        logger.info('Could not access stylesheets');
      }
    };

    investigateTsqd();

    // Check again after a delay
    setTimeout(investigateTsqd, 2000);
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">TSQD Extension Identifier</h1>

      <div className="bg-blue-100 border-2 border-blue-500 p-4 rounded mb-6">
        <h2 className="text-xl font-semibold mb-2">What we know about TSQD:</h2>
        <ul className="list-disc list-inside space-y-1">
          <li>Creates elements with class "tsqd-open-btn-container"</li>
          <li>Uses z-index: 100000 (very high priority)</li>
          <li>Fixed positioning at bottom right (1666, 898)</li>
          <li>48x48 pixel container with a button</li>
          <li>Has parent container "tsqd-parent-container"</li>
          <li>Contains SVG icons (possibly a floating action button)</li>
        </ul>
      </div>

      {tsqdInfo.length > 0 && (
        <div className="bg-gray-100 p-4 rounded mb-6">
          <h2 className="text-xl font-semibold mb-4">
            TSQD Elements Found ({tsqdInfo.length})
          </h2>
          {tsqdInfo.map((info, index) => (
            <div key={index} className="mb-4 p-3 bg-white rounded shadow">
              <div className="font-mono text-sm">
                <div>
                  <strong>Class:</strong> {info.className}
                </div>
                <div>
                  <strong>Parent:</strong> {info.parentInfo}
                </div>
                <div>
                  <strong>Position:</strong> {info.styles.position} |{' '}
                  <strong>Z-Index:</strong> {info.styles.zIndex}
                </div>
                <div>
                  <strong>Size:</strong> {info.styles.width} x{' '}
                  {info.styles.height}
                </div>
                {info.styles.backgroundImage !== 'none' && (
                  <div>
                    <strong>Background Image:</strong>{' '}
                    {info.styles.backgroundImage}
                  </div>
                )}
                <details className="mt-2">
                  <summary className="cursor-pointer text-blue-600">
                    View attributes
                  </summary>
                  <pre className="text-xs mt-1">
                    {JSON.stringify(info.attributes, null, 2)}
                  </pre>
                </details>
                {info.innerHTML && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-blue-600">
                      View HTML content
                    </summary>
                    <pre className="text-xs mt-1">{info.innerHTML}</pre>
                  </details>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {scriptSources.length > 0 && (
        <div className="bg-yellow-100 p-4 rounded mb-6">
          <h2 className="text-xl font-semibold mb-2">
            Extension Scripts Found
          </h2>
          {scriptSources.map((src, index) => (
            <div key={index} className="font-mono text-sm">
              {src}
            </div>
          ))}
        </div>
      )}

      <div className="bg-green-100 border-2 border-green-500 p-4 rounded">
        <h2 className="text-xl font-semibold mb-2">
          Likely candidates for TSQD:
        </h2>
        <ul className="list-disc list-inside space-y-2">
          <li>
            <strong>Session Recording Tools:</strong> FullStory, Hotjar,
            LogRocket, Smartlook
          </li>
          <li>
            <strong>Browser Testing Tools:</strong> BrowserStack, Sauce Labs,
            TestingBot
          </li>
          <li>
            <strong>Developer Tools:</strong> Debugging extensions, performance
            monitors
          </li>
          <li>
            <strong>Opera-specific tools:</strong> Opera's built-in features or
            extensions
          </li>
          <li>
            <strong>Analytics/Heatmap tools:</strong> Crazy Egg, Mouseflow,
            Lucky Orange
          </li>
        </ul>
        <p className="mt-3 font-semibold">
          Check the console for more details about global objects and CSS rules.
        </p>
      </div>
    </div>
  );
}
