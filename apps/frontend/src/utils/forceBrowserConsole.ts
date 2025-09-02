/**
 * Force console logs to appear in browser console instead of terminal
 * Next.js in development mode intercepts console and redirects to terminal
 * This utility restores browser console logging
 */

export function forceBrowserConsole() {
  if (typeof window === 'undefined') return;

  try {
    // Create an iframe to get pristine console
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.id = 'console-restore-iframe';
    document.documentElement.appendChild(iframe);

    const pristineWindow = iframe.contentWindow;
    if (!pristineWindow || !pristineWindow.console) {
      logger.warn('Could not get pristine console from iframe');
      return;
    }

    // Store methods before removing iframe
    const methods: Record<string, Function> = {};
    [
      'log',
      'warn',
      'error',
      'info',
      'debug',
      'trace',
      'group',
      'groupEnd',
      'table',
      'clear',
    ].forEach((method) => {
      if (typeof pristineWindow.console[method] === 'function') {
        methods[method] = pristineWindow.console[method].bind(
          pristineWindow.console,
        );
      }
    });

    // Now we can remove the iframe since we've bound the methods
    document.documentElement.removeChild(iframe);

    // Replace console methods
    Object.keys(methods).forEach((method) => {
      window.console[method] = methods[method];
    });

    // Also override the global console
    if (typeof globalThis !== 'undefined') {
      globalThis.console = window.console;
    }

    // Test that it works
    console.log(
      '🎉 Browser console restored! Logs will now appear in browser.',
    );
    console.log('Console test:', {
      working: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to restore browser console:', error);
  }
}

// Auto-initialize when imported
if (typeof window !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', forceBrowserConsole);
  } else {
    forceBrowserConsole();
  }
}
