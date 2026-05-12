/**
 * Aggressive console restoration for stubborn console suppressions
 */

import { debugLog, createDebugWindow } from './consoleDebugWindow';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

export function aggressiveConsoleRestore() {
  if (typeof window === 'undefined') return;

  // Method 1: Try to use __debugConsole if available
  if (window.__debugConsole?.original) {
    Object.assign(console, window.__debugConsole.original);
    logger.info('✅ Console restored from __debugConsole');
    return;
  }

  // Method 2: Create iframe and steal its console
  try {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const pristineConsole = iframe.contentWindow?.console;
    if (pristineConsole) {
      // Copy all console methods
      const methods = [
        'log',
        'warn',
        'error',
        'info',
        'debug',
        'trace',
        'table',
        'group',
        'groupEnd',
        'time',
        'timeEnd',
      ];
      methods.forEach((method) => {
        if (pristineConsole[method]) {
          console[method] = pristineConsole[method].bind(pristineConsole);
        }
      });

      // Also try to replace the entire console object
      // Note: This may fail if console is read-only, which is fine
      try {
        Object.assign(console, pristineConsole);
      } catch (e) {
        // Might be read-only, ignore
      }

      logger.info('✅ Console aggressively restored via iframe');
    }

    document.body.removeChild(iframe);
  } catch (e) {
    // Ignore errors
  }

  // Method 3: Force override with native functions
  try {
    const nativeLog = Function.prototype.bind.call(
      Function.prototype.call,
      console.log,
    );
    console.log = (...args: any[]) => nativeLog(console, ...args);
    logger.info('✅ Console restored via native function binding');
  } catch (e) {
    // Ignore
  }

  // Method 4: Create completely new console methods with debug window fallback
  createDebugWindow(); // Ensure debug window exists

  const methods = ['log', 'warn', 'error', 'info', 'debug'] as const;

  methods.forEach((method) => {
    const original = console[method];
    console[method] = (...args: any[]) => {
      // Try original first
      if (typeof original === 'function') {
        try {
          original.apply(console, args);
          return; // If it worked, we're done
        } catch (e) {
          // Fall through to backup
        }
      }

      // Backup: Log to debug window
      debugLog[method](...args);
    };
  });
}

// For use in components
export function ensureConsoleWorks() {
  if (typeof window !== 'undefined') {
    // Run on next tick to ensure DOM is ready
    setTimeout(() => {
      aggressiveConsoleRestore();

      // Test both console and debug window
      logger.info('🎯 Console test after aggressive restore');
      debugLog.log('✅ Debug window is working!');
      debugLog.info(
        'Click the buttons above to interact with the debug window',
      );
    }, 0);
  }
}
